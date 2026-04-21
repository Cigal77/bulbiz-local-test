import { FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { Invoice } from "@/hooks/useInvoices";

interface InvoiceDocumentBlockProps {
  form: Partial<Invoice>;
  onChange: (patch: Partial<Invoice>) => void;
  invoiceNumber: string;
  disabled?: boolean;
}

export function InvoiceDocumentBlock({ form, onChange, invoiceNumber, disabled }: InvoiceDocumentBlockProps) {
  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <FileText className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground flex-1">Infos facture</h2>
        {invoiceNumber && (
          <Badge variant="secondary" className="text-[10px]">{invoiceNumber}</Badge>
        )}
      </header>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px]">Date d'émission</Label>
            <Input
              type="date"
              className="h-9 text-sm"
              value={form.issue_date ?? ""}
              onChange={(e) => onChange({ issue_date: e.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Date intervention</Label>
            <Input
              type="date"
              className="h-9 text-sm"
              value={form.service_date ?? ""}
              onChange={(e) => onChange({ service_date: e.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Échéance</Label>
            <Input
              type="date"
              className="h-9 text-sm"
              value={form.due_date ?? ""}
              onChange={(e) => onChange({ due_date: e.target.value })}
              disabled={disabled}
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
          <div>
            <p className="text-xs font-medium text-foreground">TVA non applicable</p>
            <p className="text-[10px] text-muted-foreground">Article 293 B du CGI (franchise en base)</p>
          </div>
          <Switch
            checked={form.vat_mode === "no_vat_293b"}
            onCheckedChange={(v) => onChange({ vat_mode: v ? "no_vat_293b" : "normal" })}
            disabled={disabled}
          />
        </div>
      </div>
    </section>
  );
}
