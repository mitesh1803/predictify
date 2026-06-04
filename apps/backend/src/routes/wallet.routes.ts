import { Router } from "express";
import { middleware } from "../middleware/auth";
import { WalletService } from "../services/wallet.service";
import { OnrampSchema, OfframpSchema } from "../schemas/order.schema";

const router = Router();

// ─── GET /balance ─────────────────────────────────────────────────────────────
router.get("/balance", middleware, async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    const balance = await WalletService.getBalance(req.userId);
    res.json({ balance });
  } catch (error) {
    res.status(500).json({ message: "Error fetching balance" });
  }
});

// ─── POST /onramp ─────────────────────────────────────────────────────────────
router.post("/onramp", middleware, async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const { success, data } = OnrampSchema.safeParse(req.body);
  if (!success) {
    res.status(411).json({ message: "Incorrect inputs" });
    return;
  }

  try {
    const amount = await WalletService.onramp(req.userId, data.amount);
    res.json({ message: "Successfully Added", amount });
  } catch (error) {
    res.status(500).json({ message: "Error processing onramp" });
  }
});

// ─── POST /offramp ────────────────────────────────────────────────────────────
router.post("/offramp", middleware, async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const { success, data } = OfframpSchema.safeParse(req.body);
  if (!success) {
    res.status(411).json({ message: "Incorrect inputs" });
    return;
  }

  try {
    const amount = await WalletService.offramp(req.userId, data.amount);
    res.json({ message: "Offramp successful", amount });
  } catch (error: any) {
    if (error.message === "Insufficient USD balance") {
      res.status(403).json({ message: "Insufficient USD balance for offramp" });
    } else {
      res.status(500).json({ message: "Error processing offramp" });
    }
  }
});

export default router;
