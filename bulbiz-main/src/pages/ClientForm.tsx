import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Shield,
  Calendar,
  Clock,
  Info,
  Video,
  Building2,
  User,
  ArrowUpDown,
  KeyRound,
  CalendarDays,
} from "lucide-react";
import { VideoRecorderWithTorch } from "@/components/VideoRecorderWithTorch";
import { BulbizLogo } from "@/components/BulbizLogo";
import { URGENCY_LABELS } from "@/lib/constants";
import { TRADE_TYPES, HOUSING_TYPES, OCCUPANT_TYPES, AVAILABILITY_OPTIONS } from "@/lib/trade-types";
import { AddressAutocomplete, type AddressData } from "@/components/AddressAutocomplete";
import { cn } from "@/lib/utils";
import { validateEmail, EMAIL_VALIDATION_ERROR } from "@/lib/email-validation";
import { toast } from "sonner";

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

interface SlotData {
  id: string;
  slot_date: string;
  time_start: string;
  time_end: string;
  selected_at: string | null;
}

interface DossierData {
  dossier_id: string;
  client_first_name: string | null;
  client_last_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  address: string | null;
  postal_code?: string | null;
  city?: string | null;
  category: string;
  urgency: string;
  description: string | null;
  status: string;
  appointment_status?: string;
  appointment_slots?: SlotData[];
  artisan_name?: string;
  artisan_logo_url?: string | null;
  trade_types?: string[];
  problem_types?: string[];
  housing_type?: string | null;
  occupant_type?: string | null;
  floor_number?: number | null;
  has_elevator?: boolean | null;
  access_code?: string | null;
  availability?: string | null;
}


function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s.\-()]/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return "+33" + cleaned.slice(1);
  }
  return cleaned;
}

function PrefilledBadge() {
  return (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal gap-0.5">
      <Info className="h-2.5 w-2.5" />
      Pré-rempli
    </Badge>
  );
}

function ReassuranceBanner() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 border border-primary/10 p-4 text-sm text-muted-foreground">
      <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
      <div>
        <p className="font-medium text-foreground text-xs">Ces informations sont facultatives</p>
        <p className="text-xs mt-0.5">
          Elles nous permettent simplement de mieux préparer l'intervention et d'éviter des allers-retours inutiles.
        </p>
      </div>
    </div>
  );
}

