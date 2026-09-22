import { v } from "convex/values";

import { action, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  type DiscoveredClip,
  type DiscoveredHost,
  type FirecrawlReport,
  runDeepFirecrawlResearch,
  type SocialProfiles,
} from "./firecrawlAgent";
import { getAuthUserId } from "@convex-dev/auth/core";

async function requireAdmin(ctx: any) {
  const users = await ctx.db.query("users").take(1);
  if (users.length === 0) {
    return null;
  }
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Unauthorized: Admin login required.");
  }
  const user = await ctx.db.get("users", userId);
  if (!user || (user.role !== "superadmin" && user.role !== "admin")) {
    throw new Error("Forbidden: User does not have approved admin privileges.");
  }
  return user;
}

export const verifyOwnerPassword = mutation({
  args: {
    password: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (_ctx, args) => {
    const ownerSecret =
      process.env.ADMIN_PASSWORD || process.env.ADMIN_SECRET || "discopod-admin";
    if (args.password.trim() === ownerSecret.trim()) {
      return { success: true };
    }
    return { success: false, error: "Incorrect owner password. Access denied." };
  },
});

export const getDatabaseStats = query({
  args: {},
  returns: v.object({
    counts: v.object({
      shows: v.number(),
      episodes: v.number(),
      snippets: v.number(),
      territoryClaims: v.number(),
    }),
    shows: v.array(
      v.object({
        showId: v.id("shows"),
        title: v.string(),
        slug: v.string(),
        rssUrl: v.optional(v.string()),
        hostName: v.optional(v.string()),
        hostEmail: v.optional(v.string()),
        isAmped: v.optional(v.boolean()),
        ampScore: v.optional(v.number()),
        isClaimed: v.boolean(),
        coordinates: v.object({ x: v.number(), y: v.number(), z: v.number() }),
        episodeCount: v.number(),
        snippetCount: v.number(),
        inboxThreadId: v.optional(v.string()),
        claimToken: v.optional(v.string()),
        claimStatus: v.optional(v.string()),
      }),
    ),
    claims: v.array(
      v.object({
        claimId: v.id("territoryClaims"),
        showId: v.id("shows"),
        showTitle: v.string(),
        inboxThreadId: v.string(),
        claimStatus: v.union(
          v.literal("pending"),
          v.literal("verified"),
          v.literal("rejected"),
        ),
        token: v.string(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const allShows = await ctx.db.query("shows").collect();
    const allEpisodes = await ctx.db.query("episodes").collect();
    const allClaims = await ctx.db.query("territoryClaims").collect();

    const showMap = new Map(allShows.map((s) => [s._id, s.title]));

    const episodeCountByShow = new Map<string, number>();
    for (const ep of allEpisodes) {
      episodeCountByShow.set(ep.showId, (episodeCountByShow.get(ep.showId) ?? 0) + 1);
    }

    const claimByShowId = new Map<string, (typeof allClaims)[0]>();
    for (const claim of allClaims) {
      const existing = claimByShowId.get(claim.showId);
      if (!existing || claim.claimStatus === "verified" || existing.claimStatus === "pending") {
        claimByShowId.set(claim.showId, claim);
      }
    }

    const showsSummary = allShows.map((show) => {
      const claim = claimByShowId.get(show._id);
      const episodeCount = episodeCountByShow.get(show._id) ?? 0;
      return {
        showId: show._id,
        title: show.title,
        slug: show.slug,
        rssUrl: show.rssUrl,
        hostName: show.hostName,
        hostEmail: show.hostEmail,
        isAmped: show.isAmped ?? false,
        ampScore: show.ampScore ?? 0,
        isClaimed: show.isClaimed,
        coordinates: show.coordinates,
        episodeCount,
        snippetCount: episodeCount,
        inboxThreadId: claim?.inboxThreadId,
        claimToken: claim?.token,
        claimStatus: claim?.claimStatus,
      };
    });

    const claimsSummary = allClaims.map((claim) => ({
      claimId: claim._id,
      showId: claim.showId,
      showTitle: showMap.get(claim.showId) ?? "Unknown Show",
      inboxThreadId: claim.inboxThreadId,
      claimStatus: claim.claimStatus,
      token: claim.token,
    }));

    return {
      counts: {
        shows: allShows.length,
        episodes: allEpisodes.length,
        snippets: allEpisodes.length,
        territoryClaims: allClaims.length,
      },
      shows: showsSummary,
      claims: claimsSummary,
    };
  },
});

export const checkEnvHealth = query({
  args: {},
  returns: v.object({
    openaiConfigured: v.boolean(),
    firecrawlConfigured: v.boolean(),
    agentmailConfigured: v.boolean(),
    webhookSecretConfigured: v.boolean(),
  }),
  handler: async () => {
    return {
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      firecrawlConfigured: Boolean(process.env.FIRECRAWL_API_KEY),
      agentmailConfigured: Boolean(process.env.AGENTMAIL_API_KEY),
      webhookSecretConfigured: Boolean(process.env.AGENTMAIL_WEBHOOK_SECRET),
    };
  },
});

export const clearDatabase = mutation({
  args: {},
  returns: v.object({
    clearedShows: v.number(),
    clearedEpisodes: v.number(),
    clearedSnippets: v.number(),
    clearedClaims: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const shows = await ctx.db.query("shows").collect();
    for (const show of shows) {
      await ctx.db.delete(show._id);
    }

    const episodes = await ctx.db.query("episodes").collect();
    for (const ep of episodes) {
      await ctx.db.delete(ep._id);
    }

    const snippets = await ctx.db.query("snippets").collect();
    for (const snip of snippets) {
      await ctx.db.delete(snip._id);
    }

    const claims = await ctx.db.query("territoryClaims").collect();
    for (const claim of claims) {
      await ctx.db.delete(claim._id);
    }

    return {
      clearedShows: shows.length,
      clearedEpisodes: episodes.length,
      clearedSnippets: snippets.length,
      clearedClaims: claims.length,
    };
  },
});

export const seedDemoDatabase = mutation({
  args: {},
  returns: v.object({
    showsSeeded: v.number(),
    episodesSeeded: v.number(),
    snippetsSeeded: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const demoShowsData = [
      {
        title: "Pitch Dark Product Stories",
        slug: "pitch-dark-product-stories",
        description: "Late-night tales of high-stakes product launches, edge-case bugs, and startup redemption arcs.",
        rssUrl: "https://feeds.discopod.io/pitch-dark/rss.xml",
        websiteUrl: "https://pitchdark.fm",
        coverArtUrl: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=300&h=300&fit=crop",
        hostName: "Elena Vance",
        hostEmail: "elena@pitchdark.fm",
        isClaimed: true,
        isAmped: true,
        ampScore: 92,
        coordinates: { x: 0.12, y: 0.58, z: -0.25 },
        episodes: [
          {
            title: "The launch that nearly missed midnight",
            audioUrl: "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg",
            pubDate: 1724673600000,
            durationSeconds: 1840,
            summary: "How one unselected onboarding checkbox triggered cascading payment gateway failures 12 minutes before the product hunt drop.",
            snippets: [
              {
                startTime: 615,
                endTime: 660,
                hookText: "How one onboarding checkbox almost tanked the entire product launch.",
                transcriptExcerpt: "We thought the hard part was done, then one single checkbox blocked all signups across three continents.",
                playCount: 42,
                upvotes: 18,
              },
              {
                startTime: 1120,
                endTime: 1175,
                hookText: "The 3:00 AM hotfix that saved 10,000 customers from churn.",
                transcriptExcerpt: "Our database connection pool was saturated. Elena ran the raw migration by hand while the team held their breath.",
                playCount: 29,
                upvotes: 11,
              },
            ],
          },
          {
            title: "Zero to One Million API calls in 48 hours",
            audioUrl: "https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg",
            pubDate: 1724068800000,
            durationSeconds: 2150,
            summary: "What happens to your cache architecture when an influencer tweets your prototype.",
            snippets: [
              {
                startTime: 340,
                endTime: 395,
                hookText: "When Redis collapsed under a 200x traffic surge.",
                transcriptExcerpt: "The cache hit ratio dropped from 99% to 12% in sixty seconds. Here is how we survived.",
                playCount: 35,
                upvotes: 15,
              },
            ],
          },
        ],
      },
      {
        title: "Side Quest Signals",
        slug: "side-quest-signals",
        description: "Exploring unexpected hacker hobbies, synthesizer tinkering, and creative tangents that fuel great software.",
        rssUrl: "https://feeds.discopod.io/side-quest/rss.xml",
        websiteUrl: "https://sidequest.io",
        coverArtUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop",
        hostName: "Marcus Brody",
        hostEmail: "marcus@sidequest.io",
        isClaimed: false,
        isAmped: true,
        ampScore: 78,
        coordinates: { x: -0.45, y: -0.22, z: 0.35 },
        episodes: [
          {
            title: "Analog synthesizers and reactive programming",
            audioUrl: "https://actions.google.com/sounds/v1/ambiences/outdoor_ambience.ogg",
            pubDate: 1724500800000,
            durationSeconds: 2400,
            summary: "Modular patch cables taught me more about state machines than ten years of reading software engineering manuals.",
            snippets: [
              {
                startTime: 480,
                endTime: 535,
                hookText: "Patch cables and event emitters are literally the exact same mental model.",
                transcriptExcerpt: "Once you understand control voltage, asynchronous event loops suddenly feel completely natural.",
                playCount: 19,
                upvotes: 8,
              },
            ],
          },
        ],
      },
      {
        title: "Cosmic Disco Radio",
        slug: "cosmic-disco-radio",
        description: "Futuristic audio explorations blending space disco, underground electronica, and vinyl preservation stories.",
        rssUrl: "https://feeds.discopod.io/cosmic-disco/rss.xml",
        websiteUrl: "https://cosmicdisco.club",
        coverArtUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
        hostName: "DJ Nova",
        hostEmail: "nova@cosmicdisco.club",
        isClaimed: false,
        isAmped: true,
        ampScore: 96,
        coordinates: { x: 0.38, y: -0.42, z: 0.52 },
        episodes: [
          {
            title: "Lost Italian Space Disco Tapes of 1979",
            audioUrl: "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg",
            pubDate: 1724414400000,
            durationSeconds: 3100,
            summary: "Unearthing reel-to-reel master tapes from an abandoned Milan dance club basement.",
            snippets: [
              {
                startTime: 210,
                endTime: 265,
                hookText: "The unreleased Giorgio Moroder bootleg that nobody knew existed.",
                transcriptExcerpt: "The tape was labeled Studio 54 test pressing, but the bassline was something from another galaxy entirely.",
                playCount: 88,
                upvotes: 45,
              },
            ],
          },
        ],
      },
      {
        title: "Deep Dive Tech & Systems",
        slug: "deep-dive-tech-systems",
        description: "Interviews with distributed database architects, compiler authors, and low-level runtime creators.",
        rssUrl: "https://feeds.discopod.io/deep-dive/rss.xml",
        websiteUrl: "https://deepdivetech.dev",
        coverArtUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=300&h=300&fit=crop",
        hostName: "Tara Sharma",
        hostEmail: "tara@deepdivetech.dev",
        isClaimed: false,
        isAmped: false,
        ampScore: 58,
        coordinates: { x: -0.28, y: 0.62, z: 0.38 },
        episodes: [
          {
            title: "Why vector databases need hybrid retrieval",
            audioUrl: "https://actions.google.com/sounds/v1/ambiences/outdoor_ambience.ogg",
            pubDate: 1724241600000,
            durationSeconds: 2700,
            summary: "Embeddings are great for fuzzy meaning, but exact keyword match still rules specific catalog IDs.",
            snippets: [
              {
                startTime: 720,
                endTime: 780,
                hookText: "Pure semantic vector search will fail your users without keyword reranking.",
                transcriptExcerpt: "Cosine similarity loses precision on exact show names and product serials. Reciprocal rank fusion is mandatory.",
                playCount: 64,
                upvotes: 27,
              },
            ],
          },
        ],
      },
      {
        title: "Startup Graveyard",
        slug: "startup-graveyard",
        description: "Post-mortems of ambitious tech startups that raised 50 million dollars and vanished into thin air.",
        rssUrl: "https://feeds.discopod.io/startup-graveyard/rss.xml",
        websiteUrl: "https://startupgraveyard.co",
        coverArtUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&h=300&fit=crop",
        hostName: "Leo Fontaine",
        hostEmail: "leo@startupgraveyard.co",
        isClaimed: false,
        isAmped: true,
        ampScore: 84,
        coordinates: { x: 0.52, y: 0.15, z: -0.58 },
        episodes: [
          {
            title: "The Smart Juicer Debacle Revisited",
            audioUrl: "https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg",
            pubDate: 1723982400000,
            durationSeconds: 2200,
            summary: "A teardown of hardware over-engineering, DRM fruit packs, and the viral video that ended it all.",
            snippets: [
              {
                startTime: 510,
                endTime: 565,
                hookText: "The 400-dollar press that could be squeezed faster with two human hands.",
                transcriptExcerpt: "The Bloomberg reporters simply squeezed the pouch directly into a glass. In 10 seconds, the company's valuation evaporated.",
                playCount: 76,
                upvotes: 39,
              },
            ],
          },
        ],
      },
      {
        title: "The Synthesizer Chronicles",
        slug: "the-synthesizer-chronicles",
        description: "A deep auditory journey into the golden age of analog filters, voltage control, and electronic music pioneers.",
        rssUrl: "https://feeds.discopod.io/synthesizer-chronicles/rss.xml",
        websiteUrl: "https://synthchronicles.audio",
        coverArtUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop",
        hostName: "Maya Lin",
        hostEmail: "maya@synthchronicles.audio",
        isClaimed: false,
        isAmped: false,
        ampScore: 48,
        coordinates: { x: -0.62, y: -0.32, z: -0.28 },
        episodes: [
          {
            title: "The Ladder Filter Mystery of 1964",
            audioUrl: "https://actions.google.com/sounds/v1/ambiences/outdoor_ambience.ogg",
            pubDate: 1723809600000,
            durationSeconds: 1950,
            summary: "How a fortuitous distortion in transistor symmetry produced the legendary warm low-pass sweep.",
            snippets: [
              {
                startTime: 390,
                endTime: 440,
                hookText: "The circuit glitch that gave modern electronic music its signature warm bass.",
                transcriptExcerpt: "It was technically an engineering flaw, but when Bob played the keyboard, nobody wanted the flaw fixed.",
                playCount: 31,
                upvotes: 14,
              },
            ],
          },
        ],
      },
    ];

    let totalEpisodes = 0;
    let totalSnippets = 0;

    for (const showData of demoShowsData) {
      const existing = await ctx.db
        .query("shows")
        .withIndex("by_slug", (q) => q.eq("slug", showData.slug))
        .unique();

      const showId = existing
        ? existing._id
        : await ctx.db.insert("shows", {
            title: showData.title,
            slug: showData.slug,
            description: showData.description,
            rssUrl: showData.rssUrl,
            websiteUrl: showData.websiteUrl,
            coverArtUrl: showData.coverArtUrl,
            hostName: showData.hostName,
            hostEmail: showData.hostEmail,
            isClaimed: showData.isClaimed,
            claimedByUserId: undefined,
            isAmped: showData.isAmped,
            ampScore: showData.ampScore,
            coordinates: showData.coordinates,
          });

      for (const epData of showData.episodes) {
        totalEpisodes += 1;
        const episodeId = await ctx.db.insert("episodes", {
          showId,
          title: epData.title,
          audioUrl: epData.audioUrl,
          pubDate: epData.pubDate,
          durationSeconds: epData.durationSeconds,
          summary: epData.summary,
        });

        for (const snipData of epData.snippets) {
          totalSnippets += 1;
          const vectorEmbedding = generateDeterministicEmbedding(
            `${showData.title} ${epData.title} ${snipData.hookText}`,
          );

          await ctx.db.insert("snippets", {
            showId,
            episodeId,
            startTime: snipData.startTime,
            endTime: snipData.endTime,
            hookText: snipData.hookText,
            transcriptExcerpt: snipData.transcriptExcerpt,
            vectorEmbedding,
            playCount: snipData.playCount,
            upvotes: snipData.upvotes,
          });
        }
      }

      if (showData.slug === "pitch-dark-product-stories") {
        const existingClaim = await ctx.db
          .query("territoryClaims")
          .withIndex("by_showId", (q) => q.eq("showId", showId))
          .unique();

        if (!existingClaim) {
          await ctx.db.insert("territoryClaims", {
            showId,
            inboxThreadId: "th_demo_preview_9812",
            claimStatus: "verified",
            token: "claim_tok_991823",
          });
        }
      } else if (showData.slug === "side-quest-signals") {
        const existingClaim = await ctx.db
          .query("territoryClaims")
          .withIndex("by_showId", (q) => q.eq("showId", showId))
          .unique();

        if (!existingClaim) {
          await ctx.db.insert("territoryClaims", {
            showId,
            inboxThreadId: "th_demo_preview_4421",
            claimStatus: "pending",
            token: "claim_tok_sidequest_77",
          });
        }
      }
    }

    return {
      showsSeeded: demoShowsData.length,
      episodesSeeded: totalEpisodes,
      snippetsSeeded: totalSnippets,
    };
  },
});

export const testOpenAiEmbedding = action({
  args: {
    prompt: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    model: v.string(),
    dimensions: v.number(),
    latencyMs: v.number(),
    previewVector: v.array(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (_ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        model: "text-embedding-3-small",
        dimensions: 0,
        latencyMs: 0,
        previewVector: [],
        error: "OPENAI_API_KEY is not configured in environment.",
      };
    }

    const start = Date.now();
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: args.prompt.trim() || "DiscoPod podcast discovery test embedding",
        }),
      });

      const latencyMs = Date.now() - start;
      if (!response.ok) {
        const text = await response.text();
        return {
          success: false,
          model: "text-embedding-3-small",
          dimensions: 0,
          latencyMs,
          previewVector: [],
          error: `OpenAI returned status ${response.status}: ${text}`,
        };
      }

      const payload = (await response.json()) as {
        data?: Array<{ embedding?: number[] }>;
      };
      const embedding = payload.data?.[0]?.embedding;
      if (!embedding) {
        return {
          success: false,
          model: "text-embedding-3-small",
          dimensions: 0,
          latencyMs,
          previewVector: [],
          error: "No embedding array found in OpenAI response.",
        };
      }

      return {
        success: true,
        model: "text-embedding-3-small",
        dimensions: embedding.length,
        latencyMs,
        previewVector: embedding.slice(0, 5),
      };
    } catch (err) {
      return {
        success: false,
        model: "text-embedding-3-small",
        dimensions: 0,
        latencyMs: Date.now() - start,
        previewVector: [],
        error: err instanceof Error ? err.message : "Unknown error calling OpenAI API",
      };
    }
  },
});

export const testFirecrawlExtraction = action({
  args: {
    sourceType: v.union(v.literal("rss"), v.literal("apple"), v.literal("title")),
    sourceValue: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    latencyMs: v.number(),
    extractedTitle: v.optional(v.string()),
    episodeCount: v.optional(v.number()),
    rawSnippet: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (_ctx, args) => {
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlApiKey) {
      return {
        success: false,
        latencyMs: 0,
        error: "FIRECRAWL_API_KEY is not configured in environment.",
      };
    }

    const start = Date.now();
    try {
      const response = await fetch("https://api.firecrawl.dev/v1/extract", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceType: args.sourceType,
          sourceValue: args.sourceValue,
        }),
      });

      const latencyMs = Date.now() - start;
      if (!response.ok) {
        const text = await response.text();
        return {
          success: false,
          latencyMs,
          error: `Firecrawl API returned status ${response.status}: ${text}`,
        };
      }

      const payload = (await response.json()) as {
        data?: {
          title?: string;
          episodes?: unknown[];
          description?: string;
        };
      };

      return {
        success: true,
        latencyMs,
        extractedTitle: payload.data?.title ?? "Unknown",
        episodeCount: payload.data?.episodes?.length ?? 0,
        rawSnippet: JSON.stringify(payload.data ?? {}).slice(0, 300),
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : "Unknown Firecrawl extraction failure",
      };
    }
  },
});

