import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, Phone, AlertCircle } from "lucide-react";
import { BulbizLogo } from "@/components/BulbizLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

type AuthMode = "login" | "signup" | "reset";

export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  // La condition de blocage : On bloque si on s'inscrit mais que le téléphone est vide
  const isOAuthDisabled = mode === "signup" && !phone;

  // Gestion du retour de Google/Apple pour envoyer le mail avec le numéro stocké
  useEffect(() => {
    const triggerOAuthNotification = async () => {
      const savedPhone = localStorage.getItem("pending_phone_for_notification");

      if (user && savedPhone) {
        try {
          await supabase.functions.invoke("notify-new-signup", {
            body: {
              first_name: user.user_metadata?.full_name || "Utilisateur",
              last_name: "OAuth",
              email: user.email,
              phone: savedPhone,
            },
          });
          localStorage.removeItem("pending_phone_for_notification");
        } catch (err) {
          console.error("Erreur lors de l'envoi du mail de notification:", err);
        }
      }
    };

    if (!loading) triggerOAuthNotification();
  }, [user, loading]);

  const handleGoogleSignIn = async () => {
    if (mode === "signup" && !phone) {
      toast({
        title: "Numéro requis",
        description: "Saisissez votre téléphone avant de continuer avec Google",
        variant: "destructive",
      });
      return;
    }

    if (phone) {
      localStorage.setItem("pending_phone_for_notification", phone);
    }

    setGoogleLoading(true);
    try {
      await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
    } catch (error: any) {
      console.error("[Auth] Google sign in error:", error);
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la connexion Google",
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (mode === "signup" && !phone) {
      toast({
        title: "Numéro requis",
        description: "Saisissez votre téléphone avant de continuer avec Apple",
        variant: "destructive",
      });
      return;
    }

    if (phone) {
      localStorage.setItem("pending_phone_for_notification", phone);
    }

    setAppleLoading(true);
    try {
      await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin + "/auth",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la connexion Apple",
        variant: "destructive",
      });
      setAppleLoading(false);
    }
  };

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { first_name: firstName, last_name: lastName, phone },
          },
        });
        if (error) throw error;

        supabase.functions
          .invoke("notify-new-signup", {
            body: { first_name: firstName, last_name: lastName, email, phone },
          })
          .catch(() => {});

        toast({
          title: "Inscription réussie",
          description: "Vérifiez votre email pour confirmer votre compte.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel - branding (RESTAURÉ) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary p-12">
        <div>
          <div className="flex items-center gap-2">
            <BulbizLogo size={32} />
          </div>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-primary-foreground leading-tight text-balance">
            Toutes vos demandes clients, au même endroit.
          </h1>
          <p className="text-lg text-primary-foreground/80">
            Ne perdez plus aucune demande. Centralisez, suivez et relancez en quelques clics.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-primary-foreground/60">© 2026 Bulbiz. Conçu pour les artisans du BTP.</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-primary-foreground/50">
            <a href="/cgu" className="hover:text-primary-foreground/80 underline">
              CGU
            </a>
            <a href="/mentions-legales" className="hover:text-primary-foreground/80 underline">
              Mentions légales
            </a>
            <a href="/politique-confidentialite" className="hover:text-primary-foreground/80 underline">
              Confidentialité
            </a>
            <a href="/dpa" className="hover:text-primary-foreground/80 underline">
              DPA
            </a>
            <a href="/cookies" className="hover:text-primary-foreground/80 underline">
              Cookies
            </a>
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-12 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex items-center justify-center mb-4">
            <BulbizLogo size={28} />
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-foreground">
              {mode === "signup" ? "Créer un compte" : mode === "reset" ? "Mot de passe oublié" : "Se connecter"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "signup"
                ? "Commencez à centraliser vos demandes"
                : mode === "reset"
                  ? "Recevez un lien pour réinitialiser votre mot de passe"
                  : "Accédez à vos dossiers"}
            </p>
          </div>

          {mode === "reset" ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSubmitting(true);
                try {
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + "/reset-password",
                  });
                  if (error) throw error;
                  toast({
                    title: "Lien envoyé",
                    description: "Vérifiez votre boîte mail.",
                  });
                } catch (error: any) {
                  toast({
                    title: "Erreur",
                    description: error.message,
                    variant: "destructive",
                  });
                } finally {
                  setSubmitting(false);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Envoi..." : "Envoyer le lien"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleEmailPassword} className="space-y-4">
              {mode === "signup" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Prénom</Label>
                      <Input
                        id="firstName"
                        placeholder="Jean"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Nom</Label>
                      <Input
                        id="lastName"
                        placeholder="Dupont"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="06 12 34 56 78"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={`pl-10 ${isOAuthDisabled ? "border-orange-400 ring-orange-100" : ""}`}
                        required
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              {mode === "login" && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setMode("reset")}
                    className="text-xs text-muted-foreground hover:text-primary hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Chargement..." : mode === "signup" ? "Créer mon compte" : "Se connecter"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          )}

          {mode !== "reset" && (
            <>
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading || isOAuthDisabled}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  {googleLoading ? "Connexion..." : "Continuer avec Google"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleAppleSignIn}
                  disabled={appleLoading || isOAuthDisabled}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                  {appleLoading ? "Connexion..." : "Continuer avec Apple"}
                </Button>

                {isOAuthDisabled && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    <p className="text-[12px] text-destructive font-medium leading-tight">
                      Veuillez renseigner votre téléphone pour activer l'inscription via Google ou Apple.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="space-y-3 pt-2">
            <p className="text-center text-sm text-muted-foreground">
              {mode === "signup" ? (
                <>
                  Déjà un compte ?{" "}
                  <button onClick={() => setMode("login")} className="text-primary hover:underline font-medium">
                    Se connecter
                  </button>
                </>
              ) : (
                <>
                  Pas encore de compte ?{" "}
                  <button onClick={() => setMode("signup")} className="text-primary hover:underline font-medium">
                    S'inscrire
                  </button>
                </>
              )}
            </p>
          </div>

          {/* Legal links mobile (RESTAURÉ) */}
          <div className="lg:hidden flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-2">
            <a href="/cgu" className="hover:text-foreground underline">
              CGU
            </a>
            <a href="/mentions-legales" className="hover:text-foreground underline">
              Mentions légales
            </a>
            <a href="/politique-confidentialite" className="hover:text-foreground underline">
              Confidentialité
            </a>
            <a href="/dpa" className="hover:text-foreground underline">
              DPA
            </a>
            <a href="/cookies" className="hover:text-foreground underline">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
