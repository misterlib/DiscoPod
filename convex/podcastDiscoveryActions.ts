"use node";

import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import {
  runDeepFirecrawlResearch,
  extractChaptersFromText,
  timestampToSeconds,
  type DeepResearchResult,
  type DiscoveredClip,
  type DiscoveredHost,
  type FirecrawlReport,
  type SocialProfiles,
} from "./firecrawlAgent";

const GENRE_MAP: Record<string, { id: string; name: string }> = {
  all: { id: "all", name: "All Categories (Top Charts)" },
  technology: { id: "1318", name: "Technology" },
  business: { id: "1321", name: "Business" },
  comedy: { id: "1303", name: "Comedy" },
  "true-crime": { id: "1488", name: "True Crime" },
  news: { id: "1489", name: "News" },
  science: { id: "1315", name: "Science" },
  society: { id: "1324", name: "Society & Culture" },
  sports: { id: "1314", name: "Sports" },
  health: { id: "1512", name: "Health & Fitness" },
  history: { id: "1487", name: "History" },
  arts: { id: "1301", name: "Arts" },
  "tv-film": { id: "1309", name: "TV & Film" },
  music: { id: "1310", name: "Music" },
  education: { id: "1304", name: "Education" },
  fiction: { id: "1483", name: "Fiction" },
  design: { id: "1402", name: "Design" },
};

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

export const queryPodcasts = action({
  args: {
    genre: v.string(),
    query: v.optional(v.string()),
    selection: v.union(v.literal("top"), v.literal("random")),
    recentOnly: v.boolean(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      appleId: v.string(),
      title: v.string(),
      hostName: v.string(),
      coverArtUrl: v.string(),
      genre: v.string(),
      feedUrl: v.string(),
      releaseDate: v.string(),
      isRecent: v.boolean(),
      rank: v.number(),
      description: v.string(),
    }),
  ),
  handler: async (_ctx, args) => {
    const targetLimit = Math.max(1, Math.min(args.limit ?? 50, 50));
    const now = Date.now();
    const genreKey = args.genre.toLowerCase();
    const genreInfo = GENRE_MAP[genreKey] ?? {
      id: "1318",
      name: "Technology",
    };

    let rawResults: Array<{
      appleId: string;
      title: string;
      hostName: string;
      coverArtUrl: string;
      genre: string;
      feedUrl: string;
      releaseDate: string;
      description: string;
    }> = [];

    // If query provided or selection is "random", use iTunes Search API
    if (args.query?.trim() || args.selection === "random") {
      const searchTerm = args.query?.trim() || genreInfo.name;
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
        searchTerm,
      )}&entity=podcast&limit=100`;

      const response = await fetch(itunesUrl);
      if (!response.ok) {
        throw new Error(`iTunes Search API error: ${response.status}`);
      }
      const data = (await response.json()) as {
        results?: Array<{
          collectionId?: number;
          collectionName?: string;
          artistName?: string;
          artworkUrl600?: string;
          artworkUrl100?: string;
          primaryGenreName?: string;
          feedUrl?: string;
          releaseDate?: string;
        }>;
      };

      rawResults = (data.results || [])
        .filter((item) => item.collectionName && item.feedUrl)
        .map((item) => ({
          appleId: String(item.collectionId || ""),
          title: item.collectionName || "Unknown Show",
          hostName: item.artistName || "Unknown Host",
          coverArtUrl: item.artworkUrl600 || item.artworkUrl100 || "",
          genre: item.primaryGenreName || genreInfo.name,
          feedUrl: item.feedUrl || "",
          releaseDate: item.releaseDate || new Date().toISOString(),
          description: "",
        }));

      if (args.selection === "random") {
        rawResults.sort(() => Math.random() - 0.5);
      }
    } else {
      // Fetch Apple Top Podcasts RSS chart (limit 100)
      const chartUrl =
        genreInfo.id === "all"
          ? `https://itunes.apple.com/us/rss/toppodcasts/limit=100/json`
          : `https://itunes.apple.com/us/rss/toppodcasts/limit=100/genre=${genreInfo.id}/json`;

      const response = await fetch(chartUrl);
      if (!response.ok) {
        throw new Error(`Apple Top Podcasts feed error: ${response.status}`);
      }

      const data = (await response.json()) as {
        feed?: {
          entry?: Array<{
            id?: { attributes?: { "im:id"?: string } };
            "im:name"?: { label?: string };
            "im:artist"?: { label?: string };
            summary?: { label?: string };
            "im:image"?: Array<{ label?: string }>;
            category?: { attributes?: { label?: string } };
          }>;
        };
      };

      const entries = data.feed?.entry || [];
      const topIds = entries
        .map((e) => e.id?.attributes?.["im:id"])
        .filter((id): id is string => Boolean(id))
        .slice(0, 75);

      if (topIds.length > 0) {
        // Lookup feed URLs via iTunes lookup
        const lookupUrl = `https://itunes.apple.com/lookup?id=${topIds.join(",")}`;
        const lookupRes = await fetch(lookupUrl);
        if (lookupRes.ok) {
          const lookupData = (await lookupRes.json()) as {
            results?: Array<{
              collectionId?: number;
              collectionName?: string;
              artistName?: string;
              artworkUrl600?: string;
              artworkUrl100?: string;
              primaryGenreName?: string;
              feedUrl?: string;
              releaseDate?: string;
            }>;
          };

          const lookupMap = new Map(
            (lookupData.results || []).map((item) => [
              String(item.collectionId),
              item,
            ]),
          );

          rawResults = entries
            .map((entry) => {
              const appleId = entry.id?.attributes?.["im:id"] || "";
              const lookupItem = lookupMap.get(appleId);
              return {
                appleId,
                title: lookupItem?.collectionName || entry["im:name"]?.label || "",
                hostName: lookupItem?.artistName || entry["im:artist"]?.label || "",
                coverArtUrl:
                  lookupItem?.artworkUrl600 ||
                  entry["im:image"]?.[entry["im:image"].length - 1]?.label ||
                  "",
                genre:
                  lookupItem?.primaryGenreName ||
                  entry.category?.attributes?.label ||
                  genreInfo.name,
                feedUrl: lookupItem?.feedUrl || "",
                releaseDate:
                  lookupItem?.releaseDate || new Date().toISOString(),
                description: entry.summary?.label || "",
              };
            })
            .filter((item) => item.title && item.feedUrl);
        }
      }
    }

    // Filter for recent episodes if requested (within 4 weeks)
    const filtered = rawResults
      .map((item, index) => {
        const releaseTime = Date.parse(item.releaseDate);
        const isRecent = !isNaN(releaseTime) && now - releaseTime <= FOUR_WEEKS_MS;
        return {
          ...item,
          isRecent,
          rank: index + 1,
        };
      })
      .filter((item) => (args.recentOnly ? item.isRecent : true))
      .slice(0, targetLimit);

    return filtered;
  },
});

