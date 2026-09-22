import { makeFunctionReference } from "convex/server";

export const api = {
  ingestionActions: {
    findOrMapShow: makeFunctionReference<"action">("ingestionActions:findOrMapShow"),
    mapShow: makeFunctionReference<"action">("ingestionActions:mapShow"),
  },
  search: {
    searchSnippetsFeed: makeFunctionReference<"query">("search:searchSnippetsFeed"),
  },
  searchActions: {
    searchSnippetsSemantic: makeFunctionReference<"action">(
      "searchActions:searchSnippetsSemantic",
    ),
  },
  shows: {
    listGlobeShows: makeFunctionReference<"query">("shows:listGlobeShows"),
    getShowDetail: makeFunctionReference<"query">("shows:getShowDetail"),
    searchIngestedShows: makeFunctionReference<"query">("shows:searchIngestedShows"),
    getSimilarShowsForDeck: makeFunctionReference<"query">("shows:getSimilarShowsForDeck"),
    ampShow: makeFunctionReference<"mutation">("shows:ampShow"),
    updateShowHostEmail: makeFunctionReference<"mutation">("shows:updateShowHostEmail"),
  },
  snippets: {
    incrementSnippetPlay: makeFunctionReference<"mutation">(
      "snippets:incrementSnippetPlay",
    ),
  },
  territoryClaims: {
    claimShowAsCreator: makeFunctionReference<"mutation">(
      "territoryClaims:claimShowAsCreator",
    ),
    getShowByClaimToken: makeFunctionReference<"query">(
      "territoryClaims:getShowByClaimToken",
    ),
    claimShowByToken: makeFunctionReference<"mutation">(
      "territoryClaims:claimShowByToken",
    ),
    updateClaimToken: makeFunctionReference<"mutation">(
      "territoryClaims:updateClaimToken",
    ),
    updateShowHook: makeFunctionReference<"mutation">(
      "territoryClaims:updateShowHook",
    ),
    reSliceShowClip: makeFunctionReference<"mutation">(
      "territoryClaims:reSliceShowClip",
    ),
  },
  agentmailActions: {
    handleInboundAgentMail: makeFunctionReference<"action">(
      "agentmailActions:handleInboundAgentMail",
    ),
    sendShowPreviewEmail: makeFunctionReference<"action">(
      "agentmailActions:sendShowPreviewEmail",
    ),
    sendTestEmailAction: makeFunctionReference<"action">(
      "agentmailActions:sendTestEmailAction",
    ),
  },
  agentMailHandler: {
    simulateInboundReply: makeFunctionReference<"action">(
      "agentMailHandler:simulateInboundReply",
    ),
    simulateInboundEmail: makeFunctionReference<"action">(
      "agentMailHandler:simulateInboundEmail",
    ),
  },
  ownerSettings: {
    getOwnerSettings: makeFunctionReference<"query">("ownerSettings:getOwnerSettings"),
    setOwnerSettings: makeFunctionReference<"mutation">("ownerSettings:setOwnerSettings"),
    setEmailOverride: makeFunctionReference<"mutation">("ownerSettings:setEmailOverride"),
    setHumanInTheLoopEmail: makeFunctionReference<"mutation">("ownerSettings:setHumanInTheLoopEmail"),
    listSuppressions: makeFunctionReference<"query">("ownerSettings:listSuppressions"),
    removeSuppression: makeFunctionReference<"mutation">("ownerSettings:removeSuppression"),
    listHostOutreachLog: makeFunctionReference<"query">("ownerSettings:listHostOutreachLog"),
    checkHostEmailStatus: makeFunctionReference<"query">("ownerSettings:checkHostEmailStatus"),
    deleteHostOutreachLogEntry: makeFunctionReference<"mutation">("ownerSettings:deleteHostOutreachLogEntry"),
    backfillExistingOutreach: makeFunctionReference<"mutation">("ownerSettings:backfillExistingOutreach"),
  },
  hostAccess: {
    searchShowsForHostAccess: makeFunctionReference<"query">("hostAccess:searchShowsForHostAccess"),
    getShowAccessPreview: makeFunctionReference<"query">("hostAccess:getShowAccessPreview"),
    getAccessRequestStatus: makeFunctionReference<"query">("hostAccess:getAccessRequestStatus"),
    listAccessRequests: makeFunctionReference<"query">("hostAccess:listAccessRequests"),
    resolveAccessRequest: makeFunctionReference<"mutation">("hostAccess:resolveAccessRequest"),
  },
  hostAccessActions: {
    requestAccessOnFile: makeFunctionReference<"action">("hostAccessActions:requestAccessOnFile"),
    requestAccessWithAlternateEmail: makeFunctionReference<"action">(
      "hostAccessActions:requestAccessWithAlternateEmail",
    ),
  },
  admin: {
    verifyOwnerPassword: makeFunctionReference<"mutation">("admin:verifyOwnerPassword"),
    getDatabaseStats: makeFunctionReference<"query">("admin:getDatabaseStats"),
    seedDemoDatabase: makeFunctionReference<"mutation">("admin:seedDemoDatabase"),
    clearDatabase: makeFunctionReference<"mutation">("admin:clearDatabase"),
    checkEnvHealth: makeFunctionReference<"query">("admin:checkEnvHealth"),
    testOpenAiEmbedding: makeFunctionReference<"action">("admin:testOpenAiEmbedding"),
    testFirecrawlExtraction: makeFunctionReference<"action">("admin:testFirecrawlExtraction"),
    testAgentMailSimulation: makeFunctionReference<"action">("admin:testAgentMailSimulation"),
    getShowClipsForAdmin: makeFunctionReference<"query">("admin:getShowClipsForAdmin"),
    getShowDeepDiveForAdmin: makeFunctionReference<"query">("admin:getShowDeepDiveForAdmin"),
    qaFirecrawlProbe: makeFunctionReference<"action">("admin:qaFirecrawlProbe"),
    saveShowFirecrawlSignals: makeFunctionReference<"mutation">("admin:saveShowFirecrawlSignals"),
    saveDeepResearchDossier: makeFunctionReference<"mutation">("admin:saveDeepResearchDossier"),
    saveOpenAiCurationDossier: makeFunctionReference<"mutation">("admin:saveOpenAiCurationDossier"),
  },
  podcastDiscoveryActions: {
    queryPodcasts: makeFunctionReference<"action">("podcastDiscoveryActions:queryPodcasts"),
    queryNewAndNotablePodcasts: makeFunctionReference<"action">(
      "podcastDiscoveryActions:queryNewAndNotablePodcasts",
    ),
    enrichAndSeedShow: makeFunctionReference<"action">("podcastDiscoveryActions:enrichAndSeedShow"),
    batchSeedGenreShows: makeFunctionReference<"action">("podcastDiscoveryActions:batchSeedGenreShows"),
    searchDiscoveryPodcasts: makeFunctionReference<"action">(
      "podcastDiscoveryActions:searchDiscoveryPodcasts",
    ),
    getSimilarPodcastsForDiscovery: makeFunctionReference<"action">(
      "podcastDiscoveryActions:getSimilarPodcastsForDiscovery",
    ),
    fastIngestPodcast: makeFunctionReference<"action">(
      "podcastDiscoveryActions:fastIngestPodcast",
    ),
  },
  ingest: {
    startIngest: makeFunctionReference<"action">("ingest:startIngest"),
    getIngestJob: makeFunctionReference<"query">("ingest:getIngestJob"),
  },
  analytics: {
    recordListenerEvent: makeFunctionReference<"mutation">("analytics:recordListenerEvent"),
    getShowAnalytics: makeFunctionReference<"query">("analytics:getShowAnalytics"),
    triggerManualTractionNotification: makeFunctionReference<"action">(
      "analytics:triggerManualTractionNotification",
    ),
  },
  auth: {
    signOut: makeFunctionReference<"mutation", { refreshToken: string }, null>(
      "auth:signOut",
    ),
    refreshSession: makeFunctionReference<
      "mutation",
      { refreshToken: string },
      Record<string, unknown>
    >("auth:refreshSession"),
    signInWithPassword: makeFunctionReference<
      "mutation",
      { username: string; password: string },
      Record<string, unknown>
    >("auth:signInWithPassword"),
    signUpWithPassword: makeFunctionReference<
      "mutation",
      { username: string; password: string },
      Record<string, unknown>
    >("auth:signUpWithPassword"),
    changePassword: makeFunctionReference<
      "mutation",
      { currentPassword: string; newPassword: string },
      Record<string, unknown>
    >("auth:changePassword"),
  },
  users: {
    getCurrentUser: makeFunctionReference<"query">("users:getCurrentUser"),
    listUsers: makeFunctionReference<"query">("users:listUsers"),
    updateUserRole: makeFunctionReference<"mutation">("users:updateUserRole"),
  },
  takedowns: {
    submitTakedown: makeFunctionReference<"mutation">("takedowns:submitTakedown"),
    isPodcastTombstoned: makeFunctionReference<"query">("takedowns:isPodcastTombstoned"),
    listTakedowns: makeFunctionReference<"query">("takedowns:listTakedowns"),
    getShowTakedownPreview: makeFunctionReference<"query">("takedowns:getShowTakedownPreview"),
    resolveTakedownRequest: makeFunctionReference<"mutation">("takedowns:resolveTakedownRequest"),
    getAgentMailContactInfo: makeFunctionReference<"query">("takedowns:getAgentMailContactInfo"),
  },
  platformLinksCrawler: {
    getPlatformLinksCoverage: makeFunctionReference<"query">("platformLinksCrawler:getPlatformLinksCoverage"),
    catchUpSingleShow: makeFunctionReference<"action">("platformLinksCrawler:catchUpSingleShow"),
    batchCatchUpShows: makeFunctionReference<"action">("platformLinksCrawler:batchCatchUpShows"),
  },
};

