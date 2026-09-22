import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type DatabaseReader } from "./_generated/server";
import { extractCleanEmail } from "./lib/maskEmail";
import type { Doc, Id } from "./_generated/dataModel";

/** Default settings returned when no document has been saved yet. */
const DEFAULTS = {
  emailEnabled: false,
  emailOverrideAddress: "",
  humanInTheLoopEmail: "",
} as const;

/**
 * Public query: returns the current owner settings (or defaults).
 * Used by the Admin UI.
 */
export const getOwnerSettings = query({
  args: {},
  returns: v.object({
    emailEnabled: v.boolean(),
    emailOverrideAddress: v.string(),
    humanInTheLoopEmail: v.string(),
  }),
  handler: async (ctx) => {
    const doc = await ctx.db
      .query("ownerSettings")
      .withIndex("by_key", (q) => q.eq("key", "singleton"))
      .unique();
    if (!doc) return DEFAULTS;
    return {
      emailEnabled: doc.emailEnabled,
      emailOverrideAddress: doc.emailOverrideAddress,
      humanInTheLoopEmail: doc.humanInTheLoopEmail || "",
    };
  },
});

/**
 * Internal query: used by emailDispatcher (called via ctx.runQuery inside actions)
 * and by agentMailHandler to enforce from-address restrictions and HITL escalations.
 */
export const getOwnerSettingsInternal = internalQuery({
  args: {},
  returns: v.object({
    emailEnabled: v.boolean(),
    emailOverrideAddress: v.string(),
    humanInTheLoopEmail: v.string(),
  }),
  handler: async (ctx) => {
    const doc = await ctx.db
      .query("ownerSettings")
      .withIndex("by_key", (q) => q.eq("key", "singleton"))
      .unique();
    if (!doc) return DEFAULTS;
    return {
      emailEnabled: doc.emailEnabled,
      emailOverrideAddress: doc.emailOverrideAddress,
      humanInTheLoopEmail: doc.humanInTheLoopEmail || "",
    };
  },
});

/**
 * Public mutation: upserts the singleton owner settings document.
 * For the hackathon this is ungated — only the admin UI calls it.
 */
export const setOwnerSettings = mutation({
  args: {
    emailEnabled: v.boolean(),
    emailOverrideAddress: v.string(),
    humanInTheLoopEmail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ownerSettings")
      .withIndex("by_key", (q) => q.eq("key", "singleton"))
      .unique();

    if (existing) {
      await ctx.db.patch("ownerSettings", existing._id, {
        emailEnabled: args.emailEnabled,
        emailOverrideAddress: args.emailOverrideAddress,
        humanInTheLoopEmail: args.humanInTheLoopEmail?.trim() ?? existing.humanInTheLoopEmail,
      });
    } else {
      await ctx.db.insert("ownerSettings", {
        key: "singleton",
        emailEnabled: args.emailEnabled,
        emailOverrideAddress: args.emailOverrideAddress,
        humanInTheLoopEmail: args.humanInTheLoopEmail?.trim() ?? "",
      });
    }
    return null;
  },
});

/**
 * Public mutation: sets only the Human-in-the-Loop Admin email.
 * This is the inbox where agentic mail escalates when human review is required,
 * and whose inbound emails to AgentMail are authorized to execute admin tasks.
 */
export const setHumanInTheLoopEmail = mutation({
  args: {
    humanInTheLoopEmail: v.string(),
  },
  returns: v.object({
    humanInTheLoopEmail: v.string(),
  }),
  handler: async (ctx, args) => {
    const trimmed = args.humanInTheLoopEmail.trim();
    const existing = await ctx.db
      .query("ownerSettings")
      .withIndex("by_key", (q) => q.eq("key", "singleton"))
      .unique();

    if (existing) {
      await ctx.db.patch("ownerSettings", existing._id, {
        humanInTheLoopEmail: trimmed,
      });
    } else {
      await ctx.db.insert("ownerSettings", {
        key: "singleton",
        emailEnabled: false,
        emailOverrideAddress: "",
        humanInTheLoopEmail: trimmed,
      });
    }

    return {
      humanInTheLoopEmail: trimmed,
    };
  },
});

