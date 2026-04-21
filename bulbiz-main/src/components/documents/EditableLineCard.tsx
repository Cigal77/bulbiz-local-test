import { useState } from "react";
import { ReducedVatHelper } from "@/components/quote-editor/ReducedVatHelper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Wrench, Package, ShoppingBag, Truck, MoreHorizontal,
  Copy, Trash2, ChevronUp, ChevronDown, Percent, MoreVertical, GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type LineType = "main_oeuvre" | "materiel" | "fourniture" | "deplacement" | "standard";

export type DiscountUnit = "PERCENT" | "EUR";

export interface EditableLine {
  id: string;
  label: string;
  description?: string | null;
  qty: number;
  unit: string;
  unit_price: number;
  vat_rate: number;
  discount: number;
  discount_unit?: DiscountUnit;
  type?: LineType;
}

const TYPE_META: Record<LineType, { label: string; icon: typeof Wrench; accent: string }> = {
  main_oeuvre: { label: "Main d'œuvre", icon: Wrench, accent: "border-l-primary" },
  materiel:    { label: "Matériel",     icon: Package, accent: "border-l-blue-500" },
  fourniture:  { label: "Fourniture",   icon: ShoppingBag, accent: "border-l-amber-500" },
  deplacement: { label: "Déplacement",  icon: Truck, accent: "border-l-emerald-500" },
  standard:    { label: "Divers",       icon: MoreHorizontal, accent: "border-l-muted-foreground" },
};

const UNITS = ["u", "h", "m", "m²", "m³", "kg", "L", "forfait", "lot"];
const VAT_RATES = [0, 5.5, 10, 20];

