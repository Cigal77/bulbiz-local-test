import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Upload, Library } from "lucide-react";
import { MaterialCard } from "@/components/material-library/MaterialCard";
import { MaterialEditDialog } from "@/components/material-library/MaterialEditDialog";
import { CsvImportDialog } from "@/components/material-library/CsvImportDialog";
import { SuggestionsPanel } from "@/components/material-library/SuggestionsPanel";
import {
  MaterialFilters,
  DEFAULT_FILTERS,
  type MaterialFiltersValue,
} from "@/components/material-library/MaterialFilters";
import { MaterialGroupedGrid } from "@/components/material-library/MaterialGroupedGrid";
import {
  useMaterialLibrary,
  useToggleFavorite,
  useDeleteMaterial,
  type MaterialTab,
  type LibraryMaterial,
} from "@/hooks/useMaterialLibrary";
import { useAuth } from "@/hooks/useAuth";
import type { MaterialUpsertPayload } from "@/hooks/useMaterialLibrary";

const TABS: { id: MaterialTab; label: string; emoji: string }[] = [
  { id: "mine", label: "Mon matériel", emoji: "📦" },
  { id: "favorites", label: "Favoris", emoji: "⭐" },
  { id: "frequent", label: "Souvent utilisé", emoji: "🔥" },
  { id: "recent", label: "Récent", emoji: "🕐" },
  { id: "bulbiz", label: "Base Bulbiz BTP", emoji: "📚" },
  { id: "imported", label: "Importé CSV", emoji: "📥" },
  { id: "suggestions", label: "Suggestions IA", emoji: "✨" },
];

const FILTERED_TABS: MaterialTab[] = ["bulbiz", "mine", "imported", "frequent"];
const STORAGE_KEY = "bulbiz_material_filters";

