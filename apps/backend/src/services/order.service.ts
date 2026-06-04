import { db, orderHistory, users, positions, markets } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { MatchingEngineService } from "./matchingEngine.service";
import { uuid } from "uuidv4";

export class OrderService {
  static async getOrderHistory(userId: string) {
    // userId is a wallet address — join through users to find matching rows
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.address, userId))
      .limit(1);

    if (!user) return [];

    const history = await db
      .select()
      .from(orderHistory)
      .where(eq(orderHistory.userId, user.id));
    return history;
  }

  static async split(userId: string, marketId: string, amount: number) {
    await db.transaction(async (tx) => {
      // userId is wallet address — query by address
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.address, userId))
        .for("update");

      if (!user) throw new Error("User not found");

      const amountInCents = Math.round(amount * 100);

      if (user.usdBalance < amountInCents) {
        throw new Error("Insufficient USD balance for split");
      }

      await tx
        .update(users)
        .set({ usdBalance: sql`${users.usdBalance} - ${amountInCents}` })
        .where(eq(users.address, userId));

      // Upsert YES position (use internal user.id for FK)
      await tx
        .insert(positions)
        .values({
          userId: user.id,
          marketId,
          type: "Yes",
          qty: amountInCents,
        })
        .onConflictDoUpdate({
          target: [positions.userId, positions.marketId, positions.type],
          set: { qty: sql`${positions.qty} + ${amountInCents}` },
        });

      // Upsert NO position
      await tx
        .insert(positions)
        .values({
          userId: user.id,
          marketId,
          type: "No",
          qty: amountInCents,
        })
        .onConflictDoUpdate({
          target: [positions.userId, positions.marketId, positions.type],
          set: { qty: sql`${positions.qty} + ${amountInCents}` },
        });

      await tx.insert(orderHistory).values({
        orderType: "Split",
        userId: user.id,
        price: 0,
        qty: amountInCents,
        marketId,
      });
    });
  }

  static async merge(userId: string, marketId: string, amount: number) {
    await db.transaction(async (tx) => {
      // userId is wallet address — resolve to internal user first
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.address, userId))
        .for("update");

      if (!user) throw new Error("User not found");

      const amountInCents = Math.round(amount * 100);

      const [yesPos] = await tx
        .select()
        .from(positions)
        .where(
          and(
            eq(positions.userId, user.id),
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
            eq(positions.userId, user.id),
            eq(positions.marketId, marketId),
            eq(positions.type, "No"),
          ),
        )
        .limit(1);

      if (!yesPos || yesPos.qty < amountInCents) {
        throw new Error("Insufficient Yes position");
      }
      if (!noPos || noPos.qty < amountInCents) {
        throw new Error("Insufficient No position");
      }

      await tx
        .update(positions)
        .set({ qty: sql`${positions.qty} - ${amountInCents}` })
        .where(
          and(
            eq(positions.userId, user.id),
            eq(positions.marketId, marketId),
            eq(positions.type, "Yes"),
          ),
        );

      await tx
        .update(positions)
        .set({ qty: sql`${positions.qty} - ${amountInCents}` })
        .where(
          and(
            eq(positions.userId, user.id),
            eq(positions.marketId, marketId),
            eq(positions.type, "No"),
          ),
        );

      await tx
        .update(users)
        .set({ usdBalance: sql`${users.usdBalance} + ${amountInCents}` })
        .where(eq(users.address, userId));

      await tx.insert(orderHistory).values({
        orderType: "Merge",
        userId: user.id,
        price: 0,
        qty: amountInCents,
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
      // 1. Lock market row
      const [market] = await tx
        .select()
        .from(markets)
        .where(eq(markets.id, marketId))
        .for("update");

      if (!market) throw new Error("Market not found");

      // 2. Lock user row — query by wallet address, not internal UUID
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.address, userId))
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