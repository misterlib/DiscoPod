---
title: Milestone 4 - Listener semantic search contract
labels:
  - wayfinder:grilling
parent: DiscoPod All Gas Hackathon Map
status: closed
assignee: codex-5.3
blockedBy:
  - Milestone 2 - Schema, auth, and runtime contract
  - Milestone 3 - Map a Show pipeline contract
---

## Question

How should listener prompt embedding, Convex vector search filtering/ranking, and snippet playback response shape be defined to deliver fast, relevant, timestamped results while preserving type safety and future personalization options?

## Resolution (2026-08-26)

Close this decision with an action-driven semantic search contract:

- Public search entrypoint is an action (`searchSnippetsSemantic`) that accepts
  validated args:
  - `query: string`
  - `limit: number` (default 12, max 30)
  - `showId?: Id<"shows">`
  - `cursor?: string` (future pagination token)
  - `listenerContext?: { likedShowIds?: Id<"shows">[]; hiddenSnippetIds?: Id<"snippets">[] }`
- The action generates one query embedding via OpenAI
  `text-embedding-3-small` (1536), then executes Convex vector search against
  `snippets.by_embedding`.
- Filter strategy:
  - If `showId` exists, apply vector filter field on `showId`.
  - Otherwise search globally across snippets, with optional post-filtering for
    hidden snippets from listener context.
- Ranking strategy:
  1. Base vector similarity score from Convex vector search.
  2. Lightweight rerank boost from engagement (`upvotes`, `playCount`) and
     recency of parent episode.
  3. Diversity guardrail: cap repeated snippets from the same show in top N.
- Response contract (strict returns validator):
  - `results: Array<{ snippetId, showId, episodeId, showTitle, episodeTitle, hookText, transcriptExcerpt, startTime, endTime, audioUrl, coverArtUrl, similarityScore, ampScore }>`
  - `meta: { query, embeddingModel: "text-embedding-3-small", reranked: boolean, nextCursor?: string }`
- Determinism and safety:
  - No writes in search path; action orchestrates provider call + read-only
    query/mutation helpers for enrichment.
  - No raw transcript blobs returned; only excerpt text already stored on
    snippets.
- Personalization-ready extension point:
  - `listenerContext` remains optional now and can later feed user-profile
    boosts without changing primary API shape.

Status: closed (decision finalized, Milestone 5 is the remaining frontier ticket).
