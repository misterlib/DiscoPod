import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { action, internalAction, internalMutation, mutation, query } from "./_generated/server";
import { sendShowClaimEmail } from "./lib/emailDispatcher";

/**
 * Record a listener event (recommendation view, audio listen, skip, like, or channel clickout).
 */
export const recordListenerEvent = mutation({
  args: {
    showId: v.id("shows"),
    snippetId: v.optional(v.id("snippets")),
    eventType: v.union(
      v.literal("recommendation_view"),
      v.literal("listen"),
      v.literal("skip"),
      v.literal("channel_click"),
      v.literal("like"),
    ),
    channelName: v.optional(v.string()),
    listenDurationSeconds: v.optional(v.number()),
    source: v.union(
      v.literal("deck"),
      v.literal("modal"),
      v.literal("reel_player"),
      v.literal("globe"),
      v.literal("search"),
    ),
  },
  returns: v.object({
    eventId: v.id("listenerEvents"),
    tractionTriggered: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const eventId = await ctx.db.insert("listenerEvents", {
      showId: args.showId,
      snippetId: args.snippetId,
      eventType: args.eventType,
      channelName: args.channelName,
      listenDurationSeconds: args.listenDurationSeconds,
      source: args.source,
      timestamp: Date.now(),
    });

    // Increment playCount on snippet if it's an audio listen
    if (args.eventType === "listen" && args.snippetId) {
      const snippet = await ctx.db.get("snippets", args.snippetId);
      if (snippet) {
        await ctx.db.patch("snippets", snippet._id, {
          playCount: (snippet.playCount ?? 0) + 1,
        });
      }
    }

    // Check if traction milestone has been hit (e.g. >= 3 listens OR >= 1 channel click)
    let tractionTriggered = false;
    let claim = await ctx.db
      .query("territoryClaims")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .first();

    const show = await ctx.db.get("shows", args.showId);

    // If no claim exists yet, auto-create a pending claim so traction milestones work
    if (!claim && show) {
      const claimToken = `claim_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const claimId = await ctx.db.insert("territoryClaims", {
        showId: args.showId,
        inboxThreadId: "",
        claimStatus: "pending",
        token: claimToken,
      });
      claim = await ctx.db.get("territoryClaims", claimId);
    }

    if (claim && !claim.tractionNotifiedAt && show) {
      // Count total listens
      const listens = await ctx.db
        .query("listenerEvents")
        .withIndex("by_showId_and_eventType", (q) =>
          q.eq("showId", args.showId).eq("eventType", "listen"),
        )
        .take(10);

      // Count total channel clickouts
      const clicks = await ctx.db
        .query("listenerEvents")
        .withIndex("by_showId_and_eventType", (q) =>
          q.eq("showId", args.showId).eq("eventType", "channel_click"),
        )
        .take(10);

      // Milestone threshold: at least 3 audio listens or at least 1 external channel click
      if (listens.length >= 3 || clicks.length >= 1) {
        // Enforce Single-Contact Rule: check if this host email already has an outreach awaiting reply
        const hostEmail = show.hostEmail?.trim();
        if (hostEmail && !hostEmail.includes("creator-unlisted@")) {
          const cleanEmail = hostEmail.toLowerCase();
          const existingOutreach = await ctx.db
            .query("hostOutreachLog")
            .withIndex("by_email", (q) => q.eq("email", cleanEmail))
            .first();

          if (existingOutreach && !existingOutreach.hasReceivedReply) {
            console.log(
              `[recordListenerEvent] Refraining from scheduling traction outreach to ${cleanEmail}: Host already emailed and has not replied yet.`,
            );
            return { eventId, tractionTriggered: false };
          }
        }

        tractionTriggered = true;
        await ctx.db.patch("territoryClaims", claim._id, {
          tractionNotifiedAt: Date.now(),
          notifiedListenCount: listens.length,
          notifiedClickCount: clicks.length,
        });

        // Schedule asynchronous email delivery
        await ctx.scheduler.runAfter(0, internal.analytics.dispatchTractionNotification, {
          showId: args.showId,
          listensCount: listens.length,
          clicksCount: clicks.length,
          topChannel: args.channelName || "podcast feed",
        });
      }
    }

    return { eventId, tractionTriggered };
  },
});

/**
 * Query aggregated analytics for a show to evaluate clip performance and listener conversion.
 */
export const getShowAnalytics = query({
  args: {
    showId: v.id("shows"),
  },
  returns: v.object({
    totalViews: v.number(),
    totalListens: v.number(),
    totalSkips: v.number(),
    totalLikes: v.number(),
    totalChannelClicks: v.number(),
    channelBreakdown: v.record(v.string(), v.number()),
    tractionNotifiedAt: v.optional(v.number()),
    conversionRate: v.number(), // channelClicks / max(1, listens)
    snippetPerformance: v.array(
      v.object({
        snippetId: v.id("snippets"),
        hookText: v.string(),
        listens: v.number(),
        channelClicks: v.number(),
        skips: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("listenerEvents")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .collect();

    const snippets = await ctx.db
      .query("snippets")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .collect();

    const claim = await ctx.db
      .query("territoryClaims")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .first();

    let totalViews = 0;
    let totalListens = 0;
    let totalSkips = 0;
    let totalLikes = 0;
    let totalChannelClicks = 0;
    const channelBreakdown: Record<string, number> = {};

    const snippetStatsMap = new Map<
      string,
      { listens: number; skips: number; clicks: number }
    >();

    for (const snip of snippets) {
      snippetStatsMap.set(snip._id, { listens: 0, skips: 0, clicks: 0 });
    }

    for (const ev of events) {
      if (ev.eventType === "recommendation_view") totalViews++;
      if (ev.eventType === "listen") {
        totalListens++;
        if (ev.snippetId && snippetStatsMap.has(ev.snippetId)) {
          snippetStatsMap.get(ev.snippetId)!.listens++;
        }
      }
      if (ev.eventType === "skip") {
        totalSkips++;
        if (ev.snippetId && snippetStatsMap.has(ev.snippetId)) {
          snippetStatsMap.get(ev.snippetId)!.skips++;
        }
      }
      if (ev.eventType === "like") totalLikes++;
      if (ev.eventType === "channel_click") {
        totalChannelClicks++;
        const ch = ev.channelName || "other";
        channelBreakdown[ch] = (channelBreakdown[ch] ?? 0) + 1;
        if (ev.snippetId && snippetStatsMap.has(ev.snippetId)) {
          snippetStatsMap.get(ev.snippetId)!.clicks++;
        }
      }
    }

    const conversionRate =
      totalListens > 0 ? Number(((totalChannelClicks / totalListens) * 100).toFixed(1)) : 0;

    const snippetPerformance = snippets.map((s) => {
      const stats = snippetStatsMap.get(s._id) ?? { listens: 0, skips: 0, clicks: 0 };
      return {
        snippetId: s._id,
        hookText: s.hookText,
        listens: stats.listens,
        channelClicks: stats.clicks,
        skips: stats.skips,
      };
    });

    return {
      totalViews,
      totalListens,
      totalSkips,
      totalLikes,
      totalChannelClicks,
      channelBreakdown,
      tractionNotifiedAt: claim?.tractionNotifiedAt,
      conversionRate,
      snippetPerformance,
    };
  },
});

/**
 * Dispatch the traction notification milestone email to the show host (or test override address).
 */
export const dispatchTractionNotification = internalAction({
  args: {
    showId: v.id("shows"),
    listensCount: v.number(),
    clicksCount: v.number(),
    topChannel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const claim: {
      token: string;
      inboxThreadId: string;
      showTitle: string;
      hostEmail?: string;
    } | null = await ctx.runMutation(internal.analytics.getClaimForTractionDispatch, {
      showId: args.showId,
    });

    if (!claim) {
      console.warn(
        `[dispatchTractionNotification] No claim for show ${args.showId}. Skipping.`,
      );
      return;
    }

    const hostEmail = claim.hostEmail?.trim() || "creator-unlisted@discopod.app";

    const dispatch = await sendShowClaimEmail(ctx, {
      showId: args.showId,
      showTitle: claim.showTitle,
      actualScrapedEmail: hostEmail,
      token: claim.token,
      reelUrl: `https://agreeable-pika-776.convex.site/reel/${args.showId}`,
      subject: `${claim.showTitle} is getting noticed on DiscoPod`,
      headline: `${claim.showTitle} is getting noticed on DiscoPod!`,
      tractionStats: {
        listens: args.listensCount,
        channelClicks: args.clicksCount,
        topChannel: args.topChannel,
      },
    });

    await ctx.runMutation(internal.analytics.updateClaimInboxThread, {
      showId: args.showId,
      token: claim.token,
      inboxThreadId: dispatch.inboxThreadId,
    });
  },
});

