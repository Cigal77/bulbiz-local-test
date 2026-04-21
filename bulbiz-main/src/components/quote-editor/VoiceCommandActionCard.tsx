import { Plus, Pencil, Trash2, Percent, Tag, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VoiceAction } from "@/lib/voice-quote-types";
import { actionDescription } from "@/lib/voice-quote-types";
import type { QuoteItem } from "@/lib/quote-types";

interface Props {
  action: VoiceAction;
  items: QuoteItem[];
  onToggle: (accepted: boolean) => void;
}

const ICONS: Record<VoiceAction["type"], { icon: typeof Plus; color: string; bg: string; label: string }> = {
  add_line: { icon: Plus, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", label: "Ajout" },
  update_line: { icon: Pencil, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", label: "Modif" },
  delete_line: { icon: Trash2, color: "text-destructive", bg: "bg-destructive/10", label: "Suppr." },
  set_discount: { icon: Percent, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", label: "Remise" },
  set_vat: { icon: Tag, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", label: "TVA" },
  rename_quote: { icon: FileText, color: "text-primary", bg: "bg-primary/10", label: "Titre" },
};

export function VoiceCommandActionCard({ action, items, onToggle }: Props) {
  const meta = ICONS[action.type];
  const Icon = meta.icon;
  const lowConfidence = action.confidence < 0.7;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
        action.accepted ? "bg-card" : "bg-muted/30 opacity-60",
        lowConfidence && action.accepted && "border-amber-500/40",
      )}
    >
      <Checkbox
        checked={action.accepted}
        onCheckedChange={(c) => onToggle(c === true)}
        className="mt-1"
        aria-label={action.accepted ? "Décocher l'action" : "Cocher l'action"}
      />
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", meta.bg)}>
        <Icon className={cn("h-4 w-4", meta.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {meta.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Confiance {Math.round(action.confidence * 100)}%
          </span>
          {lowConfidence && (
            <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 dark:text-amber-400">
              À vérifier
            </Badge>
          )}
        </div>
        <p className="text-sm text-foreground mt-1 break-words">
          {actionDescription(action, items)}
        </p>
        {action.type === "add_line" && action.source === "ai_fallback" && (
          <p className="text-[11px] text-muted-foreground mt-0.5">Prix estimé par IA</p>
        )}
        {action.type === "add_line" && action.source === "catalog" && (
          <p className="text-[11px] text-muted-foreground mt-0.5">Prix issu du catalogue</p>
        )}
      </div>
    </div>
  );
}
