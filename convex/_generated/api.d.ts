/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as agentMailHandler from "../agentMailHandler.js";
import type * as agentmailActions from "../agentmailActions.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as firecrawlAgent from "../firecrawlAgent.js";
import type * as hostAccess from "../hostAccess.js";
import type * as hostAccessActions from "../hostAccessActions.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as ingestion from "../ingestion.js";
import type * as ingestionActions from "../ingestionActions.js";
import type * as lib_emailDispatcher from "../lib/emailDispatcher.js";
import type * as lib_hostAccessEmail from "../lib/hostAccessEmail.js";
import type * as lib_maskEmail from "../lib/maskEmail.js";
import type * as ownerSettings from "../ownerSettings.js";
import type * as platformLinksCrawler from "../platformLinksCrawler.js";
import type * as podcastDiscoveryActions from "../podcastDiscoveryActions.js";
import type * as search from "../search.js";
import type * as searchActions from "../searchActions.js";
import type * as searchMetadata from "../searchMetadata.js";
import type * as shows from "../shows.js";
import type * as snippets from "../snippets.js";
import type * as takedowns from "../takedowns.js";
import type * as territoryClaims from "../territoryClaims.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  agentMailHandler: typeof agentMailHandler;
  agentmailActions: typeof agentmailActions;
  analytics: typeof analytics;
  auth: typeof auth;
  firecrawlAgent: typeof firecrawlAgent;
  hostAccess: typeof hostAccess;
  hostAccessActions: typeof hostAccessActions;
  http: typeof http;
  ingest: typeof ingest;
  ingestion: typeof ingestion;
  ingestionActions: typeof ingestionActions;
  "lib/emailDispatcher": typeof lib_emailDispatcher;
  "lib/hostAccessEmail": typeof lib_hostAccessEmail;
  "lib/maskEmail": typeof lib_maskEmail;
  ownerSettings: typeof ownerSettings;
  platformLinksCrawler: typeof platformLinksCrawler;
  podcastDiscoveryActions: typeof podcastDiscoveryActions;
  search: typeof search;
  searchActions: typeof searchActions;
  searchMetadata: typeof searchMetadata;
  shows: typeof shows;
  snippets: typeof snippets;
  takedowns: typeof takedowns;
  territoryClaims: typeof territoryClaims;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agentmail: import("@agentmail/convex/_generated/component.js").ComponentApi<"agentmail">;
  auth: import("@convex-dev/auth/core/_generated/component.js").ComponentApi<"auth">;
  authPasswordProvider: import("@convex-dev/auth/providers/password/_generated/component.js").ComponentApi<"authPasswordProvider">;
  authUsername: import("@convex-dev/auth/username/_generated/component.js").ComponentApi<"authUsername">;
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
