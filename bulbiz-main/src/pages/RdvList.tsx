import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDossiers, type Dossier } from "@/hooks/useDossiers";
import { BulbizLogo } from "@/components/BulbizLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Calendar as CalendarIcon,
  Phone,
  ChevronRight,
  AlertTriangle,
  Send,
  Clock,
  Search,
  CheckCircle2,
  List,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isThisWeek, isThisMonth, parseISO, isBefore, startOfToday, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import type { AppointmentStatus } from "@/lib/constants";

type RdvSection = "today" | "upcoming" | "rdv_pending" | "slots_proposed" | "client_selected" | "past";
type PeriodFilter = "all" | "today" | "week" | "month";
type ViewMode = "list" | "calendar";

interface RdvItem {
  dossier: Dossier;
  clientName: string;
  section: RdvSection;
  sortKey: string;
}

function getClientName(d: Dossier) {
  return d.client_first_name || d.client_last_name
    ? `${d.client_first_name ?? ""} ${d.client_last_name ?? ""}`.trim()
    : "Client sans nom";
}

function buildRdvItems(dossiers: Dossier[]): RdvItem[] {
  const items: RdvItem[] = [];
  const today = startOfToday();

  for (const d of dossiers) {
    const name = getClientName(d);
    const status = d.appointment_status as AppointmentStatus;

    if (status === "rdv_confirmed" && d.appointment_date) {
      const date = parseISO(d.appointment_date);
      if (isBefore(date, today)) {
        items.push({
          dossier: d,
          clientName: name,
          section: "past",
          sortKey: `${d.appointment_date}${d.appointment_time_start ?? "00:00"}`,
        });
      } else if (isToday(date)) {
        items.push({
          dossier: d,
          clientName: name,
          section: "today",
          sortKey: `${d.appointment_date}${d.appointment_time_start ?? "00:00"}`,
        });
      } else {
        items.push({
          dossier: d,
          clientName: name,
          section: "upcoming",
          sortKey: `${d.appointment_date}${d.appointment_time_start ?? "00:00"}`,
        });
      }
    }

    if (status === "done" && d.appointment_date) {
      items.push({
        dossier: d,
        clientName: name,
        section: "past",
        sortKey: `${d.appointment_date}${d.appointment_time_start ?? "00:00"}`,
      });
    }

    if (status === "rdv_pending" || (status === "none" && ["devis_signe", "en_attente_rdv"].includes(d.status))) {
      items.push({ dossier: d, clientName: name, section: "rdv_pending", sortKey: d.created_at });
    }

    if (status === "slots_proposed") {
      items.push({ dossier: d, clientName: name, section: "slots_proposed", sortKey: d.created_at });
    }

    if (status === "client_selected") {
      items.push({ dossier: d, clientName: name, section: "client_selected", sortKey: d.created_at });
    }
  }

  return items;
}

const SECTION_CONFIG: { key: RdvSection; label: string; icon: typeof CalendarIcon; color: string }[] = [
  { key: "today", label: "📅 Aujourd'hui", icon: CalendarIcon, color: "text-success" },
  { key: "upcoming", label: "📅 À venir", icon: CalendarIcon, color: "text-primary" },
  {
    key: "client_selected",
    label: "✅ Créneau à confirmer",
    icon: CheckCircle2,
    color: "text-orange-600 dark:text-orange-400",
  },
  { key: "rdv_pending", label: "⚠️ Créneaux à proposer", icon: AlertTriangle, color: "text-warning" },
  { key: "slots_proposed", label: "⏳ Créneaux proposés", icon: Send, color: "text-blue-600 dark:text-blue-400" },
  { key: "past", label: "🕐 Passés", icon: Clock, color: "text-muted-foreground" },
];

const ICON_BG: Record<RdvSection, string> = {
  today: "bg-success/15 text-success",
  upcoming: "bg-primary/15 text-primary",
  client_selected: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  rdv_pending: "bg-warning/15 text-warning",
  slots_proposed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  past: "bg-muted text-muted-foreground",
};

const PERIOD_BUTTONS: { key: PeriodFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "today", label: "Aujourd'hui" },
  { key: "week", label: "Cette semaine" },
  { key: "month", label: "Ce mois" },
];

