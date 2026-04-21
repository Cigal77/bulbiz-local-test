import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Loader2, Unlink, Link } from "lucide-react";
import { useSearchParams } from "react-router-dom";

export function GoogleCalendarCard() {
  const [connected, setConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const checkStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar", {
        body: { action: "status" },
      });
      if (error) throw error;
      setConnected(data.connected);
      setGoogleEmail(data.google_email);
    } catch (e) {
      console.error("Calendar status check error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCallback = useCallback(
    async (code: string) => {
      setActionLoading(true);
      try {
        const redirectUri = `${window.location.origin}/parametres`;
        const { data, error } = await supabase.functions.invoke("google-calendar", {
          body: { action: "callback", code, redirect_uri: redirectUri },
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        setConnected(true);
        setGoogleEmail(data.google_email);
        toast.success(`Google Calendar connecté : ${data.google_email}`);
      } catch (e: any) {
        const msg = e.message || "Erreur inconnue";
        const isConfig =
          msg.includes("URI") ||
          msg.includes("redirect") ||
          msg.includes("invalid_grant") ||
          msg.includes("Google Cloud");
        toast.error(
          isConfig
            ? "Configuration Google Cloud incomplète. Vérifiez les URIs de redirection autorisées."
            : `Erreur : ${msg}`,
          { duration: 8000 },
        );
      } finally {
        setActionLoading(false);
        searchParams.delete("code");
        searchParams.delete("scope");
        searchParams.delete("state");
        setSearchParams(searchParams, { replace: true });
      }
    },
    [searchParams, setSearchParams],
  );

  const callbackCalledRef = useRef(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (code && state === "google_calendar") {
      if (callbackCalledRef.current) return; // ← guard
      callbackCalledRef.current = true;
      handleCallback(code);
    } else {
      checkStatus();
    }
  }, []); // eslint-disable-line

  const handleConnect = async () => {
    setActionLoading(true);
    try {
      const redirectUri = `${window.location.origin}/parametres`;
      const { data, error } = await supabase.functions.invoke("google-calendar", {
        body: { action: "authorize", redirect_uri: redirectUri },
      });
      if (error) throw error;
      if (data.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase.functions.invoke("google-calendar", {
        body: { action: "disconnect" },
      });
      if (error) throw error;
      setConnected(false);
      setGoogleEmail(null);
      toast.success("Google Calendar déconnecté");
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base">Google Calendar</CardTitle>
              <CardDescription>Synchroniser les RDV automatiquement</CardDescription>
            </div>
          </div>
          {connected && (
            <Badge variant="outline" className="bg-success/10 text-success border-success/30">
              Connecté
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {connected ? (
          <>
            <p className="text-sm text-muted-foreground">
              Connecté à <span className="font-medium text-foreground">{googleEmail}</span>. Les nouveaux RDV confirmés
              seront ajoutés automatiquement à votre agenda.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={actionLoading}
              className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
              Déconnecter
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connectez votre Google Calendar pour que chaque RDV confirmé soit automatiquement ajouté à votre agenda.
              Vous pouvez aussi télécharger un fichier .ics depuis chaque dossier.
            </p>
            <Button onClick={handleConnect} disabled={actionLoading} className="gap-2">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}
              Connecter Google Calendar
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
