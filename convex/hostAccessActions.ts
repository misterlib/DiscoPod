"use node";

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { sendHitlEscalationEmail } from "./lib/emailDispatcher";
import { sendHostAccessVerificationEmail } from "./lib/hostAccessEmail";

export const requestAccessOnFile = action({
  args: {
    showId: v.id("shows"),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    maskedEmail: v.optional(v.string()),
    requestId: v.optional(v.id("hostAccessRequests")),
    claimStatus: v.optional(
      v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected")),
    ),
  }),
  handler: async (ctx, args) => {
    const prepared: {
      success: boolean;
      message: string;
      claimStatus?: "pending" | "verified" | "rejected";
      maskedEmail?: string;
      requestId?: Id<"hostAccessRequests">;
      hostEmail?: string;
      showTitle?: string;
      token?: string;
      claimId?: Id<"territoryClaims">;
    } = await ctx.runMutation(internal.hostAccess.prepareOnFileAccessRequest, {
      showId: args.showId,
    });

    if (!prepared.success) {
      return {
        success: false,
        message: prepared.message,
      };
    }

    if (prepared.claimStatus === "verified") {
      return {
        success: true,
        message: "This show is already verified. Loading your host dashboard…",
        maskedEmail: prepared.maskedEmail,
        requestId: prepared.requestId,
        claimStatus: "verified" as const,
      };
    }

    if (!prepared.hostEmail) {
      return {
        success: false,
        message:
          "We don't have a host email on file for this show yet. Use the alternate-email option so an admin can help.",
      };
    }

    const dispatch = await sendHostAccessVerificationEmail(ctx, {
      showId: args.showId,
      showTitle: prepared.showTitle!,
      hostEmail: prepared.hostEmail,
      token: prepared.token!,
      maskedEmail: prepared.maskedEmail!,
    });

    await ctx.runMutation(internal.hostAccess.recordVerificationEmailSent, {
      requestId: prepared.requestId!,
      claimId: prepared.claimId!,
      inboxThreadId: dispatch.inboxThreadId,
    });

    return {
      success: true,
      message: `Verification email sent to ${prepared.maskedEmail}. Reply VERIFY from that inbox to unlock your host dashboard.`,
      maskedEmail: prepared.maskedEmail,
      requestId: prepared.requestId,
      claimStatus: "pending" as const,
    };
  },
});

export const requestAccessWithAlternateEmail = action({
  args: {
    showId: v.id("shows"),
    alternateEmail: v.string(),
    note: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    requestId: v.optional(v.id("hostAccessRequests")),
  }),
  handler: async (ctx, args) => {
    const email = args.alternateEmail.trim().toLowerCase();
    if (!email.includes("@") || email.length < 5) {
      return {
        success: false,
        message: "Please enter a valid email address.",
      };
    }

    const prepared: {
      success: boolean;
      message: string;
      showTitle?: string;
      onFileEmail?: string;
      requestId?: Id<"hostAccessRequests">;
    } = await ctx.runMutation(internal.hostAccess.prepareAlternateEmailRequest, {
      showId: args.showId,
      alternateEmail: email,
      note: args.note?.trim(),
    });

    if (!prepared.success) {
      return {
        success: false,
        message: prepared.message,
      };
    }

    const settings = await ctx.runQuery(internal.ownerSettings.getOwnerSettingsInternal, {});
    if (!settings.humanInTheLoopEmail?.trim()) {
      return {
        success: false,
        message:
          "Human review is not configured yet. Please contact DiscoPod support directly.",
      };
    }

    await sendHitlEscalationEmail(ctx, {
      subject: `[DiscoPod HITL] Host access review — ${prepared.showTitle}`,
      headline: "Host requested access with a different email address",
      podcastTitle: prepared.showTitle!,
      podcastId: args.showId,
      emailOnFile: prepared.onFileEmail,
      requestedEmail: email,
      proofNote: args.note?.trim(),
      requestId: prepared.requestId!,
      unresolvedCreatorMessage: args.note?.trim(),
    });

    return {
      success: true,
      message:
        "Your request was sent to our admin team. We'll review your alternate email and follow up shortly.",
      requestId: prepared.requestId,
    };
  },
});
