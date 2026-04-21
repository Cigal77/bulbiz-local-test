import { useState } from "react";
import { FileText, ChevronDown, ChevronUp, Image as ImageIcon, Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface DossierContextSummaryProps {
  category?: string | null;
  urgency?: string | null;
  description?: string | null;
  notes?: string | null;
  updatedAt?: string | null;
  mediaCount?: number;
  className?: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  wc: "WC",
  fuite: "Fuite",
  chauffe_eau: "Chauffe-eau",
  evier: "Évier",
  douche: "Douche",
  autre: "Autre",
};

const URGENCY_LABEL: Record<string, string> = {
  aujourdhui: "Urgent",
  "48h": "Sous 48h",
  semaine: "Cette semaine",
};

export function DossierContextSummary({
  category,
  urgency,
  description,
  notes,
  updatedAt,
  mediaCount = 0,
  className,
}: DossierContextSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const hasContent = description || notes || mediaCount > 0;

  if (!category && !description && !notes && !mediaCount) return null;

  return (
    <section className={cn("rounded-xl border bg-card overflow-hidden", className)}>
      <header className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
        <FileText className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground flex-1">
          Résumé du dossier
        </h2>
        {hasContent && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((e) => !e)}
            className="h-7 text-[11px] gap-1"
          >
            {expanded ? (
              <>
                Réduire <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Détails <ChevronDown className="h-3 w-3" />
              </>
            )}
          </Button>
        )}
      </header>

      <div className="p-3 space-y-2">
        {/* Méta : catégorie + urgence + date + médias */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {category && (
            <Badge variant="outline" className="text-[10px]">
              {CATEGORY_LABEL[category] ?? category}
            </Badge>
          )}
          {urgency && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] gap-1",
                urgency === "aujourdhui" &&
                  "border-destructive/40 text-destructive bg-destructive/5",
              )}
            >
              {urgency === "aujourdhui" && <AlertTriangle className="h-2.5 w-2.5" />}
              {URGENCY_LABEL[urgency] ?? urgency}
            </Badge>
          )}
          {mediaCount > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <ImageIcon className="h-2.5 w-2.5" />
              {mediaCount} pièce{mediaCount > 1 ? "s" : ""}
            </Badge>
          )}
          {updatedAt && (
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1 ml-auto">
              <Clock className="h-2.5 w-2.5" />
              MAJ {formatDistanceToNow(new Date(updatedAt), { locale: fr, addSuffix: true })}
            </span>
          )}
        </div>

        {/* Description courte (toujours visible si présente) */}
        {description && (
          <p
            className={cn(
              "text-xs text-foreground/90 leading-relaxed",
              !expanded && "line-clamp-2",
            )}
          >
            {description}
          </p>
        )}

        {/* Notes (cachées par défaut) */}
        {expanded && notes && (
          <div className="rounded-lg bg-muted/40 p-2.5 border-l-2 border-primary/40">
            <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">
              Notes du dossier
            </p>
            <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {notes}
            </p>
          </div>
        )}

        {!hasContent && (
          <p className="text-[11px] text-muted-foreground italic">
            Aucune information complémentaire dans ce dossier.
          </p>
        )}
      </div>
    </section>
  );
}