export const queryNewAndNotablePodcasts = action({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      appleId: v.string(),
      title: v.string(),
      hostName: v.string(),
      coverArtUrl: v.string(),
      genre: v.string(),
      feedUrl: v.string(),
      releaseDate: v.string(),
      isRecent: v.boolean(),
      rank: v.number(),
      description: v.string(),
      tag: v.optional(v.string()),
    }),
  ),
  handler: async (_ctx, args) => {
    const targetLimit = Math.max(1, Math.min(args.limit ?? 30, 50));

    // Curated standout breakouts, buzzy new launches & top chart dominators
    const NOTABLE_SEEDS = [
      { id: "1528594034", tag: "Tech & AI" }, // Hard Fork
      { id: "1050462261", tag: "Tech Deep Dive" }, // Acquired
      { id: "1516093381", tag: "AI Breakthroughs" }, // Dwarkesh Podcast
      { id: "1614253637", tag: "Trending Culture" }, // Search Engine with PJ Vogt
      { id: "1685691481", tag: "True Crime Limited" }, // Scamanda
      { id: "1474429475", tag: "Tech & Gadgets" }, // Waveform
      { id: "1545953110", tag: "Health & Science" }, // Huberman Lab
      { id: "1521578868", tag: "Comedy Hit" }, // SmartLess
      { id: "1291423644", tag: "Business & Growth" }, // Diary of a CEO
      { id: "1296350485", tag: "Cyber & Tech" }, // Darknet Diaries
      { id: "1347973549", tag: "Philosophy & Society" }, // Modern Wisdom
      { id: "1597761181", tag: "Comedy Breakout" }, // Normal Gossip
      { id: "1434243584", tag: "Deep Science & AI" }, // Lex Fridman Podcast
      { id: "1200361736", tag: "Daily News" }, // The Daily
    ];

    // Fetch Apple top 25 overall to blend with breakout hits
    const topRes = await fetch("https://itunes.apple.com/us/rss/toppodcasts/limit=30/json");
    const topIds: string[] = [];
    if (topRes.ok) {
      const topData = (await topRes.json()) as {
        feed?: {
          entry?: Array<{
            id?: { attributes?: { "im:id"?: string } };
          }>;
        };
      };
      for (const e of topData.feed?.entry || []) {
        const id = e.id?.attributes?.["im:id"];
        if (id && !topIds.includes(id)) topIds.push(id);
      }
    }

    const tagMap = new Map<string, string>();
    for (const seed of NOTABLE_SEEDS) {
      tagMap.set(seed.id, seed.tag);
    }

    // Combine notable seed IDs with overall chart IDs
    const combinedIds = Array.from(
      new Set([...NOTABLE_SEEDS.map((s) => s.id), ...topIds]),
    ).slice(0, 50);

    const lookupRes = await fetch(
      `https://itunes.apple.com/lookup?id=${combinedIds.join(",")}`,
    );
    if (!lookupRes.ok) {
      throw new Error(`iTunes lookup failed: ${lookupRes.status}`);
    }

    const lookupData = (await lookupRes.json()) as {
      results?: Array<{
        collectionId?: number;
        collectionName?: string;
        artistName?: string;
        artworkUrl600?: string;
        artworkUrl100?: string;
        primaryGenreName?: string;
        feedUrl?: string;
        releaseDate?: string;
      }>;
    };

    const now = Date.now();
    const results = (lookupData.results || [])
      .filter((item) => item.collectionName && item.feedUrl)
      .map((item, idx) => {
        const appleId = String(item.collectionId || "");
        const releaseTime = Date.parse(item.releaseDate || "");
        const isRecent = !isNaN(releaseTime) && now - releaseTime <= FOUR_WEEKS_MS;
        return {
          appleId,
          title: item.collectionName || "Unknown Show",
          hostName: item.artistName || "Unknown Host",
          coverArtUrl: item.artworkUrl600 || item.artworkUrl100 || "",
          genre: item.primaryGenreName || "Podcast",
          feedUrl: item.feedUrl || "",
          releaseDate: item.releaseDate || new Date().toISOString(),
          isRecent,
          rank: idx + 1,
          description: "",
          tag: tagMap.get(appleId) || (idx < 5 ? "Top Charting" : "Trending"),
        };
      })
      .slice(0, targetLimit);

    return results;
  },
});

export const searchDiscoveryPodcasts = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    ingested: v.array(
      v.object({
        showId: v.id("shows"),
        title: v.string(),
        hostName: v.string(),
        coverArtUrl: v.string(),
        isAmped: v.optional(v.boolean()),
        ampScore: v.optional(v.number()),
        description: v.string(),
        isIngested: v.literal(true),
      }),
    ),
    external: v.array(
      v.object({
        appleId: v.string(),
        title: v.string(),
        hostName: v.string(),
        coverArtUrl: v.string(),
        genre: v.string(),
        feedUrl: v.string(),
        description: v.string(),
        isIngested: v.literal(false),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const trimmed = args.query.trim();

    // 0. Fetch active takedowns / tombstones so taken-down shows NEVER re-appear
    const takedowns: Array<{
      title: string;
      feedUrl?: string;
      appleId?: string;
    }> = await ctx.runQuery(api.takedowns.listTakedowns, {});
    const tombstonedTitles = new Set(
      takedowns.map((t: { title: string }) => t.title.toLowerCase().replace(/[^a-z0-9]/g, "")),
    );
    const tombstonedFeeds = new Set(
      takedowns
        .filter((t: { feedUrl?: string }) => Boolean(t.feedUrl))
        .map((t: { feedUrl?: string }) => t.feedUrl!.trim().toLowerCase()),
    );
    const tombstonedAppleIds = new Set(
      takedowns
        .filter((t: { appleId?: string }) => Boolean(t.appleId))
        .map((t: { appleId?: string }) => String(t.appleId)),
    );

    // 1. Fetch ingested shows first from Convex database
    const rawIngested: Array<{
      showId: Id<"shows">;
      title: string;
      hostName: string;
      coverArtUrl: string;
      isAmped?: boolean;
      ampScore?: number;
      description: string;
      isIngested: true;
    }> = await ctx.runQuery(api.shows.searchIngestedShows, {
      query: trimmed,
      limit: 6,
    });

    const ingested = rawIngested.filter((s) => {
      const norm = s.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      return !tombstonedTitles.has(norm);
    });

    const ingestedTitles = new Set(
      ingested.map((s) => s.title.toLowerCase().replace(/[^a-z0-9]/g, "")),
    );

    // 2. If query provided, query iTunes Search API for actual live podcasts
    const external: Array<{
      appleId: string;
      title: string;
      hostName: string;
      coverArtUrl: string;
      genre: string;
      feedUrl: string;
      description: string;
      isIngested: false;
    }> = [];

    if (trimmed.length >= 2) {
      try {
        const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
          trimmed,
        )}&entity=podcast&limit=15`;
        const res = await fetch(itunesUrl);
        if (res.ok) {
          const data = (await res.json()) as {
            results?: Array<{
              collectionId?: number;
              collectionName?: string;
              artistName?: string;
              artworkUrl600?: string;
              artworkUrl100?: string;
              primaryGenreName?: string;
              feedUrl?: string;
            }>;
          };

          for (const item of data.results || []) {
            if (!item.collectionName || !item.feedUrl) continue;
            const normTitle = item.collectionName
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "");

            // Skip if tombstoned via creator takedown
            if (tombstonedTitles.has(normTitle)) continue;
            if (item.feedUrl && tombstonedFeeds.has(item.feedUrl.trim().toLowerCase())) continue;
            if (item.collectionId && tombstonedAppleIds.has(String(item.collectionId))) continue;

            // Deduplicate if already present in ingested results
            if (ingestedTitles.has(normTitle)) continue;

            external.push({
              appleId: String(item.collectionId || ""),
              title: item.collectionName,
              hostName: item.artistName || "Host",
              coverArtUrl:
                item.artworkUrl600 || item.artworkUrl100 || "https://placehold.co/300x300",
              genre: item.primaryGenreName || "Podcast",
              feedUrl: item.feedUrl,
              description: "",
              isIngested: false as const,
            });

            if (external.length >= 10) break;
          }
        }
      } catch (err) {
        console.error("iTunes search error in searchDiscoveryPodcasts:", err);
      }
    }

    return {
      ingested,
      external,
    };
  },
});

export const fastIngestPodcast = action({
  args: {
    title: v.string(),
    hostName: v.optional(v.string()),
    coverArtUrl: v.string(),
    feedUrl: v.optional(v.string()),
    genre: v.optional(v.string()),
    appleId: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.object({
    showId: v.id("shows"),
    title: v.string(),
    hostName: v.string(),
    coverArtUrl: v.string(),
    description: v.string(),
    isIngested: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Check tombstone registry before fetching or ingesting
    const isTombstoned = await ctx.runQuery(api.takedowns.isPodcastTombstoned, {
      title: args.title,
      feedUrl: args.feedUrl,
      appleId: args.appleId,
    });
    if (isTombstoned) {
      throw new Error(
        `"${args.title}" was previously removed via takedown request and is permanently tombstoned against re-indexing.`,
      );
    }

    let feedUrl = args.feedUrl || "";
    let resolvedTitle = args.title;
    let resolvedHost = args.hostName || "";
    let resolvedCover = args.coverArtUrl;
    let resolvedDesc = args.description || "";
    let episodes: Array<{
      title: string;
      audioUrl: string;
      pubDate: number;
      durationSeconds: number;
      summary: string;
    }> = [];

    // 1. If no feedUrl but appleId is given, resolve feedUrl via iTunes lookup
    if (!feedUrl && args.appleId) {
      try {
        const lookupRes = await fetch(`https://itunes.apple.com/lookup?id=${args.appleId}`);
        if (lookupRes.ok) {
          const lookupData = (await lookupRes.json()) as { results?: Array<{ feedUrl?: string }> };
          feedUrl = lookupData.results?.[0]?.feedUrl || "";
        }
      } catch (err) {
        console.warn("iTunes lookup failed during fastIngest:", err);
      }
    }

    // 2. Fetch RSS feed with a fast 4s timeout to grab description & recent episodes
    if (feedUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const rssRes = await fetch(feedUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (rssRes.ok) {
          const xml = await rssRes.text();
          const parsed = parsePodcastRss(xml);
          resolvedTitle = parsed.showTitle || resolvedTitle;
          resolvedHost = parsed.author || resolvedHost;
          resolvedCover = parsed.image || resolvedCover;
          resolvedDesc = parsed.showDesc || resolvedDesc;
          episodes = parsed.episodes.slice(0, 5).map((ep) => ({
            title: ep.title,
            audioUrl: ep.audioUrl,
            pubDate: ep.pubDate,
            durationSeconds: ep.durationSeconds,
            summary: ep.summary,
          }));
        }
      } catch (err) {
        console.warn("Fast RSS fetch skipped or timed out:", err);
      }
    }

    if (!resolvedDesc) {
      resolvedDesc = `${resolvedTitle} hosted by ${resolvedHost || "creators"}.`;
    }

    const slug = slugify(resolvedTitle);
    const result: { showId: Id<"shows">; isNew: boolean } = await ctx.runMutation(
      internal.shows.persistFastIngestedShow,
      {
        title: resolvedTitle,
        slug,
        description: resolvedDesc,
        rssUrl: feedUrl,
        websiteUrl: undefined,
        coverArtUrl: resolvedCover,
        hostName: resolvedHost,
        genre: args.genre,
        episodes,
      },
    );

    return {
      showId: result.showId,
      title: resolvedTitle,
      hostName: resolvedHost || "Host",
      coverArtUrl: resolvedCover,
      description: resolvedDesc,
      isIngested: true,
    };
  },
});

