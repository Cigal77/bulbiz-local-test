import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDossiers, type Dossier, type SortOption } from "@/hooks/useDossiers";
import { StatusCounters } from "@/components/dashboard/StatusCounters";
import { AppointmentCounters, RdvDateFilters, filterByRdvDate, sortByAppointmentDate, type RdvDateFilter } from "@/components/dashboard/AppointmentCounters";
import { DossierList } from "@/components/dashboard/DossierList";
import { SearchBar } from "@/components/dashboard/SearchBar";
import { DossierFilters } from "@/components/dashboard/DossierFilters";
import { DossierPagination } from "@/components/dashboard/DossierPagination";
import { DeleteDossierDialog } from "@/components/dashboard/DeleteDossierDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, Plus, Settings } from "lucide-react";
import { BulbizLogo } from "@/components/BulbizLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { URGENCY_ORDER, DASHBOARD_STATUSES } from "@/lib/constants";
import type { AppointmentTileKey } from "@/lib/constants";
import { toAppointmentTileKey } from "@/lib/constants";
import { useDossierActions } from "@/hooks/useDossierActions";

type DossierStatus = Database["public"]["Enums"]["dossier_status"];

const PAGE_SIZE = 10;

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DossierStatus | null>(null);
  const [rdvFilter, setRdvFilter] = useState<AppointmentTileKey | null>(null);
  const [rdvDateFilter, setRdvDateFilter] = useState<RdvDateFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("recent");
  const [showTrash, setShowTrash] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<Dossier | null>(null);
  const [deletePermanent, setDeletePermanent] = useState(false);

  const { data: dossiers, isLoading } = useDossiers({ showTrash });

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, rdvFilter, rdvDateFilter, sortOption, showTrash]);

  // Realtime: listen for quote status changes
  useEffect(() => {
    const channel = supabase
      .channel("quote-notifications")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quotes" },
        (payload) => {
          const newStatus = payload.new?.status;
          const oldStatus = payload.old?.status;
          if (newStatus === oldStatus) return;
          const quoteNumber = payload.new?.quote_number || "Devis";
          if (newStatus === "signe" && oldStatus !== "signe") {
            toast({ title: "✅ Devis validé !", description: `${quoteNumber} a été validé par le client.` });
            queryClient.invalidateQueries({ queryKey: ["dossiers"] });
          } else if (newStatus === "refuse" && oldStatus !== "refuse") {
            toast({ title: "❌ Devis refusé", description: `${quoteNumber} a été refusé par le client.`, variant: "destructive" });
            queryClient.invalidateQueries({ queryKey: ["dossiers"] });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [toast, queryClient]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(DASHBOARD_STATUSES.map((s) => [s, 0])) as Record<DossierStatus, number>;
    c.a_qualifier = 0;
    dossiers?.forEach((d) => { c[d.status] = (c[d.status] || 0) + 1; });
    return c;
  }, [dossiers]);

  const handleStatusFilter = (status: DossierStatus | null) => {
    setStatusFilter(status);
    if (status) setRdvFilter(null);
  };

  const handleRdvFilter = (filter: AppointmentTileKey | null) => {
    setRdvFilter(filter);
    setRdvDateFilter("all");
    if (filter) setStatusFilter(null);
  };

  const handleTrashToggle = (show: boolean) => {
    setShowTrash(show);
    setStatusFilter(null);
    setRdvFilter(null);
  };

  // Sorting helper
  const applySorting = (list: Dossier[]): Dossier[] => {
    switch (sortOption) {
      case "activity":
        return list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      case "rdv_next":
        return list.sort((a, b) => {
          const da = a.appointment_date || "9999";
          const db = b.appointment_date || "9999";
          return da.localeCompare(db);
        });
      case "devis_oldest":
        return list
          .filter(d => d.status === "devis_envoye")
          .sort((a, b) => new Date(a.status_changed_at).getTime() - new Date(b.status_changed_at).getTime())
          .concat(list.filter(d => d.status !== "devis_envoye"));
      case "invoice_oldest":
        return list
          .filter(d => d.status === "invoice_pending")
          .sort((a, b) => new Date(a.status_changed_at).getTime() - new Date(b.status_changed_at).getTime())
          .concat(list.filter(d => d.status !== "invoice_pending"));
      case "recent":
      default:
        return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  };

  const filtered = useMemo(() => {
    if (!dossiers) return [];
    let list = [...dossiers];

    if (statusFilter) {
      if (statusFilter === "nouveau") {
        list = list.filter((d) => d.status === "nouveau" || d.status === "a_qualifier");
      } else {
        list = list.filter((d) => d.status === statusFilter);
      }
    }

    if (rdvFilter) {
      list = list.filter((d) => {
        const tileKey = toAppointmentTileKey(d.appointment_status as any);
        return tileKey === rdvFilter;
      });
      if (rdvFilter === "rdv_confirmed") {
        list = filterByRdvDate(list, rdvDateFilter);
        list = sortByAppointmentDate(list);
        return list;
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          (d.client_first_name ?? "").toLowerCase().includes(q) ||
          (d.client_last_name ?? "").toLowerCase().includes(q) ||
          (d.client_phone ?? "").includes(q) ||
          (d.client_email ?? "").toLowerCase().includes(q) ||
          (d.address ?? "").toLowerCase().includes(q)
      );
    }

    list = applySorting(list);
    return list;
  }, [dossiers, statusFilter, search, rdvFilter, rdvDateFilter, sortOption]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedDossiers = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSelect = (dossier: Dossier) => {
    navigate(`/dossier/${dossier.id}`);
  };

  // Delete handlers
  const handleDeleteRequest = (dossier: Dossier, permanent = false) => {
    setDeleteTarget(dossier);
    setDeletePermanent(permanent);
  };

  const handleDeleteConfirm = async (reason?: string) => {
    if (!deleteTarget) return;
    try {
      if (deletePermanent) {
        const { error } = await supabase.from("dossiers").delete().eq("id", deleteTarget.id);
        if (error) throw error;
        toast({ title: "Dossier supprimé définitivement" });
      } else {
        const { error } = await supabase.from("dossiers").update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id ?? null,
          delete_reason: reason ?? null,
        }).eq("id", deleteTarget.id);
        if (error) throw error;
        // Add historique
        await supabase.from("historique").insert({
          dossier_id: deleteTarget.id,
          user_id: user?.id ?? null,
          action: "dossier_deleted",
          details: reason ? `Supprimé (${reason})` : "Dossier supprimé (corbeille)",
        });
        toast({ title: "Dossier déplacé dans la corbeille" });
      }
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
    setDeleteTarget(null);
  };

  const handleRestore = async (dossier: Dossier) => {
    try {
      const { error } = await supabase.from("dossiers").update({
        deleted_at: null, deleted_by: null, delete_reason: null,
      }).eq("id", dossier.id);
      if (error) throw error;
      await supabase.from("historique").insert({
        dossier_id: dossier.id,
        user_id: user?.id ?? null,
        action: "dossier_restored",
        details: "Dossier restauré depuis la corbeille",
      });
      toast({ title: "Dossier restauré" });
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const clientNameFor = (d: Dossier) =>
    d.client_first_name || d.client_last_name
      ? `${d.client_first_name ?? ""} ${d.client_last_name ?? ""}`.trim()
      : "Client sans nom";

  return (
    <div className="flex flex-1 flex-col bg-background min-h-0">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-3 sm:px-6 py-2.5 md:hidden">
        <BulbizLogo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 p-3 sm:p-6 max-w-6xl mx-auto w-full space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              {showTrash ? "Corbeille" : "Dossiers"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {filtered.length} dossier{filtered.length !== 1 ? "s" : ""}
              {showTrash ? " dans la corbeille" : ""}
            </p>
          </div>
        
        </div>

        {/* Appointment counters - desktop only */}
        {!isLoading && dossiers && !showTrash && (
          <div className="hidden md:block">
            <AppointmentCounters dossiers={dossiers} activeFilter={rdvFilter} onFilterChange={handleRdvFilter} />
          </div>
        )}
        {rdvFilter === "rdv_confirmed" && (
          <RdvDateFilters active={rdvDateFilter} onChange={setRdvDateFilter} />
        )}

        {/* Status counters - desktop only */}
        {!showTrash && (
          <div className="hidden md:block">
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-[88px] rounded-xl" />
                ))}
              </div>
            ) : (
              <StatusCounters counts={counts} activeFilter={statusFilter} onFilterChange={handleStatusFilter} />
            )}
          </div>
        )}

        {/* Filters + Sort + Trash toggle */}
        <DossierFilters
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilter}
          sortOption={sortOption}
          onSortChange={setSortOption}
          showTrash={showTrash}
          onTrashToggle={handleTrashToggle}
        />

        {/* Search */}
        <div className="w-full sm:max-w-sm">
          <SearchBar value={search} onChange={setSearch} />
        </div>

        {/* Dossier list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <DossierList
            dossiers={paginatedDossiers}
            onSelect={handleSelect}
            isTrash={showTrash}
            onDelete={(d) => handleDeleteRequest(d, false)}
            onPermanentDelete={(d) => handleDeleteRequest(d, true)}
            onRestore={handleRestore}
          />
        )}

        {/* Pagination */}
        <DossierPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </main>

      {/* Delete dialog */}
      {deleteTarget && (
        <DeleteDossierDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          clientName={clientNameFor(deleteTarget)}
          permanent={deletePermanent}
        />
      )}
    </div>
  );
}
