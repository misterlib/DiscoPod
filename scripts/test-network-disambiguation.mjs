#!/usr/bin/env node

/**
 * Integration Test for DiscoPod Network Email Disambiguation & Human-in-the-Loop Escalation.
 *
 * Verifies:
 * 1. Network setup: 2 shows configured with the same network host email.
 * 2. Low-Confidence Inbound (Generic text):
 *    - Inbound email does NOT name a specific show.
 *    - Asserts outcome is "escalated_hitl_network_ambiguity".
 *    - Asserts neither show is mistakenly claimed.
 *    - Asserts a hostAccessRequest is recorded with requestType: "network_disambiguation" & status: "escalated".
 * 3. High-Confidence Inbound (Explicit title mention):
 *    - Inbound email explicitly specifies Show A.
 *    - Asserts outcome is "claim_verified" for Show A only.
 *    - Asserts Show B remains untouched and unclaimed.
 * 4. Ambiguous Network Takedown:
 *    - Inbound "TAKEDOWN" without specifying which show.
 *    - Asserts outcome is "escalated_hitl_network_ambiguity".
 *    - Asserts neither show is taken down.
 * 5. Explicit Network Takedown:
 *    - Inbound "TAKEDOWN <Show B title>" from the verified network email.
 *    - Asserts Show B is immediately taken down and tombstoned.
 *    - Asserts Show A remains live and untouched.
 * 6. HITL Admin Action:
 *    - Admin approves the escalated network request via "APPROVE <requestId>".
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

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`   ✓ ${message}`);
}

async function run() {
  console.log(`\n======================================================`);
  console.log(`[DiscoPod Test] Network Email Disambiguation & HITL Escalation`);
  console.log(`Deployment: ${convexUrl}`);
  console.log(`======================================================\n`);

  const uniqueSuffix = Date.now();
  const hitlAdminEmail = `admin-network-audit-${uniqueSuffix}@discopod-agent.io`;
  const networkEmail = `podcastops-${uniqueSuffix}@network-fm.test`;

  // 1. Configure HITL Admin Email
  await client.mutation(api.ownerSettings.setHumanInTheLoopEmail, {
    humanInTheLoopEmail: hitlAdminEmail,
  });
  console.log(`1. Set HITL Admin email to: ${hitlAdminEmail}`);

  // 2. Select 2 active unclaimed shows to represent a network portfolio
  const globeShows = await client.query(api.shows.listGlobeShows, { limit: 50 });
  const availableShows = (globeShows || []).filter((s) => !s.isClaimed);
  if (availableShows.length < 2) {
    console.error("Error: Need at least 2 active unclaimed shows in catalog to test network disambiguation.");
    process.exit(1);
  }

  const showA = availableShows[0];
  const showB = availableShows[1];

  console.log(`2. Setting up Network Portfolio with 2 shows:`);
  console.log(`   - Show A: "${showA.title}" (ID: ${showA.showId})`);
  console.log(`   - Show B: "${showB.title}" (ID: ${showB.showId})`);
  console.log(`   - Shared Network Email: ${networkEmail}`);

  await client.mutation(api.shows.updateShowHostEmail, {
    showId: showA.showId,
    hostEmail: networkEmail,
  });
  await client.mutation(api.shows.updateShowHostEmail, {
    showId: showB.showId,
    hostEmail: networkEmail,
  });

  // 3. Test Low-Confidence Inbound (Generic text without naming a show)
  console.log(`\n3. Testing Low-Confidence Inbound Email (Sender matches multiple network shows, no title given)...`);
  const genericReply = await client.action(api.agentMailHandler.simulateInboundReply, {
    inboxId: "discopod-main",
    messageId: `msg_generic_${uniqueSuffix}`,
    threadId: "",
    from: networkEmail,
    subject: "Re: DiscoPod Network Reel",
    text: "Hi team, we'd like to verify our podcast and claim the host badge!",
  });

  console.log(`   Response intent: ${genericReply.intent}, outcome: ${genericReply.outcome}`);
  assert(
    genericReply.intent === "NETWORK_DISAMBIGUATION_NEEDED",
    "Agent detected network ambiguity intent",
  );
  assert(
    genericReply.outcome === "escalated_hitl_network_ambiguity",
    "Agent escalated to HITL without guessing",
  );
  assert(
    genericReply.replyMessage.includes(showA.title) || genericReply.replyMessage.includes("multiple shows"),
    "Reply explains network ambiguity and mentions shows",
  );

  // Verify neither show was accidentally claimed
  const showADocAfterGeneric = await client.query(api.shows.getShowDetail, { showId: showA.showId });
  const showBDocAfterGeneric = await client.query(api.shows.getShowDetail, { showId: showB.showId });
  assert(showADocAfterGeneric.isClaimed !== true, "Show A was NOT claimed by ambiguous request");
  assert(showBDocAfterGeneric.isClaimed !== true, "Show B was NOT claimed by ambiguous request");

  // Verify access request record exists with requestType: "network_disambiguation" & status: "escalated"
  const accessRequests = await client.query(api.hostAccess.listAccessRequests, {});
  const networkDisambigReq = accessRequests.find(
    (r) => r.requestType === "network_disambiguation" && r.status === "escalated",
  );
  assert(Boolean(networkDisambigReq), "Recorded hostAccessRequest with requestType: 'network_disambiguation'");
  console.log(`   Escalated Request ID: ${networkDisambigReq._id}`);

  // 4. Test High-Confidence Inbound (Explicitly naming Show A)
  console.log(`\n4. Testing High-Confidence Inbound Email (Explicitly naming Show A)...`);
  const specificReply = await client.action(api.agentMailHandler.simulateInboundReply, {
    inboxId: "discopod-main",
    messageId: `msg_specific_${uniqueSuffix}`,
    threadId: "",
    from: networkEmail,
    subject: `Verify ownership of "${showA.title}"`,
    text: `Please verify our show "${showA.title}". This is our flagship podcast.`,
  });

  console.log(`   Response intent: ${specificReply.intent}, outcome: ${specificReply.outcome}`);
  assert(specificReply.intent === "VERIFY_CLAIM", "Resolved intent to VERIFY_CLAIM with high confidence");
  assert(specificReply.outcome === "claim_verified", "Verified claim specifically for named show");

  const showADocAfterSpecific = await client.query(api.shows.getShowDetail, { showId: showA.showId });
  const showBDocAfterSpecific = await client.query(api.shows.getShowDetail, { showId: showB.showId });
  assert(showADocAfterSpecific.isClaimed === true, "Show A is now Verified & Claimed");
  assert(showBDocAfterSpecific.isClaimed !== true, "Show B remains untouched and unclaimed");

  // 5. Test Ambiguous Network Takedown
  console.log(`\n5. Testing Ambiguous Takedown from Network Email (No title specified)...`);
  const ambiguousTakedown = await client.action(api.agentMailHandler.simulateInboundReply, {
    inboxId: "discopod-main",
    messageId: `msg_ambig_takedown_${uniqueSuffix}`,
    threadId: "",
    from: networkEmail,
    subject: "Please take down our podcast",
    text: "TAKEDOWN",
  });

  console.log(`   Response intent: ${ambiguousTakedown.intent}, outcome: ${ambiguousTakedown.outcome}`);
  assert(
    ambiguousTakedown.outcome === "escalated_hitl_network_ambiguity",
    "Ambiguous network takedown escalated to HITL without taking down any show",
  );

  const showADocAfterAmbigTake = await client.query(api.shows.getShowDetail, { showId: showA.showId });
  const showBDocAfterAmbigTake = await client.query(api.shows.getShowDetail, { showId: showB.showId });
  assert(showADocAfterAmbigTake !== null, "Show A is still live");
  assert(showBDocAfterAmbigTake !== null, "Show B is still live");

  // 6. Test Explicit High-Confidence Network Takedown (Explicitly naming Show B)
  console.log(`\n6. Testing Explicit Network Takedown (Explicitly naming Show B)...`);
  const explicitTakedown = await client.action(api.agentMailHandler.simulateInboundReply, {
    inboxId: "discopod-main",
    messageId: `msg_explicit_takedown_${uniqueSuffix}`,
    threadId: "",
    from: networkEmail,
    subject: "Takedown Request",
    text: `TAKEDOWN ${showB.title}`,
  });

  console.log(`   Response intent: ${explicitTakedown.intent}, outcome: ${explicitTakedown.outcome}`);
  assert(explicitTakedown.outcome === "verified_takedown", "Takedown executed as verified for Show B");

  const showADocAfterExplTake = await client.query(api.shows.getShowDetail, { showId: showA.showId });
  const showBDocAfterExplTake = await client.query(api.shows.getShowDetail, { showId: showB.showId });
  assert(showADocAfterExplTake !== null, "Show A remains live and untouched");
  assert(showBDocAfterExplTake === null, "Show B is now taken down from public catalog");

  // 7. Test Admin Resolving Network Escalation via Inbound Email
  console.log(`\n7. Testing HITL Admin Command to Resolve Network Request...`);
  const adminReply = await client.action(api.agentMailHandler.simulateInboundReply, {
    inboxId: "discopod-main",
    messageId: `msg_admin_resolve_${uniqueSuffix}`,
    threadId: "",
    from: hitlAdminEmail,
    subject: `Re: HITL Escalation for ${networkEmail}`,
    text: `APPROVE ${networkDisambigReq._id}`,
  });

  console.log(`   Admin command outcome: ${adminReply.outcome}, reply: ${adminReply.replyMessage}`);
  assert(adminReply.outcome === "admin_approved", "Admin successfully approved network request");

  console.log(`\n======================================================`);
  console.log(`🎉 ALL NETWORK DISAMBIGUATION & HITL TESTS PASSED!`);
  console.log(`======================================================\n`);
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