/**
 * Convenience mutation: updates only the email override address.
 * Empty string removes the override and restores normal host delivery.
 */
export const setEmailOverride = mutation({
  args: {
    emailOverrideAddress: v.string(),
  },
  returns: v.object({
    emailOverrideAddress: v.string(),
    hasOverride: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const trimmed = args.emailOverrideAddress.trim();
    const existing = await ctx.db
      .query("ownerSettings")
      .withIndex("by_key", (q) => q.eq("key", "singleton"))
      .unique();

    const hasOverride = Boolean(trimmed);
    if (existing) {
      await ctx.db.patch("ownerSettings", existing._id, {
        emailOverrideAddress: trimmed,
        emailEnabled: !hasOverride,
      });
    } else {
      await ctx.db.insert("ownerSettings", {
        key: "singleton",
        emailEnabled: !hasOverride,
        emailOverrideAddress: trimmed,
      });
    }

    return {
      emailOverrideAddress: trimmed,
      hasOverride: Boolean(trimmed),
    };
  },
});

/**
 * Internal query: check whether an email address is on the suppression list.
 */
export const isEmailSuppressed = internalQuery({
  args: {
    email: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      email: v.string(),
      reason: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();
    if (!cleanEmail) return null;
    const doc = await ctx.db
      .query("emailSuppressions")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();
    if (!doc) return null;
    return {
      email: doc.email,
      reason: doc.reason,
      createdAt: doc.createdAt,
    };
  },
});

/**
 * Public query for the Admin UI to see all suppressed email addresses.
 */
export const listSuppressions = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("emailSuppressions"),
      email: v.string(),
      reason: v.string(),
      eventType: v.optional(v.string()),
      details: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    return await ctx.db.query("emailSuppressions").order("desc").take(50);
  },
});

/**
 * Public mutation: remove an email from the suppression list.
 */
export const removeSuppression = mutation({
  args: {
    id: v.id("emailSuppressions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});

/**
 * Helper function evaluating whether an outreach/notification email is permitted
 * under the strict Single-Contact Rule.
 *
 * RULE:
 * - A host receives at most ONE outbound email from DiscoPod.
 * - Once contacted, ALL subsequent automated/outbound emails to that host (or show)
 *   are BLOCKED until the host sends an inbound reply.
 * - When a reply has been received, communication is unlocked.
 */
export async function evaluateHostEmailStatus(
  db: DatabaseReader,
  args: {
    hostEmail: string;
    showId?: Id<"shows">;
  },
): Promise<{
  allowed: boolean;
  reason: string;
  previousSentAt?: number;
  hasReceivedReply: boolean;
  lastReplyAt?: number;
  outreachCount: number;
}> {
  const cleanEmail = extractCleanEmail(args.hostEmail);
  if (!cleanEmail || cleanEmail.includes("creator-unlisted@")) {
    return {
      allowed: false,
      reason: "invalid_or_unlisted_email",
      hasReceivedReply: false,
      outreachCount: 0,
    };
  }

  // 1. Check suppression list
  const suppression = await db
    .query("emailSuppressions")
    .withIndex("by_email", (q) => q.eq("email", cleanEmail))
    .first();

  if (suppression) {
    return {
      allowed: false,
      reason: `suppressed_${suppression.reason}`,
      hasReceivedReply: false,
      outreachCount: 0,
    };
  }

  // 2. Check hostOutreachLog by email
  const emailOutreaches = await db
    .query("hostOutreachLog")
    .withIndex("by_email", (q) => q.eq("email", cleanEmail))
    .collect();

  // 3. Check hostOutreachLog by showId
  let showOutreaches: Doc<"hostOutreachLog">[] = [];
  if (args.showId) {
    showOutreaches = await db
      .query("hostOutreachLog")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId!))
      .collect();
  }

  // 4. Check territoryClaims for prior notification on this show
  let territoryClaimNotified = false;
  let claimThreadId = "";
  if (args.showId) {
    const claim = await db
      .query("territoryClaims")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId!))
      .first();
    if (claim && (claim.tractionNotifiedAt || (claim.inboxThreadId && claim.inboxThreadId.length > 0))) {
      territoryClaimNotified = true;
      claimThreadId = claim.inboxThreadId;
    }
  }

  // Merge all outreach records
  const allOutreaches = [...emailOutreaches];
  for (const so of showOutreaches) {
    if (!allOutreaches.some((r) => r._id === so._id)) {
      allOutreaches.push(so);
    }
  }

  const hasPriorOutreach = allOutreaches.length > 0 || territoryClaimNotified;

  if (!hasPriorOutreach) {
    // First contact with this host: ALLOWED
    return {
      allowed: true,
      reason: "first_outreach",
      hasReceivedReply: false,
      outreachCount: 0,
    };
  }

  // Check if host has replied
  let replyReceived = allOutreaches.some((r) => r.hasReceivedReply);
  let lastReplyTimestamp = allOutreaches.reduce(
    (max, r) => Math.max(max, r.lastReplyAt ?? 0),
    0,
  );

  // Also check agentMailInteractions directly to be 100% resilient
  const inboundInteractions = await db
    .query("agentMailInteractions")
    .withIndex("by_from")
    .collect();

  const matchingInbound = inboundInteractions.filter((i) => {
    const fromEmail = extractCleanEmail(i.from);
    if (fromEmail === cleanEmail) return true;
    if (claimThreadId && i.threadId === claimThreadId) return true;
    return false;
  });

  if (matchingInbound.length > 0) {
    replyReceived = true;
    const latestInteraction = matchingInbound.reduce((max, i) => Math.max(max, i.createdAt), 0);
    lastReplyTimestamp = Math.max(lastReplyTimestamp, latestInteraction);
  }

  const latestOutreach = allOutreaches.reduce(
    (max, r) => Math.max(max, r.sentAt),
    0,
  );

  if (replyReceived) {
    return {
      allowed: true,
      reason: "reply_received",
      previousSentAt: latestOutreach || undefined,
      hasReceivedReply: true,
      lastReplyAt: lastReplyTimestamp || undefined,
      outreachCount: allOutreaches.length,
    };
  }

  // Emailed previously and NO reply received yet -> BLOCKED!
  return {
    allowed: false,
    reason: "already_emailed_awaiting_reply",
    previousSentAt: latestOutreach || undefined,
    hasReceivedReply: false,
    outreachCount: allOutreaches.length,
  };
}

