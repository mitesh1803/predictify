import { Router } from "express";
import { db, markets } from "../db";
import { eq } from "drizzle-orm";

const router = Router();

// ─── GET /markets ────────────────────────────────────────────────────────────
router.get("/markets", async (req, res) => {
  try {
    const allMarkets = await db.select().from(markets);
    res.json({ markets: allMarkets });
  } catch (error) {
    res.status(500).json({ message: "Error fetching markets" });
  }
});

// ─── GET /market ─────────────────────────────────────────────────────────────
router.get("/market", async (req, res) => {
  try {
    const market = await db
      .select()
      .from(markets)
      .where(eq(markets.id, req.query.marketId as string))
      .limit(1);
    res.json({ market: market[0] });
  } catch (error) {
    res.status(500).json({ message: "Error fetching market" });
  }
});

export default router;
