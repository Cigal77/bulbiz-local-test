import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BulbizLogo } from "@/components/BulbizLogo";
import { FileDown, AlertCircle, CheckCircle2 } from "lucide-react";

interface InvoiceData {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  service_date: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
  client_email: string | null;
  client_company: string | null;
  client_address: string | null;
  client_type: string;
  vat_mode: string;
  total_ht: number | null;
  total_tva: number | null;
  total_ttc: number | null;
  payment_terms: string | null;
  late_fees_text: string | null;
  notes: string | null;
  pdf_url: string | null;
  artisan_company: string | null;
  artisan_name: string | null;
  artisan_phone: string | null;
  artisan_email: string | null;
  artisan_siret: string | null;
  artisan_address: string | null;
  artisan_tva_intracom: string | null;
  user_id: string;
}

interface InvoiceLine {
  id: string;
  label: string;
  description: string | null;
  qty: number;
  unit: string;
  unit_price: number;
  tva_rate: number;
  discount: number;
  sort_order: number;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function fmt(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

export default function InvoiceView() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Lien invalide : aucun token fourni.");
      setLoading(false);
      return;
    }

    async function fetchInvoice() {
      try {
        // Fetch invoice by token
        const { data: inv, error: invErr } = await supabase
          .from("invoices")
          .select("*")
          .eq("client_token", token)
          .maybeSingle();

        if (invErr || !inv) {
          setError("Facture introuvable ou lien expiré.");
          setLoading(false);
          return;
        }

        // Check token expiry
        if (inv.client_token_expires_at && new Date(inv.client_token_expires_at) < new Date()) {
          setError("Ce lien a expiré.");
          setLoading(false);
          return;
        }

        setInvoice(inv as unknown as InvoiceData);

        // Fetch lines and public-safe artisan profile in parallel
        const [linesRes, profileRes] = await Promise.all([
          supabase
            .from("invoice_lines")
            .select("*")
            .eq("invoice_id", inv.id)
            .order("sort_order"),
          supabase.rpc("get_public_profile_for_invoice", { _client_token: token }),
        ]);

        setLines((linesRes.data || []) as unknown as InvoiceLine[]);
        const profileRow = Array.isArray(profileRes.data) ? profileRes.data[0] : profileRes.data;
        setProfile(profileRow as Record<string, unknown> | null);
      } catch (e: any) {
        setError(e.message || "Erreur inattendue");
      } finally {
        setLoading(false);
      }
    }

