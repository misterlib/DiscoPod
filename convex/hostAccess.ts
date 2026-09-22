import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Mask an email address for public presentation (e.g. "info@podcastmail.com" -> "in***********ail.com").
 * Preserves the first 2 characters of the username and the last 3 characters of the domain name + extension.
 */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes("@")) return "in***********ail.com";
  const [user, domain] = trimmed.split("@");
  const first2 = user.length >= 2 ? user.slice(0, 2) : user.padEnd(2, "*");
  const domainParts = (domain || "").split(".");
  const tld = domainParts.length > 1 ? domainParts[domainParts.length - 1] : "com";
  const domainName = domainParts[0] || "mail";
  const domainSuffix = domainName.length >= 3 ? domainName.slice(-3) : domainName.padStart(3, "*");
  return `${first2}***********${domainSuffix}.${tld}`;
}

/**
 * Query: search ingested podcasts for host claim flow.
 * Filters out tombstoned shows, searches title, hostName, and masks any email on file.
 */
export const searchShowsForHostAccess = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      showId: v.id("shows"),
      title: v.string(),
      hostName: v.string(),
      coverArtUrl: v.string(),
      description: v.string(),
      maskedHostEmail: v.optional(v.string()),
      hasHostEmail: v.boolean(),
      isClaimed: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const rawQuery = args.query.trim().toLowerCase();
    if (!rawQuery) return [];
    const max = args.limit || 8;

    const shows = await ctx.db.query("shows").take(150);
    const results = [];

    for (const show of shows) {
      if (show.isTakenDown) continue;

      const titleMatch = show.title.toLowerCase().includes(rawQuery);
      const slugMatch = show.slug.toLowerCase().includes(rawQuery);
      const hostMatch = show.hostName ? show.hostName.toLowerCase().includes(rawQuery) : false;

      if (titleMatch || slugMatch || hostMatch) {
        const hasHostEmail = Boolean(show.hostEmail && show.hostEmail.trim().length > 0);
        const maskedHostEmail = hasHostEmail ? maskEmail(show.hostEmail!) : undefined;

        results.push({
          showId: show._id,
          title: show.title,
          hostName: show.hostName || "Host not identified",
          coverArtUrl: show.coverArtUrl,
          description: show.description,
          maskedHostEmail,
          hasHostEmail,
          isClaimed: Boolean(show.isClaimed),
        });

        if (results.length >= max) break;
      }
    }

    return results;
  },
});

/**
 * Query: get access preview for a specific show by ID.
 */
