---
title: DiscoPod All Gas Hackathon Map
labels:
  - wayfinder:map
tracker: local-markdown
---

## Destination

A decision-complete execution map for shipping DiscoPod as a Convex All Gas Hackathon submission: clear architecture choices, milestone order, integration boundaries, and validation gates for Convex, Firecrawl, OpenAI, and AgentMail.

## Notes

- Domain: greenfield full-stack TypeScript product for podcast discovery and creator lifecycle automation.
- Frontend preference: React with React Router 7, Tailwind CSS, and React Three Fiber for the globe experience.
- Backend preference: Convex-first architecture with typed queries/mutations/actions, vector search, and HTTP webhook endpoints.
- Planning-first scope: this map resolves decisions and sequencing; implementation happens after the route is clear.
- Build-log policy: keep `hackathon.md` updated with evidence-based progress after meaningful planning or build changes.

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [Milestone 1 - Foundation stack contract](../tickets/m1-foundation-stack-contract.md): Standardize on Vite + React Router 7 + Tailwind + React Three Fiber frontend with strict TypeScript and Convex action/query runtime boundaries.
- [Milestone 2 - Schema, auth, and runtime contract](../tickets/m2-schema-auth-runtime-contract.md): Finalize Convex schema baseline, enforce validator-first APIs, and lock action/mutation/query separation with server-side claim authorization.
- [Milestone 3 - Map a Show pipeline contract](../tickets/m3-map-a-show-pipeline-contract.md): Define phased ingestion orchestration with source normalization, Firecrawl extraction, OpenAI hooks/embeddings, idempotent upserts, and checkpointed retries.
- [Milestone 4 - Listener semantic search contract](../tickets/m4-semantic-search-contract.md): Establish embedding-based search API with Convex vector retrieval, reranking rules, and typed timestamped playback payloads.
- [Milestone 5 - Creator AgentMail loop contract](../tickets/m5-creators-agentmail-loop-contract.md): Lock outbound preview, token-thread claim verification, signed webhook handling, and deterministic inbound command effects for safe show claiming/amping.
- [Milestone 6 - Globe UI and data projection contract](../tickets/m6-globe-ui-data-contract.md): Define React Three Fiber interaction model, Convex query surfaces, accessibility fallbacks, and rendering performance limits for the demo UI.
- [Milestone 7 - Demo and ship-readiness contract](../tickets/m7-demo-ship-readiness-contract.md): Finalize judge-ready pre-build checklist for repo hygiene, hackathon log quality, `convex.site` setup path, demo script, and sub-3-minute video criteria.

## Not yet specified

- Exact transcript-hook quality threshold for "punchy" snippets (ranking and rejection criteria) after prototype evidence.
- Creator identity verification policy beyond inbox-token flow (dispute handling and retries) after webhook command grammar is finalized.
- Demo data acquisition strategy if Firecrawl sources are inconsistent across target shows.
- Audio waveform rendering strategy tradeoff (precomputed peaks vs on-demand decoding) after frontend performance budget is decided.

## Out of scope

- Native mobile application implementation for iOS/Android in this hackathon effort.
- Paid subscription or monetization flows beyond engagement and creator-claim lifecycle.
