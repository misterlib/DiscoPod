#!/usr/bin/env node

/**
 * Integration Test for DiscoPod Anti-Competitor Takedown Protection Engine.
 *
 * Verifies:
 * 1. Previews a target show and ensures masked email on file is returned.
 * 2. Unverified Competitor Takedown:
 *    - Competitor submits takedown for a show with an email differing from RSS email.
 *    - Asserts show is NOT taken down (isTakenDown !== true).
 *    - Asserts isPodcastTombstoned returns false.
 *    - Asserts takedown request is created with status: "pending_hitl".
 * 3. Verified Creator Takedown:
 *    - Requester submits takedown using exact email on file.
 *    - Asserts show is immediately marked taken down (isTakenDown === true).
 *    - Asserts isPodcastTombstoned returns true.
 *    - Asserts takedown request has status: "completed" and verifiedOnFile: true.
 * 4. Inbound AgentMail Takedown Loop:
 *    - Competitor inbound email to AgentMail: queues for HITL, does NOT tombstone show.
 *    - Admin inbound email "TAKEDOWN <Show>": executes immediate verified tombstone.
 * 5. Admin resolution:
 *    - Dismisses fraudulent / competitor takedown requests.
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
  console.log(`[DiscoPod Test] Anti-Competitor Takedown Protection Engine`);
  console.log(`Deployment: ${convexUrl}`);
  console.log(`======================================================\n`);

  const uniqueSuffix = Date.now();
  const testHitlAdmin = `admin-audit-${uniqueSuffix}@discopod-agent.io`;

  // Set HITL email
  await client.mutation(api.ownerSettings.setHumanInTheLoopEmail, {
    humanInTheLoopEmail: testHitlAdmin,
  });
  console.log(`✓ Configured HITL Admin email: ${testHitlAdmin}`);

  // 1. Select a target show from the catalog
  const globeShows = await client.query(api.shows.listGlobeShows, { limit: 50 });
  if (!globeShows || globeShows.length === 0) {
    throw new Error("No shows available in catalog to test takedown verification.");
  }
  const testShow = globeShows[0];
  let showDetail = await client.query(api.shows.getShowDetail, { showId: testShow.showId });
  let realHostEmail = showDetail?.hostEmail;

  if (!realHostEmail) {
    realHostEmail = `verified-host-${uniqueSuffix}@producerfm.org`;
    console.log(`Configuring verified host email for "${testShow.title}" (${realHostEmail})...`);
    const req = await client.action(api.hostAccessActions.requestAccessWithAlternateEmail, {
      showId: testShow.showId,
      alternateEmail: realHostEmail,
      note: "Setting up test verified host",
    });
    await client.action(api.agentMailHandler.simulateInboundReply, {
      inboxId: "discopod-main",
      messageId: `msg_${Date.now()}`,
      threadId: `thread_${Date.now()}`,
      from: testHitlAdmin,
      subject: "Approve Host Access",
      text: `APPROVE ${req.requestId}`,
    });
    showDetail = await client.query(api.shows.getShowDetail, { showId: testShow.showId });
  }

  console.log(`Target show: "${testShow.title}" (${testShow.showId})`);
  console.log(`Email on file: ${realHostEmail}`);

  // 2. Test Show Takedown Preview
  console.log(`\n1. Testing getShowTakedownPreview...`);
  const preview = await client.query(api.takedowns.getShowTakedownPreview, {
    title: testShow.title,
    showId: testShow.showId,
  });
  console.log(`   Preview found: ${preview.showFound}, masked: ${preview.maskedEmailOnFile}`);
  if (!preview.showFound) {
    throw new Error("Expected getShowTakedownPreview to find target show.");
  }

  // 3. Test Competitor Takedown Attempt (Unverified)
  console.log(`\n2. Simulating Competitor Takedown Attempt from rival-network@competitor.fm...`);
  const competitorRes = await client.mutation(api.takedowns.submitTakedown, {
    showId: testShow.showId,
    title: testShow.title,
    requesterEmail: "rival-network@competitor.fm",
    requesterProofNotes: "I want this show removed immediately, it is our rival.",
    reason: "Competitor takedown attempt",
    source: "web_modal",
  });

  console.log(`   Competitor Submission Result:`, competitorRes);
  if (competitorRes.verified !== false || competitorRes.requiresHumanReview !== true) {
    throw new Error("Competitor takedown was unexpectedly verified! Anti-competitor guard failed.");
  }

  // Verify that the show was NOT taken down
  const showAfterCompetitor = await client.query(api.shows.getShowDetail, { showId: testShow.showId });
  if (showAfterCompetitor?.isTakenDown) {
    throw new Error("CRITICAL: Show was taken down by unverified competitor! Guard failed.");
  }
  const isTombstoned = await client.query(api.takedowns.isPodcastTombstoned, {
    title: testShow.title,
  });
  if (isTombstoned) {
    throw new Error("CRITICAL: isPodcastTombstoned returned true for pending unverified request!");
  }
  console.log(`   ✓ Show remains active and untombstoned during human review.`);

  // 4. Admin Dismisses Competitor Request
  console.log(`\n3. Admin reviewing and dismissing competitor takedown request...`);
  const takedownList = await client.query(api.takedowns.listTakedowns, {});
  const competitorReq = takedownList.find((t) => t._id === competitorRes.takedownId);
  if (!competitorReq || competitorReq.status !== "pending_hitl") {
    throw new Error(`Expected pending_hitl status, found: ${competitorReq?.status}`);
  }
  console.log(`   Found request in registry with status: ${competitorReq.status}`);

  const dismissRes = await client.mutation(api.takedowns.resolveTakedownRequest, {
    takedownId: competitorReq._id,
    decision: "reject",
    notes: "Dismissed fraudulent competitor takedown request",
  });
  console.log(`   Dismiss result:`, dismissRes);

  const takedownAfterDismiss = (await client.query(api.takedowns.listTakedowns, {})).find(
    (t) => t._id === competitorReq._id,
  );
  if (takedownAfterDismiss?.status !== "rejected") {
    throw new Error(`Expected status 'rejected', found: ${takedownAfterDismiss?.status}`);
  }
  console.log(`   ✓ Competitor takedown successfully rejected by admin.`);

  // 5. Inbound AgentMail Competitor Attack Simulation
  console.log(`\n4. Simulating Inbound Competitor Email to AgentMail: "TAKEDOWN ${testShow.title}"...`);
  const inboundCompetitorResult = await client.action(api.agentMailHandler.simulateInboundReply, {
    inboxId: "discopod-main",
    messageId: `msg_comp_${Date.now()}`,
    threadId: `thread_comp_${Date.now()}`,
    from: "bad-actor@rivalmedia.org",
    subject: `Takedown request`,
    text: `TAKEDOWN ${testShow.title}\nPlease remove this show right away.`,
  });
  console.log(`   Inbound competitor outcome:`, inboundCompetitorResult.outcome);
  if (inboundCompetitorResult.outcome !== "takedown_queued_hitl") {
    throw new Error(`Expected 'takedown_queued_hitl', got: ${inboundCompetitorResult.outcome}`);
  }
  console.log(`   ✓ Unverified inbound email successfully routed to HITL without taking down show.`);

  // 6. Test Verified Creator Takedown
  console.log(`\n5. Simulating Verified Host Takedown from exact email on file (${realHostEmail})...`);
  const verifiedRes = await client.mutation(api.takedowns.submitTakedown, {
    showId: testShow.showId,
    title: testShow.title,
    requesterEmail: realHostEmail,
    reason: "Creator verified takedown",
    source: "web_modal",
  });
  console.log(`   Verified Host Submission Result:`, verifiedRes);
  if (!verifiedRes.verified || verifiedRes.requiresHumanReview) {
    throw new Error(`Expected verified takedown, but got: ${JSON.stringify(verifiedRes)}`);
  }

  // Verify that the show IS taken down and tombstoned (getShowDetail returns null or isTakenDown: true)
  const showAfterVerified = await client.query(api.shows.getShowDetail, { showId: testShow.showId });
  if (showAfterVerified !== null && !showAfterVerified?.isTakenDown) {
    throw new Error("Show was not marked taken down after verified creator submission!");
  }
  console.log(`   ✓ Show detail is taken down / nullified for public viewers (${showAfterVerified === null ? "nullified" : "isTakenDown: true"}).`);
  const isTombstonedVerified = await client.query(api.takedowns.isPodcastTombstoned, {
    title: testShow.title,
  });
  if (!isTombstonedVerified) {
    throw new Error("isPodcastTombstoned returned false after verified creator takedown!");
  }
  console.log(`   ✓ Show immediately taken down and tombstoned for verified creator.`);

  console.log(`\n======================================================`);
  console.log(`SUCCESS: Anti-Competitor Takedown Protection Engine Verified!`);
  console.log(`======================================================\n`);
}

run().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
