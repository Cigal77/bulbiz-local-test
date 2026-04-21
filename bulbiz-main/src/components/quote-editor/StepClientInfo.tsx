import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, MapPin, FileText } from "lucide-react";
import type { Dossier } from "@/hooks/useDossier";

interface StepClientInfoProps {
  dossier: Dossier;
  notes: string;
  validityDays: number;
  onNotesChange: (v: string) => void;
  onValidityChange: (v: number) => void;
}

export function StepClientInfo({ dossier, notes, validityDays, onNotesChange, onValidityChange }: StepClientInfoProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Informations client
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nom</Label>
            <Input value={`${dossier.client_first_name ?? ""} ${dossier.client_last_name ?? ""}`.trim() || "—"} readOnly className="bg-muted/50" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Téléphone</Label>
            <Input value={dossier.client_phone ?? "—"} readOnly className="bg-muted/50" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Email</Label>
            <Input value={dossier.client_email ?? "—"} readOnly className="bg-muted/50" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Adresse d'intervention
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input value={dossier.address ?? "—"} readOnly className="bg-muted/50" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Options du devis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Validité (jours)</Label>
            <Input
              type="number"
              min={1}
              value={validityDays}
              onChange={(e) => onValidityChange(parseInt(e.target.value) || 30)}
              className="w-32"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes / conditions</Label>
            <Textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Conditions particulières, délai d'intervention…"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
