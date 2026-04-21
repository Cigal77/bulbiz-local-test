import { useState } from "react";
import type { Dossier } from "@/hooks/useDossier";
import { useDossierActions } from "@/hooks/useDossierActions";
import { useToast } from "@/hooks/use-toast";
import { CATEGORY_LABELS, URGENCY_LABELS, URGENCY_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { MapPin, Wrench, AlertTriangle, ExternalLink, CheckCircle2, Navigation, Pencil, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddressAutocomplete, type AddressData } from "@/components/AddressAutocomplete";
import type { Database } from "@/integrations/supabase/types";

type ProblemCategory = Database["public"]["Enums"]["problem_category"];
type UrgencyLevel = Database["public"]["Enums"]["urgency_level"];

interface InterventionBlockProps {
  dossier: Dossier;
}

function buildMapsUrl(dossier: Dossier): string | null {
  if (dossier.google_place_id) {
    return `https://www.google.com/maps/search/?api=1&query_place_id=${dossier.google_place_id}`;
  }
  if (dossier.lat && dossier.lng) {
    return `https://www.google.com/maps/@${dossier.lat},${dossier.lng},17z`;
  }
  if (dossier.address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dossier.address)}`;
  }
  return null;
}

function buildWazeUrl(dossier: Dossier): string | null {
  if (dossier.lat && dossier.lng) {
    return `https://waze.com/ul?ll=${dossier.lat},${dossier.lng}&navigate=yes`;
  }
  if (dossier.address) {
    return `https://waze.com/ul?q=${encodeURIComponent(dossier.address)}&navigate=yes`;
  }
  return null;
}

const ALL_CATEGORIES: ProblemCategory[] = ["wc", "fuite", "chauffe_eau", "evier", "douche", "autre"];
const ALL_URGENCIES: UrgencyLevel[] = ["aujourdhui", "48h", "semaine"];

export function InterventionBlock({ dossier }: InterventionBlockProps) {
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState(dossier.address ?? "");
  const [addressData, setAddressData] = useState<Partial<AddressData>>({});
  const [postalCode, setPostalCode] = useState(dossier.postal_code ?? "");
  const [city, setCity] = useState(dossier.city ?? "");
  const [category, setCategory] = useState<ProblemCategory>(dossier.category);
  const [urgency, setUrgency] = useState<UrgencyLevel>(dossier.urgency);
  const [description, setDescription] = useState(dossier.description ?? "");

  const { updateDossier } = useDossierActions(dossier.id);
  const { toast } = useToast();

  const mapsUrl = buildMapsUrl(dossier);
  const wazeUrl = buildWazeUrl(dossier);
  const isVerified = !!dossier.google_place_id;

  const startEdit = () => {
    setAddress(dossier.address ?? "");
    setAddressData({});
    setPostalCode(dossier.postal_code ?? "");
    setCity(dossier.city ?? "");
    setCategory(dossier.category);
    setUrgency(dossier.urgency);
    setDescription(dossier.description ?? "");
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const save = async () => {
    const changedFields: string[] = [];

    const newAddress = addressData.address || address || null;
    if (newAddress !== (dossier.address || null)) changedFields.push("Adresse mise à jour");
    const newPostalCode = (addressData.postal_code ?? postalCode) || null;
    const newCity = (addressData.city ?? city) || null;
    if (newPostalCode !== (dossier.postal_code || null) || newCity !== (dossier.city || null)) {
      changedFields.push("CP / Ville mis à jour");
    }
    if (category !== dossier.category) changedFields.push("Catégorie mise à jour");
    if (urgency !== dossier.urgency) changedFields.push("Urgence mise à jour");
    if ((description || null) !== (dossier.description || null)) changedFields.push("Description mise à jour");

    if (changedFields.length === 0) {
      setEditing(false);
      return;
    }

    try {
      await updateDossier.mutateAsync({
        updates: {
          address: newAddress,
          address_line: addressData.address_line ?? dossier.address_line,
          postal_code: newPostalCode,
          city: newCity,
          country: addressData.country ?? dossier.country,
          google_place_id: addressData.google_place_id ?? (addressData.address ? null : dossier.google_place_id),
          lat: addressData.lat ?? (addressData.address ? null : dossier.lat),
          lng: addressData.lng ?? (addressData.address ? null : dossier.lng),
          category,
          urgency,
          description: description || null,
        },
        changedFields,
      });
      toast({ title: "Intervention mise à jour" });
      setEditing(false);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Intervention — Édition</h3>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancel} disabled={updateDossier.isPending}>
              <X className="h-4 w-4" />
            </Button>
            <Button variant="default" size="icon" className="h-7 w-7" onClick={save} disabled={updateDossier.isPending}>
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Adresse d'intervention</Label>
          <AddressAutocomplete
            value={address}
            onChange={(val) => { setAddress(val); setAddressData({}); }}
            onAddressSelect={(data) => {
              setAddress(data.address);
              setAddressData(data);
              if (data.postal_code) setPostalCode(data.postal_code);
              if (data.city) setCity(data.city);
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Code postal</Label>
            <Input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="75001"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ville</Label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Paris"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Type de demande</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ProblemCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Urgence</Label>
            <Select value={urgency} onValueChange={(v) => setUrgency(v as UrgencyLevel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_URGENCIES.map((u) => (
                  <SelectItem key={u} value={u}>{URGENCY_LABELS[u]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez le problème…"
            className="min-h-[80px]"
          />
        </div>

        <Button className="w-full" onClick={save} disabled={updateDossier.isPending}>
          {updateDossier.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Intervention</h3>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={startEdit}>
          <Pencil className="h-3 w-3" />
          Modifier
        </Button>
      </div>
      
      <div className="space-y-3">
        {dossier.address ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm font-medium text-foreground">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <div>
                <span>{dossier.address}</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dossier.postal_code || dossier.city
                    ? [dossier.postal_code, dossier.city].filter(Boolean).join(" ")
                    : <span className="italic">CP / Ville non renseignés</span>}
                </p>
              </div>
            </div>
            {isVerified ? (
              <span className="inline-flex items-center gap-1 text-xs text-success ml-6">
                <CheckCircle2 className="h-3 w-3" /> Adresse vérifiée
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-warning ml-6">
                <AlertTriangle className="h-3 w-3" /> Adresse non vérifiée
              </span>
            )}
            <div className="flex gap-2 ml-6">
              {mapsUrl && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" asChild>
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                    Google Maps
                  </a>
                </Button>
              )}
              {wazeUrl && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" asChild>
                  <a href={wazeUrl} target="_blank" rel="noopener noreferrer">
                    <Navigation className="h-3 w-3" />
                    Waze
                  </a>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <button onClick={startEdit} className="flex items-start gap-2 text-sm text-muted-foreground italic hover:text-primary cursor-pointer">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
            Ajouter une adresse
          </button>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
            <Wrench className="h-3 w-3" />
            {CATEGORY_LABELS[dossier.category]}
          </span>
          <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium", URGENCY_COLORS[dossier.urgency])}>
            <AlertTriangle className="h-3 w-3" />
            {URGENCY_LABELS[dossier.urgency]}
          </span>
        </div>

        {dossier.description && (
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {dossier.description}
          </p>
        )}
      </div>
    </div>
  );
}
