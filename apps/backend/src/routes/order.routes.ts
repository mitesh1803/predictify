import { Router } from "express";
import { middleware } from "../middleware/auth";
import { OrderService } from "../services/order.service";
import { CreateOrderSchema, SplitSchema } from "../schemas/order.schema";

const router = Router();

// ─── POST /split ──────────────────────────────────────────────────────────────
router.post("/split", middleware, async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const { data, success } = SplitSchema.safeParse(req.body);
  if (!success) {
    res.status(411).json({ message: "Incorrect inputs" });
    return;
  }

  try {
    await OrderService.split(req.userId, data.marketId, data.amount);
    res.json({ message: "Split successful" });
  } catch (error: any) {
    if (error.message === "Insufficient USD balance for split") {
      res.status(403).json({ message: "Sorry you are not allowed to do this" });
    } else {
      res.status(500).json({ message: "Error processing split" });
    }
  }
});

// ─── POST /merge ──────────────────────────────────────────────────────────────
router.post("/merge", middleware, async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const { data, success } = SplitSchema.safeParse(req.body);
  if (!success) {
    res.status(411).json({ message: "Incorrect inputs" });
    return;
  }

  try {
    await OrderService.merge(req.userId, data.marketId, data.amount);
    res.json({ message: "Merge successful" });
  } catch (error: any) {
    if (
      error.message === "Insufficient Yes position" ||
      error.message === "Insufficient No position"
    ) {
      res.status(403).json({ message: "Sorry you dont have enough position" });
    } else {
      res.status(500).json({ message: "Error merging" });
    }
  }
});

// ─── POST /order ──────────────────────────────────────────────────────────────
router.post("/order", middleware, async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const { success, data } = CreateOrderSchema.safeParse(req.body);
  if (!success) {
    res.status(411).json({ message: "Incorrect inputs" });
    return;
  }

  try {
    await OrderService.createOrder(
      req.userId,
      data.marketId,
      data.side,
      data.type,
      data.price,
      data.qty
    );
    res.json({ message: "Order executed successfully" });
  } catch (error: any) {
    console.error("Error executing order:", error);
    if (error.message === "Insufficient USD balance") {
      res
        .status(403)
        .json({ message: "Sorry you dont have enough $ in your account" });
    } else if (
      error.message === "Insufficient Yes position" ||
      error.message === "Insufficient No position"
    ) {
      res.status(403).json({ message: "Sorry you dont have enough position" });
    } else {
      res.status(500).json({ message: "Error executing order" });
    }
  }
});

export default router;
