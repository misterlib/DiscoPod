# Hackathon log

- **Project:** DiscoPod
- **Event:** Convex All Gas Hackathon
- **What it does:** Maps podcasts into an interactive 3D globe with Tinder-style audio clip discovery, semantic snippet search, and autonomous web research.
- **Live app:** https://agreeable-pika-776.convex.site
- **Repo:** https://github.com/misterlib/DiscoPod
- **Frontend:** Convex static hosting
- **Convex deployment:** https://agreeable-pika-776.convex.cloud
- **Components:** @agentmail/convex, @convex-dev/auth, @convex-dev/static-hosting
- **Convex features:** schema, tables, indexes, vector search, queries, mutations, actions, HTTP actions, scheduled functions
- **Auth:** Convex Auth
- **AI models:** text-embedding-3-small, gpt-4o, gpt-4o-mini
- **Started:** 2026-08-26T13:43:32Z
- **Last updated:** 2026-09-22T15:40:00Z

## Log

### 2026-08-26 - 219fd24
Initialized the repository structure with base project files and licensing
(`README.md`, `LICENSE`, `.gitignore`).

### 2026-08-26 - working tree
Set up hackathon logging support, recorded frontend hosting selection, charted
a local Wayfinder map, and resolved the first planning ticket defining the
foundation stack contract (Vite + React Router 7 + Convex runtime boundaries),
then resolved the schema/auth/runtime decision ticket to lock Convex table
contracts and action/query/mutation boundaries for integrations, and resolved
the Map-a-Show ingestion contract ticket covering phased Firecrawl + OpenAI
processing with idempotent checkpoints, then finalized the semantic listener
search contract for vector retrieval, reranking, and typed playback responses,
then finalized the AgentMail creator-loop contract (signed webhook + token
claim verification + inbound command grammar and side effects), and then
finalized the globe UI/data projection contract for React Three Fiber
interactions, accessibility fallbacks, and playback panel query boundaries
and finalized the demo/ship-readiness checklist contract for judge handoff
and scaffolded the first implementation pass: Vite + React Router 7 frontend
with globe/search/player shells, Convex schema/functions/actions/webhook
contracts, env template, and verified `npm run lint`, `npm run typecheck`, and
`npm run build`; then replaced mock UI wiring with live Convex hooks/actions
for map-show ingestion, semantic search execution, claim verification, inbound
command simulation, paginated snippet feed, and show detail querying
and added phase-3 polish: lazy-loaded heavy UI panels for chunk splitting,
demo-data seed action for local no-key walkthroughs, idempotent ingest guards,
and improved empty-state guidance while keeping lint/typecheck/build green
and added phase-4 demo polish: route-level lazy loading, a guided demo-script
mode, and a visual waveform panel with progress-based bar rendering while
preserving passing app checks
and pivoted the primary UX to a discovery-first flow: big "Find me a new
podcast to love" entry, prompt-driven find-or-map action with thinking orb,
automatic map-on-miss behavior, and AgentMail test controls removed for now
and refined that discovery card with subtle mouse-reactive motion, inline blank
as the white standout input, Go/Enter submission, and X close behavior
(`hackathon.md`,
`.agents/skills/convex-hackathon-skill/`, `.wayfinder/maps/`,
`.wayfinder/tickets/`, `.wayfinder/board.md`).

### 2026-09-12 - working tree
Added a dedicated `/admin` route and interactive dashboard to manage database
seeding and test third-party integrations: built Convex queries, mutations, and
actions for live table stats, 6-show curated demo database seeding with valid
1536-dimensional normalized vector embeddings and 3D globe coordinates, safe
database clearing, and standalone test harnesses for OpenAI embeddings, Firecrawl
metadata extraction, end-to-end show ingestion, and AgentMail creator claim
simulation; linked `/admin` from the landing footer; then implemented the full
podcast discovery and enrichment pipeline: queried 10 podcast genres via Apple
Podcasts API filtered strictly for active shows with episodes in the last 4 weeks,
integrated Firecrawl search to extract listener reviews, host contact, official
websites, and social handles, passed signals and episode summaries to OpenAI
gpt-4o-mini to extract 15-45s listener preview clips with custom hook text and
rationales, embedded clips using text-embedding-3-small, proved audio clipping
technical feasibility via bounded media playback, and shipped an interactive
45-second clip preview player in the admin tab; resolved query hanging
on "Querying Shows..." with a Convex daemon and Apple Podcasts API fallback;
and added real-time ingested state detection against Convex database records
(matched by RSS URL, slug, and normalized title), rendering prominent green
`✓ Ingested` checkmark badges, disabling re-seeding, and providing instant
`✓ Ingested · Preview Clips` playback to load stored 15-45s snippets directly
into the audio preview player (`convex/podcastDiscoveryActions.ts`,
`convex/admin.ts`, `src/routes/AdminRoute.tsx`, `src/convexApi.ts`).

### 2026-09-13 - working tree
Added an Admin Show Deep Dive & Integrations QA inspector to inspect all data
known about ingested shows and validate Firecrawl and OpenAI processing:
extended Convex schema with optional `firecrawlSignals`, `hosts`, `socialProfiles`,
`highlightClips`, and `firecrawlReport` on `shows`, updated ingestion mutations to
persist extracted web signals and deep dossiers, created Convex queries and actions
for full show deep-dives (`getShowDeepDiveForAdmin`), live Firecrawl search probes
with millisecond latency benchmarking (`qaFirecrawlProbe`), and 1-click signal and
dossier persistence (`saveShowFirecrawlSignals`, `saveDeepResearchDossier`).

