import { components, internal } from "../_generated/api";
import { AgentMail } from "@agentmail/convex";
import type { ActionCtx, MutationCtx } from "../_generated/server";

export interface SendClaimEmailArgs {
  showId: string;
  showTitle: string;
  actualScrapedEmail: string;
  token: string;
  reelUrl?: string;
  subject?: string;
  headline?: string;
  tractionStats?: {
    listens: number;
    channelClicks: number;
    topChannel?: string;
  };
}

export interface DispatchResult {
  recipient: string;
  inboxThreadId: string;
  isStaging: boolean;
  subject: string;
  bodyText: string;
}

/**
 * Centralized Email Dispatch Helper enforcing staging guards.
 *
 * DB settings (ownerSettings table) take precedence over env vars.
 *
 * Environment variables (fallback when no DB settings doc exists yet):
 * - TEST_EMAIL_OVERRIDE: forces all outbound to this email
 * - IS_PRODUCTION: "true" | "false" — when not "true", enables override mode
 * - AGENTMAIL_API_KEY: credentials for sending
 */
export async function sendShowClaimEmail(
  ctx: ActionCtx | MutationCtx,
  args: SendClaimEmailArgs,
): Promise<DispatchResult> {
  // --- 1. Resolve settings: DB wins over env vars ---
  let emailEnabled: boolean;
  let overrideEmail: string;

  try {
    const settings = await (ctx as ActionCtx).runQuery(
      internal.ownerSettings.getOwnerSettingsInternal,
      {},
    );
    emailEnabled = settings.emailEnabled;
    overrideEmail = settings.emailOverrideAddress.trim();
  } catch {
    // Fallback to env vars (first deploy / empty DB)
    emailEnabled = process.env.IS_PRODUCTION === "true";
    overrideEmail = process.env.TEST_EMAIL_OVERRIDE?.trim() ?? "";
  }

  // --- 2. Route email to override address when configured in Convex ---
  const hasOverride = Boolean(overrideEmail && overrideEmail.trim().length > 0);
  const isStaging = !emailEnabled || hasOverride;

  // SAFE MODE LOCKDOWN: if safe mode is on and no override email is set, do NOT send to real host!
  if (!emailEnabled && !hasOverride) {
    console.warn(
      `[emailDispatcher] Safe mode active (emailEnabled=false) and no override email configured. Refraining from emailing real host: ${args.actualScrapedEmail}`,
    );
    return {
      recipient: args.actualScrapedEmail,
      inboxThreadId: `blocked_safe_mode_${Date.now()}`,
      isStaging: true,
      subject: `[SAFE MODE BLOCKED]`,
      bodyText: `Outbound delivery refrained because Safe Mode is active and no override email was configured.`,
    };
  }

  const targetEmail = hasOverride ? overrideEmail.trim() : args.actualScrapedEmail;

  if (hasOverride) {
    console.log(
      `[emailDispatcher] Test email override active. Redirecting from ${args.actualScrapedEmail} -> ${targetEmail}`,
    );
  }

  // --- 3. Check suppression / bounce blocklist ---
  let isSuppressed = false;
  try {
    const suppression = await (ctx as ActionCtx).runQuery(
      internal.ownerSettings.isEmailSuppressed,
      { email: targetEmail },
    );
    if (suppression) {
      isSuppressed = true;
      console.warn(
        `[emailDispatcher] Target email ${targetEmail} is on the suppression list (reason: ${suppression.reason}). Refraining from sending.`,
      );
    }
  } catch {
    // Non-fatal fallback
  }

  if (isSuppressed) {
    return {
      recipient: targetEmail,
      inboxThreadId: `suppressed_${Date.now()}`,
      isStaging,
      subject: `[SUPPRESSED] Not emailed`,
      bodyText: `Delivery refrained because ${targetEmail} is marked as bounced, complained, or unsubscribed.`,
    };
  }

  // --- 3b. Check Single-Contact Rule (Do not email host more than once unless they reply) ---
  let canEmail: { allowed: boolean; reason: string; previousSentAt?: number } = {
    allowed: true,
    reason: "default",
  };
  try {
    canEmail = await (ctx as ActionCtx).runQuery(
      internal.ownerSettings.canEmailHost,
      { hostEmail: args.actualScrapedEmail, showId: args.showId as any },
    );
  } catch (err) {
    console.error("[emailDispatcher] Error checking canEmailHost:", err);
  }

  if (!canEmail.allowed) {
    console.warn(
      `[emailDispatcher] BLOCKED duplicate outreach to ${args.actualScrapedEmail} (${args.showTitle}): reason="${canEmail.reason}"`,
    );
    return {
      recipient: targetEmail,
      inboxThreadId: `blocked_duplicate_${Date.now()}`,
      isStaging,
      subject: `[BLOCKED DUPLICATE: ${canEmail.reason}]`,
      bodyText: `Outbound delivery refrained: Host was already contacted and has not replied yet (Single-Contact Rule).`,
    };
  }

  const subject =
    args.subject ||
    (args.tractionStats
      ? `${args.showTitle} is getting noticed on DiscoPod`
      : `Heads up about ${args.showTitle} on DiscoPod`);

  const siteBaseUrl =
    process.env.CONVEX_SITE_URL || "https://agreeable-pika-776.convex.site";
  const reelLink = args.reelUrl || `${siteBaseUrl}/reel/${args.showId}`;

  // Build production text body (clean, conversational, personal)
  const prodBodyLines = [
    "Hey there,",
    "",
    `Wanted to give you a quick heads up — your podcast, "${args.showTitle}", has been getting noticed by listeners on DiscoPod recently.`,
    "",
    "DiscoPod uses AI to select a few clips that represent your show and people seem to like them, but you can have us update these to any 45 second clip from any episode.",
    "",
    `You can check out your show here: ${reelLink}`,
    "(we know it's a strange domain. we built this for the Convex hackathon as a new way to help people discover new podcasts to love.)",
    "",
    "This inbox is monitored by an AI assistant that can help make quick updates to how your show appears on DiscoPod. If you want to change anything, you can just reply directly to this email:",
    "",
    '• "Can you send me my claim code?" (if you prefer to manage it yourself on the site)',
    '• "Change the audio clip to start at 14:20"',
    '• "Update the quote to: [your quote]"',
    '• "Not my show" (if you\'d rather we take it down completely)',
    "",
    "Or if you have any questions at all, just let me know!",
    "",
    "Best,",
    "Kurt Libby, maker of DiscoPod",
  ];

  // If in override mode, inject subtle redirect note at the top
  const emailLines: string[] = [];
  if (isStaging) {
    emailLines.push(`[Test Override: Redirected from ${args.actualScrapedEmail} to ${targetEmail}]`);
    emailLines.push("");
  }
  emailLines.push(...prodBodyLines);
  const bodyText = emailLines.join("\n");

  const bodyHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #111827; max-width: 600px;">
      ${
        isStaging
          ? `
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb;">
          [Test Override: Redirected from ${escapeHtml(args.actualScrapedEmail)} to ${escapeHtml(targetEmail)}]
        </div>
      `
          : ""
      }
      <p style="margin: 0 0 16px 0;">Hey there,</p>

      <p style="margin: 0 0 16px 0;">
        Wanted to give you a quick heads up &mdash; your podcast, <strong>${escapeHtml(args.showTitle)}</strong>, has been getting noticed by listeners on DiscoPod recently.
      </p>

      <p style="margin: 0 0 16px 0;">
        DiscoPod uses AI to select a few clips that represent your show and people seem to like them, but you can have us update these to any 45 second clip from any episode.
      </p>

      <p style="margin: 0 0 16px 0;">
        You can check out your show here:<br/>
        <a href="${reelLink}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(reelLink)}</a><br/>
        <span style="font-size: 13px; color: #6b7280;">(we know it's a strange domain. we built this for the Convex hackathon as a new way to help people discover new podcasts to love.)</span>
      </p>

      <p style="margin: 0 0 16px 0;">
        This inbox is monitored by an AI assistant that can help make quick updates to how your show appears on DiscoPod. If you want to change anything, you can just reply directly to this email:
      </p>

      <ul style="margin: 0 0 16px 0; padding-left: 20px; line-height: 1.7;">
        <li style="margin-bottom: 6px;"><em>&ldquo;Can you send me my claim code?&rdquo;</em> (if you prefer to manage it yourself on the site)</li>
        <li style="margin-bottom: 6px;"><em>&ldquo;Change the audio clip to start at 14:20&rdquo;</em></li>
        <li style="margin-bottom: 6px;"><em>&ldquo;Update the quote to: [your quote]&rdquo;</em></li>
        <li style="margin-bottom: 6px;"><em>&ldquo;Not my show&rdquo;</em> (if you'd rather we take it down completely)</li>
      </ul>

      <p style="margin: 0 0 16px 0;">
        Or if you have any questions at all, just let me know!
      </p>

      <p style="margin: 0 0 0 0;">
        Best,<br/>
        Kurt Libby, maker of DiscoPod
      </p>
    </div>
  `;

  const apiKey = process.env.AGENTMAIL_API_KEY;
  const rawInbox = process.env.AGENTMAIL_INBOX_ID || "discopod@agentmail.to";
  const inboxId = rawInbox.includes("@") ? rawInbox : `${rawInbox}@agentmail.to`;

  let inboxThreadId = `thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (apiKey) {
    try {
      const resp = await fetch(
        `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: targetEmail,
            subject,
            text: bodyText,
            html: bodyHtml,
            labels: ["creator-claim", "discopod-preview", `show-${args.showId}`],
          }),
        },
      );
      if (resp.ok) {
        const data = (await resp.json()) as {
          threadId?: string;
          thread_id?: string;
          message_id?: string;
          id?: string;
        };
        inboxThreadId =
          data.thread_id || data.threadId || data.message_id || data.id || inboxThreadId;
      } else {
        const errText = await resp.text();
        console.error(
          `[emailDispatcher] AgentMail API error (${resp.status}): ${errText}`,
        );
      }
    } catch (err) {
      console.error("[emailDispatcher] Error sending via AgentMail:", err);
      // Still return thread ID so workflow continues gracefully in dev/offline
    }
  } else {
    console.log(
      `[emailDispatcher] AGENTMAIL_API_KEY not set. Simulated send to ${targetEmail} (Staging: ${isStaging})`,
    );
  }

  // --- 4. Record outreach in hostOutreachLog to enforce Single-Contact Rule ---
  try {
    await (ctx as ActionCtx).runMutation(
      internal.ownerSettings.recordHostOutreachSent,
      {
        email: args.actualScrapedEmail,
        showId: args.showId as any,
        showTitle: args.showTitle,
        subject,
        inboxThreadId,
        isStaging,
      },
    );
  } catch (err) {
    console.error("[emailDispatcher] Error recording host outreach log:", err);
  }

  return {
    recipient: targetEmail,
    inboxThreadId,
    isStaging,
    subject,
    bodyText,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface SendHitlEscalationArgs {
  subject: string;
  headline: string;
  podcastTitle: string;
  podcastId: string;
  emailOnFile?: string;
  requestedEmail?: string;
  requesterName?: string;
  proofNote?: string;
  requestId?: string;
  unresolvedCreatorMessage?: string;
  actionInstructions?: string[];
}

/**
 * Dispatch an escalation email to the Human-in-the-Loop admin.
 * Sent when agentic mail fails, an email mismatch request is submitted,
 * or manual creator verification is required.
 */
export async function sendHitlEscalationEmail(
  ctx: ActionCtx | MutationCtx,
  args: SendHitlEscalationArgs,
): Promise<{ recipient: string; sent: boolean; inboxThreadId: string }> {
  let hitlEmail = "";
  try {
    const settings = await (ctx as ActionCtx).runQuery(
      internal.ownerSettings.getOwnerSettingsInternal,
      {},
    );
    hitlEmail = settings.humanInTheLoopEmail?.trim() || "";
  } catch {
    hitlEmail =
      process.env.ADMIN_HELP_EMAIL?.trim() ||
      process.env.HUMAN_IN_THE_LOOP_EMAIL?.trim() ||
      "";
  }

  if (!hitlEmail) {
    console.warn(
      `[emailDispatcher] No Human-in-the-Loop email configured in ownerSettings or env. Escalation for "${args.podcastTitle}" recorded in database only.`,
    );
    return {
      recipient: "",
      sent: false,
      inboxThreadId: `no_hitl_email_${Date.now()}`,
    };
  }

  const instructions = args.actionInstructions || [
    `Reply "APPROVE ${args.requestId || args.podcastId}" to verify the claim and update host email to ${args.requestedEmail || "requested address"}`,
    `Reply "REJECT ${args.requestId || args.podcastId}" to reject this access request`,
    `Reply "TAKEDOWN ${args.podcastTitle}" to immediately tombstone this show`,
  ];

  const bodyText = `
[DISCOPOD HUMAN IN THE LOOP ESCALATION]
${args.headline}

Podcast: "${args.podcastTitle}" (ID: ${args.podcastId})
Email on File (RSS): ${args.emailOnFile || "None detected"}
Requested Email: ${args.requestedEmail || "N/A"}
Requester Name: ${args.requesterName || "Not provided"}
${args.proofNote ? `Verification Note: ${args.proofNote}\n` : ""}${args.unresolvedCreatorMessage ? `Host Message: "${args.unresolvedCreatorMessage}"\n` : ""}
HOW TO RESOLVE (Reply directly to this email):
${instructions.map((ins, i) => `${i + 1}. ${ins}`).join("\n")}

--
DiscoPod Autonomous Agent · Human Oversight Engine
`.trim();

  const bodyHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e1b4b; background: #ffffff;">
      <div style="background: #eef2ff; border-left: 4px solid #6366f1; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px;">
        <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #4338ca;">Human In The Loop Escalation</span>
        <h2 style="margin: 4px 0 0 0; font-size: 18px; color: #1e1b4b;">${escapeHtml(args.headline)}</h2>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px; font-size: 14px; line-height: 1.6;">
        <div><strong>Podcast:</strong> ${escapeHtml(args.podcastTitle)} (<code>${escapeHtml(args.podcastId)}</code>)</div>
        <div><strong>Email on file (RSS):</strong> <code>${escapeHtml(args.emailOnFile || "None")}</code></div>
        ${args.requestedEmail ? `<div><strong>Requested Email:</strong> <code style="color: #047857; font-weight: bold;">${escapeHtml(args.requestedEmail)}</code></div>` : ""}
        ${args.requesterName ? `<div><strong>Requester:</strong> ${escapeHtml(args.requesterName)}</div>` : ""}
        ${args.proofNote ? `<div style="margin-top: 8px; padding: 10px; background: #ffffff; border-radius: 6px; border: 1px solid #cbd5e1;"><strong>Note:</strong> ${escapeHtml(args.proofNote)}</div>` : ""}
        ${args.unresolvedCreatorMessage ? `<div style="margin-top: 8px; padding: 10px; background: #fffbeb; border-radius: 6px; border: 1px solid #fef3c7;"><strong>Creator Message:</strong> "${escapeHtml(args.unresolvedCreatorMessage)}"</div>` : ""}
      </div>

      <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
        <h4 style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #334155;">Administrative Actions via Reply:</h4>
        <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.8;">
          ${instructions.map((ins) => `<li>${escapeHtml(ins)}</li>`).join("")}
        </ol>
      </div>

      <div style="font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 12px;">
        DiscoPod Autonomous Agent · Authorized HITL Recipient: <code>${escapeHtml(hitlEmail)}</code>
      </div>
    </div>
  `;

  const apiKey = process.env.AGENTMAIL_API_KEY;
  const rawInbox = process.env.AGENTMAIL_INBOX_ID || "discopod@agentmail.to";
  const inboxId = rawInbox.includes("@") ? rawInbox : `${rawInbox}@agentmail.to`;
  let inboxThreadId = `hitl_thread_${Date.now()}`;

  if (apiKey) {
    try {
      const resp = await fetch(
        `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: hitlEmail,
            subject: args.subject,
            text: bodyText,
            html: bodyHtml,
            labels: ["hitl-escalation", `show-${args.podcastId}`],
          }),
        },
      );
      if (resp.ok) {
        const data = (await resp.json()) as {
          threadId?: string;
          thread_id?: string;
          message_id?: string;
          id?: string;
        };
        inboxThreadId =
          data.thread_id || data.threadId || data.message_id || data.id || inboxThreadId;
      } else {
        const errText = await resp.text();
        console.error(
          `[emailDispatcher:sendHitlEscalationEmail] API error (${resp.status}): ${errText}`,
        );
      }
      return { recipient: hitlEmail, sent: true, inboxThreadId };
    } catch (err) {
      console.error("[emailDispatcher:sendHitlEscalationEmail] Error:", err);
    }
  }

  return { recipient: hitlEmail, sent: false, inboxThreadId };
}
