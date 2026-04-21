import { STATUS_LABELS, STATUS_COLORS, DASHBOARD_STATUSES } from "@/lib/constants";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { FileText, ClipboardList, Send, CheckCircle, XCircle, Receipt, CreditCard, Calendar, Clock, CheckCheck } from "lucide-react";

type DossierStatus = Database["public"]["Enums"]["dossier_status"];

const STATUS_ICONS: Partial<Record<DossierStatus, React.ReactNode>> = {
  nouveau: <FileText className="h-4 w-4" />,
  devis_a_faire: <ClipboardList className="h-4 w-4" />,
  devis_envoye: <Send className="h-4 w-4" />,
  devis_signe: <CheckCircle className="h-4 w-4" />,
  en_attente_rdv: <Clock className="h-4 w-4" />,
  rdv_pris: <Calendar className="h-4 w-4" />,
  rdv_termine: <CheckCheck className="h-4 w-4" />,
  clos_perdu: <XCircle className="h-4 w-4" />,
  invoice_pending: <Receipt className="h-4 w-4" />,
  invoice_paid: <CreditCard className="h-4 w-4" />,
};

interface StatusCountersProps {
  counts: Record<DossierStatus, number>;
  activeFilter: DossierStatus | null;
  onFilterChange: (status: DossierStatus | null) => void;
}

export function StatusCounters({ counts, activeFilter, onFilterChange }: StatusCountersProps) {
  // Merge a_qualifier count into nouveau
  const mergedCounts = { ...counts };
  if (mergedCounts.a_qualifier) {
    mergedCounts.nouveau = (mergedCounts.nouveau || 0) + mergedCounts.a_qualifier;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10 gap-2">
      {DASHBOARD_STATUSES.map((status) => (
        <button
          key={status}
          onClick={() => onFilterChange(activeFilter === status ? null : status)}
          className={cn(
            "flex flex-col items-start gap-1.5 rounded-xl border p-3 transition-all hover:shadow-sm min-w-0",
            activeFilter === status
              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
              : "border-border bg-card hover:border-primary/30"
          )}
        >
          <div className={cn("flex items-start gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight w-full min-w-0", STATUS_COLORS[status])}>
            <span className="shrink-0 mt-0.5">{STATUS_ICONS[status]}</span>
            <span className="text-left whitespace-normal break-words min-w-0">{STATUS_LABELS[status]}</span>
          </div>
          <span className="text-2xl font-bold text-foreground tabular-nums">{mergedCounts[status] || 0}</span>
        </button>
      ))}
    </div>
  );
}
