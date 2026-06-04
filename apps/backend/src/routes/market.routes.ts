import { Router } from "express";
import { db, markets } from "../db";
import { eq } from "drizzle-orm";
import { middleware } from "../middleware/auth";
import { createMarketSchema } from "../schemas/order.schema";

const router = Router();

// ─── GET /markets ────────────────────────────────────────────────────────────
router.get("/markets", async (req, res) => {
  try {
    const allMarkets = await db.select().from(markets);
    res.json({ markets: allMarkets });
  } catch (error) {
    res.status(500).json({ message: "Error fetching markets",error:error.message });
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

// ─── POST /markets ───────────────────────────────────────────────────────────
router.post("/markets", middleware, async (req, res) => {
  const parsed = createMarketSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0].message });
  }

  try {
    const { title, description, resolutionDescription } = parsed.data;
    const emptyOrderbook = JSON.stringify({});

    const [newMarket] = await db
      .insert(markets)
      .values({
        title,
        description,
        resolutionDescription,
        yesOrderbook: emptyOrderbook,
        noOrderbook: emptyOrderbook,
        totalQty: 0,
      })
      .returning();

    res.status(201).json({ market: newMarket });
  } catch (error: any) {
  res.status(500).json({ 
    message: "Error fetching markets", 
    error: error.message,
    code: error.code,
    detail: error.detail,
  });
}
});

export default router;

