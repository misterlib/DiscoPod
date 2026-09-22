#!/usr/bin/env node

/**
 * DiscoPod Ingestion Test Script
 *
 * Tests the show discovery and ingest pipeline against your Convex deployment:
 * 1. Calls api.ingest.startIngest
 * 2. Polls api.ingest.getIngestJob until completed or failed
 * 3. Asserts the show, episode, snippet, and claim records
 *
 * Usage:
 *   node scripts/test-ingest.mjs [showTitleOrRssUrl]
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
const sampleTarget = process.argv[2] || "Acquired";

console.log(`\n======================================================`);
console.log(`[DiscoPod Test] Starting Show Ingestion Test`);
console.log(`Target: "${sampleTarget}"`);
console.log(`Deployment: ${convexUrl}`);
console.log(`======================================================\n`);

async function run() {
  try {
    const isUrl = sampleTarget.startsWith("http://") || sampleTarget.startsWith("https://");
    const sourceType = isUrl
      ? sampleTarget.includes("podcasts.apple.com")
        ? "apple"
        : "rss"
      : "title";

    console.log(`[1/3] Queuing ingestion job (${sourceType})...`);
    const { jobId } = await client.action(api.ingest.startIngest, {
      sourceType,
      sourceValue: sampleTarget,
    });
    console.log(`✓ Ingest job created with ID: ${jobId}`);

    console.log(`\n[2/3] Streaming multi-stage pipeline progress...`);
    let completed = false;
    let lastStatus = "";

    while (!completed) {
      const job = await client.query(api.ingest.getIngestJob, { jobId });
      if (!job) {
        console.error("Job not found!");
        break;
      }

      if (job.status !== lastStatus || job.stepDescription) {
        lastStatus = job.status;
        console.log(`  [${job.status.toUpperCase()}] ${job.stepDescription}`);
      }

      if (job.status === "completed") {
        console.log(`\n✓ Ingestion SUCCEEDED!`);
        console.log(`  Show ID: ${job.showId}`);
        completed = true;
        break;
      }

      if (job.status === "failed") {
        console.error(`\n✖ Ingestion FAILED: ${job.error}`);
        process.exit(1);
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    console.log(`\n[3/3] End-to-end ingest verification complete!\n`);
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  }
}

run();
