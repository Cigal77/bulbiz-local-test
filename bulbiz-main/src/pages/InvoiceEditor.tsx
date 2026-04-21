import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInvoice, useInvoiceLines, type Invoice, type InvoiceLine } from "@/hooks/useInvoices";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BulbizLogo } from "@/components/BulbizLogo";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@/hooks/useInvoices";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Save, Send, FileDown, Loader2, CheckCircle2, Link2,
} from "lucide-react";
import { InvoiceOriginBlock, type InvoiceOrigin } from "@/components/invoice-editor/InvoiceOriginBlock";
import { InvoiceClientBlock } from "@/components/invoice-editor/InvoiceClientBlock";
import { InvoiceDocumentBlock } from "@/components/invoice-editor/InvoiceDocumentBlock";
import { InvoiceLinesBlock } from "@/components/invoice-editor/InvoiceLinesBlock";
import { InvoicePaymentBlock } from "@/components/invoice-editor/InvoicePaymentBlock";
import { InvoicePreviewBlock } from "@/components/invoice-editor/InvoicePreviewBlock";
import { QuickActionsBar } from "@/components/quote-editor/QuickActionsBar";
import { PdfPreviewDialog } from "@/components/quote-editor/PdfPreviewDialog";
import { ComplianceChecklist } from "@/components/compliance/ComplianceChecklist";
import { DossierPrefillBanner, type PrefillField } from "@/components/documents/DossierPrefillBanner";
import { DossierContextSummary } from "@/components/documents/DossierContextSummary";
import { useDossier, useDossierMedias } from "@/hooks/useDossier";
import { useIsMobile } from "@/hooks/use-mobile";
import { validateInvoiceForGeneration } from "@/lib/invoice-compliance";
import { useProfile } from "@/hooks/useProfile";

