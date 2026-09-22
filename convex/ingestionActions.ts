"use node";

import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import type { EnrichedShowResult } from "./podcastDiscoveryActions";

export type MapShowResult = {
  showId: Id<"shows">;
  episodeCount: number;
  snippetCount: number;
};

export const mapShow = action({
  args: {
    sourceType: v.union(v.literal("rss"), v.literal("apple"), v.literal("title")),
    sourceValue: v.string(),
  },
  returns: v.object({
    showId: v.id("shows"),
    episodeCount: v.number(),
    snippetCount: v.number(),
  }),
  handler: async (ctx, args): Promise<MapShowResult> => {
    try {
      const openAiKey = process.env.OPENAI_API_KEY;
      // 1. Resolve to real RSS feed and metadata via iTunes API or direct URL
      const resolved = await resolvePodcastFeed(args.sourceType, args.sourceValue, openAiKey);

      // 2. Run the full deep Firecrawl Web Research Agent & OpenAI clip extraction pipeline
      const enriched: EnrichedShowResult = await ctx.runAction(
        api.podcastDiscoveryActions.enrichAndSeedShow,
        {
          feedUrl: resolved.feedUrl,
          title: resolved.title,
          hostName: resolved.hostName || undefined,
          coverArtUrl: resolved.coverArtUrl || "https://placehold.co/300x300",
        },
      );

      return {
        showId: enriched.showId,
        episodeCount: 3,
        snippetCount: enriched.clips.length,
      };
    } catch (_enrichErr) {
      console.error("enrichAndSeedShow error in mapShow:", _enrichErr);
      throw new Error(
        `Failed to enrich and map show: ${_enrichErr instanceof Error ? _enrichErr.message : String(_enrichErr)}`,
      );
    }
  },
});

interface ItunesSearchCandidate {
  collectionName?: string;
  artistName?: string;
  feedUrl: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  trackCount?: number;
  primaryGenreName?: string;
}

