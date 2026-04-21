import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type InvoiceStatus = "draft" | "sent" | "paid";

export interface Invoice {
  id: string;
  dossier_id: string;
  user_id: string;
  invoice_number: string;
  status: InvoiceStatus;

  issue_date: string;
  service_date: string | null;

  client_first_name: string | null;
  client_last_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  client_company: string | null;

  artisan_name: string | null;
  artisan_company: string | null;
  artisan_address: string | null;
  artisan_phone: string | null;
  artisan_email: string | null;
  artisan_siret: string | null;
  artisan_tva_intracom: string | null;

  vat_mode: "normal" | "no_vat_293b";
  client_type: "individual" | "business";

  total_ht: number;
  total_tva: number;
  total_ttc: number;

  payment_terms: string | null;
  late_fees_text: string | null;
  notes: string | null;

  pdf_url: string | null;
  sent_at: string | null;
  paid_at: string | null;

  due_date: string | null;
  customer_siren: string | null;

  created_at: string;
  updated_at: string;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  label: string;
  description: string | null;
  qty: number;
  unit: string;
  unit_price: number;
  tva_rate: number;
  discount: number;
  discount_unit?: "PERCENT" | "EUR";
  sort_order: number;
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  paid: "bg-success/15 text-success",
};

export function useInvoices(dossierId: string) {
  return useQuery({
    queryKey: ["invoices", dossierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("dossier_id", dossierId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Invoice[];
    },
    enabled: !!dossierId,

    // ✅ évite le "flash" vide pendant invalidate/refetch
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  });
}

export function useInvoice(invoiceId: string) {
  return useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Invoice | null;
    },
    enabled: !!invoiceId,
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  });
}

export function useInvoiceLines(invoiceId: string) {
  return useQuery({
    queryKey: ["invoice_lines", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_lines")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as unknown as InvoiceLine[];
    },
    enabled: !!invoiceId,
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  });
}

export function useInvoiceActions(dossierId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["invoices", dossierId] });
    queryClient.invalidateQueries({ queryKey: ["dossier-historique", dossierId] });
  };

  const importPdf = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Non authentifié");

      // Génère le numéro
      //const { data: numData, error: numError } = await supabase.rpc("generate_invoice_number", {
      //  p_user_id: user.id,
      //});
      //if (numError) throw numError;

      // Récupère dossier (pour infos client)
      const { data: dossier, error: dErr } = await supabase
        .from("dossiers")
        .select("*")
        .eq("id", dossierId)
        .single();
      if (dErr) throw dErr;

      // Récupère profile (pour infos artisan)
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (pErr) throw pErr;

      const clientName = dossier?.client_last_name || dossier?.client_first_name || null;
      const { data: numData, error: numError } = await supabase.rpc("generate_invoice_number", {
        p_user_id: user.id,
        p_client_name: clientName,
      });
      if (numError) throw numError;
      const invoiceNumber = numData as string;

      // Upload PDF (même bucket que devis)
      const filePath = `${dossierId}/facture_${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("dossier-medias")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("dossier-medias").getPublicUrl(filePath);

      // Crée la facture
      const { data: invoice, error: insertError } = await supabase
      .from("invoices")
      .insert({
        dossier_id: dossierId,
        user_id: user.id,
        invoice_number: invoiceNumber as string,
        pdf_url: urlData.publicUrl,
        status: "draft" as InvoiceStatus,
        issue_date: new Date().toISOString().split("T")[0],

        // ✅ Client (copié du dossier)
        client_first_name: dossier?.client_first_name || null,
        client_last_name: dossier?.client_last_name || null,
        client_email: dossier?.client_email || null,
        client_phone: dossier?.client_phone || null,
        client_company: (dossier as any)?.client_company || null,
        client_address:
          [dossier?.address_line, dossier?.postal_code, dossier?.city].filter(Boolean).join(", ") ||
          dossier?.address ||
          null,

        // ✅ Artisan (copié du profil)
        artisan_name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || null,
        artisan_company: profile?.company_name || null,
        artisan_address: profile?.address || null,
        artisan_phone: profile?.phone || null,
        artisan_email: profile?.email || null,
        artisan_siret: profile?.siret || null,
        artisan_tva_intracom: (profile as any)?.tva_intracom || null,

        // ✅ TVA / paramètres
        vat_mode: (profile as any)?.vat_applicable === false ? "no_vat_293b" : "normal",
        payment_terms: (profile as any)?.payment_terms_default || null,
      } as any)
      .select()
      .single();

      if (insertError) throw insertError;
      const { error: sendErr } = await supabase.functions.invoke("send-invoice", {
        body: { invoice_id: invoice.id },
      });
      if (sendErr) throw sendErr;

      await supabase.from("historique").insert({
        dossier_id: dossierId,
        user_id: user.id,
        action: "invoice_imported",
        details: `Facture ${invoiceNumber} importée (PDF)`,
      });

      return invoice as unknown as Invoice;
    },
    onSuccess: invalidate,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ invoiceId, status }: { invoiceId: string; status: InvoiceStatus }) => {
      if (!user) throw new Error("Non authentifié");

      const updates: Record<string, unknown> = { status };

      if (status === "sent") updates.sent_at = new Date().toISOString();
      if (status === "paid") updates.paid_at = new Date().toISOString();

      const { error } = await supabase.from("invoices").update(updates).eq("id", invoiceId);
      if (error) throw error;

      // Sync dossier status (comme ton ancien code)
      if (status === "sent") {
        await supabase
          .from("dossiers")
          .update({ status: "invoice_pending", status_changed_at: new Date().toISOString() })
          .eq("id", dossierId);
      }
      if (status === "paid") {
        await supabase
          .from("dossiers")
          .update({ status: "invoice_paid", status_changed_at: new Date().toISOString() })
          .eq("id", dossierId);
      }

      await supabase.from("historique").insert({
        dossier_id: dossierId,
        user_id: user.id,
        action: "invoice_status_change",
        details: `Facture passée à "${INVOICE_STATUS_LABELS[status]}"`,
      });
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["dossier"] });
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      if (!user) throw new Error("Non authentifié");

      // Si pas de cascade FK, on supprime les lignes d’abord
      await supabase.from("invoice_lines").delete().eq("invoice_id", invoiceId);

      const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
      if (error) throw error;

      await supabase.from("historique").insert({
        dossier_id: dossierId,
        user_id: user.id,
        action: "invoice_deleted",
        details: "Facture supprimée",
      });
    },
    onSuccess: invalidate,
  });

  // ✅ Envoi (edge function send-invoice)
  const sendInvoice = useMutation({
    mutationFn: async ({ invoiceId }: { invoiceId: string }) => {
      if (!user) throw new Error("Non authentifié");

      const { error } = await supabase.functions.invoke("send-invoice", {
        body: { invoice_id: invoiceId },
      });
      if (error) throw error;

      // pas besoin de log ici : ta function log déjà dans historique
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["dossier"] });
    },
  });

  return { importPdf, updateStatus, deleteInvoice, sendInvoice };
}
