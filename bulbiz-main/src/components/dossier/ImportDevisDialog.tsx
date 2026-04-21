import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ImportDevisDialogProps {
  open: boolean;
  onClose: () => void;
  dossierId: string;
  clientEmail?: string | null;
}

export function ImportDevisDialog({ open, onClose, dossierId, clientEmail }: ImportDevisDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [quoteNumber, setQuoteNumber] = useState("");
  const [totalHt, setTotalHt] = useState("");
  const [totalTtc, setTotalTtc] = useState("");
  const [totalTva, setTotalTva] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  const normalize = (s: string) =>
    s
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .toUpperCase();

  // Pre-fill quote number with DEV-NOM-PRENOM on open
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: dossier } = await supabase
        .from("dossiers")
        .select("client_last_name, client_first_name")
        .eq("id", dossierId)
        .single();
      if (dossier) {
        const parts = [
          "DEV",
          dossier.client_last_name ? normalize(dossier.client_last_name) : null,
          dossier.client_first_name ? normalize(dossier.client_first_name) : null,
        ].filter(Boolean);
        setQuoteNumber(parts.join("-"));
      }
    })();
  }, [open, dossierId]);

  const resetForm = () => {
    setFile(null);
    setQuoteNumber("");
    setTotalHt("");
    setTotalTtc("");
    setTotalTva("");
    setIssueDate(new Date().toISOString().split("T")[0]);
  };


  const handleSubmit = async () => {
    if (!file || !user) return;
    if (file.type !== "application/pdf") {
      toast({ title: "Format invalide", description: "Seuls les PDF sont acceptés.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      let finalNumber = quoteNumber.trim();

      if (!finalNumber) {
        const { data: dossier, error: dossierErr } = await supabase
          .from("dossiers")
          .select("client_last_name, client_first_name")
          .eq("id", dossierId)
          .single();

        if (dossierErr) throw dossierErr;

        const clientName = dossier?.client_last_name || dossier?.client_first_name || null;
        const { data: numData, error: numError } = await supabase.rpc("generate_quote_number", {
          p_user_id: user.id,
          p_client_name: clientName,
        });
        if (numError) throw numError;
        finalNumber = numData as string;
      }

      // Upload PDF
      const filePath = `${dossierId}/devis_${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("dossier-medias")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("dossier-medias").getPublicUrl(filePath);

      // Create quote record as "envoye" (imported = already sent)
      const { data: inserted, error: insertError } = await supabase
        .from("quotes")
        .insert({
          dossier_id: dossierId,
          user_id: user.id,
          quote_number: finalNumber,
          is_imported: true,
          pdf_url: urlData.publicUrl,
          status: "envoye" as const,
          sent_at: new Date().toISOString(),
          total_ht: totalHt ? parseFloat(totalHt) : 0,
          total_tva: totalTva ? parseFloat(totalTva) : 0,
          total_ttc: totalTtc ? parseFloat(totalTtc) : 0,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      const quoteId = inserted.id;

      // Update dossier status → devis_envoye
      await supabase
        .from("dossiers")
        .update({
          status: "devis_envoye",
          status_changed_at: new Date().toISOString(),
          relance_active: true,
        })
        .eq("id", dossierId);

      // Historique
      await supabase.from("historique").insert({
        dossier_id: dossierId,
        user_id: user.id,
        action: "quote_imported",
        details: `Devis ${finalNumber} importé (PDF)}`,
      });

      // Send quote notification to client
      if (clientEmail) {
        try {
          // 1. Récupère la session pour être sûr qu'elle est fraîche
          const { data: { session } } = await supabase.auth.getSession();

          if (!session) {
            throw new Error("Session expirée ou inexistante");
          }
          // 2. Utilise invoke SANS headers personnalisés
          // Le client 'supabase' injecte automatiquement l'Authorization et l'apikey
          const { data, error } = await supabase.functions.invoke("send-quote", {
            body: { quote_id: quoteId },
          });
        } catch (e) {
          console.error("Notification error:", e);
        }
      }

      toast({ title: "Devis importé ✅", description: `N° ${finalNumber} — Statut → Devis envoyé` });
      queryClient.invalidateQueries({ queryKey: ["quotes", dossierId] });
      queryClient.invalidateQueries({ queryKey: ["dossier", dossierId] });
      queryClient.invalidateQueries({ queryKey: ["historique", dossierId] });
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });
      queryClient.invalidateQueries({ queryKey: ["ai-summary"] });
      resetForm();
      onClose();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Importer un devis (PDF)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File upload */}
          <div className="space-y-1.5">
            <Label className="text-xs">Fichier PDF *</Label>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <div
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 w-full h-10 px-4 py-2 text-sm border border-input bg-background rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer overflow-hidden"
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">
                {file ? file.name : "Choisir un fichier PDF"}
              </span>
            </div>
          </div>

          {/* Quote number (optional) */}
          <div className="space-y-1.5">
            <Label className="text-xs">Numéro de devis (facultatif)</Label>
            <Input
              placeholder="Ex: DEV-2026-001"
              value={quoteNumber}
              onChange={(e) => setQuoteNumber(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Issue date */}
          <div className="space-y-1.5">
            <Label className="text-xs">Date d'émission</Label>
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleSubmit}
            disabled={!file || loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importer et envoyer au client
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