export const getShowAccessPreview = query({
  args: {
    showId: v.id("shows"),
  },
  returns: v.union(
    v.null(),
    v.object({
      showId: v.id("shows"),
      title: v.string(),
      hostName: v.optional(v.string()),
      coverArtUrl: v.string(),
      description: v.string(),
      maskedHostEmail: v.optional(v.string()),
      hasHostEmail: v.boolean(),
      isClaimed: v.boolean(),
      claimStatus: v.optional(
        v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected")),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const show = await ctx.db.get("shows", args.showId);
    if (!show || show.isTakenDown) return null;

    const claim = await ctx.db
      .query("territoryClaims")
      .withIndex("by_showId", (q) => q.eq("showId", show._id))
      .first();

    const hasHostEmail = Boolean(show.hostEmail && show.hostEmail.trim().length > 0);
    const maskedHostEmail = hasHostEmail ? maskEmail(show.hostEmail!) : undefined;

    return {
      showId: show._id,
      title: show.title,
      hostName: show.hostName,
      coverArtUrl: show.coverArtUrl,
      description: show.description,
      maskedHostEmail,
      hasHostEmail,
      isClaimed: Boolean(show.isClaimed),
      claimStatus: claim ? claim.claimStatus : undefined,
    };
  },
});

/**
 * Query: get claim and access request status for a show.
 */
export const getAccessRequestStatus = query({
  args: {
    showId: v.id("shows"),
  },
  returns: v.object({
    claimStatus: v.optional(
      v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected")),
    ),
    isClaimed: v.boolean(),
    claimToken: v.optional(v.string()),
    status: v.string(),
  }),
  handler: async (ctx, args) => {
    const show = await ctx.db.get("shows", args.showId);
    if (!show || show.isTakenDown) {
      return {
        isClaimed: false,
        status: "not_found",
      };
    }

    const claim = await ctx.db
      .query("territoryClaims")
      .withIndex("by_showId", (q) => q.eq("showId", show._id))
      .first();

    const latestReq = await ctx.db
      .query("hostAccessRequests")
      .withIndex("by_showId", (q) => q.eq("showId", show._id))
      .order("desc")
      .first();

    return {
      claimStatus: claim ? claim.claimStatus : undefined,
      isClaimed: Boolean(show.isClaimed),
      claimToken: claim ? claim.token : undefined,
      status: latestReq ? latestReq.status : claim?.claimStatus || "unclaimed",
    };
  },
});

/**
 * Internal mutation: prepare an on-file access request.
 */
export const prepareOnFileAccessRequest = internalMutation({
  args: {
    showId: v.id("shows"),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    claimStatus: v.optional(
      v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected")),
    ),
    maskedEmail: v.optional(v.string()),
    requestId: v.optional(v.id("hostAccessRequests")),
    hostEmail: v.optional(v.string()),
    showTitle: v.optional(v.string()),
    token: v.optional(v.string()),
    claimId: v.optional(v.id("territoryClaims")),
  }),
  handler: async (ctx, args) => {
    const show = await ctx.db.get("shows", args.showId);
    if (!show) {
      return { success: false, message: "Show not found." };
    }
    if (show.isTakenDown) {
      return { success: false, message: "Show is currently taken down." };
    }

    if (show.isClaimed) {
      return {
        success: true,
        message: "This show is already claimed.",
        claimStatus: "verified" as const,
        maskedEmail: show.hostEmail ? maskEmail(show.hostEmail) : undefined,
      };
    }

    if (!show.hostEmail || !show.hostEmail.trim()) {
      return {
        success: false,
        message: "No host email is on file for this show. Please use the alternate-email option.",
      };
    }

    let claim = await ctx.db
      .query("territoryClaims")
      .withIndex("by_showId", (q) => q.eq("showId", show._id))
      .first();

    if (!claim) {
      const token = `claim_tok_${Math.random().toString(36).slice(2, 10)}`;
      const claimId = await ctx.db.insert("territoryClaims", {
        showId: show._id,
        inboxThreadId: `thread_${Date.now()}`,
        claimStatus: "pending",
        token,
      });
      claim = (await ctx.db.get("territoryClaims", claimId))!;
    }

    const masked = maskEmail(show.hostEmail);
    const reqId = await ctx.db.insert("hostAccessRequests", {
      showId: show._id,
      requestType: "on_file_email",
      status: "pending",
      onFileEmail: show.hostEmail,
      alternateEmail: show.hostEmail,
      claimId: claim._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      success: true,
      message: "Prepared verification email.",
      claimStatus: claim.claimStatus,
      maskedEmail: masked,
      requestId: reqId,
      hostEmail: show.hostEmail,
      showTitle: show.title,
      token: claim.token,
      claimId: claim._id,
    };
  },
});

/**
 * Internal mutation: record verification email dispatched.
 */
export const recordVerificationEmailSent = internalMutation({
  args: {
    requestId: v.id("hostAccessRequests"),
    claimId: v.id("territoryClaims"),
    inboxThreadId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("territoryClaims", args.claimId, {
      inboxThreadId: args.inboxThreadId,
    });
    await ctx.db.patch("hostAccessRequests", args.requestId, {
      status: "verification_sent",
      inboxThreadId: args.inboxThreadId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Internal mutation: prepare an alternate email verification request.
 */
export const prepareAlternateEmailRequest = internalMutation({
  args: {
    showId: v.id("shows"),
    alternateEmail: v.string(),
    note: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    showTitle: v.optional(v.string()),
    onFileEmail: v.optional(v.string()),
    requestId: v.optional(v.id("hostAccessRequests")),
  }),
  handler: async (ctx, args) => {
    const show = await ctx.db.get("shows", args.showId);
    if (!show) {
      return { success: false, message: "Show not found." };
    }
    if (show.isTakenDown) {
      return { success: false, message: "Show is currently taken down." };
    }

    const cleanEmail = args.alternateEmail.trim().toLowerCase();
    const reqId = await ctx.db.insert("hostAccessRequests", {
      showId: show._id,
      requestType: "alternate_email_hitl",
      status: "escalated",
      onFileEmail: show.hostEmail,
      alternateEmail: cleanEmail,
      requesterNote: args.note?.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      success: true,
      message: "Alternate email request recorded.",
      showTitle: show.title,
      onFileEmail: show.hostEmail,
      requestId: reqId,
    };
  },
});

/**
 * Query: list access requests for the Admin UI.
 */
export const listAccessRequests = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("hostAccessRequests"),
      showId: v.id("shows"),
      showTitle: v.string(),
      requestType: v.string(),
      status: v.string(),
      onFileEmail: v.optional(v.string()),
      alternateEmail: v.optional(v.string()),
      requesterNote: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const reqs = await ctx.db.query("hostAccessRequests").order("desc").take(50);
    const enriched = [];
    for (const r of reqs) {
      const show = await ctx.db.get("shows", r.showId);
      enriched.push({
        _id: r._id,
        showId: r.showId,
        showTitle: show?.title || "Unknown Show",
        requestType: r.requestType,
        status: r.status,
        onFileEmail: r.onFileEmail,
        alternateEmail: r.alternateEmail,
        requesterNote: r.requesterNote,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      });
    }
    return enriched;
  },
});

/**
 * Mutation: resolve an access request manually from the Admin portal or via automated email.
 */
export const resolveAccessRequest = mutation({
  args: {
    requestId: v.id("hostAccessRequests"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    resolutionNotes: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    token: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const request = await ctx.db.get("hostAccessRequests", args.requestId);
    if (!request) {
      return { success: false, message: "Request not found." };
    }

    const show = await ctx.db.get("shows", request.showId);
    const showTitle = show?.title || "Podcast";

    if (args.decision === "reject") {
      await ctx.db.patch("hostAccessRequests", request._id, {
        status: "rejected",
        updatedAt: Date.now(),
      });
      return { success: true, message: `Access request for "${showTitle}" rejected.` };
    }

    if (!show) {
      return { success: false, message: "Associated show not found." };
    }

    const targetEmail = request.alternateEmail || request.onFileEmail;
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
      await ctx.db.patch("territoryClaims", claim._id, {
        claimStatus: "verified",
      });
    } else {
      token = `claim_tok_${Math.random().toString(36).slice(2, 10)}`;
      await ctx.db.insert("territoryClaims", {
        showId: show._id,
        inboxThreadId: `approved_claim_${Date.now()}`,
        claimStatus: "verified",
        token,
      });
    }

    await ctx.db.patch("hostAccessRequests", request._id, {
      status: "approved",
      updatedAt: Date.now(),
    });

    return {
      success: true,
      message: `Access approved for "${showTitle}"! Host email updated to ${targetEmail}.`,
      token,
    };
  },
});
