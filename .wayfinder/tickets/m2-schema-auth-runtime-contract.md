---
title: Milestone 2 - Schema, auth, and runtime contract
labels:
  - wayfinder:grilling
parent: DiscoPod All Gas Hackathon Map
status: closed
assignee: codex-5.3
blockedBy:
  - Milestone 1 - Foundation stack contract
---

## Question

How should the provided Convex schema be finalized with strict validators, ownership and claim boundaries, and action/query/mutation separation so external SDK work (Firecrawl/OpenAI/AgentMail) stays in actions while reactive reads and mutations remain deterministic and safe?

## Resolution (2026-08-26)

Close this decision with the following Convex contract:

- Adopt the provided schema as the canonical baseline for `shows`, `episodes`,
  `snippets`, and `territoryClaims`, preserving the 1536-dimension vector index
  for OpenAI `text-embedding-3-small`.
- Keep argument and return validators on all public query/mutation/action
  exports; enforce strict return shapes for search feeds and ingestion receipts.
- Runtime split:
  - **Actions (`"use node"` files):** Firecrawl extraction, OpenAI
    transcription/hook extraction/embeddings, AgentMail send + webhook parsing
    orchestration.
  - **Mutations:** deterministic inserts/patches/deletes, ownership checks,
    state transitions (`isAmped`, claim status).
  - **Queries:** reactive read paths only; no `Date.now()` and no side effects.
- Auth and ownership policy:
  - Public listener search can remain open initially (no personal data).
  - Creator claim/amp mutations require authenticated identity and verified
    claim linkage (`territoryClaims.showId` + token/thread checks).
  - Never trust client-provided ownership flags; compute authorization in
    mutations from server-side records.
- Data consistency policy:
  - Idempotency key on ingestion inputs (normalized source URL + episode GUID
    where available) to avoid duplicate show/episode/snippet inserts.
  - Write order: `shows` -> `episodes` -> `snippets`, then optional amp/claim
    updates.
- File boundaries for implementation:
  - `convex/schema.ts`
  - `convex/shows.ts`, `convex/episodes.ts`, `convex/snippets.ts`,
    `convex/territoryClaims.ts` for reactive operations
  - `convex/ingestionActions.ts`, `convex/searchActions.ts`,
    `convex/agentmailActions.ts` for external SDK orchestration
  - `convex/http.ts` for AgentMail inbound webhooks

Status: closed (decision finalized, Milestone 3 becomes the next frontier
ticket).
