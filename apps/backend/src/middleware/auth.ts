import { createClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";
console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SECRET_KEY as string,
);

export async function middleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Support both "Bearer <token>" and raw token formats
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    const address = user?.user_metadata?.custom_claims?.address;
    if (address) {
      // Store wallet address — services must query by users.address, not users.id
      req.userId = address;
      next();
    } else {
      res.status(403).json({ message: "Incorrect credential" });
    }
  } catch (e) {
    return res.status(403).json({ message: "Incorrect credential" });
  }
}