export default function ClientForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [slotSuccess, setSlotSuccess] = useState(false);
  const [autoConfirmed, setAutoConfirmed] = useState(false);
  const [emailError, setEmailError] = useState("");

  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [form, setForm] = useState({
    client_first_name: "",
    client_last_name: "",
    client_phone: "",
    client_email: "",
    address: "",
    description: "",
    urgency: "semaine",
  });
  const [addressData, setAddressData] = useState<Partial<AddressData>>({});
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCurrent, setUploadCurrent] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [rgpdConsent, setRgpdConsent] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectingSlot, setSelectingSlot] = useState(false);
  const [videoRecorderOpen, setVideoRecorderOpen] = useState(false);

  // New multi-trade fields
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [otherTrade, setOtherTrade] = useState("");
  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);
  const [otherProblem, setOtherProblem] = useState("");

  // Practical info
  const [housingType, setHousingType] = useState("");
  const [occupantType, setOccupantType] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const [hasElevator, setHasElevator] = useState<boolean | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [availability, setAvailability] = useState("");

  const hasSlots = (dossier?.appointment_slots?.length ?? 0) > 0;
  const isSlotMode =
    hasSlots && (dossier?.appointment_status === "slots_proposed" || dossier?.appointment_status === "client_selected");
  const alreadySelected = dossier?.appointment_slots?.find((s) => s.selected_at);

  const [prefilled, setPrefilled] = useState<Set<string>>(new Set());
  const galleryRef = React.useRef<HTMLInputElement>(null);
  const camcorderRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) {
      setError("Lien invalide. Veuillez contacter votre artisan.");
      setLoading(false);
      return;
    }
    loadDossier();
  }, [token]);

  const loadDossier = async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("submit-client-form", {
        body: { token, action: "get" },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setDossier(data);

      const pf = new Set<string>();
      const newForm = { ...form };
      if (data.client_first_name) {
        newForm.client_first_name = data.client_first_name;
        pf.add("client_first_name");
      }
      if (data.client_last_name) {
        newForm.client_last_name = data.client_last_name;
        pf.add("client_last_name");
      }
      if (data.client_phone) {
        newForm.client_phone = data.client_phone;
        pf.add("client_phone");
      }
      if (data.client_email) {
        newForm.client_email = data.client_email;
        pf.add("client_email");
      }
      if (data.address) {
        newForm.address = data.address;
        pf.add("address");
      }
      if (data.description) {
        newForm.description = data.description;
        pf.add("description");
      }
      if (data.urgency) {
        newForm.urgency = data.urgency;
        if (data.urgency !== "semaine") pf.add("urgency");
      }
      setForm(newForm);
      setPrefilled(pf);

      // Pre-fill new fields
      if (data.trade_types?.length) setSelectedTrades(data.trade_types);
      if (data.problem_types?.length) setSelectedProblems(data.problem_types);
      if (data.postal_code) setPostalCode(data.postal_code);
      if (data.city) setCity(data.city);
      if (data.housing_type) setHousingType(data.housing_type);
      if (data.occupant_type) setOccupantType(data.occupant_type);
      if (data.floor_number != null) setFloorNumber(String(data.floor_number));
      if (data.has_elevator != null) setHasElevator(data.has_elevator);
      if (data.access_code) setAccessCode(data.access_code);
      if (data.availability) setAvailability(data.availability);

      const existing = data?.appointment_slots?.find((s: SlotData) => s.selected_at);
      if (existing) setSelectedSlotId(existing.id);
    } catch (e: any) {
      setError(e.message || "Lien invalide ou expiré");
    } finally {
      setLoading(false);
    }
  };

  const handleSlotSelect = async () => {
    if (!selectedSlotId || selectingSlot) return;
    setSelectingSlot(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("submit-client-form", {
        body: { token, action: "select_slot", slot_id: selectedSlotId },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      if (data?.auto_confirmed) setAutoConfirmed(true);
      setSlotSuccess(true);
    } catch (e: any) {
      setError(e.message || "Erreur lors de la sélection");
    } finally {
      setSelectingSlot(false);
    }
  };

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
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
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));
  const handleVideoRecorded = (file: File) => setFiles((prev) => [...prev, file].slice(0, MAX_FILES));

  const toggleTrade = (id: string) => {
    setSelectedTrades((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const toggleProblem = (id: string) => {
    setSelectedProblems((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  // Get available problems based on selected trades
  const availableProblems = TRADE_TYPES.filter((t) => selectedTrades.includes(t.id)).flatMap((t) => t.problems);

  const handleSubmit = async () => {
    if (!rgpdConsent || !dossier || submitting) return;
    if (form.client_email && !validateEmail(form.client_email)) {
      setEmailError(EMAIL_VALIDATION_ERROR);
      setStep(2);
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);
    setError(null);

    try {
      const mediaUrls: { url: string; name: string; type: string; size: number }[] = [];
      if (files.length > 0) {
        setUploadTotal(files.length);
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setUploadCurrent(i + 1);
          const formData = new FormData();
          formData.append("token", token!);
          formData.append("file", file);
          const res = await fetch(`${supabaseUrl}/functions/v1/upload-client-media`, {
            method: "POST",
            headers: {
              apikey: anonKey,
            },
            body: formData,
          });
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `Erreur upload (${res.status})`);
          }
          const data = await res.json();
          mediaUrls.push({ url: data.url, name: data.name, type: data.type, size: data.size });
          setUploadProgress(Math.round(((i + 1) / files.length) * 100));
        }
      }

      const clientData: Record<string, unknown> = {};
      const normalizedPhone = form.client_phone ? normalizePhone(form.client_phone) : "";

      if (form.client_first_name.trim()) clientData.client_first_name = form.client_first_name.trim();
      if (form.client_last_name.trim()) clientData.client_last_name = form.client_last_name.trim();
      if (normalizedPhone) clientData.client_phone = normalizedPhone;
      if (form.client_email.trim()) clientData.client_email = form.client_email.trim();
      if (form.address.trim()) clientData.address = form.address.trim();
      if (form.description.trim()) clientData.description = form.description.trim();
      if (form.urgency) clientData.urgency = form.urgency;

      // Address data — always send postal_code and city
      if (addressData.google_place_id) {
        clientData.google_place_id = addressData.google_place_id;
        if (addressData.lat) clientData.lat = String(addressData.lat);
        if (addressData.lng) clientData.lng = String(addressData.lng);
        if (addressData.address_line) clientData.address_line = addressData.address_line;
      }
      const finalPostalCode = postalCode || addressData.postal_code || "";
      const finalCity = city || addressData.city || "";
      if (finalPostalCode) clientData.postal_code = finalPostalCode;
      if (finalCity) clientData.city = finalCity;

      // New fields
      if (selectedTrades.length > 0) clientData.trade_types = selectedTrades;
      if (selectedProblems.length > 0) clientData.problem_types = selectedProblems;
      if (otherTrade.trim()) clientData.other_trade = otherTrade.trim();
      if (otherProblem.trim()) clientData.other_problem = otherProblem.trim();
      if (housingType) clientData.housing_type = housingType;
      if (occupantType) clientData.occupant_type = occupantType;
      if (floorNumber) clientData.floor_number = parseInt(floorNumber, 10);
      if (hasElevator !== null) clientData.has_elevator = hasElevator;
      if (accessCode.trim()) clientData.access_code = accessCode.trim();
      if (availability) clientData.availability = availability;

      const { data, error: fnError } = await supabase.functions.invoke("submit-client-form", {
        body: { token, action: "submit", data: clientData, media_urls: mediaUrls, rgpd_consent: true },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setSuccess(true);
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'envoi");
    } finally {
      setSubmitting(false);
    }
  };

  const formatSlotDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const months = [
      "janvier",
      "février",
      "mars",
      "avril",
      "mai",
      "juin",
      "juillet",
      "août",
      "septembre",
      "octobre",
      "novembre",
      "décembre",
    ];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  };

  // Loading / Error / Success / Slot states (unchanged logic)
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !dossier) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-foreground font-medium">{error}</p>
            <p className="text-sm text-muted-foreground">Contactez votre artisan pour obtenir un nouveau lien.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (slotSuccess) {
    const chosen = dossier?.appointment_slots?.find((s) => s.id === selectedSlotId);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
            <h2 className="text-xl font-bold text-foreground">
              {autoConfirmed ? "Rendez-vous confirmé !" : "Créneau confirmé !"}
            </h2>
            {chosen && (
              <div className="rounded-lg bg-success/10 border border-success/20 p-4">
                <p className="text-sm font-semibold text-foreground flex items-center justify-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatSlotDate(chosen.slot_date)}
                </p>
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                  <Clock className="h-3.5 w-3.5" />
                  {chosen.time_start.slice(0, 5)} – {chosen.time_end.slice(0, 5)}
                </p>
              </div>
            )}
            <p className="text-muted-foreground text-sm">
              {autoConfirmed
                ? "Votre rendez-vous est confirmé. Un email de confirmation vous a été envoyé."
                : "Votre artisan va confirmer le rendez-vous. Vous recevrez une notification."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Merci !</h2>
            <p className="text-muted-foreground">
              Vos informations ont été envoyées. Votre artisan reviendra vers vous rapidement.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Slot selection mode (unchanged)
  if (isSlotMode) {
    const slots = dossier?.appointment_slots ?? [];
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background/95 backdrop-blur px-4 py-3">
          <div className="max-w-lg mx-auto">
            <span className="text-lg font-bold text-foreground">{dossier?.artisan_name || "Votre artisan"}</span>
          </div>
        </header>
        <main className="p-4 max-w-lg mx-auto mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Choisissez votre créneau
              </CardTitle>
              <CardDescription>Sélectionnez le créneau qui vous convient le mieux pour l'intervention.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {slots.map((slot) => {
                const isSelected = selectedSlotId === slot.id;
                const wasAlreadyChosen = !!slot.selected_at;
                return (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={cn(
                      "w-full text-left rounded-xl border-2 p-4 min-h-[56px] transition-all active:scale-[0.98]",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                        : "border-border hover:border-primary/40 bg-card",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                          isSelected ? "border-primary bg-primary" : "border-muted-foreground/30",
                        )}
                      >
                        {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-base font-semibold text-foreground">{formatSlotDate(slot.slot_date)}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3.5 w-3.5" />
                          {slot.time_start.slice(0, 5)} – {slot.time_end.slice(0, 5)}
                        </p>
                      </div>
                      {wasAlreadyChosen && (
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                          Choisi
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>
          <div className="sticky bottom-4 px-2">
            <Button
              onClick={handleSlotSelect}
              disabled={!selectedSlotId || selectingSlot}
              className="w-full h-12 text-base gap-2 shadow-lg"
            >
              {selectingSlot ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Confirmation…
                </>
              ) : (
                "Confirmer ce créneau"
              )}
            </Button>
            {alreadySelected && selectedSlotId === alreadySelected.id && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Vous avez déjà choisi ce créneau. Vous pouvez en sélectionner un autre.
              </p>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // STANDARD FORM — 5 STEPS
  // 1: Type d'intervention (trades)
  // 2: Vos informations + type de problème + description
  // 3: Infos pratiques (facultatif)
  // 4: Photos/Vidéos
  // 5: Validation RGPD
  // ═══════════════════════════════════════════════════
  const totalSteps = 5;
  const progressPercent = (step / totalSteps) * 100;
  const stepLabels: Record<number, string> = {
    1: "Intervention",
    2: "Informations",
    3: "Infos pratiques",
    4: "Photos",
    5: "Validation",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="max-w-lg mx-auto">
          <span className="text-lg font-bold text-foreground">{dossier?.artisan_name || "Votre artisan"}</span>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto mt-4 space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Étape {step}/{totalSteps}
            </span>
            <span>{stepLabels[step]}</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        <p className="text-sm text-muted-foreground">
          Bonjour{form.client_first_name ? ` ${form.client_first_name}` : ""}, complétez ce formulaire pour que votre
          artisan prépare au mieux son intervention.
        </p>

        {/* ═══ STEP 1: Type d'intervention ═══ */}
        {step === 1 && (
          <Card key="step-1">
            <CardHeader>
              <CardTitle className="text-lg">Quel type d'intervention ?</CardTitle>
              <CardDescription>Sélectionnez un ou plusieurs corps de métier concernés.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                {TRADE_TYPES.map((trade) => {
                  const isSelected = selectedTrades.includes(trade.id);
                  return (
                    <button
                      key={trade.id}
                      onClick={() => toggleTrade(trade.id)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border-2 p-3.5 text-left transition-all active:scale-[0.97] min-h-[56px]",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                          : "border-border hover:border-primary/30 bg-card",
                      )}
                    >
                      <span className="text-xl">{trade.icon}</span>
                      <span className={cn("text-sm font-medium", isSelected ? "text-primary" : "text-foreground")}>
                        {trade.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedTrades.includes("autre_metier") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Précisez le métier</Label>
                  <Input
                    placeholder="Ex : Menuiserie, Serrurerie…"
                    value={otherTrade}
                    onChange={(e) => setOtherTrade(e.target.value)}
                    maxLength={100}
                  />
                </div>
              )}

              {/* Dynamic problem types */}
              {availableProblems.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Type de problème</h4>
                    <p className="text-xs text-muted-foreground">
                      Précisez la nature du problème (plusieurs choix possibles).
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableProblems.map((problem) => {
                      const isSelected = selectedProblems.includes(problem.id);
                      return (
                        <button
                          key={problem.id}
                          onClick={() => toggleProblem(problem.id)}
                          className={cn(
                            "rounded-full border px-3.5 py-1.5 text-sm transition-all active:scale-95",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-card text-foreground hover:border-primary/40",
                          )}
                        >
                          {problem.label}
                        </button>
                      );
                    })}
                  </div>
                  {selectedProblems.some((p) => p.startsWith("autre")) && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Précisez</Label>
                      <Input
                        placeholder="Décrivez le problème…"
                        value={otherProblem}
                        onChange={(e) => setOtherProblem(e.target.value)}
                        maxLength={200}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button onClick={() => setStep(2)} disabled={selectedTrades.length === 0}>
                  Suivant
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ STEP 2: Informations client ═══ */}
        {step === 2 && (
          <>
            {prefilled.size > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 p-3 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                Certaines informations sont pré-remplies par votre artisan. Vous pouvez les corriger si nécessaire.
              </div>
            )}
            <Card key="step-2">
              <CardHeader>
                <CardTitle className="text-lg">Vos informations</CardTitle>
                <CardDescription>Vérifiez et corrigez si besoin.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1.5">
                      Prénom
                      {prefilled.has("client_first_name") && <PrefilledBadge />}
                    </Label>
                    <Input
                      placeholder="Jean"
                      autoComplete="given-name"
                      value={form.client_first_name}
                      onChange={(e) => setForm({ ...form, client_first_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1.5">
                      Nom
                      {prefilled.has("client_last_name") && <PrefilledBadge />}
                    </Label>
                    <Input
                      placeholder="Dupont"
                      autoComplete="family-name"
                      value={form.client_last_name}
                      onChange={(e) => setForm({ ...form, client_last_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    Téléphone
                    {prefilled.has("client_phone") && <PrefilledBadge />}
                  </Label>
                  <Input
                    placeholder="06 12 34 56 78"
                    type="tel"
                    autoComplete="tel"
                    value={form.client_phone}
                    onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    Email
                    {prefilled.has("client_email") && <PrefilledBadge />}
                  </Label>
                  <Input
                    placeholder="client@email.com"
                    type="email"
                    autoComplete="email"
                    value={form.client_email}
                    onChange={(e) => {
                      setForm({ ...form, client_email: e.target.value });
                      setEmailError("");
                    }}
                    className={emailError ? "border-destructive" : ""}
                  />
                  {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    Adresse d'intervention
                    {prefilled.has("address") && <PrefilledBadge />}
                  </Label>
                  <AddressAutocomplete
                    value={form.address}
                    onChange={(val) => {
                      setForm({ ...form, address: val });
                      setAddressData({});
                    }}
                    onAddressSelect={(data) => {
                      setForm({ ...form, address: data.address });
                      setAddressData(data);
                      if (data.postal_code) setPostalCode(data.postal_code);
                      if (data.city) setCity(data.city);
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Code postal</Label>
                    <Input
                      placeholder="75002"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      maxLength={10}
                      autoComplete="postal-code"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ville</Label>
                    <Input
                      placeholder="Paris"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      maxLength={100}
                      autoComplete="address-level2"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    Urgence
                    {prefilled.has("urgency") && <PrefilledBadge />}
                  </Label>
                  <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(URGENCY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    Description du problème
                    {prefilled.has("description") && <PrefilledBadge />}
                  </Label>
                  <Textarea
                    rows={4}
                    placeholder="Ex : Fuite sous l'évier de la cuisine depuis hier soir…"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    maxLength={5000}
                  />
                  <span className="text-xs text-muted-foreground">{form.description.length}/5000</span>
                </div>

                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setStep(1)}>
                    Retour
                  </Button>
                  <Button onClick={() => setStep(3)}>Suivant</Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══ STEP 3: Infos pratiques (facultatif) ═══ */}
        {step === 3 && (
          <>
            <ReassuranceBanner />
            <Card key="step-3">
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

                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setStep(2)}>
                    Retour
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(4)}>
                      Passer
                    </Button>
                    <Button onClick={() => setStep(4)}>Continuer</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══ STEP 4: Photos ═══ */}
        {step === 4 && (
          <Card key="step-4">
            <CardHeader>
              <CardTitle className="text-lg">Ajoutez des photos</CardTitle>
              <CardDescription>Photos ou vidéos du problème (optionnel, max {MAX_FILES} fichiers)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-2">
                      {f.type.startsWith("image/") ? (
                        <img src={URL.createObjectURL(f)} alt="" className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                          <Camera className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <span className="flex-1 text-sm truncate">{f.name}</span>
                      <Button variant="ghost" size="icon" onClick={() => removeFile(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {files.length < MAX_FILES && (
                <div className="space-y-3">
                  {/* Input galerie */}
                  <input
                    ref={galleryRef}
                    type="file"
                    accept={ALLOWED_TYPES.join(",")}
                    multiple
                    className="hidden"
                    onChange={handleFileAdd}
                  />
                  {/* Input caméra vidéo */}
                  <input
                    ref={camcorderRef}
                    type="file"
                    accept="video/*"
                capture="environment"
                className="hidden"
                onChange={handleFileAdd}
                  />

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => galleryRef.current?.click()}
                      className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 hover:border-primary/50 transition-colors"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Photos / vidéos depuis la galerie</span>
                      <span className="text-xs text-muted-foreground mt-1">
                        Sélection multiple possible · JPG, PNG, HEIC, MP4, MOV · 200 Mo max · {MAX_FILES} fichiers max
                      </span>
                    </button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => camcorderRef.current?.click()}
                    >
                      <Camera className="h-4 w-4" />
                      Filmer une vidéo
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setVideoRecorderOpen(true)}
                  >
                    <Video className="h-4 w-4" />
                    Filmer avec flash
                  </Button>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(3)}>
                  Retour
                </Button>
                <Button onClick={() => setStep(5)}>{files.length === 0 ? "Passer" : "Suivant"}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ STEP 5: RGPD + Submit ═══ */}
        {step === 5 && (
          <Card key="step-5">
            <CardHeader>
              <CardTitle className="text-lg">Validation</CardTitle>
              <CardDescription>Relisez et confirmez votre envoi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                <p className="font-medium text-foreground">Récapitulatif :</p>
                {form.client_first_name && (
                  <p className="text-muted-foreground">
                    Client : {form.client_first_name} {form.client_last_name}
                  </p>
                )}
                {selectedTrades.length > 0 && (
                  <p className="text-muted-foreground">
                    Métier(s) :{" "}
                    {selectedTrades.map((t) => TRADE_TYPES.find((tt) => tt.id === t)?.label ?? t).join(", ")}
                  </p>
                )}
                {form.address && <p className="text-muted-foreground truncate">Adresse : {form.address}</p>}
                {form.description && (
                  <p className="text-muted-foreground line-clamp-2">Description : {form.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {files.length} fichier{files.length !== 1 ? "s" : ""} joint{files.length !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Protection de vos données</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Vos données sont traitées uniquement pour la gestion de votre demande d'intervention. Elles ne
                      sont pas partagées avec des tiers.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox id="rgpd" checked={rgpdConsent} onCheckedChange={(v) => setRgpdConsent(v === true)} />
                  <Label htmlFor="rgpd" className="text-sm leading-tight cursor-pointer">
                    J'accepte le traitement de mes données pour la gestion de ma demande
                  </Label>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              {submitting && files.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {uploadTotal > 0 && uploadCurrent <= uploadTotal
                      ? `Envoi du fichier ${uploadCurrent} / ${uploadTotal}…`
                      : "Upload des fichiers…"}
                  </p>
                  <Progress value={uploadProgress} className="h-1.5" />
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(4)}>
                  Retour
                </Button>
                <Button onClick={handleSubmit} disabled={submitting || !rgpdConsent} className="gap-2">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Envoi…
                    </>
                  ) : (
                    "Envoyer"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <VideoRecorderWithTorch
        open={videoRecorderOpen}
        onClose={() => setVideoRecorderOpen(false)}
        onVideoRecorded={handleVideoRecorded}
      />
    </div>
  );
}
