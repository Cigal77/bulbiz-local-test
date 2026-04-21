import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ValidationResult } from "@/lib/compliance-engine";

interface ComplianceBlockerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validation: ValidationResult;
  action: string;
}

export function ComplianceBlockerDialog({
  open,
  onOpenChange,
  validation,
  action,
}: ComplianceBlockerDialogProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto bg-destructive/10 p-3 rounded-full mb-2">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-center">Action impossible</DialogTitle>
          <DialogDescription className="text-center">
            Pour {action}, certaines informations obligatoires sont manquantes.
            Bulbiz les ajoutera automatiquement à vos futurs documents une fois renseignées.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 py-2">
          {validation.blockers.map((b) => (
            <li
              key={b.code}
              className="flex items-start gap-2 text-sm p-2 rounded-md bg-destructive/5"
            >
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <span>{b.message}</span>
            </li>
          ))}
        </ul>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Plus tard
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              const firstSection = validation.blockers[0]?.section;
              if (firstSection === "onboarding") {
                navigate("/onboarding/conformite");
              } else {
                navigate(`/parametres/conformite${firstSection ? `#${firstSection}` : ""}`);
              }
            }}
          >
            Corriger maintenant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