/**
 * Helper mutation to get claim and show information for traction notification.
 */
export const getClaimForTractionDispatch = internalMutation({
  args: { showId: v.id("shows") },
  handler: async (ctx, args) => {
    const show = await ctx.db.get("shows", args.showId);
    if (!show) return null;
    let claim = await ctx.db
      .query("territoryClaims")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .first();

    if (!claim && show) {
      const claimToken = `claim_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const claimId = await ctx.db.insert("territoryClaims", {
        showId: args.showId,
        inboxThreadId: "",
        claimStatus: "pending",
        token: claimToken,
      });
      claim = await ctx.db.get("territoryClaims", claimId);
    }

    if (!claim) return null;
    return {
      token: claim.token,
      inboxThreadId: claim.inboxThreadId,
      showTitle: show.title,
      hostEmail: show.hostEmail?.trim() || "creator-unlisted@discopod.app",
    };
  },
});

/**
 * Helper mutation to update thread ID after email dispatch.
 */
export const updateClaimInboxThread = internalMutation({
  args: {
    showId: v.id("shows"),
    token: v.string(),
    inboxThreadId: v.string(),
  },
  handler: async (ctx, args) => {
    const claim = await ctx.db
      .query("territoryClaims")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .first();
    if (claim) {
      await ctx.db.patch("territoryClaims", claim._id, {
        inboxThreadId: args.inboxThreadId,
      });
    }
  },
});

/**
 * Public action for Admin UI to trigger or test a traction notification email on demand.
 */
export const triggerManualTractionNotification = action({
  args: {
    showId: v.id("shows"),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    inboxThreadId: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; message: string; inboxThreadId: string }> => {
    const stats: any = await ctx.runQuery(api.analytics.getShowAnalytics, {
      showId: args.showId,
    });

    const claim: {
      token: string;
      inboxThreadId: string;
      showTitle: string;
      hostEmail?: string;
    } | null = await ctx.runMutation(internal.analytics.getClaimForTractionDispatch, {
      showId: args.showId,
    });

    if (!claim) {
      return {
        success: false,
        message: "No show claim record found for this show.",
        inboxThreadId: "none",
      };
    }

    const hostEmail: string = claim.hostEmail?.trim() || "creator-unlisted@discopod.app";

    const topChannel = Object.keys(stats.channelBreakdown)[0] || "podcast website";

    const dispatch = await sendShowClaimEmail(ctx, {
      showId: args.showId,
      showTitle: claim.showTitle,
      actualScrapedEmail: hostEmail,
      token: claim.token,
      reelUrl: `https://agreeable-pika-776.convex.site/reel/${args.showId}`,
      subject: `${claim.showTitle} is getting noticed on DiscoPod`,
      headline: `${claim.showTitle} is getting noticed on DiscoPod!`,
      tractionStats: {
        listens: Math.max(1, stats.totalListens),
        channelClicks: Math.max(1, stats.totalChannelClicks),
        topChannel,
      },
    });

    if (dispatch.inboxThreadId.startsWith("blocked_duplicate")) {
      return {
        success: false,
        message: `Single-Contact Rule Guard: Host (${hostEmail}) was already emailed and has not replied yet. Duplicate messaging is blocked.`,
        inboxThreadId: dispatch.inboxThreadId,
      };
    }

    await ctx.runMutation(internal.analytics.updateClaimInboxThread, {
      showId: args.showId,
      token: claim.token,
      inboxThreadId: dispatch.inboxThreadId,
    });

    return {
      success: true,
      message: `Traction notification successfully dispatched to ${dispatch.recipient}!`,
      inboxThreadId: dispatch.inboxThreadId,
    };
  },
});
