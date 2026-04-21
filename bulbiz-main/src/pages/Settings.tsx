import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, LogOut } from "lucide-react";
import { BulbizLogo } from "@/components/BulbizLogo";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { validateEmail, EMAIL_VALIDATION_ERROR } from "@/lib/email-validation";
import { GmailConnectionCard } from "@/components/settings/GmailConnectionCard";
import { GoogleCalendarCard } from "@/components/settings/GoogleCalendarCard";
import { PublicLinkCard } from "@/components/settings/PublicLinkCard";

const DELAY_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1);
const VALIDITY_OPTIONS = [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90];

interface SettingsForm {
  first_name: string;
  last_name: string;
  company_name: string;
  phone: string;
  email: string;
  siret: string;
  address: string;
  default_validity_days: number;
  auto_relance_enabled: boolean;
  relance_delay_info: number;
  relance_delay_devis_1: number;
  relance_delay_devis_2: number;
  relance_delay_facture_1: number;
  relance_delay_facture_2: number;
  email_signature: string;
  auto_send_client_link: boolean;
  client_link_validity_days: number;
  tva_intracom: string;
  vat_applicable: boolean;
  payment_terms_default: string;
  client_slots_enabled: boolean;
}

export default function Settings() {
  const navigate = useNavigate();
  const { profile, isLoading, update } = useProfile();
  const { signOut } = useAuth();

  const { register, handleSubmit, reset, watch, setValue } = useForm<SettingsForm>();

  const autoRelance = watch("auto_relance_enabled");
  const autoSendLink = watch("auto_send_client_link");

  useEffect(() => {
    if (profile) {
      reset({
        first_name: profile.first_name ?? "",
        last_name: profile.last_name ?? "",
        company_name: profile.company_name ?? "",
        phone: profile.phone ?? "",
        email: profile.email ?? "",
        siret: profile.siret ?? "",
        address: profile.address ?? "",
        default_validity_days: profile.default_validity_days ?? 30,
        auto_relance_enabled: profile.auto_relance_enabled,
        relance_delay_info: profile.relance_delay_info,
        relance_delay_devis_1: profile.relance_delay_devis_1,
        relance_delay_devis_2: profile.relance_delay_devis_2,
        relance_delay_facture_1: (profile as any).relance_delay_facture_1 ?? 3,
        relance_delay_facture_2: (profile as any).relance_delay_facture_2 ?? 7,
        email_signature: profile.email_signature || [
          "Cordialement,",
          profile.company_name || [profile.first_name, profile.last_name].filter(Boolean).join(" "),
          profile.phone,
          profile.email,
        ].filter(Boolean).join("\n"),
        auto_send_client_link: profile.auto_send_client_link ?? true,
        client_link_validity_days: profile.client_link_validity_days ?? 7,
        tva_intracom: profile.tva_intracom ?? "",
        vat_applicable: profile.vat_applicable ?? true,
        payment_terms_default: profile.payment_terms_default ?? "Paiement à réception de facture. Chèque, virement ou espèces.",
        client_slots_enabled: (profile as any).client_slots_enabled ?? true,
      });
    }
  }, [profile, reset]);

  const onSubmit = async (data: SettingsForm) => {
    if (data.email && !validateEmail(data.email)) {
      toast.error(EMAIL_VALIDATION_ERROR);
      return;
    }
    try {
      await update.mutateAsync({
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        company_name: data.company_name || null,
        phone: data.phone || null,
        email: data.email || null,
        siret: data.siret || null,
        address: data.address || null,
        default_validity_days: data.default_validity_days,
        auto_relance_enabled: data.auto_relance_enabled,
        relance_delay_info: data.relance_delay_info,
        relance_delay_devis_1: data.relance_delay_devis_1,
        relance_delay_devis_2: data.relance_delay_devis_2,
        relance_delay_facture_1: data.relance_delay_facture_1,
        relance_delay_facture_2: data.relance_delay_facture_2,
        email_signature: data.email_signature || null,
        auto_send_client_link: data.auto_send_client_link,
        client_link_validity_days: data.client_link_validity_days,
        tva_intracom: data.tva_intracom || null,
        vat_applicable: data.vat_applicable,
        payment_terms_default: data.payment_terms_default || null,
        client_slots_enabled: data.client_slots_enabled,
      } as any);
      toast.success("Paramètres sauvegardés");
    } catch (e) {
      console.error("Settings save error:", e);
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 bg-background p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 sm:px-6 py-3">
        <BulbizLogo />
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
      </header>

      <main className="p-4 sm:p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">Paramètres</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Lien client public */}
          <PublicLinkCard />

          {/* Conformité documentaire */}
          <Card
            className="cursor-pointer hover:border-primary transition-colors border-l-4 border-l-primary"
            onClick={() => navigate("/parametres/conformite")}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>📄 Documents & conformité</span>
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </CardTitle>
              <CardDescription>
                Configurez vos mentions légales, assurance, TVA et règles de paiement pour des devis et factures conformes.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Profil */}
          <Card>
            <CardHeader>
              <CardTitle>Profil artisan</CardTitle>
              <CardDescription>Vos coordonnées professionnelles</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Prénom</Label>
                <Input id="first_name" autoComplete="given-name" {...register("first_name")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Nom</Label>
                <Input id="last_name" autoComplete="family-name" {...register("last_name")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Entreprise</Label>
                <Input id="company_name" autoComplete="organization" {...register("company_name")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" type="text" inputMode="tel" autoComplete="tel" {...register("phone")} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">Email professionnel</Label>
                <Input id="email" type="email" autoComplete="email" {...register("email")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="siret">SIRET</Label>
                <Input id="siret" {...register("siret")} placeholder="123 456 789 00012" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input id="address" autoComplete="street-address" {...register("address")} placeholder="12 rue des Artisans, 75001 Paris" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_validity_days">Validité devis (jours)</Label>
                <Input id="default_validity_days" type="number" min={1} {...register("default_validity_days", { valueAsNumber: true })} />
              </div>
            </CardContent>
          </Card>

          {/* Gestion des demandes clients */}
          <Card>
            <CardHeader>
              <CardTitle>Gestion des demandes clients</CardTitle>
              <CardDescription>Options du formulaire de demande client</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Autoriser le client à proposer des créneaux</Label>
                  <p className="text-sm text-muted-foreground">Si activé, le client pourra proposer 3 créneaux à la fin du formulaire. Sinon, vous proposerez les créneaux depuis le dossier.</p>
                </div>
                <Switch
                  checked={watch("client_slots_enabled")}
                  onCheckedChange={(v) => setValue("client_slots_enabled", v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Client link settings */}
          <Card>
            <CardHeader>
              <CardTitle>Lien client</CardTitle>
              <CardDescription>Envoi automatique du lien de collecte d'informations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Envoi auto à la création du dossier</Label>
                  <p className="text-sm text-muted-foreground">Envoyer automatiquement le lien client par email</p>
                </div>
                <Switch
                  checked={autoSendLink}
                  onCheckedChange={(v) => setValue("auto_send_client_link", v)}
                />
              </div>
              <div className="space-y-2 max-w-[200px]">
                <Label>Durée de validité du lien (jours)</Label>
                <Select
                  value={String(watch("client_link_validity_days") || 7)}
                  onValueChange={(v) => setValue("client_link_validity_days", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALIDITY_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} jour{n > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Relances */}
          <Card>
            <CardHeader>
              <CardTitle>Relances automatiques</CardTitle>
              <CardDescription>Configurez les délais des relances email automatiques pour les devis et factures</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Activer les relances auto</Label>
                  <p className="text-sm text-muted-foreground">Envoi automatique des rappels par email</p>
                </div>
                <Switch
                  checked={autoRelance}
                  onCheckedChange={(v) => setValue("auto_relance_enabled", v)}
                />
              </div>

              {/* Info manquante */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">📋 Info manquante</p>
                <p className="text-xs text-muted-foreground">Relance envoyée si le dossier reste en "nouveau" ou "à qualifier" sans réponse du client.</p>
                <div className="max-w-[200px]">
                  <Label className="text-xs">Délai après création</Label>
                  <Select
                    value={String(watch("relance_delay_info") || 1)}
                    onValueChange={(v) => setValue("relance_delay_info", Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DELAY_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          J+{n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Devis non signé */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">📝 Devis non signé</p>
                <p className="text-xs text-muted-foreground">Jusqu'à 2 relances si le client n'a pas répondu au devis envoyé.</p>
                <div className="grid grid-cols-2 gap-4 max-w-[400px]">
                  <div className="space-y-1">
                    <Label className="text-xs">1ère relance</Label>
                    <Select
                      value={String(watch("relance_delay_devis_1") || 2)}
                      onValueChange={(v) => setValue("relance_delay_devis_1", Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DELAY_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            J+{n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">2ème relance</Label>
                    <Select
                      value={String(watch("relance_delay_devis_2") || 5)}
                      onValueChange={(v) => setValue("relance_delay_devis_2", Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DELAY_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            J+{n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Facture non payée */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">💰 Facture non payée</p>
                <p className="text-xs text-muted-foreground">Jusqu'à 2 relances après l'envoi de la facture si elle n'est pas marquée comme payée.</p>
                <div className="grid grid-cols-2 gap-4 max-w-[400px]">
                  <div className="space-y-1">
                    <Label className="text-xs">1ère relance</Label>
                    <Select
                      value={String(watch("relance_delay_facture_1") || 3)}
                      onValueChange={(v) => setValue("relance_delay_facture_1", Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DELAY_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            J+{n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">2ème relance</Label>
                    <Select
                      value={String(watch("relance_delay_facture_2") || 7)}
                      onValueChange={(v) => setValue("relance_delay_facture_2", Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DELAY_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            J+{n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* TVA & Facturation */}
          <Card>
            <CardHeader>
              <CardTitle>TVA & Facturation</CardTitle>
              <CardDescription>Paramètres de TVA et conditions de paiement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label>TVA applicable</Label>
                  <p className="text-sm text-muted-foreground">Appliquer la TVA sur vos devis et factures</p>
                </div>
                <Switch
                  checked={watch("vat_applicable")}
                  onCheckedChange={(v) => setValue("vat_applicable", v)}
                />
              </div>
              {watch("vat_applicable") && (
                <div className="space-y-2">
                  <Label htmlFor="tva_intracom">N° TVA intracommunautaire</Label>
                  <Input id="tva_intracom" {...register("tva_intracom")} placeholder="FR 12 345678901" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="payment_terms_default">Conditions de paiement</Label>
                <Textarea
                  id="payment_terms_default"
                  rows={2}
                  placeholder="Paiement à réception de facture. Chèque, virement ou espèces."
                  {...register("payment_terms_default")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Gmail Connection - outside form since it has its own actions */}
          <GmailConnectionCard />

          {/* Google Calendar Connection */}
          <GoogleCalendarCard />

          {/* Signature email */}
          <Card>
            <CardHeader>
              <CardTitle>Signature email</CardTitle>
              <CardDescription>Texte ajouté en bas de chaque email envoyé</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                placeholder="Cordialement,&#10;Votre entreprise&#10;01 23 45 67 89"
                {...register("email_signature")}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={update.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {update.isPending ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </div>
        </form>

        {/* Informations légales */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Informations légales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <a href="/cgu" className="text-primary hover:underline">CGU</a>
              <a href="/mentions-legales" className="text-primary hover:underline">Mentions légales</a>
              <a href="/politique-confidentialite" className="text-primary hover:underline">Confidentialité</a>
              <a href="/dpa" className="text-primary hover:underline">DPA</a>
              <a href="/cookies" className="text-primary hover:underline">Cookies</a>
            </div>
          </CardContent>
        </Card>

        {/* Déconnexion */}
        <div className="mt-6 mb-24">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </Button>
        </div>
      </main>
    </div>
  );
}