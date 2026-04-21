import { useMemo } from "react";
import type { Dossier } from "@/hooks/useDossiers";
import type { AppointmentStatus, AppointmentTileKey } from "@/lib/constants";
import { APPOINTMENT_TILE_LABELS, toAppointmentTileKey } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Calendar, Clock, AlertTriangle, Send, CheckCircle2, CheckCheck } from "lucide-react";
import { isToday, isTomorrow, isThisWeek } from "date-fns";

interface AppointmentCountersProps {
  dossiers: Dossier[];
  activeFilter: AppointmentTileKey | null;
  onFilterChange: (filter: AppointmentTileKey | null) => void;
}

const TILES: { key: AppointmentTileKey; label: string; icon: React.ReactNode; color: string; activeColor: string }[] = [
  {
    key: "slots_needed",
    label: "Créneaux à proposer",
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-warning",
    activeColor: "border-warning bg-warning/5 ring-1 ring-warning/20",
  },
  {
    key: "waiting_client",
    label: "En attente client",
    icon: <Send className="h-4 w-4" />,
    color: "text-blue-600 dark:text-blue-400",
    activeColor: "border-blue-500 bg-blue-50 dark:bg-blue-900/10 ring-1 ring-blue-200 dark:ring-blue-800/30",
  },
  {
    key: "rdv_confirmed",
    label: "RDV pris",
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "text-success",
    activeColor: "border-success bg-success/5 ring-1 ring-success/20",
  },
  {
    key: "rdv_done",
    label: "RDV terminé",
    icon: <CheckCheck className="h-4 w-4" />,
    color: "text-primary",
    activeColor: "border-primary bg-primary/5 ring-1 ring-primary/20",
  },
];

export function AppointmentCounters({ dossiers, activeFilter, onFilterChange }: AppointmentCountersProps) {
  const counts = useMemo(() => {
    const c: Record<AppointmentTileKey, number> = { slots_needed: 0, waiting_client: 0, rdv_confirmed: 0, rdv_done: 0 };
    dossiers.forEach((d) => {
      const status = d.appointment_status as AppointmentStatus;
      const tileKey = toAppointmentTileKey(status);
      if (tileKey) c[tileKey]++;
    });
    return c;
  }, [dossiers]);

  const totalActive = TILES.reduce((sum, t) => sum + counts[t.key], 0);
  if (totalActive === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Rendez-vous</h2>
        <Badge variant="secondary" className="text-xs">{totalActive}</Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {TILES.map((tile) => {
          const isActive = activeFilter === tile.key;
          const count = counts[tile.key];
          return (
            <button
              key={tile.key}
              onClick={() => onFilterChange(isActive ? null : tile.key)}
              className={cn(
                "flex flex-col items-start gap-1.5 rounded-xl border p-3 transition-all hover:shadow-sm min-w-0",
                isActive
                  ? tile.activeColor
                  : "border-border bg-card hover:border-primary/30"
              )}
            >
              <div className={cn("flex items-start gap-1.5 text-xs font-medium leading-tight w-full min-w-0", tile.color)}>
                <span className="shrink-0 mt-0.5">{tile.icon}</span>
                <span className="text-left whitespace-normal break-words min-w-0">{tile.label}</span>
              </div>
              <span className="text-xl font-bold text-foreground tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Quick date filters for confirmed RDVs
export type RdvDateFilter = "all" | "today" | "tomorrow" | "week";

interface RdvDateFiltersProps {
  active: RdvDateFilter;
  onChange: (f: RdvDateFilter) => void;
}

export function RdvDateFilters({ active, onChange }: RdvDateFiltersProps) {
  const filters: { key: RdvDateFilter; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "today", label: "Aujourd'hui" },
    { key: "tomorrow", label: "Demain" },
    { key: "week", label: "Cette semaine" },
  ];

  return (
    <div className="flex gap-1.5">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
            active === f.key
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

/** Filter dossiers by RDV date range */
export function filterByRdvDate(dossiers: Dossier[], filter: RdvDateFilter): Dossier[] {
  if (filter === "all") return dossiers;
  return dossiers.filter((d) => {
    const date = d.appointment_date;
    if (!date) return false;
    const dt = new Date(date);
    if (filter === "today") return isToday(dt);
    if (filter === "tomorrow") return isTomorrow(dt);
    if (filter === "week") return isThisWeek(dt, { weekStartsOn: 1 });
    return true;
  });
}

/** Sort dossiers by appointment date/time */
export function sortByAppointmentDate(dossiers: Dossier[]): Dossier[] {
  return [...dossiers].sort((a, b) => {
    const dateA = a.appointment_date || "";
    const dateB = b.appointment_date || "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const timeA = a.appointment_time_start || "";
    const timeB = b.appointment_time_start || "";
    return timeA.localeCompare(timeB);
  });
}