interface EditableLineCardProps {
  line: EditableLine;
  index: number;
  total: number;
  onChange: (patch: Partial<EditableLine>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onTypeChange?: (type: LineType) => void;
  disabled?: boolean;
  showType?: boolean;
  hideVat?: boolean;
}

export function EditableLineCard({
  line, index, total, onChange, onDuplicate, onDelete, onMoveUp, onMoveDown,
  onTypeChange, disabled, showType = true, hideVat = false,
}: EditableLineCardProps) {
  const [showDescription, setShowDescription] = useState(!!line.description);
  const [reducedDialog, setReducedDialog] = useState<10 | 5.5 | null>(null);
  const meta = TYPE_META[line.type ?? "standard"];
  const TypeIcon = meta.icon;
  const discountUnit: DiscountUnit = line.discount_unit ?? "PERCENT";
  const showDiscount = (line.discount ?? 0) > 0;
  const baseHT = line.qty * line.unit_price;
  const discountAmount =
    discountUnit === "EUR"
      ? Math.min(line.discount || 0, baseHT)
      : (baseHT * (line.discount || 0)) / 100;
  const lineHT = Math.max(0, baseHT - discountAmount);

  return (
    <div className={cn("group rounded-lg border border-l-4 bg-card p-3 space-y-2", meta.accent)}>
      {/* Top row: index + label + actions */}
      <div className="flex items-start gap-2">
        <span className="text-[10px] text-muted-foreground font-mono mt-2 w-5 shrink-0">{index + 1}</span>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5">
            {showType && onTypeChange && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-1" disabled={disabled}>
                    <TypeIcon className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {(Object.keys(TYPE_META) as LineType[]).map((t) => {
                    const M = TYPE_META[t];
                    const I = M.icon;
                    return (
                      <DropdownMenuItem key={t} onClick={() => onTypeChange(t)}>
                        <I className="h-3.5 w-3.5 mr-2" />
                        {M.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Input
              className="h-8 text-sm font-medium border-0 px-1 focus-visible:ring-1 focus-visible:bg-muted/30"
              placeholder="Désignation…"
              value={line.label}
              onChange={(e) => onChange({ label: e.target.value })}
              disabled={disabled}
            />
          </div>
          {showDescription && (
            <Textarea
              className="text-xs min-h-[40px] resize-none"
              placeholder="Description (optionnelle)"
              value={line.description ?? ""}
              onChange={(e) => onChange({ description: e.target.value })}
              disabled={disabled}
            />
          )}
        </div>
        {!disabled && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-60 hover:opacity-100">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowDescription((v) => !v)}>
                <GripVertical className="h-3.5 w-3.5 mr-2" />
                {showDescription ? "Masquer description" : "Ajouter description"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onChange(showDiscount ? { discount: 0 } : { discount: 5, discount_unit: discountUnit })}
              >
                <Percent className="h-3.5 w-3.5 mr-2" />
                {showDiscount ? "Retirer la remise" : "Ajouter une remise"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-3.5 w-3.5 mr-2" /> Dupliquer
              </DropdownMenuItem>
              {onMoveUp && (
                <DropdownMenuItem onClick={onMoveUp}>
                  <ChevronUp className="h-3.5 w-3.5 mr-2" /> Monter
                </DropdownMenuItem>
              )}
              {onMoveDown && (
                <DropdownMenuItem onClick={onMoveDown}>
                  <ChevronDown className="h-3.5 w-3.5 mr-2" /> Descendre
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Numeric grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 pl-7">
        <div className="space-y-0.5">
          <Label className="text-[9px] text-muted-foreground uppercase">Qté</Label>
          <Input
            type="number" min={0} step={0.01}
            className="h-8 text-xs"
            value={line.qty}
            onChange={(e) => onChange({ qty: parseFloat(e.target.value) || 0 })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[9px] text-muted-foreground uppercase">Unité</Label>
          <Select value={line.unit} onValueChange={(v) => onChange({ unit: v })} disabled={disabled}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-0.5">
          <Label className="text-[9px] text-muted-foreground uppercase">PU HT</Label>
          <Input
            type="number" min={0} step={0.01}
            className="h-8 text-xs"
            value={line.unit_price}
            onChange={(e) => onChange({ unit_price: parseFloat(e.target.value) || 0 })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[9px] text-muted-foreground uppercase">TVA</Label>
          {hideVat ? (
            <div className="h-8 flex items-center text-[10px] text-muted-foreground italic px-1 leading-tight">
              Non applicable<br />art. 293 B
            </div>
          ) : (
            <Select
              value={String(line.vat_rate)}
              onValueChange={(v) => {
                const parsed = parseFloat(v);
                if ((parsed === 10 || parsed === 5.5) && line.vat_rate !== parsed) {
                  setReducedDialog(parsed as 10 | 5.5);
                  return;
                }
                onChange({ vat_rate: parsed });
              }}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VAT_RATES.map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        {showDiscount && (
          <div className="space-y-0.5 col-span-2 sm:col-span-1">
            <Label className="text-[9px] text-muted-foreground uppercase">Remise</Label>
            <div className="flex h-8 rounded-md border border-input overflow-hidden">
              <Input
                type="number" min={0} step={discountUnit === "EUR" ? 0.01 : 1}
                max={discountUnit === "PERCENT" ? 100 : undefined}
                className="h-8 text-xs border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
                value={line.discount}
                onChange={(e) => onChange({ discount: parseFloat(e.target.value) || 0 })}
                disabled={disabled}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange({ discount_unit: discountUnit === "PERCENT" ? "EUR" : "PERCENT" })}
                className="px-2 text-xs font-semibold bg-muted hover:bg-muted/70 border-l border-input transition-colors"
                title="Basculer entre % et €"
              >
                {discountUnit === "EUR" ? "€" : "%"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Total row */}
      <div className="flex items-center justify-between gap-2 pl-7 pt-1 border-t border-dashed border-border">
        <div className="flex items-center gap-2">
          {!showDiscount && !disabled && (
            <button
              type="button"
              onClick={() => onChange({ discount: 5, discount_unit: discountUnit })}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
            >
              <Percent className="h-3 w-3" /> Ajouter une remise
            </button>
          )}
          {showDiscount && (
            <span className="text-[10px] text-muted-foreground italic">
              Remise : -{discountAmount.toFixed(2)} €
              {discountUnit === "PERCENT" ? ` (${line.discount}%)` : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showDiscount && (
            <span className="text-[10px] text-muted-foreground line-through tabular-nums">
              {baseHT.toFixed(2)} €
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">Total HT</span>
          <span className="text-sm font-semibold text-foreground tabular-nums">{lineHT.toFixed(2)} €</span>
        </div>
      </div>

      {reducedDialog && (
        <ReducedVatHelper
          open={!!reducedDialog}
          onOpenChange={(o) => !o && setReducedDialog(null)}
          rate={reducedDialog}
          onConfirm={(legalText) => {
            onChange({
              vat_rate: reducedDialog,
              description:
                line.description && line.description.includes(legalText)
                  ? line.description
                  : [line.description, legalText].filter(Boolean).join("\n"),
            });
            setReducedDialog(null);
          }}
          onCancel={() => {
            onChange({ vat_rate: 20 });
            setReducedDialog(null);
          }}
        />
      )}
    </div>
  );
}