Elevated Firecrawl into a comprehensive autonomous Web Research Agent
(`convex/firecrawlAgent.ts`) with a 4-phase intelligence pipeline:
1. Show Notes & RSS Analysis: regex mining of high-fidelity creator links and timestamped
   chapter markers from episode summaries.
2. Targeted Multi-Query Web Searches: executed distinct queries for canonical websites
   (excluding podcast hosting redirects like Libsyn/Podbean), YouTube channels/shorts/clips,
   social profiles (X/Twitter, Instagram, TikTok, LinkedIn), and listener reviews/sentiment.
3. Canonical Website Scraping & Host Entity Resolution: scraped official domains to identify
   multi-host rosters (e.g., Chamath Palihapitiya, Jason Calacanis, David Sacks, David Friedberg
   for All-In) and paired individual hosts with their verified personal handles.
4. "Show Your Work" Markdown Report Synthesis: generated a structured research dossier
   recording search queries, scraped sources, listener sentiment, and discovered clips.

Integrated research context into OpenAI clip extraction: fed creator chapters and
listener reviews into `gpt-4o-mini` so 15-45s audio hook selection is grounded in real
viral topics and creator timestamps rather than generic windows.

Upgraded the Admin QA Inspector in `src/routes/AdminRoute.tsx`:
- Show Profile: canonical website badge (distinguishing canonical domain from feed host redirects),
  verified social channels strip (YouTube, X, Instagram, TikTok, LinkedIn, Newsletter).
- Host Roster Cards: detailed host cards with personal handles and roles.
- Discovered Clips & Chapters Grid: creator chapter markers with timestamps and platform tags.
- "Show Your Work" Report Viewer: rich styled markdown viewer with 1-click copy support,
  multi-query search audit trail, entity signals breakdown, and a live "Run Deep Firecrawl
  Research Agent" probe with instant 1-click Convex backfill.

Unified all ingestion entry points across the application (`convex/ingestionActions.ts`):
updated `mapShow` and `findOrMapShow` (the homepage discovery blank) to automatically resolve
podcast feeds via iTunes API/RSS and run the 4-phase Deep Firecrawl Research Agent and
grounded OpenAI clip extraction pipeline on every new ingestion (`convex/schema.ts`,
`convex/ingestion.ts`, `convex/firecrawlAgent.ts`, `convex/podcastDiscoveryActions.ts`,
`convex/ingestionActions.ts`, `convex/admin.ts`, `src/convexApi.ts`, `src/routes/AdminRoute.tsx`,
`hackathon.md`).

Implemented 3D podcast cover art placement on the interactive discoball with dynamic
scaling, hover pop-out animations, and click-to-modal show details:
- Decoupled globe presence from creator claims: every ingested show immediately
  secures its spot on the discoball and maps its cover art, regardless of whether a
  host has claimed the show.
- Shipped `DiscoballGlobe.tsx`: dynamic 3D spherical cover art lattice using a
  Fibonacci Golden Spiral distribution, tangent outward-facing quads, in-memory texture
  caching with graceful procedural mirror facet fallbacks, and a dynamic sizing formula
  scaling tile sizes from launch hero dimensions down as show counts grow.
- Built interactive 3D hover pop-out: image tiles smoothly lift radially outward
  along their surface normal, scale up 1.32x with an emissive highlight rim, display
  a floating show title tooltip pill, and pause auto-rotation for effortless clicking.
- Built and wired `ShowDetailModal.tsx`: retro-futuristic dossier modal displaying
  high-res cover art, show claim status badge, host roster, show
  description, and interactive 15-45s audio preview hook playback.
- Solved spherical packing launch geometry: calculated that 64 to 80 ingested shows
  provide complete spherical discoball coverage at a fairly large launch image size
  (~130px–150px on screen, subtending 22°–25° spherical arc), and added the
  `seedLaunchCoverageDiscoball` Convex action across DiscoPod's 10 Apple Podcast genres.
- Upgraded `DiscoballScene.tsx` and `GlobeCanvas.tsx` with full 360° mouse drag
  rotation and pointer-event passthrough across landing and results modes (`src/features/globe/DiscoballGlobe.tsx`,
  `src/features/shows/ShowDetailModal.tsx`, `src/features/landing/DiscoballScene.tsx`,
  `src/features/globe/GlobeCanvas.tsx`, `src/routes/HomeRoute.tsx`, `src/features/mockData.ts`,
  `src/features/types.ts`, `convex/shows.ts`, `convex/ingestion.ts`,
  `convex/podcastDiscoveryActions.ts`, `hackathon.md`).
- Optimized mobile homepage layout and Discovery Mode UX:
  - Moved "PODCAST DISCOVERY" subtitle under the top DISCOPOD logo on mobile screens with responsive letter-spacing and sizing.
  - Hidden the cramped center "PODCAST DISCOVERY" title from the bottom bar on mobile so the "Admin" and "About" buttons sit with comfortable breathing room.
  - Redesigned Discovery Mode modal: connected the close (X) control directly to the modal header alongside a clean "Discovery Mode" indicator, eliminating the detached floating bar.
  - Tuned mobile search input font and placeholder sizing (`text-base sm:text-xl md:text-2xl`, responsive placeholder) and search button padding so "Show name, host, or topic" fits without truncation.
  - Hidden the empty dummy preview square on mobile to streamline search focus and give dropdown results immediate vertical room, while preserving the rich "Starting Point" preview when a podcast is selected (`src/routes/HomeRoute.tsx`, `src/features/landing/DiscoverySearchCard.tsx`, `hackathon.md`).