async function disambiguatePodcastWithAi(
  openAiKey: string,
  userPrompt: string,
  candidates: ItunesSearchCandidate[],
): Promise<number> {
  const promptText = `A user searched for the podcast: "${userPrompt}".
Here are candidate podcasts found via iTunes search:
${candidates
  .map(
    (c, i) =>
      `[${i}] Title: "${c.collectionName || "Untitled"}" | Creator/Artist: "${c.artistName || "Unknown"}" | Total Episodes: ${c.trackCount ?? "Unknown"} | Genre: ${c.primaryGenreName || "General"}`,
  )
  .join("\n")}

Task: Select the single best candidate index (0 to ${candidates.length - 1}) that represents the canonical, most popular, and intended podcast matching "${userPrompt}".
Important rules:
- Pay attention to cultural prominence, episode volume (major shows usually have dozens or hundreds of episodes), and title match.
- If the user query matches a famous, widely-known show (e.g. "All-In Podcast", "Joe Rogan", "Huberman Lab"), prioritize the flagship/official show over obscure or smaller podcasts with identical or overlapping names.
Respond ONLY with a JSON object: {"selectedIndex": <number>, "reason": "<short explanation>"}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: promptText }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
      if (
        typeof parsed.selectedIndex === "number" &&
        parsed.selectedIndex >= 0 &&
        parsed.selectedIndex < candidates.length
      ) {
        return parsed.selectedIndex;
      }
    }
  } catch (_err) {
    // fallback to heuristic
  }

  return scoreCandidatesHeuristic(userPrompt, candidates);
}

function scoreCandidatesHeuristic(
  userPrompt: string,
  candidates: ItunesSearchCandidate[],
): number {
  const normPrompt = userPrompt.toLowerCase().replace(/[^a-z0-9]/g, "");
  let bestIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const normTitle = (c.collectionName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    let score = 0;

    if (normTitle === normPrompt) score += 100;
    else if (normTitle.includes(normPrompt)) score += 60;
    else if (normPrompt.includes(normTitle)) score += 40;

    const count = c.trackCount || 0;
    score += Math.min(count, 500) * 0.25;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return bestIdx;
}

async function resolvePodcastFeed(
  sourceType: "rss" | "apple" | "title",
  sourceValue: string,
  openAiKey?: string,
): Promise<{ feedUrl: string; title: string; hostName: string; coverArtUrl: string }> {
  const trimmed = sourceValue.trim();

  // If already an RSS URL or direct link
  if (
    sourceType === "rss" ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    if (trimmed.includes("podcasts.apple.com")) {
      const idMatch = trimmed.match(/id(\d+)/);
      if (idMatch && idMatch[1]) {
        const lookupRes = await fetch(`https://itunes.apple.com/lookup?id=${idMatch[1]}`);
        if (lookupRes.ok) {
          const lookupData = (await lookupRes.json()) as {
            results?: Array<{
              collectionName?: string;
              artistName?: string;
              feedUrl?: string;
              artworkUrl600?: string;
              artworkUrl100?: string;
            }>;
          };
          const item = lookupData.results?.[0];
          if (item?.feedUrl) {
            return {
              feedUrl: item.feedUrl,
              title: item.collectionName || "",
              hostName: item.artistName || "",
              coverArtUrl: item.artworkUrl600 || item.artworkUrl100 || "",
            };
          }
        }
      }
    }
    return {
      feedUrl: trimmed,
      title: "",
      hostName: "",
      coverArtUrl: "",
    };
  }

  // Otherwise search iTunes Search API by title / prompt with candidate limit 10
  const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
    trimmed,
  )}&entity=podcast&limit=10`;
  const response = await fetch(itunesUrl);
  if (response.ok) {
    const data = (await response.json()) as {
      results?: Array<{
        collectionName?: string;
        artistName?: string;
        feedUrl?: string;
        artworkUrl600?: string;
        artworkUrl100?: string;
        trackCount?: number;
        primaryGenreName?: string;
      }>;
    };
    const candidates = (data.results || []).filter(
      (item): item is ItunesSearchCandidate => Boolean(item.feedUrl),
    );

    if (candidates.length > 0) {
      let chosenIdx = 0;
      if (candidates.length > 1) {
        if (openAiKey) {
          chosenIdx = await disambiguatePodcastWithAi(openAiKey, trimmed, candidates);
        } else {
          chosenIdx = scoreCandidatesHeuristic(trimmed, candidates);
        }
      }

      const item = candidates[chosenIdx] || candidates[0];
      return {
        feedUrl: item.feedUrl,
        title: item.collectionName || trimmed,
        hostName: item.artistName || "",
        coverArtUrl: item.artworkUrl600 || item.artworkUrl100 || "",
      };
    }
  }

  return {
    feedUrl: trimmed,
    title: trimmed,
    hostName: "",
    coverArtUrl: "",
  };
}

export const findOrMapShow = action({
  args: {
    prompt: v.string(),
  },
  returns: v.object({
    showId: v.id("shows"),
    mappedNow: v.boolean(),
    episodeCount: v.number(),
    snippetCount: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    showId: Id<"shows">;
    mappedNow: boolean;
    episodeCount: number;
    snippetCount: number;
  }> => {
    const prompt = args.prompt.trim();
    if (!prompt) {
      throw new Error("Please enter a show, host, or topic.");
    }

    const existing: { showId: Id<"shows"> } | null = await ctx.runQuery(
      api.shows.findShowByPrompt,
      { prompt },
    );
    if (existing) {
      return {
        showId: existing.showId,
        mappedNow: false,
        episodeCount: 0,
        snippetCount: 0,
      };
    }

    const sourceType =
      prompt.includes("podcasts.apple.com")
        ? "apple"
        : prompt.includes("rss") || prompt.startsWith("http")
          ? "rss"
          : "title";
    const mapped: MapShowResult = await ctx.runAction(api.ingestionActions.mapShow, {
      sourceType,
      sourceValue: prompt,
    });

    return {
      showId: mapped.showId,
      mappedNow: true,
      episodeCount: mapped.episodeCount,
      snippetCount: mapped.snippetCount,
    };
  },
});

type ExtractedEpisode = {
  title: string;
  audioUrl: string;
  pubDate: number;
  durationSeconds: number;
  summary: string;
};

type ExtractedShow = {
  title: string;
  slug: string;
  description: string;
  rssUrl: string;
  websiteUrl?: string;
  coverArtUrl: string;
  hostName?: string;
  hostEmail?: string;
  episodes: ExtractedEpisode[];
};

async function extractShow(
  sourceType: "rss" | "apple" | "title",
  sourceValue: string,
): Promise<ExtractedShow> {
  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlApiKey) {
    throw new Error("FIRECRAWL_API_KEY is required for mapShow.");
  }

  // This endpoint contract intentionally keeps request data minimal so the
  // action can be swapped to Firecrawl's latest schema without changing callers.
  const response = await fetch("https://api.firecrawl.dev/v1/extract", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firecrawlApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sourceType,
      sourceValue,
    }),
  });

  if (!response.ok) {
    throw new Error(`Firecrawl extraction failed with ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: {
      title?: string;
      description?: string;
      rssUrl?: string;
      websiteUrl?: string;
      coverArtUrl?: string;
      hostName?: string;
      hostEmail?: string;
      episodes?: ExtractedEpisode[];
    };
  };
  const data = payload.data;
  if (
    !data?.title ||
    !data.description ||
    !data.rssUrl ||
    !data.coverArtUrl ||
    !data.episodes?.length
  ) {
    throw new Error("Firecrawl payload was missing required show fields.");
  }

  return {
    title: data.title,
    slug: slugify(data.title),
    description: data.description,
    rssUrl: data.rssUrl,
    websiteUrl: data.websiteUrl,
    coverArtUrl: data.coverArtUrl,
    hostName: data.hostName,
    hostEmail: data.hostEmail,
    episodes: data.episodes.slice(0, 8),
  };
}

async function buildSnippets(episodes: ExtractedEpisode[]) {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    throw new Error("OPENAI_API_KEY is required to generate snippets.");
  }

  const snippets: Array<{
    episodeAudioUrl: string;
    startTime: number;
    endTime: number;
    hookText: string;
    transcriptExcerpt: string;
    vectorEmbedding: number[];
  }> = [];

  for (const episode of episodes.slice(0, 3)) {
    const hookText = `Highlight from ${episode.title}`;
    const embedding = await embedHook(openAiKey, hookText);
    // Modern podcast pre-roll ads typically run 60-150s.
    // Default to 180s-220s (3:00 - 3:40) to guarantee playback of actual conversation, not DAI sponsor ads.
    snippets.push({
      episodeAudioUrl: episode.audioUrl,
      startTime: 180,
      endTime: 220,
      hookText,
      transcriptExcerpt: episode.summary,
      vectorEmbedding: embedding,
    });
  }

  return snippets;
}

async function embedHook(apiKey: string, input: string): Promise<number[]> {
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
    throw new Error(`Embedding generation failed with ${response.status}.`);
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
