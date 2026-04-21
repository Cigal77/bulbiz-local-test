import { FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface QuoteDocumentBlockProps {
  quoteNumber: string;
  validityDays: number;
  depositType?: string | null;
  depositValue?: number | null;
  onValidityChange: (v: number) => void;
  onDepositTypeChange?: (t: string | null) => void;
  onDepositValueChange?: (v: number | null) => void;
  disabled?: boolean;
}

export function QuoteDocumentBlock({
  quoteNumber,
  validityDays,
  depositType,
  depositValue,
  onValidityChange,
  onDepositTypeChange,
  onDepositValueChange,
  disabled,
}: QuoteDocumentBlockProps) {
  const today = new Date().toLocaleDateString("fr-FR");
  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <FileText className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground flex-1">Infos document</h2>
        {quoteNumber && (
          <Badge variant="secondary" className="text-[10px]">
            {quoteNumber}
          </Badge>
        )}
      </header>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <Label className="text-[10px]">N° de devis</Label>
          <Input className="h-9 text-sm font-mono" value={quoteNumber || "—"} disabled />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Date</Label>
          <Input className="h-9 text-sm" value={today} disabled />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Validité (j)</Label>
          <Input
            type="number"
            min={1}
            className="h-9 text-sm"
            value={validityDays}
            onChange={(e) => onValidityChange(parseInt(e.target.value) || 30)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Acompte</Label>
          <div className="flex gap-1">
            <Select
              value={depositType ?? "none"}
              onValueChange={(v) => onDepositTypeChange?.(v === "none" ? null : v)}
              disabled={disabled}
            >
              <SelectTrigger className="h-9 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                <SelectItem value="percent">%</SelectItem>
                <SelectItem value="amount">€</SelectItem>
              </SelectContent>
            </Select>
            {depositType && depositType !== "none" && (
              <Input
                type="number"
                min={0}
                className="h-9 text-sm w-16"
                value={depositValue ?? 0}
                onChange={(e) => onDepositValueChange?.(parseFloat(e.target.value) || 0)}
                disabled={disabled}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
