import { defineApp } from "convex/server";
import { v } from "convex/values";
import agentmail from "@agentmail/convex/convex.config";
import auth from "@convex-dev/auth/core/convex.config.js";
import passwordProvider from "@convex-dev/auth/providers/password/convex.config.js";
import username from "@convex-dev/auth/username/convex.config.js";
import staticHosting from "@convex-dev/static-hosting/convex.config";

const app = defineApp({
  env: {
    AUTH_PRIVATE_KEY: v.string(),
    AUTH_JWKS: v.string(),
  },
});

app.use(agentmail);
app.use(auth, {
  httpPrefix: "/auth",
  env: {
    AUTH_PRIVATE_KEY: app.env.AUTH_PRIVATE_KEY,
    AUTH_JWKS: app.env.AUTH_JWKS,
  },
});
app.use(passwordProvider);
app.use(username);
app.use(staticHosting);

export default app;
