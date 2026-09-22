# DiscoPod Hackathon Demo Video Script
**Target Duration:** ~2.5 Minutes (150 Seconds)  
**Tone:** Energetic, confident, builder-focused, and punchy.  
**Live Demo URL:** `https://agreeable-pika-776.convex.site`

---

## 🎬 Pre-Recording Checklist & Tabs to Open

1. **Tab 1 (Main App):** `https://agreeable-pika-776.convex.site` (Homepage with the 3D Discoball globe spinning).
2. **Tab 2 (Admin Inspector):** `https://agreeable-pika-776.convex.site/admin` (Pre-seeded with shows like *All-In*, *Crime Junkie*, *Huberman Lab*, etc., so you can instantly show the Firecrawl Research dossier and audio clips).
3. **Tab 3 (AgentMail Dashboard / Email Client):** Ready to show an incoming claim email or admin alert from `discopod-main@agentmail.to`.
4. **Audio Check:** Ensure your computer audio is shared if you want the 15-45s audio clip preview to be heard clearly in the video.

---

## ⏱️ Video Breakdown

| Segment | Timing | Key Focus / Feature | Integrations Highlighted |
| :--- | :--- | :--- | :--- |
| **1. Hook & Problem** | 0:00 – 0:25 | The "Podcast Discovery Problem" & 3D Discoball | React Three Fiber, Convex Static Hosting |
| **2. Discovery & Tinder Deck** | 0:25 – 0:55 | Anchor search, fast-ingest, swipe deck with audio hooks | Convex Vector Search, OpenAI |
| **3. Autonomous Research Agent** | 0:55 – 1:30 | Firecrawl deep dossier, host resolution, chapter mining | Firecrawl, OpenAI gpt-4o-mini |
| **4. Two-Way Creator Loop** | 1:30 – 2:05 | Host claim, AgentMail webhook loop, HITL safety | @agentmail/convex, Human-in-the-Loop |
| **5. The Convex Engine & Outro** | 2:05 – 2:30 | 100% reactive stack, components, wrap-up | Convex platform, all components |

---

## 📜 Full Script: Scene-by-Scene

---

### Segment 1: The Hook & The 3D Discoball (0:00 – 0:25)

**On-Screen Action:**
- Start full-screen on `https://agreeable-pika-776.convex.site`.
- Smoothly drag the mouse across the 3D Discoball, letting the light facets reflect and showing the podcast cover art tiles distributed across the sphere.
- Hover over one or two tiles to show the smooth 3D pop-out animation and show title tooltip.

**Voiceover:**
> *"Podcast discovery is broken. Right now, finding a great new show means scrolling through endless lists of tiny icons and committing to a sixty-minute episode hoping it gets good.*
>
> *This is **DiscoPod**—a visual, interactive discovery platform that transforms the podcast universe into an interactive 3D globe with Tinder-style bite-sized audio hooks, autonomous web research, and agentic host management."*

---

### Segment 2: Tinder-Style Discovery & Semantic Audio Search (0:25 – 0:55)

**On-Screen Action:**
- Click **"Find me a new podcast to love"** or the search blank.
- Type in a query or select an anchor show (e.g., *"All-In"* or a topic like *"Artificial Intelligence"*).
- The Tinder-style discovery deck opens.
- Click play on the featured 15-45s clip—the 24-bar waveform animates.
- Swipe or click **"Love It"** / **"Pass"** to transition to the next show.

**Voiceover:**
> *"Instead of guessing from show notes, DiscoPod hooks you up with 15-to-45-second audio hooks. Powered by **Convex Vector Search** and **OpenAI text-embedding-3-small**, listeners can drop in any mood, topic, or seed podcast.*
>
> *Our engine recommends candidate shows with playable preview clips. If a show isn't indexed yet, Convex schedules background ingestion instantly using `ctx.scheduler` without ever blocking the UI."*

---

### Segment 3: The Autonomous Firecrawl Research Agent (0:55 – 1:30)

**On-Screen Action:**
- Switch to the **Admin Tab (`/admin`)** or open a show's deep dive dossier.
- Scroll through the **"Show Your Work"** Research Report for a show like *All-In*:
  - Highlight the multi-host roster (Chamath, Jason, Sacks, Friedberg) with verified social handles.
  - Show the canonical website detection and scraped listener sentiment.
  - Highlight the chapter marker timestamps extracted from show notes.

**Voiceover:**
> *"Behind the scenes, we didn't just scrape RSS feeds—we built an autonomous **Firecrawl Web Research Agent**.*
>
> *Firecrawl searches canonical websites, bypasses hosting redirects, resolves multi-host rosters, extracts timestamped chapters, and analyzes listener reviews. Then, **OpenAI gpt-4o-mini** uses that research to ground clip extraction in real creator chapters and viral moments rather than random timestamps.*
>
> *All of this rich dossier is indexed directly into Convex tables in real-time."*

---

### Segment 4: AgentMail Creator Loop & HITL Anti-Competitor Safety (1:30 – 2:05)

**On-Screen Action:**
- Show the **"Claim Show"** / **"Host Access"** drawer or the Admin request view.
- Show the privacy-masked email preview (`in***********ail.com`).
- Flash an incoming claim email or AgentMail inbox view (`discopod-main@agentmail.to`).
- Briefly mention the network disambiguation and takedown safety.

**Voiceover:**
> *"Now for podcast creators: we integrated **AgentMail** via the `@agentmail/convex` component.*
>
> *Hosts can find their show and claim it. DiscoPod verifies their RSS email on file and dispatches a magic claim token. But we took it further: hosts can reply directly via email to re-slice their preview clip, customize their hook quote, or ask DiscoPod AI questions.*
>
> *And for security: takedowns from verified emails are honored instantly, while unverified competitor requests are safely routed to a **Human-in-the-Loop** admin queue. If a podcast network like Wondery has multiple shows on one email, our agent analyzes intent confidence so it never modifies the wrong show."*

---

### Segment 5: The Convex Stack & Closing (2:05 – 2:30)

**On-Screen Action:**
- Return to the live production landing page (`https://agreeable-pika-776.convex.site`).
- Spin the discoball one last time and show the retro-futuristic theme.
- Display the GitHub repo URL and live domain on screen or end on the DiscoPod logo.

**Voiceover:**
> *"The entire system runs on **Convex**: from vector search and scheduled background workers to Convex Auth and `@convex-dev/static-hosting`, published live on `convex.site`.*
>
> *Zero servers to manage, pure TypeScript end-to-end, and a fully reactive discovery engine.*
>
> *That’s DiscoPod. Thanks for watching, and see you on the dance floor!"*

---

## 💡 Top Tips for Recording

1. **Pacing:** Speak with rhythm—don't rush through the sponsor names (*Convex*, *Firecrawl*, *OpenAI*, *AgentMail*). Say them clearly so the judges catch every integration.
2. **Keep the Mouse Intentional:** Avoid frantic cursor circles. Smoothly guide the viewer's eye to what you're discussing (the audio waveform, the Firecrawl dossier, the email verification badge).
3. **Pre-load Clips:** Make sure your audio plays immediately on click so there's zero dead air during the Tinder deck demonstration.
