import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type QuoteStatus = "brouillon" | "envoye" | "signe" | "refuse";

export interface Quote {
  id: string;
  dossier_id: string;
  user_id: string;
  quote_number: string;
  status: QuoteStatus;
  pdf_url: string | null;
  is_imported: boolean;
  items: unknown[];
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  notes: string | null;
  validity_days: number;
  sent_at: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  signe: "Signé",
  refuse: "Refusé",
};

const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoye: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  signe: "bg-success/15 text-success",
  refuse: "bg-destructive/15 text-destructive",
};

export { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS };

export function useQuotes(dossierId: string) {
  return useQuery({
    queryKey: ["quotes", dossierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("dossier_id", dossierId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Quote[];
    },
    enabled: !!dossierId,
  });
}

export function useQuoteActions(dossierId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["quotes", dossierId] });
    queryClient.invalidateQueries({ queryKey: ["dossier-historique", dossierId] });
    queryClient.invalidateQueries({ queryKey: ["ai-summary"] });
  };

  const importPdf = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Non authentifié");

      // Generate quote number
      const { data: numData, error: numError } = await supabase.rpc("generate_quote_number", {
        p_user_id: user.id,
      });
      if (numError) throw numError;

      // Upload PDF
      const filePath = `${dossierId}/devis_${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("dossier-medias")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("dossier-medias").getPublicUrl(filePath);

      // Create quote record
      const { data: quote, error: insertError } = await supabase
        .from("quotes")
        .insert({
          dossier_id: dossierId,
          user_id: user.id,
          quote_number: numData as string,
          is_imported: true,
          pdf_url: urlData.publicUrl,
          status: "brouillon" as QuoteStatus,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      // Log historique
      await supabase.from("historique").insert({
        dossier_id: dossierId,
        user_id: user.id,
        action: "quote_imported",
        details: `Devis ${numData} importé (PDF)`,
      });

      return quote;
    },
    onSuccess: invalidate,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ quoteId, status }: { quoteId: string; status: QuoteStatus }) => {
      if (!user) throw new Error("Non authentifié");

      const updates: Record<string, unknown> = { status };
      if (status === "envoye") updates.sent_at = new Date().toISOString();
      if (status === "signe") updates.signed_at = new Date().toISOString();

      const { error } = await supabase
        .from("quotes")
        .update(updates)
        .eq("id", quoteId);
      if (error) throw error;

      // Update dossier status if quote is sent
      if (status === "envoye") {
        await supabase
          .from("dossiers")
          .update({ status: "devis_envoye", status_changed_at: new Date().toISOString() })
          .eq("id", dossierId);
      }
      if (status === "signe") {
        await supabase
          .from("dossiers")
          .update({
            status: "clos_signe",
            status_changed_at: new Date().toISOString(),
            appointment_status: "rdv_pending" as const,
          })
          .eq("id", dossierId);

        await supabase.from("historique").insert({
          dossier_id: dossierId,
          user_id: user!.id,
          action: "appointment_status_change",
          details: "Prise de rendez-vous en attente",
        });
      }
      if (status === "refuse") {
        await supabase
          .from("dossiers")
          .update({ status: "clos_perdu", status_changed_at: new Date().toISOString() })
          .eq("id", dossierId);
      }

      await supabase.from("historique").insert({
        dossier_id: dossierId,
        user_id: user.id,
        action: "quote_status_change",
        details: `Devis passé à "${QUOTE_STATUS_LABELS[status]}"`,
      });
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["dossier"] });
    },
  });

  const deleteQuote = useMutation({
    mutationFn: async (quoteId: string) => {
      if (!user) throw new Error("Non authentifié");
      const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
      if (error) throw error;

      await supabase.from("historique").insert({
        dossier_id: dossierId,
        user_id: user.id,
        action: "quote_deleted",
        details: "Devis supprimé",
      });
    },
    onSuccess: invalidate,
  });

  /**
   * Transforme un devis en facture brouillon — 1 clic.
   * Reprend client, lignes, totaux, mentions. Facture reste 100% modifiable.
   * Retourne l'ID de la nouvelle facture pour redirection.
   */
  const transformToInvoice = useMutation({
    mutationFn: async (quoteId: string): Promise<{ invoiceId: string; invoiceNumber: string }> => {
      if (!user) throw new Error("Non authentifié");

      // 1. Charger le devis
      const { data: quote, error: qErr } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", quoteId)
        .eq("user_id", user.id) // sécurité défense en profondeur
        .single();
      if (qErr) throw qErr;
      if (!quote) throw new Error("Devis introuvable");

      // 2. Charger dossier (pour adresse) + profile (pour identité émetteur)
      const { data: dossier } = await supabase
        .from("dossiers")
        .select("*")
        .eq("id", quote.dossier_id)
        .maybeSingle();
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      // 3. Numéro facture
      const clientName = dossier?.client_last_name || dossier?.client_first_name || null;
      const { data: numData, error: numError } = await supabase.rpc("generate_invoice_number", {
        p_user_id: user.id,
        p_client_name: clientName,
      });
      if (numError) throw numError;
      const invoiceNumber = numData as string;

      // 4. Insert facture brouillon, modifiable
      const clientAddress =
        [dossier?.address_line, dossier?.postal_code, dossier?.city].filter(Boolean).join(", ") ||
        dossier?.address ||
        null;

      const { data: invoice, error: insErr } = await supabase
        .from("invoices")
        .insert({
          dossier_id: quote.dossier_id,
          user_id: user.id,
          invoice_number: invoiceNumber,
          status: "draft",
          issue_date: new Date().toISOString().split("T")[0],
          related_quote_id: quote.id,
          // Client
          client_first_name: dossier?.client_first_name ?? null,
          client_last_name: dossier?.client_last_name ?? null,
          client_email: dossier?.client_email ?? null,
          client_phone: dossier?.client_phone ?? null,
          client_address: clientAddress,
          client_company: (dossier as any)?.client_company || null,
          client_type: "individual",
          // Émetteur
          artisan_name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || null,
          artisan_company: profile?.company_name || null,
          artisan_address: profile?.address || null,
          artisan_phone: profile?.phone || null,
          artisan_email: profile?.email || null,
          artisan_siret: profile?.siret || null,
          artisan_tva_intracom: (profile as any)?.tva_intracom || null,
          // TVA
          vat_mode: (profile as any)?.vat_applicable === false ? "no_vat_293b" : "normal",
          // Totaux (recalculés côté édition mais on initialise)
          total_ht: quote.total_ht ?? 0,
          total_tva: quote.total_tva ?? 0,
          total_ttc: quote.total_ttc ?? 0,
          // Notes
          notes: quote.notes || null,
          payment_terms: (profile as any)?.payment_terms_default || null,
        } as never)
        .select("id, invoice_number")
        .single();
      if (insErr) throw insErr;

      // 5. Lignes : QuoteItem -> invoice_lines
      const items = (quote.items as unknown as Array<{
        label: string; description?: string; qty: number; unit: string;
        unit_price: number; vat_rate: number; discount?: number;
      }>) ?? [];

      if (items.length > 0) {
        const linesPayload = items.map((it, idx) => ({
          invoice_id: invoice.id,
          label: it.label || "(sans titre)",
          description: it.description || null,
          qty: it.qty || 1,
          unit: it.unit || "u",
          unit_price: it.unit_price || 0,
          tva_rate: it.vat_rate ?? 10,
          discount: it.discount || 0,
          sort_order: idx,
        }));
        const { error: linesErr } = await supabase.from("invoice_lines").insert(linesPayload);
        if (linesErr) throw linesErr;
      }

      // 6. Historique
      await supabase.from("historique").insert({
        dossier_id: quote.dossier_id,
        user_id: user.id,
        action: "invoice_created_from_quote",
        details: `Facture ${invoiceNumber} créée depuis le devis ${quote.quote_number}`,
      });

      return { invoiceId: invoice.id, invoiceNumber };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices", dossierId] });
      queryClient.invalidateQueries({ queryKey: ["dossier-historique", dossierId] });
    },
  });

  return { importPdf, updateStatus, deleteQuote, transformToInvoice };
}
