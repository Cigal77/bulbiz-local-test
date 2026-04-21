import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useComplianceProfile } from "@/hooks/useComplianceProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, Loader2, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { LegalForm } from "@/lib/compliance-engine";

const LEGAL_FORMS: { value: LegalForm; label: string }[] = [
  { value: "ei", label: "Entreprise Individuelle (EI)" },
  { value: "micro", label: "Micro-entreprise" },
  { value: "eurl", label: "EURL" },
  { value: "sarl", label: "SARL" },
  { value: "sasu", label: "SASU" },
  { value: "sas", label: "SAS" },
  { value: "autre", label: "Autre" },
];

const PAYMENT_METHODS = [
  { value: "virement", label: "Virement" },
  { value: "cheque", label: "Chèque" },
  { value: "especes", label: "Espèces" },
  { value: "cb", label: "Carte bancaire" },
];

const STEPS = [
  "Entreprise",
  "TVA",
  "Assurance",
  "Paiement",
  "Numérotation",
  "Identité visuelle",
  "Clients",
  "Vérification",
];

export default function ComplianceOnboarding() {
  const navigate = useNavigate();
  const { profile, rawProfile, insurance, settings, isLoading, score, updateProfile, updateInsurance, updateSettings } =
    useComplianceProfile();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form state (initialised once from server, then user-owned)
  const [form, setForm] = useState<Record<string, any>>({});
  const [insForm, setInsForm] = useState<Record<string, any>>({});
  const [setForm_, setSetForm] = useState<Record<string, any>>({});

  const initRef = useRef({ profile: false, insurance: false, settings: false });

  useEffect(() => {
    if (!initRef.current.profile && (rawProfile || profile)) {
      setForm({ ...((rawProfile as any) ?? profile) });
      initRef.current.profile = true;
    }
  }, [rawProfile, profile]);
  useEffect(() => {
    if (!initRef.current.insurance && insurance) {
      setInsForm({ ...insurance });
      initRef.current.insurance = true;
    }
  }, [insurance]);
  useEffect(() => {
    if (!initRef.current.settings && settings) {
      setSetForm({ ...settings });
      initRef.current.settings = true;
    }
  }, [settings]);

  const setField = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const setInsField = (k: string, v: any) => setInsForm((p) => ({ ...p, [k]: v }));
  const setSetField = (k: string, v: any) => setSetForm((p) => ({ ...p, [k]: v }));

  const togglePaymentMethod = (m: string) => {
    const current: string[] = form.accepted_payment_methods || [];
    setField(
      "accepted_payment_methods",
      current.includes(m) ? current.filter((x) => x !== m) : [...current, m],
    );
  };

  /** Validation par étape — true si OK, sinon affiche un toast */
  const validateStep = (s: number): boolean => {
    if (s === 1) {
      if (!form.legal_form) { toast.error("Forme juridique requise"); return false; }
      if (!form.company_name?.trim()) { toast.error("Raison sociale requise"); return false; }
      const siret = (form.siret ?? "").replace(/\s/g, "");
      if (!/^\d{14}$/.test(siret)) { toast.error("SIRET invalide (14 chiffres requis)"); return false; }
      if (!form.address?.trim()) { toast.error("Adresse du siège requise"); return false; }
      if (!form.email?.trim()) { toast.error("Email professionnel requis"); return false; }
    }
    if (s === 3 && insForm.decennial_required) {
      if (!insForm.insurer_name?.trim()) { toast.error("Nom de l'assureur requis"); return false; }
      if (!insForm.policy_number?.trim()) { toast.error("N° de police requis"); return false; }
    }
    if (s === 4) {
      if (!form.iban?.trim()) { toast.error("IBAN requis pour être payé"); return false; }
      if (!form.payment_terms_default?.trim()) { toast.error("Conditions de règlement requises"); return false; }
    }
    return true;
  };

  const saveCurrentStep = async () => {
    setSaving(true);
    try {
      await updateProfile.mutateAsync(form as any);
      if (step === 3) await updateInsurance.mutateAsync(insForm as any);
      if (step === 5 || step === 6 || step === 7) await updateSettings.mutateAsync(setForm_ as any);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la sauvegarde");
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (!validateStep(step)) return;
    try {
      await saveCurrentStep();
      if (step < STEPS.length) setStep(step + 1);
    } catch {
      /* toast déjà affiché */
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        ...form,
        onboarding_compliance_completed_at: new Date().toISOString(),
      } as any);
      toast.success("Configuration reportée — vous pourrez la compléter dans les paramètres.");
      navigate("/");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        ...form,
        onboarding_compliance_completed_at: new Date().toISOString(),
      } as any);
      await updateInsurance.mutateAsync(insForm as any);
      await updateSettings.mutateAsync(setForm_ as any);
      toast.success("Configuration conformité terminée !");
      navigate("/parametres/conformite");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const progress = (step / STEPS.length) * 100;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6 pb-32">
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Configurer mes documents conformes</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            disabled={saving}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <SkipForward className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Configurer plus tard</span>
            <span className="sm:hidden">Plus tard</span>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Étape {step} sur {STEPS.length} — {STEPS[step - 1]}
        </p>
        <Progress value={progress} className="mt-3 h-2" />
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Votre entreprise</CardTitle>
            <CardDescription>
              Ces informations apparaissent sur vos devis et factures. Certaines sont obligatoires en France.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Forme juridique *</Label>
              <Select
                value={form.legal_form ?? ""}
                onValueChange={(v) => setField("legal_form", v)}
              >
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {LEGAL_FORMS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Raison sociale ou nom commercial *</Label>
              <Input
                value={form.company_name ?? ""}
                onChange={(e) => setField("company_name", e.target.value)}
                placeholder="Ex : Plomberie Dupont"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prénom dirigeant</Label>
                <Input value={form.owner_first_name ?? ""} onChange={(e) => setField("owner_first_name", e.target.value)} />
              </div>
              <div>
                <Label>Nom dirigeant</Label>
                <Input value={form.owner_last_name ?? ""} onChange={(e) => setField("owner_last_name", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>SIREN</Label>
                <Input value={form.siren ?? ""} onChange={(e) => setField("siren", e.target.value)} placeholder="9 chiffres" />
              </div>
              <div>
                <Label>SIRET *</Label>
                <Input value={form.siret ?? ""} onChange={(e) => setField("siret", e.target.value)} placeholder="14 chiffres" />
              </div>
            </div>
            {(form.legal_form === "eurl" || form.legal_form === "sarl" || form.legal_form === "sasu" || form.legal_form === "sas") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Capital social (€)</Label>
                  <Input type="number" value={form.capital_amount ?? ""} onChange={(e) => setField("capital_amount", parseFloat(e.target.value) || null)} />
                </div>
                <div>
                  <Label>Ville RCS</Label>
                  <Input value={form.rcs_city ?? ""} onChange={(e) => setField("rcs_city", e.target.value)} />
                </div>
              </div>
            )}
            <div>
              <Label>Adresse du siège *</Label>
              <Textarea value={form.address ?? ""} onChange={(e) => setField("address", e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email pro *</Label>
                <Input type="email" value={form.email ?? ""} onChange={(e) => setField("email", e.target.value)} />
              </div>
              <div>
                <Label>Téléphone</Label>
                <Input value={form.phone ?? ""} onChange={(e) => setField("phone", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Votre TVA</CardTitle>
            <CardDescription>
              Une seule question à se poser. Bulbiz s'occupe des mentions légales.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Facturez-vous la TVA à vos clients ?
              </Label>
              <div className="grid gap-2">
                <VatChoice
                  active={form.vat_applicable === false}
                  title="Non, je suis en franchise en base"
                  description="Je ne facture pas la TVA. Bulbiz ajoutera automatiquement la mention « TVA non applicable, art. 293 B du CGI »."
                  onClick={() => {
                    setField("vat_applicable", false);
                    setField("vat_exemption_293b", true);
                  }}
                />
                <VatChoice
                  active={form.vat_applicable === true}
                  title="Oui, je facture la TVA"
                  description="J'applique la TVA sur mes devis et factures. Bulbiz calcule HT, TVA et TTC pour moi."
                  onClick={() => {
                    setField("vat_applicable", true);
                    setField("vat_exemption_293b", false);
                  }}
                />
                <VatChoice
                  active={form.vat_applicable === undefined || form.vat_applicable === null}
                  title="Je ne sais pas"
                  description="En franchise en base, votre client paie le prix TTC affiché sans TVA. Sinon, vous facturez la TVA en plus du prix HT et la reversez à l'État. Si votre chiffre d'affaires reste sous les seuils légaux, vous êtes par défaut en franchise."
                  onClick={() => setField("vat_applicable", null)}
                />
              </div>
            </div>

            {form.vat_applicable && (
              <>
                <div>
                  <Label>N° TVA intracommunautaire</Label>
                  <Input
                    value={form.tva_intracom ?? ""}
                    onChange={(e) => setField("tva_intracom", e.target.value)}
                    placeholder="FR XX XXXXXXXXX"
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-md border">
                  <div>
                    <p className="font-medium text-sm">Option TVA sur les débits</p>
                    <p className="text-xs text-muted-foreground">
                      Cochez si vous avez opté pour ce régime auprès des impôts.
                    </p>
                  </div>
                  <Switch
                    checked={form.vat_on_debits ?? false}
                    onCheckedChange={(v) => setField("vat_on_debits", v)}
                  />
                </div>
              </>
            )}
            {form.vat_applicable === false && (
              <div className="p-3 bg-primary/5 rounded-md text-xs flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  Mention « TVA non applicable, art. 293 B du CGI » ajoutée automatiquement
                  à tous vos devis et factures.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Assurance & mentions bâtiment</CardTitle>
            <CardDescription>
              Si votre activité est concernée par la décennale, ces informations doivent figurer sur vos documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-md border">
              <div>
                <p className="font-medium">Assurance décennale obligatoire</p>
                <p className="text-xs text-muted-foreground">Activité bâtiment soumise à l'art. 1792 du Code civil.</p>
              </div>
              <Switch
                checked={insForm.decennial_required ?? false}
                onCheckedChange={(v) => setInsField("decennial_required", v)}
              />
            </div>
            {insForm.decennial_required && (
              <>
                <div>
                  <Label>Nom de l'assureur *</Label>
                  <Input value={insForm.insurer_name ?? ""} onChange={(e) => setInsField("insurer_name", e.target.value)} />
                </div>
                <div>
                  <Label>N° de police *</Label>
                  <Input value={insForm.policy_number ?? ""} onChange={(e) => setInsField("policy_number", e.target.value)} />
                </div>
                <div>
                  <Label>Coordonnées assureur</Label>
                  <Textarea value={insForm.insurer_contact ?? ""} onChange={(e) => setInsField("insurer_contact", e.target.value)} rows={2} />
                </div>
                <div>
                  <Label>Couverture géographique</Label>
                  <Input value={insForm.geographic_coverage ?? "France métropolitaine"} onChange={(e) => setInsField("geographic_coverage", e.target.value)} />
                </div>
              </>
            )}
            <div className="flex items-center justify-between p-3 rounded-md border">
              <div>
                <p className="font-medium">Afficher la mention « gestion des déchets »</p>
                <p className="text-xs text-muted-foreground">Apparaîtra sur les devis.</p>
              </div>
              <Switch
                checked={setForm_.auto_add_waste_mention ?? false}
                onCheckedChange={(v) => setSetField("auto_add_waste_mention", v)}
              />
            </div>
            {setForm_.auto_add_waste_mention && (
              <div>
                <Label>Texte gestion des déchets</Label>
                <Textarea
                  value={setForm_.waste_management_text ?? ""}
                  onChange={(e) => setSetField("waste_management_text", e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Paiement et règlement</CardTitle>
            <CardDescription>
              Ces informations renforcent la clarté et aident à être payé plus vite.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>IBAN *</Label>
                <Input value={form.iban ?? ""} onChange={(e) => setField("iban", e.target.value)} />
              </div>
              <div>
                <Label>BIC</Label>
                <Input value={form.bic ?? ""} onChange={(e) => setField("bic", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Modes de paiement acceptés</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {PAYMENT_METHODS.map((m) => {
                  const active = (form.accepted_payment_methods || []).includes(m.value);
                  return (
                    <Button
                      key={m.value}
                      type="button"
                      variant={active ? "default" : "outline"}
                      size="sm"
                      onClick={() => togglePaymentMethod(m.value)}
                    >
                      {m.label}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Conditions de règlement par défaut *</Label>
              <Textarea
                value={form.payment_terms_default ?? ""}
                onChange={(e) => setField("payment_terms_default", e.target.value)}
                rows={2}
                placeholder="Paiement à réception de facture..."
              />
            </div>
            <div>
              <Label>Taux de pénalités de retard (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.late_penalty_rate ?? 10.49}
                onChange={(e) => setField("late_penalty_rate", parseFloat(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">Défaut : 3 × taux légal en vigueur.</p>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md border">
              <div>
                <p className="font-medium">Indemnité forfaitaire 40 € (clients pros)</p>
                <p className="text-xs text-muted-foreground">Obligatoire B2B (art. L441-10 Code commerce).</p>
              </div>
              <Switch
                checked={form.fixed_recovery_fee_b2b ?? true}
                onCheckedChange={(v) => setField("fixed_recovery_fee_b2b", v)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Numérotation</CardTitle>
            <CardDescription>
              Bulbiz génère automatiquement vos numéros de manière chronologique et sécurisée.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="p-3 bg-muted/40 rounded-md">
              <p className="font-medium mb-2">Format en vigueur :</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Devis : <code>DEV-AAAA-NOM-XXXX</code></li>
                <li>• Factures : <code>FAC-AAAA-NOM-XXXX</code></li>
                <li>• Avoirs : <code>AV-AAAA-XXXX</code></li>
                <li>• Acomptes : <code>ACO-AAAA-XXXX</code></li>
              </ul>
            </div>
            <div className="p-3 bg-primary/5 rounded-md">
              ✓ Séquences séparées et chronologiques continues<br />
              ✓ Aucun numéro ne peut être réutilisé ou écrasé<br />
              ✓ Documents annulés conservent leur numéro avec statut « annulé »
            </div>
          </CardContent>
        </Card>
      )}

      {step === 6 && (
        <Card>
          <CardHeader>
            <CardTitle>Identité visuelle</CardTitle>
            <CardDescription>Personnalisez l'apparence de vos PDF.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Logo et couleurs : configurables ensuite dans les paramètres.
            </p>
            <div>
              <Label>Pied de page personnalisé</Label>
              <Textarea
                value={form.footer_text ?? ""}
                onChange={(e) => setField("footer_text", e.target.value)}
                rows={2}
                placeholder="Ex : Merci de votre confiance — N° SIRET..."
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 7 && (
        <Card>
          <CardHeader>
            <CardTitle>Paramètres clients</CardTitle>
            <CardDescription>Règles automatiques pour clients particuliers et professionnels.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-md border">
              <div>
                <p className="font-medium">Bloquer la génération si données incomplètes</p>
                <p className="text-xs text-muted-foreground">Évite l'envoi de documents non conformes.</p>
              </div>
              <Switch
                checked={setForm_.block_generation_if_incomplete ?? true}
                onCheckedChange={(v) => setSetField("block_generation_if_incomplete", v)}
              />
            </div>
            <div>
              <Label>Validité par défaut des devis (jours)</Label>
              <Input
                type="number"
                value={setForm_.default_quote_validity_days ?? 30}
                onChange={(e) => setSetField("default_quote_validity_days", parseInt(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 8 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <CardTitle>Vérification finale</CardTitle>
            </div>
            <CardDescription>
              {score >= 80
                ? "✅ Votre configuration est prête. Vous pouvez générer des documents conformes."
                : `⚠️ Score actuel : ${score}/100. Quelques éléments restent à compléter.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center py-4">
              <div className="text-5xl font-bold text-primary">{score}%</div>
              <p className="text-sm text-muted-foreground mt-2">Score de conformité</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Vous pourrez modifier toutes ces informations à tout moment dans
              <strong> Paramètres → Documents & conformité</strong>.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-3 md:p-4 flex gap-2 z-40">
        <div className="max-w-2xl mx-auto w-full flex gap-2">
          <Button
            variant="outline"
            onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
            disabled={saving}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> {step > 1 ? "Précédent" : "Quitter"}
          </Button>
          <div className="flex-1" />
          {step < STEPS.length ? (
            <Button onClick={handleNext} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Suivant <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Terminer la configuration
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function VatChoice({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-lg border p-3 transition-colors hover:border-primary/60",
        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card",
      )}
    >
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "mt-1 h-3.5 w-3.5 rounded-full border-2 shrink-0",
            active ? "border-primary bg-primary" : "border-muted-foreground/40",
          )}
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
    </button>
  );
}

