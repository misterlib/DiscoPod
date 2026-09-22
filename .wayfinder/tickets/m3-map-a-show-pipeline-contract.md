---
title: Milestone 3 - Map a Show pipeline contract
labels:
  - wayfinder:prototype
parent: DiscoPod All Gas Hackathon Map
status: closed
assignee: codex-5.3
blockedBy:
  - Milestone 2 - Schema, auth, and runtime contract
---

## Question

What is the end-to-end contract for the "Map a Show" ingestion action (input normalization, Firecrawl extraction shape, OpenAI hook extraction and embedding flow, insert ordering, retries, idempotency, and coordinate recalculation) before coding the first pipeline pass?

## Resolution (2026-08-26)

Close this decision with a single action-orchestrated ingestion contract:

- Public mutation entrypoint `requestMapShow` validates one input union:
  `{ kind: "rss" | "apple" | "title", value: string }`, normalizes and records
  a job row, then schedules an internal action runner.
- Internal `"use node"` action `runMapShowIngestion` executes external calls in
  phases with structured checkpoints and retry-safe state transitions.

Pipeline phases:

1. **Normalize source**
   - Resolve canonical source URLs (prefer RSS; derive from Apple URL/title
     through Firecrawl lookup when needed).
   - Build `sourceFingerprint` for idempotency from canonical RSS URL + feed
     metadata.
2. **Firecrawl extraction**
   - Pull show metadata: title, description, site URL, cover art, host hints,
     contact candidates, and episode feed entries (audio enclosure + pub date).
   - Choose `hostEmail` by confidence ranking (explicit contact first, then
     about-page extraction).
3. **Show upsert + coordinate seed**
   - Upsert `shows` by slug/source fingerprint and set base fields.
   - Compute deterministic globe coordinates from slug hash for stable initial
     placement before amp-score tuning.
4. **Episode ingest**
   - Upsert episodes by (`showId`, canonical audio URL or feed GUID surrogate).
   - Store title, audio URL, pubDate, duration fallback estimate, summary.
5. **Hook extraction (OpenAI)**
   - For each target episode window, use `whisper-1` transcript segments and
     `gpt-4o` ranking/summarization to select 30-60s hooks with concise
     `hookText` + excerpt.
   - Enforce bounds: `startTime < endTime`, minimum duration floor, no overlap
     conflicts unless explicitly allowed.
6. **Embedding + snippet write**
   - Generate 1536-dim vectors with `text-embedding-3-small` for each hook.
   - Insert snippets with default engagement counters and vector field.
7. **Finalize + notify**
   - Recalculate `ampScore` from snippet quality/coverage heuristics.
   - Set `isAmped` threshold flag and queue AgentMail outbound preview when
     `hostEmail` exists.

Operational rules:

- Idempotency: one active ingestion per `sourceFingerprint`; re-runs reuse show
  and only fill missing/changed episodes/snippets.
- Retry policy: retry external provider failures with exponential backoff per
  phase; never duplicate inserts after checkpoint completion.
- Observability: persist phase status, error reason, and last successful
  checkpoint for resume/debug.
- Safety: external APIs only in actions; mutations remain pure data operations
  called from the action.

Status: closed (decision finalized, Milestones 4 and 5 become frontier tickets).
