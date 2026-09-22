import { v } from "convex/values";

import { mutation } from "./_generated/server";

export const incrementSnippetPlay = mutation({
  args: {
    snippetId: v.id("snippets"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const snippet = await ctx.db.get("snippets", args.snippetId);
    if (!snippet) {
      throw new Error("Snippet not found");
    }
    await ctx.db.patch("snippets", snippet._id, {
      playCount: snippet.playCount + 1,
    });
    return null;
  },
});

export const upvoteSnippet = mutation({
  args: {
    snippetId: v.id("snippets"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const snippet = await ctx.db.get("snippets", args.snippetId);
    if (!snippet) {
      throw new Error("Snippet not found");
    }
    await ctx.db.patch("snippets", snippet._id, {
      upvotes: snippet.upvotes + 1,
    });
    return null;
  },
});
