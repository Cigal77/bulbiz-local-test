import { Button } from "@/components/ui/button";
import { Plus, Receipt, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EditableLineCard, type EditableLine, type LineType } from "@/components/documents/EditableLineCard";
import type { InvoiceLine } from "@/hooks/useInvoices";
import { VatBreakdown } from "@/components/documents/VatBreakdown";

interface InvoiceLinesBlockProps {
  lines: InvoiceLine[];
  onChange: (lines: InvoiceLine[]) => void;
  disabled?: boolean;
  vatMode?: "normal" | "no_vat_293b";
  defaultVatRate?: number;
}

export function InvoiceLinesBlock({ lines, onChange, disabled, vatMode, defaultVatRate = 10 }: InvoiceLinesBlockProps) {
  const hideVat = vatMode === "no_vat_293b";
  const addLine = () => {
    onChange([
      ...lines,
      {
        id: crypto.randomUUID(),
        invoice_id: "",
        label: "",
        description: null,
        qty: 1,
        unit: "u",
        unit_price: 0,
        tva_rate: hideVat ? 0 : defaultVatRate,
        discount: 0,
        discount_unit: "PERCENT",
        sort_order: lines.length,
      },
    ]);
  };

  const updateLine = (idx: number, patch: Partial<InvoiceLine>) => {
    onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  const duplicateLine = (idx: number) => {
    const copy = { ...lines[idx], id: crypto.randomUUID() };
    const next = [...lines];
    next.splice(idx + 1, 0, copy);
    onChange(next);
  };
  const removeLine = (idx: number) => onChange(lines.filter((_, i) => i !== idx));
  const moveLine = (idx: number, dir: -1 | 1) => {
    const next = [...lines];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <h2 className="text-sm font-semibold text-foreground flex-1">
          Lignes <span className="text-muted-foreground font-normal">({lines.length})</span>
        </h2>
        {hideVat ? (
          <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px]">
            <Receipt className="h-3 w-3" /> Franchise 293 B
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 border-success/40 bg-success/10 text-success text-[10px]">
            <ReceiptText className="h-3 w-3" /> TVA active
          </Badge>
        )}
        {!disabled && (
          <Button variant="outline" size="sm" onClick={addLine} className="gap-1 h-7 text-xs">
            <Plus className="h-3 w-3" /> Ligne
          </Button>
        )}
      </header>
      <div className="p-3 space-y-2">
        {lines.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Aucune ligne — cliquez sur « + Ligne » ou utilisez l'assistant IA →
          </p>
        ) : (
          lines.map((line, idx) => {
            const ln: EditableLine = {
              id: line.id,
              label: line.label,
              description: line.description,
              qty: line.qty,
              unit: line.unit,
              unit_price: line.unit_price,
              vat_rate: line.tva_rate,
              discount: line.discount ?? 0,
            discount_unit: (line as any).discount_unit ?? "PERCENT",
              type: "standard",
            };
          const base = line.qty * line.unit_price;
          const d = line.discount || 0;
          const total = (line as any).discount_unit === "EUR"
            ? Math.max(0, base - d)
            : base * (1 - d / 100);
            return (
              <EditableLineCard
                key={line.id}
                line={ln}
                index={idx}
                total={total}
                disabled={disabled}
                showType={false}
                hideVat={hideVat}
                onChange={(patch) => {
                  const mapped: Partial<InvoiceLine> = {};
                  if (patch.label !== undefined) mapped.label = patch.label;
                  if (patch.description !== undefined) mapped.description = patch.description ?? null;
                  if (patch.qty !== undefined) mapped.qty = patch.qty;
                  if (patch.unit !== undefined) mapped.unit = patch.unit;
                  if (patch.unit_price !== undefined) mapped.unit_price = patch.unit_price;
                  if (patch.vat_rate !== undefined) mapped.tva_rate = patch.vat_rate;
                  if (patch.discount !== undefined) mapped.discount = patch.discount;
                if (patch.discount_unit !== undefined) (mapped as any).discount_unit = patch.discount_unit;
                  updateLine(idx, mapped);
                }}
                onDuplicate={() => duplicateLine(idx)}
                onDelete={() => removeLine(idx)}
                onMoveUp={idx > 0 ? () => moveLine(idx, -1) : undefined}
                onMoveDown={idx < lines.length - 1 ? () => moveLine(idx, 1) : undefined}
              />
            );
          })
        )}
        {lines.length > 0 && (
          <VatBreakdown
            className="mt-3"
            hideVat={hideVat}
            lines={lines.map((l) => ({
              qty: l.qty,
              unit_price: l.unit_price,
              vat_rate: l.tva_rate,
              discount: l.discount ?? 0,
            }))}
          />
        )}
      </div>
    </section>
  );
}
