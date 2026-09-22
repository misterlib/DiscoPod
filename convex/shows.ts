import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { computeCoordinates } from "./ingestion";

const globeShowValidator = v.object({
  showId: v.id("shows"),
  title: v.string(),
  coverArtUrl: v.string(),
  isAmped: v.optional(v.boolean()),
  ampScore: v.optional(v.number()),
  coordinates: v.object({
    x: v.number(),
    y: v.number(),
    z: v.number(),
  }),
  isClaimed: v.optional(v.boolean()),
  hostName: v.optional(v.string()),
  slug: v.optional(v.string()),
  description: v.optional(v.string()),
});

export const listGlobeShows = query({
  args: {
    limit: v.optional(v.number()),
    claimedOnly: v.optional(v.boolean()),
    ampOnly: v.optional(v.boolean()),
  },
  returns: v.array(globeShowValidator),
  handler: async (ctx, args) => {
    const hardLimit = Math.max(1, Math.min(args.limit ?? 1000, 2500));
    const rawShows = args.claimedOnly
      ? await ctx.db
          .query("shows")
          .withIndex("by_isClaimed", (q) => q.eq("isClaimed", true))
          .take(hardLimit * 2)
      : await ctx.db.query("shows").take(hardLimit * 2);

    const shows = rawShows.filter((show) => !show.isTakenDown).slice(0, hardLimit);

    return shows.map((show) => ({
      showId: show._id,
      title: show.title,
      coverArtUrl: show.coverArtUrl,
      isAmped: show.isAmped,
      ampScore: show.ampScore,
      coordinates: show.coordinates,
      isClaimed: show.isClaimed,
      hostName: show.hostName,
      slug: show.slug,
      description: show.description,
    }));
  },
});

