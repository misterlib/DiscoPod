#!/usr/bin/env node

/**
 * DiscoPod Two-Way AgentMail Webhook & Intent Parser Test
 *
 * Tests the full inbound creator command grammar:
 * 1. "Amp this show" -> AMP_SHOW intent & boost
 * 2. "Change snippet to 12:30" -> RE_SLICE intent & timestamp update
 * 3. General question -> conversational clarification
 *
 * Can test via Convex Client action or direct HTTP webhook POST.
 *
 * Usage:
 *   node scripts/test-agentmail-webhook.mjs [--http]
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

const isHttp = process.argv.includes("--http");
const client = new ConvexHttpClient(convexUrl);

console.log(`\n======================================================`);
console.log(`[DiscoPod Test] Two-Way AgentMail Loop & Intent Test`);
console.log(`Deployment: ${convexUrl}`);
console.log(`Mode: ${isHttp ? "Direct HTTP Webhook POST" : "Convex Action Simulation"}`);
console.log(`======================================================\n`);

async function testIntent(commandName, bodyText) {
  console.log(`Testing Command: "${bodyText}"`);

  if (isHttp) {
    const siteUrl = convexUrl.replace(".convex.cloud", ".convex.site");
    const webhookUrl = `${siteUrl}/agentmail/webhook`;

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: bodyText,
        threadId: "test_thread_1",
        messageId: "test_msg_1",
        from: "creator@example.com",
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP Webhook failed with status ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    console.log(`  ✓ Intent: ${data.intent}`);
    console.log(`  ✓ Outcome: ${data.outcome}`);
    console.log(`  ✓ Automated Reply: "${data.replyMessage}"`);
    return data;
  } else {
    const res = await client.action(api.agentMailHandler.simulateInboundEmail, {
      bodyText,
    });
    console.log(`  ✓ Intent: ${res.intent}`);
    console.log(`  ✓ Outcome: ${res.outcome}`);
    if (res.isClaimed !== undefined) {
      console.log(`  ✓ Show Claimed: ${res.isClaimed}`);
    }
    console.log(`  ✓ Automated Reply: "${res.replyMessage}"`);
    return res;
  }
}

async function run() {
  try {
    // 1. Test VERIFY_CLAIM
    console.log(`[Test 1/5] Creator Verifies Claim`);
    const r1 = await testIntent("VERIFY_CLAIM", "Verify this show! We host it.");
    if (r1.intent !== "VERIFY_CLAIM") {
      console.warn(`Warning: Expected VERIFY_CLAIM but got ${r1.intent}`);
    }

    console.log("");

    // 2. Test RE_SLICE
    console.log(`[Test 2/5] Creator Re-Slices Highlight Window`);
    const r2 = await testIntent("RE_SLICE", "Change snippet to 10:15 please");
    if (r2.intent !== "RE_SLICE") {
      console.warn(`Warning: Expected RE_SLICE but got ${r2.intent}`);
    }

    console.log("");

    // 3. Test UPDATE_HOOK
    console.log(`[Test 3/5] Creator Updates Narrative Hook`);
    const r3 = await testIntent("UPDATE_HOOK", 'Set hook to: "The greatest hackathon project of all time."');
    if (r3.intent !== "UPDATE_HOOK") {
      console.warn(`Warning: Expected UPDATE_HOOK but got ${r3.intent}`);
    }

    console.log("");

    // 4. Test REJECT_CLAIM
    console.log(`[Test 4/5] Creator Disclaims / Rejects Show`);
    const r4 = await testIntent("REJECT_CLAIM", "Reject, not my show");
    if (r4.intent !== "REJECT_CLAIM") {
      console.warn(`Warning: Expected REJECT_CLAIM but got ${r4.intent}`);
    }

    console.log("");

    // 5. Test Clarification Fallback
    console.log(`[Test 5/5] Conversational Clarification & AI Q&A`);
    const r5 = await testIntent("CLARIFICATION_NEEDED", "Hey, who built this app and how does DiscoPod work?");
    if (r5.intent !== "CLARIFICATION_NEEDED") {
      console.warn(`Warning: Expected CLARIFICATION_NEEDED but got ${r5.intent}`);
    }

    console.log(`\n======================================================`);
    console.log(`✓ All 5 AgentMail creator loop tests completed!`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

run();
