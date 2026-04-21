import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { BulbizLogo } from "@/components/BulbizLogo";
import { Loader2, CheckCircle2, XCircle, FileText, ExternalLink, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface QuoteData {
  id: string;
  quote_number: string;
  status: string;
  total_ht: number | null;
  total_tva: number | null;
  total_ttc: number | null;
  pdf_url: string | null;
  validity_days: number | null;
  created_at: string;
  notes: string | null;
  signature_token_expires_at: string | null;
}

interface DossierData {
  client_first_name: string | null;
  client_last_name: string | null;
  address: string | null;
}

interface ProfileData {
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  siret: string | null;
}

type PageState = "loading" | "view" | "confirming" | "success" | "refused" | "error" | "expired" | "already_done";

export default function QuoteValidation() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<PageState>("loading");
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState("");
  const [refuseReason, setRefuseReason] = useState("");
  const [showRefuseForm, setShowRefuseForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("Lien invalide");
      setState("error");
      return;
    }
    loadQuote();
  }, [token]);

  const loadQuote = async () => {
    const { data: q, error: qErr } = await supabase
      .from("quotes")
      .select(
        "id, quote_number, status, total_ht, total_tva, total_ttc, pdf_url, validity_days, created_at, notes, signature_token_expires_at, dossier_id, user_id",
      )
      .eq("signature_token", token!)
      .maybeSingle();

    if (qErr || !q) {
      setError("Ce lien est invalide ou a expiré.");
      setState("error");
      return;
    }

    if (q.signature_token_expires_at && new Date(q.signature_token_expires_at) < new Date()) {
      setState("expired");
      return;
    }

    if (q.status === "signe" || q.status === "refuse") {
      setQuote(q as QuoteData);
      setState("already_done");
      return;
    }

    // Load dossier & public-safe artisan profile
    const [dRes, pRes] = await Promise.all([
      supabase
        .from("dossiers")
        .select("client_first_name, client_last_name, address")
        .eq("id", q.dossier_id)
        .maybeSingle(),
      supabase.rpc("get_public_profile_for_quote", { _signature_token: token! }),
    ]);

    setQuote(q as QuoteData);
    setDossier(dRes.data);
    const profileRow = Array.isArray(pRes.data) ? pRes.data[0] : pRes.data;
    setProfile(profileRow as any);
    setState("view");
  };

  const handleAction = async (action: "accept" | "refuse") => {
    setActionLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("validate-quote", {
        body: { token, action, reason: action === "refuse" ? refuseReason : undefined },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setState(action === "accept" ? "success" : "refused");
    } catch (err: any) {
      setError(err.message);
      setState("error");
    } finally {
      setActionLoading(false);
    }
  };

  const artisanName =
    profile?.company_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Votre artisan";
  const clientName = [dossier?.client_first_name, dossier?.client_last_name].filter(Boolean).join(" ");

  const formatCurrency = (v: number | null) => (v != null ? `${v.toFixed(2)} €` : "—");

  // ── Render states ──

  if (state === "loading") {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Chargement du devis…</p>
        </div>
      </PageShell>
    );
  }

  if (state === "expired") {
    return (
      <PageShell>
        <ResultCard
          icon={<AlertTriangle className="h-12 w-12 text-warning" />}
          title="Lien expiré"
          description="Ce lien de validation a expiré. Veuillez contacter votre artisan pour recevoir un nouveau lien."
        />
      </PageShell>
    );
  }

  if (state === "error") {
    return (
      <PageShell>
        <ResultCard
          icon={<XCircle className="h-12 w-12 text-destructive" />}
          title="Erreur"
          description={error || "Une erreur est survenue."}
        />
      </PageShell>
    );
  }

  if (state === "already_done") {
    return (
      <PageShell>
        <ResultCard
          icon={
            quote?.status === "signe" ? (
              <CheckCircle2 className="h-12 w-12 text-success" />
            ) : (
              <XCircle className="h-12 w-12 text-destructive" />
            )
          }
          title={quote?.status === "signe" ? "Devis déjà validé" : "Devis déjà refusé"}
          description={`Ce devis (${quote?.quote_number}) a déjà été ${quote?.status === "signe" ? "validé" : "refusé"}.`}
        />
      </PageShell>
    );
  }

  if (state === "success") {
    return (
      <PageShell>
        <ResultCard
          icon={<CheckCircle2 className="h-12 w-12 text-success" />}
          title="Devis validé !"
          description={`Merci ! Votre validation du devis ${quote?.quote_number} a bien été enregistrée. ${artisanName} a été notifié.`}
        />
      </PageShell>
    );
  }

  if (state === "refused") {
    return (
      <PageShell>
        <ResultCard
          icon={<XCircle className="h-12 w-12 text-muted-foreground" />}
          title="Devis refusé"
          description={`Votre refus du devis ${quote?.quote_number} a été enregistré. ${artisanName} en a été informé.`}
        />
      </PageShell>
    );
  }

  // ── Main view ──
  return (
    <PageShell>
      <div className="space-y-6">
        {/* Quote header */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-foreground">Devis {quote?.quote_number}</h1>
          <p className="text-sm text-muted-foreground">
            Émis le {quote ? format(new Date(quote.created_at), "d MMMM yyyy", { locale: fr }) : ""}
          </p>
        </div>

        {/* Artisan info */}
        <Card>
          <CardContent className="pt-4 space-y-1">
            <p className="font-semibold text-foreground">{artisanName}</p>
            {profile?.siret && <p className="text-xs text-muted-foreground">SIRET : {profile.siret}</p>}
            {profile?.phone && <p className="text-sm text-muted-foreground">📞 {profile.phone}</p>}
            {profile?.email && <p className="text-sm text-muted-foreground">✉️ {profile.email}</p>}
          </CardContent>
        </Card>

        {/* Client info */}
        {(clientName || dossier?.address) && (
          <Card>
            <CardContent className="pt-4 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Client</p>
              {clientName && <p className="font-medium text-foreground">{clientName}</p>}
              {dossier?.address && <p className="text-sm text-muted-foreground">{dossier.address}</p>}
            </CardContent>
          </Card>
        )}

        {/* PDF preview + link */}
        {quote?.pdf_url && (
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Aperçu du devis</p>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground"
                  onClick={() => setShowPdfPreview((v) => !v)}
                >
                  {showPdfPreview ? "Masquer" : "Afficher"}
                </Button>
              </div>

              {showPdfPreview && (
                <div className="w-full overflow-hidden rounded-lg border bg-muted">
                  {/* ratio ~ A4 portrait */}
                  <div className="relative w-full" style={{ paddingTop: "141%" }}>
                    <iframe
                      title="Aperçu devis PDF"
                      src={`${quote.pdf_url}#view=FitH`}
                      className="absolute inset-0 h-full w-full"
                    />
                  </div>
                  <p className="px-3 py-2 text-[11px] text-muted-foreground">
                    Si l’aperçu ne s’affiche pas, ouvrez le PDF en plein écran.
                  </p>
                </div>
              )}

              <Button variant="outline" className="w-full gap-2" asChild>
                <a href={quote.pdf_url} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4" />
                  Voir le devis (PDF)
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {quote?.notes && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-foreground whitespace-pre-line">{quote.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <Button
            size="lg"
            className="w-full text-base gap-2"
            onClick={() => handleAction("accept")}
            disabled={actionLoading}
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
            Valider le devis
          </Button>

          <p className="text-[11px] text-center text-muted-foreground">
            En cliquant sur « Valider », vous confirmez accepter ce devis et ses conditions.
          </p>

          {!showRefuseForm ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => setShowRefuseForm(true)}
            >
              Refuser le devis
            </Button>
          ) : (
            <Card className="border-destructive/30">
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm font-medium">Motif du refus (facultatif)</p>
                <Textarea
                  placeholder="Indiquez la raison si vous le souhaitez…"
                  value={refuseReason}
                  onChange={(e) => setRefuseReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => handleAction("refuse")}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                    Confirmer le refus
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowRefuseForm(false);
                      setRefuseReason("");
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Validity info */}
        {quote?.validity_days && (
          <p className="text-[11px] text-center text-muted-foreground">
            Ce devis est valable {quote.validity_days} jours à compter de sa date d'émission.
          </p>
        )}
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur px-4 py-3 flex items-center justify-center gap-2">
        <BulbizLogo size={22} />
        <span className="font-semibold text-sm text-foreground">Bulbiz</span>
      </header>
      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-6">{children}</main>
      <footer className="border-t px-4 py-3 text-center">
        <p className="text-[10px] text-muted-foreground">Propulsé par Bulbiz</p>
      </footer>
    </div>
  );
}

function ResultCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-4 py-12">
      {icon}
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}
