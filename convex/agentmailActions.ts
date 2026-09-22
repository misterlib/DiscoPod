"use node";

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";

export const sendShowPreviewEmail = action({
  args: {
    showId: v.id("shows"),
    hostEmail: v.string(),
    token: v.string(),
  },
  returns: v.object({
    inboxThreadId: v.string(),
    recipient: v.string(),
    isOverridden: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const apiKey = process.env.AGENTMAIL_API_KEY;
    if (!apiKey) {
      throw new Error("AGENTMAIL_API_KEY is required to send preview emails.");
    }

    // Check Convex ownerSettings for email override
    let targetEmail = args.hostEmail;
    let isOverridden = false;
    try {
      const settings = await ctx.runQuery(
        internal.ownerSettings.getOwnerSettingsInternal,
        {},
      );
      if (settings.emailOverrideAddress?.trim()) {
        targetEmail = settings.emailOverrideAddress.trim();
        isOverridden = true;
      }
    } catch {
      if (process.env.TEST_EMAIL_OVERRIDE?.trim()) {
        targetEmail = process.env.TEST_EMAIL_OVERRIDE.trim();
        isOverridden = true;
      }
    }

    // Check Single-Contact Rule (Do not email host more than once unless they reply)
    let canEmail: { allowed: boolean; reason: string } = { allowed: true, reason: "default" };
    try {
      canEmail = await ctx.runQuery(internal.ownerSettings.canEmailHost, {
        hostEmail: args.hostEmail,
        showId: args.showId,
      });
    } catch (err) {
      console.error("[sendShowPreviewEmail] Error checking canEmailHost:", err);
    }

    if (!canEmail.allowed) {
      console.warn(
        `[sendShowPreviewEmail] BLOCKED duplicate email to ${args.hostEmail}: reason="${canEmail.reason}"`,
      );
      return {
        inboxThreadId: `blocked_duplicate_${Date.now()}`,
        recipient: targetEmail,
        isOverridden,
      };
    }

    const textLines: string[] = [];
    if (isOverridden) {
      textLines.push("⚠️ [TEST EMAIL OVERRIDE ACTIVE — REDIRECTED FOR TESTING]");
      textLines.push(`Intended Recipient: ${args.hostEmail}`);
      textLines.push(`Delivered to Override: ${targetEmail}`);
      textLines.push("--------------------------------------------------");
      textLines.push("");
    }

    textLines.push(
      "You were detected as the host for a mapped show on DiscoPod.",
      "",
      `YOUR SHOW CLAIM CODE: ${args.token}`,
      "",
      "HOW TO CLAIM & MANAGE YOUR SHOW:",
      "1. Go to DiscoPod: https://agreeable-pika-776.convex.site",
      "2. Click the 'Admin' button in the bottom bar on the home screen.",
      `3. Enter your claim code: ${args.token}`,
      "4. Click 'Verify & Claim Show' to view your show dashboard and unlock your Verified Host badge!",
      "",
      "OR REPLY TO THIS EMAIL:",
      "- Verify or Claim (claims your show on the 3D globe)",
      "- Change snippet to MM:SS (e.g. Change snippet to 10:15)",
      "- Set hook to [your quote] (customizes featured quote)",
      "- Reject (removes host claim if not your show)",
      "- Or ask any question directly to our AI agent",
      "",
      `Claim Code: ${args.token}`,
      `Show Reference: ${args.showId}`,
    );

    const subject = isOverridden
      ? `[TEST OVERRIDE] Your DiscoPod preview is ready`
      : "Your DiscoPod preview is ready";

    const rawInbox = process.env.AGENTMAIL_INBOX_ID || "discopod@agentmail.to";
    const inboxId = rawInbox.includes("@") ? rawInbox : `${rawInbox}@agentmail.to`;

    const response = await fetch(
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
          text: textLines.join("\n"),
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AgentMail send failed with ${response.status}: ${errText}`);
    }

    const payload = (await response.json()) as {
      threadId?: string;
      thread_id?: string;
      message_id?: string;
    };
    const threadId = payload.thread_id || payload.threadId || payload.message_id || `thread_${Date.now()}`;

    // Record outreach in hostOutreachLog to enforce Single-Contact Rule
    try {
      await ctx.runMutation(internal.ownerSettings.recordHostOutreachSent, {
        email: args.hostEmail,
        showId: args.showId,
        subject,
        inboxThreadId: threadId,
        isStaging: isOverridden,
      });
    } catch (err) {
      console.error("[sendShowPreviewEmail] Error recording outreach log:", err);
    }

    return {
      inboxThreadId: threadId,
      recipient: targetEmail,
      isOverridden,
    };
  },
});

/**
 * Action to send an immediate test email to verify that AgentMail
 * is properly routing to the configured override address.
 */
export const sendTestEmailAction = action({
  args: {
    customSubject: v.optional(v.string()),
    customBody: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    recipient: v.string(),
    isOverridden: v.boolean(),
    inboxThreadId: v.string(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const apiKey = process.env.AGENTMAIL_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        recipient: "none",
        isOverridden: false,
        inboxThreadId: "none",
        message: "AGENTMAIL_API_KEY environment secret is not configured in Convex.",
      };
    }

    let targetEmail = "";
    let isOverridden = false;
    try {
      const settings = await ctx.runQuery(
        internal.ownerSettings.getOwnerSettingsInternal,
        {},
      );
      if (settings.emailOverrideAddress?.trim()) {
        targetEmail = settings.emailOverrideAddress.trim();
        isOverridden = true;
      }
    } catch {
      targetEmail = process.env.TEST_EMAIL_OVERRIDE?.trim() ?? "";
      if (targetEmail) isOverridden = true;
    }

    if (!targetEmail) {
      return {
        success: false,
        recipient: "none",
        isOverridden: false,
        inboxThreadId: "none",
        message: "No email override address is saved. Please save an override address first.",
      };
    }

    const subject =
      args.customSubject ||
      `[DiscoPod] AgentMail Test Override Verification (${new Date().toLocaleTimeString()})`;

    const text = [
      "DiscoPod AgentMail Integration Test",
      "====================================",
      "",
      "Status: SUCCESS",
      `Delivered To: ${targetEmail}`,
      `Is Override Active: ${isOverridden}`,
      `Timestamp: ${new Date().toISOString()}`,
      "",
      "This test email confirms that AgentMail outbound dispatch is operational",
      "and all emails are redirected to your test override address.",
      "",
      args.customBody || "Ready for creator verification testing on DiscoPod 3D globe!",
    ].join("\n");

    try {
      const rawInbox = process.env.AGENTMAIL_INBOX_ID || "discopod@agentmail.to";
      const inboxId = rawInbox.includes("@") ? rawInbox : `${rawInbox}@agentmail.to`;

      const response = await fetch(
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
            text,
          }),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        return {
          success: false,
          recipient: targetEmail,
          isOverridden,
          inboxThreadId: "none",
          message: `AgentMail API error (${response.status}): ${errText}`,
        };
      }

      const payload = (await response.json()) as {
        threadId?: string;
        thread_id?: string;
        id?: string;
      };
      const threadId =
        payload.threadId || payload.thread_id || payload.id || `thread_${Date.now()}`;

      return {
        success: true,
        recipient: targetEmail,
        isOverridden,
        inboxThreadId: threadId,
        message: `Test email successfully sent via AgentMail to ${targetEmail}!`,
      };
    } catch (err) {
      return {
        success: false,
        recipient: targetEmail,
        isOverridden,
        inboxThreadId: "none",
        message: err instanceof Error ? err.message : "Failed to send email via AgentMail",
      };
    }
  },
});

export const handleInboundAgentMail = action({
  args: {
    inboxThreadId: v.string(),
    token: v.string(),
    bodyText: v.string(),
  },
  returns: v.object({
    outcome: v.string(),
  }),
  handler: async (ctx, args): Promise<{ outcome: string }> => {
    const command = parseInboundCommand(args.bodyText);
    const result: { outcome: string } = await ctx.runMutation(
      internal.territoryClaims.processInboundClaimCommand,
      {
        inboxThreadId: args.inboxThreadId,
        token: args.token,
        command,
      },
    );
    return result;
  },
});

function parseInboundCommand(
  bodyText: string,
): "verify" | "claim" | "reject" | "change_snippet" | "unknown" {
  const normalized = bodyText.trim().toLowerCase();
  if (normalized.includes("verify") || normalized.includes("claim") || normalized === "yes") {
    return "verify";
  }
  if (normalized.includes("reject") || normalized.includes("not mine")) {
    return "reject";
  }
  if (normalized.includes("change snippet")) {
    return "change_snippet";
  }
  return "unknown";
}
