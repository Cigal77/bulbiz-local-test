import { Eye, Send, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickActionsBarProps {
  isSaving?: boolean;
  isSending?: boolean;
  isGeneratingPdf?: boolean;
  canSend: boolean;
  onPreview: () => void;
  onSend: () => void;
}

export function QuickActionsBar({
  isSaving,
  isSending,
  isGeneratingPdf,
  canSend,
  onPreview,
  onSend,
}: QuickActionsBarProps) {
  return (
    <div className="md:hidden fixed bottom-16 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-md px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-1 min-w-0">
          {isSaving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
              <span className="truncate">Enregistrement…</span>
            </>
          ) : (
            <>
              <Check className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate">Brouillon enregistré</span>
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={onPreview}
          disabled={isGeneratingPdf || !canSend}
          className="h-9 w-9 shrink-0"
        >
          {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          size="sm"
          onClick={onSend}
          disabled={isSending || !canSend}
          className="gap-1.5 flex-[2]"
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Envoyer
        </Button>
      </div>
    </div>
  );
}
