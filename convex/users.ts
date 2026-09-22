import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { components } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/core";

export const createUser = internalMutation({
  args: {
    provider: v.object({
      name: v.literal("password"),
      accountId: v.string(),
      profile: v.object({ username: v.string() }),
    }),
  },
  returns: v.id("users"),
  handler: async (ctx) => {
    // First user created is super admin. Others will need to wait for approval as admins.
    const existingUsers = await ctx.db.query("users").take(1);
    const isFirstUser = existingUsers.length === 0;

    return await ctx.db.insert("users", {
      role: isFirstUser ? "superadmin" : "pending",
      approvedAt: isFirstUser ? Date.now() : undefined,
    });
  },
});

export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      username: v.string(),
      role: v.union(v.literal("superadmin"), v.literal("admin"), v.literal("pending")),
      approvedAt: v.optional(v.number()),
      approvedBy: v.optional(v.id("users")),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const user = await ctx.db.get("users", userId);
    if (user === null) return null;

    const username = await ctx.runQuery(components.authUsername.public.getUsername, {
      userId,
    });

    return {
      _id: user._id,
      username: username ?? "Unknown",
      role: user.role,
      approvedAt: user.approvedAt,
      approvedBy: user.approvedBy,
    };
  },
});

export const listUsers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      username: v.string(),
      role: v.union(v.literal("superadmin"), v.literal("admin"), v.literal("pending")),
      approvedAt: v.optional(v.number()),
      approvedBy: v.optional(v.id("users")),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Unauthorized: Must be logged in.");
    }
    const caller = await ctx.db.get("users", userId);
    if (!caller || (caller.role !== "superadmin" && caller.role !== "admin")) {
      throw new Error("Forbidden: Admin privileges required.");
    }

    const allUsers = await ctx.db.query("users").collect();
    const results = await Promise.all(
      allUsers.map(async (u) => {
        const username = await ctx.runQuery(components.authUsername.public.getUsername, {
          userId: u._id,
        });
        return {
          _id: u._id,
          _creationTime: u._creationTime,
          username: username ?? "Unknown",
          role: u.role,
          approvedAt: u.approvedAt,
          approvedBy: u.approvedBy,
        };
      }),
    );

    return results;
  },
});

export const updateUserRole = mutation({
  args: {
    targetUserId: v.id("users"),
    newRole: v.union(v.literal("admin"), v.literal("pending")),
  },
  returns: v.object({
    success: v.boolean(),
    updatedRole: v.union(v.literal("admin"), v.literal("pending")),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Unauthorized: Must be logged in.");
    }
    const caller = await ctx.db.get("users", userId);
    if (!caller || caller.role !== "superadmin") {
      throw new Error("Forbidden: Only Super Admin can modify user roles.");
    }

    const targetUser = await ctx.db.get("users", args.targetUserId);
    if (!targetUser) {
      throw new Error("Target user not found.");
    }
    if (targetUser.role === "superadmin") {
      throw new Error("Cannot modify role of Super Admin.");
    }

    await ctx.db.patch(targetUser._id, {
      role: args.newRole,
      approvedAt: args.newRole === "admin" ? Date.now() : undefined,
      approvedBy: args.newRole === "admin" ? caller._id : undefined,
    });

    return {
      success: true,
      updatedRole: args.newRole,
    };
  },
});
