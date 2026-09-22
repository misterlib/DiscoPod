import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

export const getShowByClaimToken = query({
  args: {
    token: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      show: v.object({
        showId: v.id("shows"),
        title: v.string(),
        slug: v.string(),
        description: v.string(),
        rssUrl: v.string(),
        websiteUrl: v.optional(v.string()),
        coverArtUrl: v.string(),
        hostName: v.optional(v.string()),
        hostEmail: v.optional(v.string()),
        isClaimed: v.boolean(),
        isAmped: v.optional(v.boolean()),
        ampScore: v.optional(v.number()),
        coordinates: v.object({ x: v.number(), y: v.number(), z: v.number() }),
      }),
      claim: v.object({
        claimId: v.id("territoryClaims"),
        claimStatus: v.union(
          v.literal("pending"),
          v.literal("verified"),
          v.literal("rejected"),
        ),
        token: v.string(),
      }),
      snippets: v.array(
        v.object({
          snippetId: v.id("snippets"),
          episodeId: v.id("episodes"),
          episodeTitle: v.string(),
          audioUrl: v.string(),
          startTime: v.number(),
          endTime: v.number(),
          duration: v.number(),
          hookText: v.string(),
          transcriptExcerpt: v.string(),
          whyYouWillLikeIt: v.string(),
          playCount: v.number(),
          upvotes: v.number(),
        }),
      ),
      episodes: v.array(
        v.object({
          episodeId: v.id("episodes"),
          title: v.string(),
          audioUrl: v.string(),
          pubDate: v.number(),
          durationSeconds: v.number(),
          summary: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const trimmed = args.token.trim();
    if (!trimmed) return null;

    const claim = await ctx.db
      .query("territoryClaims")
      .withIndex("by_token", (q) => q.eq("token", trimmed))
      .first();
    if (!claim) return null;

    const show = await ctx.db.get("shows", claim.showId);
    if (!show) return null;

    const episodes = await ctx.db
      .query("episodes")
      .withIndex("by_showId", (q) => q.eq("showId", show._id))
      .take(10);
    const epMap = new Map(episodes.map((e) => [e._id, e]));

    const snippets = await ctx.db
      .query("snippets")
      .withIndex("by_showId", (q) => q.eq("showId", show._id))
      .take(10);

    const enrichedSnippets = snippets.map((s) => {
      const ep = epMap.get(s.episodeId);
      const rawExcerpt = s.transcriptExcerpt || "";
      const whyMatch = rawExcerpt.match(
        /\[Why you'll love it\]:\s*([\s\S]*?)(?=\n\n\[Excerpt\]|$)/i,
      );
      const excerptMatch = rawExcerpt.match(/\[Excerpt\]:\s*([\s\S]*?)$/i);
      return {
        snippetId: s._id,
        episodeId: s.episodeId,
        episodeTitle: ep?.title || "Episode Highlight",
        audioUrl: ep?.audioUrl || "",
        startTime: s.startTime,
        endTime: s.endTime,
        duration: Math.max(1, s.endTime - s.startTime),
        hookText: s.hookText,
        transcriptExcerpt: excerptMatch ? excerptMatch[1].trim() : rawExcerpt,
        whyYouWillLikeIt:
          s.whyYouWillLikeIt ||
          (whyMatch ? whyMatch[1].trim() : "High-engagement podcast highlight."),
        playCount: s.playCount,
        upvotes: s.upvotes,
      };
    });

    return {
      show: {
        showId: show._id,
        title: show.title,
        slug: show.slug,
        description: show.description,
        rssUrl: show.rssUrl,
        websiteUrl: show.websiteUrl,
        coverArtUrl: show.coverArtUrl,
        hostName: show.hostName,
        hostEmail: show.hostEmail,
        isClaimed: show.isClaimed,
        isAmped: show.isAmped,
        ampScore: show.ampScore,
        coordinates: show.coordinates,
      },
      claim: {
        claimId: claim._id,
        claimStatus: claim.claimStatus,
        token: claim.token,
      },
      snippets: enrichedSnippets,
      episodes: episodes.map((e) => ({
        episodeId: e._id,
        title: e.title,
        audioUrl: e.audioUrl,
        pubDate: e.pubDate,
        durationSeconds: e.durationSeconds,
        summary: e.summary,
      })),
    };
  },
});

export const claimShowByToken = mutation({
  args: {
    token: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    showId: v.optional(v.id("shows")),
  }),
  handler: async (ctx, args) => {
    const trimmed = args.token.trim();
    if (!trimmed) {
      return {
        success: false,
        message: "Please enter a valid claim code.",
      };
    }

    const claim = await ctx.db
      .query("territoryClaims")
      .withIndex("by_token", (q) => q.eq("token", trimmed))
      .first();

    if (!claim) {
      return {
        success: false,
        message: "Invalid claim code. Please check the code emailed to you.",
      };
    }

    if (claim.claimStatus === "rejected") {
      return {
        success: false,
        message: "This claim was previously marked as rejected. Please contact support.",
      };
    }

    await ctx.db.patch("territoryClaims", claim._id, {
      claimStatus: "verified",
    });
    await ctx.db.patch("shows", claim.showId, {
      isClaimed: true,
    });

    return {
      success: true,
      message: "Show successfully claimed and verified!",
      showId: claim.showId,
    };
  },
});

export const claimShowAsCreator = mutation({
  args: {
    showId: v.id("shows"),
    token: v.string(),
  },
  returns: v.object({
    status: v.union(
      v.literal("verified"),
      v.literal("rejected"),
      v.literal("pending"),
    ),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const claim = await ctx.db
      .query("territoryClaims")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .unique();
    if (!claim || claim.token !== args.token) {
      throw new Error("Invalid claim token");
    }

    await ctx.db.patch("territoryClaims", claim._id, { claimStatus: "verified" });
    await ctx.db.patch("shows", args.showId, {
      isClaimed: true,
      claimedByUserId: identity.subject,
    });
    return { status: "verified" as const };
  },
});

export const processInboundClaimCommand = internalMutation({
  args: {
    inboxThreadId: v.string(),
    token: v.string(),
    command: v.union(
      v.literal("verify"),
      v.literal("claim"),
      v.literal("reject"),
      v.literal("change_snippet"),
      v.literal("unknown"),
    ),
  },
  returns: v.object({
    outcome: v.string(),
  }),
  handler: async (ctx, args) => {
    const claim = await ctx.db
      .query("territoryClaims")
      .withIndex("by_thread_and_token", (q) =>
        q.eq("inboxThreadId", args.inboxThreadId).eq("token", args.token),
      )
      .unique();
    if (!claim) {
      return { outcome: "claim_not_found" };
    }

    if (args.command === "reject") {
      await ctx.db.patch("territoryClaims", claim._id, {
        claimStatus: "rejected",
      });
      return { outcome: "claim_rejected" };
    }

    if (args.command === "verify" || args.command === "claim") {
      const show = await ctx.db.get("shows", claim.showId);
      if (!show) {
        return { outcome: "show_not_found" };
      }
      await ctx.db.patch("territoryClaims", claim._id, {
        claimStatus: "verified",
      });
      await ctx.db.patch("shows", show._id, {
        isClaimed: true,
      });
      return { outcome: "claim_verified" };
    }

    if (args.command === "change_snippet") {
      return { outcome: "snippet_change_queued" };
    }

    return { outcome: "unknown_command" };
  },
});

export const updateClaimToken = mutation({
  args: {
    currentToken: v.string(),
    newToken: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    token: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const currentTrimmed = args.currentToken.trim();
    const newTrimmed = args.newToken.trim();

    if (!currentTrimmed) {
      return { success: false, message: "Current code is required." };
    }
    if (!newTrimmed || newTrimmed.length < 3) {
      return { success: false, message: "New code must be at least 3 characters long." };
    }
    if (!/^[a-zA-Z0-9_\-]+$/.test(newTrimmed)) {
      return {
        success: false,
        message: "New code can only contain letters, numbers, hyphens, and underscores.",
      };
    }

    const claim = await ctx.db
      .query("territoryClaims")
      .withIndex("by_token", (q) => q.eq("token", currentTrimmed))
      .first();

    if (!claim) {
      return { success: false, message: "Invalid current access code." };
    }

    const existingWithNew = await ctx.db
      .query("territoryClaims")
      .withIndex("by_token", (q) => q.eq("token", newTrimmed))
      .first();

    if (existingWithNew && existingWithNew._id !== claim._id) {
      return {
        success: false,
        message: "That access code is already in use. Please choose another one.",
      };
    }

    await ctx.db.patch("territoryClaims", claim._id, {
      token: newTrimmed,
    });

    return {
      success: true,
      message: "Access code updated! Use this new code next time you manage your show.",
      token: newTrimmed,
    };
  },
});

export const updateShowHook = mutation({
  args: {
    token: v.string(),
    hookText: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const trimmedToken = args.token.trim();
    const trimmedHook = args.hookText.trim();
    if (!trimmedHook) {
      return { success: false, message: "Narrative hook quote cannot be empty." };
    }

    const claim = await ctx.db
      .query("territoryClaims")
      .withIndex("by_token", (q) => q.eq("token", trimmedToken))
      .first();

    if (!claim) {
      return { success: false, message: "Unauthorized. Invalid access code." };
    }

    const snippet = await ctx.db
      .query("snippets")
      .withIndex("by_showId", (q) => q.eq("showId", claim.showId))
      .first();

    if (snippet) {
      await ctx.db.patch("snippets", snippet._id, {
        hookText: trimmedHook,
      });
      return { success: true, message: "Featured quote updated successfully!" };
    }

    return { success: false, message: "No audio highlight found to update." };
  },
});

export const reSliceShowClip = mutation({
  args: {
    token: v.string(),
    startTime: v.number(),
    durationSeconds: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const trimmedToken = args.token.trim();
    const claim = await ctx.db
      .query("territoryClaims")
      .withIndex("by_token", (q) => q.eq("token", trimmedToken))
      .first();

    if (!claim) {
      return { success: false, message: "Unauthorized. Invalid access code." };
    }

    const duration = args.durationSeconds ?? 45;
    const start = Math.max(0, Math.floor(args.startTime));
    const end = start + duration;

    const snippet = await ctx.db
      .query("snippets")
      .withIndex("by_showId", (q) => q.eq("showId", claim.showId))
      .first();

    if (snippet) {
      await ctx.db.patch("snippets", snippet._id, {
        startTime: start,
        endTime: end,
      });
      const mins = Math.floor(start / 60);
      const secs = (start % 60).toString().padStart(2, "0");
      return {
        success: true,
        message: `45-second preview reel updated to start at ${mins}:${secs}!`,
        startTime: start,
        endTime: end,
      };
    }

    return { success: false, message: "No audio highlight found to update." };
  },
});