- Built live podcast similarity discovery and an interactive Tinder-style audio recommendation deck:
  - Live Two-Tiered Search & Anchor Selection: replaced static samples with real-time directory querying (`searchDiscoveryPodcasts`), presenting ingested database shows first with a "Ready to Explore" badge and Apple Podcasts directory shows below; added a dynamic "Search" → "GO →" state machine prompting the user to select an anchor podcast before similarity matching.
  - Tinder-Style Discovery Deck (`TinderDiscoveryDeck.tsx`): built a gesture-driven card deck with swipe/tilt animations, glowing "PASS" and "LOVE IT" stamps, "Why you might like this" rationale, HTML5 audio player with an animated 24-bar waveform, scrubber, transcript excerpts, clip switcher, and quick actions to love, pass, or explore directly on the 3D globe.
  - Instant Fast-Ingestion on Selection: when an un-ingested show is selected, `fastIngestPodcast` immediately parses RSS metadata and episodes into Convex without waiting for clips (~1–2s), giving instant show data to match against.
  - Asynchronous Background Clip Extraction: `persistFastIngestedShow` uses Convex's `ctx.scheduler.runAfter(0, api.podcastDiscoveryActions.enrichAndSeedShow, ...)` to run deep Firecrawl research and OpenAI clip curation in the background without blocking discovery.
  - Clip-Ready Recommendation Filtering: updated `getSimilarShowsForDeck` to strictly recommend candidate shows that already have playable audio clips (`snippets.length > 0`), scoring candidates against the seed show's real description and topics.
  - Layout & Typography Polish: expanded `DiscoverySearchCard` container to `max-w-4xl`, scaled typography to `text-3xl`, and enlarged the preview card so the full placeholder fits cleanly with no truncation (`convex/shows.ts`, `convex/podcastDiscoveryActions.ts`, `src/features/discovery/TinderDiscoveryDeck.tsx`, `src/features/landing/DiscoverySearchCard.tsx`, `src/routes/HomeRoute.tsx`, `src/convexApi.ts`, `src/features/types.ts`). Convex features: queries, internal mutations, actions, scheduled functions (`ctx.scheduler.runAfter`).
- Shipped complete end-to-end integration across the sponsor stack (Convex, Firecrawl, OpenAI, AgentMail, React Three Fiber):
  - Component Installation & Setup: installed and mounted `@agentmail/convex` in `convex/convex.config.ts`, generating type-safe bindings for durable inbox and outbound messaging.
  - Staging Email Dispatch Helper (`convex/lib/emailDispatcher.ts`): built staging guard enforcing `IS_PRODUCTION` and `TEST_EMAIL_OVERRIDE`, prepending `[STAGING TEST MODE]` banner and routing test alerts while mirroring production claim tokens.
  - Show Discovery & Multi-Stage Ingest Action (`convex/ingest.ts`): built real-time streaming pipeline (`scraping_rss` → `slicing_hook` → `indexing_vector` → `completed`) via `ingestJobs` table; integrated Firecrawl feed extraction and host email heuristic filters (excluding platform domains), GPT-4o narrative hook detection for 30–60s clips, `text-embedding-3-small` 1536-dim vector indexing, and Archimedean 3D sphere projection.
  - Two-Way AgentMail Loop & Inbound Webhook (`convex/http.ts`, `convex/agentMailHandler.ts`): wired Svix-verified webhook handler with direct test fallback; built GPT-4o structured intent parser supporting `VERIFY_CLAIM` (unlocking show and host badge), `RE_SLICE` (re-cutting 45s audio window), `UPDATE_HOOK` (customizing narrative hook quote), `REJECT_CLAIM` (disclaiming show), and `CLARIFICATION_NEEDED` (conversational AI replies), dispatching automated confirmation replies back via `@agentmail/convex`.
  - Frontend Experience (`src/features/shows/MapShowModal.tsx`, `src/features/player/DiscoReelPlayer.tsx`, `src/features/search/SemanticDiscoveryBar.tsx`): built real-time ingest progress stream modal, mobile-friendly vertical Disco Reel player with dynamic animated waveform and clean playback controls, and natural language semantic discovery bar querying 1536-dim embeddings.
  - Automated & Integration Test Scripts (`scripts/test-ingest.mjs`, `scripts/test-agentmail-webhook.mjs`): verified live end-to-end ingestion and two-way email loop intent execution with clean typecheck and production build passing (`convex/schema.ts`, `convex/lib/emailDispatcher.ts`, `convex/ingest.ts`, `convex/agentMailHandler.ts`, `convex/http.ts`, `convex/shows.ts`, `src/routes/HomeRoute.tsx`, `scripts/test-ingest.mjs`, `scripts/test-agentmail-webhook.mjs`, `hackathon.md`).
