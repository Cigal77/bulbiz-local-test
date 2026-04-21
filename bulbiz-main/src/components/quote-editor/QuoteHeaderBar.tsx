import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Eye, Send, Loader2, User, MapPin, Calendar, Sparkles } from "lucide-react";
import { BulbizLogo } from "@/components/BulbizLogo";
import type { Dossier } from "@/hooks/useDossier";

interface QuoteHeaderBarProps {
  dossier: Dossier;
  quoteNumber: string;
  isSaving: boolean;
  isSending: boolean;
  isGeneratingPdf: boolean;
  itemCount: number;
  onBack: () => void;
  onGeneratePdf: () => void;
  onSend: () => void;
  onTriggerAi?: () => void;
  isGeneratingAi?: boolean;
}

export function QuoteHeaderBar({
  dossier, quoteNumber, isSaving, isSending, isGeneratingPdf,
  itemCount, onBack, onGeneratePdf, onSend, onTriggerAi, isGeneratingAi,
}: QuoteHeaderBarProps) {
  const clientName = `${dossier.client_first_name ?? ""} ${dossier.client_last_name ?? ""}`.trim() || "Client";

  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
      {/* Top row: logo + actions */}
      <div className="flex items-center gap-2 px-3 sm:px-5 py-2.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <BulbizLogo size={18} showText={false} />
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold text-foreground truncate">
            {quoteNumber || "Nouveau devis"}
          </h1>
        </div>

        {/* Autosave indicator */}
        {isSaving && (
          <span className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Sauvegarde…
          </span>
        )}
        {!isSaving && itemCount > 0 && (
          <span className="hidden sm:block text-[11px] text-muted-foreground">
            ✓ Enregistré
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {onTriggerAi && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
              onClick={onTriggerAi}
              disabled={isGeneratingAi}
              title="Générer un pré-devis avec l'IA à partir du dossier"
            >
              {isGeneratingAi ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Pré-devis IA</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={onGeneratePdf}
            disabled={isGeneratingPdf || itemCount === 0}
          >
            {isGeneratingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={onSend}
            disabled={isSending || !dossier.client_email || itemCount === 0}
          >
            {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Envoyer</span>
          </Button>
        </div>
      </div>

      {/* Bottom row: client info */}
      <div className="flex items-center gap-3 px-3 sm:px-5 pb-2 text-[11px] text-muted-foreground overflow-x-auto">
        <span className="flex items-center gap-1 shrink-0">
          <User className="h-3 w-3" /> {clientName}
        </span>
        {dossier.address && (
          <span className="flex items-center gap-1 shrink-0">
            <MapPin className="h-3 w-3" /> <span className="truncate max-w-[200px]">{dossier.address}</span>
          </span>
        )}
        <span className="flex items-center gap-1 shrink-0">
          <Calendar className="h-3 w-3" /> {new Date().toLocaleDateString("fr-FR")}
        </span>
        <Badge variant="outline" className="text-[10px] h-5 shrink-0">Brouillon</Badge>
      </div>
    </header>
  );
}
