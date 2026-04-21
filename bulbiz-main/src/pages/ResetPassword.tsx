import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BulbizLogo } from "@/components/BulbizLogo";
import { Lock, ArrowRight, CheckCircle2 } from "lucide-react";

function getPasswordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 10) score++;
  if (/[a-zA-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (pw.length >= 14) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const strengthLabels = ["", "Faible", "Moyen", "Bon", "Fort"];
const strengthColors = ["", "bg-destructive", "bg-orange-400", "bg-yellow-400", "bg-green-500"];

type PageState = "loading" | "ready" | "error" | "done";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isLongEnough = password.length >= 10;
  const isValid = hasLetter && hasNumber && isLongEnough && password === confirm;
  const strength = getPasswordStrength(password);

  useEffect(() => {
    // Supabase puts tokens in the URL hash after redirect.
    // The JS client auto-detects them via onAuthStateChange.
    // We just need to check if a session exists (PASSWORD_RECOVERY event sets it).
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setPageState("ready");
      } else {
        // Give the client a moment to process the hash tokens
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (event === "PASSWORD_RECOVERY" && session) {
              setPageState("ready");
              subscription.unsubscribe();
            }
          }
        );
        // Timeout: if no session after 3s, show error
        setTimeout(() => {
          setPageState((prev) => (prev === "loading" ? "error" : prev));
          subscription.unsubscribe();
        }, 3000);
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      setPageState("done");
      setTimeout(() => navigate("/auth"), 2500);
    } catch (err: any) {
      setErrorMsg(err.message);
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Loading
  if (pageState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Success
  if (pageState === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Mot de passe mis à jour ✅</h2>
          <p className="text-sm text-muted-foreground">Redirection vers la connexion…</p>
        </div>
      </div>
    );
  }

  // Error / expired link
  if (pageState === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <BulbizLogo size={28} />
          <h2 className="text-2xl font-bold text-foreground">Lien invalide ou expiré</h2>
          <p className="text-sm text-muted-foreground">
            Ce lien de réinitialisation n'est plus valide. Demandez-en un nouveau.
          </p>
          <Button onClick={() => navigate("/auth")} className="w-full">
            Renvoyer un lien
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Ready — show form
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex items-center justify-center">
          <BulbizLogo size={28} />
        </div>

        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold text-foreground">Nouveau mot de passe</h2>
          <p className="text-sm text-muted-foreground">Choisissez un mot de passe sécurisé</p>
        </div>

        {errorMsg && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive font-medium">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
                minLength={10}
              />
            </div>
            {password.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i <= strength ? strengthColors[strength] : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{strengthLabels[strength]}</p>
                <ul className="text-xs space-y-0.5">
                  <li className={isLongEnough ? "text-primary" : "text-muted-foreground"}>
                    {isLongEnough ? "✓" : "○"} 10 caractères minimum
                  </li>
                  <li className={hasLetter ? "text-primary" : "text-muted-foreground"}>
                    {hasLetter ? "✓" : "○"} Au moins 1 lettre
                  </li>
                  <li className={hasNumber ? "text-primary" : "text-muted-foreground"}>
                    {hasNumber ? "✓" : "○"} Au moins 1 chiffre
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="pl-10"
                required
              />
            </div>
            {confirm.length > 0 && password !== confirm && (
              <p className="text-xs text-destructive">Les mots de passe ne correspondent pas</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={!isValid || submitting}>
            {submitting ? "Mise à jour..." : "Mettre à jour"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
