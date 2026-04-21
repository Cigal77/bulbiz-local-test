import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up the auth state change listener FIRST
    console.log("[useAuth] mount - URL:", window.location.href);
    console.log("[useAuth] hash:", window.location.hash);
    console.log("[useAuth] search:", window.location.search);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[useAuth] onAuthStateChange:", event, "session:", !!session, "user:", session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") {
        window.location.href = "/reset-password";
      }
    });

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[useAuth] getSession:", "session:", !!session, "user:", session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      // Only set loading to false if there's no hash with tokens being processed
      // The hash tokens will be handled by onAuthStateChange
      const hash = window.location.hash;
      const hasOAuthTokens = hash && (hash.includes("access_token") || hash.includes("refresh_token"));
      if (!hasOAuthTokens || session) {
        setLoading(false);
      }
      // If we have OAuth tokens in hash but no session yet, wait for onAuthStateChange
      // Set a timeout as a fallback to avoid infinite loading
      if (hasOAuthTokens && !session) {
        console.log("[useAuth] OAuth tokens detected in URL hash, waiting for session...");
        setTimeout(() => setLoading(false), 5000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
}
