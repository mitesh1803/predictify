import { db, orderHistory, users, positions, markets } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { MatchingEngineService } from "./matchingEngine.service";
import { uuid } from "uuidv4";

export class OrderService {
  static async getOrderHistory(userId: string) {
    const history = await db
      .select()
      .from(orderHistory)
      .where(eq(orderHistory.userId, userId));
    return history;
  }

  static async split(userId: string, marketId: string, amount: number) {
    await db.transaction(async (tx) => {
      // Drizzle FOR UPDATE lock
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .for("update");

      if (!user) throw new Error("User not found");

      if (user.usdBalance < amount) {
        throw new Error("Insufficient USD balance for split");
      }

      await tx
        .update(users)
        .set({ usdBalance: sql`${users.usdBalance} - ${amount}` })
        .where(eq(users.id, userId));

      // Upsert YES position
      await tx
        .insert(positions)
        .values({
          userId,
          marketId,
          type: "Yes",
          qty: amount,
        })
        .onConflictDoUpdate({
          target: [positions.userId, positions.marketId, positions.type],
          set: { qty: sql`${positions.qty} + ${amount}` },
        });

      // Upsert NO position
      await tx
        .insert(positions)
        .values({
          userId,
          marketId,
          type: "No",
          qty: amount,
        })
        .onConflictDoUpdate({
          target: [positions.userId, positions.marketId, positions.type],
          set: { qty: sql`${positions.qty} + ${amount}` },
        });

      await tx.insert(orderHistory).values({
        orderType: "Split",
        userId,
        price: 0,
        qty: amount,
        marketId,
      });
    });
  }

  static async merge(userId: string, marketId: string, amount: number) {
    await db.transaction(async (tx) => {
      const [yesPos] = await tx
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

      const [noPos] = await tx
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

      if (!yesPos || yesPos.qty < amount) {
        throw new Error("Insufficient Yes position");
      }
      if (!noPos || noPos.qty < amount) {
        throw new Error("Insufficient No position");
      }

      await tx
        .update(positions)
        .set({ qty: sql`${positions.qty} - ${amount}` })
        .where(
          and(
            eq(positions.userId, userId),
            eq(positions.marketId, marketId),
            eq(positions.type, "Yes"),
          ),
        );

      await tx
        .update(positions)
        .set({ qty: sql`${positions.qty} - ${amount}` })
        .where(
          and(
            eq(positions.userId, userId),
            eq(positions.marketId, marketId),
            eq(positions.type, "No"),
          ),
        );

      await tx
        .update(users)
        .set({ usdBalance: sql`${users.usdBalance} + ${amount}` })
        .where(eq(users.id, userId));

      await tx.insert(orderHistory).values({
        orderType: "Merge",
        userId,
        price: 0,
        qty: amount,
        marketId,
      });
    });
  }

  static async createOrder(
    userId: string,
    marketId: string,
    side: "yes" | "no",
    type: "buy" | "sell",
    price: number,
    qty: number,
  ) {
    const originalOrderId = uuid();

    await db.transaction(async (tx) => {
      // 1. Lock market row using Drizzle native forUpdate
      const [market] = await tx
        .select()
        .from(markets)
        .where(eq(markets.id, marketId))
        .for("update");

      if (!market) throw new Error("Market not found");

      // 2. Lock user row using Drizzle native forUpdate
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .for("update");

      if (!user) throw new Error("User not found");

      // 3. Delegate execution to MatchingEngineService
      await MatchingEngineService.executeOrder(
        tx,
        user,
        market,
        { marketId, side, type, price, qty },
        originalOrderId
      );
    });
  }
}