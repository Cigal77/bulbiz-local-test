import { cn } from "@/lib/utils";
import { Check, AlertTriangle } from "lucide-react";
import { SECTIONS, type QuoteItem } from "@/lib/quote-types";

interface QuoteSectionChecklistProps {
  items: QuoteItem[];
}

export function QuoteSectionChecklist({ items }: QuoteSectionChecklistProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-3">
      {SECTIONS.filter(s => s.key !== "standard").map((section) => {
        const count = items.filter(i => i.type === section.key).length;
        const hasItems = count > 0;
        const Icon = section.icon;

        return (
          <div
            key={section.key}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium shrink-0 border transition-colors",
              hasItems
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-muted/50 border-border text-muted-foreground"
            )}
          >
            <Icon className="h-3 w-3" />
            <span>{section.label}</span>
            {hasItems ? (
              <Check className="h-3 w-3" />
            ) : (
              <AlertTriangle className="h-3 w-3 opacity-50" />
            )}
          </div>
        );
      })}
    </div>
  );
}
