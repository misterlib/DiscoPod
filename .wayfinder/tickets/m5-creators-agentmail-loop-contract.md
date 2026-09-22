---
title: Milestone 5 - Creator AgentMail loop contract
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

What outbound and inbound AgentMail flow should DiscoPod standardize (outbound preview template, claim token lifecycle, webhook authentication, command parsing grammar, and mutation side effects) so creators can claim and "amp" their show safely?

## Resolution (2026-08-26)

Close this decision with a claim-safe AgentMail outbound/inbound contract:

- Use `@agentmail/convex` integration as the mail transport boundary inside
  Convex actions. Keep all email/provider interactions in `"use node"` action
  files.
- Outbound flow on successful show ingestion:
  1. Create or reuse a `territoryClaims` row for `showId` with
     `claimStatus: "pending"` and a high-entropy token.
  2. Send a preview email to `hostEmail` containing:
     - show title + snippet reel summary
     - one claim link carrying token + thread reference
     - allowed command examples (`Amp this`, `Reject`, `Change snippet ...`)
  3. Store `inboxThreadId` from AgentMail response for reply correlation.

Webhook and authentication contract (`convex/http.ts`):

- Expose `POST /agentmail/webhook` via `httpAction`.
- Verify webhook authenticity (signature/header validation per AgentMail
  recommendation) before parsing body.
- Reject unsigned/invalid requests with non-2xx responses and no side effects.

Inbound parsing grammar:

- Normalize incoming message text (trim/lowercase + punctuation fold).
- Match one command per message with deterministic precedence:
  1. `amp this` / `amp` -> request amplification
  2. `reject` / `not mine` -> reject claim
  3. `change snippet to mm:ss` or `change snippet to hh:mm:ss` -> edit request
  4. fallback -> unknown command (respond with help template)
- Parse timestamps with strict validator and convert to seconds.

Mutation side effects:

- Resolve claim target by (`inboxThreadId`, token, showId) association.
- `amp` command:
  - require pending or verified claim
  - set `shows.isAmped = true`, increment/adjust `ampScore`
  - set `territoryClaims.claimStatus = "verified"` if pending
- `reject` command:
  - set `territoryClaims.claimStatus = "rejected"`
  - do not mutate show amp flags
- `change snippet` command:
  - create a moderation task/request record (or queued action input) rather than
    directly rewriting snippets in webhook handler
  - respond with acknowledgment and expected turnaround

Safety and audit rules:

- Idempotency key on inbound webhook event id to avoid duplicate command
  application.
- Append command-processing audit metadata (event id, parsed command, outcome)
  for debugging and abuse review.
- Never trust sender email alone for authorization; thread/token linkage is
  authoritative.

Status: closed (decision finalized, Milestone 6 becomes the new frontier).
