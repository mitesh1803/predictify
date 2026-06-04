import { useEffect, useState } from "react";
import supabase from "../lib/supabaseClient";

export function useUser() {
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    // Check for existing session using getSession (getClaims() does not exist in Supabase JS v2)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Expose `user` directly; keep `claims` as an alias for backward compatibility
  const claims = user?.user_metadata ?? null;
  return { user, claims };
}
