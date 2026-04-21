import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Unplug, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { useRef } from "react";

export function GmailConnectionCard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [gmailAddress, setGmailAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("gmail-oauth", {
        body: { action: "status" },
      });
      if (error) throw error;
      setConnected(data.connected);
      setGmailAddress(data.gmail_address);
    } catch (e) {
      console.error("Gmail status check failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle OAuth callback
  const callbackCalledRef = useRef(false);
  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const isGmailCallback = state === "gmail" || (searchParams.get("scope") || "").includes("gmail.send");
    if (code && isGmailCallback && !callbackCalledRef.current) {
      callbackCalledRef.current = true;
      handleCallback(code);
    }
  }, [searchParams]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleCallback = async (code: string) => {
    setActionLoading(true);
    try {
      const redirectUri = `${window.location.origin}/parametres`;
      const { data, error } = await supabase.functions.invoke("gmail-oauth", {
        body: { action: "callback", code, redirect_uri: redirectUri },
      });
      if (error) throw error;
      setConnected(true);
      setGmailAddress(data.gmail_address);
      toast.success(`Gmail connecté : ${data.gmail_address}`);
      // Clean URL
      setSearchParams({});
    } catch (e: any) {
      console.error("Gmail callback error:", e);
      toast.error("Erreur lors de la connexion Gmail");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConnect = async () => {
    setActionLoading(true);
    try {
      const redirectUri = `${window.location.origin}/parametres`;
      const { data, error } = await supabase.functions.invoke("gmail-oauth", {
        body: { action: "authorize", redirect_uri: redirectUri, state: "gmail" }, // ← ajouter state
      });
      if (error) throw error;
      window.location.href = data.auth_url;
    } catch (e: any) {
      toast.error("Erreur lors de l'autorisation Gmail");
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase.functions.invoke("gmail-oauth", {
        body: { action: "disconnect" },
      });
      if (error) throw error;
      setConnected(false);
      setGmailAddress(null);
      toast.success("Gmail déconnecté");
    } catch (e: any) {
      console.error("Gmail disconnect error:", e);
      toast.error("Erreur lors de la déconnexion");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connexion Gmail</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Chargement…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Connexion Gmail
        </CardTitle>
        <CardDescription>
          {connected
            ? "Les emails seront envoyés depuis votre adresse Gmail personnelle"
            : "Connectez votre Gmail pour envoyer les emails depuis votre propre adresse"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {connected ? (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <Mail className="h-3 w-3" />
                {gmailAddress}
              </Badge>
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Connecté</Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={actionLoading}
              className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
              Déconnecter
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sans connexion Gmail, les emails sont envoyés depuis{" "}
              <span className="font-medium">noreply@bulbiz.fr</span>.
            </p>
            <Button onClick={handleConnect} disabled={actionLoading} className="gap-2">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Connecter mon Gmail
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
