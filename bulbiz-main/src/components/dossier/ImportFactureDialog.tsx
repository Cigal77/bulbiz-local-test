import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ImportFactureDialogProps {
  open: boolean;
  onClose: () => void;
  dossierId: string;
  clientEmail?: string | null;
}

export function ImportFactureDialog({ open, onClose, dossierId, clientEmail }: ImportFactureDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [totalTtc, setTotalTtc] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);

  const normalize = (s: string) =>
    s
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .toUpperCase();

  // Pre-fill invoice number with FAC-NOM-PRENOM on open
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
          "FAC",
          dossier.client_last_name ? normalize(dossier.client_last_name) : null,
          dossier.client_first_name ? normalize(dossier.client_first_name) : null,
        ].filter(Boolean);
        if (parts.length > 1) {
          setInvoiceNumber(parts.join("-"));
        }
      }
    })();
  }, [open, dossierId]);

  const resetForm = () => {
    setFile(null);
    setInvoiceNumber("");
    setTotalTtc("");
    setIssueDate(new Date().toISOString().split("T")[0]);
    setDueDate("");
  };

  const handleSubmit = async () => {
    if (!file || !user) return;
    if (file.type !== "application/pdf") {
      toast({ title: "Format invalide", description: "Seuls les PDF sont acceptés.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      let finalNumber = invoiceNumber.trim();

      if (!finalNumber) {
        const { data: dossierData, error: dossierErr } = await supabase
          .from("dossiers")
          .select("client_last_name, client_first_name")
          .eq("id", dossierId)
          .single();

        if (dossierErr) throw dossierErr;

        const clientName = dossierData?.client_last_name || dossierData?.client_first_name || null;
        const { data: numData, error: numError } = await supabase.rpc("generate_invoice_number", {
          p_user_id: user.id,
          p_client_name: clientName,
        });
        if (numError) throw numError;
        finalNumber = numData as string;
      }

      // Upload PDF
      const filePath = `${dossierId}/facture_${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("dossier-medias")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("dossier-medias").getPublicUrl(filePath);

      // Get dossier + profile info
      const { data: dossier, error: dErr } = await supabase
        .from("dossiers")
        .select("*")
        .eq("id", dossierId)
        .single();
      if (dErr) throw dErr;

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (pErr) throw pErr;

      // Create invoice record (✅ on récupère invoice.id)
      const { data: invoice, error: insertError } = await supabase
        .from("invoices")
        .insert({
          dossier_id: dossierId,
          user_id: user.id,
          invoice_number: finalNumber,

          // ✅ pas "sent" ici, c’est send-invoice qui le fait
          status: "draft" as const,
          sent_at: null,

          issue_date: issueDate,
          pdf_url: urlData.publicUrl,
          total_ttc: totalTtc ? parseFloat(totalTtc) : 0,

          client_first_name: dossier?.client_first_name || null,
          client_last_name: dossier?.client_last_name || null,
          client_email: dossier?.client_email || null,
          client_phone: dossier?.client_phone || null,
          client_address:
            [dossier?.address_line, dossier?.postal_code, dossier?.city].filter(Boolean).join(", ") ||
            dossier?.address ||
            null,

          artisan_name: profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") : null,
          artisan_company: profile?.company_name || null,
          artisan_address: profile?.address || null,
          artisan_phone: profile?.phone || null,
          artisan_email: profile?.email || null,
          artisan_siret: profile?.siret || null,
          artisan_tva_intracom: (profile as any)?.tva_intracom || null,
          payment_terms: (profile as any)?.payment_terms_default || null,
        } as any)
        .select()
        .single();
      if (insertError) throw insertError;

      // ✅ Envoi immédiat (payload correct)
      const { error: sendErr } = await supabase.functions.invoke("send-invoice", {
        body: { invoice_id: invoice.id },
      });
      if (sendErr) throw sendErr;

      // Update dossier status → invoice_pending
      await supabase
        .from("dossiers")
        .update({
          status: "invoice_pending",
          status_changed_at: new Date().toISOString(),
          relance_active: true,
        })
        .eq("id", dossierId);

      // Historique
      await supabase.from("historique").insert({
        dossier_id: dossierId,
        user_id: user.id,
        action: "invoice_imported",
        details: `Facture ${finalNumber} importée (PDF)}`,
      });

      toast({ title: "Facture importée ✅", description: `N° ${finalNumber} — Statut → Facture en attente` });
      queryClient.invalidateQueries({ queryKey: ["invoices", dossierId] });
      queryClient.invalidateQueries({ queryKey: ["dossier", dossierId] });
      queryClient.invalidateQueries({ queryKey: ["historique", dossierId] });
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });
      resetForm();
      onClose();
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("invoices_invoice_number_user_id_key") || msg.includes("duplicate key")) {
        toast({
          title: "Numéro de facture déjà utilisé",
          description: `Le numéro "${invoiceNumber.trim() || "auto-généré"}" existe déjà. Modifiez-le ou laissez le champ vide pour en générer un automatiquement.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Importer une facture (PDF)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File upload */}
          <div className="space-y-1.5">
            <Label className="text-xs">Fichier PDF *</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
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
          {/* Invoice number */}
          <div className="space-y-1.5">
            <Label className="text-xs">Numéro de facture</Label>
            <Input
              placeholder="Ex: FAC-2026-001"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Date d'échéance (optionnel)</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
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