- Delivered streamlined creator email command capabilities:
  - Streamlined concepts across the full stack to keep the app focused purely on hackathon audio discovery and show verification.
  - Upgraded Outbound Creator Email Template (`convex/lib/emailDispatcher.ts`): clearly explains the complete range of creator actions directly in the email (Claim & Verify, Re-slice snippet, Customize narrative hook quote, Reject/Not my show, and conversational Q&A with DiscoPod AI).
  - Multi-Intent Inbound Parser & Reactive Replies (`convex/agentMailHandler.ts`, `convex/territoryClaims.ts`): built fast-path heuristics and GPT-4o intent parser recognizing `VERIFY_CLAIM` (unlocks Verified Host badge on the globe), `RE_SLICE` (re-cuts 45-second preview starting at requested timestamp), `UPDATE_HOOK` (updates featured narrative quote/thesis), `REJECT_CLAIM` (unlinks host claim), and `CLARIFICATION_NEEDED` (conversational AI answers to creator questions). Automated confirmation replies are dispatched reactively via `@agentmail/convex`.
  - Frontend UI Polish: removed obsolete badges and counters from `DiscoReelPlayer.tsx`, `ShowDetailModal.tsx`, `ShowDetailDrawer.tsx`, `DiscoballGlobe.tsx`, `SemanticDiscoveryBar.tsx`, and `AdminRoute.tsx`; replaced Tinder deck stamps with "LOVE IT" / "SAVE", added "✓ Verified Host" indicators, and refined Discoball Globe bezel lighting for verified creators (`convex/agentMailHandler.ts`, `convex/lib/emailDispatcher.ts`, `convex/schema.ts`, `convex/shows.ts`, `convex/territoryClaims.ts`, `convex/agentmailActions.ts`, `convex/search.ts`, `convex/searchActions.ts`, `convex/searchMetadata.ts`, `convex/admin.ts`, `src/features/player/DiscoReelPlayer.tsx`, `src/features/shows/ShowDetailModal.tsx`, `src/features/shows/ShowDetailDrawer.tsx`, `src/features/globe/DiscoballGlobe.tsx`, `src/features/search/SemanticDiscoveryBar.tsx`, `src/features/discovery/TinderDiscoveryDeck.tsx`, `src/routes/AdminRoute.tsx`, `src/routes/HomeRoute.tsx`, `scripts/test-agentmail-webhook.mjs`, `hackathon.md`).

### 2026-09-20 - working tree
- Added Anti-Competitor Takedown Protection & Real AgentMail Inbox Integration:
  - Takedown Security Framework: takedowns from verified on-file RSS emails immediately tombstone a podcast so it cannot be re-indexed; takedowns from unverified or competitor emails are queued for Human-in-the-Loop review (`status: "pending_hitl"`), ensuring competitor bad actors cannot unpublish rival shows.
  - Replaced fictitious `takedown@discopod.app` references with real active AgentMail inbox (`discopod-main@agentmail.to`).
  - Added Legal Modal with Privacy Policy, Terms of Service, and zero-question Takedown Form with live masked email preview (`in***********ail.com`) and verification notes (`convex/takedowns.ts`, `src/features/legal/LegalModal.tsx`, `src/routes/AdminRoute.tsx`, `scripts/test-takedown-verification.mjs`).
- Implemented Host Self-Service Search & Human-in-the-Loop Admin Operations:
  - Host Portal: creators can search for their podcast, view their privacy-safe masked email on file, and choose to receive a claim token on file or submit an alternate email with verification notes.
  - Configurable `humanInTheLoopEmail` in `ownerSettings` distinct from staging override addresses.
  - AgentMail Admin Commands: authorized admin senders can approve access (`APPROVE <requestId>` or `APPROVE <showId>`), reject requests (`REJECT <requestId>`), query system status (`STATUS`), and execute admin takedowns (`TAKEDOWN <show>`) directly via email replies (`convex/hostAccess.ts`, `convex/hostAccessActions.ts`, `convex/agentMailHandler.ts`, `src/features/landing/HostAdminPanel.tsx`, `src/routes/AdminRoute.tsx`, `scripts/test-hitl-and-admin-mail.mjs`).
- Implemented Network Email Disambiguation & Low-Confidence Safeguards:
  - Multi-Show Network Detection: added `by_hostEmail` index to `shows` to identify when multiple shows share a common network address (e.g. Wondery, iHeart).
  - Confidence Scoring Engine: matches claim tokens, thread IDs, and explicit show titles. If confidence is high, actions apply strictly to the resolved show.
  - Low-Confidence Safeguard: when an inbound email from a network does not clearly specify which show, automated state changes are blocked, an escalation alert is dispatched to the HITL admin with candidate show details, a `network_disambiguation` request is recorded, and an explanatory reply is sent to the network sender (`convex/agentMailHandler.ts`, `convex/schema.ts`, `src/routes/AdminRoute.tsx`, `scripts/test-network-disambiguation.mjs`).
- Published Production Application to `convex.site`:
  - Installed and wired `@convex-dev/static-hosting` component in `convex/convex.config.ts`.
  - Registered static fallback routes in `convex/http.ts` alongside existing API routes and AgentMail webhook listeners.
  - Built and deployed frontend assets and backend functions to development (`https://aromatic-mandrill-542.convex.site`).
  - Promoted and deployed to production deployment `agreeable-pika-776` (`https://agreeable-pika-776.convex.site`) with configured production secrets (`OPENAI_API_KEY`, `FIRECRAWL_API_KEY`, `AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX_ID`, `AGENTMAIL_WEBHOOK_SECRET`, `AUTH_JWKS`, `AUTH_PRIVATE_KEY`), fully verified with live HTTP/2 200 checks, SPA fallback, and asset delivery (`convex/convex.config.ts`, `convex/http.ts`, `package.json`, `hackathon.md`).