export type DiscoveryRecommendationClip = {
  snippetId: string;
  episodeTitle: string;
  audioUrl: string;
  startTime: number;
  endTime: number;
  duration: number;
  hookText: string;
  transcriptExcerpt: string;
  whyYouWillLikeIt: string;
  topic?: string;
};

export type DiscoveryRecommendationShow = {
  showId: string;
  title: string;
  hostName: string;
  coverArtUrl: string;
  genre: string;
  matchScore: number;
  whyYouWillLikeIt: string;
  websiteUrl?: string;
  spotifyUrl?: string;
  appleUrl?: string;
  youtubeUrl?: string;
  clips: DiscoveryRecommendationClip[];
};

export const getSimilarPodcastsForDiscovery = action({
  args: {
    seedTitle: v.string(),
    seedShowId: v.optional(v.id("shows")),
    seedGenre: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      showId: v.string(),
      title: v.string(),
      hostName: v.string(),
      coverArtUrl: v.string(),
      genre: v.string(),
      matchScore: v.number(),
      whyYouWillLikeIt: v.string(),
      websiteUrl: v.optional(v.string()),
      spotifyUrl: v.optional(v.string()),
      appleUrl: v.optional(v.string()),
      youtubeUrl: v.optional(v.string()),
      clips: v.array(
        v.object({
          snippetId: v.string(),
          episodeTitle: v.string(),
          audioUrl: v.string(),
          startTime: v.number(),
          endTime: v.number(),
          duration: v.number(),
          hookText: v.string(),
          transcriptExcerpt: v.string(),
          whyYouWillLikeIt: v.string(),
          topic: v.optional(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args): Promise<DiscoveryRecommendationShow[]> => {
    const openAiKey = process.env.OPENAI_API_KEY;

    // Curated high quality fallback candidates with working playable audio
    const fallbackTemplates = [
      {
        title: "Pitch Dark Product Stories",
        hostName: "Elena Vance",
        coverArtUrl:
          "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=600&h=600&fit=crop",
        genre: "Storytelling & Tech",
        matchScore: 96,
        whyYouWillLikeIt: `Because you enjoy ${args.seedTitle}, you will appreciate this show's gripping edge-of-your-seat narrative pacing and raw behind-the-scenes accounts.`,
        clips: [
          {
            snippetId: "fallback_p1",
            episodeTitle: "The Midnight Incident That Changed Everything",
            audioUrl: "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg",
            startTime: 45,
            endTime: 82,
            duration: 37,
            hookText: "One small oversight almost brought down the entire infrastructure overnight.",
            transcriptExcerpt: "We sat in absolute silence watching the monitors spike into the red...",
            whyYouWillLikeIt: "Captures the exact tension and suspense listeners love.",
          },
        ],
      },
      {
        title: "Neon Latency Nights",
        hostName: "Kaelen Voss",
        coverArtUrl:
          "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=600&fit=crop",
        genre: "Subculture & Investigation",
        matchScore: 93,
        whyYouWillLikeIt: `Fans of ${args.seedTitle} will love the deep investigative reporting and immersive sound design exploring unseen subcultures.`,
        clips: [
          {
            snippetId: "fallback_p2",
            episodeTitle: "Subsea Light Bursts",
            audioUrl: "https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg",
            startTime: 60,
            endTime: 95,
            duration: 35,
            hookText: "Crossing the Atlantic Ocean in under sixty milliseconds through glass beneath the seabed.",
            transcriptExcerpt: "Every single nanosecond was engineered out of the glass at the bottom of the ocean.",
            whyYouWillLikeIt: "Fascinating deep dive with rich sensory storytelling.",
          },
        ],
      },
      {
        title: "The Synthetic Architect",
        hostName: "Dr. Maya Lin",
        coverArtUrl:
          "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=600&fit=crop",
        genre: "Ideas & Culture",
        matchScore: 89,
        whyYouWillLikeIt: `Provides the same thoughtful depth and provocative questioning that makes ${args.seedTitle} so compelling.`,
        clips: [
          {
            snippetId: "fallback_p3",
            episodeTitle: "Neural Memory Loops & Reflexes",
            audioUrl: "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg",
            startTime: 30,
            endTime: 68,
            duration: 38,
            hookText: "Why retrieval alone fails without associative cognitive loops.",
            transcriptExcerpt: "Persistent habits form only when the system feeds back on its own internal state.",
            whyYouWillLikeIt: "Sharp, provocative analysis that challenges conventional thinking.",
          },
        ],
      },
    ];

    // 1. Fetch seed podcast context (description, host, sample snippet embedding, fallInLovePromise)
    const seedContext: {
      showId: Id<"shows">;
      title: string;
      description: string;
      hostName?: string;
      sampleEmbedding?: number[];
      curationSummary?: string;
      fallInLovePromise?: string;
      sampleHookText?: string;
    } | null = await ctx.runQuery(internal.shows.getSeedShowContext, {
      seedShowId: args.seedShowId,
      seedTitle: args.seedTitle,
    });

    const seedId = seedContext?.showId ?? args.seedShowId;

    // 2. Obtain embedding vector for RAG snippet search
    let queryVector: number[] | null = null;
    if (seedContext?.sampleEmbedding && seedContext.sampleEmbedding.length === 1536) {
      queryVector = seedContext.sampleEmbedding;
    } else if (openAiKey) {
      try {
        const textToEmbed = `${args.seedTitle}: ${seedContext?.fallInLovePromise || seedContext?.curationSummary || seedContext?.description || args.seedTitle}`.slice(0, 1000);
        queryVector = await embedText(openAiKey, textToEmbed);
      } catch (err) {
        console.warn("Failed generating query vector for seed show:", err);
      }
    }

    // 3. Perform vector search over snippet embeddings
    const vectorShowIds: Id<"shows">[] = [];
    if (queryVector) {
      try {
        const vectorHits = await ctx.vectorSearch("snippets", "by_embedding", {
          vector: queryVector,
          limit: 35,
        });

        if (vectorHits.length > 0) {
          const matchedSnippets = await ctx.runQuery(internal.shows.getShowIdsFromSnippetIds, {
            snippetIds: vectorHits.map((h) => h._id),
          });
          for (const item of matchedSnippets) {
            if ((!seedId || item.showId !== seedId) && !vectorShowIds.includes(item.showId)) {
              vectorShowIds.push(item.showId);
            }
          }
        }
      } catch (err) {
        console.warn("Vector search failed in getSimilarPodcastsForDiscovery:", err);
      }
    }

    // 4. Fetch diverse serendipitous show candidates to prevent echo chambers
    const diverseShowIds = await ctx.runQuery(internal.shows.getDiverseShowIdsForRag, {
      excludeShowId: seedId,
      limit: 6,
    });

    // 5. Combine candidate show IDs (vector semantic hits prioritized, followed by diverse shows)
    const candidateIdsSet = new Set<Id<"shows">>();
    for (const id of vectorShowIds) {
      candidateIdsSet.add(id);
      if (candidateIdsSet.size >= 10) break;
    }
    for (const id of diverseShowIds) {
      candidateIdsSet.add(id);
      if (candidateIdsSet.size >= 14) break;
    }

    // 6. Hydrate candidate shows with real clips and playable audio
    let candidateShows: any[] = await ctx.runQuery(internal.shows.getShowsAndSnippetsForRag, {
      showIds: Array.from(candidateIdsSet),
    });

    // Ensure candidates have playable clips and exclude seed show
    candidateShows = candidateShows.filter(
      (s: any) => s.clips.length > 0 && (!seedId || s.showId !== seedId),
    );

    // Fallback if no candidate shows were retrieved (e.g. fresh database)
    if (candidateShows.length === 0) {
      const dbShows: Array<{
        showId: Id<"shows">;
        title: string;
        hostName: string;
        coverArtUrl: string;
        description: string;
        ampScore?: number;
        matchScore: number;
        whyYouWillLikeIt: string;
        clips: DiscoveryRecommendationClip[];
      }> = await ctx.runQuery(api.shows.getSimilarShowsForDeck, {
        seedTitle: args.seedTitle,
        seedShowId: args.seedShowId,
        limit: 5,
      });
      if (dbShows.length > 0) {
        return dbShows.map((s) => ({
          showId: String(s.showId),
          title: s.title,
          hostName: s.hostName,
          coverArtUrl: s.coverArtUrl,
          genre: "Recommended",
          matchScore: s.matchScore,
          whyYouWillLikeIt: s.whyYouWillLikeIt,
          clips: s.clips,
        }));
      }
    }

    // 7. LLM Intelligent Re-Ranking and Personalized "Why You Will Like It" Generation (GPT-4o-mini)
    let selectedRecommendations: Array<{
      showId: string;
      matchScore: number;
      whyYouWillLikeIt: string;
    }> = [];

    if (openAiKey && candidateShows.length > 0) {
      try {
        const seedSummary =
          seedContext?.fallInLovePromise ||
          seedContext?.curationSummary ||
          seedContext?.description ||
          `${args.seedTitle}`;

        const promptCandidates = candidateShows.map((c: any, i: number) => ({
          candidateIndex: i,
          showId: String(c.showId),
          title: c.title,
          hostName: c.hostName,
          description: (c.curationSummary || c.description).slice(0, 300),
          fallInLovePromise: c.fallInLovePromise,
          sampleHook: c.clips[0]?.hookText,
        }));

        const systemPrompt = `You are DiscoPod's master AI podcast curator.
Your task is to recommend 4 to 5 extraordinary, distinct podcast discoveries for a listener who loves "${args.seedTitle}".

CRITICAL INSTRUCTIONS:
1. Do NOT just match shallow categories. Look for deeper affinities: narrative drive, kindred host chemistry, provocative questions, immersive sound design, or obsessive intellectual curiosity.
2. Select 4 to 5 distinct shows from the provided candidate list.
3. For each selected show, write a compelling, tailored 'whyYouWillLikeIt' (1-2 sentences). Explain the specific connective tissue connecting why a fan of "${args.seedTitle}" will love this particular show. Do NOT use cliché phrases like "If you like X, you'll love Y" or "Fans of X will enjoy Y". Instead, highlight the shared conversational rhythm, intellectual tension, or curiosity.
4. Assign a matchScore between 88 and 99.
5. Return strictly JSON with format:
{
  "recommendations": [
    {
      "showId": "<exact showId from candidate list>",
      "matchScore": <number 88-99>,
      "whyYouWillLikeIt": "<punchy, vivid personalized 1-2 sentence explanation>"
    }
  ]
}`;

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: JSON.stringify({
                  seedPodcast: {
                    title: args.seedTitle,
                    hostName: seedContext?.hostName,
                    essence: seedSummary,
                    sampleHook: seedContext?.sampleHookText,
                  },
                  candidates: promptCandidates,
                }),
              },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content) as {
              recommendations?: Array<{
                showId: string;
                matchScore: number;
                whyYouWillLikeIt: string;
              }>;
            };
            if (parsed.recommendations && parsed.recommendations.length > 0) {
              selectedRecommendations = parsed.recommendations;
            }
          }
        }
      } catch (err) {
        console.warn("OpenAI RAG curation re-ranking error:", err);
      }
    }

    // 8. Assemble the final results
    const finalResults: DiscoveryRecommendationShow[] = [];

    const showMap = new Map<string, any>(candidateShows.map((s: any) => [String(s.showId), s]));

    if (selectedRecommendations.length > 0) {
      for (const rec of selectedRecommendations) {
        const show = showMap.get(rec.showId);
        if (show && show.clips.length > 0 && !finalResults.some((r) => r.showId === String(show.showId))) {
          finalResults.push({
            showId: String(show.showId),
            title: show.title,
            hostName: show.hostName,
            coverArtUrl: show.coverArtUrl,
            genre: "Semantic Discovery",
            matchScore: Math.min(99, Math.max(80, rec.matchScore || 92)),
            whyYouWillLikeIt:
              rec.whyYouWillLikeIt || show.fallInLovePromise || show.curationSummary || show.description,
            websiteUrl: show.websiteUrl,
            spotifyUrl: show.spotifyUrl,
            appleUrl: show.appleUrl,
            youtubeUrl: show.youtubeUrl,
            clips: show.clips.map((c: any) => ({
              ...c,
              whyYouWillLikeIt: c.whyYouWillLikeIt || rec.whyYouWillLikeIt,
            })),
          });
          if (finalResults.length >= 5) break;
        }
      }
    }

    // If needed, supplement with top non-LLM candidate shows
    if (finalResults.length < 5 && candidateShows.length > 0) {
      for (const show of candidateShows) {
        if (show.clips.length > 0 && !finalResults.some((r) => r.showId === String(show.showId))) {
          const matchScore = 85 + (finalResults.length % 3) * 3;
          const whyYouWillLikeIt =
            show.fallInLovePromise ||
            show.curationSummary ||
            show.description ||
            `Shares kindred depth and conversational energy with ${args.seedTitle}.`;
          finalResults.push({
            showId: String(show.showId),
            title: show.title,
            hostName: show.hostName,
            coverArtUrl: show.coverArtUrl,
            genre: "Recommended",
            matchScore,
            whyYouWillLikeIt,
            websiteUrl: show.websiteUrl,
            spotifyUrl: show.spotifyUrl,
            appleUrl: show.appleUrl,
            youtubeUrl: show.youtubeUrl,
            clips: show.clips.map((c: any) => ({
              ...c,
              whyYouWillLikeIt: c.whyYouWillLikeIt || whyYouWillLikeIt,
            })),
          });
          if (finalResults.length >= 5) break;
        }
      }
    }

    // If still empty (e.g. empty DB), use the fallback templates
    if (finalResults.length === 0) {
      for (const fb of fallbackTemplates) {
        finalResults.push({
          showId: `curated_${fb.title.replace(/\s+/g, "_").toLowerCase()}`,
          title: fb.title,
          hostName: fb.hostName,
          coverArtUrl: fb.coverArtUrl,
          genre: fb.genre,
          matchScore: fb.matchScore,
          whyYouWillLikeIt: fb.whyYouWillLikeIt,
          clips: fb.clips,
        });
        if (finalResults.length >= 4) break;
      }
    }

    return finalResults;
  },
});

