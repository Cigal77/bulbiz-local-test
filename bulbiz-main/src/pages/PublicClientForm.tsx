import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Shield,
  Info,
  Calendar,
  Clock,
  Plus,
  Building2,
  User,
  ArrowUpDown,
  KeyRound,
  CalendarDays,
} from "lucide-react";
import { BulbizLogo } from "@/components/BulbizLogo";
import { TRADE_TYPES, HOUSING_TYPES, OCCUPANT_TYPES, AVAILABILITY_OPTIONS } from "@/lib/trade-types";
import { AddressAutocomplete, type AddressData } from "@/components/AddressAutocomplete";
import { cn } from "@/lib/utils";
import { validateEmail, EMAIL_VALIDATION_ERROR } from "@/lib/email-validation";
import { toast } from "sonner";

const CEDRIC_SCHORR_TRADES: typeof TRADE_TYPES = [
  { id: "plomberie", label: "Plomberie", icon: "🛠️", problems: [] },
  { id: "chauffage", label: "Chauffage", icon: "🔥", problems: [] },
  { id: "sanitaire", label: "Sanitaire", icon: "🚿", problems: [] },
  { id: "depannage", label: "Dépannage", icon: "⚡", problems: [] },
  { id: "chantier_renovation", label: "Chantier et rénovation", icon: "🏗️", problems: [] },
];

const CUSTOM_TRADES_BY_EMAIL: Record<string, typeof TRADE_TYPES> = {
  "schorr.cedric@gmail.com": CEDRIC_SCHORR_TRADES,
};

const MAX_FILES = 15;
const MAX_FILE_SIZE = 200 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/3gpp",
];

interface ArtisanProfile {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  client_slots_enabled?: boolean;
}

interface ProposedSlot {
  date: string;
  time: string;
}

const URGENCY_OPTIONS = [
  { value: "aujourdhui", label: "Aujourd'hui" },
  { value: "48h", label: "Sous 48h" },
  { value: "semaine", label: "Dans la semaine" },
];

