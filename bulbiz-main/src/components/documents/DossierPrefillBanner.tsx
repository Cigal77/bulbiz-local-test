import { Sparkles, RefreshCw, Pencil, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface PrefillField {
  key: string;
  label: string;
  value: string | null | undefined;
  modified?: boolean;
}

interface DossierPrefillBannerProps {
  dossierRef?: string | null;
  fields: PrefillField[];
  onRefresh?: () => void;
  onEdit?: () => void;
  className?: string;
}

export function DossierPrefillBanner({
  dossierRef,
  fields,
  onRefresh,
  onEdit,
  className,
}: DossierPrefillBannerProps) {
  const filled = fields.filter((f) => f.value && String(f.value).trim() !== "");
  const missing = fields.filter((f) => !f.value || String(f.value).trim() === "");
  const modified = fields.filter((f) => f.modified);

  return (
    <section
      className={cn(
        "rounded-xl border border-primary/20 bg-primary/5 overflow-hidden",
        className,
      )}
    >
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-primary/10 bg-primary/10">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground flex-1">
          Prérempli depuis le dossier
        </h2>
        {dossierRef && (
          <Badge variant="outline" className="text-[10px] bg-background/60 border-primary/30">
            {dossierRef.slice(0, 8)}
          </Badge>
        )}
      </header>

      <div className="p-3 space-y-2.5">
        {/* Stats compactes */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            {filled.length} récupéré{filled.length > 1 ? "s" : ""}
          </Badge>
          {missing.length > 0 && (
            <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
              <AlertCircle className="h-3 w-3" />
              {missing.length} manquant{missing.length > 1 ? "s" : ""}
            </Badge>
          )}
          {modified.length > 0 && (
            <Badge variant="secondary" className="gap-1 bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">
              <Pencil className="h-3 w-3" />
              {modified.length} modifié{modified.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {/* Détail compact */}
        {filled.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            {filled.slice(0, 6).map((f) => (
              <div key={f.key} className="flex items-center gap-1.5 truncate">
                <span className="text-muted-foreground shrink-0">{f.label} :</span>
                <span className="font-medium text-foreground truncate">{f.value}</span>
                {f.modified && (
                  <Pencil className="h-2.5 w-2.5 text-blue-500 shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}

        {missing.length > 0 && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            ⚠️ À compléter : {missing.map((f) => f.label).join(", ")}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="h-7 text-[11px] gap-1.5 bg-background/60"
            >
              <RefreshCw className="h-3 w-3" />
              Actualiser depuis le dossier
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-7 text-[11px] gap-1.5"
            >
              <Pencil className="h-3 w-3" />
              Modifier
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