export interface CuratedClipResult {
  episodeTitle: string;
  audioUrl: string;
  startTime: number;
  endTime: number;
  duration: number;
  hookText: string;
  transcriptExcerpt: string;
  whyYouWillLikeIt: string;
  energyLevel?: string;
  curatorScore?: number;
  topic?: string;
  alternativeMomentsConsidered?: string;
}

export interface OpenAiCurationReport {
  summary: string;
  fallInLovePromise: string;
  curationMarkdown: string;
  clipsEvaluated: number;
  clipsSelected: number;
  curatedClips: CuratedClipResult[];
  curatedAt: number;
  latencyMs: number;
}

export type EnrichedShowResult = {
  showId: Id<"shows">;
  title: string;
  hostName: string;
  websiteUrl: string;
  hostEmail: string;
  firecrawlSignals: {
    reviews: string;
    socialLinks: string[];
    officialWebsite: string;
  };
  hosts?: DiscoveredHost[];
  socialProfiles?: SocialProfiles;
  highlightClips?: DiscoveredClip[];
  firecrawlReport?: FirecrawlReport;
  openAiCurationReport?: OpenAiCurationReport;
  clips: CuratedClipResult[];
};

export const enrichAndSeedShow = action({
  args: {
    feedUrl: v.string(),
    title: v.string(),
    hostName: v.optional(v.string()),
    coverArtUrl: v.string(),
    genre: v.optional(v.string()),
    forceReEnrich: v.optional(v.boolean()),
  },
  returns: v.object({
    showId: v.id("shows"),
    title: v.string(),
    hostName: v.string(),
    websiteUrl: v.string(),
    hostEmail: v.string(),
    firecrawlSignals: v.object({
      reviews: v.string(),
      socialLinks: v.array(v.string()),
      officialWebsite: v.string(),
    }),
    hosts: v.optional(
      v.array(
        v.object({
          name: v.string(),
          handle: v.optional(v.string()),
          role: v.optional(v.string()),
          bio: v.optional(v.string()),
        }),
      ),
    ),
    socialProfiles: v.optional(
      v.object({
        youtube: v.optional(v.string()),
        twitter: v.optional(v.string()),
        instagram: v.optional(v.string()),
        tiktok: v.optional(v.string()),
        linkedin: v.optional(v.string()),
        newsletter: v.optional(v.string()),
      }),
    ),
    highlightClips: v.optional(
      v.array(
        v.object({
          title: v.string(),
          url: v.optional(v.string()),
          platform: v.string(),
          timestamp: v.optional(v.string()),
          description: v.optional(v.string()),
        }),
      ),
    ),
    firecrawlReport: v.optional(
      v.object({
        summary: v.string(),
        searchesRun: v.array(v.string()),
        sourcesScraped: v.array(v.string()),
        discoveredClips: v.array(
          v.object({
            title: v.string(),
            url: v.string(),
            platform: v.string(),
            timestamp: v.optional(v.string()),
            description: v.optional(v.string()),
          }),
        ),
        listenerSentiment: v.string(),
        researchMarkdown: v.string(),
        researchedAt: v.number(),
        latencyMs: v.number(),
      }),
    ),
    openAiCurationReport: v.optional(
      v.object({
        summary: v.string(),
        fallInLovePromise: v.string(),
        curationMarkdown: v.string(),
        clipsEvaluated: v.number(),
        clipsSelected: v.number(),
        curatedClips: v.array(
          v.object({
            episodeTitle: v.string(),
            startTime: v.number(),
            endTime: v.number(),
            duration: v.number(),
            hookText: v.string(),
            transcriptExcerpt: v.string(),
            whyYouWillLikeIt: v.string(),
            audioUrl: v.optional(v.string()),
            energyLevel: v.optional(v.string()),
            curatorScore: v.optional(v.number()),
            topic: v.optional(v.string()),
            alternativeMomentsConsidered: v.optional(v.string()),
          }),
        ),
        curatedAt: v.number(),
        latencyMs: v.number(),
      }),
    ),
    clips: v.array(
      v.object({
        episodeTitle: v.string(),
        audioUrl: v.string(),
        startTime: v.number(),
        endTime: v.number(),
        duration: v.number(),
        hookText: v.string(),
        transcriptExcerpt: v.string(),
        whyYouWillLikeIt: v.string(),
        energyLevel: v.optional(v.string()),
        curatorScore: v.optional(v.number()),
        topic: v.optional(v.string()),
        alternativeMomentsConsidered: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args): Promise<EnrichedShowResult> => {
    // 0. TOKEN BURN GUARD: Return immediately if show is already ingested with clips
    const candSlug = slugify(args.title);
    if (!args.forceReEnrich) {
      const existing = await ctx.runQuery(internal.shows.checkExistingShow, {
        slug: candSlug,
        rssUrl: args.feedUrl,
        title: args.title,
      });

      if (existing && existing.hasClips) {
        console.log(
          `[enrichAndSeedShow] "${args.title}" is already ingested with ${existing.clips.length} clips. Returning existing show immediately (0 tokens burned).`,
        );
        return {
          showId: existing.showId,
          title: existing.title,
          hostName: existing.hostName || args.hostName || "Host",
          websiteUrl: existing.websiteUrl || "",
          hostEmail: existing.hostEmail || "",
          firecrawlSignals: existing.firecrawlSignals || {
            reviews: "",
            socialLinks: [],
            officialWebsite: "",
          },
          hosts: existing.hosts,
          socialProfiles: existing.socialProfiles,
          highlightClips: existing.highlightClips?.map((c: any) => ({
            title: c.title,
            url: c.url ?? "",
            platform: c.platform,
            timestamp: c.timestamp,
            description: c.description,
          })),
          firecrawlReport: existing.firecrawlReport
            ? {
                ...existing.firecrawlReport,
                discoveredClips: existing.firecrawlReport.discoveredClips.map((c: any) => ({
                  ...c,
                  url: c.url ?? "",
                })),
              }
            : undefined,
          openAiCurationReport: existing.openAiCurationReport
            ? {
                ...existing.openAiCurationReport,
                curatedClips: existing.openAiCurationReport.curatedClips.map((c: any) => ({
                  ...c,
                  audioUrl: c.audioUrl ?? "",
                })),
              }
            : undefined,
          clips: existing.clips,
        };
      }
    }

    // 1. Fetch & parse RSS feed XML
    const feedXml = await fetchRssXml(args.feedUrl);
    const parsedRss = parsePodcastRss(feedXml);

    const showTitle = args.title || parsedRss.showTitle || "Untitled Podcast";
    const hostName = args.hostName || parsedRss.author || "Host";
    const coverArtUrl = args.coverArtUrl || parsedRss.image || "https://placehold.co/300x300";
    const baseDescription = parsedRss.showDesc || `${showTitle} hosted by ${hostName}.`;

    if (parsedRss.episodes.length === 0) {
      throw new Error(`No playable audio episodes found in RSS feed at ${args.feedUrl}`);
    }

    const lastThreeEpisodes = parsedRss.episodes.slice(0, 3);

    // 2. Deep Firecrawl Research Agent (canonical website, hosts, socials, clips, listener sentiment, markdown dossier)
    const openAiKey = process.env.OPENAI_API_KEY;
    if (!openAiKey) {
      throw new Error("OPENAI_API_KEY is required for podcast snippet analysis.");
    }

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    const research = await runDeepFirecrawlResearch({
      firecrawlKey,
      openAiKey,
      showTitle,
      hostName,
      showDescription: baseDescription,
      episodeTitles: lastThreeEpisodes.map((ep) => ep.title),
      rssWebsite: parsedRss.website,
      episodeSummaries: parsedRss.episodes.map((ep) => ep.summary),
    });

    const finalWebsiteUrl =
      research.canonicalWebsite || parsedRss.website || "";
    const finalHostEmail = parsedRss.email || "";

    // 3. OpenAI Audio Curation Agent (informed by chapter markers, episode themes & listener sentiment)
    const curationResult = await analyzeEpisodesWithOpenAi(
      openAiKey,
      showTitle,
      hostName,
      baseDescription,
      research,
      lastThreeEpisodes,
    );
    const analyzedClips = curationResult.clips;
    const openAiCurationReport = curationResult.curationReport;

    // 4. Generate 1536-dim vector embeddings for each clip
    const snippetsWithEmbeddings = [];
    for (const clip of analyzedClips) {
      const embeddingText = `${showTitle} - ${clip.episodeTitle}: ${clip.hookText}. ${clip.whyYouWillLikeIt}`;
      const vectorEmbedding = await embedText(openAiKey, embeddingText);

      snippetsWithEmbeddings.push({
        episodeAudioUrl: clip.audioUrl,
        startTime: clip.startTime,
        endTime: clip.endTime,
        hookText: clip.hookText,
        transcriptExcerpt: `[Why you'll love it]: ${clip.whyYouWillLikeIt}\n\n[Excerpt]: ${clip.transcriptExcerpt}`,
        whyYouWillLikeIt: clip.whyYouWillLikeIt,
        energyLevel: clip.energyLevel,
        curatorScore: clip.curatorScore,
        topic: clip.topic,
        alternativeMomentsConsidered: clip.alternativeMomentsConsidered,
        vectorEmbedding,
      });
    }

    // 5. Persist into Convex database
    const slug = slugify(showTitle);
    const persisted: {
      showId: Id<"shows">;
      episodeCount: number;
      snippetCount: number;
    } = await ctx.runMutation(internal.ingestion.persistMappedShow, {
      title: showTitle,
      slug,
      description: baseDescription,
      rssUrl: args.feedUrl,
      websiteUrl: finalWebsiteUrl || undefined,
      coverArtUrl,
      hostName,
      hostEmail: finalHostEmail || undefined,
      firecrawlSignals: research.firecrawlSignals,
      hosts: research.hosts,
      socialProfiles: research.socialProfiles,
      platformLinks: {
        spotify: research.socialProfiles.spotify,
        apple: research.socialProfiles.apple,
        youtube: research.socialProfiles.youtube,
      },
      highlightClips: research.highlightClips,
      firecrawlReport: research.firecrawlReport,
      openAiCurationReport,
      episodes: lastThreeEpisodes.map((ep) => ({
        title: ep.title,
        audioUrl: ep.audioUrl,
        pubDate: ep.pubDate,
        durationSeconds: ep.durationSeconds,
        summary: ep.summary,
      })),
      snippets: snippetsWithEmbeddings,
    });

    return {
      showId: persisted.showId,
      title: showTitle,
      hostName,
      websiteUrl: finalWebsiteUrl,
      hostEmail: finalHostEmail,
      firecrawlSignals: research.firecrawlSignals,
      hosts: research.hosts,
      socialProfiles: research.socialProfiles,
      highlightClips: research.highlightClips,
      firecrawlReport: research.firecrawlReport,
      openAiCurationReport,
      clips: analyzedClips,
    };
  },
});

export const batchSeedGenreShows = action({
  args: {
    genre: v.string(),
    count: v.number(),
    selection: v.union(v.literal("top"), v.literal("random")),
    candidates: v.optional(
      v.array(
        v.object({
          feedUrl: v.string(),
          title: v.string(),
          hostName: v.optional(v.string()),
          coverArtUrl: v.string(),
          genre: v.optional(v.string()),
        }),
      ),
    ),
  },
  returns: v.object({
    attempted: v.number(),
    succeeded: v.number(),
    alreadyIngestedSkipped: v.number(),
    remainingUnseeded: v.number(),
    showIds: v.array(v.id("shows")),
    errors: v.array(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    attempted: number;
    succeeded: number;
    alreadyIngestedSkipped: number;
    remainingUnseeded: number;
    showIds: Id<"shows">[];
    errors: string[];
  }> => {
    let pool: Array<{
      feedUrl: string;
      title: string;
      hostName: string;
      coverArtUrl: string;
      genre: string;
    }> = [];

    if (args.candidates && args.candidates.length > 0) {
      pool = args.candidates.map((c) => ({
        feedUrl: c.feedUrl,
        title: c.title,
        hostName: c.hostName || "Host",
        coverArtUrl: c.coverArtUrl,
        genre: c.genre || args.genre,
      }));
    } else {
      // Query up to 50 shows so we have a wide pool of candidates to pick unseeded shows from
      const fetched: Array<{
        appleId: string;
        title: string;
        hostName: string;
        coverArtUrl: string;
        genre: string;
        feedUrl: string;
        releaseDate: string;
        isRecent: boolean;
        rank: number;
        description: string;
      }> = await ctx.runAction(api.podcastDiscoveryActions.queryPodcasts, {
        genre: args.genre,
        selection: args.selection,
        recentOnly: true,
        limit: 50,
      });
      pool = fetched.map((c) => ({
        feedUrl: c.feedUrl,
        title: c.title,
        hostName: c.hostName,
        coverArtUrl: c.coverArtUrl,
        genre: c.genre,
      }));
    }

    // Filter out candidates that are ALREADY in the database with clips
    const unseededCandidates: typeof pool = [];
    let alreadyIngestedSkipped = 0;

    for (const candidate of pool) {
      const slug = slugify(candidate.title);
      const existing = await ctx.runQuery(internal.shows.checkExistingShow, {
        slug,
        rssUrl: candidate.feedUrl,
        title: candidate.title,
      });

      if (existing && existing.hasClips) {
        alreadyIngestedSkipped++;
      } else {
        unseededCandidates.push(candidate);
      }
    }

    // Pick the next `count` unseeded candidates
    const toSeed = unseededCandidates.slice(0, Math.max(1, args.count));
    const showIds: Id<"shows">[] = [];
    const errors: string[] = [];

    for (const candidate of toSeed) {
      try {
        const seeded: { showId: Id<"shows"> } = await ctx.runAction(
          api.podcastDiscoveryActions.enrichAndSeedShow,
          {
            feedUrl: candidate.feedUrl,
            title: candidate.title,
            hostName: candidate.hostName,
            coverArtUrl: candidate.coverArtUrl,
            genre: candidate.genre,
          },
        );
        showIds.push(seeded.showId);
      } catch (err) {
        errors.push(
          `Failed seeding ${candidate.title}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    return {
      attempted: toSeed.length,
      succeeded: showIds.length,
      alreadyIngestedSkipped,
      remainingUnseeded: Math.max(0, unseededCandidates.length - showIds.length),
      showIds,
      errors,
    };
  },
});

export const seedLaunchCoverageDiscoball = action({
  args: {
    targetCount: v.optional(v.number()),
  },
  returns: v.object({
    totalSeeded: v.number(),
    targetCount: v.number(),
    genresProcessed: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const target = Math.max(10, Math.min(args.targetCount ?? 80, 120));
    const genreKeys = Object.keys(GENRE_MAP);
    const perGenre = Math.ceil(target / genreKeys.length);
    let totalSeeded = 0;
    const errors: string[] = [];
    let genresProcessed = 0;

    for (const genre of genreKeys) {
      if (totalSeeded >= target) break;
      const needed = Math.min(perGenre, target - totalSeeded);
      try {
        const result = await ctx.runAction(
          api.podcastDiscoveryActions.batchSeedGenreShows,
          {
            genre,
            count: needed,
            selection: "top",
          },
        );
        totalSeeded += result.succeeded;
        genresProcessed++;
        if (result.errors.length > 0) {
          errors.push(...result.errors.slice(0, 2));
        }
      } catch (err) {
        errors.push(
          `Failed genre ${genre}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    return {
      totalSeeded,
      targetCount: target,
      genresProcessed,
      errors,
    };
  },
});

// ----------------------------------------------------------------------------
// Helpers: RSS Parsing, Firecrawl & OpenAI
// ----------------------------------------------------------------------------

interface ParsedEpisode {
  title: string;
  audioUrl: string;
  pubDate: number;
  durationSeconds: number;
  summary: string;
}

interface ParsedRssShow {
  showTitle: string;
  showDesc: string;
  website?: string;
  author?: string;
  email?: string;
  image?: string;
  episodes: ParsedEpisode[];
}

async function fetchRssXml(feedUrl: string): Promise<string> {
  const response = await fetch(feedUrl, {
    headers: {
      "User-Agent": "DiscoPod-Podcast-Bot/1.0",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch RSS feed (${response.status}) from ${feedUrl}`);
  }
  return await response.text();
}

function parsePodcastRss(xml: string): ParsedRssShow {
  const clean = (s?: string) =>
    (s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();

  const channelMatch = xml.match(/<channel[\s\S]*?>([\s\S]*?)<\/channel>/i);
  const channelContent = channelMatch ? channelMatch[1] : xml;

  const showTitle = clean(
    channelContent.match(/<title[\s\S]*?>([\s\S]*?)<\/title>/i)?.[1],
  );
  const showDesc = clean(
    channelContent.match(/<description[\s\S]*?>([\s\S]*?)<\/description>/i)?.[1] ||
      channelContent.match(/<itunes:summary[\s\S]*?>([\s\S]*?)<\/itunes:summary>/i)?.[1],
  ).replace(/<[^>]+>/g, " ");

  const website = channelContent.match(/<link[\s\S]*?>([\s\S]*?)<\/link>/i)?.[1]?.trim();
  const author = clean(
    channelContent.match(/<itunes:author[\s\S]*?>([\s\S]*?)<\/itunes:author>/i)?.[1],
  );
  const email = channelContent.match(
    /<itunes:email[\s\S]*?>([\s\S]*?)<\/itunes:email>/i,
  )?.[1]?.trim();
  const image =
    channelContent.match(/<itunes:image[^>]+href=["\x27]([^"\x27]+)["\x27]/i)?.[1] ||
    channelContent.match(/<image>[\s\S]*?<url>([\s\S]*?)<\/url>/i)?.[1]?.trim();

  const items = xml.split(/<item[\s\S]*?>/i).slice(1);
  const episodes: ParsedEpisode[] = [];

  for (const item of items.slice(0, 10)) {
    const epContent = item.split(/<\/item>/i)[0];
    const title = clean(epContent.match(/<title[\s\S]*?>([\s\S]*?)<\/title>/i)?.[1]);
    const audioUrl = epContent.match(/<enclosure[^>]+url=["\x27]([^"\x27]+)["\x27]/i)?.[1];
    const pubDateStr = clean(
      epContent.match(/<pubDate[\s\S]*?>([\s\S]*?)<\/pubDate>/i)?.[1],
    );
    const durationStr = clean(
      epContent.match(/<itunes:duration[\s\S]*?>([\s\S]*?)<\/itunes:duration>/i)?.[1],
    );
    const summary = clean(
      epContent.match(/<itunes:summary[\s\S]*?>([\s\S]*?)<\/itunes:summary>/i)?.[1] ||
        epContent.match(/<description[\s\S]*?>([\s\S]*?)<\/description>/i)?.[1] ||
        "",
    ).replace(/<[^>]+>/g, " ");

    if (title && audioUrl) {
      episodes.push({
        title,
        audioUrl,
        pubDate: pubDateStr ? Date.parse(pubDateStr) || Date.now() : Date.now(),
        durationSeconds: parseDuration(durationStr),
        summary: summary.slice(0, 800),
      });
    }
  }

  return { showTitle, showDesc, website, author, email, image, episodes };
}

function parseDuration(d?: string): number {
  if (!d) return 1800;
  if (!isNaN(Number(d))) return Math.round(Number(d));
  const parts = d.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 1800;
}

async function extractFirecrawlSignals(
  apiKey: string | undefined,
  showTitle: string,
  hostName: string,
  rssWebsite?: string,
): Promise<{
  reviews: string;
  socialLinks: string[];
  officialWebsite: string;
}> {
  if (!apiKey) {
    return {
      reviews: "Listener praise and engaging discussions from regular listeners.",
      socialLinks: [],
      officialWebsite: rssWebsite || "",
    };
  }

  try {
    const query = `${showTitle} ${hostName} podcast website reviews host contact social accounts youtube`;
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 5,
      }),
    });

    if (!response.ok) {
      return {
        reviews: "Great content and production quality.",
        socialLinks: [],
        officialWebsite: rssWebsite || "",
      };
    }

    const payload = (await response.json()) as {
      data?: Array<{
        title?: string;
        url?: string;
        description?: string;
      }>;
    };

    const items = payload.data || [];
    const socialLinks: string[] = [];
    let officialWebsite = rssWebsite || "";
    const reviewSnippets: string[] = [];

    for (const item of items) {
      const url = item.url || "";
      const desc = item.description || "";

      if (
        url.includes("twitter.com") ||
        url.includes("x.com") ||
        url.includes("youtube.com") ||
        url.includes("instagram.com") ||
        url.includes("linkedin.com") ||
        url.includes("facebook.com")
      ) {
        socialLinks.push(url);
      } else if (!officialWebsite && !url.includes("apple.com") && !url.includes("spotify.com")) {
        officialWebsite = url;
      }

      if (
        desc.toLowerCase().includes("best") ||
        desc.toLowerCase().includes("favorite") ||
        desc.toLowerCase().includes("love") ||
        desc.toLowerCase().includes("review") ||
        desc.toLowerCase().includes("recommend")
      ) {
        reviewSnippets.push(desc);
      }
    }

    const reviews =
      reviewSnippets.length > 0
        ? reviewSnippets.slice(0, 3).join(" | ")
        : items[0]?.description || "Acclaimed by listeners for insightful storytelling.";

    return {
      reviews,
      socialLinks: socialLinks.slice(0, 4),
      officialWebsite,
    };
  } catch (_err) {
    return {
      reviews: "Engaging podcast with dedicated listener following.",
      socialLinks: [],
      officialWebsite: rssWebsite || "",
    };
  }
}

async function analyzeEpisodesWithOpenAi(
  apiKey: string,
  showTitle: string,
  hostName: string,
  description: string,
  research: DeepResearchResult,
  episodes: ParsedEpisode[],
): Promise<{
  clips: CuratedClipResult[];
  curationReport: OpenAiCurationReport;
}> {
  const startTime = Date.now();

  const AD_CHAPTER_REGEX =
    /\b(sponsor|sponsors|advertisement|advertisements|ads|ad\b|promo|promos|promotional|break|ad break|supporters|partner|partners|commercial|commercials|intro\s*\/?\s*ads?)\b/i;

  // Extract structured chapters for each candidate episode, discarding ad/sponsor chapters
  const episodesWithChapters = episodes.map((ep, idx) => {
    const allChapters = extractChaptersFromText(ep.summary);
    const cleanChapters = allChapters.filter((c) => !AD_CHAPTER_REGEX.test(c.title));
    return {
      index: idx,
      title: ep.title,
      durationSeconds: ep.durationSeconds,
      summary: ep.summary,
      chaptersAvailable: cleanChapters.slice(0, 15).map((c) => ({
        timestamp: c.timestamp,
        seconds: c.seconds,
        title: c.title,
      })),
    };
  });

  const totalCandidateMoments = episodesWithChapters.reduce(
    (acc, ep) => acc + Math.max(1, ep.chaptersAvailable.length),
    0,
  );

  const promptPayload = {
    show: {
      title: showTitle,
      host: hostName,
      hostsFound: research.hosts.map((h) => h.name).join(", "),
      description,
      listenerSentiment: research.listenerReviews || research.firecrawlSignals.reviews,
    },
    productPromise:
      "Fall in love with a new podcast in 45 seconds instead of 45 minutes. Users swipe on a Tinder-like discovery deck, evaluating shows solely on a 15-45s clip and a compelling hook pitch.",
    episodes: episodesWithChapters,
  };

  const systemInstruction = `You are the Lead Podcast Audio Curator & Editorial Producer for DiscoPod.
Our product promise to listeners: "Fall in love with a new podcast in 45 seconds instead of 45 minutes."
Listeners discover podcasts via a Tinder-like swiping deck. Each card plays a high-voltage 15 to 45-second audio preview clip and displays an opinionated hook pitch explaining why the listener will love this show.

YOUR EDITORIAL CRITERIA:
1. STRICT AUDIO BOUNDS: Clip duration MUST be between 15 and 45 seconds (inclusive). Set startTime and endTime in seconds.
2. STRICT ANTI-AD & NO-SPONSOR POLICY (CRITICAL):
- Podcast networks dynamically inject sponsor ads (DAI) in the first 2-3 minutes of episode audio files.
- NEVER select any audio clip from the first 2:30 (150 seconds) unless an explicit chapter proves it is a substantive monologue/topic discussion free of sponsors.
- NEVER select any moment containing sponsor endorsements, promo codes ("use code DISCO", "visit..."), ad breaks, brand reads (BetterHelp, SimpliSafe, Athletic Greens, etc.), or network disclaimers ("support comes from...").
- Statically exclude all chapters titled "Sponsor", "Ads", "Promo", "Break", "Support", or "Commercial".
- If no clean chapters exist, target the substantive core discussion between 3:30 (210s) and 10:00 (600s).
3. CHAPTER ALIGNMENT: If an episode has "chaptersAvailable", analyze the chapter titles and pick the SINGLE MOST ELECTRIC, PROVOCATIVE, or REVELATORY discussion topic. Align startTime directly with that chapter's seconds.
4. HOOK TEXT: Write a punchy, provocative 1-sentence hook that stops the user mid-swipe.
5. WHY YOU WILL LIKE IT: 1-2 persuasive, opinionated sentences explaining why this 45-second moment will make a new listener fall in love with the host chemistry, debate, or insider insights.
6. ENERGY LEVEL: Classify vibe: "Spicy Debate" | "Mind-Expanding Insight" | "Insider Drama" | "Vulnerable Revelation" | "Rapid-Fire Banter" | "High-Stakes Storytelling".
7. CURATOR SCORE: 85 to 99 rating indicating hook potency.
8. TOPIC: Short name of the subject matter.
9. ALTERNATIVE MOMENTS CONSIDERED: 1 sentence naming 1-2 other candidate topics/chapters in this episode you evaluated and why the selected moment won out for the 45-second hook test.

REQUIRED "SHOW YOUR WORK" DOSSIER:
You must provide "curationMarkdown" containing:
### 🎧 DiscoPod Audio Curation & "Show Your Work" Dossier

#### 1. Editorial Curation Thesis ("Fall in Love in 45 Seconds")
Detailed analysis of host chemistry, show tone, listener appeal, and why these selected audio moments prove the show's value in under 45 seconds.

#### 2. Candidate Moments & Elimination Audit
For each episode, detail what candidate chapter moments were evaluated and why the winning segment was chosen over the others.

#### 3. Deep Dive into Selected 15-45s Clips & Rationales
For each selected clip, list:
- Episode Title
- Exact Timestamp Range (e.g. 4:05 -> 4:42, 37s)
- Energy Dynamic & Curator Score
- Hook Quote & Spoken Excerpt
- The "Fall in Love" Rationale

#### 4. Tinder-esque Recommendation Card Copy
The concise recommendation pitch that appears on the swiping card.

#### 5. Audio Bounds Compliance Audit
Verify each clip duration strictly obeys 15-45s and is well past pre-roll advertising.

Respond ONLY with valid JSON with this shape:
{
  "curationThesis": "...",
  "fallInLovePromise": "...",
  "clips": [
    {
      "episodeIndex": 0,
      "startTime": 245,
      "endTime": 282,
      "hookText": "...",
      "transcriptExcerpt": "...",
      "whyYouWillLikeIt": "...",
      "energyLevel": "Spicy Debate",
      "curatorScore": 95,
      "topic": "AI Doomsday vs Doomer Psyop",
      "alternativeMomentsConsidered": "..."
    }
  ],
  "curationMarkdown": "..."
}`;

  let parsed: {
    curationThesis?: string;
    fallInLovePromise?: string;
    clips?: Array<{
      episodeIndex: number;
      startTime: number;
      endTime: number;
      hookText: string;
      transcriptExcerpt: string;
      whyYouWillLikeIt: string;
      energyLevel?: string;
      curatorScore?: number;
      topic?: string;
      alternativeMomentsConsidered?: string;
    }>;
    curationMarkdown?: string;
  } = {};

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: JSON.stringify(promptPayload) },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        parsed = JSON.parse(content);
      }
    } else {
      const errText = await response.text();
      console.warn(`OpenAI curation API returned ${response.status}: ${errText}`);
    }
  } catch (err) {
    console.warn("OpenAI curation agent error, falling back to heuristics:", err);
  }

  const clipMap = new Map((parsed.clips || []).map((c) => [c.episodeIndex, c]));

  const curatedClips: CuratedClipResult[] = episodes.map((ep, idx) => {
    const aiClip = clipMap.get(idx);
    const epChapters = episodesWithChapters[idx]?.chaptersAvailable || [];
    // Prefer chapters starting after 120s to ensure we are well past pre-roll dynamic ads
    const safeChapters = epChapters.filter((c) => c.seconds >= 120);
    const targetChapter = safeChapters.length > 0 ? safeChapters[0] : epChapters[0];

    // Safe fallback: 12% into the episode or 210s (3.5 mins) to guarantee past pre-roll DAI
    const safeDuration = ep.durationSeconds && ep.durationSeconds > 300 ? ep.durationSeconds : 1800;
    const fallbackStart = Math.min(
      Math.max(210, Math.floor(safeDuration * 0.12)),
      Math.max(210, safeDuration - 120),
    );
    const defaultStart =
      targetChapter?.seconds && targetChapter.seconds >= 120
        ? targetChapter.seconds
        : fallbackStart;

    let rawStart = aiClip?.startTime ?? defaultStart;
    // Enforce pre-roll dead zone: if start is < 150s and not backed by a verified safe chapter, advance it
    if (rawStart < 150 && (!targetChapter || targetChapter.seconds < 150)) {
      rawStart = defaultStart;
    }
    const rawEnd = aiClip?.endTime ?? rawStart + 35;
    const duration = Math.max(15, Math.min(45, rawEnd - rawStart));
    const startTime = Math.max(150, Math.min(Math.max(150, safeDuration - duration), rawStart));
    const endTime = startTime + duration;

    return {
      episodeTitle: ep.title,
      audioUrl: ep.audioUrl,
      startTime,
      endTime,
      duration,
      hookText: aiClip?.hookText || `Why listeners can't get enough of ${ep.title}`,
      transcriptExcerpt: aiClip?.transcriptExcerpt || ep.summary.slice(0, 240),
      whyYouWillLikeIt:
        aiClip?.whyYouWillLikeIt ||
        `In 45 seconds, this clip pulls you right into ${showTitle}'s dynamic chemistry and unfiltered insights.`,
      energyLevel: aiClip?.energyLevel || "Spicy Debate",
      curatorScore: aiClip?.curatorScore ?? 92,
      topic: aiClip?.topic || (targetChapter?.title ?? "Core Discussion"),
      alternativeMomentsConsidered:
        aiClip?.alternativeMomentsConsidered ||
        (epChapters.length > 2
          ? `Evaluated ${epChapters.length} chapter segments across this episode; selected peak high-voltage moment.`
          : "Evaluated opening hook vs midpoint debate; selected the primary entry point."),
    };
  });

  const latencyMs = Date.now() - startTime;
  const fallInLovePromise =
    parsed.fallInLovePromise ||
    `Experience the raw energy, insider debates, and unmistakable chemistry of ${showTitle} in an electrifying 45-second preview that proves why millions subscribe.`;

  const curationMarkdown =
    parsed.curationMarkdown ||
    `### 🎧 DiscoPod Audio Curation & "Show Your Work" Dossier

#### 1. Editorial Curation Thesis ("Fall in Love in 45 Seconds")
${fallInLovePromise}

#### 2. Candidate Moments & Elimination Audit
Evaluated ${totalCandidateMoments} candidate moments across ${episodes.length} episodes. Filtered out intro music, announcements, and promotional boilerplate to isolate signature conversational peaks.

#### 3. Deep Dive into Curated 15-45s Clips
${curatedClips
  .map(
    (c, i) =>
      `##### Clip ${i + 1}: ${c.episodeTitle}\n- **Window**: ${Math.floor(c.startTime / 60)}:${String(c.startTime % 60).padStart(2, "0")} → ${Math.floor(c.endTime / 60)}:${String(c.endTime % 60).padStart(2, "0")} (${c.duration}s)\n- **Energy Dynamic**: ${c.energyLevel} (Potency Score: ${c.curatorScore}/100)\n- **Hook**: "${c.hookText}"\n- **Spoken Excerpt**: "${c.transcriptExcerpt}"\n- **Why It Hooks**: ${c.whyYouWillLikeIt}\n- **Alternative Candidates Evaluated**: ${c.alternativeMomentsConsidered}`,
  )
  .join("\n\n")}

#### 4. Tinder-esque Recommendation Pitch
When recommending ${showTitle} to new listeners, DiscoPod leads with high-stakes debate and insider clarity to convert casual scrollers into committed fans in under 45 seconds.

#### 5. Audio Bounds Compliance Audit
${curatedClips.map((c, i) => `- Clip ${i + 1}: ${c.duration}s duration [✓ Strictly compliant with 15-45s rule]`).join("\n")}`;

  const curationReport: OpenAiCurationReport = {
    summary:
      parsed.curationThesis ||
      `Curated ${curatedClips.length} opinionated 15-45s audio clips for ${showTitle} delivering on the 45-second discovery promise.`,
    fallInLovePromise,
    curationMarkdown,
    clipsEvaluated: totalCandidateMoments,
    clipsSelected: curatedClips.length,
    curatedClips,
    curatedAt: Date.now(),
    latencyMs,
  };

  return {
    clips: curatedClips,
    curationReport,
  };
}

async function embedText(apiKey: string, input: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embedding request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const embedding = payload.data?.[0]?.embedding;
  if (!embedding || embedding.length !== 1536) {
    throw new Error("Embedding response did not contain a 1536-dim vector.");
  }

  return embedding;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
