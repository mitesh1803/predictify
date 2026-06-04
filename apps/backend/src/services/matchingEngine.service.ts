import { and, eq, sql } from "drizzle-orm";
import { positions, users, markets, orderHistory } from "../db";
import { parseOrderbook } from "../utils/parseOrderbook";

export class MatchingEngineService {
  static async executeOrder(
    tx: any,
    user: { id: string; usdBalance: number },
    market: { id: string; yesOrderbook: unknown; noOrderbook: unknown },
    orderData: { marketId: string; side: "yes" | "no"; type: "buy" | "sell"; price: number; qty: number },
    originalOrderId: string
  ) {
    const { marketId, side, type, price, qty } = orderData;
    const userId = user.id;

    const yesOrderbook = parseOrderbook(market.yesOrderbook);
    const noOrderbook = parseOrderbook(market.noOrderbook);

    // helper: update position qty
    const updatePositionQty = async (
      ownerId: string,
      posType: "Yes" | "No",
      delta: number,
    ) => {
      await tx
        .update(positions)
        .set({ qty: sql`${positions.qty} + ${delta}` })
        .where(
          and(
            eq(positions.userId, ownerId),
            eq(positions.marketId, marketId),
            eq(positions.type, posType),
          ),
        );
    };

    const updateUserBalance = async (ownerId: string, delta: number) => {
      await tx
        .update(users)
        .set({ usdBalance: sql`${users.usdBalance} + ${delta}` })
        .where(eq(users.id, ownerId));
    };

    const upsertPosition = async (
      ownerId: string,
      posType: "Yes" | "No",
      posQty: number,
    ) => {
      await tx
        .insert(positions)
        .values({ userId: ownerId, marketId, type: posType, qty: posQty })
        .onConflictDoUpdate({
          target: [positions.userId, positions.marketId, positions.type],
          set: { qty: sql`${positions.qty} + ${posQty}` },
        });
    };

    // ── YES BUY ──
    if (side === "yes" && type === "buy") {
      const usd = qty * price;
      if (user.usdBalance < usd) throw new Error("Insufficient USD balance");

      let leftQty = qty;
      const prices = Object.keys(yesOrderbook).sort(
        (a, b) => Number(a) - Number(b),
      );

      for (const p of prices) {
        if (Number(p) > price) continue;
        const { orders } = yesOrderbook[p]!;
        for (const order of orders) {
          if (leftQty <= 0) break;
          const matchedQty = Math.min(order.qty, leftQty);
          if (!order.reverseOrder) {
            await updatePositionQty(order.userId, "Yes", -matchedQty);
            await updateUserBalance(order.userId, Number(p) * matchedQty);
          } else {
            await updatePositionQty(order.userId, "No", matchedQty);
            await updateUserBalance(
              order.userId,
              -(100 - Number(p)) * matchedQty,
            );
          }
          await upsertPosition(userId, "Yes", matchedQty);
          await updateUserBalance(userId, -(Number(p) * matchedQty));
          leftQty -= matchedQty;
          order.filledQty += matchedQty;
          yesOrderbook[p]!.availableQty -= matchedQty;
        }
      }

      if (leftQty > 0) {
        const oppositePrice = 100 - price;
        if (!noOrderbook[oppositePrice]) {
          noOrderbook[oppositePrice] = { availableQty: 0, orders: [] };
        }
        noOrderbook[oppositePrice]!.availableQty += leftQty;
        noOrderbook[oppositePrice]!.orders.push({
          qty: leftQty,
          userId,
          filledQty: 0,
          originalOrderId,
          reverseOrder: true,
        });
      }
    }

    // ── YES SELL ──
    if (side === "yes" && type === "sell") {
      const buyPrice = 100 - price;
      const userPosition = await tx
        .select()
        .from(positions)
        .where(
          and(
            eq(positions.userId, userId),
            eq(positions.marketId, marketId),
            eq(positions.type, "Yes"),
          ),
        )
        .limit(1);
      if (!userPosition[0] || userPosition[0].qty < qty) {
        throw new Error("Insufficient Yes position");
      }

      let leftQty = qty;
      // Sort descending: sellers should match against the BEST (highest) bids first
      const prices = Object.keys(noOrderbook).sort(
        (a, b) => Number(b) - Number(a),
      );

      for (const p of prices) {
        if (Number(p) > buyPrice) continue;
        const { orders } = noOrderbook[p]!;
        for (const order of orders) {
          if (leftQty <= 0) break;
          const matchedQty = Math.min(order.qty, leftQty);
          if (!order.reverseOrder) {
            await updatePositionQty(order.userId, "No", -matchedQty);
            await updateUserBalance(order.userId, Number(p) * matchedQty);
          } else {
            await updatePositionQty(order.userId, "Yes", matchedQty);
            await updateUserBalance(
              order.userId,
              -(100 - Number(p)) * matchedQty,
            );
          }
          await updatePositionQty(userId, "Yes", -matchedQty);
          await updateUserBalance(userId, Number(p) * matchedQty);
          leftQty -= matchedQty;
          order.filledQty += matchedQty;
          noOrderbook[p]!.availableQty -= matchedQty;
        }
      }

      if (leftQty > 0) {
        if (!yesOrderbook[price]) {
          yesOrderbook[price] = { availableQty: 0, orders: [] };
        }
        yesOrderbook[price]!.availableQty += leftQty;
        yesOrderbook[price]!.orders.push({
          qty: leftQty,
          userId,
          filledQty: 0,
          originalOrderId,
          reverseOrder: false,
        });
      }
    }

    // ── NO BUY ──
    if (side === "no" && type === "buy") {
      const usd = qty * price;
      if (user.usdBalance < usd) throw new Error("Insufficient USD balance");

      let leftQty = qty;
      const prices = Object.keys(noOrderbook).sort(
        (a, b) => Number(a) - Number(b),
      );

      for (const p of prices) {
        if (Number(p) > price) continue;
        const { orders } = noOrderbook[p]!;
        for (const order of orders) {
          if (leftQty <= 0) break;
          const matchedQty = Math.min(order.qty, leftQty);
          if (!order.reverseOrder) {
            await updatePositionQty(order.userId, "No", -matchedQty);
            await updateUserBalance(order.userId, Number(p) * matchedQty);
          } else {
            await updatePositionQty(order.userId, "Yes", matchedQty);
            await updateUserBalance(
              order.userId,
              -(100 - Number(p)) * matchedQty,
            );
          }
          await upsertPosition(userId, "No", matchedQty);
          await updateUserBalance(userId, -(Number(p) * matchedQty));
          leftQty -= matchedQty;
          order.filledQty += matchedQty;
          noOrderbook[p]!.availableQty -= matchedQty;
        }
      }

      if (leftQty > 0) {
        const oppositePrice = 100 - price;
        if (!yesOrderbook[oppositePrice]) {
          yesOrderbook[oppositePrice] = { availableQty: 0, orders: [] };
        }
        yesOrderbook[oppositePrice]!.availableQty += leftQty;
        yesOrderbook[oppositePrice]!.orders.push({
          qty: leftQty,
          userId,
          filledQty: 0,
          originalOrderId,
          reverseOrder: true,
        });
      }
    }

    // ── NO SELL ──
    if (side === "no" && type === "sell") {
      const buyPrice = 100 - price;
      const userPosition = await tx
        .select()
        .from(positions)
        .where(
          and(
            eq(positions.userId, userId),
            eq(positions.marketId, marketId),
            eq(positions.type, "No"),
          ),
        )
        .limit(1);
      if (!userPosition[0] || userPosition[0].qty < qty) {
        throw new Error("Insufficient No position");
      }

      let leftQty = qty;
      // Sort descending: sellers should match against the BEST (highest) bids first
      const prices = Object.keys(yesOrderbook).sort(
        (a, b) => Number(b) - Number(a),
      );

      for (const p of prices) {
        if (Number(p) > buyPrice) continue;
        const { orders } = yesOrderbook[p]!;
        for (const order of orders) {
          if (leftQty <= 0) break;
          const matchedQty = Math.min(order.qty, leftQty);
          if (!order.reverseOrder) {
            await updatePositionQty(order.userId, "Yes", -matchedQty);
            await updateUserBalance(order.userId, Number(p) * matchedQty);
          } else {
            await updatePositionQty(order.userId, "No", matchedQty);
            await updateUserBalance(
              order.userId,
              -(100 - Number(p)) * matchedQty,
            );
          }
          await updatePositionQty(userId, "No", -matchedQty);
          await updateUserBalance(userId, Number(p) * matchedQty);
          leftQty -= matchedQty;
          order.filledQty += matchedQty;
          yesOrderbook[p]!.availableQty -= matchedQty;
        }
      }

      if (leftQty > 0) {
        if (!noOrderbook[price]) {
          noOrderbook[price] = { availableQty: 0, orders: [] };
        }
        noOrderbook[price]!.availableQty += leftQty;
        noOrderbook[price]!.orders.push({
          qty: leftQty,
          userId,
          filledQty: 0,
          originalOrderId,
          reverseOrder: false,
        });
      }
    }

    await tx.insert(orderHistory).values({
      id: originalOrderId,
      orderType: type === "buy" ? "Buy" : "Sell",
      userId,
      price,
      qty,
      marketId,
    });

    await tx
      .update(markets)
      .set({
        yesOrderbook: JSON.stringify(yesOrderbook),
        noOrderbook: JSON.stringify(noOrderbook),
      })
      .where(eq(markets.id, marketId));
  }
}
