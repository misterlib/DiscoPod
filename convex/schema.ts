import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  shows: defineTable({
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    rssUrl: v.string(),
    websiteUrl: v.optional(v.string()),
    coverArtUrl: v.string(),
    hostName: v.optional(v.string()),
    hostEmail: v.optional(v.string()),
    isClaimed: v.boolean(),
    claimedByUserId: v.optional(v.string()),
    isAmped: v.optional(v.boolean()),
    ampScore: v.optional(v.number()),
    coordinates: v.object({ x: v.number(), y: v.number(), z: v.number() }),
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
    isTakenDown: v.optional(v.boolean()),
    takenDownAt: v.optional(v.number()),
    takedownReason: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_isClaimed", ["isClaimed"])
    .index("by_isTakenDown", ["isTakenDown"])
    .index("by_hostEmail", ["hostEmail"]),

  episodes: defineTable({
    showId: v.id("shows"),
    title: v.string(),
    audioUrl: v.string(),
    pubDate: v.number(),
    durationSeconds: v.number(),
    summary: v.string(),
  }).index("by_showId", ["showId"]),

  snippets: defineTable({
    episodeId: v.id("episodes"),
    showId: v.id("shows"),
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
    playCount: v.number(),
    upvotes: v.number(),
  })
    .index("by_showId", ["showId"])
    .vectorIndex("by_embedding", {
      vectorField: "vectorEmbedding",
      dimensions: 1536,
      filterFields: ["showId"],
    }),

  territoryClaims: defineTable({
    showId: v.id("shows"),
    inboxThreadId: v.string(),
    claimStatus: v.union(
      v.literal("pending"),
      v.literal("verified"),
      v.literal("rejected"),
    ),
    token: v.string(),
    tractionNotifiedAt: v.optional(v.number()),
    notifiedListenCount: v.optional(v.number()),
    notifiedClickCount: v.optional(v.number()),
  })
    .index("by_showId", ["showId"])
    .index("by_thread_and_token", ["inboxThreadId", "token"])
    .index("by_token", ["token"]),

  ingestJobs: defineTable({
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

  /**
   * Singleton owner-settings document.
   * Always stored under key = "singleton"; use upsert pattern.
   *
   * emailEnabled = false  → redirect all outbound claim emails to emailOverrideAddress
   * emailEnabled = true   → send directly to the scraped host email (production mode)
   */
  ownerSettings: defineTable({
    key: v.literal("singleton"),
    emailEnabled: v.boolean(),
    emailOverrideAddress: v.string(),
    humanInTheLoopEmail: v.optional(v.string()),
  }).index("by_key", ["key"]),

  hostAccessRequests: defineTable({
    showId: v.id("shows"),
    requestType: v.union(
      v.literal("on_file_email"),
      v.literal("alternate_email_hitl"),
      v.literal("network_disambiguation"),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("verification_sent"),
      v.literal("escalated"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    onFileEmail: v.optional(v.string()),
    alternateEmail: v.optional(v.string()),
    requesterNote: v.optional(v.string()),
    claimId: v.optional(v.id("territoryClaims")),
    inboxThreadId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_showId", ["showId"])
    .index("by_status", ["status"]),

  users: defineTable({
    role: v.union(v.literal("superadmin"), v.literal("admin"), v.literal("pending")),
    approvedAt: v.optional(v.number()),
    approvedBy: v.optional(v.id("users")),
  }).index("by_role", ["role"]),

  /**
   * Tracks suppressed email addresses (bounces, complaints, spam flags, unsubscriptions)
   * to guarantee DiscoPod never contacts them again.
   */
  emailSuppressions: defineTable({
    email: v.string(),
    reason: v.union(
      v.literal("bounced"),
      v.literal("complained"),
      v.literal("rejected"),
      v.literal("unsubscribed"),
      v.literal("manual"),
    ),
    eventType: v.optional(v.string()),
    details: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  /**
   * Granular listener engagement analytics:
   * Tracks recommendations, audio plays, skips, and channel clickouts
   * to validate clip conversion quality and trigger milestone traction notifications.
   */
  listenerEvents: defineTable({
    showId: v.id("shows"),
    snippetId: v.optional(v.id("snippets")),
    eventType: v.union(
      v.literal("recommendation_view"),
      v.literal("listen"),
      v.literal("skip"),
      v.literal("channel_click"),
      v.literal("like"),
    ),
    channelName: v.optional(v.string()), // e.g. "apple", "spotify", "overcast", "website"
    listenDurationSeconds: v.optional(v.number()),
    source: v.union(
      v.literal("deck"),
      v.literal("modal"),
      v.literal("reel_player"),
      v.literal("globe"),
      v.literal("search"),
    ),
    timestamp: v.number(),
  })
    .index("by_showId", ["showId"])
    .index("by_snippetId", ["snippetId"])
    .index("by_showId_and_eventType", ["showId", "eventType"]),

  /**
   * Permanent tombstone registry of all takedown requests.
   * Feeds and podcast identifiers in this table are NEVER re-indexed
   * or re-mapped by automated search or catalog ingestion pipelines.
   */
  takedownRequests: defineTable({
    showId: v.optional(v.id("shows")),
    title: v.string(),
    normalizedTitle: v.string(),
    rssUrl: v.optional(v.string()),
    feedUrl: v.optional(v.string()),
    appleId: v.optional(v.string()),
    requesterEmail: v.optional(v.string()),
    source: v.union(v.literal("email_inbox"), v.literal("web_modal"), v.literal("admin")),
    reason: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("completed"), v.literal("pending_hitl"), v.literal("rejected")),
    ),
    verifiedOnFile: v.optional(v.boolean()),
    requesterProofNotes: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_normalizedTitle", ["normalizedTitle"])
    .index("by_rssUrl", ["rssUrl"])
    .index("by_feedUrl", ["feedUrl"])
    .index("by_appleId", ["appleId"])
    .index("by_status", ["status"]),

  /**
   * Log of all AgentMail inbound messages, parsed intents, executed mutations,
   * and reactive outbound agent replies.
   */
  agentMailInteractions: defineTable({
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
  })
    .index("by_threadId", ["threadId"])
    .index("by_from", ["from"])
    .index("by_createdAt", ["createdAt"])
    .index("by_showId", ["showId"]),

  /**
   * Permanent registry of all outbound host outreach and notification emails.
   * Enforces the strict single-contact rule: no host receives more than one email
   * unless they have sent an inbound reply to DiscoPod.
   */
  hostOutreachLog: defineTable({
    email: v.string(), // normalized lowercase email
    showId: v.optional(v.id("shows")),
    showTitle: v.optional(v.string()),
    subject: v.string(),
    inboxThreadId: v.string(),
    isStaging: v.boolean(),
    sentAt: v.number(),
    hasReceivedReply: v.boolean(),
    lastReplyAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_showId", ["showId"])
    .index("by_email_and_hasReceivedReply", ["email", "hasReceivedReply"])
    .index("by_sentAt", ["sentAt"]),

});

