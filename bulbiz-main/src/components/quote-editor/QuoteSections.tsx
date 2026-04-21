import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Plus, ChevronDown, ChevronRight, FileText, Save, Wrench, Package, ShoppingBag, Truck, MoreHorizontal } from "lucide-react";
import { SECTIONS, QUOTE_TEMPLATES, createEmptyItem, calcLineTotal, type QuoteItem, type QuoteItemType } from "@/lib/quote-types";
import { QuoteItemRow } from "./QuoteItemRow";
import { LabourSummaryBlock } from "./LabourSummaryBlock";
import { QuoteTotalsFooter } from "./QuoteTotalsFooter";

interface QuoteSectionsProps {
  items: QuoteItem[];
  setItems: React.Dispatch<React.SetStateAction<QuoteItem[]>>;
  labourSummary: string;
  onLabourSummaryChange: (value: string) => void;
  problemLabel?: string;
  notes: string;
  validityDays: number;
  onNotesChange: (v: string) => void;
  onValidityChange: (v: number) => void;
  onSaveAsKit?: () => void;
  vatMode?: "normal" | "no_vat_293b";
  defaultVatRate?: number;
}

export function QuoteSections({
  items, setItems, labourSummary, onLabourSummaryChange, problemLabel,
  notes, validityDays, onNotesChange, onValidityChange, onSaveAsKit,
  vatMode = "normal", defaultVatRate = 10,
}: QuoteSectionsProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const isFranchise = vatMode === "no_vat_293b";

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const addItem = (type: QuoteItemType) => {
    // Garantit l'ouverture de la section pour que l'utilisateur voie sa nouvelle ligne
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.delete(type);
      return next;
    });
    const rate = isFranchise ? 0 : defaultVatRate;
    setItems(prev => [...prev, createEmptyItem(type, rate)]);
    toast.success("Ligne ajoutée — modifie-la librement");
  };

  const handleMoveUp = (id: string) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const handleMoveDown = (id: string) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const applyTemplate = (key: string) => {
    const tpl = QUOTE_TEMPLATES[key];
    if (!tpl) return;
    const newItems = tpl.items.map(i => ({ ...i, id: crypto.randomUUID() }));
    setItems(prev => [...prev, ...newItems]);
  };

  const handleChange = (id: string, field: keyof QuoteItem, value: unknown) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const handleDuplicate = (id: string) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === id);
      if (idx < 0) return prev;
      const copy = { ...prev[idx], id: crypto.randomUUID() };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // Group items by section
  const groupedItems = SECTIONS.map(section => ({
    ...section,
    items: items.filter(i => i.type === section.key),
    sectionTotal: items
      .filter(i => i.type === section.key)
      .reduce((sum, i) => sum + calcLineTotal(i), 0),
  }));

  // Only show sections that have items OR are primary (main_oeuvre, materiel, fourniture, deplacement)
  const visibleSections = groupedItems.filter(
    s => s.items.length > 0 || s.key !== "standard"
  );

  return (
    <div className="space-y-3">
      {/* Barre d'ajout rapide — toujours visible, garantit l'ajout en 1 clic */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">
            ⚡ Ajout rapide — clique pour insérer une ligne modifiable
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="default" className="h-8 gap-1.5 text-xs" onClick={() => addItem("main_oeuvre")}>
            <Wrench className="h-3.5 w-3.5" /> Main d'œuvre
          </Button>
          <Button size="sm" variant="default" className="h-8 gap-1.5 text-xs" onClick={() => addItem("materiel")}>
            <Package className="h-3.5 w-3.5" /> Matériel
          </Button>
          <Button size="sm" variant="default" className="h-8 gap-1.5 text-xs" onClick={() => addItem("fourniture")}>
            <ShoppingBag className="h-3.5 w-3.5" /> Fourniture
          </Button>
          <Button size="sm" variant="default" className="h-8 gap-1.5 text-xs" onClick={() => addItem("deplacement")}>
            <Truck className="h-3.5 w-3.5" /> Déplacement
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => addItem("standard")}>
            <MoreHorizontal className="h-3.5 w-3.5" /> Ligne libre
          </Button>
        </div>
      </div>

      {/* Templates + Save as kit */}
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Modèles rapides
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-xs">Appliquer un modèle</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.entries(QUOTE_TEMPLATES).map(([key, tpl]) => (
              <DropdownMenuItem key={key} onClick={() => applyTemplate(key)}>
                {tpl.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {onSaveAsKit && items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={onSaveAsKit}
          >
            <Save className="h-3.5 w-3.5" />
            Sauvegarder comme pack
          </Button>
        )}
      </div>

      {/* Sections */}
      {visibleSections.map(section => {
        const isOpen = !collapsedSections.has(section.key);
        const Icon = section.icon;
        const count = section.items.length;

        return (
          <div key={section.key} className="rounded-xl border bg-card overflow-hidden">
            {/* Section header */}
            <Collapsible open={isOpen} onOpenChange={() => toggleSection(section.key)}>
              <CollapsibleTrigger className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors">
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground flex-1 text-left">{section.label}</span>
                {count > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                    {count} ligne{count > 1 ? "s" : ""}
                  </Badge>
                )}
                {section.sectionTotal > 0 && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {section.sectionTotal.toFixed(2)} € HT
                  </span>
                )}
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-3">
                  {/* Labour summary in main_oeuvre section */}
                  {section.key === "main_oeuvre" && (
                    <LabourSummaryBlock
                      value={labourSummary}
                      onChange={onLabourSummaryChange}
                      problemLabel={problemLabel}
                    />
                  )}

                  {/* Items */}
                  {section.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4 opacity-60">
                      Aucune ligne dans cette section — clique sur « Ajouter une ligne » ci-dessous
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {section.items.map((item, idx) => (
                        <QuoteItemRow
                          key={item.id}
                          item={item}
                          index={items.indexOf(item)}
                          onChange={handleChange}
                          onDuplicate={handleDuplicate}
                          onDelete={handleDelete}
                          onMoveUp={items.indexOf(item) > 0 ? () => handleMoveUp(item.id) : undefined}
                          onMoveDown={items.indexOf(item) < items.length - 1 ? () => handleMoveDown(item.id) : undefined}
                          hideVat={isFranchise}
                        />
                      ))}
                    </div>
                  )}

                  {/* Add line button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8 w-full sm:w-auto"
                    onClick={() => addItem(section.key as QuoteItemType)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter une ligne « {section.label} »
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}

      {/* Notes & validity */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground flex-1 text-left">Notes & conditions</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Validité (jours)</Label>
                <Input
                  type="number"
                  min={1}
                  value={validityDays}
                  onChange={(e) => onValidityChange(parseInt(e.target.value) || 30)}
                  className="w-28 h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes / conditions</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  placeholder="Conditions particulières, délai d'intervention…"
                  rows={3}
                  className="text-sm"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Totals */}
      <QuoteTotalsFooter items={items} />
    </div>
  );
}
