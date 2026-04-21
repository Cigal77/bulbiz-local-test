import type { Dossier } from "@/hooks/useDossier";
import { cn } from "@/lib/utils";
import { FileText, ClipboardList, Calendar, Receipt } from "lucide-react";

interface DossierProgressBannerProps {
  dossier: Dossier;
}

type Step = {
  key: string;
  label: string;
  subLabel?: string;
  icon: React.ReactNode;
  done: boolean;
  active: boolean;
};

export function DossierProgressBanner({ dossier }: DossierProgressBannerProps) {
  const status = dossier.status;

  // Flow: Dossier → Devis → RDV → Facture
  const isPostDevisSigne = ["devis_signe", "clos_signe", "en_attente_rdv", "rdv_pris", "rdv_termine", "invoice_pending", "invoice_paid"].includes(status);
  const isPostRdvTermine = ["rdv_termine", "invoice_pending", "invoice_paid"].includes(status);

  // Map status to a rough index for Dossier step completion
  const earlyStatuses = ["nouveau", "a_qualifier"];
  const devisStatuses = ["devis_a_faire", "devis_envoye", "devis_signe"];
  const rdvStatuses = ["en_attente_rdv", "rdv_pris", "rdv_termine"];

  const isDossierDone = !earlyStatuses.includes(status);
  const isDossierActive = earlyStatuses.includes(status);

  const isDevisActive = devisStatuses.includes(status);
  const isDevisDone = isPostDevisSigne;

  const isRdvActive = rdvStatuses.includes(status);
  const isRdvDone = isPostRdvTermine;

  const steps: Step[] = [
    {
      key: "dossier",
      label: "Dossier",
      subLabel: isDossierActive ? "Nouveau" : "Complété",
      icon: <FileText className="h-4 w-4" />,
      done: isDossierDone,
      active: isDossierActive,
    },
    {
      key: "devis",
      label: "Devis",
      subLabel: status === "devis_a_faire" ? "À faire" : status === "devis_envoye" ? "Envoyé" : isPostDevisSigne ? "Signé" : undefined,
      icon: <ClipboardList className="h-4 w-4" />,
      done: isDevisDone,
      active: isDevisActive,
    },
    {
      key: "rdv",
      label: "RDV",
      subLabel: status === "en_attente_rdv" ? "En attente" : status === "rdv_pris" ? "Pris" : isPostRdvTermine ? "Terminé" : undefined,
      icon: <Calendar className="h-4 w-4" />,
      done: isRdvDone,
      active: isRdvActive,
    },
    {
      key: "facture",
      label: "Facture",
      subLabel: status === "invoice_pending" ? "En attente" : status === "invoice_paid" ? "Payée" : undefined,
      icon: <Receipt className="h-4 w-4" />,
      done: status === "invoice_paid",
      active: status === "invoice_pending",
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-full transition-colors",
                  step.done
                    ? "bg-success text-success-foreground"
                    : step.active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {step.icon}
              </div>
              <span className={cn(
                "text-[11px] font-medium text-center leading-tight",
                step.done ? "text-success" : step.active ? "text-primary" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
              {step.subLabel && (
                <span className="text-[10px] text-muted-foreground text-center leading-tight">
                  {step.subLabel}
                </span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-2 mt-[-16px]",
                step.done ? "bg-success" : "bg-border"
              )} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
