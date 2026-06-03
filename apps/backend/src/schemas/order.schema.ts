import z from "zod";

export const CreateOrderSchema = z.object({
  marketId: z.string(),
  side: z.enum(["yes", "no"]),
  type: z.enum(["buy", "sell"]),
  price: z.number().int(), // 10 => 0.10$ 
  qty: z.number().int(), // 10 => 10qty
});

export const SplitSchema = z.object({
  marketId: z.string(),
  amount: z.number(), // 1 => 1
});

export const OnrampSchema = z.object({
  amount: z.number(), // amount in USD (e.g., 100.50)
});

export const OfframpSchema = z.object({
  amount: z.number(), // amount in USD (e.g., 100.50)
});