function loadFilters(): MaterialFiltersValue {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export default function MaterialLibrary() {
  const { user } = useAuth();
  const [tab, setTab] = useState<MaterialTab>("mine");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<MaterialFiltersValue>(loadFilters);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryMaterial | null>(null);
  const [editInitial, setEditInitial] = useState<Partial<MaterialUpsertPayload> | undefined>();
  const [csvOpen, setCsvOpen] = useState(false);

  const filtersActive = FILTERED_TABS.includes(tab);
  const effectiveFilters = filtersActive ? filters : DEFAULT_FILTERS;

  const { data, isLoading } = useMaterialLibrary(tab, search, effectiveFilters);
  const toggleFav = useToggleFavorite();
  const del = useDeleteMaterial();

  // Persist filters
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      /* ignore */
    }
  }, [filters]);

  const openCreate = (initial?: Partial<MaterialUpsertPayload>) => {
    setEditing(null);
    setEditInitial(initial);
    setEditOpen(true);
  };
  const openEdit = (m: LibraryMaterial) => {
    setEditing(m);
    setEditInitial(undefined);
    setEditOpen(true);
  };

  const handleDelete = (m: LibraryMaterial) => {
    if (confirm(`Supprimer "${m.label}" ?`)) del.mutate(m.id);
  };

  const showGrouped =
    tab === "bulbiz" && !filters.categoryId && (data?.length ?? 0) > 0;

  return (
    <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2">
            <Library className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Bibliothèque matériel</h1>
            <p className="text-xs text-muted-foreground">Tes articles, prestations et imports CSV</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" /> Importer CSV
          </Button>
          <Button size="sm" onClick={() => openCreate()}>
            <Plus className="h-4 w-4 mr-1.5" /> Nouvel article
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, fournisseur, marque, code…"
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as MaterialTab)}>
        <TabsList className="w-full justify-start overflow-x-auto h-auto flex-wrap p-1">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs">
              <span className="mr-1">{t.emoji}</span> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-4 space-y-4">
            {t.id === "suggestions" ? (
              <SuggestionsPanel search={search} onCreate={openCreate} />
            ) : (
              <>
                {FILTERED_TABS.includes(t.id) && (
                  <MaterialFilters
                    value={filters}
                    onChange={setFilters}
                    results={data ?? []}
                    resultCount={data?.length ?? 0}
                  />
                )}

                {isLoading ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">Chargement…</p>
                ) : !data?.length ? (
                  <EmptyState
                    tab={t.id}
                    hasFilters={
                      FILTERED_TABS.includes(t.id) &&
                      (!!filters.sectorId ||
                        !!filters.categoryId ||
                        !!filters.type ||
                        !!filters.brand)
                    }
                    onClearFilters={() => setFilters(DEFAULT_FILTERS)}
                    onImport={() => setCsvOpen(true)}
                    onCreate={() => openCreate()}
                    onSwitchToBulbiz={() => setTab("bulbiz")}
                  />
                ) : t.id === "bulbiz" && showGrouped ? (
                  <MaterialGroupedGrid
                    materials={data}
                    currentUserId={user?.id}
                    onToggleFavorite={(m) =>
                      toggleFav.mutate({ id: m.id, is_favorite: !m.is_favorite })
                    }
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {data.map((m) => (
                      <MaterialCard
                        key={m.id}
                        material={m}
                        isOwner={m.user_id === user?.id}
                        onToggleFavorite={() =>
                          toggleFav.mutate({ id: m.id, is_favorite: !m.is_favorite })
                        }
                        onEdit={() => openEdit(m)}
                        onDelete={() => handleDelete(m)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <MaterialEditDialog open={editOpen} onOpenChange={setEditOpen} material={editing} initial={editInitial} />
      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} />
    </div>
  );
}

function EmptyState({
  tab,
  hasFilters,
  onClearFilters,
  onImport,
  onCreate,
  onSwitchToBulbiz,
}: {
  tab: MaterialTab;
  hasFilters: boolean;
  onClearFilters: () => void;
  onImport: () => void;
  onCreate: () => void;
  onSwitchToBulbiz: () => void;
}) {
  if (hasFilters) {
    return (
      <div className="text-center py-16 space-y-3 border border-dashed rounded-lg">
        <Search className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <div>
          <p className="font-medium">Aucun article ne correspond à ces filtres</p>
          <p className="text-sm text-muted-foreground">Essaie d'élargir ta recherche.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Effacer les filtres
        </Button>
      </div>
    );
  }
  if (tab === "mine") {
    return (
      <div className="text-center py-16 space-y-3 border border-dashed rounded-lg">
        <Library className="h-12 w-12 mx-auto text-muted-foreground/40" />
        <div>
          <p className="font-medium">Ton catalogue est vide</p>
          <p className="text-sm text-muted-foreground">Importe ton matériel ou pioche dans la base Bulbiz.</p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button onClick={onImport}><Upload className="h-4 w-4 mr-1.5" /> Importer mon premier CSV</Button>
          <Button variant="outline" onClick={onSwitchToBulbiz}>Parcourir Bulbiz BTP</Button>
        </div>
      </div>
    );
  }
  if (tab === "bulbiz") {
    return (
      <div className="text-center py-16 space-y-3 border border-dashed rounded-lg">
        <Library className="h-12 w-12 mx-auto text-muted-foreground/40" />
        <div>
          <p className="font-medium">La base Bulbiz BTP se construit</p>
          <p className="text-sm text-muted-foreground">
            Les articles seront bientôt disponibles. En attendant, importe ton propre catalogue.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onImport}>
          <Upload className="h-4 w-4 mr-1.5" /> Importer mon CSV
        </Button>
      </div>
    );
  }
  return (
    <div className="text-center py-16 text-muted-foreground space-y-2">
      <p className="text-sm">Aucun article ici pour le moment.</p>
      <Button variant="outline" size="sm" onClick={onCreate}>
        <Plus className="h-4 w-4 mr-1.5" /> Créer un article
      </Button>
    </div>
  );
}
