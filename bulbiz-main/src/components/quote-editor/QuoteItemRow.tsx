import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Copy, GripVertical, Trash2, ChevronUp, ChevronDown, Percent } from "lucide-react";
import type { QuoteItem } from "@/lib/quote-types";
import { calcLineTotal, UNIT_OPTIONS } from "@/lib/quote-types";
import { cn } from "@/lib/utils";
import { MaterialAutocomplete } from "@/components/quote-editor/MaterialAutocomplete";
import { useMaterialAutoSave } from "@/hooks/useMaterialAutoSave";
import { useRef, useState } from "react";
import { ReducedVatHelper } from "@/components/quote-editor/ReducedVatHelper";

interface QuoteItemRowProps {
  item: QuoteItem;
  index: number;
  onChange: (id: string, field: keyof QuoteItem, value: unknown) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  dragHandleProps?: Record<string, unknown>;
  hideVat?: boolean;
}

const TYPE_STYLES: Record<string, string> = {
  main_oeuvre: "border-l-4 border-l-primary/40",
  deplacement: "border-l-4 border-l-warning/40",
  materiel: "border-l-4 border-l-accent-foreground/30",
  fourniture: "border-l-4 border-l-success/30",
  standard: "",
};

export function QuoteItemRow({ item, index, onChange, onDuplicate, onDelete, onMoveUp, onMoveDown, dragHandleProps, hideVat }: QuoteItemRowProps) {
  const lineTotal = calcLineTotal(item);
  const { saveLineToCatalog } = useMaterialAutoSave();
  // Évite double-save : on ne sauvegarde que si la ligne a changé depuis le dernier save
  const lastSavedKey = useRef<string>("");
  const [reducedDialog, setReducedDialog] = useState<10 | 5.5 | null>(null);
  const discountUnit = item.discount_unit ?? "PERCENT";
  const showDiscount = (item.discount ?? 0) > 0;
  const baseHT = item.qty * item.unit_price;
  const discountAmount =
    discountUnit === "EUR"
      ? Math.min(item.discount || 0, baseHT)
      : (baseHT * (item.discount || 0)) / 100;

  const handleAutoSave = () => {
    const key = `${item.label.trim().toLowerCase()}|${item.unit}|${item.unit_price}`;
    if (key === lastSavedKey.current) return;
    if (!item.label.trim() || item.unit_price <= 0) return;
    lastSavedKey.current = key;
    saveLineToCatalog({
      label: item.label,
      unit: item.unit,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
      line_type: item.type,
      description: item.description,
    });
  };

  return (
    <div className={cn("rounded-lg border bg-background p-3 space-y-2", TYPE_STYLES[item.type] || "")}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div {...dragHandleProps} className="cursor-grab text-muted-foreground hover:text-foreground hidden sm:block">
          <GripVertical className="h-4 w-4" />
        </div>
        <span className="text-[10px] font-medium text-muted-foreground w-5">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <MaterialAutocomplete
            value={item.label}
            onChange={(v) => onChange(item.id, "label", v)}
            onPick={(s) => {
              onChange(item.id, "label", s.label);
              onChange(item.id, "unit", s.unit);
              onChange(item.id, "unit_price", s.unit_price);
              onChange(item.id, "vat_rate", s.vat_rate);
              if ((s as any).description) {
                onChange(item.id, "description", (s as any).description);
              }
              // Marquer comme déjà connu pour éviter un re-save inutile
              lastSavedKey.current = `${s.label.trim().toLowerCase()}|${s.unit}|${s.unit_price}`;
            }}
            onBlur={handleAutoSave}
            typeFilter={item.type}
            placeholder="Désignation (ex : tuyau cuivre Ø16)"
            className="h-8 text-sm"
            autoFocus={!item.label}
          />
        </div>
        <div className="flex gap-0.5">
          {onMoveUp && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} title="Monter">
              <ChevronUp className="h-3 w-3" />
            </Button>
          )}
          {onMoveDown && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} title="Descendre">
              <ChevronDown className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDuplicate(item.id)} title="Dupliquer">
            <Copy className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(item.id)} title="Supprimer">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Description */}
      <Input
        value={item.description}
        onChange={(e) => onChange(item.id, "description", e.target.value)}
        placeholder="Description (optionnel)"
        className="text-xs text-muted-foreground h-7"
      />

      {/* Numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 items-end">
        <div className="space-y-0.5">
          <label className="text-[9px] font-medium text-muted-foreground uppercase">Qté</label>
          <Input
            type="number" min={0} step="0.5"
            value={item.qty}
            onChange={(e) => onChange(item.id, "qty", parseFloat(e.target.value) || 0)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] font-medium text-muted-foreground uppercase">Unité</label>
          <Select value={item.unit} onValueChange={(v) => onChange(item.id, "unit", v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.map((u) => (
                <SelectItem key={u} value={u} className="text-sm">{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] font-medium text-muted-foreground uppercase">PU HT</label>
          <Input
            type="number" min={0} step="0.01"
            value={item.unit_price}
            onChange={(e) => onChange(item.id, "unit_price", parseFloat(e.target.value) || 0)}
            onBlur={handleAutoSave}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] font-medium text-muted-foreground uppercase">TVA</label>
          {hideVat ? (
            <div className="h-8 flex items-center text-[10px] text-muted-foreground italic px-1">
              Non applicable<br />art. 293 B
            </div>
          ) : (
            <Select
              value={String(item.vat_rate)}
              onValueChange={(v) => {
                const parsed = parseFloat(v);
                if ((parsed === 10 || parsed === 5.5) && item.vat_rate !== parsed) {
                  setReducedDialog(parsed as 10 | 5.5);
                  return;
                }
                onChange(item.id, "vat_rate", parsed);
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0, 5.5, 10, 20].map((r) => (
                  <SelectItem key={r} value={String(r)} className="text-sm">{r}%</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-0.5 text-right">
          <label className="text-[9px] font-medium text-muted-foreground uppercase">Total HT</label>
          <div className="h-8 flex items-center justify-end text-sm font-bold text-primary">
            {lineTotal.toFixed(2)} €
          </div>
        </div>
      </div>

      {/* Discount row */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-dashed border-border">
        {showDiscount ? (
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[9px] font-medium text-muted-foreground uppercase">Remise</span>
            <div className="flex h-7 rounded-md border border-input overflow-hidden w-[120px]">
              <Input
                type="number" min={0} step={discountUnit === "EUR" ? 0.01 : 1}
                max={discountUnit === "PERCENT" ? 100 : undefined}
                className="h-7 text-xs border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
                value={item.discount}
                onChange={(e) => onChange(item.id, "discount", parseFloat(e.target.value) || 0)}
              />
              <button
                type="button"
                onClick={() => onChange(item.id, "discount_unit", discountUnit === "PERCENT" ? "EUR" : "PERCENT")}
                className="px-2 text-xs font-semibold bg-muted hover:bg-muted/70 border-l border-input transition-colors"
                title="Basculer entre % et €"
              >
                {discountUnit === "EUR" ? "€" : "%"}
              </button>
            </div>
            <span className="text-[10px] text-muted-foreground italic">
              -{discountAmount.toFixed(2)} €
            </span>
            <Button
              variant="ghost" size="sm"
              className="h-6 px-1.5 text-[10px] text-muted-foreground"
              onClick={() => onChange(item.id, "discount", 0)}
            >
              Retirer
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onChange(item.id, "discount", 5)}
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
          >
            <Percent className="h-3 w-3" /> Ajouter une remise
          </button>
        )}
      </div>
      {reducedDialog && (
        <ReducedVatHelper
          open={!!reducedDialog}
          onOpenChange={(o) => !o && setReducedDialog(null)}
          rate={reducedDialog}
          onConfirm={(legalText) => {
            onChange(item.id, "vat_rate", reducedDialog);
            const desc = item.description ?? "";
            if (!desc.includes(legalText)) {
              onChange(item.id, "description", [desc, legalText].filter(Boolean).join("\n"));
            }
            setReducedDialog(null);
          }}
          onCancel={() => {
            onChange(item.id, "vat_rate", 20);
            setReducedDialog(null);
          }}
        />
      )}
    </div>
  );
}