/**
 * Internal query: Evaluates whether an outreach/notification email is permitted
 * under the strict Single-Contact Rule.
 */
export const canEmailHost = internalQuery({
  args: {
    hostEmail: v.string(),
    showId: v.optional(v.id("shows")),
  },
  returns: v.object({
    allowed: v.boolean(),
    reason: v.string(),
    previousSentAt: v.optional(v.number()),
    hasReceivedReply: v.boolean(),
    lastReplyAt: v.optional(v.number()),
    outreachCount: v.number(),
  }),
  handler: async (ctx, args) => {
    return await evaluateHostEmailStatus(ctx.db, args);
  },
});

/**
 * Public query for Admin UI to inspect outreach status for any host email / show.
 */
export const checkHostEmailStatus = query({
  args: {
    hostEmail: v.string(),
    showId: v.optional(v.id("shows")),
  },
  returns: v.object({
    allowed: v.boolean(),
    reason: v.string(),
    previousSentAt: v.optional(v.number()),
    hasReceivedReply: v.boolean(),
    lastReplyAt: v.optional(v.number()),
    outreachCount: v.number(),
  }),
  handler: async (ctx, args) => {
    return await evaluateHostEmailStatus(ctx.db, args);
  },
});

/**
 * Internal mutation: records an outbound outreach email sent to a host.
 */
