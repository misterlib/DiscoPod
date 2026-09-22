import { v } from "convex/values";
import { mutation, query, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { maskEmail } from "./hostAccess";
import { sendHitlEscalationEmail } from "./lib/emailDispatcher";

/**
 * Normalizes a podcast title for robust tombstone and deduplication matching.
 */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Query: Inspect whether a show is known and preview its masked email on file
 * before a takedown is submitted.
 */
export const getShowTakedownPreview = query({
  args: {
    title: v.string(),
    showId: v.optional(v.id("shows")),
  },
  returns: v.object({
    showFound: v.boolean(),
    showId: v.optional(v.id("shows")),
    title: v.string(),
    hasHostEmail: v.boolean(),
    maskedEmailOnFile: v.optional(v.string()),
    isClaimed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const rawTitle = args.title.trim();
    if (!rawTitle && !args.showId) {
      return {
        showFound: false,
        title: "",
        hasHostEmail: false,
        isClaimed: false,
      };
    }

    if (args.showId) {
      const show = await ctx.db.get("shows", args.showId);
      if (show) {
        return {
          showFound: true,
          showId: show._id,
          title: show.title,
          hasHostEmail: Boolean(show.hostEmail && show.hostEmail.includes("@")),
          maskedEmailOnFile: show.hostEmail ? maskEmail(show.hostEmail) : undefined,
          isClaimed: Boolean(show.isClaimed),
        };
      }
    }

    const norm = normalizeTitle(rawTitle);
    const allShows = await ctx.db.query("shows").take(200);
    const matched = allShows.find((s) => normalizeTitle(s.title) === norm);

    if (matched) {
      return {
        showFound: true,
        showId: matched._id,
        title: matched.title,
        hasHostEmail: Boolean(matched.hostEmail && matched.hostEmail.includes("@")),
        maskedEmailOnFile: matched.hostEmail ? maskEmail(matched.hostEmail) : undefined,
        isClaimed: Boolean(matched.isClaimed),
      };
    }

    return {
      showFound: false,
      title: rawTitle,
      hasHostEmail: false,
      isClaimed: false,
    };
  },
});

/**
 * Query: returns the official AgentMail inbox contact address for creators.
 */
export const getAgentMailContactInfo = query({
  args: {},
  returns: v.object({
    agentMailInbox: v.string(),
  }),
  handler: async () => {
    const inboxId = process.env.AGENTMAIL_INBOX_ID || "discopod-main";
    return {
      agentMailInbox: `${inboxId}@agentmail.to`,
    };
  },
});

/**
 * Submit a takedown request.
 *
 * Anti-Competitor Security Rule:
 * Takedowns ONLY execute immediately if requested by:
 * 1. An authorized system Administrator (source === "admin"), OR
 * 2. The verified email on file for the show.
 *
 * If the requester's email is unverified, missing, or differs from the email on file,
 * the show is NOT taken down. Instead, a pending HITL takedown request is created,
 * and a human administrator is alerted to review ownership and prevent competitor attacks.
 */
export const submitTakedown = mutation({
  args: {
    showId: v.optional(v.id("shows")),
    title: v.string(),
    feedUrl: v.optional(v.string()),
    appleId: v.optional(v.string()),
    requesterEmail: v.optional(v.string()),
    requesterProofNotes: v.optional(v.string()),
    reason: v.optional(v.string()),
    source: v.union(v.literal("email_inbox"), v.literal("web_modal"), v.literal("admin")),
  },
  returns: v.object({
    success: v.boolean(),
    verified: v.boolean(),
    requiresHumanReview: v.boolean(),
    message: v.string(),
    takedownId: v.id("takedownRequests"),
    maskedEmailOnFile: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const norm = normalizeTitle(args.title);
    let resolvedFeedUrl = args.feedUrl;
    let resolvedTitle = args.title;
    let targetShow = args.showId ? await ctx.db.get("shows", args.showId) : null;

    if (!targetShow) {
      const allShows = await ctx.db.query("shows").take(200);
      targetShow =
        allShows.find(
          (s) =>
            normalizeTitle(s.title) === norm ||
            (args.feedUrl && s.rssUrl && s.rssUrl.trim().toLowerCase() === args.feedUrl.trim().toLowerCase()),
        ) || null;
    }

    if (targetShow) {
      resolvedTitle = targetShow.title;
      resolvedFeedUrl = resolvedFeedUrl || targetShow.rssUrl;
    }

    const onFileEmail = targetShow?.hostEmail?.trim().toLowerCase() || "";
    const cleanRequesterEmail = args.requesterEmail?.trim().toLowerCase() || "";

    // Determine verification:
    // Admin source is always verified.
    // Or, requester must match the email on file.
    const isVerified =
      args.source === "admin" ||
      Boolean(onFileEmail && cleanRequesterEmail && onFileEmail === cleanRequesterEmail);

    const masked = onFileEmail ? maskEmail(onFileEmail) : undefined;

    if (isVerified) {
      // --- IMMEDIATE TAKEDOWN PATH (Verified on File or Admin) ---

      // 1. Mark show(s) taken down
      if (targetShow) {
        await ctx.db.patch("shows", targetShow._id, {
          isTakenDown: true,
          takenDownAt: Date.now(),
          takedownReason: args.reason || `Takedown verified via ${args.source}`,
        });

        if (targetShow.hostEmail) {
          const existingSuppression = await ctx.db
            .query("emailSuppressions")
            .withIndex("by_email", (q) => q.eq("email", targetShow.hostEmail!.toLowerCase().trim()))
            .first();

          if (!existingSuppression) {
            await ctx.db.insert("emailSuppressions", {
              email: targetShow.hostEmail.toLowerCase().trim(),
              reason: "unsubscribed",
              eventType: "takedown_suppression",
              details: `Suppressed automatically during verified takedown of "${targetShow.title}"`,
              createdAt: Date.now(),
            });
          }
        }
      }

      // Also mark any additional matching shows by title
      const allShows = await ctx.db.query("shows").take(200);
      for (const s of allShows) {
        if (s.isTakenDown) continue;
        if (normalizeTitle(s.title) === norm) {
          await ctx.db.patch("shows", s._id, {
            isTakenDown: true,
            takenDownAt: Date.now(),
            takedownReason: args.reason || `Takedown verified via ${args.source}`,
          });
        }
      }

      // 2. Insert completed tombstone
      const takedownId = await ctx.db.insert("takedownRequests", {
        showId: targetShow?._id || args.showId,
        title: resolvedTitle,
        normalizedTitle: norm,
        rssUrl: resolvedFeedUrl,
        feedUrl: resolvedFeedUrl,
        appleId: args.appleId,
        requesterEmail: cleanRequesterEmail || undefined,
        source: args.source,
        reason: args.reason || "Creator verified takedown request",
        status: "completed",
        verifiedOnFile: true,
        requesterProofNotes: args.requesterProofNotes,
        resolvedAt: Date.now(),
        resolvedBy: args.source === "admin" ? "admin" : "verified_host_email",
        createdAt: Date.now(),
      });

      // 3. Suppress requester email
      if (cleanRequesterEmail) {
        const existing = await ctx.db
          .query("emailSuppressions")
          .withIndex("by_email", (q) => q.eq("email", cleanRequesterEmail))
          .first();

        if (!existing) {
          await ctx.db.insert("emailSuppressions", {
            email: cleanRequesterEmail,
            reason: "unsubscribed",
            eventType: "requester_suppression",
            details: `Suppressed on verified takedown request for "${resolvedTitle}"`,
            createdAt: Date.now(),
          });
        }
      }

      return {
        success: true,
        verified: true,
        requiresHumanReview: false,
        message: `✓ "${resolvedTitle}" was verified against the email on file and has been immediately removed from DiscoPod and permanently tombstoned.`,
        takedownId,
        maskedEmailOnFile: masked,
      };
    }

    // --- UNVERIFIED / COMPETITOR-PROTECTED PATH (Queued for Human-in-the-Loop) ---
    // The show is NOT taken down or tombstoned.
    const takedownId = await ctx.db.insert("takedownRequests", {
      showId: targetShow?._id || args.showId,
      title: resolvedTitle,
      normalizedTitle: norm,
      rssUrl: resolvedFeedUrl,
      feedUrl: resolvedFeedUrl,
      appleId: args.appleId,
      requesterEmail: cleanRequesterEmail || undefined,
      source: args.source,
      reason: args.reason || "Unverified takedown request",
      status: "pending_hitl",
      verifiedOnFile: false,
      requesterProofNotes: args.requesterProofNotes,
      createdAt: Date.now(),
    });

    // Alert Human-in-the-Loop admin to review the unverified takedown
    await ctx.scheduler.runAfter(0, internal.takedowns.sendHitlTakedownEscalationAction, {
      takedownId,
      podcastTitle: resolvedTitle,
      podcastId: targetShow ? targetShow._id : "unmatched",
      emailOnFile: onFileEmail || "none_on_file",
      requesterEmail: cleanRequesterEmail || "none_provided",
      proofNotes: args.requesterProofNotes || args.reason || "None provided",
    });

    return {
      success: true,
      verified: false,
      requiresHumanReview: true,
      message: masked
        ? `Takedown request received for review. To protect creators from competitor takedowns, requests from emails that do not match the public address on file (${masked}) require human verification before removal.`
        : `Takedown request received for review. A human admin will verify ownership proof before removing the show to protect creators against fraudulent competitor takedowns.`,
      takedownId,
      maskedEmailOnFile: masked,
    };
  },
});

/**
 * Internal action: sends a HITL escalation email to the admin when an unverified
 * takedown request arrives.
 */
export const sendHitlTakedownEscalationAction = internalAction({
  args: {
    takedownId: v.id("takedownRequests"),
    podcastTitle: v.string(),
    podcastId: v.string(),
    emailOnFile: v.string(),
    requesterEmail: v.string(),
    proofNotes: v.string(),
  },
  handler: async (ctx, args) => {
    await sendHitlEscalationEmail(ctx, {
      subject: `[DiscoPod HITL] Takedown Review: "${args.podcastTitle}" (Unverified Requester)`,
      headline: "Potential Competitor Takedown / Unverified Request",
      podcastTitle: args.podcastTitle,
      podcastId: args.podcastId,
      emailOnFile: args.emailOnFile,
      requestedEmail: args.requesterEmail,
      proofNote: args.proofNotes,
      actionInstructions: [
        `Reply "TAKEDOWN ${args.podcastTitle}" to approve removal and tombstone this podcast.`,
        `Reply "REJECT ${args.takedownId} Competitor request" to reject and dismiss.`,
        `Or review and resolve in the Admin Web Dashboard under Takedowns.`,
      ],
    });
  },
});

/**
 * Mutation: resolve a pending takedown request by either approving (completing takedown)
 * or rejecting (dismissing potential competitor claim).
 */
export const resolveTakedownRequest = mutation({
  args: {
    takedownId: v.id("takedownRequests"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    notes: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const record = await ctx.db.get("takedownRequests", args.takedownId);
    if (!record) {
      throw new Error(`Takedown request ${args.takedownId} not found.`);
    }

    if (args.decision === "approve") {
      // Complete the takedown and tombstone the show
      await ctx.db.patch("takedownRequests", record._id, {
        status: "completed",
        resolvedAt: Date.now(),
        resolvedBy: "admin",
        reason: args.notes || record.reason || "Approved by admin",
      });

      // Patch the show if showId exists
      if (record.showId) {
        await ctx.db.patch("shows", record.showId, {
          isTakenDown: true,
          takenDownAt: Date.now(),
          takedownReason: `Takedown approved by admin: ${args.notes || "verified"}`,
        });
      }

      // Also patch any matching shows by normalizedTitle
      const allShows = await ctx.db.query("shows").take(200);
      for (const s of allShows) {
        if (s.isTakenDown) continue;
        if (normalizeTitle(s.title) === record.normalizedTitle) {
          await ctx.db.patch("shows", s._id, {
            isTakenDown: true,
            takenDownAt: Date.now(),
            takedownReason: `Takedown approved by admin: ${args.notes || "verified"}`,
          });
        }
      }

      // Suppress emails
      if (record.requesterEmail) {
        await ctx.db.insert("emailSuppressions", {
          email: record.requesterEmail.toLowerCase().trim(),
          reason: "unsubscribed",
          eventType: "admin_approved_takedown",
          details: `Suppressed on admin approval for "${record.title}"`,
          createdAt: Date.now(),
        });
      }

      return {
        success: true,
        message: `Takedown for "${record.title}" approved. Show is now permanently tombstoned.`,
      };
    }

    // Dismiss / reject the takedown request (competitor request rejected)
    await ctx.db.patch("takedownRequests", record._id, {
      status: "rejected",
      resolvedAt: Date.now(),
      resolvedBy: "admin",
      reason: args.notes || "Rejected by admin as unverified / invalid",
    });

    return {
      success: true,
      message: `Takedown request for "${record.title}" was dismissed. Show remains active in catalog.`,
    };
  },
});

/**
 * Check if a podcast title, RSS feed URL, or Apple ID is tombstoned.
 * Note: Only COMPLETED takedowns count as tombstoned! Pending HITL requests
 * do NOT block the show while under review.
 */
export const isPodcastTombstoned = query({
  args: {
    title: v.optional(v.string()),
    feedUrl: v.optional(v.string()),
    appleId: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    function isCompleted(item: { status?: string } | null): boolean {
      if (!item) return false;
      // If status is omitted (legacy record) or status === "completed", it is tombstoned
      return item.status === undefined || item.status === "completed";
    }

    if (args.feedUrl) {
      const cleanFeed = args.feedUrl.trim();
      const byFeed = await ctx.db
        .query("takedownRequests")
        .withIndex("by_feedUrl", (q) => q.eq("feedUrl", cleanFeed))
        .collect();
      if (byFeed.some(isCompleted)) return true;

      const byRss = await ctx.db
        .query("takedownRequests")
        .withIndex("by_rssUrl", (q) => q.eq("rssUrl", cleanFeed))
        .collect();
      if (byRss.some(isCompleted)) return true;
    }

    if (args.appleId) {
      const byApple = await ctx.db
        .query("takedownRequests")
        .withIndex("by_appleId", (q) => q.eq("appleId", args.appleId))
        .collect();
      if (byApple.some(isCompleted)) return true;
    }

    if (args.title) {
      const norm = normalizeTitle(args.title);
      const byTitle = await ctx.db
        .query("takedownRequests")
        .withIndex("by_normalizedTitle", (q) => q.eq("normalizedTitle", norm))
        .collect();
      if (byTitle.some(isCompleted)) return true;
    }

    return false;
  },
});

/**
 * List all takedowns for Admin inspection.
 */
export const listTakedowns = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("takedownRequests"),
      showId: v.optional(v.id("shows")),
      title: v.string(),
      feedUrl: v.optional(v.string()),
      appleId: v.optional(v.string()),
      requesterEmail: v.optional(v.string()),
      source: v.union(v.literal("email_inbox"), v.literal("web_modal"), v.literal("admin")),
      reason: v.optional(v.string()),
      status: v.string(),
      verifiedOnFile: v.boolean(),
      requesterProofNotes: v.optional(v.string()),
      createdAt: v.number(),
      resolvedAt: v.optional(v.number()),
      resolvedBy: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const list = await ctx.db.query("takedownRequests").order("desc").take(100);
    return list.map((item) => ({
      _id: item._id,
      showId: item.showId,
      title: item.title,
      feedUrl: item.feedUrl || item.rssUrl,
      appleId: item.appleId,
      requesterEmail: item.requesterEmail,
      source: item.source,
      reason: item.reason,
      status: item.status || "completed",
      verifiedOnFile: Boolean(item.verifiedOnFile),
      requesterProofNotes: item.requesterProofNotes,
      createdAt: item.createdAt,
      resolvedAt: item.resolvedAt,
      resolvedBy: item.resolvedBy,
    }));
  },
});
