import { useState, useEffect, useRef } from "react";
import { Star, Clock, Flame, BookOpen, History, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMaterialSuggestions, type MaterialSuggestion } from "@/hooks/useMaterialSuggestions";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (label: string) => void;
  onPick: (s: MaterialSuggestion) => void;
  onBlur?: () => void;
  onCreateNew?: (label: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  /** Restreint les suggestions à un type de ligne (main_oeuvre, deplacement, materiel, fourniture, standard). */
  typeFilter?: "standard" | "main_oeuvre" | "deplacement" | "materiel" | "fourniture";
}

const SOURCE_META: Record<MaterialSuggestion["source"], { icon: typeof Star; label: string; color: string }> = {
  favorite: { icon: Star, label: "Favoris", color: "text-amber-500" },
  frequent: { icon: Flame, label: "Souvent utilisé", color: "text-orange-500" },
  recent: { icon: Clock, label: "Mon matériel", color: "text-blue-500" },
  history: { icon: History, label: "Déjà saisi", color: "text-purple-500" },
  bulbiz: { icon: BookOpen, label: "Base Bulbiz BTP", color: "text-emerald-500" },
};

/**
 * Champ de saisie hybride :
 * - Saisie 100% libre (Input natif, ne vole jamais le focus)
 * - Liste de suggestions affichée en dessous dès 2 caractères
 * - Aucun Popover Radix → pas de blur intempestif sur mobile
 */
export function MaterialAutocomplete({
  value,
  onChange,
  onPick,
  onBlur,
  onCreateNew,
  placeholder,
  className,
  autoFocus,
  typeFilter,
}: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(value), [value]);

  const { data: allSuggestions = [] } = useMaterialSuggestions(query);

  // Mapping line type → catalog type (doit rester aligné avec useMaterialAutoSave)
  const TYPE_MAP: Record<NonNullable<Props["typeFilter"]>, string> = {
    main_oeuvre: "MAIN_OEUVRE",
    deplacement: "DEPLACEMENT",
    materiel: "MATERIEL",
    fourniture: "PETITE_FOURNITURE",
    standard: "standard",
  };

  const suggestions = typeFilter
    ? allSuggestions.filter((s) => {
        // L'historique (catalog_usage_log) n'a pas de type fiable → on l'inclut toujours
        if (s.source === "history") return true;
        return s.type === TYPE_MAP[typeFilter];
      })
    : allSuggestions;

  const grouped: Record<MaterialSuggestion["source"], MaterialSuggestion[]> = {
    favorite: [],
    frequent: [],
    recent: [],
    history: [],
    bulbiz: [],
  };
  suggestions.forEach((s) => grouped[s.source].push(s));

  const showDropdown = open && query.trim().length >= 2 && suggestions.length > 0;

  // Fermer si on clique en dehors
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Délai pour laisser le clic sur une suggestion se déclencher
          setTimeout(() => {
            onBlur?.();
          }, 150);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder ?? "Désignation"}
        className={cn("font-medium", className)}
        autoFocus={autoFocus}
      />
      {showDropdown && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md max-h-[50vh] overflow-y-auto"
          // Empêche le blur de l'input quand on clique dans le dropdown
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="py-1">
            {(Object.keys(grouped) as MaterialSuggestion["source"][]).map((src) => {
              const items = grouped[src];
              if (!items.length) return null;
              const meta = SOURCE_META[src];
              const Icon = meta.icon;
              return (
                <div key={src}>
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                    <Icon className={cn("h-3 w-3", meta.color)} /> {meta.label}
                  </div>
                  {items.map((s, i) => (
                    <button
                      key={`${s.id ?? "h"}-${i}`}
                      type="button"
                      className="w-full text-left px-2 py-1.5 hover:bg-accent text-sm flex items-center gap-2"
                      onClick={() => {
                        onPick(s);
                        setOpen(false);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{s.label}</div>
                        {s.category_path && (
                          <div className="text-[10px] text-muted-foreground truncate">{s.category_path}</div>
                        )}
                      </div>
                      <div className="text-xs text-right shrink-0">
                        <div className="font-semibold">{s.unit_price.toFixed(2)} €</div>
                        <div className="text-[10px] text-muted-foreground">/ {s.unit} · {s.vat_rate}%</div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
            {onCreateNew && (
              <button
                type="button"
                className="w-full text-left px-2 py-2 hover:bg-accent text-sm border-t text-primary flex items-center gap-1"
                onClick={() => {
                  onCreateNew(query);
                  setOpen(false);
                }}
              >
                <Plus className="h-3 w-3" /> Créer "{query}" dans le catalogue
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
