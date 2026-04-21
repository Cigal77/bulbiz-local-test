import { useState, useMemo } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FolderOpen, Plus, User } from "lucide-react";
import { useDossiers, type Dossier } from "@/hooks/useDossiers";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface DossierPickerSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (dossier: Dossier) => void;
  onCreateNew: () => void;
  title: string;
}

export function DossierPickerSheet({
  open,
  onClose,
  onSelect,
  onCreateNew,
  title,
}: DossierPickerSheetProps) {
  const { data: dossiers, isLoading } = useDossiers();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!dossiers) return [];
    if (!search.trim()) return dossiers;
    const q = search.toLowerCase();
    return dossiers.filter((d) => {
      const name = [d.client_first_name, d.client_last_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const addr = (d.address || d.city || "").toLowerCase();
      return name.includes(q) || addr.includes(q);
    });
  }, [dossiers, search]);

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) { setSearch(""); onClose(); } }}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>
            Choisissez un dossier existant ou créez-en un nouveau
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        <div className="px-4 pb-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-dashed"
            onClick={() => {
              setSearch("");
              onCreateNew();
            }}
          >
            <Plus className="h-4 w-4 text-primary" />
            Nouveau dossier client
          </Button>
        </div>

        <div className="overflow-y-auto px-4 pb-6 max-h-[50vh]">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Chargement...
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun dossier trouvé
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((d) => {
                const clientName = [d.client_first_name, d.client_last_name]
                  .filter(Boolean)
                  .join(" ") || "Client inconnu";

                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      setSearch("");
                      onSelect(d);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent text-left transition-colors"
                  >
                    <div className="flex items-center justify-center h-9 w-9 rounded-full bg-muted shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">
                        {clientName}
                      </div>
                      {(d.address || d.city) && (
                        <div className="text-xs text-muted-foreground truncate">
                          {d.address_line || d.city || d.address}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0",
                        STATUS_COLORS[d.status]
                      )}
                    >
                      {STATUS_LABELS[d.status]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
