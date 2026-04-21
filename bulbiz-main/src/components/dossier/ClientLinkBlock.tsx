import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { Dossier } from "@/hooks/useDossier";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Link2, Copy, Check, Send, RefreshCw, Loader2, AlertTriangle,
} from "lucide-react";

interface ClientLinkBlockProps {
  dossier: Dossier;
}

export function ClientLinkBlock({ dossier }: ClientLinkBlockProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const token = dossier.client_token;
  const expiresAt = dossier.client_token_expires_at;
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
  const hasToken = !!token && !isExpired;
  const clientLink = token ? `${window.location.origin}/client?token=${token}` : null;

  const handleGenerateAndSend = async (forceRegenerate = false) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-client-link", {
        body: { dossier_id: dossier.id, force_regenerate: forceRegenerate },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      queryClient.invalidateQueries({ queryKey: ["dossier", dossier.id] });
      queryClient.invalidateQueries({ queryKey: ["historique", dossier.id] });

      // Build confirmation toast
      const parts: string[] = [];
      if (data.token_generated) parts.push("Lien généré ✅");
      if (data.email_sent) parts.push("Envoyé par email ✅");
      if (data.no_contact) parts.push("Coordonnées manquantes ⚠️");
      if (data.email_error) parts.push(`Erreur email : ${data.email_error}`);

      toast({
        title: forceRegenerate ? "Nouveau lien généré" : "Lien client",
        description: parts.join(" • ") || "Lien prêt",
      });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!clientLink) return;
    navigator.clipboard.writeText(clientLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Lien copié !" });
  };

  // Status badge
  const statusBadge = () => {
    if (!token) return <Badge variant="secondary" className="text-[10px]">Non généré</Badge>;
    if (isExpired) return <Badge variant="destructive" className="text-[10px]">Expiré</Badge>;
    return <Badge variant="secondary" className="text-[10px] bg-success/15 text-success">Actif</Badge>;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          Lien client
        </h3>
        {statusBadge()}
      </div>

      {/* Expiration info */}
      {hasToken && expiresAt && (
        <p className="text-[11px] text-muted-foreground">
          Expire le {format(new Date(expiresAt), "d MMMM yyyy", { locale: fr })}
        </p>
      )}

      {/* No contact warning */}
      {!dossier.client_email && !dossier.client_phone && (
        <div className="flex items-center gap-2 rounded-md bg-warning/10 border border-warning/20 p-2">
          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
          <p className="text-[11px] text-warning">Coordonnées manquantes : l'envoi automatique est impossible</p>
        </div>
      )}

      {/* Link display + copy */}
      {hasToken && clientLink && (
        <div className="flex gap-1">
          <input
            readOnly
            value={clientLink}
            className="flex-1 text-xs bg-muted rounded px-2 py-1.5 border border-border truncate"
          />
          <Button variant="outline" size="icon" className="shrink-0 h-8 w-8" onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {!hasToken ? (
          <Button
            variant="default"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => { if (!loading) handleGenerateAndSend(false); }}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Générer et envoyer le lien
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => handleGenerateAndSend(false)}
              disabled={loading || !dossier.client_email}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Renvoyer le lien
            </Button>
            {isExpired && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => handleGenerateAndSend(true)}
                disabled={loading}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Générer un nouveau lien
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
