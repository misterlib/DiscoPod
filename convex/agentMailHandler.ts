import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import { components, internal, api } from "./_generated/api";
import { action, internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { AgentMail } from "@agentmail/convex";
import { sendHitlEscalationEmail } from "./lib/emailDispatcher";

/**
 * Normalizes email address strings from email client headers, e.g.:
 * "Kurt Libby <kurt@magicmakrs.com>" -> "kurt@magicmakrs.com"
 * "<kurt@magicmakrs.com>" -> "kurt@magicmakrs.com"
 */
export function extractCleanEmail(raw?: string | null): string {
  if (!raw) return "";
  const match = raw.match(/<([^>]+)>/);
  const email = match ? match[1] : raw;
  return email.trim().toLowerCase();
}

/**
 * Resolves AgentMail inbox ID with robust fallback to production env or default inbox.
 */
export function resolveInboxId(inboxId?: string | null): string {
  if (inboxId && inboxId !== "discopod-main") {
    return inboxId.includes("@") ? inboxId : `${inboxId}@agentmail.to`;
  }
  const raw = process.env.AGENTMAIL_INBOX_ID || "discopod@agentmail.to";
  return raw.includes("@") ? raw : `${raw}@agentmail.to`;
}

/**
 * Direct REST API dispatcher for AgentMail replies.
 * Runs directly in Convex action runtime using process.env.AGENTMAIL_API_KEY.
 * Avoids component env isolation issues and reliably delivers replies.
 */
export async function sendAgentMailReply(params: {
  apiKey?: string;
  inboxId?: string;
  parentMessageId?: string;
  to: string;
  subject: string;
  text: string;
  labels?: string[];
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = params.apiKey || process.env.AGENTMAIL_API_KEY;
  if (!apiKey) {
    console.error("[sendAgentMailReply] Missing AGENTMAIL_API_KEY");
    return { success: false, error: "Missing AGENTMAIL_API_KEY" };
  }
  const cleanInboxId = resolveInboxId(params.inboxId);
  const cleanTo = extractCleanEmail(params.to) || params.to;
  const cleanSubject = params.subject.startsWith("Re:") ? params.subject : `Re: ${params.subject || "Your DiscoPod Reel"}`;

  // 1. Try replying to parent message if parentMessageId is provided
  if (params.parentMessageId) {
    try {
      const replyUrl = `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(cleanInboxId)}/messages/${encodeURIComponent(params.parentMessageId)}/reply`;
      const res = await fetch(replyUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: [cleanTo],
          subject: cleanSubject,
          text: params.text,
          labels: params.labels || ["agent-reply"],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { message_id: string };
        console.log(`[sendAgentMailReply] Reply delivered via reply endpoint to ${cleanTo}, id=${data.message_id}`);
        return { success: true, messageId: data.message_id };
      }
      const errText = await res.text();
      console.warn(`[sendAgentMailReply] Reply endpoint returned ${res.status}: ${errText}. Falling back to send...`);
    } catch (err: any) {
      console.warn(`[sendAgentMailReply] Reply attempt failed: ${err.message}. Falling back to send...`);
    }
  }

  // 2. Fallback to direct send if reply fails or parentMessageId is not present
  try {
    const sendUrl = `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(cleanInboxId)}/messages/send`;
    const res = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: [cleanTo],
        subject: cleanSubject,
        text: params.text,
        labels: params.labels || ["agent-reply"],
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { message_id: string };
      console.log(`[sendAgentMailReply] Send delivered via send endpoint to ${cleanTo}, id=${data.message_id}`);
      return { success: true, messageId: data.message_id };
    }
    const errText = await res.text();
    console.error(`[sendAgentMailReply] Send endpoint error ${res.status}: ${errText}`);
    return { success: false, error: errText };
  } catch (err: any) {
    console.error(`[sendAgentMailReply] Error in direct send fallback:`, err);
    return { success: false, error: err.message };
  }
}

export const onMessageReceived = internalMutation({
  args: {
    message: v.any(),
    thread: v.any(),
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    const msg = args.message || {};
    const thr = args.thread || {};

    const rawInbox = msg.inbox_id || msg.inboxId || process.env.AGENTMAIL_INBOX_ID || "discopod@agentmail.to";
    const inboxId = resolveInboxId(rawInbox);
    const messageId = msg.message_id || msg.id || "";
    const threadId = msg.thread_id || thr.thread_id || thr.id || "";
    const from = typeof msg.from === "object" && msg.from?.address ? msg.from.address : (typeof msg.from === "string" ? msg.from : "");
    const text = msg.text || msg.extracted_text || "";
    const subject = msg.subject || "";

    console.log(`[agentMailHandler/onMessageReceived] Webhook message received: from=${from}, inboxId=${inboxId}, threadId=${threadId}, messageId=${messageId}`);

    await ctx.scheduler.runAfter(0, internal.agentMailHandler.processInboundReply, {
      inboxId,
      messageId,
      threadId,
      from,
      text,
      subject,
    });
  },
});

export const onEvent = internalMutation({
  args: {
    event: v.any(),
  },
  handler: async (ctx, args) => {
    const event = args.event || {};
    const eventType = event.event_type;

    if (
      eventType === "message.bounced" ||
      eventType === "message.complained" ||
      eventType === "message.rejected"
    ) {
      const recipient =
        event.bounce?.recipient ||
        event.bounce?.email ||
        event.complaint?.recipient ||
        event.complaint?.email ||
        event.reject?.recipient ||
        event.reject?.email ||
        (Array.isArray(event.message?.to) ? event.message.to[0] : event.message?.to) ||
        (Array.isArray(event.send?.to) ? event.send.to[0] : event.send?.to);

      if (recipient && typeof recipient === "string") {
        const cleanEmail = recipient.trim().toLowerCase();
        const reason =
          eventType === "message.bounced"
            ? ("bounced" as const)
            : eventType === "message.complained"
            ? ("complained" as const)
            : ("rejected" as const);

        const existing = await ctx.db
          .query("emailSuppressions")
          .withIndex("by_email", (q) => q.eq("email", cleanEmail))
          .first();

        if (!existing) {
          await ctx.db.insert("emailSuppressions", {
            email: cleanEmail,
            reason,
            eventType,
            details: JSON.stringify(event.bounce || event.complaint || event.reject || {}),
            createdAt: Date.now(),
          });
          console.warn(
            `[agentMailHandler:onEvent] Auto-suppressed email ${cleanEmail} due to ${eventType}`,
          );
        }
      }
    }
  },
});

export const recordAgentMailInteraction = internalMutation({
  args: {
    inboxId: v.string(),
    threadId: v.string(),
    messageId: v.string(),
    from: v.string(),
    subject: v.string(),
    text: v.string(),
    intent: v.string(),
    outcome: v.string(),
    replyText: v.string(),
    replyMessageId: v.optional(v.string()),
    showId: v.optional(v.id("shows")),
    showTitle: v.optional(v.string()),
    status: v.union(v.literal("replied"), v.literal("failed"), v.literal("escalated"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentMailInteractions", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const processInboundReply = internalAction({
  args: {
    inboxId: v.string(),
    messageId: v.string(),
    threadId: v.string(),
    from: v.string(),
    text: v.string(),
    subject: v.string(),
  },
  returns: v.object({
    intent: v.string(),
    outcome: v.string(),
    replyMessage: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ intent: string; outcome: string; replyMessage: string }> => {
    // 0. Security: enforce from-address allowlist when override mode is active
    const settings = await ctx.runQuery(internal.ownerSettings.getOwnerSettingsInternal, {});
    const incomingFrom = extractCleanEmail(args.from);
    const hitlAdminEmail = extractCleanEmail(settings.humanInTheLoopEmail);
    const overrideEmail = extractCleanEmail(settings.emailOverrideAddress);

    const isHitlAdmin = Boolean(hitlAdminEmail && incomingFrom === hitlAdminEmail);
    const isOverrideAdmin = Boolean(overrideEmail && incomingFrom === overrideEmail);
    const isAdmin = isHitlAdmin || isOverrideAdmin;

    const textTrimmed = args.text.trim();
    const textUpper = textTrimmed.toUpperCase();
    const isTakedownCmd = textUpper.startsWith("TAKEDOWN") || textTrimmed.toLowerCase().includes("take down my show");

    const senderContext: any = await ctx.runMutation(
      internal.agentMailHandler.resolveInboundSenderContext,
      {
        from: args.from,
        threadId: args.threadId,
        text: args.text,
        subject: args.subject,
      },
    );

    const isOnFileCreator = senderContext.candidateShows.length > 0;

    // Unlock host under Single-Contact Rule now that an inbound reply has been received
    try {
      await ctx.runMutation(internal.ownerSettings.markHostReplyReceived, {
        email: incomingFrom,
        threadId: args.threadId,
        showId: senderContext.primaryShow?.showId,
      });
    } catch (err) {
      console.error("[processInboundReply] Error marking host reply received:", err);
    }

    if (!settings.emailEnabled && overrideEmail) {
      if (!isAdmin && !isTakedownCmd && !isOnFileCreator) {
        console.warn(
          `[processInboundReply] Rejected inbound from ${args.from} (normalized: ${incomingFrom}) — override mode active, only ${overrideEmail} or HITL admin is allowed.`,
        );
        const rejReply = "Thanks for your message! DiscoPod is currently in private testing mode. Your message has been received but cannot be processed at this time.";
        if (process.env.AGENTMAIL_API_KEY && args.from) {
          await sendAgentMailReply({
            inboxId: args.inboxId,
            parentMessageId: args.messageId,
            to: args.from,
            subject: args.subject,
            text: rejReply,
            labels: ["rejected-override-mode"],
          });
        }
        await ctx.runMutation(internal.agentMailHandler.recordAgentMailInteraction, {
          inboxId: args.inboxId,
          threadId: args.threadId,
          messageId: args.messageId,
          from: args.from,
          subject: args.subject,
          text: args.text,
          intent: "REJECTED",
          outcome: "from_address_not_allowed",
          replyText: rejReply,
          status: "rejected",
        });
        return { intent: "REJECTED", outcome: "from_address_not_allowed", replyMessage: "" };
      }
    }

    // 0b. ADMINISTRATIVE COMMAND PROCESSING (if sender is authorized Admin or HITL email)
    if (isAdmin) {

      // ADMIN COMMAND: APPROVE <optional requestId>
      if (textUpper.startsWith("APPROVE")) {
        const match = textTrimmed.match(/APPROVE\s+([a-zA-Z0-9_]+)/i);
        const reqIdStr = match ? match[1].trim() : undefined;
        const res: { success: boolean; message: string } = await ctx.runMutation(
          internal.agentMailHandler.applyAdminApproveAccess,
          {
            requestId: reqIdStr,
          },
        );

        let repMsgId: string | undefined;
        if (process.env.AGENTMAIL_API_KEY && args.from) {
          const rep = await sendAgentMailReply({
            inboxId: args.inboxId,
            parentMessageId: args.messageId,
            to: args.from,
            subject: `Re: ${args.subject || "Admin Action: Approved Access"}`,
            text: res.message,
            labels: ["admin-command", "admin-approve"],
          });
          repMsgId = rep.messageId;
        }
        await ctx.runMutation(internal.agentMailHandler.recordAgentMailInteraction, {
          inboxId: args.inboxId,
          threadId: args.threadId,
          messageId: args.messageId,
          from: args.from,
          subject: args.subject,
          text: args.text,
          intent: "ADMIN_COMMAND",
          outcome: "admin_approved",
          replyText: res.message,
          replyMessageId: repMsgId,
          status: "replied",
        });
        return { intent: "ADMIN_COMMAND", outcome: "admin_approved", replyMessage: res.message };
      }

      // ADMIN COMMAND: REJECT <optional requestId> [optional reason]
      if (textUpper.startsWith("REJECT")) {
        const match = textTrimmed.match(/REJECT\s+([a-zA-Z0-9_]+)(?:\s+(.*))?/i);
        const reqIdStr = match ? match[1].trim() : undefined;
        const reason = match && match[2] ? match[2].trim() : undefined;
        const res: { success: boolean; message: string } = await ctx.runMutation(
          internal.agentMailHandler.applyAdminRejectAccess,
          {
            requestId: reqIdStr,
            reason,
          },
        );

        let repMsgId: string | undefined;
        if (process.env.AGENTMAIL_API_KEY && args.from) {
          const rep = await sendAgentMailReply({
            inboxId: args.inboxId,
            parentMessageId: args.messageId,
            to: args.from,
            subject: `Re: ${args.subject || "Admin Action: Rejected Access"}`,
            text: res.message,
            labels: ["admin-command", "admin-reject"],
          });
          repMsgId = rep.messageId;
        }
        await ctx.runMutation(internal.agentMailHandler.recordAgentMailInteraction, {
          inboxId: args.inboxId,
          threadId: args.threadId,
          messageId: args.messageId,
          from: args.from,
          subject: args.subject,
          text: args.text,
          intent: "ADMIN_COMMAND",
          outcome: "admin_rejected",
          replyText: res.message,
          replyMessageId: repMsgId,
          status: "replied",
        });
        return { intent: "ADMIN_COMMAND", outcome: "admin_rejected", replyMessage: res.message };
      }

      // ADMIN COMMAND: STATUS or PENDING
      if (textUpper.startsWith("STATUS") || textUpper.startsWith("PENDING")) {
        const statusData: {
          pendingRequests: number;
          totalShows: number;
          verifiedClaims: number;
          takedownCount: number;
        } = await ctx.runQuery(internal.agentMailHandler.getAdminStatusSummary, {});
        const replyMessage = `📊 DiscoPod Admin Overview:
- Pending Access Requests: ${statusData.pendingRequests}
- Total Ingested Shows: ${statusData.totalShows}
- Verified Claims: ${statusData.verifiedClaims}
- Takedowns on File: ${statusData.takedownCount}

To approve a pending request, reply "APPROVE <requestId>".
To reject a request, reply "REJECT <requestId>".
To takedown a podcast, reply "TAKEDOWN <show name>".`;

        let repMsgId: string | undefined;
        if (process.env.AGENTMAIL_API_KEY && args.from) {
          const rep = await sendAgentMailReply({
            inboxId: args.inboxId,
            parentMessageId: args.messageId,
            to: args.from,
            subject: `Re: ${args.subject || "Admin Status Report"}`,
            text: replyMessage,
            labels: ["admin-command", "admin-status"],
          });
          repMsgId = rep.messageId;
        }
        await ctx.runMutation(internal.agentMailHandler.recordAgentMailInteraction, {
          inboxId: args.inboxId,
          threadId: args.threadId,
          messageId: args.messageId,
          from: args.from,
          subject: args.subject,
          text: args.text,
          intent: "ADMIN_COMMAND",
          outcome: "admin_status_sent",
          replyText: replyMessage,
          replyMessageId: repMsgId,
          status: "replied",
        });
        return { intent: "ADMIN_COMMAND", outcome: "admin_status_sent", replyMessage };
      }

      // ADMIN COMMAND: TAKEDOWN <show title>
      if (textUpper.startsWith("TAKEDOWN")) {
        const match = textTrimmed.match(/TAKEDOWN\s+(.+)/i);
        const targetTitle = match ? match[1].trim() : "";
        if (targetTitle) {
          await ctx.runMutation(api.takedowns.submitTakedown, {
            title: targetTitle,
            source: "admin",
            reason: "Admin command executed via AgentMail",
          });
          const replyMessage = `✓ Show "${targetTitle}" has been permanently taken down and tombstoned against future indexing.`;

          let repMsgId: string | undefined;
          if (process.env.AGENTMAIL_API_KEY && args.from) {
            const rep = await sendAgentMailReply({
              inboxId: args.inboxId,
              parentMessageId: args.messageId,
              to: args.from,
              subject: `Re: ${args.subject || "Admin Takedown Complete"}`,
              text: replyMessage,
              labels: ["admin-command", "admin-takedown"],
            });
            repMsgId = rep.messageId;
          }
          await ctx.runMutation(internal.agentMailHandler.recordAgentMailInteraction, {
            inboxId: args.inboxId,
            threadId: args.threadId,
            messageId: args.messageId,
            from: args.from,
            subject: args.subject,
            text: args.text,
            intent: "ADMIN_COMMAND",
            outcome: "admin_takedown",
            replyText: replyMessage,
            replyMessageId: repMsgId,
            status: "replied",
          });
          return { intent: "ADMIN_COMMAND", outcome: "admin_takedown", replyMessage };
        }
      }
    }


    // 0d. DIRECT TAKEDOWN COMMAND FROM CREATOR OR OUTSIDE SENDER
    if (!isAdmin && (textUpper.startsWith("TAKEDOWN") || textTrimmed.toLowerCase().includes("take down my show"))) {
      const match = textTrimmed.match(/TAKEDOWN\s+(.+)/i);
      let targetTitle = match ? match[1].trim() : "";

      if (senderContext.isNetwork) {
        if (senderContext.confidence === "high" && senderContext.resolvedShow) {
          targetTitle = senderContext.resolvedShow.title;
        } else {
          // Low confidence network takedown -> Escalate to HITL, do not take down wrong show!
          if (hitlAdminEmail) {
            await sendHitlEscalationEmail(ctx, {
              subject: `[DiscoPod HITL] Ambiguous Takedown from Network (${args.from})`,
              headline: `Network Takedown Ambiguity: Show Not Specified`,
              podcastTitle: `Network (${senderContext.candidateShows.map((s: any) => `"${s.title}"`).join(", ")})`,
              podcastId: senderContext.candidateShows[0].showId,
              emailOnFile: args.from,
              unresolvedCreatorMessage: `Subject: ${args.subject}\n\n${args.text}`,
              actionInstructions: [
                `Sender requested takedown without specifying which network show to remove.`,
                ...senderContext.candidateShows.map(
                  (s: any) => `• Reply "TAKEDOWN ${s.title}" to take down "${s.title}"`,
                ),
              ],
            });
          }

          const showListStr = senderContext.candidateShows.map((s: any) => `• "${s.title}"`).join("\n");
          const replyMessage = `We received your takedown request from ${args.from}. Because your network email is associated with multiple shows on DiscoPod:\n${showListStr}\n\nWe need to know specifically which podcast you want removed. Our support team has been looped in, or you can reply directly with the exact show title you would like taken down.`;

          let repMsgId: string | undefined;
          if (process.env.AGENTMAIL_API_KEY && args.from) {
            const rep = await sendAgentMailReply({
              inboxId: args.inboxId,
              parentMessageId: args.messageId,
              to: args.from,
              subject: `Re: ${args.subject || "Takedown Request - Clarification Needed"}`,
              text: replyMessage,
              labels: ["network-ambiguity-escalated", "creator-takedown-ambiguous"],
            });
            repMsgId = rep.messageId;
          }

          await ctx.runMutation(internal.agentMailHandler.recordAgentMailInteraction, {
            inboxId: args.inboxId,
            threadId: args.threadId,
            messageId: args.messageId,
            from: args.from,
            subject: args.subject,
            text: args.text,
            intent: "TAKEDOWN",
            outcome: "escalated_hitl_network_ambiguity",
            replyText: replyMessage,
            replyMessageId: repMsgId,
            status: "escalated",
          });

          return {
            intent: "TAKEDOWN",
            outcome: "escalated_hitl_network_ambiguity",
            replyMessage,
          };
        }
      }

      if (!targetTitle && senderContext.resolvedShow) {
        targetTitle = senderContext.resolvedShow.title;
      }

      if (targetTitle) {
        const takedownRes: {
          success: boolean;
          verified: boolean;
          requiresHumanReview: boolean;
          message: string;
        } = await ctx.runMutation(api.takedowns.submitTakedown, {
          title: targetTitle,
          requesterEmail: args.from,
          source: "email_inbox",
          reason: "Inbound email takedown command",
        });

        const replyMessage = takedownRes.verified
          ? `✓ Confirmed. Per your request from the verified email address on file, "${targetTitle}" has been permanently removed from DiscoPod and tombstoned against future indexing.`
          : `We received your takedown request for "${targetTitle}". To protect podcasters from competitor actions, takedown requests must come from the official email on file or undergo human review. Because your email (${args.from}) does not match our records on file, your request has been queued for human verification.`;

        let repMsgId: string | undefined;
        if (process.env.AGENTMAIL_API_KEY && args.from) {
          const rep = await sendAgentMailReply({
            inboxId: args.inboxId,
            parentMessageId: args.messageId,
            to: args.from,
            subject: `Re: ${args.subject || "Takedown Request Status"}`,
            text: replyMessage,
            labels: [
              "creator-takedown",
              takedownRes.verified ? "verified-takedown" : "unverified-takedown",
            ],
          });
          repMsgId = rep.messageId;
        }

        await ctx.runMutation(internal.agentMailHandler.recordAgentMailInteraction, {
          inboxId: args.inboxId,
          threadId: args.threadId,
          messageId: args.messageId,
          from: args.from,
          subject: args.subject,
          text: args.text,
          intent: "TAKEDOWN",
          outcome: takedownRes.verified ? "verified_takedown" : "takedown_queued_hitl",
          replyText: replyMessage,
          replyMessageId: repMsgId,
          showTitle: targetTitle,
          status: takedownRes.verified ? "replied" : "escalated",
        });

        return {
          intent: "TAKEDOWN",
          outcome: takedownRes.verified ? "verified_takedown" : "takedown_queued_hitl",
          replyMessage,
        };
      }
    }

    // 1. Check for Network Ambiguity on general inbound (when confidence is NOT high)
    if (senderContext.isNetwork && senderContext.confidence !== "high") {
      if (hitlAdminEmail) {
        await sendHitlEscalationEmail(ctx, {
          subject: `[DiscoPod HITL] Network Ambiguity: Human help needed for ${args.from} (${senderContext.candidateShows.length} shows)`,
          headline: `Network Email Ambiguity: Low Confidence on Show Selection`,
          podcastTitle: `Network Portfolio (${senderContext.candidateShows.map((s: any) => `"${s.title}"`).slice(0, 3).join(", ")})`,
          podcastId: senderContext.candidateShows[0].showId,
          emailOnFile: args.from,
          unresolvedCreatorMessage: `Subject: ${args.subject}\n\n${args.text}`,
          actionInstructions: [
            `Sender email matches ${senderContext.candidateShows.length} shows on file, but inbound message did not unambiguously identify one show.`,
            ...senderContext.candidateShows.map(
              (s: any) => `• Reply "APPROVE ${s.showId}" to verify "${s.title}"`,
            ),
            `• Or manage in Admin Dashboard at https://agreeable-pika-776.convex.site/admin`,
          ],
        });
      }

      await ctx.runMutation(internal.agentMailHandler.recordNetworkDisambiguationRequest, {
        showId: senderContext.candidateShows[0].showId,
        fromEmail: args.from,
        candidateShowIds: senderContext.candidateShows.map((s: any) => s.showId),
        candidateTitles: senderContext.candidateShows.map((s: any) => s.title),
        subject: args.subject,
        text: args.text,
      });

      const showBullets = senderContext.candidateShows.map((s: any) => `• "${s.title}"`).join("\n");
      const replyMessage = `Hello! We received your message from ${args.from}.\n\nBecause your address is associated with multiple shows in our network directory:\n${showBullets}\n\nWe want to ensure we verify or update the right show. Our support team has been alerted for human review. If you'd like to expedite this, please reply specifying which show title you are referencing!`;

      let repMsgId: string | undefined;
      if (process.env.AGENTMAIL_API_KEY && args.from) {
        const rep = await sendAgentMailReply({
          inboxId: args.inboxId,
          parentMessageId: args.messageId,
          to: args.from,
          subject: args.subject.startsWith("Re:") ? args.subject : `Re: ${args.subject || "Your DiscoPod Reel"}`,
          text: replyMessage,
          labels: ["network-ambiguity-escalated"],
        });
        repMsgId = rep.messageId;
      }

      await ctx.runMutation(internal.agentMailHandler.recordAgentMailInteraction, {
        inboxId: args.inboxId,
        threadId: args.threadId,
        messageId: args.messageId,
        from: args.from,
        subject: args.subject,
        text: args.text,
        intent: "NETWORK_DISAMBIGUATION_NEEDED",
        outcome: "escalated_hitl_network_ambiguity",
        replyText: replyMessage,
        replyMessageId: repMsgId,
        status: "escalated",
      });

      return {
        intent: "NETWORK_DISAMBIGUATION_NEEDED",
        outcome: "escalated_hitl_network_ambiguity",
        replyMessage,
      };
    }

    // 1b. Find corresponding show claim and show
    const resolvedShowId = senderContext.resolvedShow?.showId;
    const claim: {
      claimId: Id<"territoryClaims">;
      showId: Id<"shows">;
      showTitle: string;
      token: string;
      isClaimed?: boolean;
    } | null = await ctx.runMutation(internal.agentMailHandler.resolveClaimForThread, {
      threadId: args.threadId,
      text: args.text,
      showId: resolvedShowId,
    });

    // 1b. Fetch live listener analytics for this show
    const showStats = claim
      ? await ctx.runQuery(internal.agentMailHandler.getShowStats, { showId: claim.showId })
      : null;

    // 2. Parse intent via GPT-4o with real analytics context
    const openAiKey = process.env.OPENAI_API_KEY;
    const parsed = await parseInboundIntentWithGpt4o({
      openAiKey,
      inboundText: args.text,
      showTitle: claim?.showTitle || senderContext.resolvedShow?.title || "Your Show",
      showStats,
      claimToken: claim?.token,
    });

    let outcome = "clarification_sent";

    // 3. Apply state changes
    if (claim) {
      if (parsed.intent === "VERIFY_CLAIM") {
        await ctx.runMutation(internal.agentMailHandler.applyVerifyClaim, {
          claimId: claim.claimId,
          showId: claim.showId,
        });
        outcome = "claim_verified";
      } else if (parsed.intent === "REQUEST_CLAIM_CODE") {
        outcome = "claim_code_sent";
      } else if (parsed.intent === "RE_SLICE" && parsed.startTimeSeconds !== null) {
        const start = parsed.startTimeSeconds;
        const end = parsed.endTimeSeconds ?? start + 45;
        await ctx.runMutation(internal.agentMailHandler.applyReSlice, {
          showId: claim.showId,
          startTime: start,
          endTime: end,
        });
        outcome = "snippet_resliced";
      } else if (parsed.intent === "UPDATE_HOOK" && parsed.customHookText) {
        await ctx.runMutation(internal.agentMailHandler.applyUpdateHook, {
          showId: claim.showId,
          hookText: parsed.customHookText,
        });
        outcome = "hook_updated";
      } else if (parsed.intent === "REJECT_CLAIM") {
        const rejectRes: { verified: boolean; message: string } = await ctx.runMutation(
          internal.agentMailHandler.applyRejectClaim,
          {
            claimId: claim.claimId,
            fromEmail: args.from,
          },
        );
        if (rejectRes.verified) {
          outcome = "claim_rejected_takedown";
        } else {
          outcome = "takedown_escalated_hitl";
          parsed.replyMessage = `We received your takedown request for "${claim.showTitle}". To protect podcasters from competitor actions, takedown requests must come from the official email address listed on the podcast's RSS feed or undergo human verification. Because your email (${args.from}) differs from the address on file, your request has been forwarded to our team for review.`;
        }
      }
    }

    // 3b. Human In The Loop Escalation if agent could not resolve or creator reports email mismatch
    const lowerText = args.text.toLowerCase();
    const isDisputeOrMismatch =
      lowerText.includes("wrong email") ||
      lowerText.includes("not my email") ||
      lowerText.includes("can't access") ||
      lowerText.includes("cant access") ||
      lowerText.includes("different email") ||
      lowerText.includes("change email") ||
      lowerText.includes("wrong address");

    if ((parsed.intent === "CLARIFICATION_NEEDED" || isDisputeOrMismatch) && hitlAdminEmail) {
      await sendHitlEscalationEmail(ctx, {
        subject: `[DiscoPod HITL] Inbound from ${args.from} requires human review`,
        headline: `Creator Inbound Unresolved by Agentic Mail`,
        podcastTitle: claim?.showTitle || senderContext.resolvedShow?.title || "Podcast",
        podcastId: claim?.showId || senderContext.resolvedShow?.showId || "unmatched",
        emailOnFile: args.from,
        unresolvedCreatorMessage: args.text,
        actionInstructions: [
          `Reply "APPROVE" to approve the latest access request`,
          `Reply "TAKEDOWN ${claim?.showTitle || ""}" if creator demands complete removal`,
        ],
      });
    }

    // 4. Send automated reactive confirmation reply via AgentMail
    const finalReplyText =
      parsed.replyMessage ||
      `Thanks for your message regarding "${claim?.showTitle || senderContext.resolvedShow?.title || "your podcast"}"! We've received your request and our AI assistant has updated your show. Visit https://agreeable-pika-776.convex.site to see the changes.`;

    let replyMessageId: string | undefined;
    let replyStatus: "replied" | "failed" | "escalated" = "replied";

    if (process.env.AGENTMAIL_API_KEY && args.from) {
      const rep = await sendAgentMailReply({
        inboxId: args.inboxId,
        parentMessageId: args.messageId,
        to: args.from,
        subject: args.subject.startsWith("Re:") ? args.subject : `Re: ${args.subject || "Your DiscoPod Reel"}`,
        text: finalReplyText,
        labels: [`intent-${parsed.intent.toLowerCase()}`, `outcome-${outcome}`],
      });
      if (rep.success) {
        replyMessageId = rep.messageId;
      } else {
        replyStatus = "failed";
      }
    }

    if (outcome.includes("escalat") || isDisputeOrMismatch) {
      replyStatus = "escalated";
    }

    await ctx.runMutation(internal.agentMailHandler.recordAgentMailInteraction, {
      inboxId: args.inboxId,
      threadId: args.threadId,
      messageId: args.messageId,
      from: args.from,
      subject: args.subject,
      text: args.text,
      intent: parsed.intent,
      outcome,
      replyText: finalReplyText,
      replyMessageId,
      showId: claim?.showId || senderContext.resolvedShow?.showId,
      showTitle: claim?.showTitle || senderContext.resolvedShow?.title,
      status: replyStatus,
    });

    return {
      intent: parsed.intent,
      outcome,
      replyMessage: finalReplyText,
    };
  },
});

export const applyAdminApproveAccess = internalMutation({
  args: {
    requestId: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // 1. Check if requestId refers to a takedown request
    if (args.requestId) {
      const allTakedowns = await ctx.db.query("takedownRequests").take(100);
      const matchedTakedown = allTakedowns.find(
        (t) => t._id === args.requestId || t._id.toString() === args.requestId,
      );
      if (matchedTakedown) {
        await ctx.db.patch("takedownRequests", matchedTakedown._id, {
          status: "completed",
          resolvedAt: Date.now(),
          resolvedBy: "admin",
        });
        if (matchedTakedown.showId) {
          await ctx.db.patch("shows", matchedTakedown.showId, {
            isTakenDown: true,
            takenDownAt: Date.now(),
            takedownReason: "Admin approved takedown via AgentMail",
          });
        }
        return {
          success: true,
          message: `✓ Admin Approved: Takedown for "${matchedTakedown.title}" has been executed and show is permanently tombstoned.`,
        };
      }
    }

    let request: Doc<"hostAccessRequests"> | null = null;
    let showDoc: Doc<"shows"> | null = null;
    if (args.requestId) {
      const all = await ctx.db.query("hostAccessRequests").take(100);
      request = all.find((r) => r._id === args.requestId || r._id.toString() === args.requestId) || null;

      if (!request) {
        // Check if requestId is actually a showId
        const allShows = await ctx.db.query("shows").take(150);
        showDoc = allShows.find(
          (s) => s._id === args.requestId || s._id.toString() === args.requestId || s.slug === args.requestId,
        ) || null;
        if (showDoc) {
          const matchedShowId = showDoc._id;
          const reqForShow = await ctx.db
            .query("hostAccessRequests")
            .withIndex("by_showId", (q) => q.eq("showId", matchedShowId))
            .filter((q) => q.or(q.eq(q.field("status"), "escalated"), q.eq(q.field("status"), "pending")))
            .first();
          if (reqForShow) {
            request = reqForShow;
          }
        }
      }
    }
    if (!request && !showDoc) {
      const allRequests = await ctx.db.query("hostAccessRequests").order("desc").take(50);
      request = allRequests.find((r) => r.status === "escalated" || r.status === "pending") || null;
    }

    if (!request && !showDoc) {
      return { success: false, message: "No pending or escalated access or takedown request found to approve." };
    }

    const show = showDoc || (request ? await ctx.db.get("shows", request.showId) : null);
    if (!show) {
      return { success: false, message: "Associated show not found in database." };
    }

    const targetEmail = (request ? (request.alternateEmail || request.onFileEmail) : show.hostEmail) || "";
    if (targetEmail) {
      await ctx.db.patch("shows", show._id, {
        hostEmail: targetEmail,
        isClaimed: true,
      });
    }

    let token = "";
    const claim = await ctx.db
      .query("territoryClaims")
      .withIndex("by_showId", (q) => q.eq("showId", show._id))
      .first();

    if (claim) {
      token = claim.token;
      await ctx.db.patch("territoryClaims", claim._id, { claimStatus: "verified" });
    } else {
      token = `claim_tok_${Math.random().toString(36).slice(2, 10)}`;
      await ctx.db.insert("territoryClaims", {
        showId: show._id,
        inboxThreadId: `admin_approved_${Date.now()}`,
        claimStatus: "verified",
        token,
      });
    }

    if (request) {
      await ctx.db.patch("hostAccessRequests", request._id, {
        status: "approved",
        updatedAt: Date.now(),
      });
    }

    return {
      success: true,
      message: `✓ Admin Approved: Access granted for "${show.title}" to ${targetEmail}. Claim code is: ${token}`,
    };
  },
});

export const applyAdminRejectAccess = internalMutation({
  args: {
    requestId: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // 1. Check if requestId refers to a takedown request
    if (args.requestId) {
      const allTakedowns = await ctx.db.query("takedownRequests").take(100);
      const matchedTakedown = allTakedowns.find(
        (t) => t._id === args.requestId || t._id.toString() === args.requestId,
      );
      if (matchedTakedown) {
        await ctx.db.patch("takedownRequests", matchedTakedown._id, {
          status: "rejected",
          resolvedAt: Date.now(),
          resolvedBy: "admin",
          reason: args.reason || "Rejected by admin via AgentMail as unverified / competitor claim",
        });
        return {
          success: true,
          message: `✓ Admin Rejected: Takedown request for "${matchedTakedown.title}" has been dismissed as unverified / competitor claim.`,
        };
      }
    }

    let request = null;
    if (args.requestId) {
      const all = await ctx.db.query("hostAccessRequests").take(100);
      request = all.find((r) => r._id === args.requestId || r._id.toString() === args.requestId) || null;
    }
    if (!request) {
      request = await ctx.db
        .query("hostAccessRequests")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .order("desc")
        .first();
    }

    if (!request) {
      return { success: false, message: "No pending access or takedown request found to reject." };
    }

    const show = await ctx.db.get("shows", request.showId);
    const showTitle = show?.title || "Podcast";

    await ctx.db.patch("hostAccessRequests", request._id, {
      status: "rejected",
      updatedAt: Date.now(),
    });

    return {
      success: true,
      message: `✓ Admin Rejected: Access request for "${showTitle}" has been rejected.`,
    };
  },
});

export const getAdminStatusSummary = internalQuery({
  args: {},
  returns: v.object({
    pendingRequests: v.number(),
    totalShows: v.number(),
    verifiedClaims: v.number(),
    takedownCount: v.number(),
  }),
  handler: async (ctx) => {
    const pendingReqs = await ctx.db
      .query("hostAccessRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const shows = await ctx.db.query("shows").collect();
    const claims = await ctx.db.query("territoryClaims").collect();
    const takedowns = await ctx.db.query("takedownRequests").collect();

    const verified = claims.filter((c) => c.claimStatus === "verified").length;

    return {
      pendingRequests: pendingReqs.length,
      totalShows: shows.length,
      verifiedClaims: verified,
      takedownCount: takedowns.length,
    };
  },
});

export const simulateInboundReply = action({
  args: {
    inboxId: v.string(),
    messageId: v.string(),
    threadId: v.string(),
    from: v.string(),
    text: v.string(),
    subject: v.string(),
  },
  returns: v.object({
    intent: v.string(),
    outcome: v.string(),
    replyMessage: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ intent: string; outcome: string; replyMessage: string }> => {
    return await ctx.runAction(internal.agentMailHandler.processInboundReply, args);
  },
});

export const resolveInboundSenderContext = internalMutation({
  args: {
    from: v.string(),
    threadId: v.string(),
    text: v.string(),
    subject: v.string(),
  },
  returns: v.object({
    isNetwork: v.boolean(),
    candidateShows: v.array(
      v.object({
        showId: v.id("shows"),
        title: v.string(),
        slug: v.string(),
        hostEmail: v.optional(v.string()),
        isClaimed: v.boolean(),
        claimId: v.optional(v.id("territoryClaims")),
        token: v.optional(v.string()),
      }),
    ),
    resolvedShow: v.union(
      v.null(),
      v.object({
        showId: v.id("shows"),
        title: v.string(),
        slug: v.string(),
        hostEmail: v.optional(v.string()),
        isClaimed: v.boolean(),
        claimId: v.optional(v.id("territoryClaims")),
        token: v.optional(v.string()),
      }),
    ),
    confidence: v.union(v.literal("high"), v.literal("low"), v.literal("none")),
    confidenceReason: v.string(),
  }),
  handler: async (ctx, args) => {
    const cleanFrom = extractCleanEmail(args.from);

    // 1. Gather all non-tombstoned shows matching hostEmail
    const allShows = await ctx.db.query("shows").take(200);
    const showsByEmail = allShows.filter(
      (s) => !s.isTakenDown && s.hostEmail && extractCleanEmail(s.hostEmail) === cleanFrom,
    );

    // Also check hostAccessRequests for alternateEmail matches
    const alternateReqs = cleanFrom
      ? await ctx.db
          .query("hostAccessRequests")
          .filter((q) => q.eq(q.field("alternateEmail"), cleanFrom))
          .collect()
      : [];

    const candidateMap = new Map<string, (typeof allShows)[0]>();
    for (const s of showsByEmail) {
      candidateMap.set(s._id.toString(), s);
    }
    for (const req of alternateReqs) {
      const s = allShows.find((show) => show._id === req.showId && !show.isTakenDown);
      if (s) candidateMap.set(s._id.toString(), s);
    }

    // Check if text or subject references a reel link, e.g. /reel/<showId>
    const reelMatch = (args.text + " " + args.subject).match(/\/reel\/([a-zA-Z0-9_]+)/);
    let showForReel: (typeof allShows)[0] | undefined;
    if (reelMatch) {
      const targetShowId = reelMatch[1];
      showForReel = allShows.find(
        (show) => show._id === targetShowId || show._id.toString() === targetShowId || show.slug === targetShowId,
      );
      if (showForReel && !showForReel.isTakenDown) {
        candidateMap.set(showForReel._id.toString(), showForReel);
      }
    }

    // Check if text references an email redirect header, e.g. "Redirected from <hostEmail>"
    const redirMatch = args.text.match(/Redirected from\s+([^\s<>,]+@[^\s<>,]+)/i);
    if (redirMatch) {
      const redirectedHostEmail = extractCleanEmail(redirMatch[1]);
      const matchingShows = allShows.filter(
        (s) => !s.isTakenDown && s.hostEmail && extractCleanEmail(s.hostEmail) === redirectedHostEmail,
      );
      for (const s of matchingShows) {
        candidateMap.set(s._id.toString(), s);
      }
    }

    // Check threadId for claim association
    if (args.threadId) {
      const claimByThread = await ctx.db
        .query("territoryClaims")
        .filter((q) => q.eq(q.field("inboxThreadId"), args.threadId))
        .first();
      if (claimByThread) {
        const s = allShows.find((show) => show._id === claimByThread.showId && !show.isTakenDown);
        if (s) candidateMap.set(s._id.toString(), s);
      }
    }

    // Check claim token in text
    const tokenMatch = args.text.match(/claim_[0-9]+_[a-zA-Z0-9]+|claim_tok_[a-zA-Z0-9]+/);
    let claimForToken: any = null;
    if (tokenMatch) {
      claimForToken = await ctx.db
        .query("territoryClaims")
        .withIndex("by_token", (q) => q.eq("token", tokenMatch[0]))
        .first();
      if (claimForToken) {
        const s = allShows.find((show) => show._id === claimForToken.showId && !show.isTakenDown);
        if (s) candidateMap.set(s._id.toString(), s);
      }
    }

    // Convert to candidate list with claims
    const candidateDocs = Array.from(candidateMap.values());
    const candidateShows = [];
    for (const s of candidateDocs) {
      const claim = await ctx.db
        .query("territoryClaims")
        .withIndex("by_showId", (q) => q.eq("showId", s._id))
        .first();
      candidateShows.push({
        showId: s._id,
        title: s.title,
        slug: s.slug,
        hostEmail: s.hostEmail,
        isClaimed: Boolean(s.isClaimed),
        claimId: claim?._id,
        token: claim?.token,
      });
    }

    // Evaluate confidence & determine if network
    const isNetwork = candidateShows.length > 1;

    // Case 0: No candidate shows found
    if (candidateShows.length === 0) {
      // Check if text/subject mentions any show in catalog
      const combined = `${args.subject} ${args.text}`.toLowerCase();
      const mentionedAny = allShows.filter(
        (s) => !s.isTakenDown && s.title.length > 3 && combined.includes(s.title.toLowerCase()),
      );
      if (mentionedAny.length === 1) {
        const single = mentionedAny[0];
        const claim = await ctx.db
          .query("territoryClaims")
          .withIndex("by_showId", (q) => q.eq("showId", single._id))
          .first();
        const cand = {
          showId: single._id,
          title: single.title,
          slug: single.slug,
          hostEmail: single.hostEmail,
          isClaimed: Boolean(single.isClaimed),
          claimId: claim?._id,
          token: claim?.token,
        };
        return {
          isNetwork: false,
          candidateShows: [cand],
          resolvedShow: cand,
          confidence: "high" as const,
          confidenceReason: `Explicitly named catalog show "${single.title}" in message`,
        };
      }

      return {
        isNetwork: false,
        candidateShows: [],
        resolvedShow: null,
        confidence: "none" as const,
        confidenceReason: "No show found matching sender email or message text",
      };
    }

    // Case 1: Exactly 1 candidate show
    if (candidateShows.length === 1) {
      return {
        isNetwork: false,
        candidateShows,
        resolvedShow: candidateShows[0],
        confidence: "high" as const,
        confidenceReason: `Single show on file for sender ("${candidateShows[0].title}")`,
      };
    }

    // Case 2: Network detected (candidateShows.length > 1)
    // 2a-0. Signal 0: Direct reel URL match
    if (showForReel) {
      const matched = candidateShows.find((c) => c.showId === showForReel!._id);
      if (matched) {
        return {
          isNetwork: true,
          candidateShows,
          resolvedShow: matched,
          confidence: "high" as const,
          confidenceReason: `Provided direct reel URL for "${matched.title}"`,
        };
      }
    }

    // 2a. Signal 1: Token match
    if (claimForToken) {
      const matched = candidateShows.find((c) => c.showId === claimForToken.showId);
      if (matched) {
        return {
          isNetwork: true,
          candidateShows,
          resolvedShow: matched,
          confidence: "high" as const,
          confidenceReason: `Provided exact claim token for "${matched.title}"`,
        };
      }
    }

    // 2b. Signal 2: Thread match
    if (args.threadId) {
      const claimByThread = await ctx.db
        .query("territoryClaims")
        .filter((q) => q.eq(q.field("inboxThreadId"), args.threadId))
        .first();
      if (claimByThread) {
        const matched = candidateShows.find((c) => c.showId === claimByThread.showId);
        if (matched) {
          return {
            isNetwork: true,
            candidateShows,
            resolvedShow: matched,
            confidence: "high" as const,
            confidenceReason: `Inbound thread matches active claim thread for "${matched.title}"`,
          };
        }
      }
    }

    // 2c. Signal 3: Show title mention in Subject or Body
    const cleanPunct = (str: string) =>
      str.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    const cleanCombined = cleanPunct(`${args.subject} ${args.text}`);

    const titleMatches = candidateShows.filter((c) => {
      const cleanTitle = cleanPunct(c.title);
      if (cleanTitle.length < 3) return false;
      return cleanCombined.includes(cleanTitle);
    });

    if (titleMatches.length === 1) {
      return {
        isNetwork: true,
        candidateShows,
        resolvedShow: titleMatches[0],
        confidence: "high" as const,
        confidenceReason: `Explicitly named network show "${titleMatches[0].title}" in message`,
      };
    }

    if (titleMatches.length > 1) {
      return {
        isNetwork: true,
        candidateShows,
        resolvedShow: null,
        confidence: "low" as const,
        confidenceReason: `Ambiguous: Multiple network shows mentioned (${titleMatches.map((t) => `"${t.title}"`).join(", ")})`,
      };
    }

    // No title was mentioned
    return {
      isNetwork: true,
      candidateShows,
      resolvedShow: null,
      confidence: "low" as const,
      confidenceReason: `Low confidence: Sender address is tied to ${candidateShows.length} network shows, but did not specify which show in message`,
    };
  },
});

export const recordNetworkDisambiguationRequest = internalMutation({
  args: {
    showId: v.id("shows"),
    fromEmail: v.string(),
    candidateShowIds: v.array(v.id("shows")),
    candidateTitles: v.array(v.string()),
    subject: v.string(),
    text: v.string(),
  },
  returns: v.id("hostAccessRequests"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("hostAccessRequests", {
      showId: args.showId,
      requestType: "network_disambiguation",
      status: "escalated",
      onFileEmail: args.fromEmail,
      alternateEmail: args.fromEmail,
      requesterNote: `[Network Ambiguity] Sender email associated with ${args.candidateTitles.length} shows (${args.candidateTitles.map((t) => `"${t}"`).join(", ")}). Inbound message: "${args.subject ? `Subject: ${args.subject} | ` : ""}${args.text.slice(0, 160)}"`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const resolveClaimForThread = internalMutation({
  args: {
    threadId: v.string(),
    text: v.string(),
    showId: v.optional(v.id("shows")),
  },
  handler: async (ctx, args) => {
    if (args.showId) {
      let claim = await ctx.db
        .query("territoryClaims")
        .withIndex("by_showId", (q) => q.eq("showId", args.showId!))
        .first();
      const show = await ctx.db.get("shows", args.showId);
      if (!show) return null;

      if (!claim) {
        const token = `claim_tok_${Math.random().toString(36).slice(2, 10)}`;
        const claimId = await ctx.db.insert("territoryClaims", {
          showId: show._id,
          inboxThreadId: args.threadId || `thread_${Date.now()}`,
          claimStatus: "pending",
          token,
        });
        claim = (await ctx.db.get("territoryClaims", claimId))!;
      }

      return {
        claimId: claim._id,
        showId: show._id,
        showTitle: show.title,
        token: claim.token,
        isClaimed: show.isClaimed,
      };
    }

    // Try finding by inboxThreadId
    let claim = await ctx.db
      .query("territoryClaims")
      .filter((q) => q.eq(q.field("inboxThreadId"), args.threadId))
      .first();

    // If not found by threadId, check if claim token was mentioned in text
    if (!claim) {
      const tokenMatch = args.text.match(/claim_[0-9]+_[a-zA-Z0-9]+|claim_tok_[a-zA-Z0-9]+/);
      if (tokenMatch) {
        claim = await ctx.db
          .query("territoryClaims")
          .filter((q) => q.eq(q.field("token"), tokenMatch[0]))
          .first();
      }
    }

    // Fallback: take most recent pending or verified claim for testing
    if (!claim) {
      claim = await ctx.db.query("territoryClaims").order("desc").first();
    }

    if (!claim) {
      return null;
    }

    const show = await ctx.db.get("shows", claim.showId);
    if (!show) return null;

    return {
      claimId: claim._id,
      showId: show._id,
      showTitle: show.title,
      token: claim.token,
      isClaimed: show.isClaimed,
    };
  },
});

export const applyVerifyClaim = internalMutation({
  args: {
    claimId: v.id("territoryClaims"),
    showId: v.id("shows"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("territoryClaims", args.claimId, {
      claimStatus: "verified",
    });
    await ctx.db.patch("shows", args.showId, {
      isClaimed: true,
    });
  },
});

export const applyUpdateHook = internalMutation({
  args: {
    showId: v.id("shows"),
    hookText: v.string(),
  },
  handler: async (ctx, args) => {
    const snippet = await ctx.db
      .query("snippets")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .first();

    if (snippet) {
      await ctx.db.patch("snippets", snippet._id, {
        hookText: args.hookText,
      });
    }
  },
});

export const applyRejectClaim = internalMutation({
  args: {
    claimId: v.id("territoryClaims"),
    fromEmail: v.string(),
  },
  returns: v.object({
    verified: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const claim = await ctx.db.get("territoryClaims", args.claimId);
    if (!claim) return { verified: false, message: "Claim not found." };

    const show = await ctx.db.get("shows", claim.showId);
    if (!show) return { verified: false, message: "Show not found." };

    const cleanFrom = args.fromEmail.trim().toLowerCase();
    const cleanHost = show.hostEmail?.trim().toLowerCase() || "";

    const isVerified = Boolean(cleanHost && cleanFrom && cleanHost === cleanFrom);

    if (isVerified) {
      await ctx.db.patch("territoryClaims", args.claimId, {
        claimStatus: "rejected",
      });

      // Mark show taken down immediately
      await ctx.db.patch("shows", show._id, {
        isTakenDown: true,
        takenDownAt: Date.now(),
        takedownReason: "Creator email takedown / rejection request",
      });

      // Insert permanent tombstone so it can never be re-indexed
      const norm = show.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      const existingTombstone = await ctx.db
        .query("takedownRequests")
        .withIndex("by_normalizedTitle", (q) => q.eq("normalizedTitle", norm))
        .first();

      if (!existingTombstone) {
        await ctx.db.insert("takedownRequests", {
          showId: show._id,
          title: show.title,
          normalizedTitle: norm,
          rssUrl: show.rssUrl,
          feedUrl: show.rssUrl,
          requesterEmail: cleanFrom,
          source: "email_inbox",
          reason: "Creator email takedown request",
          status: "completed",
          verifiedOnFile: true,
          resolvedAt: Date.now(),
          resolvedBy: "verified_host_email",
          createdAt: Date.now(),
        });
      }

      // Suppress host email
      const existingSuppression = await ctx.db
        .query("emailSuppressions")
        .withIndex("by_email", (q) => q.eq("email", cleanFrom))
        .first();

      if (!existingSuppression) {
        await ctx.db.insert("emailSuppressions", {
          email: cleanFrom,
          reason: "unsubscribed",
          eventType: "takedown_email",
          details: `Suppressed via verified takedown reply for "${show.title}"`,
          createdAt: Date.now(),
        });
      }

      return {
        verified: true,
        message: `Show "${show.title}" has been verified against email on file and permanently tombstoned.`,
      };
    }

    // UNVERIFIED SENDER: Protect creator against competitor takedowns!
    // DO NOT take down the show.
    const norm = show.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    const takedownId = await ctx.db.insert("takedownRequests", {
      showId: show._id,
      title: show.title,
      normalizedTitle: norm,
      rssUrl: show.rssUrl,
      feedUrl: show.rssUrl,
      requesterEmail: cleanFrom,
      source: "email_inbox",
      reason: "Inbound takedown request from email not matching show record",
      status: "pending_hitl",
      verifiedOnFile: false,
      createdAt: Date.now(),
    });

    // Alert HITL admin
    await ctx.scheduler.runAfter(0, internal.takedowns.sendHitlTakedownEscalationAction, {
      takedownId,
      podcastTitle: show.title,
      podcastId: show._id,
      emailOnFile: cleanHost || "none_on_file",
      requesterEmail: cleanFrom,
      proofNotes: `Takedown request from ${cleanFrom}, which does NOT match the address on file (${cleanHost || "none"}).`,
    });

    return {
      verified: false,
      message: `Takedown request received from unverified address ${cleanFrom}. Queued for human verification.`,
    };
  },
});

export const applyReSlice = internalMutation({
  args: {
    showId: v.id("shows"),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, args) => {
    const snippet = await ctx.db
      .query("snippets")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .first();

    if (snippet) {
      await ctx.db.patch("snippets", snippet._id, {
        startTime: args.startTime,
        endTime: args.endTime,
      });
    }
  },
});

export interface SimulateInboundEmailResult {
  intent: string;
  outcome: string;
  replyMessage: string;
  showId?: Id<"shows">;
  isClaimed?: boolean;
}

/**
 * Public action for local simulation & testing without needing live webhook delivery
 */
export const simulateInboundEmail = action({
  args: {
    showId: v.optional(v.id("shows")),
    bodyText: v.string(),
    fromEmail: v.optional(v.string()),
  },
  returns: v.object({
    intent: v.string(),
    outcome: v.string(),
    replyMessage: v.string(),
    showId: v.optional(v.id("shows")),
    isClaimed: v.optional(v.boolean()),
  }),
  handler: async (ctx, args): Promise<SimulateInboundEmailResult> => {
    const senderEmail = args.fromEmail || "";
    let senderContext: any = null;
    if (senderEmail) {
      senderContext = await ctx.runMutation(
        internal.agentMailHandler.resolveInboundSenderContext,
        {
          from: senderEmail,
          threadId: "",
          text: args.bodyText,
          subject: "",
        },
      );
    }

    if (senderContext && senderContext.isNetwork && senderContext.confidence !== "high" && !args.showId) {
      await ctx.runMutation(internal.agentMailHandler.recordNetworkDisambiguationRequest, {
        showId: senderContext.candidateShows[0].showId,
        fromEmail: senderEmail,
        candidateShowIds: senderContext.candidateShows.map((s: any) => s.showId),
        candidateTitles: senderContext.candidateShows.map((s: any) => s.title),
        subject: "Simulated Inbound Email",
        text: args.bodyText,
      });

      const showBullets = senderContext.candidateShows.map((s: any) => `• "${s.title}"`).join("\n");
      const replyMessage = `Hello! We received your message from ${senderEmail}.\n\nBecause your address is associated with multiple shows in our network directory:\n${showBullets}\n\nWe want to ensure we verify or update the right show. Our support team has been alerted for human review. If you'd like to expedite this, please reply specifying which show title you're referencing!`;

      return {
        intent: "NETWORK_DISAMBIGUATION_NEEDED",
        outcome: "escalated_hitl_network_ambiguity",
        replyMessage,
        showId: undefined,
        isClaimed: undefined,
      };
    }

    const resolvedShowId = args.showId ?? senderContext?.resolvedShow?.showId;

    const claim: {
      claimId: Id<"territoryClaims">;
      showId: Id<"shows">;
      showTitle: string;
      token: string;
      isClaimed?: boolean;
    } | null = await ctx.runMutation(internal.agentMailHandler.resolveClaimForThread, {
      threadId: "",
      text: args.bodyText,
      showId: resolvedShowId,
    });

    const targetShowId: Id<"shows"> | undefined = resolvedShowId ?? claim?.showId;
    const openAiKey = process.env.OPENAI_API_KEY;

    const parsed = await parseInboundIntentWithGpt4o({
      openAiKey,
      inboundText: args.bodyText,
      showTitle: claim?.showTitle || "Your Show",
      claimToken: claim?.token,
    });

    let outcome = "clarification_sent";

    if (targetShowId && claim) {
      if (parsed.intent === "VERIFY_CLAIM") {
        await ctx.runMutation(internal.agentMailHandler.applyVerifyClaim, {
          claimId: claim.claimId,
          showId: targetShowId,
        });
        outcome = "claim_verified";
      } else if (parsed.intent === "REQUEST_CLAIM_CODE") {
        outcome = "claim_code_sent";
      } else if (parsed.intent === "RE_SLICE" && parsed.startTimeSeconds !== null) {
        const start = parsed.startTimeSeconds;
        const end = parsed.endTimeSeconds ?? start + 45;
        await ctx.runMutation(internal.agentMailHandler.applyReSlice, {
          showId: targetShowId,
          startTime: start,
          endTime: end,
        });
        outcome = "snippet_resliced";
      } else if (parsed.intent === "UPDATE_HOOK" && parsed.customHookText) {
        await ctx.runMutation(internal.agentMailHandler.applyUpdateHook, {
          showId: targetShowId,
          hookText: parsed.customHookText,
        });
        outcome = "hook_updated";
      } else if (parsed.intent === "REJECT_CLAIM") {
        await ctx.runMutation(internal.agentMailHandler.applyRejectClaim, {
          claimId: claim.claimId,
          fromEmail: args.fromEmail || "",
        });
        outcome = "claim_rejected";
      }
    }

    const updatedShow: { isClaimed?: boolean } | null = targetShowId
      ? await ctx.runQuery(internal.agentMailHandler.getShowStats, { showId: targetShowId })
      : null;

    return {
      intent: parsed.intent,
      outcome,
      replyMessage: parsed.replyMessage,
      showId: targetShowId,
      isClaimed: updatedShow?.isClaimed,
    };
  },
});

export const getShowStats = internalQuery({
  args: { showId: v.id("shows") },
  handler: async (ctx, args) => {
    const show = await ctx.db.get("shows", args.showId);
    if (!show) return null;

    const events = await ctx.db
      .query("listenerEvents")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .collect();

    let totalListens = 0;
    let totalSkips = 0;
    let totalChannelClicks = 0;
    const channelCounts: Record<string, number> = {};

    for (const ev of events) {
      if (ev.eventType === "listen") totalListens++;
      if (ev.eventType === "skip") totalSkips++;
      if (ev.eventType === "channel_click") {
        totalChannelClicks++;
        const ch = ev.channelName || "external feed";
        channelCounts[ch] = (channelCounts[ch] ?? 0) + 1;
      }
    }

    return {
      isClaimed: show.isClaimed,
      totalListens,
      totalSkips,
      totalChannelClicks,
      topChannels: Object.keys(channelCounts).join(", ") || "podcast website",
    };
  },
});

// ----------------------------------------------------------------------------
// OpenAI Intent Parsing
// ----------------------------------------------------------------------------

interface ParsedIntent {
  intent: "VERIFY_CLAIM" | "REQUEST_CLAIM_CODE" | "RE_SLICE" | "UPDATE_HOOK" | "REJECT_CLAIM" | "CLARIFICATION_NEEDED";
  startTimeSeconds: number | null;
  endTimeSeconds: number | null;
  customHookText: string | null;
  replyMessage: string;
}

interface ShowStatsContext {
  isClaimed?: boolean;
  totalListens: number;
  totalSkips: number;
  totalChannelClicks: number;
  topChannels: string;
}

async function parseInboundIntentWithGpt4o({
  openAiKey,
  inboundText,
  showTitle,
  showStats,
  claimToken,
}: {
  openAiKey?: string;
  inboundText: string;
  showTitle: string;
  showStats?: ShowStatsContext | null;
  claimToken?: string;
}): Promise<ParsedIntent> {
  const normalized = inboundText.trim().toLowerCase();

  // Fast-path heuristic: reject claim / takedown show
  if (
    normalized.includes("reject") ||
    normalized.includes("not mine") ||
    normalized.includes("not my show") ||
    normalized.includes("wrong podcast") ||
    normalized.includes("remove") ||
    normalized.includes("takedown") ||
    normalized.includes("take down") ||
    normalized.includes("delete") ||
    normalized.includes("unsubscribe") ||
    normalized.includes("stop indexing")
  ) {
    return {
      intent: "REJECT_CLAIM",
      startTimeSeconds: null,
      endTimeSeconds: null,
      customHookText: null,
      replyMessage: `Understood. Per our zero-question Takedown Policy, "${showTitle}" has been immediately removed from the DiscoPod 3D globe, discovery deck, and search catalog. Its feed has been permanently tombstoned so it will never be re-indexed, and your email has been suppressed from future communications.`,
    };
  }

  // Fast-path heuristic: request claim code / token
  if (
    normalized.includes("claim code") ||
    normalized.includes("claim token") ||
    normalized.includes("send me my code") ||
    normalized.includes("send code") ||
    normalized.includes("send me the code") ||
    normalized.includes("what is my code") ||
    normalized.includes("what's my code") ||
    normalized.includes("my claim code")
  ) {
    const siteBaseUrl =
      process.env.CONVEX_SITE_URL || "https://agreeable-pika-776.convex.site";
    const token = claimToken || "DISCO-VERIFY";
    const directUrl = `${siteBaseUrl}/?claimCode=${encodeURIComponent(token)}`;
    return {
      intent: "REQUEST_CLAIM_CODE",
      startTimeSeconds: null,
      endTimeSeconds: null,
      customHookText: null,
      replyMessage: `Here is your claim code for "${showTitle}":\n\n${token}\n\nYou can claim your show directly by visiting:\n${directUrl}\n\nOr go to ${siteBaseUrl}, click Admin in the bottom bar, and enter your code. Let me know if you need anything else!`,
    };
  }

  // Fast-path heuristic: queries asking for listener stats / metrics
  if (
    normalized.includes("stats") ||
    normalized.includes("how is my show") ||
    normalized.includes("how many") ||
    normalized.includes("metrics") ||
    normalized.includes("performance")
  ) {
    if (showStats) {
      return {
        intent: "CLARIFICATION_NEEDED",
        startTimeSeconds: null,
        endTimeSeconds: null,
        customHookText: null,
        replyMessage: `Here are your latest listener metrics for "${showTitle}" on DiscoPod: ${showStats.totalListens} audio hook streams, ${showStats.totalSkips} skips, and ${showStats.totalChannelClicks} clickthroughs to your show channels (${showStats.topChannels}).`,
      };
    }
  }

  // Fast-path heuristic: verify / claim show
  if (
    normalized.includes("verify") ||
    normalized.includes("claim") ||
    normalized === "yes" ||
    normalized === "my show" ||
    normalized.includes("this is my show")
  ) {
    return {
      intent: "VERIFY_CLAIM",
      startTimeSeconds: null,
      endTimeSeconds: null,
      customHookText: null,
      replyMessage: `Awesome! We've verified your show "${showTitle}" on the DiscoPod globe. Your Verified Host badge is now active!`,
    };
  }

  // Fast-path heuristic: customize hook quote
  const hookMatch =
    inboundText.match(/(?:set hook to|change hook to|hook):?\s*["“']?([^"”']+)["”']?/i);
  if (hookMatch && hookMatch[1]) {
    const rawHook = hookMatch[1].trim().replace(/^[:"“']+|["”']+$/g, "").trim();
    if (rawHook.length > 0) {
      return {
        intent: "UPDATE_HOOK",
        startTimeSeconds: null,
        endTimeSeconds: null,
        customHookText: rawHook,
        replyMessage: `Updated! We've set your show's narrative hook to: "${rawHook}". Check it out on DiscoPod!`,
      };
    }
  }

  // Fast-path heuristic: re-slice audio highlight window
  const timeMatch = inboundText.match(/(\d{1,2}):(\d{2})/);
  if (normalized.includes("change snippet") || normalized.includes("re-slice") || timeMatch) {
    let seconds: number | null = null;
    if (timeMatch) {
      seconds = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
    }
    return {
      intent: "RE_SLICE",
      startTimeSeconds: seconds ?? 60,
      endTimeSeconds: seconds ? seconds + 45 : 105,
      customHookText: null,
      replyMessage: `Got it! We've updated your 45-second highlight reel for "${showTitle}" starting at ${timeMatch ? timeMatch[0] : "the new timestamp"}. Check out the updated reel on DiscoPod!`,
    };
  }

  if (!openAiKey) {
    return {
      intent: "CLARIFICATION_NEEDED",
      startTimeSeconds: null,
      endTimeSeconds: null,
      customHookText: null,
      replyMessage: `Thanks for writing to DiscoPod! You can reply 'Verify' to claim your show, 'Change snippet to MM:SS' to adjust your 45-second preview clip, 'Set hook to [quote]' to update your featured quote, or ask our AI agent any question.`,
    };
  }

  // GPT-4o Intent Parser
  try {
    const prompt = `You are an AI assistant for DiscoPod.
A podcast creator replied to an email regarding their show "${showTitle}".
${
  showStats
    ? `Current DiscoPod Listener Metrics for "${showTitle}":
- Audio hook streams: ${showStats.totalListens}
- Skips: ${showStats.totalSkips}
- Clickouts to external channels: ${showStats.totalChannelClicks} (Channels: ${showStats.topChannels})
If the creator asks about stats or traction on DiscoPod, cite these metrics simply and neutrally.`
    : ""
}
Creator's email message:
"""
${inboundText}
"""

Task:
Determine the creator's intent among these options:
1. "VERIFY_CLAIM": Wants to claim, verify, or confirm ownership of their show directly over email.
2. "REQUEST_CLAIM_CODE": Asks for their claim code or token to claim/manage the show themselves on the site.
3. "RE_SLICE": Wants to change snippet timestamps (e.g. start at 12:30 or between MM:SS and MM:SS).
4. "UPDATE_HOOK": Wants to customize or update the narrative hook quote/text.
5. "REJECT_CLAIM": States this is not their show, requests removal, or disclaims ownership.
6. "CLARIFICATION_NEEDED": Creator has a question, conversational remark, or general inquiry.

${
  claimToken
    ? `The creator's show claim code is: "${claimToken}". If the creator is requesting their claim code or asking how to claim it themselves on the site, include their claim code "${claimToken}" and the direct claim link "https://agreeable-pika-776.convex.site/?claimCode=${encodeURIComponent(claimToken)}" in replyMessage.`
    : ""
}

STRICT BOUNDARIES:
- ONLY answer questions directly related to DiscoPod, how clips are chosen (DiscoPod uses AI to analyze episode audio and select a representative 45-second moment), or how creators can update their clip timestamps, hook quote, claim code, or show listing.
- NEVER offer unsolicited podcast marketing, social media promotion, growth coaching, or audience development advice. That is NOT DiscoPod's role.
- Keep the response strictly to 1 or 2 concise, polite sentences explaining DiscoPod features or answering their question directly.

Extract:
- Any specified start timestamp in seconds if RE_SLICE (else null).
- Any custom hook text if UPDATE_HOOK (else null).
- Draft a concise, direct 1-to-2 sentence answer strictly focused on DiscoPod. Never give marketing or promotion advice.

Respond strictly in JSON format:
{
  "intent": "VERIFY_CLAIM" | "REQUEST_CLAIM_CODE" | "RE_SLICE" | "UPDATE_HOOK" | "REJECT_CLAIM" | "CLARIFICATION_NEEDED",
  "startTimeSeconds": <number or null>,
  "endTimeSeconds": <number or null>,
  "customHookText": <string or null>,
  "replyMessage": "<concise, direct 1-to-2 sentence response focused strictly on DiscoPod>"
}`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      throw new Error(`OpenAI intent parser failed with ${resp.status}`);
    }

    const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response content from OpenAI");

    const result = JSON.parse(content) as ParsedIntent;
    return result;
  } catch (err) {
    console.error("[parseInboundIntentWithGpt4o] Error:", err);
    return {
      intent: "CLARIFICATION_NEEDED",
      startTimeSeconds: null,
      endTimeSeconds: null,
      customHookText: null,
      replyMessage: `Thanks for reaching out! You can reply with 'Verify' to claim your show on the globe, 'Change snippet to MM:SS' to re-slice your 45-second reel, or ask any question about your show.`,
    };
  }
}
