import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AiQuoteDraftPanel } from "@/components/quote-editor/AiQuoteDraftPanel";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { QuoteItem } from "@/lib/quote-types";
import { Loader2, FileCheck2 } from "lucide-react";
import type { Dossier } from "@/hooks/useDossier";

interface AiPreQuoteDialogProps {
  open: boolean;
  onClose: () => void;
  dossier: Dossier;
}

export function AiPreQuoteDialog({ open, onClose, dossier }: AiPreQuoteDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [stagedItems, setStagedItems] = useState<Omit<QuoteItem, "id">[]>([]);
  const [creating, setCreating] = useState(false);

  const addItem = (item: Omit<QuoteItem, "id">) => {
    setStagedItems((prev) => [...prev, item]);
  };

  const addItems = (items: Omit<QuoteItem, "id">[]) => {
    setStagedItems((prev) => [...prev, ...items]);
  };

  const removeAiLine = (aiRef: string) => {
    setStagedItems((prev) => prev.filter((i) => i.ai_ref !== aiRef));
  };

  const removeAllAi = () => {
    setStagedItems((prev) => prev.filter((i) => !i.ai_ref));
  };

  const presentAiRefs = stagedItems
    .map((i) => i.ai_ref)
    .filter((r): r is string => !!r);

  const handleCreateQuote = async () => {
    if (!user) return;
    if (stagedItems.length === 0) {
      toast({
        title: "Aucune ligne acceptée",
        description: "Accepte au moins une ligne du pré-devis.",
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    try {
      const clientName = dossier.client_last_name || dossier.client_first_name || null;
      const { data: numData, error: numError } = await supabase.rpc("generate_quote_number", {
        p_user_id: user.id,
        p_client_name: clientName,
      });
      if (numError) throw numError;

      // Compute totals
      const totals = stagedItems.reduce(
        (acc, it) => {
          const ht = (it.qty || 0) * (it.unit_price || 0) * (1 - (it.discount || 0) / 100);
          const tva = ht * ((it.vat_rate || 0) / 100);
          acc.total_ht += ht;
          acc.total_tva += tva;
          return acc;
        },
        { total_ht: 0, total_tva: 0 },
      );
      const total_ttc = totals.total_ht + totals.total_tva;

      const itemsPayload = stagedItems.map((it, idx) => ({
        id: `line-${Date.now()}-${idx}`,
        ...it,
      }));

      const { data: quote, error: insErr } = await supabase
        .from("quotes")
        .insert({
          dossier_id: dossier.id,
          user_id: user.id,
          quote_number: numData as string,
          status: "brouillon" as const,
          items: itemsPayload as never,
          total_ht: Number(totals.total_ht.toFixed(2)),
          total_tva: Number(totals.total_tva.toFixed(2)),
          total_ttc: Number(total_ttc.toFixed(2)),
        } as never)
        .select("id, quote_number")
        .single();
      if (insErr) throw insErr;

      await supabase.from("historique").insert({
        dossier_id: dossier.id,
        user_id: user.id,
        action: "quote_created_ai",
        details: `Pré-devis IA créé : ${(quote as any).quote_number}`,
      });

      toast({
        title: "Pré-devis créé",
        description: `${(quote as any).quote_number} — vérifie et ajuste avant envoi.`,
      });
      setStagedItems([]);
      onClose();
      navigate(`/dossier/${dossier.id}/devis?quote=${(quote as any).id}`);
    } catch (err: any) {
      toast({
        title: "Erreur création devis",
        description: err.message || "Impossible de créer le devis.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pré-devis IA</DialogTitle>
          <DialogDescription>
            L'IA analyse l'ensemble du dossier (notes vocales, photos, notes écrites, infos client) pour proposer un devis prêt à ajuster.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-[60vh] overflow-hidden">
          <AiQuoteDraftPanel
            dossierId={dossier.id}
            autoGenerate
            onAddItem={addItem}
            onAddItems={addItems}
            onRemoveAiLine={removeAiLine}
            onRemoveAllAi={removeAllAi}
            presentAiRefs={presentAiRefs}
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            {stagedItems.length === 0
              ? "Aucune ligne acceptée"
              : `${stagedItems.length} ligne${stagedItems.length > 1 ? "s" : ""} prête${stagedItems.length > 1 ? "s" : ""} à créer`}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={creating}>
              Annuler
            </Button>
            <Button onClick={handleCreateQuote} disabled={creating || stagedItems.length === 0} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
              Créer le devis
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}