    fetchInvoice();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-semibold text-foreground">Erreur</h1>
        <p className="text-muted-foreground text-center max-w-sm">{error || "Facture introuvable"}</p>
      </div>
    );
  }

  const artisanName =
    (profile?.company_name as string) ||
    invoice.artisan_company ||
    invoice.artisan_name ||
    "Artisan";

  const clientName =
    [invoice.client_first_name, invoice.client_last_name].filter(Boolean).join(" ") ||
    invoice.client_company ||
    "Client";

  const statusConfig: Record<string, { label: string; color: string }> = {
    draft: { label: "Brouillon", color: "bg-muted text-muted-foreground" },
    sent: { label: "Envoyée", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    paid: { label: "Payée", color: "bg-success/15 text-success" },
  };

  const status = statusConfig[invoice.status] || statusConfig.draft;

  // Compute totals from lines
  const tvaByRate: Record<number, number> = {};
  let totalHt = 0;
  for (const line of lines) {
    const lineTotal = line.qty * line.unit_price * (1 - (line.discount || 0) / 100);
    totalHt += lineTotal;
    if (invoice.vat_mode === "normal") {
      const tva = lineTotal * line.tva_rate / 100;
      tvaByRate[line.tva_rate] = (tvaByRate[line.tva_rate] || 0) + tva;
    }
  }
  const totalTva = Object.values(tvaByRate).reduce((a, b) => a + b, 0);
  const totalTtc = totalHt + totalTva;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BulbizLogo size={24} />
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Facture {invoice.invoice_number}
              </h1>
              <p className="text-xs text-muted-foreground">{artisanName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={status.color}>{status.label}</Badge>
            {invoice.pdf_url && (
              <Button size="sm" asChild className="gap-1.5">
                <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                  <FileDown className="h-3.5 w-3.5" />
                  Télécharger PDF
                </a>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Artisan + Client */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Émetteur</h3>
            <p className="text-sm font-medium text-foreground">{artisanName}</p>
            {(profile?.address || invoice.artisan_address) && (
              <p className="text-xs text-muted-foreground">{(profile?.address || invoice.artisan_address) as string}</p>
            )}
            {(profile?.phone || invoice.artisan_phone) && (
              <p className="text-xs text-muted-foreground">Tél : {(profile?.phone || invoice.artisan_phone) as string}</p>
            )}
            {(profile?.email || invoice.artisan_email) && (
              <p className="text-xs text-muted-foreground">{(profile?.email || invoice.artisan_email) as string}</p>
            )}
            {(profile?.siret || invoice.artisan_siret) && (
              <p className="text-xs text-muted-foreground">SIRET : {(profile?.siret || invoice.artisan_siret) as string}</p>
            )}
            {(profile?.tva_intracom || invoice.artisan_tva_intracom) && (
              <p className="text-xs text-muted-foreground">TVA : {(profile?.tva_intracom || invoice.artisan_tva_intracom) as string}</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</h3>
            {invoice.client_company && (
              <p className="text-sm font-medium text-foreground">{invoice.client_company}</p>
            )}
            <p className={`text-sm ${invoice.client_company ? "" : "font-medium"} text-foreground`}>{clientName}</p>
            {invoice.client_address && (
              <p className="text-xs text-muted-foreground">{invoice.client_address}</p>
            )}
            {invoice.client_email && (
              <p className="text-xs text-muted-foreground">{invoice.client_email}</p>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Date d'émission</span>
              <p className="font-medium text-foreground">{formatDate(invoice.issue_date)}</p>
            </div>
            {invoice.service_date && (
              <div>
                <span className="text-muted-foreground text-xs">Date d'intervention</span>
                <p className="font-medium text-foreground">{formatDate(invoice.service_date)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Lines table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_60px_60px_80px_60px_90px] gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wider">
            <span>Désignation</span>
            <span className="text-right">Qté</span>
            <span>Unité</span>
            <span className="text-right">PU HT</span>
            <span className="text-right">TVA</span>
            <span className="text-right">Total HT</span>
          </div>

          {lines.map((line, idx) => {
            const lineTotal = line.qty * line.unit_price * (1 - (line.discount || 0) / 100);
            return (
              <div
                key={line.id}
                className={`grid grid-cols-1 sm:grid-cols-[1fr_60px_60px_80px_60px_90px] gap-2 px-4 py-2.5 items-center text-sm ${
                  idx % 2 === 0 ? "bg-muted/30" : ""
                }`}
              >
                <div>
                  <p className="font-medium text-foreground text-xs">{line.label}</p>
                  {line.description && (
                    <p className="text-[11px] text-muted-foreground italic">{line.description}</p>
                  )}
                </div>
                <span className="text-xs text-right text-foreground">{line.qty}</span>
                <span className="text-xs text-muted-foreground">{line.unit}</span>
                <span className="text-xs text-right text-foreground">{fmt(line.unit_price)}</span>
                <span className="text-xs text-right text-muted-foreground">{line.tva_rate} %</span>
                <span className="text-xs text-right font-semibold text-foreground">{fmt(lineTotal)}</span>
              </div>
            );
          })}

          {lines.length === 0 && (
            <p className="text-center py-6 text-sm text-muted-foreground">Aucune ligne</p>
          )}
        </div>

        {/* Totals */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-8 text-sm">
              <span className="text-muted-foreground">Total HT</span>
              <span className="font-medium text-foreground w-28 text-right">{fmt(totalHt)}</span>
            </div>
            {invoice.vat_mode === "normal" &&
              Object.entries(tvaByRate)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([rate, amount]) => (
                  <div key={rate} className="flex gap-8 text-sm">
                    <span className="text-muted-foreground">TVA {rate} %</span>
                    <span className="text-foreground w-28 text-right">{fmt(amount)}</span>
                  </div>
                ))}
            <div className="flex gap-8 text-base mt-1 pt-1 border-t border-border">
              <span className="font-semibold text-foreground">Total TTC</span>
              <span className="font-bold text-primary w-28 text-right">{fmt(totalTtc)}</span>
            </div>
            {invoice.vat_mode === "no_vat_293b" && (
              <p className="text-xs text-muted-foreground italic mt-1">
                TVA non applicable, art. 293 B du CGI
              </p>
            )}
          </div>
        </div>

        {/* Payment & Legal */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Conditions et mentions légales
          </h3>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p>
              {invoice.payment_terms || "Paiement à réception de facture."}
            </p>
            <p>Pas d'escompte pour paiement anticipé.</p>
            {invoice.client_type === "business" && (
              <>
                <p>
                  {invoice.late_fees_text ||
                    "Pénalités de retard : en cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera appliquée."}
                </p>
                <p>Indemnité forfaitaire pour frais de recouvrement : 40 € (art. D.441-5 du Code de commerce).</p>
              </>
            )}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</h3>
            <p className="text-xs text-muted-foreground whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}

        {/* Status banner */}
        {invoice.status === "paid" && (
          <div className="rounded-xl border border-success/30 bg-success/5 p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
            <p className="text-sm font-medium text-success">Cette facture a été réglée.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-8 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          {artisanName}
          {(profile?.siret || invoice.artisan_siret) && ` — SIRET ${(profile?.siret || invoice.artisan_siret) as string}`}
          {(profile?.phone || invoice.artisan_phone) && ` — Tél ${(profile?.phone || invoice.artisan_phone) as string}`}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Propulsé par <span className="font-medium">Bulbiz</span>
        </p>
      </footer>
    </div>
  );
}