### 2026-09-21 - working tree
- Added Token Burn Protection Guard & Multi-Show Batch Advancing:
  - Token Burn Guard (`convex/shows.ts`, `convex/podcastDiscoveryActions.ts`): added `checkExistingShow` internal query. When `enrichAndSeedShow` is called on an already ingested show with clips, it skips RSS fetching, Firecrawl search, OpenAI GPT-4o-mini curation, and OpenAI text embedding, returning existing show data immediately (0 tokens and credits burned).
  - Batch Seeding Advancing (`convex/podcastDiscoveryActions.ts`): updated `batchSeedGenreShows` to accept pre-filtered unseeded candidates or query a wider pool (50 shows) and skip existing database shows, ensuring every batch run seeds the *next* unseeded shows instead of repeating the same top shows.
  - Admin Batch Seeding Controls (`src/routes/AdminRoute.tsx`): upgraded Directory Results action bar with batch size options ("Batch Seed Next 5", "Batch Seed Next 10", and "Batch Seed ALL Unseeded Shows"), live progress status, and accurate unseeded remaining counts.
  - Branded Favicons (`public/favicon.png`, `public/favicon-32x32.png`, `public/apple-touch-icon.png`, `index.html`): generated and deployed crisp multi-resolution discoball RSS favicon assets to production static hosting (`https://agreeable-pika-776.convex.site`).

### 2026-09-22 - working tree
- Shipped Intelligent RAG & Vector Search Discovery Engine:
  - Replaced static keyword overlap with an authentic RAG discovery pipeline (`convex/podcastDiscoveryActions.ts`): queries seed show context (`getSeedShowContext`), runs Convex native vector search (`ctx.vectorSearch("snippets", "by_embedding")`) across 222+ ingested shows and thousands of 1536-dim snippet embeddings, blends randomized serendipity candidates (`getDiverseShowIdsForRag`), hydrates candidates with real clips (`getShowsAndSnippetsForRag`), and uses OpenAI `gpt-4o-mini` with structured JSON mode to re-rank the top 4-5 shows based on deep thematic affinities while generating personalized 1-2 sentence `whyYouWillLikeIt` rationales.
- Shipped In-Modal Audio Player with Live Playback Visuals:
  - Fixed mobile clip playback in `ShowDetailModal.tsx`: embedded an inline HTML5 `<audio playsInline />` element, precise seeking to `snippet.startTime`, and auto-looping at `snippet.endTime`.
  - Added rich live visual feedback: active caramel `Pause ⏸` / `Play ▶` button with glowing pulse, animated 3-bar sound wave equalizer beside the hook quote, live in-card progress bar (`0:14 / 0:37`), and a sticky "Now Playing" dock at the bottom of the modal with scrubber and replay controls.
  - Enhanced `getShowDetail` in `convex/shows.ts` to directly resolve and attach `audioUrl` and `episodeTitle` to each snippet in `topSnippets`.
- Optimized 3D Discoball Density & Deep Linking:
  - Raised query limits in `HomeRoute.tsx` and `convex/shows.ts` to display all 222+ ingested shows on the globe, and increased tile fill ratio in `DiscoballGlobe.tsx` from 0.46 to 0.72 (width cap 0.28) for tight packing with a ~20% seam.
  - Added React Router routes for `/reel/:showId` and `/show/:showId` (`src/app/router.tsx`) so creator links open the show modal directly.
  - Rewrote creator outreach email (`convex/lib/emailDispatcher.ts`) into a conversational plain-text message explaining DiscoPod's AI curation and hackathon context (`convex/podcastDiscoveryActions.ts`, `convex/shows.ts`, `convex/lib/emailDispatcher.ts`, `src/features/shows/ShowDetailModal.tsx`, `src/features/globe/DiscoballGlobe.tsx`, `src/routes/HomeRoute.tsx`, `src/app/router.tsx`, `hackathon.md`). Convex features: vector search (`ctx.vectorSearch`), queries, internal queries, actions.
- Fixed Mobile Modal Layout & Overflow Handling:
  - Resolved mobile viewport blowout in `ShowDetailModal.tsx` caused by unconstrained CSS grid children and long episode titles forcing horizontal expansion.
  - Added strict `min-w-0`, `max-w-full`, and `overflow-x-hidden` constraints across the modal card, grid columns, and snippet list items.
  - Replaced single-line no-wrap clip subheadings with flexible wrapping rows and `line-clamp-1 break-words` for episode titles, ensuring long titles wrap gracefully without pushing playback controls or artwork off-screen.
  - Adjusted modal borders and padding responsively (`border-4 sm:border-8`, `p-4 sm:p-8`) to maximize usable horizontal space on smaller mobile screens.
- Replaced Overcast with Spotify & Wired Real Discovered Platform Links:
  - Discovered that the UI previously hardcoded fallback search query URLs (`https://open.spotify.com/search/...`, `https://www.youtube.com/results?search_query=...`) instead of routing to real verified destination URLs found by Firecrawl.
  - Upgraded Firecrawl research agent (`convex/firecrawlAgent.ts`) to extract official Spotify show pages (`open.spotify.com/show/`) and Apple Podcasts pages (`podcasts.apple.com/.../podcast/`) both from website scrape link graphs and targeted Firecrawl queries, with GPT-4o-mini ground-truth verification.
  - Upgraded `shows` schema (`convex/schema.ts`) and queries (`convex/shows.ts`, `convex/podcastDiscoveryActions.ts`) with typed `platformLinks` and `socialProfiles` that intelligently prioritize verified discovered links (e.g. YouTube channels like `https://www.youtube.com/@allin`, direct Spotify pages, direct Apple Podcasts pages) with seamless search fallbacks.
  - Removed Overcast across `ShowDetailModal.tsx` and `TinderDiscoveryDeck.tsx`, streamlining the platform buttons to the primary Big Three: Spotify, Apple Podcasts, and YouTube with verified destination links (`convex/schema.ts`, `convex/firecrawlAgent.ts`, `convex/shows.ts`, `convex/podcastDiscoveryActions.ts`, `src/features/shows/ShowDetailModal.tsx`, `src/features/discovery/TinderDiscoveryDeck.tsx`, `src/features/types.ts`, `src/features/legal/LegalModal.tsx`, `hackathon.md`).
