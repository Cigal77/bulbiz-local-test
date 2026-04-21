import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 10 ou 5.5 */
  rate: 10 | 5.5;
  onConfirm: (legalText: string) => void;
  onCancel: () => void;
}

/**
 * Mini questionnaire d'éligibilité au taux réduit (TVA 10 % ou 5,5 %).
 * Génère la mention légale à insérer dans les notes du devis/facture.
 */
export function ReducedVatHelper({ open, onOpenChange, rate, onConfirm, onCancel }: Props) {
  const [housing, setHousing] = useState(false);
  const [olderThan2y, setOlderThan2y] = useState(false);
  const [renovation, setRenovation] = useState(false);
  const [energy, setEnergy] = useState(false);
  const [customerConfirmed, setCustomerConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setHousing(false);
      setOlderThan2y(false);
      setRenovation(false);
      setEnergy(false);
      setCustomerConfirmed(false);
    }
  }, [open]);

  const eligible =
    housing &&
    olderThan2y &&
    renovation &&
    customerConfirmed &&
    (rate === 10 || (rate === 5.5 && energy));

  const legalText =
    rate === 5.5
      ? "Travaux d'amélioration de la qualité énergétique éligibles au taux réduit de TVA à 5,5 % (art. 278-0 bis A du CGI). Le client atteste que le local est affecté à l'habitation et achevé depuis plus de 2 ans."
      : "Travaux portant sur un local d'habitation achevé depuis plus de 2 ans, éligibles au taux réduit de TVA à 10 % (art. 279-0 bis du CGI). Le client atteste de la véracité de ces informations.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Vérifier l'éligibilité au taux réduit {rate.toString().replace(".", ",")} %
          </DialogTitle>
          <DialogDescription>
            Coche chaque case si la condition est remplie. Bulbiz ajoutera la mention obligatoire
            au devis ou à la facture.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Row
            checked={housing}
            onChange={setHousing}
            label="Le chantier concerne un logement d'habitation"
          />
          <Row
            checked={olderThan2y}
            onChange={setOlderThan2y}
            label="Le logement est achevé depuis plus de 2 ans"
          />
          <Row
            checked={renovation}
            onChange={setRenovation}
            label="Travaux d'amélioration, d'entretien ou de rénovation (pas de construction neuve)"
          />
          {rate === 5.5 && (
            <Row
              checked={energy}
              onChange={setEnergy}
              label="Travaux de rénovation énergétique éligibles (isolation, chauffage performant, etc.)"
            />
          )}
          <Row
            checked={customerConfirmed}
            onChange={setCustomerConfirmed}
            label="Le client confirme que ces conditions sont remplies"
          />
        </div>

        {eligible ? (
          <div className="rounded-md border bg-success/10 border-success/40 p-3 text-xs flex gap-2">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground mb-1">
                Taux {rate.toString().replace(".", ",")} % applicable
              </p>
              <p className="text-muted-foreground italic">« {legalText} »</p>
            </div>
          </div>
        ) : (
          <div className="rounded-md border bg-amber-500/10 border-amber-500/40 p-3 text-xs flex gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              Sans toutes ces conditions, applique le taux normal de 20 %.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Appliquer 20 %
          </Button>
          <Button
            disabled={!eligible}
            onClick={() => onConfirm(legalText)}
          >
            Confirmer {rate.toString().replace(".", ",")} %
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm cursor-pointer">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <span className="leading-snug">{label}</span>
    </label>
  );
}