export const getShowDetail = query({
  args: {
    showId: v.id("shows"),
  },
  returns: v.union(
    v.null(),
    v.object({
      showId: v.id("shows"),
      title: v.string(),
      description: v.string(),
      coverArtUrl: v.optional(v.string()),
      websiteUrl: v.optional(v.string()),
      hostName: v.optional(v.string()),
      hostEmail: v.optional(v.string()),
      isClaimed: v.optional(v.boolean()),
      isTakenDown: v.optional(v.boolean()),
      isAmped: v.optional(v.boolean()),
      ampScore: v.optional(v.number()),
      platformLinks: v.optional(
        v.object({
          spotify: v.optional(v.string()),
          apple: v.optional(v.string()),
          youtube: v.optional(v.string()),
        }),
      ),
      socialProfiles: v.optional(
        v.object({
          youtube: v.optional(v.string()),
          twitter: v.optional(v.string()),
          instagram: v.optional(v.string()),
          tiktok: v.optional(v.string()),
          linkedin: v.optional(v.string()),
          newsletter: v.optional(v.string()),
          spotify: v.optional(v.string()),
          apple: v.optional(v.string()),
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
      topSnippets: v.array(
        v.object({
          snippetId: v.id("snippets"),
          episodeId: v.id("episodes"),
          episodeTitle: v.optional(v.string()),
          audioUrl: v.optional(v.string()),
          hookText: v.string(),
          transcriptExcerpt: v.string(),
          startTime: v.number(),
          endTime: v.number(),
          playCount: v.number(),
          upvotes: v.number(),
          whyYouWillLikeIt: v.optional(v.string()),
          energyLevel: v.optional(v.string()),
          curatorScore: v.optional(v.number()),
          topic: v.optional(v.string()),
        }),
      ),
      latestEpisodes: v.array(
        v.object({
          episodeId: v.id("episodes"),
          title: v.string(),
          pubDate: v.number(),
          durationSeconds: v.number(),
          summary: v.string(),
          audioUrl: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const show = await ctx.db.get("shows", args.showId);
    if (!show || show.isTakenDown) {
      return null;
    }

    const snippets = await ctx.db
      .query("snippets")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .take(40);

    const snippetEpisodeIds = Array.from(new Set(snippets.map((s) => s.episodeId)));
    const snippetEpisodes = await Promise.all(
      snippetEpisodeIds.map((id) => ctx.db.get("episodes", id)),
    );
    const snippetEpMap = new Map(snippetEpisodes.filter(Boolean).map((e) => [e!._id, e!]));

    const topSnippets = snippets
      .sort((a, b) => b.upvotes + b.playCount - (a.upvotes + a.playCount))
      .slice(0, 8)
      .map((snippet) => {
        const ep = snippetEpMap.get(snippet.episodeId);
        return {
          snippetId: snippet._id,
          episodeId: snippet.episodeId,
          episodeTitle: ep?.title,
          audioUrl: ep?.audioUrl,
          hookText: snippet.hookText,
          transcriptExcerpt: snippet.transcriptExcerpt,
          startTime: snippet.startTime,
          endTime: snippet.endTime,
          playCount: snippet.playCount,
          upvotes: snippet.upvotes,
          whyYouWillLikeIt: snippet.whyYouWillLikeIt,
          energyLevel: snippet.energyLevel,
          curatorScore: snippet.curatorScore,
          topic: snippet.topic,
        };
      });

    const latestEpisodes = (
      await ctx.db
        .query("episodes")
        .withIndex("by_showId", (q) => q.eq("showId", args.showId))
        .take(20)
    )
      .sort((a, b) => b.pubDate - a.pubDate)
      .slice(0, 5)
      .map((episode) => ({
        episodeId: episode._id,
        title: episode.title,
        pubDate: episode.pubDate,
        durationSeconds: episode.durationSeconds,
        summary: episode.summary,
        audioUrl: episode.audioUrl,
      }));

    const socialLinks = show.firecrawlSignals?.socialLinks || [];
    const resolvedSpotify =
      show.platformLinks?.spotify ||
      show.socialProfiles?.spotify ||
      socialLinks.find((l) => l.includes("open.spotify.com/show/") || l.includes("spotify.com/show/")) ||
      undefined;

    const resolvedApple =
      show.platformLinks?.apple ||
      show.socialProfiles?.apple ||
      socialLinks.find((l) => l.includes("podcasts.apple.com") && l.includes("/podcast/")) ||
      undefined;

    const resolvedYoutube =
      show.platformLinks?.youtube ||
      show.socialProfiles?.youtube ||
      socialLinks.find(
        (l) =>
          l.includes("youtube.com/@") ||
          l.includes("youtube.com/c/") ||
          l.includes("youtube.com/channel/") ||
          l.includes("youtube.com/user/"),
      ) ||
      undefined;

    return {
      showId: show._id,
      title: show.title,
      description: show.description,
      coverArtUrl: show.coverArtUrl,
      websiteUrl: show.websiteUrl,
      hostName: show.hostName,
      hostEmail: show.hostEmail,
      isClaimed: show.isClaimed,
      isTakenDown: show.isTakenDown,
      isAmped: show.isAmped,
      ampScore: show.ampScore,
      platformLinks: {
        spotify: resolvedSpotify,
        apple: resolvedApple,
        youtube: resolvedYoutube,
      },
      socialProfiles: show.socialProfiles,
      openAiCurationReport: show.openAiCurationReport,
      topSnippets,
      latestEpisodes,
    };
  },
});

export const findShowByPrompt = query({
  args: {
    prompt: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      showId: v.id("shows"),
      title: v.string(),
      slug: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const normalized = args.prompt.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const allShows = await ctx.db.query("shows").take(250);
    const scored = allShows
      .filter((show) => !show.isTakenDown)
      .map((show) => {
        const title = show.title.toLowerCase();
        const hostName = show.hostName?.toLowerCase() ?? "";
        const description = show.description.toLowerCase();
        let score = 0;
        if (title === normalized) score += 100;
        if (show.slug === normalized.replace(/\s+/g, "-")) score += 80;
        if (title.includes(normalized)) score += 50;
        if (hostName.includes(normalized)) score += 30;
        if (description.includes(normalized)) score += 15;
        return { show, score };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score);

    const match = scored[0]?.show;
    if (!match) {
      return null;
    }

    return {
      showId: match._id,
      title: match.title,
      slug: match.slug,
    };
  },
});

export const searchIngestedShows = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
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
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 6, 20));
    const normalized = args.query.trim().toLowerCase();
    const rawShows = await ctx.db.query("shows").take(150);
    const shows = rawShows.filter((s) => !s.isTakenDown);

    const filtered = normalized
      ? shows
          .map((show) => {
            const title = show.title.toLowerCase();
            const host = (show.hostName || "").toLowerCase();
            const desc = show.description.toLowerCase();
            let score = 0;
            if (title === normalized) score += 100;
            else if (title.startsWith(normalized)) score += 60;
            else if (title.includes(normalized)) score += 40;
            if (host.includes(normalized)) score += 25;
            if (desc.includes(normalized)) score += 10;
            return { show, score };
          })
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map((item) => item.show)
      : shows.slice(0, limit);

    return filtered.map((show) => ({
      showId: show._id,
      title: show.title,
      hostName: show.hostName || "Host",
      coverArtUrl: show.coverArtUrl,
      isAmped: show.isAmped,
      ampScore: show.ampScore,
      description: show.description,
      isIngested: true as const,
    }));
  },
});

export const persistFastIngestedShow = internalMutation({
  args: {
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    rssUrl: v.string(),
    websiteUrl: v.optional(v.string()),
    coverArtUrl: v.string(),
    hostName: v.optional(v.string()),
    genre: v.optional(v.string()),
    episodes: v.array(
      v.object({
        title: v.string(),
        audioUrl: v.string(),
        pubDate: v.number(),
        durationSeconds: v.number(),
        summary: v.string(),
      }),
    ),
  },
  returns: v.object({
    showId: v.id("shows"),
    isNew: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Check tombstone registry so taken-down shows are never re-ingested
    const norm = args.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    const tombstone = await ctx.db
      .query("takedownRequests")
      .withIndex("by_normalizedTitle", (q) => q.eq("normalizedTitle", norm))
      .first();

    const existing = await ctx.db
      .query("shows")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (tombstone || existing?.isTakenDown) {
      throw new Error(
        `Cannot ingest "${args.title}": This podcast was removed via takedown request and is permanently tombstoned against re-indexing.`,
      );
    }

    let showId: Id<"shows">;
    let isNew = false;

    if (existing) {
      showId = existing._id;
      await ctx.db.patch("shows", showId, {
        coverArtUrl: existing.coverArtUrl || args.coverArtUrl,
        hostName: existing.hostName || args.hostName,
        description: existing.description || args.description,
        rssUrl: existing.rssUrl || args.rssUrl,
      });
    } else {
      isNew = true;
      showId = await ctx.db.insert("shows", {
        title: args.title,
        slug: args.slug,
        description: args.description,
        rssUrl: args.rssUrl,
        websiteUrl: args.websiteUrl,
        coverArtUrl: args.coverArtUrl,
        hostName: args.hostName,
        isClaimed: false,
        isAmped: false,
        ampScore: 0,
        coordinates: computeCoordinates(args.slug),
      });
    }

    if (args.episodes.length > 0) {
      const existingEpisodes = await ctx.db
        .query("episodes")
        .withIndex("by_showId", (q) => q.eq("showId", showId))
        .collect();
      const existingAudios = new Set(existingEpisodes.map((e) => e.audioUrl));

      for (const ep of args.episodes) {
        if (!existingAudios.has(ep.audioUrl)) {
          await ctx.db.insert("episodes", {
            showId,
            title: ep.title,
            audioUrl: ep.audioUrl,
            pubDate: ep.pubDate,
            durationSeconds: ep.durationSeconds,
            summary: ep.summary,
          });
          existingAudios.add(ep.audioUrl);
        }
      }
    }

    // If show doesn't have snippets yet and has an RSS URL, schedule background enrichment!
    const existingSnippet = await ctx.db
      .query("snippets")
      .withIndex("by_showId", (q) => q.eq("showId", showId))
      .first();

    if (!existingSnippet && args.rssUrl) {
      await ctx.scheduler.runAfter(0, api.podcastDiscoveryActions.enrichAndSeedShow, {
        feedUrl: args.rssUrl,
        title: args.title,
        hostName: args.hostName,
        coverArtUrl: args.coverArtUrl,
        genre: args.genre,
      });
    }

    return {
      showId,
      isNew,
    };
  },
});

export const getSimilarShowsForDeck = query({
  args: {
    seedTitle: v.string(),
    seedShowId: v.optional(v.id("shows")),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      showId: v.id("shows"),
      title: v.string(),
      hostName: v.string(),
      coverArtUrl: v.string(),
      description: v.string(),
      ampScore: v.optional(v.number()),
      matchScore: v.number(),
      whyYouWillLikeIt: v.string(),
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
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 4, 10));

    // 1. Fetch seed show to leverage its description and host if available
    const seedShow = args.seedShowId ? await ctx.db.get("shows", args.seedShowId) : null;
    const seedText = `${args.seedTitle} ${seedShow?.description || ""} ${seedShow?.hostName || ""}`.toLowerCase();
    const seedWords = new Set(
      seedText
        .split(/\W+/)
        .filter((w) => w.length > 3 && !["with", "this", "that", "from", "show", "podcast"].includes(w)),
    );

    const allShows = await ctx.db.query("shows").take(100);
    // Exclude the seed show itself, seed title matches, and any taken-down shows
    const candidates = allShows.filter(
      (s) =>
        !s.isTakenDown &&
        s._id !== args.seedShowId &&
        s.title.toLowerCase() !== args.seedTitle.toLowerCase(),
    );

    // 2. Identify candidate shows that HAVE clips (snippets) ready to play
    const showsWithClips: Array<{
      show: (typeof allShows)[0];
      snippets: Array<Doc<"snippets">>;
      matchScore: number;
    }> = [];

    for (const show of candidates) {
      const snippets = await ctx.db
        .query("snippets")
        .withIndex("by_showId", (q) => q.eq("showId", show._id))
        .take(5);

      if (snippets.length === 0) {
        // Skip shows without clips! We only suggest best podcasts that have clips
        continue;
      }

      // Compute topic & content similarity score
      let matchScore = 84;
      if (show.isClaimed) matchScore += 4;

      const candidateText = `${show.title} ${show.description} ${show.hostName || ""} ${snippets
        .map((s) => `${s.hookText} ${s.topic || ""}`)
        .join(" ")}`.toLowerCase();

      let sharedWordCount = 0;
      for (const word of seedWords) {
        if (candidateText.includes(word)) {
          sharedWordCount++;
        }
      }
      matchScore += Math.min(12, sharedWordCount * 3);
      matchScore = Math.min(99, Math.max(82, matchScore));

      showsWithClips.push({ show, snippets, matchScore });
    }

    showsWithClips.sort((a, b) => b.matchScore - a.matchScore);
    const topShows = showsWithClips.slice(0, limit);

    const results = [];
    for (const { show, snippets, matchScore } of topShows) {
      const episodes = await ctx.db
        .query("episodes")
        .withIndex("by_showId", (q) => q.eq("showId", show._id))
        .take(5);
      const epMap = new Map(episodes.map((ep) => [ep._id, ep]));

      const clips = snippets.map((s) => {
        const ep = epMap.get(s.episodeId);
        const rawExcerpt = s.transcriptExcerpt || "";
        const whyMatch = rawExcerpt.match(
          /\[Why you'll love it\]:\s*([\s\S]*?)(?=\n\n\[Excerpt\]|$)/i,
        );
        const excerptMatch = rawExcerpt.match(/\[Excerpt\]:\s*([\s\S]*?)$/i);
        return {
          snippetId: String(s._id),
          episodeTitle: ep?.title || "Featured Episode",
          audioUrl: ep?.audioUrl || "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg",
          startTime: s.startTime,
          endTime: s.endTime,
          duration: Math.max(1, s.endTime - s.startTime),
          hookText: s.hookText,
          transcriptExcerpt: excerptMatch ? excerptMatch[1].trim() : rawExcerpt,
          whyYouWillLikeIt: whyMatch
            ? whyMatch[1].trim()
            : `Fans of ${args.seedTitle} will love the high-stakes narrative flow and deep insights here.`,
        };
      });

      const whyYouWillLikeIt =
        clips[0]?.whyYouWillLikeIt ||
        `Because you like ${args.seedTitle}, you will appreciate this show's rich audio atmosphere and thought-provoking host dialogue.`;

      results.push({
        showId: show._id,
        title: show.title,
        hostName: show.hostName || "Featured Host",
        coverArtUrl: show.coverArtUrl,
        description: show.description,
        ampScore: show.ampScore ?? 0,
        matchScore,
        whyYouWillLikeIt,
        clips,
      });
    }

    return results;
  },
});

export const getSeedShowContext = internalQuery({
  args: {
    seedShowId: v.optional(v.id("shows")),
    seedTitle: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      showId: v.id("shows"),
      title: v.string(),
      description: v.string(),
      hostName: v.optional(v.string()),
      sampleEmbedding: v.optional(v.array(v.float64())),
      curationSummary: v.optional(v.string()),
      fallInLovePromise: v.optional(v.string()),
      sampleHookText: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    let show: Doc<"shows"> | null = null;
    if (args.seedShowId) {
      show = await ctx.db.get("shows", args.seedShowId);
    }
    if (!show) {
      show = await ctx.db
        .query("shows")
        .filter((q) => q.eq(q.field("title"), args.seedTitle))
        .first();
    }
    if (!show) return null;

    const topSnippet = await ctx.db
      .query("snippets")
      .withIndex("by_showId", (q) => q.eq("showId", show._id))
      .first();

    return {
      showId: show._id,
      title: show.title,
      description: show.description,
      hostName: show.hostName,
      sampleEmbedding: topSnippet?.vectorEmbedding,
      curationSummary: show.openAiCurationReport?.summary,
      fallInLovePromise: show.openAiCurationReport?.fallInLovePromise,
      sampleHookText: topSnippet?.hookText,
    };
  },
});

export const getShowIdsFromSnippetIds = internalQuery({
  args: {
    snippetIds: v.array(v.id("snippets")),
  },
  returns: v.array(
    v.object({
      snippetId: v.id("snippets"),
      showId: v.id("shows"),
      topic: v.optional(v.string()),
      hookText: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const items = [];
    for (const snippetId of args.snippetIds) {
      const snippet = await ctx.db.get("snippets", snippetId);
      if (snippet) {
        items.push({
          snippetId: snippet._id,
          showId: snippet.showId,
          topic: snippet.topic,
          hookText: snippet.hookText,
        });
      }
    }
    return items;
  },
});

export const getDiverseShowIdsForRag = internalQuery({
  args: {
    excludeShowId: v.optional(v.id("shows")),
    limit: v.number(),
  },
  returns: v.array(v.id("shows")),
  handler: async (ctx, args) => {
    const all = await ctx.db.query("shows").take(250);
    const valid = all.filter((s) => !s.isTakenDown && s._id !== args.excludeShowId);
    const shuffled = [...valid].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, args.limit).map((s) => s._id);
  },
});

export const getShowsAndSnippetsForRag = internalQuery({
  args: {
    showIds: v.array(v.id("shows")),
  },
  returns: v.array(
    v.object({
      showId: v.id("shows"),
      title: v.string(),
      hostName: v.string(),
      coverArtUrl: v.string(),
      description: v.string(),
      curationSummary: v.optional(v.string()),
      fallInLovePromise: v.optional(v.string()),
      ampScore: v.optional(v.number()),
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
          topic: v.optional(v.string()),
          whyYouWillLikeIt: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const results = [];
    for (const showId of args.showIds) {
      const show = await ctx.db.get("shows", showId);
      if (!show || show.isTakenDown) continue;

      const snippets = await ctx.db
        .query("snippets")
        .withIndex("by_showId", (q) => q.eq("showId", showId))
        .take(4);

      if (snippets.length === 0) continue;

      const episodes = await ctx.db
        .query("episodes")
        .withIndex("by_showId", (q) => q.eq("showId", showId))
        .take(5);
      const epMap = new Map(episodes.map((ep) => [ep._id, ep]));

      const clips = snippets.map((s) => {
        const ep = epMap.get(s.episodeId);
        const rawExcerpt = s.transcriptExcerpt || "";
        const whyMatch = rawExcerpt.match(
          /\[Why you'll love it\]:\s*([\s\S]*?)(?=\n\n\[Excerpt\]|$)/i,
        );
        const excerptMatch = rawExcerpt.match(/\[Excerpt\]:\s*([\s\S]*?)$/i);
        return {
          snippetId: String(s._id),
          episodeTitle: ep?.title || "Featured Episode",
          audioUrl: ep?.audioUrl || "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg",
          startTime: s.startTime,
          endTime: s.endTime,
          duration: Math.max(1, s.endTime - s.startTime),
          hookText: s.hookText,
          transcriptExcerpt: excerptMatch ? excerptMatch[1].trim() : rawExcerpt,
          topic: s.topic,
          whyYouWillLikeIt:
            whyMatch ? whyMatch[1].trim() : s.whyYouWillLikeIt || s.hookText,
        };
      });

      const socialLinks = show.firecrawlSignals?.socialLinks || [];
      const spotifyUrl =
        show.platformLinks?.spotify ||
        show.socialProfiles?.spotify ||
        socialLinks.find((l) => l.includes("open.spotify.com/show/") || l.includes("spotify.com/show/"));
      const appleUrl =
        show.platformLinks?.apple ||
        show.socialProfiles?.apple ||
        socialLinks.find((l) => l.includes("podcasts.apple.com") && l.includes("/podcast/"));
      const youtubeUrl =
        show.platformLinks?.youtube ||
        show.socialProfiles?.youtube ||
        socialLinks.find(
          (l) =>
            l.includes("youtube.com/@") ||
            l.includes("youtube.com/c/") ||
            l.includes("youtube.com/channel/") ||
            l.includes("youtube.com/user/"),
        );

      results.push({
        showId: show._id,
        title: show.title,
        hostName: show.hostName || "Featured Host",
        coverArtUrl: show.coverArtUrl,
        description: show.description,
        curationSummary: show.openAiCurationReport?.summary,
        fallInLovePromise: show.openAiCurationReport?.fallInLovePromise,
        ampScore: show.ampScore,
        websiteUrl: show.websiteUrl,
        spotifyUrl,
        appleUrl,
        youtubeUrl,
        clips,
      });
    }
    return results;
  },
});

export const ampShow = mutation({
  args: { showId: v.id("shows") },
  returns: v.object({
    isAmped: v.boolean(),
    ampScore: v.number(),
  }),
  handler: async () => {
    return {
      isAmped: false,
      ampScore: 0,
    };
  },
});

export const updateShowHostEmail = mutation({
  args: {
    showId: v.id("shows"),
    hostEmail: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    hostEmail: v.string(),
  }),
  handler: async (ctx, args) => {
    const show = await ctx.db.get("shows", args.showId);
    if (!show) {
      throw new Error(`Show not found: ${args.showId}`);
    }
    const cleanEmail = args.hostEmail.trim();
    await ctx.db.patch("shows", args.showId, {
      hostEmail: cleanEmail || undefined,
    });
    return {
      success: true,
      hostEmail: cleanEmail,
    };
  },
});

export const checkExistingShow = internalQuery({
  args: {
    slug: v.string(),
    rssUrl: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  returns: v.union(
    v.null(),
    v.object({
      showId: v.id("shows"),
      title: v.string(),
      slug: v.string(),
      rssUrl: v.optional(v.string()),
      websiteUrl: v.optional(v.string()),
      hostName: v.optional(v.string()),
      hostEmail: v.optional(v.string()),
      firecrawlSignals: v.optional(
        v.object({
          reviews: v.string(),
          socialLinks: v.array(v.string()),
          officialWebsite: v.string(),
        }),
      ),
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
      hasClips: v.boolean(),
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
  ),
  handler: async (ctx, args) => {
    let show = await ctx.db
      .query("shows")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!show) {
      const allShows = await ctx.db.query("shows").take(250);
      const normCand = args.title ? args.title.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
      const feedCand = args.rssUrl?.trim().toLowerCase().replace(/\/+$/, "");

      show =
        allShows.find((s) => {
          if (feedCand && s.rssUrl && s.rssUrl.trim().toLowerCase().replace(/\/+$/, "") === feedCand) {
            return true;
          }
          if (normCand && s.title && s.title.toLowerCase().replace(/[^a-z0-9]/g, "") === normCand) {
            return true;
          }
          return false;
        }) ?? null;
    }

    if (!show) return null;

    const snippets = await ctx.db
      .query("snippets")
      .withIndex("by_showId", (q) => q.eq("showId", show._id))
      .collect();

    const episodes = await ctx.db
      .query("episodes")
      .withIndex("by_showId", (q) => q.eq("showId", show._id))
      .collect();
    const epMap = new Map(episodes.map((ep) => [ep._id, ep]));

    const clips = snippets.map((snip) => {
      const ep = epMap.get(snip.episodeId);
      return {
        episodeTitle: ep?.title || snip.hookText,
        audioUrl: ep?.audioUrl || "",
        startTime: snip.startTime,
        endTime: snip.endTime,
        duration: Math.max(1, snip.endTime - snip.startTime),
        hookText: snip.hookText,
        transcriptExcerpt: snip.transcriptExcerpt,
        whyYouWillLikeIt: snip.whyYouWillLikeIt ?? "",
        energyLevel: snip.energyLevel,
        curatorScore: snip.curatorScore,
        topic: snip.topic,
        alternativeMomentsConsidered: snip.alternativeMomentsConsidered,
      };
    });

    return {
      showId: show._id,
      title: show.title,
      slug: show.slug,
      rssUrl: show.rssUrl,
      websiteUrl: show.websiteUrl,
      hostName: show.hostName,
      hostEmail: show.hostEmail,
      firecrawlSignals: show.firecrawlSignals,
      hosts: show.hosts,
      socialProfiles: show.socialProfiles,
      highlightClips: show.highlightClips,
      firecrawlReport: show.firecrawlReport,
      openAiCurationReport: show.openAiCurationReport,
      hasClips: snippets.length > 0,
      clips,
    };
  },
});