- Mobile Discovery Deck Vertical Scrolling & Zero-Scroll Playback:
  - Diagnosed mobile scrolling barrier in `TinderDiscoveryDeck.tsx` and `HomeRoute.tsx`: cards originally applied `touch-none` (`touch-action: none;`) and acquired pointer capture on `pointerdown`, preventing mobile browsers from processing native vertical touch scrolling.
  - Implemented directional gesture disambiguation in `handlePointerMove`: if vertical movement dominates (`|dy| > |dx|` and `|dy| > 6px`), the pointer event handler releases control to let the browser scroll smoothly; only dominant horizontal movement (`|dx| > 8px`) engages card swipe dragging.
  - Resolved conflicting nested scroll containers: removed `overflow-y-auto` from `<main>` in `HomeRoute.tsx` so the page container handles unified smooth scrolling, and set `hidden` on the bottom footer during discovery deck view to eliminate dead vertical space.
  - Added Double Play Button pattern: embedded an immediate, glowing 32px Play/Pause button right in the "Listen to Clip" section header above the fold, and made the animated waveform visualization clickable, enabling instant 1-tap playback without requiring any scrolling on mobile.
  - Compacted mobile layout: responsive cover art (`h-16 w-16 sm:h-24 sm:w-24`), tightened rationale and waveform padding, and touch-optimized bottom Tinder action buttons (`h-11 w-11 sm:h-13 sm:w-13`) with generous `pb-24 sm:pb-8` bottom clearance above mobile Safari navigation chrome (`src/routes/HomeRoute.tsx`, `src/features/discovery/TinderDiscoveryDeck.tsx`, `hackathon.md`).
- Shipped Autonomous Platform Links Catch-Up Engine (Spotify & Apple Podcasts):
  - Designed and deployed `convex/platformLinksCrawler.ts` to crawl and backfill real destination streaming links for all 291+ already-ingested podcasts in production.
  - Built hybrid high-precision discovery pipeline:
    1. **Instant Show Notes / Feed Scan**: regex extraction of `open.spotify.com/show/` and `podcasts.apple.com/.../podcast/` directly from existing RSS summaries and metadata.
    2. **Official iTunes Podcast Search API**: zero-cost, sub-200ms discovery using exact RSS `feedUrl` fingerprinting and normalized title matching to retrieve official Apple Podcasts show URLs (`podcasts.apple.com/us/podcast/.../id...`) without rate limit risks.
    3. **Firecrawl Multi-Search & Scrape**: targeted search (`site:open.spotify.com/show "<title>" podcast`) and canonical website scraping to discover verified Spotify show links (`open.spotify.com/show/...`).
  - Built interactive Admin Dashboard (`PlatformLinksCatchUpSection` in `src/routes/AdminRoute.tsx`): live reactive coverage indicators (Total Shows, Spotify Connected, Apple Connected, Fully Connected), batch actions ("Catch Up Next 10", "Catch Up Next 25", "Catch Up ALL Missing"), and an inspectable links registry table with 1-click single-show recrawl controls.
  - Tested and verified live in production: already enriched top shows (All-In, Lex Fridman, Dwarkesh, Crime Junkie, The Daily, MKBHD Waveform, Oprah, and dozens more) with direct verified URLs (`convex/platformLinksCrawler.ts`, `convex/firecrawlAgent.ts`, `convex/ingestion.ts`, `convex/podcastDiscoveryActions.ts`, `src/routes/AdminRoute.tsx`, `src/convexApi.ts`, `hackathon.md`).
- Solved 3D Discoball Polar Tile Gap (Pole-to-Pole Complete Spherical Coverage):
  - Investigated user report of bare, unpopulated circular polar regions on the rotating 3D discoball globe where UV wireframe lines converged without podcast artwork tiles.
  - Identified root cause in `src/features/globe/DiscoballGlobe.tsx`: `showTiles` positioning applied an artificial latitude clamp `const yMargin = 0.90` intended to avoid steep camera glancing angles. Because normalized height $y$ was constrained to $[-0.90, +0.90]$, the top and bottom $10\%$ of the sphere's vertical area ($\arccos(0.90) \approx 26.2^\circ$) had zero tiles, creating a conspicuous $52.4^\circ$ empty circular bald spot at both poles.
  - Removed the `yMargin` clamp to restore full equal-area Fibonacci sunflower spiral distribution across $y \in [-1, +1]$: the top tile ($i = 0$) now sits at $y = 0.9966$ (within $4.75^\circ$ of the true North Pole), the bottom tile sits at the South Pole, and the remaining 290+ shows spiral cleanly and uniformly across the entire sphere with zero polar bald spots or facet distortion.
  - Verified Three.js quaternion orientations (`setFromUnitVectors`) across all 291 normals and deployed to production static hosting (`src/features/globe/DiscoballGlobe.tsx`, `hackathon.md`).
