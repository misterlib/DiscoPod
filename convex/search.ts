import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { internalQuery, query } from "./_generated/server";

const snippetCardValidator = v.object({
  snippetId: v.id("snippets"),
  showId: v.id("shows"),
  episodeId: v.id("episodes"),
  showTitle: v.string(),
  episodeTitle: v.string(),
  hookText: v.string(),
  transcriptExcerpt: v.string(),
  startTime: v.number(),
  endTime: v.number(),
  audioUrl: v.string(),
  coverArtUrl: v.string(),
  ampScore: v.optional(v.number()),
  playCount: v.number(),
  upvotes: v.number(),
});

export const searchSnippetsFeed = query({
  args: {
    query: v.string(),
    showId: v.optional(v.id("shows")),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(snippetCardValidator),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const paged = args.showId
      ? await ctx.db
          .query("snippets")
          .withIndex("by_showId", (q) => q.eq("showId", args.showId!))
          .paginate(args.paginationOpts)
      : await ctx.db.query("snippets").paginate(args.paginationOpts);

    const normalized = args.query.trim().toLowerCase();
    const filtered = normalized
      ? paged.page.filter(
          (snippet) =>
            snippet.hookText.toLowerCase().includes(normalized) ||
            snippet.transcriptExcerpt.toLowerCase().includes(normalized),
        )
      : paged.page;

    const page = [];
    for (const snippet of filtered) {
      const show = await ctx.db.get("shows", snippet.showId);
      const episode = await ctx.db.get("episodes", snippet.episodeId);
      if (!show || !episode) {
        continue;
      }
      page.push({
        snippetId: snippet._id,
        showId: snippet.showId,
        episodeId: snippet.episodeId,
        showTitle: show.title,
        episodeTitle: episode.title,
        hookText: snippet.hookText,
        transcriptExcerpt: snippet.transcriptExcerpt,
        startTime: snippet.startTime,
        endTime: snippet.endTime,
        audioUrl: episode.audioUrl,
        coverArtUrl: show.coverArtUrl,
        ampScore: show.ampScore ?? 0,
        playCount: snippet.playCount,
        upvotes: snippet.upvotes,
      });
    }

    return {
      continueCursor: paged.continueCursor,
      isDone: paged.isDone,
      page,
    };
  },
});

export const vectorSearchSnippets = internalQuery({
  args: {
    vectorEmbedding: v.array(v.float64()),
    showId: v.optional(v.id("shows")),
    limit: v.number(),
  },
  returns: v.array(
    v.object({
      snippetId: v.id("snippets"),
      score: v.number(),
      showId: v.id("shows"),
      episodeId: v.id("episodes"),
      hookText: v.string(),
      transcriptExcerpt: v.string(),
      startTime: v.number(),
      endTime: v.number(),
      playCount: v.number(),
      upvotes: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit, 30));
    const candidates = args.showId
      ? await ctx.db
          .query("snippets")
          .withIndex("by_showId", (q) => q.eq("showId", args.showId!))
          .take(limit * 3)
      : await ctx.db.query("snippets").take(limit * 3);

    return candidates
      .map((snippet) => ({
        snippetId: snippet._id,
        score:
          cosineSimilarity(args.vectorEmbedding, snippet.vectorEmbedding) +
          (snippet.upvotes * 2 + snippet.playCount) / 2000,
        showId: snippet.showId,
        episodeId: snippet.episodeId,
        hookText: snippet.hookText,
        transcriptExcerpt: snippet.transcriptExcerpt,
        startTime: snippet.startTime,
        endTime: snippet.endTime,
        playCount: snippet.playCount,
        upvotes: snippet.upvotes,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },
});

function cosineSimilarity(lhs: number[], rhs: number[]): number {
  if (lhs.length !== rhs.length || lhs.length === 0) {
    return 0;
  }

  let dot = 0;
  let lhsNorm = 0;
  let rhsNorm = 0;
  for (let index = 0; index < lhs.length; index += 1) {
    dot += lhs[index] * rhs[index];
    lhsNorm += lhs[index] * lhs[index];
    rhsNorm += rhs[index] * rhs[index];
  }

  if (lhsNorm === 0 || rhsNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(lhsNorm) * Math.sqrt(rhsNorm));
}
