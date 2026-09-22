import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

export const persistMappedShow = internalMutation({
  args: {
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    rssUrl: v.string(),
    websiteUrl: v.optional(v.string()),
    coverArtUrl: v.string(),
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
        spotify: v.optional(v.string()),
        apple: v.optional(v.string()),
      }),
    ),
    platformLinks: v.optional(
      v.object({
        spotify: v.optional(v.string()),
        apple: v.optional(v.string()),
        youtube: v.optional(v.string()),
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
    episodes: v.array(
      v.object({
        title: v.string(),
        audioUrl: v.string(),
        pubDate: v.number(),
        durationSeconds: v.number(),
        summary: v.string(),
      }),
    ),
    snippets: v.array(
      v.object({
        episodeAudioUrl: v.string(),
        startTime: v.number(),
        endTime: v.number(),
        hookText: v.string(),
        transcriptExcerpt: v.string(),
        whyYouWillLikeIt: v.optional(v.string()),
        energyLevel: v.optional(v.string()),
        curatorScore: v.optional(v.number()),
        topic: v.optional(v.string()),
        alternativeMomentsConsidered: v.optional(v.string()),
        vectorEmbedding: v.array(v.float64()),
      }),
    ),
  },
  returns: v.object({
    showId: v.id("shows"),
    episodeCount: v.number(),
    snippetCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("shows")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    const showId = existing
      ? existing._id
      : await ctx.db.insert("shows", {
          title: args.title,
          slug: args.slug,
          description: args.description,
          rssUrl: args.rssUrl,
          websiteUrl: args.websiteUrl,
          coverArtUrl: args.coverArtUrl,
          hostName: args.hostName,
          hostEmail: args.hostEmail,
          isClaimed: false,
          claimedByUserId: undefined,
          isAmped: false,
          ampScore: 0,
          coordinates: computeCoordinates(args.slug),
          firecrawlSignals: args.firecrawlSignals,
          hosts: args.hosts,
          socialProfiles: args.socialProfiles,
          platformLinks: args.platformLinks,
          highlightClips: args.highlightClips,
          firecrawlReport: args.firecrawlReport,
          openAiCurationReport: args.openAiCurationReport,
        });

    if (existing) {
      await ctx.db.patch("shows", showId, {
        title: args.title,
        description: args.description,
        rssUrl: args.rssUrl,
        websiteUrl: args.websiteUrl,
        coverArtUrl: args.coverArtUrl,
        hostName: args.hostName,
        hostEmail: args.hostEmail,
        ...(args.firecrawlSignals ? { firecrawlSignals: args.firecrawlSignals } : {}),
        ...(args.hosts ? { hosts: args.hosts } : {}),
        ...(args.socialProfiles ? { socialProfiles: args.socialProfiles } : {}),
        ...(args.platformLinks ? { platformLinks: args.platformLinks } : {}),
        ...(args.highlightClips ? { highlightClips: args.highlightClips } : {}),
        ...(args.firecrawlReport ? { firecrawlReport: args.firecrawlReport } : {}),
        ...(args.openAiCurationReport ? { openAiCurationReport: args.openAiCurationReport } : {}),
      });
    }

    const existingEpisodes = await ctx.db
      .query("episodes")
      .withIndex("by_showId", (q) => q.eq("showId", showId))
      .collect();
    const existingEpisodeIdByAudio = new Map(
      existingEpisodes.map((episode) => [episode.audioUrl, episode._id]),
    );

    const episodeIdByAudioUrl = new Map<string, Id<"episodes">>();
    for (const episode of args.episodes) {
      const knownEpisodeId = existingEpisodeIdByAudio.get(episode.audioUrl);
      const episodeId = knownEpisodeId
        ? knownEpisodeId
        : await ctx.db.insert("episodes", {
            showId,
            title: episode.title,
            audioUrl: episode.audioUrl,
            pubDate: episode.pubDate,
            durationSeconds: episode.durationSeconds,
            summary: episode.summary,
          });
      episodeIdByAudioUrl.set(episode.audioUrl, episodeId);
    }

    const existingSnippets = await ctx.db
      .query("snippets")
      .withIndex("by_showId", (q) => q.eq("showId", showId))
      .collect();
    const existingSnippetKeys = new Set(
      existingSnippets.map(
        (snippet) =>
          `${snippet.episodeId}:${snippet.startTime}:${snippet.endTime}:${snippet.hookText}`,
      ),
    );

    let snippetCount = 0;
    for (const snippet of args.snippets) {
      const episodeId = episodeIdByAudioUrl.get(snippet.episodeAudioUrl);
      if (!episodeId) {
        continue;
      }
      const snippetKey = `${episodeId}:${snippet.startTime}:${snippet.endTime}:${snippet.hookText}`;
      if (existingSnippetKeys.has(snippetKey)) {
        continue;
      }
      await ctx.db.insert("snippets", {
        showId,
        episodeId,
        startTime: snippet.startTime,
        endTime: snippet.endTime,
        hookText: snippet.hookText,
        transcriptExcerpt: snippet.transcriptExcerpt,
        whyYouWillLikeIt: snippet.whyYouWillLikeIt,
        energyLevel: snippet.energyLevel,
        curatorScore: snippet.curatorScore,
        topic: snippet.topic,
        alternativeMomentsConsidered: snippet.alternativeMomentsConsidered,
        vectorEmbedding: snippet.vectorEmbedding,
        playCount: 0,
        upvotes: 0,
      });
      existingSnippetKeys.add(snippetKey);
      snippetCount += 1;
    }

    await ctx.db.patch("shows", showId, {
      ampScore: Math.min(100, snippetCount * 12),
      isAmped: snippetCount >= 3,
    });

    return {
      showId,
      episodeCount: args.episodes.length,
      snippetCount,
    };
  },
});

export function computeCoordinates(slug: string): { x: number; y: number; z: number } {
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
