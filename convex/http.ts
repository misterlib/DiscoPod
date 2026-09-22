import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { AgentMail } from "@agentmail/convex";
import { registerStaticRoutes } from "@convex-dev/static-hosting";

const agentmail = new AgentMail(components.agentmail, {
  onMessageReceived: internal.agentMailHandler.onMessageReceived,
  onEvent: internal.agentMailHandler.onEvent,
});

const http = httpRouter();

http.route({
  path: "/agentmail/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // If request has Svix signature headers, use the official AgentMail webhook handler
    const hasSvixHeaders =
      Boolean(request.headers.get("svix-id")) ||
      Boolean(request.headers.get("svix-signature"));

    if (hasSvixHeaders && process.env.AGENTMAIL_WEBHOOK_SECRET) {
      try {
        return await agentmail.handleWebhook(ctx as any, request);
      } catch (err: any) {
        console.error("[http/agentmail/webhook] Svix verification error:", err);
        return new Response(JSON.stringify({ error: err.message || "Invalid webhook signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Direct JSON test webhook fallback (useful for local development, tests, and non-Svix delivery)
    try {
      const rawText = await request.text();
      let body: any = {};
      try {
        body = JSON.parse(rawText);
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Handle standard AgentMail event format if delivered as direct payload
      let messageText = body.text || "";
      let messageSubject = body.subject || "";
      let messageFrom = body.from || "";
      let messageId = body.messageId || body.message_id || "";
      let threadId = body.threadId || body.thread_id || "";
      let inboxId = body.inboxId || body.inbox_id || process.env.AGENTMAIL_INBOX_ID || "discopod@agentmail.to";

      if (body.event_type === "message.received" && body.message) {
        const m = body.message;
        messageText = m.extracted_text || m.text || "";
        messageSubject = m.subject || "";
        messageFrom = typeof m.from === "object" && m.from?.address ? m.from.address : (typeof m.from === "string" ? m.from : "");
        messageId = m.message_id || m.id || messageId;
        threadId = m.thread_id || threadId;
        inboxId = m.inbox_id || inboxId;
      }

      if (!messageText) {
        return new Response(JSON.stringify({ error: "Missing body text" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const defaultInbox = process.env.AGENTMAIL_INBOX_ID || "discopod@agentmail.to";
      const cleanInbox = (inboxId && inboxId !== "discopod-main") ? inboxId : defaultInbox;

      const result: { intent: string; outcome: string; replyMessage: string } =
        await ctx.runAction(internal.agentMailHandler.processInboundReply, {
          inboxId: cleanInbox,
          messageId: messageId || "msg_test",
          threadId: threadId || "",
          from: messageFrom || "host@example.com",
          text: messageText,
          subject: messageSubject || "Re: Your DiscoPod Reel",
        });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("[http/agentmail/webhook] Error:", err);
      return new Response(JSON.stringify({ error: err.message || "Webhook error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/image-proxy",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");
    if (!targetUrl) {
      return new Response("Missing url parameter", { status: 400 });
    }
    try {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
        },
      });
      if (!response.ok) {
        return new Response("Failed to fetch image", { status: response.status });
      }
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const imageBytes = await response.arrayBuffer();
      return new Response(imageBytes, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch (err: any) {
      return new Response(err?.message || "Failed to proxy image", { status: 500 });
    }
  }),
});

registerStaticRoutes(http, components.staticHosting);

export default http;

