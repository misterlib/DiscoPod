"use node";

import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

type RawSearchResult = {
  snippetId: Id<"snippets">;
  score: number;
  showId: Id<"shows">;
  episodeId: Id<"episodes">;
  hookText: string;
  transcriptExcerpt: string;
  startTime: number;
  endTime: number;
  playCount: number;
  upvotes: number;
};

type SnippetContext = {
  snippetId: Id<"snippets">;
  showTitle: string;
  episodeTitle: string;
  audioUrl: string;
  coverArtUrl: string;
  ampScore?: number;
};

export const searchSnippetsSemantic = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    showId: v.optional(v.id("shows")),
    cursor: v.optional(v.string()),
    listenerContext: v.optional(
      v.object({
        likedShowIds: v.optional(v.array(v.id("shows"))),
        hiddenSnippetIds: v.optional(v.array(v.id("snippets"))),
      }),
    ),
  },
  returns: v.object({
    results: v.array(
      v.object({
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
        similarityScore: v.number(),
        ampScore: v.optional(v.number()),
      }),
    ),
    meta: v.object({
      query: v.string(),
      embeddingModel: v.literal("text-embedding-3-small"),
      reranked: v.boolean(),
      nextCursor: v.optional(v.string()),
    }),
  }),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 12, 30));
    const embedding = await embedPrompt(args.query);
    const rawResults: RawSearchResult[] = await ctx.runQuery(
      internal.search.vectorSearchSnippets,
      {
        vectorEmbedding: embedding,
        showId: args.showId,
        limit,
      },
    );
    const hiddenSnippetIds = new Set(args.listenerContext?.hiddenSnippetIds ?? []);
    const visibleResults = rawResults.filter(
      (result) => !hiddenSnippetIds.has(result.snippetId),
    );

    const contextRows: SnippetContext[] = await ctx.runQuery(
      internal.searchMetadata.getSnippetContext,
      {
        snippetIds: visibleResults.map((result) => result.snippetId),
      },
    );
    const contextMap = new Map(contextRows.map((row) => [row.snippetId, row]));

    const reranked = visibleResults
      .map((result) => {
        const context = contextMap.get(result.snippetId);
        if (!context) {
          return null;
        }

        const engagementBoost = (result.upvotes * 2 + result.playCount) / 1000;
        return {
          snippetId: result.snippetId,
          showId: result.showId,
          episodeId: result.episodeId,
          showTitle: context.showTitle,
          episodeTitle: context.episodeTitle,
          hookText: result.hookText,
          transcriptExcerpt: result.transcriptExcerpt,
          startTime: result.startTime,
          endTime: result.endTime,
          audioUrl: context.audioUrl,
          coverArtUrl: context.coverArtUrl,
          similarityScore: result.score,
          ampScore: (context.ampScore ?? 0) + engagementBoost,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit);

    return {
      results: reranked,
      meta: {
        query: args.query,
        embeddingModel: "text-embedding-3-small" as const,
        reranked: true,
        nextCursor: args.cursor,
      },
    };
  },
});

async function embedPrompt(input: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for semantic search.");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embedding request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const embedding = payload.data?.[0]?.embedding;
  if (!embedding || embedding.length !== 1536) {
    throw new Error("OpenAI embedding response was missing a 1536-dim vector.");
  }

  return embedding;
}
