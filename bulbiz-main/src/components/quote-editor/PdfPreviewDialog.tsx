import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, X } from "lucide-react";

interface PdfPreviewDialogProps {
  open: boolean;
  url: string | null;
  title?: string;
  onClose: () => void;
}

export function PdfPreviewDialog({ open, url, title = "Aperçu PDF", onClose }: PdfPreviewDialogProps) {
  if (!url) return null;
  // Cache-buster pour éviter d'afficher une ancienne version
  const src = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}#toolbar=1&view=FitH`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-5xl w-[95vw] h-[90vh] p-0 gap-0 flex flex-col overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5 bg-muted/30">
          <DialogTitle className="text-sm font-semibold truncate">{title}</DialogTitle>
          <div className="flex items-center gap-1.5">
            <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Nouvel onglet</span>
              </a>
            </Button>
            <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
              <a href={url} download>
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Télécharger</span>
              </a>
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} aria-label="Fermer">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <div className="flex-1 bg-muted/20 min-h-0">
          <iframe
            src={src}
            title={title}
            className="w-full h-full border-0"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
