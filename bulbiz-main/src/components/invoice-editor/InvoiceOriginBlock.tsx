import { FileText, Repeat2, Receipt, FileMinus } from "lucide-react";
import { cn } from "@/lib/utils";

export type InvoiceOrigin = "from_quote" | "standalone" | "deposit" | "credit_note";

interface InvoiceOriginBlockProps {
  value: InvoiceOrigin;
  onChange?: (v: InvoiceOrigin) => void;
  hasLinkedQuote?: boolean;
  disabled?: boolean;
}

const OPTIONS = [
  { key: "from_quote" as const, label: "Depuis devis", icon: Repeat2, hint: "Reprend les lignes du devis signé" },
  { key: "standalone" as const, label: "Facture libre", icon: FileText, hint: "Création directe sans devis" },
  { key: "deposit" as const, label: "Acompte", icon: Receipt, hint: "Facture d'acompte (Lot 2)", soon: true },
  { key: "credit_note" as const, label: "Avoir", icon: FileMinus, hint: "Note de crédit (Lot 2)", soon: true },
];

export function InvoiceOriginBlock({ value, onChange, hasLinkedQuote, disabled }: InvoiceOriginBlockProps) {
  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <FileText className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground flex-1">Origine</h2>
      </header>
      <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = value === opt.key;
          const isDisabled = disabled || opt.soon || (opt.key === "from_quote" && !hasLinkedQuote && !isActive);
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => !isDisabled && onChange?.(opt.key)}
              disabled={isDisabled}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors",
                isActive
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-background hover:bg-muted/40 text-muted-foreground",
                isDisabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <Icon className={cn("h-4 w-4", isActive && "text-primary")} />
              <span className="text-xs font-medium text-foreground">{opt.label}</span>
              {opt.soon && (
                <span className="absolute top-1 right-1 text-[8px] uppercase tracking-wider rounded bg-muted px-1 py-0.5 text-muted-foreground">
                  Bientôt
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