export const recordHostOutreachSent = internalMutation({
  args: {
    email: v.string(),
    showId: v.optional(v.id("shows")),
    showTitle: v.optional(v.string()),
    subject: v.string(),
    inboxThreadId: v.string(),
    isStaging: v.boolean(),
  },
  returns: v.id("hostOutreachLog"),
  handler: async (ctx, args) => {
    const cleanEmail = extractCleanEmail(args.email);
    const id = await ctx.db.insert("hostOutreachLog", {
      email: cleanEmail,
      showId: args.showId,
      showTitle: args.showTitle,
      subject: args.subject,
      inboxThreadId: args.inboxThreadId,
      isStaging: args.isStaging,
      sentAt: Date.now(),
      hasReceivedReply: false,
    });

    if (args.showId) {
      const claim = await ctx.db
        .query("territoryClaims")
        .withIndex("by_showId", (q) => q.eq("showId", args.showId!))
        .first();
      if (claim) {
        await ctx.db.patch("territoryClaims", claim._id, {
          tractionNotifiedAt: Date.now(),
          inboxThreadId: args.inboxThreadId || claim.inboxThreadId,
        });
      }
    }

    return id;
  },
});

/**
 * Internal mutation: marks that an inbound reply was received from a host,
 * unlocking future correspondence for that host and show.
 */
export const markHostReplyReceived = internalMutation({
  args: {
    email: v.string(),
    threadId: v.optional(v.string()),
    showId: v.optional(v.id("shows")),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const cleanEmail = extractCleanEmail(args.email);
    const now = Date.now();
    let updatedCount = 0;

    if (cleanEmail) {
      const records = await ctx.db
        .query("hostOutreachLog")
        .withIndex("by_email", (q) => q.eq("email", cleanEmail))
        .collect();

      for (const rec of records) {
        if (!rec.hasReceivedReply) {
          await ctx.db.patch("hostOutreachLog", rec._id, {
            hasReceivedReply: true,
            lastReplyAt: now,
          });
          updatedCount++;
        }
      }
    }

    if (args.showId) {
      const records = await ctx.db
        .query("hostOutreachLog")
        .withIndex("by_showId", (q) => q.eq("showId", args.showId!))
        .collect();

      for (const rec of records) {
        if (!rec.hasReceivedReply) {
          await ctx.db.patch("hostOutreachLog", rec._id, {
            hasReceivedReply: true,
            lastReplyAt: now,
          });
          updatedCount++;
        }
      }
    }

    return updatedCount;
  },
});

/**
 * Public query: lists recent host outreach logs for the Admin dashboard.
 */
export const listHostOutreachLog = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("hostOutreachLog"),
      email: v.string(),
      showId: v.optional(v.id("shows")),
      showTitle: v.optional(v.string()),
      subject: v.string(),
      inboxThreadId: v.string(),
      isStaging: v.boolean(),
      sentAt: v.number(),
      hasReceivedReply: v.boolean(),
      lastReplyAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    return await ctx.db.query("hostOutreachLog").order("desc").take(50);
  },
});

/**
 * Public mutation: backfills existing territory claims with notified threads into hostOutreachLog
 * so past emailed shows are recognized and never emailed a duplicate.
 */
export const backfillExistingOutreach = mutation({
  args: {},
  returns: v.object({
    backfilled: v.number(),
  }),
  handler: async (ctx) => {
    const claims = await ctx.db.query("territoryClaims").collect();
    let backfilled = 0;

    for (const claim of claims) {
      if (claim.inboxThreadId || claim.tractionNotifiedAt) {
        const show = await ctx.db.get("shows", claim.showId);
        const hostEmail = show?.hostEmail ? extractCleanEmail(show.hostEmail) : "";
        if (!hostEmail || hostEmail.includes("creator-unlisted@")) continue;

        const existing = await ctx.db
          .query("hostOutreachLog")
          .withIndex("by_showId", (q) => q.eq("showId", claim.showId))
          .first();

        if (!existing) {
          await ctx.db.insert("hostOutreachLog", {
            email: hostEmail,
            showId: claim.showId,
            showTitle: show?.title,
            subject: `${show?.title ?? "Show"} is getting noticed on DiscoPod`,
            inboxThreadId: claim.inboxThreadId || `backfill_${Date.now()}`,
            isStaging: false,
            sentAt: claim.tractionNotifiedAt || claim._creationTime,
            hasReceivedReply: claim.claimStatus === "verified",
          });
          backfilled++;
        }
      }
    }

    return { backfilled };
  },
});

/**
 * Public mutation: deletes a host outreach log entry (e.g. for testing reset).
 */
export const deleteHostOutreachLogEntry = mutation({
  args: {
    id: v.id("hostOutreachLog"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});

