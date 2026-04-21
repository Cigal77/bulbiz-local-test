import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);

      // Handle hash-based tokens (implicit flow)
      if (hash && (hash.includes("access_token") || hash.includes("refresh_token"))) {
        // Supabase client auto-detects hash tokens via onAuthStateChange
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate("/", { replace: true });
          return;
        }
        // Wait briefly for onAuthStateChange to process
        setTimeout(async () => {
          const { data: { session: s } } = await supabase.auth.getSession();
          navigate(s ? "/" : "/auth", { replace: true });
        }, 2000);
        return;
      }

      // Handle code-based flow
      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        navigate(error ? "/auth" : "/", { replace: true });
        return;
      }

      // No tokens/code found, redirect to auth
      navigate("/auth", { replace: true });
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