export const testAgentMailSimulation = action({
  args: {
    command: v.union(
      v.literal("verify"),
      v.literal("claim"),
      v.literal("reject"),
      v.literal("change_snippet"),
    ),
    claimToken: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    outcome: v.string(),
    tokenUsed: v.string(),
    inboxThreadId: v.string(),
  }),
  handler: async (ctx, args) => {
    const stats: {
      claims: Array<{
        claimId: string;
        showId: string;
        showTitle: string;
        inboxThreadId: string;
        claimStatus: "pending" | "verified" | "rejected";
        token: string;
      }>;
    } = await ctx.runQuery(api.admin.getDatabaseStats, {});
    const existingClaim = args.claimToken
      ? stats.claims.find((c) => c.token === args.claimToken)
      : stats.claims[0];

    if (!existingClaim) {
      return {
        success: false,
        outcome: "no_claims_found_to_test",
        tokenUsed: args.claimToken ?? "none",
        inboxThreadId: "none",
      };
    }

    const outcome: { outcome: string } = await ctx.runMutation(
      internal.territoryClaims.processInboundClaimCommand,
      {
        inboxThreadId: existingClaim.inboxThreadId,
        token: existingClaim.token,
        command: args.command,
      },
    );

    return {
      success: true,
      outcome: outcome.outcome,
      tokenUsed: existingClaim.token,
      inboxThreadId: existingClaim.inboxThreadId,
    };
  },
});

