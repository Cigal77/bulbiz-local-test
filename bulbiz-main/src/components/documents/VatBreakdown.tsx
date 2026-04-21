import { useMemo } from "react";

export interface VatBreakdownLine {
  qty: number;
  unit_price: number;
  vat_rate: number;
  discount?: number;
}

interface Props {
  lines: VatBreakdownLine[];
  /** Si true, on masque la TVA (mode franchise en base). */
  hideVat?: boolean;
  className?: string;
}

/**
 * Affiche un détail HT/TVA/TTC ventilé par taux quand plusieurs taux coexistent.
 * Calcul pur, aucun appel DB.
 */
export function VatBreakdown({ lines, hideVat, className }: Props) {
  const { byRate, totalHt, totalTva, totalTtc } = useMemo(() => {
    const map = new Map<number, { base: number; tva: number }>();
    let totalHt = 0;
    let totalTva = 0;
    for (const l of lines) {
      const base = l.qty * l.unit_price * (1 - (l.discount ?? 0) / 100);
      const tva = hideVat ? 0 : (base * l.vat_rate) / 100;
      const cur = map.get(l.vat_rate) ?? { base: 0, tva: 0 };
      cur.base += base;
      cur.tva += tva;
      map.set(l.vat_rate, cur);
      totalHt += base;
      totalTva += tva;
    }
    return {
      byRate: Array.from(map.entries()).sort((a, b) => a[0] - b[0]),
      totalHt,
      totalTva,
      totalTtc: totalHt + totalTva,
    };
  }, [lines, hideVat]);

  const showBreakdown = !hideVat && byRate.length > 1;

  return (
    <div className={"rounded-lg border bg-card p-3 text-sm space-y-2 " + (className ?? "")}>
      {showBreakdown && (
        <div className="space-y-1 pb-2 border-b border-dashed">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            Détail TVA par taux
          </p>
          {byRate.map(([rate, v]) => (
            <div key={rate} className="flex items-center justify-between text-xs tabular-nums">
              <span className="text-muted-foreground">Base {rate.toString().replace(".", ",")} %</span>
              <span className="font-medium">{v.base.toFixed(2)} €</span>
              <span className="text-muted-foreground">+</span>
              <span className="font-medium">{v.tva.toFixed(2)} € TVA</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Total HT</span>
        <span className="font-medium tabular-nums">{totalHt.toFixed(2)} €</span>
      </div>
      {!hideVat && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">TVA</span>
          <span className="font-medium tabular-nums">{totalTva.toFixed(2)} €</span>
        </div>
      )}
      <div className="flex items-center justify-between pt-2 border-t">
        <span className="font-bold text-sm">{hideVat ? "Net à payer" : "Total TTC"}</span>
        <span className="font-bold text-base text-primary tabular-nums">
          {totalTtc.toFixed(2)} €
        </span>
      </div>
      {hideVat && (
        <p className="text-[10px] text-muted-foreground italic pt-1">
          TVA non applicable, art. 293 B du CGI
        </p>
      )}
    </div>
  );
}