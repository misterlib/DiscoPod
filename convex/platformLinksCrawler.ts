import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal, api } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import {
  searchFirecrawlSafe,
  scrapeFirecrawlSafe,
} from "./firecrawlAgent";

/**
 * Strips common marketing or channel fluff from show title for cleaner search matching.
 */
function cleanPodcastTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\s*\|\s*.*$/, "")
    .replace(/\s*-\s*(?:The Official Podcast|Podcast|with .*)$/i, "")
    .replace(/\s*\(with [^)]+\)$/i, "")
    .replace(/\s*\(audio\)$/i, "")
    .replace(/["“”]/g, "")
    .trim();
}

/**
 * Cleans and normalizes Spotify show URL.
 */
function normalizeSpotifyUrl(url: string): string | undefined {
  const match = url.match(/https?:\/\/(?:open\.)?spotify\.com\/show\/[a-zA-Z0-9]+/i);
  return match ? match[0].replace(/^http:/, "https:") : undefined;
}

/**
 * Cleans and normalizes Apple Podcasts show URL.
 */
function normalizeAppleUrl(url: string): string | undefined {
  const match = url.match(/https?:\/\/podcasts\.apple\.com(?:\/[a-z]{2})?\/podcast\/(?:[^/]+\/)?id\d+/i);
  return match ? match[0].replace(/^http:/, "https:") : undefined;
}

/**
 * Query official iTunes Search API for Apple Podcasts show URL with high precision.
 * Uses RSS feed matching as primary key, or title similarity as fallback.
 */
async function searchApplePodcastsApi(
  showTitle: string,
  rssUrl?: string,
): Promise<{ url?: string; source: string }> {
  try {
    const cleanTitle = cleanPodcastTitle(showTitle);
    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanTitle)}&entity=podcast&limit=5`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "DiscoPod-Crawler/1.0" },
    });
    if (!res.ok) return { source: "itunes_api_error" };

    const data = (await res.json()) as {
      resultCount?: number;
      results?: Array<{
        collectionName?: string;
        collectionViewUrl?: string;
        feedUrl?: string;
      }>;
    };

    if (!data.results || data.results.length === 0) {
      return { source: "itunes_not_found" };
    }

    // 1. Exact match on RSS feed URL (100% infallible fingerprint)
    if (rssUrl) {
      const normalizedRss = rssUrl.trim().toLowerCase().replace(/\/$/, "");
      const exactFeedMatch = data.results.find((r) => {
        if (!r.feedUrl) return false;
        const normalizedItemFeed = r.feedUrl.trim().toLowerCase().replace(/\/$/, "");
        return normalizedItemFeed === normalizedRss;
      });
      if (exactFeedMatch?.collectionViewUrl) {
        return {
          url: normalizeAppleUrl(exactFeedMatch.collectionViewUrl),
          source: "itunes_api_feed_match",
        };
      }
    }

    // 2. High-confidence title match
    const lowerClean = cleanTitle.toLowerCase();
    for (const item of data.results) {
      const itemName = (item.collectionName || "").toLowerCase();
      if (
        itemName === lowerClean ||
        itemName.includes(lowerClean) ||
        lowerClean.includes(itemName)
      ) {
        if (item.collectionViewUrl) {
          return {
            url: normalizeAppleUrl(item.collectionViewUrl),
            source: "itunes_api_title_match",
          };
        }
      }
    }

    // 3. Fallback: Take the first result if title is non-empty
    if (data.results[0]?.collectionViewUrl) {
      return {
        url: normalizeAppleUrl(data.results[0].collectionViewUrl),
        source: "itunes_api_top_result",
      };
    }

    return { source: "itunes_no_match" };
  } catch (_err) {
    return { source: "itunes_api_exception" };
  }
}

/**
 * Query Firecrawl search & scraping for Spotify podcast show URL.
 */
async function searchSpotifyShowUrl(
  showTitle: string,
  firecrawlKey?: string,
  websiteUrl?: string,
): Promise<{ url?: string; source: string }> {
  if (!firecrawlKey) return { source: "no_firecrawl_key" };

  const cleanTitle = cleanPodcastTitle(showTitle);

  // 1. Targeted Google search via Firecrawl for Spotify show page
  try {
    const spotifyQuery = `site:open.spotify.com/show "${cleanTitle}" podcast`;
    const searchResults = await searchFirecrawlSafe(firecrawlKey, spotifyQuery, 4);

    for (const item of searchResults) {
      const u = item.url || "";
      const normalized = normalizeSpotifyUrl(u);
      if (normalized) {
        return { url: normalized, source: "firecrawl_search_targeted" };
      }
    }
  } catch (_err) {
    // Non-blocking
  }

  // 2. Scrape canonical website if available to find Spotify badge or link
  if (websiteUrl && websiteUrl.startsWith("http")) {
    try {
      const scrapeResult = await scrapeFirecrawlSafe(firecrawlKey, websiteUrl);
      if (scrapeResult?.links) {
        for (const link of scrapeResult.links) {
          const normalized = normalizeSpotifyUrl(link);
          if (normalized) {
            return { url: normalized, source: "firecrawl_website_scrape" };
          }
        }
      }
    } catch (_err) {
      // Non-blocking
    }
  }

  // 3. Broad search if strict search yielded nothing
  try {
    const broadQuery = `"${cleanTitle}" podcast open.spotify.com/show`;
    const broadResults = await searchFirecrawlSafe(firecrawlKey, broadQuery, 4);
    for (const item of broadResults) {
      const u = item.url || "";
      const normalized = normalizeSpotifyUrl(u);
      if (normalized) {
        return { url: normalized, source: "firecrawl_search_broad" };
      }
    }
  } catch (_err) {
    // Non-blocking
  }

  return { source: "spotify_not_found" };
}

/**
 * Inspects existing database metadata, show notes, and socialLinks for Spotify & Apple links.
 */
function inspectExistingDataForLinks(
  show: Doc<"shows">,
  episodes: Doc<"episodes">[],
): { spotify?: string; apple?: string } {
  let foundSpotify: string | undefined;
  let foundApple: string | undefined;

  // 1. Direct fields
  if (show.platformLinks?.spotify) foundSpotify = normalizeSpotifyUrl(show.platformLinks.spotify);
  if (show.socialProfiles?.spotify) foundSpotify = foundSpotify || normalizeSpotifyUrl(show.socialProfiles.spotify);
  if (show.platformLinks?.apple) foundApple = normalizeAppleUrl(show.platformLinks.apple);
  if (show.socialProfiles?.apple) foundApple = foundApple || normalizeAppleUrl(show.socialProfiles.apple);

  // 2. firecrawlSignals.socialLinks array
  const socialLinks = show.firecrawlSignals?.socialLinks || [];
  for (const link of socialLinks) {
    if (!foundSpotify) foundSpotify = normalizeSpotifyUrl(link);
    if (!foundApple) foundApple = normalizeAppleUrl(link);
  }

  // 3. Show description & episode summaries
  const textBlob = [
    show.description,
    ...episodes.slice(0, 5).map((e) => e.summary || ""),
  ].join("\n");

  if (!foundSpotify) {
    const spotifyMatch = textBlob.match(/https?:\/\/(?:open\.)?spotify\.com\/show\/[a-zA-Z0-9]+/i);
    if (spotifyMatch) foundSpotify = normalizeSpotifyUrl(spotifyMatch[0]);
  }

  if (!foundApple) {
    const appleMatch = textBlob.match(/https?:\/\/podcasts\.apple\.com(?:\/[a-z]{2})?\/podcast\/(?:[^/]+\/)?id\d+/i);
    if (appleMatch) foundApple = normalizeAppleUrl(appleMatch[0]);
  }

  return { spotify: foundSpotify, apple: foundApple };
}

// ─────────────────────────────────────────────────────────────
// CONVEX INTERNAL FUNCTIONS
// ─────────────────────────────────────────────────────────────

export const getShowsForCatchUpInternal = internalQuery({
  args: {
    limit: v.optional(v.number()),
    force: v.optional(v.boolean()),
    showId: v.optional(v.id("shows")),
  },
  returns: v.array(
    v.object({
      showId: v.id("shows"),
      title: v.string(),
      hostName: v.optional(v.string()),
      rssUrl: v.string(),
      websiteUrl: v.optional(v.string()),
      coverArtUrl: v.string(),
      existingSpotify: v.optional(v.string()),
      existingApple: v.optional(v.string()),
      existingYoutube: v.optional(v.string()),
      isMissingSpotify: v.boolean(),
      isMissingApple: v.boolean(),
      socialLinks: v.array(v.string()),
      episodeSummaries: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    let shows: Doc<"shows">[] = [];

    if (args.showId) {
      const single = await ctx.db.get("shows", args.showId);
      if (single) shows = [single];
    } else {
      shows = await ctx.db.query("shows").collect();
    }

    const filtered = shows.filter((s) => !s.isTakenDown);
    const results = [];

    for (const show of filtered) {
      const episodes = await ctx.db
        .query("episodes")
        .withIndex("by_showId", (q) => q.eq("showId", show._id))
        .take(5);

      const existing = inspectExistingDataForLinks(show, episodes);
      const isMissingSpotify = !existing.spotify;
      const isMissingApple = !existing.apple;

      if (args.force || isMissingSpotify || isMissingApple || args.showId) {
        results.push({
          showId: show._id,
          title: show.title,
          hostName: show.hostName,
          rssUrl: show.rssUrl,
          websiteUrl: show.websiteUrl,
          coverArtUrl: show.coverArtUrl,
          existingSpotify: existing.spotify,
          existingApple: existing.apple,
          existingYoutube: show.platformLinks?.youtube || show.socialProfiles?.youtube,
          isMissingSpotify,
          isMissingApple,
          socialLinks: show.firecrawlSignals?.socialLinks || [],
          episodeSummaries: episodes.map((e) => e.summary || "").filter(Boolean),
        });
      }

      if (args.limit && results.length >= args.limit) {
        break;
      }
    }

    return results;
  },
});

export const saveDiscoveredPlatformLinks = internalMutation({
  args: {
    showId: v.id("shows"),
    spotify: v.optional(v.string()),
    apple: v.optional(v.string()),
    youtube: v.optional(v.string()),
    auditNote: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    updatedFields: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const show = await ctx.db.get("shows", args.showId);
    if (!show) {
      return { success: false, updatedFields: [] };
    }

    const currentPlatformLinks = show.platformLinks || {};
    const currentSocialProfiles = show.socialProfiles || {};
    const currentSignals = show.firecrawlSignals || {
      reviews: "",
      socialLinks: [],
      officialWebsite: show.websiteUrl || "",
    };

    const newPlatformLinks = { ...currentPlatformLinks };
    const newSocialProfiles = { ...currentSocialProfiles };
    const newSocialLinks = new Set(currentSignals.socialLinks || []);
    const updatedFields: string[] = [];

    if (args.spotify) {
      newPlatformLinks.spotify = args.spotify;
      newSocialProfiles.spotify = args.spotify;
      newSocialLinks.add(args.spotify);
      updatedFields.push("spotify");
    }

    if (args.apple) {
      newPlatformLinks.apple = args.apple;
      newSocialProfiles.apple = args.apple;
      newSocialLinks.add(args.apple);
      updatedFields.push("apple");
    }

    if (args.youtube) {
      newPlatformLinks.youtube = args.youtube;
      newSocialProfiles.youtube = args.youtube;
      newSocialLinks.add(args.youtube);
      updatedFields.push("youtube");
    }

    await ctx.db.patch("shows", args.showId, {
      platformLinks: newPlatformLinks,
      socialProfiles: newSocialProfiles,
      firecrawlSignals: {
        reviews: currentSignals.reviews,
        socialLinks: Array.from(newSocialLinks),
        officialWebsite: currentSignals.officialWebsite || show.websiteUrl || "",
      },
    });

    return { success: true, updatedFields };
  },
});

// ─────────────────────────────────────────────────────────────
// PUBLIC ACTIONS & QUERIES
// ─────────────────────────────────────────────────────────────

/**
 * Returns complete platform link coverage stats across all ingested shows.
 */
export const getPlatformLinksCoverage = query({
  args: {},
  returns: v.object({
    totalShows: v.number(),
    withSpotify: v.number(),
    withApple: v.number(),
    withBoth: v.number(),
    missingCount: v.number(),
    shows: v.array(
      v.object({
        showId: v.id("shows"),
        title: v.string(),
        hostName: v.optional(v.string()),
        coverArtUrl: v.string(),
        hasSpotify: v.boolean(),
        spotifyUrl: v.optional(v.string()),
        hasApple: v.boolean(),
        appleUrl: v.optional(v.string()),
        hasBoth: v.boolean(),
        isMissing: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const allShows = await ctx.db.query("shows").collect();
    const activeShows = allShows.filter((s) => !s.isTakenDown);

    let withSpotify = 0;
    let withApple = 0;
    let withBoth = 0;
    let missingCount = 0;

    const showRows = activeShows.map((show) => {
      const socialLinks = show.firecrawlSignals?.socialLinks || [];
      const spotifyUrl =
        show.platformLinks?.spotify ||
        show.socialProfiles?.spotify ||
        socialLinks.find((l) => l.includes("open.spotify.com/show/") || l.includes("spotify.com/show/"));
      const appleUrl =
        show.platformLinks?.apple ||
        show.socialProfiles?.apple ||
        socialLinks.find((l) => l.includes("podcasts.apple.com") && l.includes("/podcast/"));

      const hasSpotify = Boolean(spotifyUrl);
      const hasApple = Boolean(appleUrl);
      const hasBoth = hasSpotify && hasApple;
      const isMissing = !hasBoth;

      if (hasSpotify) withSpotify++;
      if (hasApple) withApple++;
      if (hasBoth) withBoth++;
      if (isMissing) missingCount++;

      return {
        showId: show._id,
        title: show.title,
        hostName: show.hostName,
        coverArtUrl: show.coverArtUrl,
        hasSpotify,
        spotifyUrl,
        hasApple,
        appleUrl,
        hasBoth,
        isMissing,
      };
    });

    return {
      totalShows: activeShows.length,
      withSpotify,
      withApple,
      withBoth,
      missingCount,
      shows: showRows,
    };
  },
});

/**
 * Catch up a single show by discovering real Spotify and Apple Podcasts links.
 */
export const catchUpSingleShow = action({
  args: {
    showId: v.id("shows"),
    force: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    showId: v.id("shows"),
    title: v.string(),
    spotify: v.optional(v.string()),
    apple: v.optional(v.string()),
    discoveredSpotify: v.boolean(),
    discoveredApple: v.boolean(),
    sources: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;

    const candidateShows: Array<{
      showId: Id<"shows">;
      title: string;
      hostName?: string;
      rssUrl: string;
      websiteUrl?: string;
      coverArtUrl: string;
      existingSpotify?: string;
      existingApple?: string;
      existingYoutube?: string;
      isMissingSpotify: boolean;
      isMissingApple: boolean;
      socialLinks: string[];
      episodeSummaries: string[];
    }> = await ctx.runQuery(internal.platformLinksCrawler.getShowsForCatchUpInternal, {
      showId: args.showId,
      force: args.force,
    });

    if (candidateShows.length === 0) {
      return {
        success: false,
        showId: args.showId,
        title: "Unknown",
        discoveredSpotify: false,
        discoveredApple: false,
        sources: ["Show not found or already complete"],
      };
    }

    const show = candidateShows[0];
    const sources: string[] = [];
    let resolvedSpotify = show.existingSpotify;
    let resolvedApple = show.existingApple;
    let discoveredSpotify = false;
    let discoveredApple = false;

    // 1. Apple Podcasts Search
    if (!resolvedApple || args.force) {
      const appleResult = await searchApplePodcastsApi(show.title, show.rssUrl);
      if (appleResult.url) {
        resolvedApple = appleResult.url;
        discoveredApple = true;
        sources.push(`Apple: ${appleResult.source}`);
      }
    }

    // 2. Spotify Show Search via Firecrawl
    if (!resolvedSpotify || args.force) {
      const spotifyResult = await searchSpotifyShowUrl(
        show.title,
        firecrawlKey,
        show.websiteUrl,
      );
      if (spotifyResult.url) {
        resolvedSpotify = spotifyResult.url;
        discoveredSpotify = true;
        sources.push(`Spotify: ${spotifyResult.source}`);
      }
    }

    // 3. Commit discovered links to Convex
    if (discoveredSpotify || discoveredApple) {
      await ctx.runMutation(internal.platformLinksCrawler.saveDiscoveredPlatformLinks, {
        showId: show.showId,
        spotify: resolvedSpotify,
        apple: resolvedApple,
        auditNote: sources.join("; "),
      });
    }

    return {
      success: true,
      showId: show.showId,
      title: show.title,
      spotify: resolvedSpotify,
      apple: resolvedApple,
      discoveredSpotify,
      discoveredApple,
      sources,
    };
  },
});

/**
 * Batch catch up all already-ingested shows that are missing Spotify or Apple links.
 */
export const batchCatchUpShows = action({
  args: {
    limit: v.optional(v.number()),
    force: v.optional(v.boolean()),
  },
  returns: v.object({
    attempted: v.number(),
    updated: v.number(),
    alreadyComplete: v.number(),
    remaining: v.number(),
    results: v.array(
      v.object({
        showId: v.id("shows"),
        title: v.string(),
        spotify: v.optional(v.string()),
        apple: v.optional(v.string()),
        updated: v.boolean(),
        sources: v.array(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    const batchLimit = Math.max(1, Math.min(args.limit ?? 15, 50));

    const candidateShows: Array<{
      showId: Id<"shows">;
      title: string;
      hostName?: string;
      rssUrl: string;
      websiteUrl?: string;
      coverArtUrl: string;
      existingSpotify?: string;
      existingApple?: string;
      existingYoutube?: string;
      isMissingSpotify: boolean;
      isMissingApple: boolean;
      socialLinks: string[];
      episodeSummaries: string[];
    }> = await ctx.runQuery(internal.platformLinksCrawler.getShowsForCatchUpInternal, {
      limit: batchLimit,
      force: args.force,
    });

    const results: Array<{
      showId: Id<"shows">;
      title: string;
      spotify?: string;
      apple?: string;
      updated: boolean;
      sources: string[];
    }> = [];

    let updatedCount = 0;

    for (const show of candidateShows) {
      const sources: string[] = [];
      let resolvedSpotify = show.existingSpotify;
      let resolvedApple = show.existingApple;
      let discoveredSpotify = false;
      let discoveredApple = false;

      // 1. Apple Podcasts Search
      if (!resolvedApple || args.force) {
        const appleResult = await searchApplePodcastsApi(show.title, show.rssUrl);
        if (appleResult.url) {
          resolvedApple = appleResult.url;
          discoveredApple = true;
          sources.push(`Apple: ${appleResult.source}`);
        }
      }

      // 2. Spotify Search via Firecrawl
      if (!resolvedSpotify || args.force) {
        const spotifyResult = await searchSpotifyShowUrl(
          show.title,
          firecrawlKey,
          show.websiteUrl,
        );
        if (spotifyResult.url) {
          resolvedSpotify = spotifyResult.url;
          discoveredSpotify = true;
          sources.push(`Spotify: ${spotifyResult.source}`);
        }
      }

      const didUpdate = discoveredSpotify || discoveredApple;

      if (didUpdate) {
        await ctx.runMutation(internal.platformLinksCrawler.saveDiscoveredPlatformLinks, {
          showId: show.showId,
          spotify: resolvedSpotify,
          apple: resolvedApple,
          auditNote: sources.join("; "),
        });
        updatedCount++;
      }

      results.push({
        showId: show.showId,
        title: show.title,
        spotify: resolvedSpotify,
        apple: resolvedApple,
        updated: didUpdate,
        sources,
      });

      // Polite throttle between shows to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Check remaining missing shows count
    const coverage: {
      totalShows: number;
      withSpotify: number;
      withApple: number;
      withBoth: number;
      missingCount: number;
    } = await ctx.runQuery(api.platformLinksCrawler.getPlatformLinksCoverage, {});

    return {
      attempted: candidateShows.length,
      updated: updatedCount,
      alreadyComplete: candidateShows.length - updatedCount,
      remaining: coverage.missingCount,
      results,
    };
  },
});