export const getShowClipsForAdmin = query({
  args: { showId: v.id("shows") },
  returns: v.union(
    v.null(),
    v.object({
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
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const show = await ctx.db.get("shows", args.showId);
    if (!show) return null;
    const snippets = await ctx.db
      .query("snippets")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .take(10);
    const episodes = await ctx.db
      .query("episodes")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .take(10);
    const epMap = new Map(episodes.map((ep) => [ep._id, ep]));

    const clips = snippets.map((s) => {
      const ep = epMap.get(s.episodeId);
      const rawExcerpt = s.transcriptExcerpt || "";
      const whyMatch = rawExcerpt.match(
        /\[Why you'll love it\]:\s*([\s\S]*?)(?=\n\n\[Excerpt\]|$)/i,
      );
      const excerptMatch = rawExcerpt.match(/\[Excerpt\]:\s*([\s\S]*?)$/i);
      return {
        episodeTitle: ep?.title || "Episode Highlight",
        audioUrl: ep?.audioUrl || "",
        startTime: s.startTime,
        endTime: s.endTime,
        duration: Math.max(1, s.endTime - s.startTime),
        hookText: s.hookText,
        transcriptExcerpt: excerptMatch ? excerptMatch[1].trim() : rawExcerpt,
        whyYouWillLikeIt: whyMatch
          ? whyMatch[1].trim()
          : "High-engagement podcast highlight.",
      };
    });

    return {
      showId: show._id,
      title: show.title,
      hostName: show.hostName || "Unknown Host",
      websiteUrl: show.websiteUrl || "",
      hostEmail: show.hostEmail || "",
      firecrawlSignals: show.firecrawlSignals || {
        reviews: "Show successfully ingested and mapped in DiscoPod.",
        socialLinks: [],
        officialWebsite: show.websiteUrl || "",
      },
      clips,
    };
  },
});

export const getShowForProbe = query({
  args: { showId: v.id("shows") },
  handler: async (ctx, args) => {
    const show = await ctx.db.get("shows", args.showId);
    if (!show) return null;
    const episodes = await ctx.db
      .query("episodes")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .take(5);
    return {
      ...show,
      episodeSummaries: episodes.map((e) => e.summary),
      episodeTitles: episodes.map((e) => e.title),
    };
  },
});

type QaFirecrawlProbeResult = {
  success: boolean;
  latencyMs: number;
  queryUsed: string;
  officialWebsite: string;
  reviews: string;
  socialLinks: string[];
  rawSnippet: string;
  hosts?: DiscoveredHost[];
  socialProfiles?: SocialProfiles;
  highlightClips?: DiscoveredClip[];
  firecrawlReport?: FirecrawlReport;
  error?: string;
};

export const qaFirecrawlProbe = action({
  args: {
    showId: v.id("shows"),
  },
  returns: v.object({
    success: v.boolean(),
    latencyMs: v.number(),
    queryUsed: v.string(),
    officialWebsite: v.string(),
    reviews: v.string(),
    socialLinks: v.array(v.string()),
    rawSnippet: v.string(),
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
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<QaFirecrawlProbeResult> => {
    const show: {
      title: string;
      description?: string;
      websiteUrl?: string;
      hostName?: string;
      episodeSummaries: string[];
      episodeTitles?: string[];
    } | null = await ctx.runQuery(api.admin.getShowForProbe, { showId: args.showId });
    if (!show) {
      return {
        success: false,
        latencyMs: 0,
        queryUsed: "unknown",
        officialWebsite: "",
        reviews: "",
        socialLinks: [],
        rawSnippet: "",
        error: "Show not found in database.",
      };
    }

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey) {
      return {
        success: false,
        latencyMs: 0,
        queryUsed: "",
        officialWebsite: show.websiteUrl ?? "",
        reviews: "",
        socialLinks: [],
        rawSnippet: "",
        error: "FIRECRAWL_API_KEY is not configured in environment.",
      };
    }

    try {
      const research = await runDeepFirecrawlResearch({
        firecrawlKey,
        openAiKey: process.env.OPENAI_API_KEY,
        showTitle: show.title,
        hostName: show.hostName,
        showDescription: show.description,
        episodeTitles: show.episodeTitles,
        rssWebsite: show.websiteUrl,
        episodeSummaries: show.episodeSummaries ?? [],
      });

      return {
        success: true,
        latencyMs: research.firecrawlReport.latencyMs,
        queryUsed: research.firecrawlReport.searchesRun.join(" | ") || "Deep Agent Multi-Search",
        officialWebsite: research.canonicalWebsite,
        reviews: research.listenerReviews,
        socialLinks: research.firecrawlSignals.socialLinks,
        rawSnippet: research.firecrawlReport.summary,
        hosts: research.hosts,
        socialProfiles: research.socialProfiles,
        highlightClips: research.highlightClips,
        firecrawlReport: research.firecrawlReport,
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: 0,
        queryUsed: "Deep Firecrawl Agent Multi-Search",
        officialWebsite: show.websiteUrl ?? "",
        reviews: "",
        socialLinks: [],
        rawSnippet: "",
        error: err instanceof Error ? err.message : "Firecrawl deep research failed",
      };
    }
  },
});

export const saveShowFirecrawlSignals = mutation({
  args: {
    showId: v.id("shows"),
    signals: v.object({
      reviews: v.string(),
      socialLinks: v.array(v.string()),
      officialWebsite: v.string(),
    }),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const show = await ctx.db.get("shows", args.showId);
    if (!show) {
      throw new Error("Show not found");
    }
    await ctx.db.patch("shows", args.showId, {
      firecrawlSignals: args.signals,
      ...(args.signals.officialWebsite && !show.websiteUrl
        ? { websiteUrl: args.signals.officialWebsite }
        : {}),
    });
    return { success: true };
  },
});

export const saveDeepResearchDossier = mutation({
  args: {
    showId: v.id("shows"),
    canonicalWebsite: v.optional(v.string()),
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
    firecrawlSignals: v.optional(
      v.object({
        reviews: v.string(),
        socialLinks: v.array(v.string()),
        officialWebsite: v.string(),
      }),
    ),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const show = await ctx.db.get("shows", args.showId);
    if (!show) {
      throw new Error("Show not found");
    }
    const patchData: Record<string, unknown> = {};
    if (args.canonicalWebsite) patchData.websiteUrl = args.canonicalWebsite;
    if (args.hosts) patchData.hosts = args.hosts;
    if (args.socialProfiles) patchData.socialProfiles = args.socialProfiles;
    if (args.highlightClips) patchData.highlightClips = args.highlightClips;
    if (args.firecrawlReport) patchData.firecrawlReport = args.firecrawlReport;
    if (args.firecrawlSignals) patchData.firecrawlSignals = args.firecrawlSignals;
    await ctx.db.patch("shows", args.showId, patchData);
    return { success: true };
  },
});

export const saveOpenAiCurationDossier = mutation({
  args: {
    showId: v.id("shows"),
    openAiCurationReport: v.object({
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
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const show = await ctx.db.get("shows", args.showId);
    if (!show) {
      throw new Error("Show not found.");
    }
    await ctx.db.patch("shows", args.showId, {
      openAiCurationReport: args.openAiCurationReport,
    });
    return { success: true };
  },
});

export const getShowDeepDiveForAdmin = query({
  args: { showId: v.id("shows") },
  returns: v.union(
    v.null(),
    v.object({
      show: v.object({
        showId: v.id("shows"),
        title: v.string(),
        slug: v.string(),
        description: v.string(),
        rssUrl: v.string(),
        websiteUrl: v.string(),
        coverArtUrl: v.string(),
        hostName: v.string(),
        hostEmail: v.string(),
        isClaimed: v.boolean(),
        claimedByUserId: v.optional(v.string()),
        isAmped: v.optional(v.boolean()),
        ampScore: v.optional(v.number()),
        coordinates: v.object({ x: v.number(), y: v.number(), z: v.number() }),
      }),
      firecrawlSignals: v.object({
        reviews: v.string(),
        socialLinks: v.array(v.string()),
        officialWebsite: v.string(),
        source: v.union(v.literal("stored"), v.literal("derived")),
      }),
      episodes: v.array(
        v.object({
          episodeId: v.id("episodes"),
          title: v.string(),
          audioUrl: v.string(),
          pubDate: v.number(),
          durationSeconds: v.number(),
          summary: v.string(),
        }),
      ),
      snippets: v.array(
        v.object({
          snippetId: v.id("snippets"),
          episodeId: v.id("episodes"),
          episodeTitle: v.string(),
          audioUrl: v.string(),
          startTime: v.number(),
          endTime: v.number(),
          duration: v.number(),
          isValidDuration: v.boolean(),
          hookText: v.string(),
          transcriptExcerpt: v.string(),
          whyYouWillLikeIt: v.string(),
          energyLevel: v.optional(v.string()),
          curatorScore: v.optional(v.number()),
          topic: v.optional(v.string()),
          alternativeMomentsConsidered: v.optional(v.string()),
          vectorDimensions: v.number(),
          vectorPreview: v.array(v.number()),
          vectorNorm: v.number(),
          playCount: v.number(),
          upvotes: v.number(),
        }),
      ),
      claims: v.array(
        v.object({
          claimId: v.id("territoryClaims"),
          inboxThreadId: v.string(),
          claimStatus: v.union(
            v.literal("pending"),
            v.literal("verified"),
            v.literal("rejected"),
          ),
          token: v.string(),
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
    }),
  ),
  handler: async (ctx, args) => {
    const show = await ctx.db.get("shows", args.showId);
    if (!show) return null;

    const episodes = await ctx.db
      .query("episodes")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .collect();

    episodes.sort((a, b) => b.pubDate - a.pubDate);
    const epMap = new Map(episodes.map((e) => [e._id, e]));

    const snippets = await ctx.db
      .query("snippets")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .collect();

    const claims = await ctx.db
      .query("territoryClaims")
      .withIndex("by_showId", (q) => q.eq("showId", args.showId))
      .collect();

    const enrichedSnippets = snippets.map((s) => {
      const ep = epMap.get(s.episodeId);
      const rawExcerpt = s.transcriptExcerpt || "";
      const whyMatch = rawExcerpt.match(
        /\[Why you'll love it\]:\s*([\s\S]*?)(?=\n\n\[Excerpt\]|$)/i,
      );
      const excerptMatch = rawExcerpt.match(/\[Excerpt\]:\s*([\s\S]*?)$/i);
      const duration = Math.max(1, s.endTime - s.startTime);
      const isValidDuration = duration >= 15 && duration <= 45;

      const vec = s.vectorEmbedding || [];
      let sumSq = 0;
      for (const val of vec) {
        sumSq += val * val;
      }
      const norm = Math.sqrt(sumSq);

      return {
        snippetId: s._id,
        episodeId: s.episodeId,
        episodeTitle: ep?.title || "Episode Highlight",
        audioUrl: ep?.audioUrl || "",
        startTime: s.startTime,
        endTime: s.endTime,
        duration,
        isValidDuration,
        hookText: s.hookText,
        transcriptExcerpt: excerptMatch ? excerptMatch[1].trim() : rawExcerpt,
        whyYouWillLikeIt:
          s.whyYouWillLikeIt ||
          (whyMatch ? whyMatch[1].trim() : "High-engagement podcast highlight."),
        energyLevel: s.energyLevel,
        curatorScore: s.curatorScore,
        topic: s.topic,
        alternativeMomentsConsidered: s.alternativeMomentsConsidered,
        vectorDimensions: vec.length,
        vectorPreview: vec.slice(0, 8),
        vectorNorm: Number(norm.toFixed(4)),
        playCount: s.playCount,
        upvotes: s.upvotes,
      };
    });

    const firecrawlSignals = show.firecrawlSignals
      ? {
          reviews: show.firecrawlSignals.reviews,
          socialLinks: show.firecrawlSignals.socialLinks,
          officialWebsite: show.firecrawlSignals.officialWebsite || show.websiteUrl || "",
          source: "stored" as const,
        }
      : {
          reviews: "Show successfully ingested in DiscoPod. Click 'Run Firecrawl QA Probe' to fetch live listener reviews and social links.",
          socialLinks: [],
          officialWebsite: show.websiteUrl || "",
          source: "derived" as const,
        };

    return {
      show: {
        showId: show._id,
        title: show.title,
        slug: show.slug,
        description: show.description,
        rssUrl: show.rssUrl,
        websiteUrl: show.websiteUrl || "",
        coverArtUrl: show.coverArtUrl,
        hostName: show.hostName || "Unknown Host",
        hostEmail: show.hostEmail || "",
        isClaimed: show.isClaimed,
        claimedByUserId: show.claimedByUserId,
        isAmped: show.isAmped ?? false,
        ampScore: show.ampScore ?? 0,
        coordinates: show.coordinates,
      },
      firecrawlSignals,
      episodes: episodes.map((e) => ({
        episodeId: e._id,
        title: e.title,
        audioUrl: e.audioUrl,
        pubDate: e.pubDate,
        durationSeconds: e.durationSeconds,
        summary: e.summary,
      })),
      snippets: enrichedSnippets,
      claims: claims.map((c) => ({
        claimId: c._id,
        inboxThreadId: c.inboxThreadId,
        claimStatus: c.claimStatus,
        token: c.token,
      })),
      hosts: show.hosts,
      socialProfiles: show.socialProfiles,
      platformLinks: show.platformLinks,
      highlightClips: show.highlightClips,
      firecrawlReport: show.firecrawlReport,
      openAiCurationReport: show.openAiCurationReport,
    };
  },
});

export const remedyPreRollAdSnippets = mutation({
  args: {
    showId: v.optional(v.id("shows")),
    minStartSeconds: v.optional(v.number()),
  },
  returns: v.object({
    updatedCount: v.number(),
    details: v.array(
      v.object({
        snippetId: v.id("snippets"),
        oldStart: v.number(),
        newStart: v.number(),
        episodeTitle: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const minStart = args.minStartSeconds ?? 180;
    const details: Array<{
      snippetId: any;
      oldStart: number;
      newStart: number;
      episodeTitle: string;
    }> = [];

    const snippets = args.showId
      ? await ctx.db
          .query("snippets")
          .withIndex("by_showId", (q) => q.eq("showId", args.showId!))
          .collect()
      : await ctx.db.query("snippets").take(100);

    for (const snip of snippets) {
      if (snip.startTime < 150) {
        const oldStart = snip.startTime;
        const duration = Math.max(20, snip.endTime - snip.startTime);
        // Advance past pre-roll ad block (e.g. 180s to 240s)
        const newStart = Math.max(minStart, oldStart + 150);
        const newEnd = newStart + duration;

        await ctx.db.patch("snippets", snip._id, {
          startTime: newStart,
          endTime: newEnd,
        });

        details.push({
          snippetId: snip._id,
          oldStart,
          newStart,
          episodeTitle: snip.hookText,
        });
      }
    }

    // Also update any show's embedded highlightClips / openAiCurationReport
    const showsToUpdate = args.showId
      ? [await ctx.db.get("shows", args.showId)]
      : await ctx.db.query("shows").collect();

    for (const show of showsToUpdate) {
      if (!show) continue;
      let patched = false;
      let curationReport = show.openAiCurationReport;
      if (curationReport && curationReport.curatedClips) {
        const updatedCurated = curationReport.curatedClips.map((c: any) => {
          if (c.startTime < 150) {
            patched = true;
            const dur = c.duration || Math.max(20, c.endTime - c.startTime);
            const s = Math.max(minStart, c.startTime + 150);
            return {
              ...c,
              startTime: s,
              endTime: s + dur,
            };
          }
          return c;
        });
        if (patched) {
          curationReport = {
            ...curationReport,
            curatedClips: updatedCurated,
          };
        }
      }

      if (patched) {
        await ctx.db.patch("shows", show._id, {
          openAiCurationReport: curationReport,
        });
      }
    }

    return {
      updatedCount: details.length,
      details,
    };
  },
});

export const getRecentAgentMailInteractions = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("agentMailInteractions"),
      _creationTime: v.number(),
      inboxId: v.string(),
      threadId: v.string(),
      messageId: v.string(),
      from: v.string(),
      subject: v.string(),
      text: v.string(),
      intent: v.string(),
      outcome: v.string(),
      replyText: v.string(),
      replyMessageId: v.optional(v.string()),
      showId: v.optional(v.id("shows")),
      showTitle: v.optional(v.string()),
      status: v.union(v.literal("replied"), v.literal("failed"), v.literal("escalated"), v.literal("rejected")),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 25;
    return await ctx.db
      .query("agentMailInteractions")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
  },
});

function generateDeterministicEmbedding(seed: string): number[] {
  const dim = 1536;
  const vec: number[] = new Array(dim);
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    h = (Math.imul(1664525, h) + 1013904223) | 0;
    const val = (h % 1000) / 1000;
    vec[i] = val;
    norm += val * val;
  }
  const mag = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) {
    vec[i] = Number((vec[i] / mag).toFixed(6));
  }
  return vec;
}
