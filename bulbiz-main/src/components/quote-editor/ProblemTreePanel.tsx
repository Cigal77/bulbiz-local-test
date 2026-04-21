import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronRight, ChevronDown, ArrowLeft, Plus, CheckCircle2 } from "lucide-react";
import { useProblemTaxonomy, useProblemManoeuvres, type TaxonomyNode, type Manoeuvre } from "@/hooks/useProblemTaxonomy";
import { RecommendationTabs } from "./RecommendationTabs";
import type { QuoteItem } from "@/lib/quote-types";
import { useToast } from "@/hooks/use-toast";

interface ProblemTreePanelProps {
  onAddItem: (item: Omit<QuoteItem, "id">) => void;
  onAddItems: (items: Omit<QuoteItem, "id">[]) => void;
  onSetLabourContext: (tags: string[], problemLabel: string) => void;
}

function manoeuvreToQuoteItem(m: { label: string; description?: string; unit: string; default_qty: number; unit_price: number; vat_rate: number; type?: string }): Omit<QuoteItem, "id"> {
  return {
    label: m.label,
    description: m.description || "",
    qty: Number(m.default_qty),
    unit: m.unit,
    unit_price: Number(m.unit_price),
    vat_rate: Number(m.vat_rate),
    discount: 0,
    type: (m.type === "main_oeuvre" || m.type === "deplacement" || m.type === "materiel" || m.type === "fourniture" ? m.type : "standard") as QuoteItem["type"],
  };
}

export function ProblemTreePanel({ onAddItem, onAddItems, onSetLabourContext }: ProblemTreePanelProps) {
  const { toast } = useToast();
  const { data: taxonomy = [], isLoading } = useProblemTaxonomy();
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const { data: manoeuvres = [] } = useProblemManoeuvres(selectedProblemId);

  const categories = useMemo(() => taxonomy.filter((n) => !n.parent_id), [taxonomy]);
  const childrenOf = useMemo(() => {
    const map = new Map<string, TaxonomyNode[]>();
    taxonomy.filter((n) => n.parent_id).forEach((n) => {
      const arr = map.get(n.parent_id!) || [];
      arr.push(n);
      map.set(n.parent_id!, arr);
    });
    return map;
  }, [taxonomy]);

  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return taxonomy.filter(
      (n) => n.parent_id && (n.label.toLowerCase().includes(q) || n.keywords.some((k) => k.toLowerCase().includes(q)))
    );
  }, [search, taxonomy]);

  const selectedProblem = taxonomy.find((n) => n.id === selectedProblemId);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectProblem = (node: TaxonomyNode) => {
    setSelectedProblemId(node.id);
    const ctx = node.default_context as Record<string, string>;
    if (ctx?.type) {
      onSetLabourContext([ctx.type], node.label);
    }
  };

  const handleAddManoeuvre = (m: Manoeuvre | { label: string; description?: string; unit: string; default_qty: number; unit_price: number; vat_rate: number; type?: string }) => {
    onAddItem(manoeuvreToQuoteItem(m));
    toast({
      title: "✅ Ligne ajoutée",
      description: m.label,
    });
  };

  // Batch add all essentials (weight >= 100)
  const handleAddEssentials = () => {
    const essentials = manoeuvres
      .filter(m => m.weight >= 100)
      .map(m => manoeuvreToQuoteItem({
        ...m,
        default_qty: Number(m.default_qty),
        unit_price: Number(m.unit_price),
        vat_rate: Number(m.vat_rate),
      }));

    const frequent = manoeuvres.filter(m => m.weight >= 60 && m.weight < 100);
    const options = manoeuvres.filter(m => m.weight < 60);

    if (essentials.length === 0) {
      toast({ title: "Aucun élément indispensable", variant: "destructive" });
      return;
    }

    onAddItems(essentials);
    toast({
      title: `✅ ${essentials.length} ligne${essentials.length > 1 ? "s" : ""} ajoutée${essentials.length > 1 ? "s" : ""}`,
      description: `${essentials.length} indispensable${essentials.length > 1 ? "s" : ""}${frequent.length ? ` • ${frequent.length} fréquent${frequent.length > 1 ? "s" : ""} disponible${frequent.length > 1 ? "s" : ""}` : ""}${options.length ? ` • ${options.length} option${options.length > 1 ? "s" : ""}` : ""}`,
    });
  };

  // Detail view
  if (selectedProblem) {
    const essentialCount = manoeuvres.filter(m => m.weight >= 100).length;

    return (
      <div className="flex flex-col h-full">
        <Button variant="ghost" size="sm" className="justify-start gap-1.5 mb-2 -ml-2" onClick={() => setSelectedProblemId(null)}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour
        </Button>
        <h3 className="text-sm font-semibold mb-1 text-foreground">{selectedProblem.label}</h3>

        {/* Keywords as context */}
        {selectedProblem.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {selectedProblem.keywords.slice(0, 4).map(kw => (
              <Badge key={kw} variant="outline" className="text-[10px]">{kw}</Badge>
            ))}
          </div>
        )}

        <ScrollArea className="flex-1">
          {manoeuvres.length > 0 ? (
            <RecommendationTabs
              items={manoeuvres.map((m) => ({
                ...m,
                default_qty: Number(m.default_qty),
                unit_price: Number(m.unit_price),
                vat_rate: Number(m.vat_rate),
              }))}
              onAdd={handleAddManoeuvre}
            />
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              Aucun geste recommandé pour ce problème.
            </p>
          )}
        </ScrollArea>

        {/* Sticky CTA: add all essentials */}
        {essentialCount > 0 && (
          <div className="pt-3 mt-2 border-t">
            <Button
              className="w-full gap-2"
              size="sm"
              onClick={handleAddEssentials}
            >
              <CheckCircle2 className="h-4 w-4" />
              Ajouter {essentialCount} indispensable{essentialCount > 1 ? "s" : ""}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Tree view
  return (
    <div className="flex flex-col h-full">
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="WC fuit, déboucher évier, plus d'eau chaude…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>
      <ScrollArea className="flex-1">
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-4">Chargement…</p>
        ) : filtered ? (
          <div className="space-y-0.5">
            {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Aucun résultat</p>}
            {filtered.map((node) => (
              <button
                key={node.id}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 text-sm flex items-center justify-between group"
                onClick={() => selectProblem(node)}
              >
                <span>{node.label}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            {categories.map((cat) => {
              const children = childrenOf.get(cat.id) || [];
              const isExpanded = expandedIds.has(cat.id);
              return (
                <div key={cat.id}>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 text-sm font-medium"
                    onClick={() => toggleExpand(cat.id)}
                  >
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    {cat.label}
                    <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1">{children.length}</Badge>
                  </button>
                  {isExpanded && (
                    <div className="ml-5 space-y-0.5">
                      {children.map((child) => (
                        <button
                          key={child.id}
                          className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-muted/50 text-sm text-muted-foreground hover:text-foreground flex items-center justify-between group"
                          onClick={() => selectProblem(child)}
                        >
                          <span>{child.label}</span>
                          <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
