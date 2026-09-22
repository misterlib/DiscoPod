import { v } from "convex/values";

import { internalQuery } from "./_generated/server";

export const getSnippetContext = internalQuery({
  args: {
    snippetIds: v.array(v.id("snippets")),
  },
  returns: v.array(
    v.object({
      snippetId: v.id("snippets"),
      showTitle: v.string(),
      episodeTitle: v.string(),
      audioUrl: v.string(),
      coverArtUrl: v.string(),
      ampScore: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const rows: Array<{
      snippetId: typeof args.snippetIds[number];
      showTitle: string;
      episodeTitle: string;
      audioUrl: string;
      coverArtUrl: string;
      ampScore?: number;
    }> = [];

    for (const snippetId of args.snippetIds) {
      const snippet = await ctx.db.get("snippets", snippetId);
      if (!snippet) {
        continue;
      }

      const show = await ctx.db.get("shows", snippet.showId);
      const episode = await ctx.db.get("episodes", snippet.episodeId);
      if (!show || !episode) {
        continue;
      }

      rows.push({
        snippetId,
        showTitle: show.title,
        episodeTitle: episode.title,
        audioUrl: episode.audioUrl,
        coverArtUrl: show.coverArtUrl,
        ampScore: show.ampScore,
      });
    }

    return rows;
  },
});
