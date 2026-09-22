#!/usr/bin/env node

/**
 * Test script for DiscoPod Listener Analytics & Traction Milestone Engine.
 *
 * Verifies:
 * 1. Shows exist in database
 * 2. Recording events via `recordListenerEvent`
 * 3. Querying aggregated stats via `getShowAnalytics`
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
  console.log(`[DiscoPod Test] Listener Analytics & Quality Verification`);
  console.log(`Deployment: ${convexUrl}`);
  console.log(`======================================================\n`);

  try {
    const stats = await client.query(api.admin.getDatabaseStats, {});
    if (!stats.shows || stats.shows.length === 0) {
      console.log("No shows found in database. Skipping live event recording test.");
      return;
    }

    const testShow = stats.shows[0];
    console.log(`Selected test show: "${testShow.title}" (${testShow.showId})`);

    // 1. Record recommendation view
    console.log(`Recording recommendation_view...`);
    const ev1 = await client.mutation(api.analytics.recordListenerEvent, {
      showId: testShow.showId,
      eventType: "recommendation_view",
      source: "deck",
    });
    console.log(`  ✓ Event created: ${ev1.eventId}`);

    // 2. Record audio listen
    console.log(`Recording listen event...`);
    const ev2 = await client.mutation(api.analytics.recordListenerEvent, {
      showId: testShow.showId,
      eventType: "listen",
      source: "deck",
      listenDurationSeconds: 25,
    });
    console.log(`  ✓ Listen event created: ${ev2.eventId}, tractionTriggered: ${ev2.tractionTriggered}`);

    // 3. Record external channel clickout
    console.log(`Recording external channel clickout to Spotify...`);
    const ev3 = await client.mutation(api.analytics.recordListenerEvent, {
      showId: testShow.showId,
      eventType: "channel_click",
      channelName: "Spotify",
      source: "modal",
    });
    console.log(`  ✓ Channel click created: ${ev3.eventId}`);

    // 4. Query aggregated analytics
    console.log(`\nFetching aggregated analytics for "${testShow.title}"...`);
    const analytics = await client.query(api.analytics.getShowAnalytics, {
      showId: testShow.showId,
    });

    console.log(`  • Total Views: ${analytics.totalViews}`);
    console.log(`  • Total Listens: ${analytics.totalListens}`);
    console.log(`  • Total Skips: ${analytics.totalSkips}`);
    console.log(`  • Total Channel Clicks: ${analytics.totalChannelClicks}`);
    console.log(`  • Conversion Rate: ${analytics.conversionRate}%`);
    console.log(`  • Channel Breakdown:`, analytics.channelBreakdown);
    console.log(`  • Traction Notified: ${analytics.tractionNotifiedAt ? new Date(analytics.tractionNotifiedAt).toISOString() : "Not yet (or in quiet mode)"}`);

    console.log(`\n======================================================`);
    console.log(`✓ Listener analytics verification completed successfully!`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

run();
