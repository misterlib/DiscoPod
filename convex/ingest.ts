import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { action, internalMutation, query } from "./_generated/server";

const PLATFORM_EMAIL_DOMAINS = [
  "transistor.fm",
  "anchor.fm",
  "spotify.com",
  "megaphone.fm",
  "libsyn.com",
  "podbean.com",
  "buzzsprout.com",
  "simplecast.com",
  "captivate.fm",
  "rss.com",
  "podtrac.com",
];

export const startIngest = action({
  args: {
    sourceType: v.union(v.literal("rss"), v.literal("apple"), v.literal("title")),
    sourceValue: v.string(),
  },
  returns: v.object({
    jobId: v.id("ingestJobs"),
  }),
  handler: async (ctx, args): Promise<{ jobId: Id<"ingestJobs"> }> => {
    const jobId: Id<"ingestJobs"> = await ctx.runMutation(internal.ingest.createIngestJob, {
      sourceType: args.sourceType,
      sourceValue: args.sourceValue,
    });

    // Run pipeline asynchronously
    await ctx.runAction(api.ingest.runIngestPipeline, {
      jobId,
      sourceType: args.sourceType,
      sourceValue: args.sourceValue,
    });

    return { jobId };
  },
});

export const createIngestJob = internalMutation({
  args: {
    sourceType: v.string(),
    sourceValue: v.string(),
  },
  returns: v.id("ingestJobs"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("ingestJobs", {
      status: "pending",
      stepDescription: "Initializing podcast discovery & ingest pipeline...",
      sourceType: args.sourceType,
      sourceValue: args.sourceValue,
    });
  },
});

