import { Router } from "express";
import { db, users } from "../db";
import { eq } from "drizzle-orm";
import { middleware } from "../middleware/auth";

const router = Router();

/**
 * POST /user/register
 *
 * Creates a new user row if one doesn't already exist for this wallet address.
 * Must be called once after a user signs in for the first time via Supabase Web3 auth.
 * Subsequent calls for the same address are idempotent (returns existing user).
 */
router.post("/user/register", middleware, async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const address = req.userId; // wallet address set by auth middleware

    // Check if user already exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.address, address))
      .limit(1);

    if (existing.length > 0) {
      return res.status(200).json({ user: existing[0], created: false });
    }

    // Create new user with zero balance
    const [newUser] = await db
      .insert(users)
      .values({
        address,
        usdBalance: 0,
      })
      .returning();

    return res.status(201).json({ user: newUser, created: true });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Error registering user" });
  }
});

/**
 * GET /user/me
 *
 * Returns the authenticated user's profile.
 */
router.get("/user/me", middleware, async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.address, req.userId))
      .limit(1);

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found. Call POST /user/register first." });
    }

    return res.json({ user });
  } catch (error) {
    res.status(500).json({ message: "Error fetching user" });
  }
});

export default router;
