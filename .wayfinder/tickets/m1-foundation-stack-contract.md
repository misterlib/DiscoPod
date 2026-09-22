---
title: Milestone 1 - Foundation stack contract
labels:
  - wayfinder:grilling
parent: DiscoPod All Gas Hackathon Map
status: closed
assignee: codex-5.3
blockedBy: []
---

## Question

What exact greenfield project structure and baseline tooling should DiscoPod use so implementation starts cleanly with React Router 7 + TypeScript frontend and Convex TypeScript backend, including lint/typecheck/test conventions and environment boundaries for Firecrawl, OpenAI, and AgentMail?

## Resolution (2026-08-26)

Close this decision with a single-repo TypeScript setup:

- Use Vite + React + React Router 7 for the frontend in `src/`.
- Keep Convex backend in `convex/` with generated files under `convex/_generated/`.
- Use Tailwind CSS + React Three Fiber (`@react-three/fiber`, `@react-three/drei`) for globe UI, and a dedicated `src/features/` folder split by domain (`globe`, `search`, `creator-claims`, `ingestion`).
- Use strict TypeScript (`strict: true`) and ESLint with `@convex-dev/eslint-plugin` plus `@typescript-eslint` to enforce validators, awaited promises, and safe Convex patterns.
- Test strategy: Vitest + Testing Library for UI and utility logic; keep Convex function tests as targeted integration checks once functions exist.
- Runtime boundary: external SDK calls (Firecrawl, OpenAI, AgentMail) live only in Convex actions (`"use node"` files); queries/mutations remain deterministic and database-focused.
- Environment contract: keep only variable names in checked-in `.env.example`; never commit real keys; map provider keys to action-only usage.

Initial module layout to implement after this planning step:

- `src/app/` for route shell and providers
- `src/routes/` for React Router route modules
- `src/components/` shared UI atoms
- `src/features/` domain UI + hooks
- `convex/schema.ts`, `convex/http.ts`, `convex/shows.ts`, `convex/episodes.ts`, `convex/snippets.ts`, `convex/ingestionActions.ts`, `convex/searchActions.ts`, `convex/agentmailActions.ts`

Status: closed (decision finalized, ready to unblock Milestone 2).
