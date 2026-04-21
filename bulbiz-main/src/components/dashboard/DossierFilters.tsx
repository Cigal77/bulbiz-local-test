import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { STATUS_LABELS, DASHBOARD_STATUSES } from "@/lib/constants";
import type { Database } from "@/integrations/supabase/types";
import type { SortOption } from "@/hooks/useDossiers";
import { Trash2 } from "lucide-react";

type DossierStatus = Database["public"]["Enums"]["dossier_status"];

interface DossierFiltersProps {
  statusFilter: DossierStatus | null;
  onStatusFilterChange: (status: DossierStatus | null) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  showTrash: boolean;
  onTrashToggle: (show: boolean) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Plus récents" },
  { value: "activity", label: "Dernière activité" },
  { value: "rdv_next", label: "Prochain RDV" },
  { value: "devis_oldest", label: "Devis envoyé (+ ancien)" },
  { value: "invoice_oldest", label: "Facture en attente (+ ancien)" },
];

export function DossierFilters({
  statusFilter, onStatusFilterChange,
  sortOption, onSortChange,
  showTrash, onTrashToggle,
}: DossierFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 sm:gap-3">
      {/* Status filter */}
      <Select
        value={statusFilter ?? "all"}
        onValueChange={(v) => onStatusFilterChange(v === "all" ? null : v as DossierStatus)}
      >
        <SelectTrigger className="w-full sm:w-[180px] h-10 sm:h-9 text-sm">
          <SelectValue placeholder="Filtrer par statut" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les statuts</SelectItem>
          {DASHBOARD_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort */}
      <Select value={sortOption} onValueChange={(v) => onSortChange(v as SortOption)}>
        <SelectTrigger className="w-full sm:w-[200px] h-10 sm:h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Trash toggle */}
      <div className="flex items-center gap-2 ml-auto">
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        <Label htmlFor="trash-toggle" className="text-xs text-muted-foreground cursor-pointer">
          Corbeille
        </Label>
        <Switch
          id="trash-toggle"
          checked={showTrash}
          onCheckedChange={onTrashToggle}
        />
      </div>
    </div>
  );
}
