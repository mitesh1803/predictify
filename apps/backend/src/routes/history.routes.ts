import { Router } from "express";
import { middleware } from "../middleware/auth";
import { OrderService } from "../services/order.service";

const router = Router();

// ─── GET /history ────────────────────────────────────────────────────────────
router.get("/history", middleware, async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    const history = await OrderService.getOrderHistory(req.userId);
    res.json({ history });
  } catch (error) {
    res.status(500).json({ message: "Error fetching order history" });
  }
});

export default router;