function RdvCard({ item, navigate }: { item: RdvItem; navigate: (path: string) => void }) {
  const d = item.dossier;
  const hasDate = !!d.appointment_date;
  const section = item.section;
  return (
    <button
      onClick={() => navigate(`/dossier/${d.id}`)}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left min-h-[56px]"
    >
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-full shrink-0", ICON_BG[section])}>
        {section === "client_selected" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : section === "rdv_pending" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : section === "slots_proposed" ? (
          <Send className="h-4 w-4" />
        ) : section === "past" ? (
          <Clock className="h-4 w-4" />
        ) : (
          <CalendarIcon className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight truncate">{item.clientName}</p>
        <p className="text-xs text-muted-foreground truncate">
          {hasDate ? (
            <>
              {format(parseISO(d.appointment_date!), "EEE d MMM", { locale: fr })}
              {d.appointment_time_start && ` · ${d.appointment_time_start.slice(0, 5)}`}
              {d.appointment_time_end && `–${d.appointment_time_end.slice(0, 5)}`}
            </>
          ) : section === "slots_proposed" ? (
            "Créneaux proposés – en attente de réponse"
          ) : section === "client_selected" ? (
            "Le client a choisi un créneau"
          ) : (
            "RDV à planifier"
          )}
        </p>
      </div>
      {d.client_phone && (
        <a
          href={`tel:${d.client_phone}`}
          onClick={(e) => e.stopPropagation()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 text-success shrink-0"
        >
          <Phone className="h-4 w-4" />
        </a>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
    </button>
  );
}

export default function RdvList() {
  const navigate = useNavigate();
  const { data: dossiers, isLoading } = useDossiers();
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const rdvItems = useMemo(() => {
    if (!dossiers) return [];
    return buildRdvItems(dossiers);
  }, [dossiers]);

  const filteredItems = useMemo(() => {
    let list = rdvItems;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.clientName.toLowerCase().includes(q));
    }
    if (periodFilter !== "all") {
      list = list.filter((r) => {
        if (r.section !== "upcoming") return true;
        if (!r.dossier.appointment_date) return true;
        const date = parseISO(r.dossier.appointment_date);
        if (periodFilter === "today") return isToday(date);
        if (periodFilter === "week") return isThisWeek(date, { locale: fr });
        if (periodFilter === "month") return isThisMonth(date);
        return true;
      });
    }
    return list;
  }, [rdvItems, search, periodFilter]);

  const calendarData = useMemo(() => {
    const confirmedDates: Date[] = [];
    const pendingDates: Date[] = [];
    const actionDates: Date[] = [];

    for (const item of rdvItems) {
      if (!item.dossier.appointment_date) continue;
      const date = parseISO(item.dossier.appointment_date);
      if (item.section === "today" || item.section === "upcoming" || item.section === "past") {
        confirmedDates.push(date);
      } else if (item.section === "client_selected") {
        actionDates.push(date);
      } else if (item.section === "slots_proposed") {
        pendingDates.push(date);
      }
    }

    return { confirmedDates, pendingDates, actionDates };
  }, [rdvItems]);

  const selectedDayItems = useMemo(() => {
    if (!selectedDate) return [];
    return filteredItems
      .filter((item) => {
        if (!item.dossier.appointment_date) return false;
        return isSameDay(parseISO(item.dossier.appointment_date), selectedDate);
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [filteredItems, selectedDate]);

  const grouped = useMemo(() => {
    const map = new Map<RdvSection, RdvItem[]>();
    for (const sec of SECTION_CONFIG) {
      const items = filteredItems
        .filter((r) => r.section === sec.key)
        .sort((a, b) => {
          if (sec.key === "past") return b.sortKey.localeCompare(a.sortKey);
          return a.sortKey.localeCompare(b.sortKey);
        });
      if (items.length > 0) map.set(sec.key, sec.key === "past" ? items.slice(0, 10) : items);
    }
    return map;
  }, [filteredItems]);

  const totalCount = filteredItems.length;

  return (
    <div className="flex flex-1 flex-col bg-background min-h-0">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 backdrop-blur px-3 py-2.5 md:hidden">
        <BulbizLogo />
        <ThemeToggle />
      </header>

      <main className="flex-1 p-3 sm:p-6 max-w-4xl mx-auto w-full space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Rendez-vous</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{totalCount} rendez-vous</p>
          </div>
          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center justify-center h-9 w-9 transition-colors",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-accent",
              )}
              title="Vue liste"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={cn(
                "flex items-center justify-center h-9 w-9 transition-colors",
                viewMode === "calendar"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-accent",
              )}
              title="Vue calendrier"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
          {/* Period filter — only visible in list mode */}
          <div className={cn("flex gap-1.5 flex-wrap", viewMode !== "list" && "hidden")}>
            {PERIOD_BUTTONS.map((pb) => (
              <button
                key={pb.key}
                onClick={() => setPeriodFilter(pb.key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                  periodFilter === pb.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:bg-accent",
                )}
              >
                {pb.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* ── Calendar View ──
                Caché via CSS au lieu d'être démonté pour éviter le crash
                race condition iOS/Android sur react-day-picker (removeChild portal) */}
            <div className={cn("space-y-4", viewMode !== "calendar" && "hidden")}>
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={fr}
                  className="rounded-xl border border-border bg-card p-3 pointer-events-auto rdv-calendar"
                  modifiers={{
                    confirmed: calendarData.confirmedDates,
                    pending: calendarData.pendingDates,
                    action: calendarData.actionDates,
                  }}
                  modifiersClassNames={{
                    confirmed: "rdv-dot-confirmed",
                    pending: "rdv-dot-pending",
                    action: "rdv-dot-action",
                  }}
                />
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  Confirmé
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-warning" />À confirmer
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  En attente
                </span>
              </div>

              {/* Selected day detail */}
              {selectedDate && (
                <div>
                  <h2 className="text-sm font-semibold text-foreground mb-2">
                    {isToday(selectedDate) ? "Aujourd'hui" : format(selectedDate, "EEEE d MMMM", { locale: fr })}
                  </h2>
                  {selectedDayItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">Aucun rendez-vous ce jour</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedDayItems.map((item) => (
                        <RdvCard key={item.dossier.id} item={item} navigate={navigate} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── List View ──
                Caché via CSS au lieu d'être démonté (cohérence avec calendar view) */}
            <div className={cn(viewMode !== "list" && "hidden")}>
              {totalCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <CalendarIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {search ? "Aucun résultat" : "Aucun rendez-vous"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {search ? "Essayez un autre terme." : "Les RDV apparaîtront ici."}
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {SECTION_CONFIG.map((sec) => {
                    const items = grouped.get(sec.key);
                    if (!items) return null;
                    return (
                      <section key={sec.key}>
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          {sec.label}
                          <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                            {items.length}
                          </span>
                        </h2>
                        <div className="space-y-1.5">
                          {items.map((item) => (
                            <RdvCard key={`${sec.key}-${item.dossier.id}`} item={item} navigate={navigate} />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
