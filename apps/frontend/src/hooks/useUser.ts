import { useEffect, useState } from "react";
import supabase from "../lib/supabaseClient";

export function useUser() {
  const [claims, setClaims] = useState<any | null>(null);
  useEffect(() => {
    // Check for existing session using getClaims
    supabase.auth.getClaims().then(({ data: { claims } }) => {
      setClaims(claims);
    });
    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      supabase.auth.getClaims().then(({ data: { claims } }) => {
        setClaims(claims);
      });
    });
    return () => subscription.unsubscribe();
  }, []);
  return { claims };
}
