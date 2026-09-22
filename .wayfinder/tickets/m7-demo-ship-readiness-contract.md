---
title: Milestone 7 - Demo and ship-readiness contract
labels:
  - wayfinder:task
parent: DiscoPod All Gas Hackathon Map
status: closed
assignee: codex-5.3
blockedBy:
  - Milestone 4 - Listener semantic search contract
  - Milestone 5 - Creator AgentMail loop contract
  - Milestone 6 - Globe UI and data projection contract
---

## Question

What is the minimum complete checklist for a judge-ready handoff (public repo hygiene, `hackathon.md` evidence quality, hosting path readiness for `convex.site`, demo script, and <3 minute video capture criteria) before final build execution begins?

## Resolution (2026-08-26)

Close this decision with a pre-build execution readiness checklist:

1. **Repository and code hygiene**
   - Public GitHub remote is configured and accessible.
   - `README.md` contains setup/run instructions and project purpose.
   - No secrets committed; `.env*` protected and `.env.example` contains names
     only.
   - Lint/typecheck/test commands defined in `package.json`.

2. **`hackathon.md` quality gate**
   - File exists at repo root and keeps required header order.
   - Event field is exactly `Convex All Gas Hackathon`.
   - Frontend field is `Convex static hosting`.
   - Entries are evidence-based, no invented deployment claims, and no PII or
     secret values.

3. **Convex + hosting readiness (`convex.site`)**
   - Convex project initialized and linked to dev deployment.
   - Static hosting component plan is queued for build phase:
     - `npm install @convex-dev/static-hosting`
     - `npx @convex-dev/static-hosting setup`
   - Deployment verification criterion defined:
     - final URL must match `https://<deployment>.convex.site`.

4. **Demo scenario script readiness**
   - Script includes one end-to-end flow:
     ingest show -> surface snippets on globe -> semantic search ->
     creator command effect.
   - Every spoken claim maps to observable UI behavior in the build.
   - Include one fallback branch if ingestion/provider call is delayed.

5. **Video readiness (<3 minutes)**
   - Target run-of-show:
     20s problem/context, 90s live product flow, 40s architecture highlights,
     20s wrap.
   - Capture in readable resolution with visible timestamps/interactions.
   - Final cut verifies runtime under 3:00 and includes live URL + repo in
     closing frame.

6. **Pre-publish verification sequence**
   - Run local checks (lint/typecheck/tests + app smoke path).
   - Confirm `hackathon.md` updated after meaningful progress.
   - Ask user before any publish/deploy/submit step.

Status: closed (map decisions are complete; route is clear to begin
implementation execution).
