---
title: Milestone 6 - Globe UI and data projection contract
labels:
  - wayfinder:prototype
parent: DiscoPod All Gas Hackathon Map
status: closed
assignee: codex-5.3
blockedBy:
  - Milestone 1 - Foundation stack contract
  - Milestone 4 - Listener semantic search contract
  - Milestone 5 - Creator AgentMail loop contract
---

## Question

How should Convex data map into the React Three Fiber globe and waveform player UI (query shapes, loading states, interaction model, accessibility, and performance budget) to produce a polished hackathon demo experience?

## Resolution (2026-08-26)

Close this decision with a UI contract centered on three data surfaces:

- `useQuery(api.shows.listGlobeShows, { limit, ampOnly? })` returns light globe
  nodes only:
  `{ showId, title, coverArtUrl, isAmped, ampScore, coordinates }`
- `usePaginatedQuery(api.search.searchSnippetsFeed, { query, showId? }, { initialNumItems: 12 })`
  drives search + snippet feed panel results.
- `useQuery(api.shows.getShowDetail, { showId })` provides selected-show detail:
  metadata, top snippets, and latest episodes.

Interaction model:

1. Globe opens with animated camera orbit and show nodes sized by `ampScore`.
2. Hover reveals lightweight tooltip (title + amp badge) without loading audio.
3. Click selects show, pins node, opens right-side detail drawer.
4. Selecting a snippet sets waveform player source and seeks to
   `startTime` with pre-roll.
5. Search can highlight matching nodes on globe while updating snippet feed.

Loading and error states:

- Skeleton states for globe canvas shell, detail drawer, and snippet feed.
- Per-panel retry affordance; avoid full-page failure for single-query errors.
- Graceful empty states:
  - no shows mapped yet
  - no search matches
  - show has no snippets

Accessibility contract:

- Keyboard equivalents for globe interactions via companion list view of visible
  shows.
- Focus-managed drawer and player controls; visible focus rings.
- ARIA labels for node buttons, transport controls, and search result actions.
- Captions/transcript excerpt text always available in snippet cards.

Performance budget and rendering constraints:

- Keep initial globe payload under ~250 nodes (server-side limit + ranking).
- Render low-cost point sprites/instanced meshes for nodes (not full 3D models).
- Defer cover-art textures and waveform decoding until show/snippet selection.
- Throttle hover updates and memoize projection math to keep 60fps target on
  mid-tier laptops.
- Split heavy 3D/player modules with lazy loading to improve first paint.

Component boundary plan:

- `src/features/globe/GlobeCanvas.tsx`
- `src/features/globe/GlobeNodeLayer.tsx`
- `src/features/search/SnippetSearchPanel.tsx`
- `src/features/player/WaveformPlayer.tsx`
- `src/features/shows/ShowDetailDrawer.tsx`

Status: closed (decision finalized, Milestone 7 is now the frontier).
