import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export interface HostAccessEmailArgs {
  showId: Id<"shows">;
  showTitle: string;
  hostEmail: string;
  token: string;
  maskedEmail: string;
}

export interface AdminEscalationEmailArgs {
  adminEmail: string;
  showId: Id<"shows">;
  showTitle: string;
  onFileEmail?: string;
  maskedOnFileEmail?: string;
  alternateEmail: string;
  note?: string;
  requestId: Id<"hostAccessRequests">;
}

export interface DispatchResult {
  recipient: string;
  inboxThreadId: string;
  isStaging: boolean;
}

async function resolveTargetEmail(
  ctx: ActionCtx,
  actualEmail: string,
): Promise<{ targetEmail: string; isStaging: boolean; intendedRecipient: string }> {
  const settings = await ctx.runQuery(internal.ownerSettings.getOwnerSettingsInternal, {});
  const overrideEmail = settings.emailOverrideAddress.trim();
  const hasOverride = Boolean(overrideEmail);
  const isStaging = !settings.emailEnabled || hasOverride;

  if (!settings.emailEnabled && !hasOverride) {
    return {
      targetEmail: actualEmail,
      isStaging: true,
      intendedRecipient: actualEmail,
    };
  }

  return {
    targetEmail: hasOverride ? overrideEmail : actualEmail,
    isStaging,
    intendedRecipient: actualEmail,
  };
}

export async function sendHostAccessVerificationEmail(
  ctx: ActionCtx,
  args: HostAccessEmailArgs,
): Promise<DispatchResult> {
  const { targetEmail, isStaging, intendedRecipient } = await resolveTargetEmail(
    ctx,
    args.hostEmail,
  );

  const subject = `Verify host access for "${args.showTitle}" on DiscoPod`;
  const siteBaseUrl =
    process.env.CONVEX_SITE_URL || "https://agreeable-pika-776.convex.site";
  const manageUrl = `${siteBaseUrl}/?hostShow=${encodeURIComponent(args.showId)}`;

  const bodyLines: string[] = [];
  if (isStaging && intendedRecipient !== targetEmail) {
    bodyLines.push("⚠️ [EMAIL OVERRIDE MODE — NOT SENT TO REAL HOST]");
    bodyLines.push(`Intended Recipient: ${intendedRecipient}`);
    bodyLines.push(`Redirected To: ${targetEmail}`);
    bodyLines.push("--------------------------------------------------");
    bodyLines.push("");
  }

  bodyLines.push(
    `Someone requested host access to "${args.showTitle}" on DiscoPod.`,
    "",
    "If this is your show, reply to this email with VERIFY to unlock your Verified Host badge and manage your 45-second Disco Reel.",
    "",
    "You can also manage your show by replying with:",
    "- VERIFY or CLAIM — confirm ownership",
    "- Change snippet to MM:SS — re-slice your highlight reel",
    "- Set hook to [quote] — update your featured quote",
    "- Reject — if this is not your show",
    "",
    `Host portal: ${manageUrl}`,
    "",
    `Show reference: ${args.showId}`,
  );

  const bodyText = bodyLines.join("\n");
  const rawInbox = process.env.AGENTMAIL_INBOX_ID || "discopod@agentmail.to";
  const inboxId = rawInbox.includes("@") ? rawInbox : `${rawInbox}@agentmail.to`;
  let inboxThreadId = `thread_access_${Date.now()}`;
  const apiKey = process.env.AGENTMAIL_API_KEY;

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
            labels: ["host-access-verify", "discopod-host", `show-${args.showId}`],
          }),
        },
      );
      if (resp.ok) {
        const data = (await resp.json()) as { threadId?: string; thread_id?: string; message_id?: string };
        inboxThreadId = data.thread_id || data.threadId || data.message_id || inboxThreadId;
      } else {
        const errText = await resp.text();
        console.error(`[hostAccessEmail] AgentMail API error (${resp.status}): ${errText}`);
      }
    } catch (err) {
      console.error("[hostAccessEmail] Failed to send verification email:", err);
    }
  } else {
    console.log(`[hostAccessEmail] Simulated verification email to ${targetEmail}`);
  }

  return {
    recipient: targetEmail,
    inboxThreadId,
    isStaging,
  };
}

export async function sendAdminEscalationEmail(
  ctx: ActionCtx,
  args: AdminEscalationEmailArgs,
): Promise<DispatchResult> {
  const subject = `[DiscoPod HITL] Host access review — ${args.showTitle}`;
  const bodyLines = [
    "A podcast host requested manual review for show access on DiscoPod.",
    "",
    `Show: ${args.showTitle}`,
    `Show ID: ${args.showId}`,
    `Request ID: ${args.requestId}`,
    "",
    `Email on file: ${args.maskedOnFileEmail || args.onFileEmail || "(none on file)"}`,
    `Requested alternate email: ${args.alternateEmail}`,
    ...(args.note ? [`Host note: ${args.note}`, ""] : [""]),
    "Actions (future admin mail loop):",
    "- Reply APPROVE <email> to update the host email and send verification",
    "- Reply REJECT <reason> to decline the request",
    "",
    "This escalation uses the dedicated DiscoPod agent inbox — not a personal mailbox.",
  ];

  const bodyText = bodyLines.join("\n");
  const rawInbox = process.env.AGENTMAIL_INBOX_ID || "discopod@agentmail.to";
  const inboxId = rawInbox.includes("@") ? rawInbox : `${rawInbox}@agentmail.to`;
  let inboxThreadId = `thread_escalation_${Date.now()}`;
  const apiKey = process.env.AGENTMAIL_API_KEY;
  let adminRecipient = args.adminEmail;
  if (!adminRecipient) {
    try {
      const settings = await ctx.runQuery(internal.ownerSettings.getOwnerSettingsInternal, {});
      adminRecipient = settings.humanInTheLoopEmail?.trim() || settings.emailOverrideAddress?.trim() || "";
    } catch {
      adminRecipient = "";
    }
  }

  if (apiKey && adminRecipient) {
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
            to: adminRecipient,
            subject,
            text: bodyText,
            labels: ["host-access-hitl", "admin-escalation", `request-${args.requestId}`],
          }),
        },
      );
      if (resp.ok) {
        const data = (await resp.json()) as { threadId?: string; thread_id?: string; message_id?: string };
        inboxThreadId = data.thread_id || data.threadId || data.message_id || inboxThreadId;
      } else {
        const errText = await resp.text();
        console.error(`[hostAccessEmail] AgentMail API error (${resp.status}): ${errText}`);
      }
    } catch (err) {
      console.error("[hostAccessEmail] Failed to send admin escalation email:", err);
    }
  } else {
    console.log(`[hostAccessEmail] Simulated admin escalation to ${args.adminEmail}`);
  }

  return {
    recipient: args.adminEmail,
    inboxThreadId,
    isStaging: false,
  };
}
