import { createClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SECRET_KEY as string,
);

export async function middleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.headers.authorization;
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    const address = user?.user_metadata?.custom_claims?.address;
    if (address) {
      req.userId = address;
      next();
    } else {
      res.status(403).json({ message: "Incorrect credential" });
    }
  } catch (e) {
    return res.status(403).json({ message: "Incorrect credential" });
  }
}
