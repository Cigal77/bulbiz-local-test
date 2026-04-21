import type { QuoteItem } from "@/lib/quote-types";
import { Badge } from "@/components/ui/badge";
import { Receipt, ReceiptText } from "lucide-react";
import { VatBreakdown } from "@/components/documents/VatBreakdown";
import { useComplianceProfile } from "@/hooks/useComplianceProfile";

interface QuoteTotalsFooterProps {
  items: QuoteItem[];
}

export function QuoteTotalsFooter({ items }: QuoteTotalsFooterProps) {
  const { profile } = useComplianceProfile();
  const hideVat = profile?.vat_applicable === false;

  return (
    <div className="space-y-2 mt-3">
      <div className="flex items-center justify-end">
        {hideVat ? (
          <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <Receipt className="h-3 w-3" />
            Franchise en base — TVA non facturée
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 border-success/40 bg-success/10 text-success">
            <ReceiptText className="h-3 w-3" />
            TVA active
          </Badge>
        )}
      </div>
      <VatBreakdown
        lines={items.map((i) => ({
          qty: i.qty,
          unit_price: i.unit_price,
          vat_rate: i.vat_rate,
          discount: i.discount,
        }))}
        hideVat={hideVat}
      />
    </div>
  );
}
