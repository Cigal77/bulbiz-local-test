import { CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Invoice } from "@/hooks/useInvoices";

interface InvoicePaymentBlockProps {
  form: Partial<Invoice>;
  onChange: (patch: Partial<Invoice>) => void;
  disabled?: boolean;
}

export function InvoicePaymentBlock({ form, onChange, disabled }: InvoicePaymentBlockProps) {
  const isPro = form.client_type === "business";
  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <CreditCard className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground flex-1">Paiement</h2>
      </header>
      <div className="p-4 space-y-3">
        <div className="space-y-1">
          <Label className="text-[10px]">Conditions de paiement</Label>
          <Textarea
            className="text-sm min-h-[60px]"
            placeholder="Paiement à réception. Virement, chèque ou espèces."
            value={form.payment_terms ?? ""}
            onChange={(e) => onChange({ payment_terms: e.target.value })}
            disabled={disabled}
          />
        </div>
        {isPro && (
          <div className="space-y-1">
            <Label className="text-[10px]">Pénalités de retard (B2B)</Label>
            <Textarea
              className="text-sm min-h-[40px]"
              placeholder="Indemnité forfaitaire 40 € + intérêts légaux"
              value={form.late_fees_text ?? ""}
              onChange={(e) => onChange({ late_fees_text: e.target.value })}
              disabled={disabled}
            />
            <p className="text-[10px] text-muted-foreground">
              Mention obligatoire pour les factures B2B (art. L441-10 C. com.)
            </p>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-[10px]">Notes / mentions complémentaires</Label>
          <Textarea
            className="text-sm min-h-[40px]"
            value={form.notes ?? ""}
            onChange={(e) => onChange({ notes: e.target.value })}
            disabled={disabled}
          />
        </div>
      </div>
    </section>
  );
}