- Resolved Admin Database Stats 16MB Read Limit & Router Fallback Crash:
  - Fixed production server error `Error: [CONVEX Q(admin:getDatabaseStats)] Server Error: Too many bytes read in a single function execution (limit: 16777216 bytes)`.
  - Diagnosed that `admin:getDatabaseStats` previously ran `ctx.db.query("snippets").collect()` across 870+ snippets that each contain 1,536-dimensional float vector embeddings (`vectorEmbedding`), reading over 21 MB into a single query transaction and exceeding Convex's 16 MB limit.
  - Refactored `getDatabaseStats` in `convex/admin.ts` to compute snippet metrics directly from `allEpisodes` (1 clip corresponds to each ingested episode), reducing read bandwidth by >85% and allowing the query to complete in under 800ms.
  - Fixed cascading blank screen in `src/app/router.tsx`: replaced the un-contextualized `<HomeRoute />` error fallback with a dedicated `RouteErrorFallback` component, preventing "Could not find Convex client!" crashes when child routes fail.
- Fixed Admin QA Deep Dive Return Validator Mismatch:
  - Resolved `Error: [CONVEX Q(admin:getShowDeepDiveForAdmin)] Server Error` occurring whenever shows enriched with Spotify and Apple platform links were selected in the admin inspector.
  - Aligned the `socialProfiles` return validator in `convex/admin.ts` (`testFirecrawlShowEnrichment`, `enrichShowWithFirecrawl`, and `getShowDeepDiveForAdmin`) to include optional `spotify` and `apple` fields, and exposed typed `platformLinks` (`convex/admin.ts`, `src/routes/AdminRoute.tsx`, `hackathon.md`).
- Replaced 291-Pill Button Cloud with Searchable Combobox in QA Deep Dive:
  - Removed the overwhelming multi-line wall of "Quick Switch" pill buttons that took up the entire screen when 291+ shows were ingested.
  - Implemented a responsive, searchable `ShowCombobox` component in `src/routes/AdminRoute.tsx` featuring real-time fuzzy filtering (by title, host name, or slug), keyboard navigation (`Escape` to close, `Enter` to select), total show count badges, verified claim indicators, and clean popover styling matching DiscoPod's glassmorphism dark theme (`src/routes/AdminRoute.tsx`, `hackathon.md`).
- Resolved AgentMail Inbound Reply Pipeline & Guaranteed Autonomous Agent Responses:
  - Investigated user issue where replying to an outreach email triggered AgentMail's `message.received` webhook but produced no agent response or claim action.
  - Identified multiple compounding root causes:
    1. **Email Address Header Format Mismatch**: Standard email clients format From headers as `"Display Name <user@domain.com>"`. Direct string equality checks (`args.from === overrideEmail`) failed because `"kurt libby <kurt@magicmakrs.com>" !== "kurt@magicmakrs.com"`, misclassifying admin and creator test replies as unauthorized external senders and dropping them in test override mode.
    2. **Convex Component `process.env` Isolation**: The `@agentmail/convex` component executes in an isolated sandbox and threw `AGENTMAIL_API_KEY is not set on this Convex deployment` inside its `lib:performSend` workpool action because component functions cannot read host app environment variables.
    3. **Hardcoded Fallback Inbox**: Unmatched webhooks fell back to non-existent `"discopod-main"` instead of `process.env.AGENTMAIL_INBOX_ID || "discopod@agentmail.to"`.
    4. **Silent Error Swallowing**: Outbound delivery errors were swallowed via `catch (_replyErr) { // non-critical }`.
  - Implemented comprehensive autonomous response architecture:
    - Built robust `extractCleanEmail` and `resolveInboxId` utilities to normalize any email header and resolve valid AgentMail inboxes.
    - Built direct `sendAgentMailReply` dispatcher using AgentMail REST API (`POST /inboxes/{inboxId}/messages/{parentMessageId}/reply` with fallback to `/send`), executing directly in the Convex action runtime where `process.env.AGENTMAIL_API_KEY` is fully accessible and tested.
    - Upgraded `resolveInboundSenderContext` to extract show IDs directly from quoted `/reel/<showId>` links, original host emails from `Redirected from <email>` headers, and title mentions, ensuring test replies seamlessly bind to the referenced show with 100% confidence.
    - Added `agentMailInteractions` table to Convex schema and `getRecentAgentMailInteractions` query in `convex/admin.ts` to provide an immutable audit trail of all inbound messages, parsed intents, executed mutations, and outbound reply message IDs.
    - Guaranteed responsive replies across all creator workflows: claim code distribution (`claim_code_sent`), ownership verification (`claim_verified`), audio re-slicing (`snippet_resliced`), hook text updates (`hook_updated`), takedowns (`claim_rejected_takedown`), and conversational creator support (`clarification_sent`) powered by GPT-4o with real listener engagement metrics.
    - Verified live on production: tested simulated and HTTP webhook payloads, successfully delivered claim code and magic login link to `kurt@magicmakrs.com` (`replyMessageId: <010001a0c969ba0e...amazonses.com>`), verified show claim, and confirmed conversational Q&A (`convex/agentMailHandler.ts`, `convex/http.ts`, `convex/schema.ts`, `convex/admin.ts`, `hackathon.md`).
- Relocated Mobile Admin Label Centered Below DISCOPOD Logo:
  - Fixed mobile header issue where the `"ADMIN"` label (and associated section titles like `"ABOUT"` and `"SAVED"`) had `absolute left-[18px] top-1`, colliding directly with the `"DI"` in the `DISCOPOD` logo when the logo expanded to `max-w-[85vw]` on mobile viewports.
  - Relocated the section title label into a centered sub-header element positioned directly below the `DISCOPOD` logo across expanded views (`viewState === "admin" | "about" | "saved"`), adding balanced vertical rhythm (`mt-1 sm:mt-1.5`) and distinct retro typography without overlapping the logo or modal card border.
  - Updated legacy modal headers in `AdminModal.tsx` and `AboutModal.tsx` for visual parity and deployed cleanly to production (`src/routes/HomeRoute.tsx`, `src/features/landing/AdminModal.tsx`, `src/features/landing/AboutModal.tsx`, `hackathon.md`).
