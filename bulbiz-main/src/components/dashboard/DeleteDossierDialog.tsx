import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DeleteDossierDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  clientName: string;
  permanent?: boolean;
}

const REASONS = [
  { value: "perdu", label: "Client perdu" },
  { value: "doublon", label: "Doublon" },
  { value: "erreur", label: "Erreur de saisie" },
  { value: "autre", label: "Autre" },
];

export function DeleteDossierDialog({ open, onClose, onConfirm, clientName, permanent }: DeleteDossierDialogProps) {
  const [reason, setReason] = useState<string>("");

  const handleConfirm = () => {
    onConfirm(reason || undefined);
    setReason("");
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {permanent ? "Supprimer définitivement ?" : "Supprimer ce dossier ?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {permanent
              ? `Le dossier de "${clientName}" sera supprimé définitivement. Cette action est irréversible.`
              : `Le dossier de "${clientName}" sera déplacé dans la corbeille. Vous pourrez le restaurer pendant 30 jours.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!permanent && (
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium text-foreground">Raison (optionnel)</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une raison…" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={permanent ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {permanent ? "Supprimer définitivement" : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
