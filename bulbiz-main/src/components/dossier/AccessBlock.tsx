import type { Dossier } from "@/hooks/useDossier";
import { Building2, User, ArrowUpDown, KeyRound, CalendarDays, Wrench } from "lucide-react";
import { TRADE_LABELS, PROBLEM_LABELS, HOUSING_LABELS, OCCUPANT_LABELS, AVAILABILITY_LABELS } from "@/lib/trade-types";

interface AccessBlockProps {
  dossier: Dossier;
}

export function AccessBlock({ dossier }: AccessBlockProps) {
  const d = dossier as any;
  const tradeTypes: string[] = d.trade_types ?? [];
  const problemTypes: string[] = d.problem_types ?? [];
  const housingType: string | null = d.housing_type;
  const occupantType: string | null = d.occupant_type;
  const floorNumber: number | null = d.floor_number;
  const hasElevator: boolean | null = d.has_elevator;
  const accessCode: string | null = d.access_code;
  const availability: string | null = d.availability;

  const hasTradeInfo = tradeTypes.length > 0 || problemTypes.length > 0;
  const hasAccessInfo = housingType || occupantType || floorNumber != null || hasElevator != null || accessCode || availability;

  if (!hasTradeInfo && !hasAccessInfo) return null;

  return (
    <div className="space-y-3">
      {/* Trade types & problems */}
      {hasTradeInfo && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Métiers & Problèmes</h3>
          {tradeTypes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tradeTypes.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                  <Wrench className="h-3 w-3" />
                  {TRADE_LABELS[t] ?? t}
                </span>
              ))}
            </div>
          )}
          {problemTypes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {problemTypes.map((p) => (
                <span key={p} className="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {PROBLEM_LABELS[p] ?? p}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Access & housing */}
      {hasAccessInfo && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accès & Logement</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {housingType && (
              <div className="flex items-center gap-2 text-foreground">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{HOUSING_LABELS[housingType] ?? housingType}</span>
              </div>
            )}
            {occupantType && (
              <div className="flex items-center gap-2 text-foreground">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{OCCUPANT_LABELS[occupantType] ?? occupantType}</span>
              </div>
            )}
            {floorNumber != null && (
              <div className="flex items-center gap-2 text-foreground">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>Étage {floorNumber}{hasElevator === true ? " (ascenseur)" : hasElevator === false ? " (sans ascenseur)" : ""}</span>
              </div>
            )}
            {floorNumber == null && hasElevator !== null && (
              <div className="flex items-center gap-2 text-foreground">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{hasElevator ? "Avec ascenseur" : "Sans ascenseur"}</span>
              </div>
            )}
            {accessCode && (
              <div className="flex items-center gap-2 text-foreground">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>Code : {accessCode}</span>
              </div>
            )}
            {availability && (
              <div className="flex items-center gap-2 text-foreground">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{AVAILABILITY_LABELS[availability] ?? availability}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
