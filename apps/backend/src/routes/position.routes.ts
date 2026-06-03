import { Router } from "express";
import { middleware } from "../middleware/auth";
import { WalletService } from "../services/wallet.service";

const router = Router();

// ─── GET /positions ───────────────────────────────────────────────────────────
router.get("/positions", middleware, async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    const userPositions = await WalletService.getPositions(req.userId);
    res.json({ positions: userPositions });
  } catch (error) {
    res.status(500).json({ message: "Error fetching positions" });
  }
});

export default router;