export const updateJobStatus = internalMutation({
  args: {
    jobId: v.id("ingestJobs"),
    status: v.union(
      v.literal("pending"),
      v.literal("scraping_rss"),
      v.literal("slicing_hook"),
      v.literal("indexing_vector"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    stepDescription: v.string(),
    showId: v.optional(v.id("shows")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("ingestJobs", args.jobId, {
      status: args.status,
      stepDescription: args.stepDescription,
      ...(args.showId ? { showId: args.showId } : {}),
      ...(args.error ? { error: args.error } : {}),
    });
  },
});

export const getIngestJob = query({
  args: { jobId: v.id("ingestJobs") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("ingestJobs"),
      _creationTime: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("scraping_rss"),
        v.literal("slicing_hook"),
        v.literal("indexing_vector"),
        v.literal("completed"),
        v.literal("failed"),
      ),
      stepDescription: v.string(),
      sourceType: v.string(),
      sourceValue: v.string(),
      showId: v.optional(v.id("shows")),
      error: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get("ingestJobs", args.jobId);
  },
});

export const runIngestPipeline = action({
  args: {
    jobId: v.id("ingestJobs"),
    sourceType: v.union(v.literal("rss"), v.literal("apple"), v.literal("title")),
    sourceValue: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // ----------------------------------------------------------------------
      // Step 1: Scraping RSS & Firecrawl Host Contact Extraction
      // ----------------------------------------------------------------------
      await ctx.runMutation(internal.ingest.updateJobStatus, {
        jobId: args.jobId,
        status: "scraping_rss",
        stepDescription: "Scraping RSS feed & extracting media enclosures and contact signals...",
      });

      const feedResolution = await resolvePodcastFeedUrl(args.sourceType, args.sourceValue);
      const rssText = await fetchRssXml(feedResolution.feedUrl);
      const parsedFeed = parsePodcastRss(rssText, feedResolution);

      // Extract host email via heuristics
      const hostEmail = await extractHostEmailHeuristically({
        feedXml: rssText,
        websiteUrl: parsedFeed.websiteUrl,
        firecrawlKey: process.env.FIRECRAWL_API_KEY,
      });

      // ----------------------------------------------------------------------
      // Step 2: Slicing Hook via OpenAI GPT-4o
      // ----------------------------------------------------------------------
      await ctx.runMutation(internal.ingest.updateJobStatus, {
        jobId: args.jobId,
        status: "slicing_hook",
        stepDescription: "AI Narrative Hook Detection with GPT-4o (30–60s window)...",
      });

      const openAiKey = process.env.OPENAI_API_KEY;
      const hookResult = await extractNarrativeHookWithGpt4o({
        openAiKey,
        showTitle: parsedFeed.title,
        episodeTitle: parsedFeed.latestEpisode.title,
        summary: parsedFeed.latestEpisode.summary,
        audioDuration: parsedFeed.latestEpisode.durationSeconds,
      });

      // ----------------------------------------------------------------------
      // Step 3: Indexing Vector via text-embedding-3-small (1536-dim)
      // ----------------------------------------------------------------------
      await ctx.runMutation(internal.ingest.updateJobStatus, {
        jobId: args.jobId,
        status: "indexing_vector",
        stepDescription: "Generating 1536-dim vector embedding & mapping to Disco Globe...",
      });

      const vectorEmbedding = await generateVectorEmbedding({
        openAiKey,
        text: `${hookResult.hookText}\n\n${hookResult.transcriptExcerpt}`,
      });

      // Persist to database (shows, episodes, snippets, claims)
      const persistResult: { showId: Id<"shows">; claimToken: string } = await ctx.runMutation(
        internal.ingest.persistIngestedEntities,
        {
          show: {
            title: parsedFeed.title,
            slug: slugify(parsedFeed.title),
            description: parsedFeed.description,
            rssUrl: feedResolution.feedUrl,
            websiteUrl: parsedFeed.websiteUrl,
            coverArtUrl: parsedFeed.coverArtUrl,
            hostName: parsedFeed.hostName,
            hostEmail: hostEmail || undefined,
          },
          episode: {
            title: parsedFeed.latestEpisode.title,
            audioUrl: parsedFeed.latestEpisode.audioUrl,
            pubDate: parsedFeed.latestEpisode.pubDate,
            durationSeconds: parsedFeed.latestEpisode.durationSeconds,
            summary: parsedFeed.latestEpisode.summary,
          },
          snippet: {
            startTime: hookResult.startTime,
            endTime: hookResult.endTime,
            hookText: hookResult.hookText,
            transcriptExcerpt: hookResult.transcriptExcerpt,
            whyYouWillLikeIt: hookResult.whyYouWillLikeIt,
            vectorEmbedding,
          },
        },
      );

      // ----------------------------------------------------------------------
      // Step 4: Outbound Notification (Deferred until Listener Traction)
      // ----------------------------------------------------------------------
      // To avoid sending unsolicited emails during catalog ingestion, outbound notifications
      // are deferred until listeners discover the show on DiscoPod and hit the traction milestone.
      console.log(
        `[runIngestPipeline] Show "${parsedFeed.title}" mapped with claim token ${persistResult.claimToken}. Outbound creator notification deferred until listener traction is achieved.`,
      );

      // ----------------------------------------------------------------------
      // Step 5: Complete Ingestion Job
      // ----------------------------------------------------------------------
      await ctx.runMutation(internal.ingest.updateJobStatus, {
        jobId: args.jobId,
        status: "completed",
        stepDescription: "Show successfully mapped to Disco Globe!",
        showId: persistResult.showId,
      });
    } catch (err: any) {
      console.error("[runIngestPipeline] Failed:", err);
      await ctx.runMutation(internal.ingest.updateJobStatus, {
        jobId: args.jobId,
        status: "failed",
        stepDescription: "Ingestion failed.",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
});

export const persistIngestedEntities = internalMutation({
  args: {
    show: v.object({
      title: v.string(),
      slug: v.string(),
      description: v.string(),
      rssUrl: v.string(),
      websiteUrl: v.optional(v.string()),
      coverArtUrl: v.string(),
      hostName: v.optional(v.string()),
      hostEmail: v.optional(v.string()),
    }),
    episode: v.object({
      title: v.string(),
      audioUrl: v.string(),
      pubDate: v.number(),
      durationSeconds: v.number(),
      summary: v.string(),
    }),
    snippet: v.object({
      startTime: v.number(),
      endTime: v.number(),
      hookText: v.string(),
      transcriptExcerpt: v.string(),
      whyYouWillLikeIt: v.optional(v.string()),
      vectorEmbedding: v.array(v.float64()),
    }),
  },
  returns: v.object({
    showId: v.id("shows"),
    claimToken: v.string(),
  }),
  handler: async (ctx, args) => {
    // Check if show or RSS feed is tombstoned via takedown
    const norm = args.show.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    const tombstone = await ctx.db
      .query("takedownRequests")
      .withIndex("by_normalizedTitle", (q) => q.eq("normalizedTitle", norm))
      .first();

    const existingShow = await ctx.db
      .query("shows")
      .withIndex("by_slug", (q) => q.eq("slug", args.show.slug))
      .unique();

    if (tombstone || existingShow?.isTakenDown) {
      throw new Error(
        `Cannot persist "${args.show.title}": This podcast was removed via takedown request and is permanently tombstoned against re-indexing.`,
      );
    }

    const coordinates = computeCoordinates(args.show.slug);
    let showId: Id<"shows">;

    if (existingShow) {
      showId = existingShow._id;
      await ctx.db.patch("shows", showId, {
        title: args.show.title,
        description: args.show.description,
        rssUrl: args.show.rssUrl,
        websiteUrl: args.show.websiteUrl,
        coverArtUrl: args.show.coverArtUrl,
        hostName: args.show.hostName,
        hostEmail: args.show.hostEmail,
      });
    } else {
      showId = await ctx.db.insert("shows", {
        title: args.show.title,
        slug: args.show.slug,
        description: args.show.description,
        rssUrl: args.show.rssUrl,
        websiteUrl: args.show.websiteUrl,
        coverArtUrl: args.show.coverArtUrl,
        hostName: args.show.hostName,
        hostEmail: args.show.hostEmail,
        isClaimed: false,
        claimedByUserId: undefined,
        isAmped: false,
        ampScore: 0,
        coordinates,
      });
    }

    // 2. Check or insert episode
    const existingEpisode = await ctx.db
      .query("episodes")
      .withIndex("by_showId", (q) => q.eq("showId", showId))
      .filter((q) => q.eq(q.field("audioUrl"), args.episode.audioUrl))
      .first();

    const episodeId = existingEpisode
      ? existingEpisode._id
      : await ctx.db.insert("episodes", {
          showId,
          title: args.episode.title,
          audioUrl: args.episode.audioUrl,
          pubDate: args.episode.pubDate,
          durationSeconds: args.episode.durationSeconds,
          summary: args.episode.summary,
        });

    // 3. Insert snippet
    await ctx.db.insert("snippets", {
      episodeId,
      showId,
      startTime: args.snippet.startTime,
      endTime: args.snippet.endTime,
      hookText: args.snippet.hookText,
      transcriptExcerpt: args.snippet.transcriptExcerpt,
      whyYouWillLikeIt: args.snippet.whyYouWillLikeIt,
      vectorEmbedding: args.snippet.vectorEmbedding,
      playCount: 0,
      upvotes: 0,
    });

    // 4. Create show claim token
    const claimToken = `claim_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const existingClaim = await ctx.db
      .query("territoryClaims")
      .withIndex("by_showId", (q) => q.eq("showId", showId))
      .first();

    if (!existingClaim) {
      await ctx.db.insert("territoryClaims", {
        showId,
        inboxThreadId: "",
        claimStatus: "pending",
        token: claimToken,
      });
    }

    return {
      showId,
      claimToken: existingClaim?.token ?? claimToken,
    };
  },
});

export const updateClaimInboxThread = internalMutation({
  args: {
    showId: v.id("shows"),
    token: v.string(),
    inboxThreadId: v.string(),
  },
  handler: async (ctx, args) => {
    const claim = await ctx.db
      .query("territoryClaims")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .first();
    if (claim) {
      await ctx.db.patch("territoryClaims", claim._id, {
        inboxThreadId: args.inboxThreadId,
      });
    }
  },
});

// ----------------------------------------------------------------------------
// Helper Utilities & Heuristics
// ----------------------------------------------------------------------------

interface ResolvedFeedInfo {
  feedUrl: string;
  title?: string;
  coverArtUrl?: string;
  artistName?: string;
}

async function resolvePodcastFeedUrl(
  sourceType: "rss" | "apple" | "title",
  sourceValue: string,
): Promise<ResolvedFeedInfo> {
  const trimmed = sourceValue.trim();
  if (sourceType === "rss" || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (!trimmed.includes("podcasts.apple.com")) {
      return { feedUrl: trimmed };
    }
  }

  // If Apple podcast link or title, resolve via iTunes Search API
  let lookupQuery = trimmed;
  if (trimmed.includes("podcasts.apple.com")) {
    const match = trimmed.match(/id(\d+)/);
    if (match && match[1]) {
      const resp = await fetch(`https://itunes.apple.com/lookup?id=${match[1]}&entity=podcast`);
      if (resp.ok) {
        const data = (await resp.json()) as { results?: Array<{ feedUrl?: string; collectionName?: string; artworkUrl600?: string; artistName?: string }> };
        const found = data.results?.[0];
        if (found?.feedUrl) {
          return {
            feedUrl: found.feedUrl,
            title: found.collectionName,
            coverArtUrl: found.artworkUrl600,
            artistName: found.artistName,
          };
        }
      }
    }
  }

  const encoded = encodeURIComponent(lookupQuery);
  const searchResp = await fetch(`https://itunes.apple.com/search?term=${encoded}&entity=podcast&limit=3`);
  if (searchResp.ok) {
    const data = (await searchResp.json()) as { results?: Array<{ feedUrl?: string; collectionName?: string; artworkUrl600?: string; artistName?: string }> };
    const best = data.results?.[0];
    if (best?.feedUrl) {
      return {
        feedUrl: best.feedUrl,
        title: best.collectionName,
        coverArtUrl: best.artworkUrl600,
        artistName: best.artistName,
      };
    }
  }

  throw new Error(`Could not resolve RSS feed for podcast query: "${trimmed}"`);
}

async function fetchRssXml(feedUrl: string): Promise<string> {
  const res = await fetch(feedUrl, {
    headers: {
      "User-Agent": "DiscoPod/1.0 (+https://discopod.app; hackathon bot)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch RSS feed (${res.status} ${res.statusText})`);
  }
  return await res.text();
}

interface ParsedPodcastFeed {
  title: string;
  description: string;
  websiteUrl?: string;
  coverArtUrl: string;
  hostName?: string;
  latestEpisode: {
    title: string;
    audioUrl: string;
    pubDate: number;
    durationSeconds: number;
    summary: string;
  };
}

function parsePodcastRss(xml: string, resolved: ResolvedFeedInfo): ParsedPodcastFeed {
  const getTag = (tag: string, content: string) => {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
    const m = content.match(regex);
    return m ? cleanCdata(m[1].trim()) : "";
  };

  const channelMatch = xml.match(/<channel[^>]*>([\s\S]*?)<\/channel>/i);
  const channelContent = channelMatch ? channelMatch[1] : xml;

  const title = getTag("title", channelContent) || resolved.title || "Untitled Podcast";
  const description = getTag("description", channelContent) || getTag("itunes:summary", channelContent);
  const websiteUrl = getTag("link", channelContent) || undefined;
  const hostName = getTag("itunes:author", channelContent) || resolved.artistName || undefined;

  let coverArtUrl = resolved.coverArtUrl || "";
  if (!coverArtUrl) {
    const imgMatch = channelContent.match(/<itunes:image[^>]+href=["']([^"']+)["']/i);
    coverArtUrl = imgMatch ? imgMatch[1] : "https://placehold.co/600x600?text=DiscoPod";
  }

  // Parse latest item
  const itemMatch = channelContent.match(/<item[^>]*>([\s\S]*?)<\/item>/i);
  if (!itemMatch) {
    throw new Error("No episodes found in RSS feed.");
  }
  const itemContent = itemMatch[1];
  const epTitle = getTag("title", itemContent) || "Latest Episode";
  const epSummary = getTag("description", itemContent) || getTag("itunes:summary", itemContent) || epTitle;

  const enclosureMatch = itemContent.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  const audioUrl = enclosureMatch ? enclosureMatch[1] : "";
  if (!audioUrl) {
    throw new Error("Latest episode does not contain a media enclosure audio URL.");
  }

  const pubDateStr = getTag("pubDate", itemContent);
  const pubDate = pubDateStr ? new Date(pubDateStr).getTime() || Date.now() : Date.now();

  const durationStr = getTag("itunes:duration", itemContent);
  const durationSeconds = parseDuration(durationStr) || 1800;

  return {
    title,
    description,
    websiteUrl,
    coverArtUrl,
    hostName,
    latestEpisode: {
      title: epTitle,
      audioUrl,
      pubDate,
      durationSeconds,
      summary: epSummary,
    },
  };
}

function cleanCdata(str: string): string {
  return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function parseDuration(duration?: string): number {
  if (!duration) return 0;
  if (/^\d+$/.test(duration.trim())) return parseInt(duration.trim(), 10);
  const parts = duration.trim().split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

/**
 * Heuristic Host Email Extraction:
 * 1. Inspect <itunes:owner><itunes:email> in feed XML
 * 2. If website available and Firecrawl key configured, scrape contact page
 * 3. Filter out hosting platform domains (@transistor.fm, @anchor.fm, etc.)
 */
async function extractHostEmailHeuristically({
  feedXml,
  websiteUrl,
  firecrawlKey,
}: {
  feedXml: string;
  websiteUrl?: string;
  firecrawlKey?: string;
}): Promise<string | null> {
  const isPlatformDomain = (email: string) => {
    const domain = email.split("@")[1]?.toLowerCase();
    return PLATFORM_EMAIL_DOMAINS.some((p) => domain === p || domain?.endsWith(`.${p}`));
  };

  // 1. Check <itunes:owner><itunes:email>
  const ownerMatch = feedXml.match(/<itunes:owner>([\s\S]*?)<\/itunes:owner>/i);
  if (ownerMatch) {
    const emailMatch = ownerMatch[1].match(/<itunes:email>([^<]+)<\/itunes:email>/i);
    if (emailMatch) {
      const email = emailMatch[1].trim().toLowerCase();
      if (!isPlatformDomain(email)) {
        return email;
      }
    }
  }

  // 2. Check general <itunes:email>
  const anyEmailMatch = feedXml.match(/<itunes:email>([^<]+)<\/itunes:email>/i);
  if (anyEmailMatch) {
    const email = anyEmailMatch[1].trim().toLowerCase();
    if (!isPlatformDomain(email)) {
      return email;
    }
  }

  // 3. Check official show website contact page via Firecrawl if available
  if (websiteUrl && firecrawlKey) {
    try {
      const contactUrl = websiteUrl.replace(/\/+$/, "") + "/contact";
      const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: contactUrl,
          formats: ["markdown"],
        }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { data?: { markdown?: string } };
        const text = data.data?.markdown || "";
        const extracted = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        if (extracted) {
          for (const email of extracted) {
            const clean = email.trim().toLowerCase();
            if (!isPlatformDomain(clean)) {
              return clean;
            }
          }
        }
      }
    } catch {
      // Firecrawl scrape failure shouldn't fail ingestion
    }
  }

  return null;
}

interface NarrativeHook {
  startTime: number;
  endTime: number;
  hookText: string;
  transcriptExcerpt: string;
  whyYouWillLikeIt: string;
}

async function extractNarrativeHookWithGpt4o({
  openAiKey,
  showTitle,
  episodeTitle,
  summary,
  audioDuration,
}: {
  openAiKey?: string;
  showTitle: string;
  episodeTitle: string;
  summary: string;
  audioDuration: number;
}): Promise<NarrativeHook> {
  const defaultHook: NarrativeHook = {
    startTime: 15,
    endTime: Math.min(60, audioDuration > 45 ? 60 : audioDuration),
    hookText: `Listen to "${episodeTitle}" from ${showTitle}`,
    transcriptExcerpt: summary.slice(0, 300) || `Highlight clip from ${showTitle}.`,
    whyYouWillLikeIt: "A compelling discussion on breakthrough concepts and real-world stories.",
  };

  if (!openAiKey) {
    return defaultHook;
  }

  try {
    const prompt = `You are a viral audio curator for DiscoPod.
We are creating a 45-second high-energy Disco Reel from this podcast episode:
Podcast: "${showTitle}"
Episode: "${episodeTitle}"
Episode Duration: ${audioDuration} seconds
Show Notes & Summary:
${summary.slice(0, 2500)}

Task:
Identify the single most captivating, punchy, 30 to 60-second narrative hook window in this episode based on the summary and topic themes.
Select a reasonable start and end time (within 0 to ${audioDuration} seconds, duration 30-60s).
Extract or craft the punchy hook line and the core transcript excerpt.

Respond strictly in JSON format:
{
  "startTime": <number in seconds>,
  "endTime": <number in seconds>,
  "hookText": "<one clear, captivating sentence summarizing the hook>",
  "transcriptExcerpt": "<2 to 4 sentences representing the core spoken thesis of this moment>",
  "whyYouWillLikeIt": "<1 sentence on why a listener will fall in love with this episode>"
}`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!resp.ok) {
      return defaultHook;
    }

    const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return defaultHook;

    const parsed = JSON.parse(content) as Partial<NarrativeHook>;
    const startTime = typeof parsed.startTime === "number" ? Math.max(0, parsed.startTime) : 30;
    const endTime = typeof parsed.endTime === "number" ? Math.min(audioDuration || 300, parsed.endTime) : startTime + 45;

    return {
      startTime,
      endTime: endTime > startTime ? endTime : startTime + 45,
      hookText: parsed.hookText || defaultHook.hookText,
      transcriptExcerpt: parsed.transcriptExcerpt || defaultHook.transcriptExcerpt,
      whyYouWillLikeIt: parsed.whyYouWillLikeIt || defaultHook.whyYouWillLikeIt,
    };
  } catch (err) {
    console.error("[extractNarrativeHookWithGpt4o] Error:", err);
    return defaultHook;
  }
}

async function generateVectorEmbedding({
  openAiKey,
  text,
}: {
  openAiKey?: string;
  text: string;
}): Promise<number[]> {
  if (!openAiKey) {
    // Generate deterministic 1536-dim normalized vector if key is not configured
    const vec = new Array(1536).fill(0);
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
    }
    for (let i = 0; i < 1536; i++) {
      vec[i] = Math.sin(h + i * 0.1);
    }
    const mag = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
    return vec.map((v) => v / mag);
  }

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI embedding failed with ${res.status}`);
  }

  const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  const embedding = json.data?.[0]?.embedding;
  if (!embedding || embedding.length !== 1536) {
    throw new Error("Invalid embedding returned from OpenAI");
  }
  return embedding;
}

function computeCoordinates(slug: string): { x: number; y: number; z: number } {
  let h1 = 0;
  let h2 = 0;
  for (let i = 0; i < slug.length; i++) {
    h1 = (Math.imul(31, h1) + slug.charCodeAt(i)) | 0;
    h2 = (Math.imul(17, h2) + slug.charCodeAt(i)) | 0;
  }
  // Uniform sphere projection using Archimedes theorem
  const u = (Math.abs(h1) % 10000) / 5000 - 1; // y in [-1, 1]
  const theta = ((Math.abs(h2) % 10000) / 10000) * 2 * Math.PI;
  const r = Math.sqrt(Math.max(0, 1 - u * u));
  const x = Number((r * Math.cos(theta)).toFixed(4));
  const y = Number(u.toFixed(4));
  const z = Number((r * Math.sin(theta)).toFixed(4));
  return { x, y, z };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}
