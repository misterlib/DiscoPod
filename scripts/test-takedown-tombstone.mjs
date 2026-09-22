#!/usr/bin/env node

/**
 * Integration Test for DiscoPod Zero-Question Takedown & Tombstone Registry.
 *
 * Verifies:
 * 1. Shows not in takedown registry return isPodcastTombstoned = false.
 * 2. Calling `submitTakedown` creates a persistent tombstone record in `takedownRequests`.
 * 3. Querying `isPodcastTombstoned` by title and feedUrl returns true.
 * 4. Ingestion (`fastIngestPodcast`) rejects any attempt to re-index the tombstoned show.
 * 5. `listTakedowns` returns the tombstoned entry for admin oversight.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env.local if present
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [k, ...v] = trimmed.split("=");
      if (k && v.length) {
        process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
      }
    }
  }
}

const convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
if (!convexUrl) {
  console.error("Error: VITE_CONVEX_URL or CONVEX_URL must be set in .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);

async function run() {
  console.log(`\n======================================================`);
  console.log(`[DiscoPod Test] Zero-Question Takedown & Tombstone Engine`);
  console.log(`Deployment: ${convexUrl}`);
  console.log(`======================================================\n`);

  const uniqueSuffix = Date.now();
  const testTitle = `Takedown Test Podcast ${uniqueSuffix}`;
  const testFeedUrl = `https://example.com/feeds/takedown-${uniqueSuffix}.xml`;
  const testEmail = `takedown-author-${uniqueSuffix}@example.org`;

  try {
    // 1. Check initial tombstone status
    console.log(`1. Checking initial tombstone status for "${testTitle}"...`);
    const initialTombstone = await client.query(api.takedowns.isPodcastTombstoned, {
      title: testTitle,
      feedUrl: testFeedUrl,
    });
    console.log(`   Initial tombstone status: ${initialTombstone} (expected: false)`);
    if (initialTombstone !== false) {
      throw new Error("Show unexpectedly reported as already tombstoned.");
    }

    // 2. Submit Zero-Question Takedown
    console.log(`\n2. Submitting zero-question takedown request...`);
    const result = await client.mutation(api.takedowns.submitTakedown, {
      title: testTitle,
      feedUrl: testFeedUrl,
      requesterEmail: testEmail,
      reason: "Automated regression verification: Creator opted out",
      source: "web_modal",
    });

    console.log(`   Takedown result:`, result);
    if (!result.success || !result.takedownId) {
      throw new Error("Failed to create takedown record.");
    }

    // 3. Verify tombstoned status by title
    console.log(`\n3. Verifying isPodcastTombstoned by Title...`);
    const tombstonedByTitle = await client.query(api.takedowns.isPodcastTombstoned, {
      title: testTitle,
    });
    console.log(`   Tombstoned by title: ${tombstonedByTitle} (expected: true)`);
    if (!tombstonedByTitle) {
      throw new Error("Podcast not tombstoned by normalized title.");
    }

    // 4. Verify tombstoned status by Feed URL
    console.log(`\n4. Verifying isPodcastTombstoned by Feed URL...`);
    const tombstonedByFeed = await client.query(api.takedowns.isPodcastTombstoned, {
      feedUrl: testFeedUrl,
    });
    console.log(`   Tombstoned by feed URL: ${tombstonedByFeed} (expected: true)`);
    if (!tombstonedByFeed) {
      throw new Error("Podcast not tombstoned by feed URL.");
    }

    // 5. Attempt re-ingestion via fastIngestPodcast (must be rejected)
    console.log(`\n5. Verifying fastIngestPodcast permanently blocks re-indexing...`);
    let reingestBlocked = false;
    try {
      await client.action(api.podcastDiscoveryActions.fastIngestPodcast, {
        title: testTitle,
        feedUrl: testFeedUrl,
        coverArtUrl: "https://example.com/cover.jpg",
      });
    } catch (err) {
      reingestBlocked = true;
      console.log(`   Ingestion correctly blocked with error: "${err.message}"`);
    }

    if (!reingestBlocked) {
      throw new Error("CRITICAL: fastIngestPodcast did NOT reject tombstoned show!");
    }

    // 6. Verify takedown listing contains the record
    console.log(`\n6. Querying takedown registry for admin overview...`);
    const allTakedowns = await client.query(api.takedowns.listTakedowns, {});
    const foundEntry = allTakedowns.find((t) => t._id === result.takedownId);
    if (!foundEntry) {
      throw new Error("Takedown entry not found in listTakedowns.");
    }
    console.log(`   Found takedown in registry: "${foundEntry.title}", source: ${foundEntry.source}`);

    console.log(`\n======================================================`);
    console.log(`SUCCESS: Zero-Question Takedown & Tombstone Engine verified!`);
    console.log(`The podcast is permanently prevented from re-indexing.`);
    console.log(`======================================================\n`);
  } catch (error) {
    console.error(`\nTEST FAILED:`, error);
    process.exit(1);
  }
}

run();
