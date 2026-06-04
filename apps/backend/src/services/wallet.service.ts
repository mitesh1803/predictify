import { db, users, positions } from "../db";
import { eq, sql } from "drizzle-orm";

export class WalletService {
  static async getBalance(userId: string): Promise<number | undefined> {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.address, userId)) // userId is the wallet address
      .limit(1);
    return user[0]?.usdBalance;
  }

  static async getPositions(userId: string) {
    const userPositions = await db
      .select()
      .from(positions)
      .where(eq(positions.userId, userId));
    return userPositions;
  }

  static async onramp(userId: string, amount: number) {
    return await db.transaction(async (tx) => {
      // Drizzle FOR UPDATE lock — query by wallet address, not internal UUID
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.address, userId))
        .for("update");

      if (!user) throw new Error("User not found");

      const amountInCents = Math.round(amount * 100);
      await tx
        .update(users)
        .set({ usdBalance: sql`${users.usdBalance} + ${amountInCents}` })
        .where(eq(users.address, userId));

      return amount;
    });
  }

  static async offramp(userId: string, amount: number) {
    return await db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.address, userId))
        .for("update");

      if (!user) throw new Error("User not found");

      const amountInCents = Math.round(amount * 100);
      if (user.usdBalance < amountInCents) {
        throw new Error("Insufficient USD balance");
      }

      await tx
        .update(users)
        .set({ usdBalance: sql`${users.usdBalance} - ${amountInCents}` })
        .where(eq(users.address, userId));

      return amount;
    });
  }
}