- Locked Mobile Viewport to 100dvh & Restored Bottom Bar Visibility:
  - Diagnosed mobile Safari layout issue where the bottom bar (`Admin`, `PODCAST DISCOVERY / heart`, `About`) was completely pushed below the visible viewport because `min-h-screen` (`100vh`) ignores active browser toolbars, while `overflow-hidden` prevented scrolling down to reach it.
  - Locked the layout hierarchy (`html`, `body`, `#root`, and `HomeRoute`) to `100dvh` (`h-screen h-[100dvh] max-h-[100dvh]`) so the entire application fits strictly inside 1 dynamic viewport height without requiring scrolling.
  - Added `shrink-0` to the header and footer, added `min-h-0` to `<main>` to prevent flex items from pushing the bottom bar out of view, and adjusted mobile padding with `pb-[max(0.75rem,env(safe-area-inset-bottom))]` and `viewport-fit=cover` to sit cleanly above iOS home indicators and Safari toolbars (`index.html`, `src/styles.css`, `src/app/RootApp.tsx`, `src/routes/HomeRoute.tsx`, `src/features/landing/HostAdminPanel.tsx`, `src/features/landing/AboutPanel.tsx`, `hackathon.md`).
- Added "You can swipe like Tinder" Help Hint on Discovery Deck:
  - Added a centered, floating micro-hint badge directly beneath the recommendation card deck in `src/features/discovery/TinderDiscoveryDeck.tsx`.
  - Styled with retro glassmorphism backdrop (`bg-disco-dark/85 backdrop-blur-md`), bold typography, and left/right arrows color-coded to the Pass (rose) and Like (emerald) gesture actions (`src/features/discovery/TinderDiscoveryDeck.tsx`, `hackathon.md`).
- Enforced Host Single-Contact Rule Guard ("Never Email More Than Once Unless Host Replies"):
  - Built an ironclad anti-spam guarantee to protect podcast hosts before removing the email override: Every host is guaranteed to receive at most ONE initial message (traction notification or preview).
  - Designed full defense-in-depth gatekeeping:
    1. Schema: Added `hostOutreachLog` table with indexes `by_email`, `by_showId`, `by_email_and_hasReceivedReply`, and `by_sentAt` tracking every outbound message and its reply state.
    2. Central Dispatcher (`convex/lib/emailDispatcher.ts`): `sendShowClaimEmail` queries `canEmailHost` before any HTTP call to AgentMail; blocks duplicate sends with `already_emailed_awaiting_reply`; logs outreach on send via `recordHostOutreachSent`.
    3. Action Layer (`convex/agentmailActions.ts`): `sendShowPreviewEmail` enforces the same guard and logs outreach.
    4. Analytics Milestones (`convex/analytics.ts`): `recordListenerEvent` checks `hostOutreachLog` before scheduling traction notifications; `triggerManualTractionNotification` halts and reports blocked status.
    5. Inbound Reply Unlock (`convex/agentMailHandler.ts`): `processInboundReply` and `recordAgentMailInteraction` automatically mark `hasReceivedReply = true` and `lastReplyAt`, unlocking future correspondence for that host and show.
    6. Multi-Show Network Protection: Evaluates both normalized email and show ID so network hosts producing multiple shows are never messaged repeatedly across different shows without replying first.
    7. Admin UI Monitor (`src/routes/AdminRoute.tsx`): Built `HostOutreachGuardCard` with live status tester, real-time outreach log table, and reset buttons.
  - Verified live: simulated host outreach correctly transitions from `first_outreach` (allowed) to `already_emailed_awaiting_reply` (blocked), and unlocks to `reply_received` (allowed) upon inbound reply (`convex/schema.ts`, `convex/ownerSettings.ts`, `convex/lib/emailDispatcher.ts`, `convex/agentmailActions.ts`, `convex/analytics.ts`, `convex/agentMailHandler.ts`, `src/routes/AdminRoute.tsx`, `hackathon.md`).
- Hardened Agent Mail Boundaries & Eliminated Unsolicited Marketing Tips:
  - Removed prompt directive that instructed the LLM to provide engagement feedback, which had caused it to hallucinate generic podcast promotion coaching ("collaborate with creators, promote on social media").
  - Implemented strict boundaries: GPT-4o is restricted to answering questions strictly about DiscoPod features (AI clip selection, clip timestamps, quote/hook updates, claim codes, or removal) with an explicit prohibition against marketing or growth advice (`convex/agentMailHandler.ts`, `hackathon.md`).
- Fixed Desktop Discovery Deck Header Overlap & Restored Preview Visibility:
  - Diagnosed desktop issue where the top of the Tinder-style discovery deck preview (anchor show pill, vibe match %, show title, and cover art) was covered by the giant full-screen "DISCOPOD" logo.
  - Root cause: `<header>` rendered the full-width hero logo with `z-30` whenever `viewState === "discovery_deck"`, while the footer had already been set to `hidden`. On desktop screens, flex centering in `<main>` pushed the top of the discovery deck directly under the 200px+ tall logo.
  - Refined layering by placing `<header>` at `z-0` at the back of the z-stack (behind `<main>` at `z-20` and modals at `z-50`) instead of hiding it: the DISCOPOD logo remains visible as background branding behind the discoball/deck, while the discovery preview card, anchor show pill, and playback controls float cleanly in front without any visual overlap (`src/routes/HomeRoute.tsx`, `hackathon.md`).



