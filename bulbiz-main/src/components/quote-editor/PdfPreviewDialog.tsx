import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PdfPreviewDialogProps {
  open: boolean;
  url: string | null;
  title?: string;
  onClose: () => void;
}

// Fixed overlay sans portal Radix pour éviter le crash insertBefore sur Android Chrome.
// Le Dialog Radix utilise DialogPortal (createPortal → insertBefore dans le body)
// ce qui crash quand Chrome modifie le DOM entre deux rendus React.
export function PdfPreviewDialog({ open, url, title = "Aperçu PDF", onClose }: PdfPreviewDialogProps) {
  // Stabilise le src : on le recalcule uniquement à l'ouverture pour éviter de recharger l'iframe à chaque render.
  const srcRef = useRef("about:blank");
  const prevOpenRef = useRef(false);
  const prevUrlRef = useRef<string | null>(null);

  if (open && url && (!prevOpenRef.current || url !== prevUrlRef.current)) {
    srcRef.current = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}#toolbar=1&view=FitH`;
    prevUrlRef.current = url;
  }
  if (!open) {
    srcRef.current = "about:blank";
  }
  prevOpenRef.current = open;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <div
      className={cn("fixed inset-0 z-50 flex flex-col bg-background", !open && "hidden")}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5 bg-muted/30 shrink-0">
        <span className="text-sm font-semibold truncate">{title}</span>
        <div className="flex items-center gap-1.5">
          {url && (
            <>
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
            </>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <div className="flex-1 bg-muted/20 min-h-0">
        <iframe
          src={srcRef.current}
          title={title}
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