export default function PublicClientForm() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [artisan, setArtisan] = useState<ArtisanProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [existingDossier, setExistingDossier] = useState<any>(null);
  const [step, setStep] = useState(1);

  const slotsEnabled = artisan?.client_slots_enabled !== false;
  const TOTAL_STEPS = slotsEnabled ? 6 : 5;

  const [form, setForm] = useState({
    client_first_name: "",
    client_last_name: "",
    client_phone: "",
    client_email: "",
    description: "",
    urgency: "semaine",
  });
  const [addressData, setAddressData] = useState<Partial<AddressData>>({});
  const [addressInput, setAddressInput] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCurrent, setUploadCurrent] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [rgpdConsent, setRgpdConsent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [housingType, setHousingType] = useState("");
  const [occupantType, setOccupantType] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const [hasElevator, setHasElevator] = useState<boolean | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [availability, setAvailability] = useState("");

  // Slot proposal state
  const [proposedSlots, setProposedSlots] = useState<ProposedSlot[]>([
    { date: "", time: "09:00" },
    { date: "", time: "14:00" },
    { date: "", time: "10:00" },
  ]);
  const [slotErrors, setSlotErrors] = useState<(string | null)[]>([null, null, null]);
  const [checkingSlots, setCheckingSlots] = useState(false);

  const galleryRef = React.useRef<HTMLInputElement>(null);

  // Load artisan profile
  useEffect(() => {
    async function loadArtisan() {
      if (!slug) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .rpc("get_public_profile_by_slug", { _slug: slug });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        setNotFound(true);
      } else {
        // Email is intentionally not exposed by the RPC; provide null fallback for downstream logic
        setArtisan({ ...row, email: null, phone: null } as any);
      }
      setLoading(false);
    }
    loadArtisan();
  }, [slug]);

  const artisanName =
    artisan?.company_name || [artisan?.first_name, artisan?.last_name].filter(Boolean).join(" ") || "Artisan";

  const activeTrades = (artisan?.email && CUSTOM_TRADES_BY_EMAIL[artisan.email.toLowerCase()]) || TRADE_TYPES;

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const picked = Array.from(e.target.files);
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const f of picked) {
      const baseType = (f.type || "").split(";")[0].trim().toLowerCase();
      if (!ALLOWED_TYPES.includes(baseType)) {
        rejected.push(`${f.name} (format non supporté)`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        rejected.push(`${f.name} (> ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} Mo)`);
        continue;
      }
      accepted.push(f);
    }
    setFiles((prev) => {
      const remaining = MAX_FILES - prev.length;
      if (accepted.length > remaining) {
        toast.warning(
          `Maximum ${MAX_FILES} fichiers : ${accepted.length - Math.max(0, remaining)} ignoré(s).`,
        );
      }
      return [...prev, ...accepted].slice(0, MAX_FILES);
    });
    if (rejected.length > 0) {
      toast.error(`${rejected.length} fichier(s) ignoré(s)`, {
        description: rejected.slice(0, 3).join(" · ") + (rejected.length > 3 ? "…" : ""),
      });
    }
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // Slot helpers
  function updateSlot(index: number, field: keyof ProposedSlot, value: string) {
    setProposedSlots((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
    setSlotErrors((prev) => prev.map((e, i) => (i === index ? null : e)));
  }

  function addSlot() {
    if (proposedSlots.length >= 5) return;
    setProposedSlots((prev) => [...prev, { date: "", time: "09:00" }]);
    setSlotErrors((prev) => [...prev, null]);
  }

  function removeSlot(index: number) {
    if (proposedSlots.length <= 3) return;
    setProposedSlots((prev) => prev.filter((_, i) => i !== index));
    setSlotErrors((prev) => prev.filter((_, i) => i !== index));
  }

  function getValidSlots(): ProposedSlot[] {
    return proposedSlots.filter((s) => s.date && s.time);
  }

  function hasDuplicateSlots(): boolean {
    const valid = getValidSlots();
    const keys = valid.map((s) => `${s.date}_${s.time}`);
    return new Set(keys).size !== keys.length;
  }

  function hasMinimumSlots(): boolean {
    return getValidSlots().length >= 3;
  }

  function hasFutureSlots(): boolean {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    return getValidSlots().every((s) => s.date >= today);
  }

  async function checkSlotAvailability(): Promise<boolean> {
    const valid = getValidSlots();
    if (valid.length < 3) return false;

    setCheckingSlots(true);
    try {
      const slotsToCheck = valid.map((s) => ({
        date: s.date,
        time_start: s.time,
        time_end: `${String(Math.min(23, parseInt(s.time.split(":")[0]) + 2)).padStart(2, "0")}:${s.time.split(":")[1]}`,
      }));

      const { data, error } = await supabase.functions.invoke("check-slot-availability", {
        body: { slug, slots: slotsToCheck },
      });

      if (error || !data?.results) return true;

      const newErrors: (string | null)[] = proposedSlots.map(() => null);
      let hasConflict = false;

      data.results.forEach((result: any, idx: number) => {
        if (!result.available) {
          newErrors[idx] = result.reason || "Ce créneau est déjà réservé.";
          hasConflict = true;
        }
      });

      setSlotErrors(newErrors);
      return !hasConflict;
    } catch {
      return true;
    } finally {
      setCheckingSlots(false);
    }
  }

  async function handleSubmit() {
    if (!form.client_first_name.trim() || !form.client_last_name.trim()) return;
    if (form.client_email && !validateEmail(form.client_email)) {
      setEmailError(EMAIL_VALIDATION_ERROR);
      return;
    }
    if (!rgpdConsent) return;

    setSubmitting(true);
    setUploadProgress(10);

    try {
      const mediaUrls: string[] = [];
      if (files.length > 0) {
        setUploadTotal(files.length);
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setUploadCurrent(i + 1);
          const formData = new FormData();
          formData.append("file", file);
          formData.append("slug", slug!);

          const uploadUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-client-media`;
          const resp = await fetch(uploadUrl, {
            method: "POST",
            headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
            body: formData,
          });
          const result = await resp.json();
          if (result.url) mediaUrls.push(result.url);
          setUploadProgress(10 + ((i + 1) / files.length) * 50);
        }
      }

      setUploadProgress(70);

      const validSlots = getValidSlots().map((s) => ({
        date: s.date,
        time_start: s.time,
        time_end: `${String(Math.min(23, parseInt(s.time.split(":")[0]) + 2)).padStart(2, "0")}:${s.time.split(":")[1]}`,
      }));

      const submitData = {
        ...form,
        address: addressData.address || addressInput,
        address_line: addressData.address_line || "",
        postal_code: postalCode || addressData.postal_code || "",
        city: city || addressData.city || "",
        country: addressData.country || "France",
        google_place_id: addressData.google_place_id || "",
        lat: addressData.lat,
        lng: addressData.lng,
        trade_types: selectedTrades,
        category: "autre",
        housing_type: housingType || null,
        occupant_type: occupantType || null,
        floor_number: floorNumber ? parseInt(floorNumber) : null,
        has_elevator: hasElevator,
        access_code: accessCode || null,
        availability: availability || null,
      };

      const { data: result, error } = await supabase.functions.invoke("submit-public-form", {
        body: {
          slug,
          data: submitData,
          media_urls: mediaUrls,
          rgpd_consent: true,
          proposed_slots: validSlots,
        },
      });

      setUploadProgress(100);

      if (error) throw error;
      if (result?.existing_dossier) setExistingDossier(result.existing_dossier);
      setSuccess(true);
    } catch (err) {
      console.error("Submit error:", err);
      const { logErrorFromCatch } = await import("@/lib/error-logger");
      logErrorFromCatch(err, {
        function_name: "PublicClientForm.handleSubmit",
        metadata: { slug, step, trades: selectedTrades },
      });
      alert("Erreur lors de l'envoi. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  // Loading
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not found
  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <h2 className="text-xl font-semibold text-foreground">Page introuvable</h2>
            <p className="text-muted-foreground text-center">
              Ce lien n'est pas valide. Vérifiez l'adresse ou contactez votre artisan.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
            <CheckCircle2 className="h-14 w-14 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Demande envoyée !</h2>
            <p className="text-muted-foreground text-center">
              Votre demande a été transmise à <strong>{artisanName}</strong>.
              {form.client_email && " Vous recevrez un email de confirmation."}
            </p>
            <p className="text-sm text-muted-foreground text-center">
              {artisanName} reviendra vers vous rapidement pour confirmer un créneau.
            </p>
            {existingDossier && (
              <div className="bg-accent/50 border border-accent rounded-lg p-3 text-sm text-center w-full">
                <Info className="h-4 w-4 inline mr-1 text-accent-foreground" />
                Une demande précédente existe déjà pour ces coordonnées. Votre nouvelle demande a bien été créée
                séparément.
              </div>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setSuccess(false);
                setForm({
                  client_first_name: "",
                  client_last_name: "",
                  client_phone: "",
                  client_email: "",
                  description: "",
                  urgency: "semaine",
                });
                setFiles([]);
                setAddressData({});
                setAddressInput("");
                setSelectedTrades([]);
                setRgpdConsent(false);
                setProposedSlots([
                  { date: "", time: "09:00" },
                  { date: "", time: "14:00" },
                  { date: "", time: "10:00" },
                ]);
                setSlotErrors([null, null, null]);
                setHousingType("");
                setOccupantType("");
                setFloorNumber("");
                setHasElevator(null);
                setAccessCode("");
                setAvailability("");
                setStep(1);
                setExistingDossier(null);
              }}
            >
              Envoyer une autre demande
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const validationStep = TOTAL_STEPS;
  const slotStep = slotsEnabled ? 5 : -1;

  const canGoNext = () => {
    if (step === 1) return selectedTrades.length > 0;
    if (step === 2)
      return (
        form.client_first_name.trim() &&
        form.client_last_name.trim() &&
        form.client_email.trim() !== "" &&
        validateEmail(form.client_email)
      );
    if (step === 3) return true;
    if (step === 4) return true; // infos pratiques - all optional
    if (slotsEnabled && step === 5) return hasMinimumSlots() && !hasDuplicateSlots() && hasFutureSlots();
    if (step === validationStep) return rgpdConsent;
    return false;
  };

  const handleNextFromSlots = async () => {
    if (!canGoNext()) return;
    const available = await checkSlotAvailability();
    if (available) {
      setStep(validationStep);
    }
  };

  const formatSlotDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <BulbizLogo />
          <span className="text-sm font-medium text-muted-foreground">{artisanName}</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 pb-24">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>
              Étape {step}/{TOTAL_STEPS}
            </span>
            <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <Progress value={(step / TOTAL_STEPS) * 100} className="h-2" />
        </div>

        {/* Step 1: Trade selection */}
        {/* Caché via CSS au lieu d'être démonté pour éviter le crash insertBefore sur Android */}
        <Card key="step-1" className={cn(step !== 1 && "hidden")}>
          <CardHeader>
            <CardTitle className="text-lg">Type d'intervention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Sélectionnez le(s) type(s) de travaux concernés :</p>
            <div className="grid grid-cols-2 gap-2">
              {activeTrades.map((trade) => (
                <button
                  key={trade.id}
                  type="button"
                  onClick={() => {
                    setSelectedTrades((prev) =>
                      prev.includes(trade.id) ? prev.filter((t) => t !== trade.id) : [...prev, trade.id],
                    );
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                    selectedTrades.includes(trade.id)
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <span>{trade.icon}</span>
                  <span>{trade.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Client info */}
        <Card key="step-2" className={cn(step !== 2 && "hidden")}>
          <CardHeader>
            <CardTitle className="text-lg">Vos coordonnées</CardTitle>
          </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="first_name">Prénom *</Label>
                  <Input
                    id="first_name"
                    value={form.client_first_name}
                    onChange={(e) => setForm({ ...form, client_first_name: e.target.value })}
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last_name">Nom *</Label>
                  <Input
                    id="last_name"
                    value={form.client_last_name}
                    onChange={(e) => setForm({ ...form, client_last_name: e.target.value })}
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={form.client_phone}
                  onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  value={form.client_email}
                  onChange={(e) => {
                    setForm({ ...form, client_email: e.target.value });
                    setEmailError("");
                  }}
                  autoComplete="email"
                />
                {emailError && <p className="text-xs text-destructive">{emailError}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Adresse d'intervention</Label>
                <AddressAutocomplete
                  value={addressInput}
                  onChange={(v) => setAddressInput(v)}
                  onAddressSelect={(data) => {
                    setAddressData(data);
                    setAddressInput(data.address || "");
                    if (data.postal_code) setPostalCode(data.postal_code);
                    if (data.city) setCity(data.city);
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="postal_code">Code postal</Label>
                  <Input
                    id="postal_code"
                    placeholder="75002"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    maxLength={10}
                    autoComplete="postal-code"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    placeholder="Paris"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    maxLength={100}
                    autoComplete="address-level2"
                  />
                </div>
              </div>
            </CardContent>
        </Card>

        {/* Step 3: Problem description + media */}
        <Card key="step-3" className={cn(step !== 3 && "hidden")}>
          <CardHeader>
            <CardTitle className="text-lg">Décrivez votre problème</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={4}
                  placeholder="Décrivez votre problème en quelques mots..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              {/* Urgency: boutons natifs à la place du Select Radix (fix crash Android portal) */}
              <div className="space-y-1.5">
                <Label>Urgence</Label>
                <div className="flex gap-2">
                  {URGENCY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, urgency: opt.value })}
                      className={cn(
                        "flex-1 rounded-lg border p-2 text-sm transition-colors",
                        form.urgency === opt.value
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Media upload */}
              <div className="space-y-2">
                <Label>
                  Photos / Vidéos ({files.length}/{MAX_FILES})
                </Label>
                {files.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {files.map((f, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden border aspect-square bg-muted">
                        {f.type.startsWith("image") ? (
                          <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Camera className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {files.length < MAX_FILES && (
                  <>
                    <input
                      ref={galleryRef}
                      type="file"
                      accept={ALLOWED_TYPES.join(",")}
                      multiple
                      className="hidden"
                      onChange={handleFileAdd}
                    />
                    <button
                      type="button"
                      onClick={() => galleryRef.current?.click()}
                      className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-6 w-full hover:border-primary/50 transition-colors"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Ajouter des photos ou vidéos</span>
                      <span className="text-xs text-muted-foreground mt-1">
                        Sélection multiple possible · JPG, PNG, HEIC, MP4, MOV · 200 Mo max · {MAX_FILES} fichiers max
                      </span>
                    </button>
                  </>
                )}
              </div>
          </CardContent>
        </Card>

        {/* Step 4: Infos pratiques */}
        <Card key="step-4" className={cn(step !== 4 && "hidden")}>
          <CardHeader>
            <CardTitle className="text-lg">Quelques infos pratiques</CardTitle>
            <CardDescription>
              Pour intervenir dans les meilleures conditions.{" "}
              <span className="text-primary font-medium">Tout est facultatif.</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
              {/* Housing type */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Type de logement
                </Label>
                <div className="flex flex-wrap gap-2">
                  {HOUSING_TYPES.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => setHousingType(housingType === h.id ? "" : h.id)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-sm transition-all active:scale-95",
                        housingType === h.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-primary/40",
                      )}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Occupant type */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Vous êtes
                </Label>
                <div className="flex flex-wrap gap-2">
                  {OCCUPANT_TYPES.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setOccupantType(occupantType === o.id ? "" : o.id)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-sm transition-all active:scale-95",
                        occupantType === o.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-primary/40",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Access info */}
              <div className="space-y-3">
                <Label className="text-xs flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  Accès
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Étage</Label>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      placeholder="Ex : 3"
                      value={floorNumber}
                      onChange={(e) => setFloorNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Ascenseur</Label>
                    <div className="flex gap-2 h-10 items-center">
                      <button
                        onClick={() => setHasElevator(hasElevator === true ? null : true)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm transition-all",
                          hasElevator === true
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card",
                        )}
                      >
                        Oui
                      </button>
                      <button
                        onClick={() => setHasElevator(hasElevator === false ? null : false)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm transition-all",
                          hasElevator === false
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card",
                        )}
                      >
                        Non
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <KeyRound className="h-3 w-3" />
                    Digicode / badge
                  </Label>
                  <Input
                    placeholder="Ex : 1234A"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    maxLength={50}
                  />
                </div>
              </div>

              {/* Availability */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Disponibilités
                </Label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABILITY_OPTIONS.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setAvailability(availability === a.id ? "" : a.id)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-sm transition-all active:scale-95",
                        availability === a.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-primary/40",
                      )}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 5: Slot proposals (only if enabled) */}
        {slotsEnabled && (
          <Card key="step-slots" className={cn(step !== slotStep && "hidden")}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Proposer des créneaux
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Afin d'organiser l'intervention, merci de proposer <strong>3 créneaux de disponibilité minimum</strong>.
                L'artisan confirmera ensuite le rendez-vous.
              </p>

              <div className="space-y-3">
                {proposedSlots.map((slot, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center gap-1 mb-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        Créneau {idx + 1} {idx < 3 ? "*" : "(optionnel)"}
                      </span>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Input
                          type="date"
                          value={slot.date}
                          min={new Date().toISOString().split("T")[0]}
                          onChange={(e) => updateSlot(idx, "date", e.target.value)}
                          className={cn("h-10 text-sm", slotErrors[idx] && "border-destructive")}
                        />
                      </div>
                      <div className="w-24 space-y-1">
                        <Input
                          type="time"
                          value={slot.time}
                          onChange={(e) => updateSlot(idx, "time", e.target.value)}
                          className={cn("h-10 text-sm", slotErrors[idx] && "border-destructive")}
                        />
                      </div>
                      {proposedSlots.length > 3 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          onClick={() => removeSlot(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {slotErrors[idx] && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        {slotErrors[idx]}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {proposedSlots.length < 5 && (
                <Button variant="ghost" size="sm" onClick={addSlot} className="gap-1 text-xs">
                  <Plus className="h-3 w-3" /> Ajouter un créneau
                </Button>
              )}

              {hasDuplicateSlots() && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Certains créneaux sont identiques. Merci de proposer des créneaux différents.
                </p>
              )}

              {!hasFutureSlots() && getValidSlots().length > 0 && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Les créneaux doivent être à une date future.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Validation step */}
        <Card key="step-validation" className={cn(step !== validationStep && "hidden")}>
          <CardHeader>
            <CardTitle className="text-lg">Confirmation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              {/* Summary */}
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
                <p>
                  <strong>Type :</strong>{" "}
                  {selectedTrades.map((t) => TRADE_TYPES.find((tt) => tt.id === t)?.label).join(", ") || "—"}
                </p>
                <p>
                  <strong>Nom :</strong> {form.client_first_name} {form.client_last_name}
                </p>
                {form.client_phone && (
                  <p>
                    <strong>Tél :</strong> {form.client_phone}
                  </p>
                )}
                {form.client_email && (
                  <p>
                    <strong>Email :</strong> {form.client_email}
                  </p>
                )}
                {(addressData.address || addressInput) && (
                  <p>
                    <strong>Adresse :</strong> {addressData.address || addressInput}
                  </p>
                )}
                {form.description && (
                  <p>
                    <strong>Description :</strong> {form.description}
                  </p>
                )}
                <p>
                  <strong>Urgence :</strong> {URGENCY_OPTIONS.find((o) => o.value === form.urgency)?.label}
                </p>
                {files.length > 0 && (
                  <p>
                    <strong>Médias :</strong> {files.length} fichier(s)
                  </p>
                )}

                {/* Infos pratiques summary */}
                {(housingType || occupantType || floorNumber || hasElevator !== null || accessCode || availability) && (
                  <div className="space-y-1">
                    <strong>Infos pratiques :</strong>
                    {housingType && <p>{HOUSING_TYPES.find((h) => h.id === housingType)?.label}</p>}
                    {occupantType && <p>{OCCUPANT_TYPES.find((o) => o.id === occupantType)?.label}</p>}
                    {floorNumber && <p>Étage {floorNumber}{hasElevator === true ? " (avec ascenseur)" : hasElevator === false ? " (sans ascenseur)" : ""}</p>}
                    {!floorNumber && hasElevator !== null && <p>Ascenseur : {hasElevator ? "Oui" : "Non"}</p>}
                    {accessCode && <p>Digicode : {accessCode}</p>}
                    {availability && <p>Dispo : {AVAILABILITY_OPTIONS.find((a) => a.id === availability)?.label}</p>}
                  </div>
                )}

                {/* Proposed slots summary */}
                {slotsEnabled && getValidSlots().length > 0 && (
                  <div>
                    <strong>Créneaux proposés :</strong>
                    <ul className="mt-1 space-y-1">
                      {getValidSlots().map((s, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-sm">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          {formatSlotDate(s.date)} à {s.time}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Checkbox id="rgpd" checked={rgpdConsent} onCheckedChange={(v) => setRgpdConsent(v === true)} />
                <Label htmlFor="rgpd" className="text-xs leading-relaxed cursor-pointer">
                  J'accepte que mes données soient traitées par {artisanName} pour le suivi de ma demande, conformément
                  à la{" "}
                  <a href="/politique-confidentialite" target="_blank" className="underline text-primary">
                    politique de confidentialité
                  </a>
                  .
                </Label>
              </div>

              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Vos données sont sécurisées et ne seront partagées qu'avec {artisanName}.</span>
              </div>

              {submitting && (
                <div className="space-y-1">
                  {uploadTotal > 0 && uploadCurrent <= uploadTotal && (
                    <p className="text-xs text-muted-foreground">
                      Envoi du fichier {uploadCurrent} / {uploadTotal}…
                    </p>
                  )}
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={() => setStep(step - 1)}
            disabled={submitting}
            className={cn("flex-1", step <= 1 && "hidden")}
          >
            Retour
          </Button>
          {step < TOTAL_STEPS ? (
            step === slotStep ? (
              <Button onClick={handleNextFromSlots} disabled={!canGoNext() || checkingSlots} className="flex-1 gap-2">
                {checkingSlots && <Loader2 className="h-4 w-4 animate-spin" />}
                {checkingSlots ? "Vérification..." : "Suivant"}
              </Button>
            ) : (
              <Button onClick={() => setStep(step + 1)} disabled={!canGoNext()} className="flex-1">
                Suivant
              </Button>
            )
          ) : (
            <Button onClick={handleSubmit} disabled={submitting || !rgpdConsent} className="flex-1 gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? "Envoi en cours..." : "Envoyer ma demande"}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
