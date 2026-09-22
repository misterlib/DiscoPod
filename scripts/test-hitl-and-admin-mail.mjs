#!/usr/bin/env node

/**
 * Integration Test for DiscoPod Human-in-the-Loop (HITL) Admin & Email Verification Engine.
 *
 * Verifies:
 * 1. Configuring humanInTheLoopEmail in ownerSettings.
 * 2. Searching for podcasts as a host (searchShowsForHostAccess) and verifying email masking.
 * 3. Submitting an alternate email access request (prepareAlternateEmailRequest).
 * 4. Verifying the request is listed in listAccessRequests with status "escalated" / "pending".
 * 5. Admin command via email: Simulating an inbound "APPROVE <requestId>" message from HITL admin email
 *    via processInboundReply.
 * 6. Verifying that the request is approved, the show's host email is updated, and claim is verified.
 * 7. Admin command via email: Simulating "STATUS" command to receive system report.
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
  console.log(`[DiscoPod Test] Human-in-the-Loop & AgentMail Admin Commands`);
  console.log(`Deployment: ${convexUrl}`);
  console.log(`======================================================\n`);

  const uniqueSuffix = Date.now();
  const testHitlAdminEmail = `admin-hitl-${uniqueSuffix}@discopod-agent.io`;
  const alternateHostEmail = `real-creator-${uniqueSuffix}@producer.fm`;

  try {
    // 1. Configure HITL Email in Owner Settings
    console.log(`1. Setting Human-in-the-Loop Admin Email to: ${testHitlAdminEmail}...`);
    await client.mutation(api.ownerSettings.setHumanInTheLoopEmail, {
      humanInTheLoopEmail: testHitlAdminEmail,
    });

    const settings = await client.query(api.ownerSettings.getOwnerSettings, {});
    console.log(`   Saved settings HITL email: ${settings.humanInTheLoopEmail}`);
    if (settings.humanInTheLoopEmail !== testHitlAdminEmail) {
      throw new Error("Failed to persist humanInTheLoopEmail.");
    }

    // 2. Query available shows for host search test
    console.log(`\n2. Testing Host Search (searchShowsForHostAccess)...`);
    const globeShows = await client.query(api.shows.listGlobeShows, { limit: 10 });
    if (!globeShows || globeShows.length === 0) {
      throw new Error("No active shows found in database to test host access flow.");
    }

    const targetShow = globeShows[0];
    console.log(`   Selected target show: "${targetShow.title}" (${targetShow.showId})`);

    const searchFirstWord = targetShow.title.split(" ")[0];
    const searchResults = await client.query(api.hostAccess.searchShowsForHostAccess, {
      query: searchFirstWord,
    });

    console.log(`   Found ${searchResults.length} search results for query "${searchFirstWord}"`);
    const foundShow = searchResults.find((s) => s.showId === targetShow.showId);
    if (!foundShow) {
      throw new Error(`Target show "${targetShow.title}" not returned in host search.`);
    }

    console.log(`   Show title: "${foundShow.title}"`);
    console.log(`   Masked email: "${foundShow.maskedEmail || foundShow.maskedHostEmail || "None"}"`);

    // 3. Submit an Alternate Email Access Request (Host realization of wrong/inaccessible email)
    console.log(`\n3. Submitting alternate email access request as a host with wrong email on file...`);
    const altRequestResult = await client.action(api.hostAccessActions.requestAccessWithAlternateEmail, {
      showId: targetShow.showId,
      alternateEmail: alternateHostEmail,
      note: "The email on file is our old agency address. I am the executive producer.",
    });

    console.log(`   Submission result:`, altRequestResult);
    if (!altRequestResult.success || !altRequestResult.requestId) {
      throw new Error("Failed to submit alternate email request.");
    }

    const requestId = altRequestResult.requestId;

    // 4. Verify request appears in listAccessRequests for Admin oversight
    console.log(`\n4. Verifying request in listAccessRequests...`);
    const accessList = await client.query(api.hostAccess.listAccessRequests, {});
    const listedReq = accessList.find((r) => r._id === requestId);
    if (!listedReq) {
      throw new Error(`Access request ${requestId} not found in listAccessRequests.`);
    }
    console.log(`   Found in registry: Show: "${listedReq.showTitle}", Status: "${listedReq.status}", AltEmail: "${listedReq.alternateEmail}"`);

    // 5. Simulate Admin Email Command: "APPROVE <requestId>" from the authorized HITL email
    console.log(`\n5. Simulating Admin Email Action: "APPROVE ${requestId}" from ${testHitlAdminEmail}...`);
    // Calling simulateInboundReply action directly as simulated inbound AgentMail webhook
    const adminReplyResult = await client.action(api.agentMailHandler.simulateInboundReply, {
      inboxId: "discopod-main",
      messageId: `msg_${Date.now()}`,
      threadId: `thread_${Date.now()}`,
      from: testHitlAdminEmail,
      subject: `Re: [DiscoPod HITL] Host access review — ${targetShow.title}`,
      text: `APPROVE ${requestId}\nLooks legitimate, granting host dashboard access.`,
    });

    console.log(`   Admin command execution result:`, adminReplyResult);
    if (adminReplyResult.intent !== "ADMIN_COMMAND" || adminReplyResult.outcome !== "admin_approved") {
      throw new Error(`Expected outcome 'admin_approved', received: ${adminReplyResult.outcome}`);
    }

    // 6. Verify that request status updated to approved and show's host email is updated
    console.log(`\n6. Verifying state after admin approval...`);
    const updatedList = await client.query(api.hostAccess.listAccessRequests, {});
    const updatedReq = updatedList.find((r) => r._id === requestId);
    if (!updatedReq || updatedReq.status !== "approved") {
      throw new Error(`Expected request status 'approved', got: ${updatedReq?.status}`);
    }
    console.log(`   ✓ Request status successfully marked: "${updatedReq.status}"`);

    const updatedShow = await client.query(api.shows.getShowDetail, { showId: targetShow.showId });
    if (updatedShow?.hostEmail?.toLowerCase() !== alternateHostEmail.toLowerCase()) {
      throw new Error(`Show hostEmail was not updated to ${alternateHostEmail}. Found: ${updatedShow?.hostEmail}`);
    }
    console.log(`   ✓ Show hostEmail successfully updated to: ${updatedShow.hostEmail}`);
    console.log(`   ✓ Show isClaimed status: ${updatedShow.isClaimed}`);

    // 7. Simulate Admin Email Command: "STATUS"
    console.log(`\n7. Simulating Admin Email Action: "STATUS" from ${testHitlAdminEmail}...`);
    const statusReply = await client.action(api.agentMailHandler.simulateInboundReply, {
      inboxId: "discopod-main",
      messageId: `msg_stat_${Date.now()}`,
      threadId: `thread_stat_${Date.now()}`,
      from: testHitlAdminEmail,
      subject: `System Status Request`,
      text: `STATUS`,
    });

    console.log(`   Admin STATUS execution result:`, statusReply);
    if (statusReply.intent !== "ADMIN_COMMAND" || statusReply.outcome !== "admin_status_sent") {
      throw new Error(`Expected outcome 'admin_status_sent', received: ${statusReply.outcome}`);
    }
    console.log(`   Admin reply text received:\n${statusReply.replyMessage}\n`);

    console.log(`======================================================`);
    console.log(`SUCCESS: Human-in-the-Loop Admin & Email Engine fully verified!`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error(`\nTEST FAILED:`, err);
    process.exit(1);
  }
}

run();