export default function InvoiceEditor() {
  const { id: dossierId, invoiceId } = useParams<{ id: string; invoiceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { profile } = useProfile();

  const { data: invoice, isLoading: invLoading } = useInvoice(invoiceId!);
  const { data: lines = [] } = useInvoiceLines(invoiceId!);
  const { data: dossier } = useDossier(dossierId!);
  const { data: medias = [] } = useDossierMedias(dossierId!);

  const [form, setForm] = useState<Partial<Invoice>>({});
  const [localLines, setLocalLines] = useState<InvoiceLine[]>([]);
  const [origin, setOrigin] = useState<InvoiceOrigin>("standalone");
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  useEffect(() => { if (invoice) setForm(invoice); }, [invoice]);
  useEffect(() => { if (lines.length > 0) setLocalLines(lines); }, [lines]);

  // Prefill depuis dossier si la facture est neuve / champs vides
  useEffect(() => {
    if (!dossier || !invoice) return;
    setForm((prev) => ({
      ...prev,
      client_first_name: prev.client_first_name ?? dossier.client_first_name,
      client_last_name: prev.client_last_name ?? dossier.client_last_name,
      client_email: prev.client_email ?? dossier.client_email,
      client_phone: prev.client_phone ?? dossier.client_phone,
      client_address: prev.client_address ?? dossier.address,
    }));
  }, [dossier, invoice]);

  const refreshFromDossier = () => {
    if (!dossier) return;
    setForm((prev) => ({
      ...prev,
      client_first_name: touchedFields.has("client_first_name") ? prev.client_first_name : dossier.client_first_name,
      client_last_name: touchedFields.has("client_last_name") ? prev.client_last_name : dossier.client_last_name,
      client_email: touchedFields.has("client_email") ? prev.client_email : dossier.client_email,
      client_phone: touchedFields.has("client_phone") ? prev.client_phone : dossier.client_phone,
      client_address: touchedFields.has("client_address") ? prev.client_address : dossier.address,
    }));
    toast({ title: "Données rechargées depuis le dossier" });
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    queryClient.invalidateQueries({ queryKey: ["invoice_lines", invoiceId] });
    queryClient.invalidateQueries({ queryKey: ["invoices", dossierId] });
    queryClient.invalidateQueries({ queryKey: ["historique", dossierId] });
  };

  const computeTotals = useCallback((items: InvoiceLine[], vatMode: string) => {
    let totalHT = 0, totalTVA = 0;
    items.forEach((l) => {
      const ht = l.qty * l.unit_price * (1 - (l.discount || 0) / 100);
      totalHT += ht;
      if (vatMode === "normal") totalTVA += ht * (l.tva_rate / 100);
    });
    return { totalHT, totalTVA, totalTTC: totalHT + totalTVA };
  }, []);

  const totals = computeTotals(localLines, form.vat_mode || "normal");

  // Validation conformité France complète
  const validation = validateInvoiceForGeneration(
    { ...invoice, ...form } as never,
    localLines,
  );

  const patchForm = (patch: Partial<Invoice>) => {
    setTouchedFields((prev) => {
      const next = new Set(prev);
      Object.keys(patch).forEach((k) => next.add(k));
      return next;
    });
    setForm((f) => ({ ...f, ...patch }));
  };

  const prefillFields: PrefillField[] = dossier
    ? [
        {
          key: "client_last_name",
          label: "Nom",
          value: [form.client_first_name, form.client_last_name].filter(Boolean).join(" ") || null,
          modified: touchedFields.has("client_first_name") || touchedFields.has("client_last_name"),
        },
        { key: "client_email", label: "Email", value: form.client_email, modified: touchedFields.has("client_email") },
        { key: "client_phone", label: "Téléphone", value: form.client_phone, modified: touchedFields.has("client_phone") },
        { key: "client_address", label: "Adresse", value: form.client_address, modified: touchedFields.has("client_address") },
      ]
    : [];

  const handleSave = async () => {
    if (!invoice) return;
    setSaving(true);
    try {
      const { error: invErr } = await supabase
        .from("invoices")
        .update({
          issue_date: form.issue_date,
          service_date: form.service_date || null,
          due_date: form.due_date || null,
          client_first_name: form.client_first_name || null,
          client_last_name: form.client_last_name || null,
          client_email: form.client_email || null,
          client_phone: form.client_phone || null,
          client_address: form.client_address || null,
          client_company: form.client_company || null,
          customer_siren: form.customer_siren || null,
          vat_mode: form.vat_mode,
          client_type: form.client_type,
          payment_terms: form.payment_terms || null,
          late_fees_text: form.late_fees_text || null,
          notes: form.notes || null,
          total_ht: totals.totalHT,
          total_tva: totals.totalTVA,
          total_ttc: totals.totalTTC,
        } as never)
        .eq("id", invoiceId);
      if (invErr) throw invErr;

      await supabase.from("invoice_lines").delete().eq("invoice_id", invoiceId);
      if (localLines.length > 0) {
        const linesToInsert = localLines.map((l, idx) => ({
          invoice_id: invoiceId!,
          label: l.label,
          description: l.description || null,
          qty: l.qty,
          unit: l.unit,
          unit_price: l.unit_price,
          tva_rate: l.tva_rate,
          discount: l.discount || 0,
          sort_order: idx,
        }));
        const { error: lineErr } = await supabase.from("invoice_lines").insert(linesToInsert);
        if (lineErr) throw lineErr;
      }
      invalidate();
      toast({ title: "Facture sauvegardée ✅" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!invoice) return;
    setGeneratingPdf(true);
    try {
      await handleSave();
      const { data, error } = await supabase.functions.invoke("generate-invoice-pdf", {
        body: { invoice_id: invoiceId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.pdf_url) {
        setPreviewPdfUrl(data.pdf_url);
        invalidate();
        toast({ title: "PDF généré ✅" });
      } else {
        throw new Error("Aucune URL PDF reçue");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur";
      console.error("[InvoiceEditor] generate-invoice-pdf failed:", e);
      toast({ title: "Erreur PDF", description: msg, variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSend = async () => {
    if (!invoice) return;
    if (!validation.ok) {
      toast({
        title: "Il manque une information obligatoire pour envoyer cette facture",
        description: validation.blockers[0]?.message ?? "Vérifie la checklist de conformité.",
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    try {
      await handleSave();
      const { data, error } = await supabase.functions.invoke("send-invoice", {
        body: { invoice_id: invoiceId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      invalidate();
      toast({ title: "Facture envoyée ✅" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur";
      toast({ title: "Erreur d'envoi", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!invoice) return;
    try {
      await supabase
        .from("invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() } as never)
        .eq("id", invoiceId);
      await supabase.from("historique").insert({
        dossier_id: dossierId!,
        user_id: user!.id,
        action: "invoice_paid",
        details: `Facture ${invoice.invoice_number} marquée comme payée`,
      });
      invalidate();
      toast({ title: "Facture marquée comme payée ✅" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  };

  const handleCopyLink = async () => {
    setGeneratingLink(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-invoice-token", {
        body: { invoice_id: invoiceId },
      });
      if (error) throw error;
      if (data?.token) {
        const url = `${window.location.origin}/facture/view?token=${data.token}`;
        await navigator.clipboard.writeText(url);
        toast({ title: "Lien copié ✅" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setGeneratingLink(false);
    }
  };

  if (invLoading) {
    return (
      <div className="flex-1 bg-background p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-background gap-4">
        <p className="text-lg font-medium">Facture introuvable</p>
        <Button variant="outline" onClick={() => navigate(`/dossier/${dossierId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
      </div>
    );
  }

  const isLocked = invoice.status !== "draft";

  return (
    <div className="flex flex-1 flex-col bg-background min-h-0">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 sm:px-6 py-3 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/dossier/${dossierId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <BulbizLogo size={20} />
          <span className="font-semibold text-foreground ml-2 truncate">{invoice.invoice_number}</span>
          <Badge className={cn("text-[10px] hidden sm:inline-flex", INVOICE_STATUS_COLORS[invoice.status])}>
            {INVOICE_STATUS_LABELS[invoice.status]}
          </Badge>
        </div>
        <div className="hidden md:flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCopyLink} disabled={generatingLink} className="gap-1.5">
            {generatingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Lien client
          </Button>
          <Button size="sm" variant="outline" onClick={handleGeneratePdf} disabled={generatingPdf} className="gap-1.5">
            {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            PDF
          </Button>
          {!isLocked && (
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Enregistrer
            </Button>
          )}
          {invoice.status === "draft" && (
            <Button size="sm" variant="default" onClick={handleSend} disabled={sending} className="gap-1.5">
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Envoyer
            </Button>
          )}
          {invoice.status === "sent" && (
            <Button size="sm" variant="default" onClick={handleMarkPaid} className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Marquer payée
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24 md:pb-4">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
          {/* 0a. Préremplissage depuis dossier */}
          {dossier && (
            <DossierPrefillBanner
              dossierRef={dossier.id}
              fields={prefillFields}
              onRefresh={refreshFromDossier}
            />
          )}

          {/* 0b. Résumé du dossier */}
          {dossier && (
            <DossierContextSummary
              category={dossier.category}
              urgency={dossier.urgency}
              description={dossier.description}
              notes={null}
              updatedAt={dossier.updated_at}
              mediaCount={medias.length}
            />
          )}

          {/* 1. Origine */}
          <InvoiceOriginBlock value={origin} onChange={setOrigin} disabled={isLocked} />

          {/* 2. Infos client */}
          <InvoiceClientBlock form={form} onChange={patchForm} disabled={isLocked} />

          {/* 3. Infos facture */}
          <InvoiceDocumentBlock
            form={form}
            onChange={patchForm}
            invoiceNumber={invoice.invoice_number}
            disabled={isLocked}
          />

          {/* 4. Lignes */}
          <InvoiceLinesBlock
            lines={localLines}
            onChange={setLocalLines}
            disabled={isLocked}
            vatMode={form.vat_mode}
            defaultVatRate={(profile as any)?.default_vat_rate ?? 10}
          />

          {/* 5. Paiement */}
          <InvoicePaymentBlock form={form} onChange={patchForm} disabled={isLocked} />

          {/* 6. Checklist conformité — moteur France complet (numéro, dates, identités, B2B…) */}
          <ComplianceChecklist validation={validation as never} title="Conformité de la facture" />

          {/* 7. Aperçu */}
          <InvoicePreviewBlock
            totalHT={totals.totalHT}
            totalTTC={totals.totalTTC}
            lineCount={localLines.length}
            onPreview={handleGeneratePdf}
            isGenerating={generatingPdf}
          />

          {/* 8. Assistant IA — placeholder */}
          <section className="rounded-xl border border-dashed bg-card/40 p-4 text-center">
            <p className="text-xs text-muted-foreground">
              ✨ Assistant IA — suggestions de lignes, vérifications de conformité (bientôt)
            </p>
          </section>
        </div>
      </main>

      {isMobile && !isLocked && (
        <QuickActionsBar
          isSaving={saving}
          isSending={sending}
          isGeneratingPdf={generatingPdf}
          canSend={localLines.length > 0}
          onPreview={handleGeneratePdf}
          onSend={handleSend}
        />
      )}

      <PdfPreviewDialog
        open={!!previewPdfUrl}
        url={previewPdfUrl}
        title={invoice ? `Facture ${invoice.invoice_number}` : "Aperçu de la facture"}
        onClose={() => setPreviewPdfUrl(null)}
      />
    </div>
  );
}
