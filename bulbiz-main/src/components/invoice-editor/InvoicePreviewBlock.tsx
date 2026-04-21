import { Eye, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InvoicePreviewBlockProps {
  totalHT: number;
  totalTTC: number;
  lineCount: number;
  onPreview: () => void;
  isGenerating?: boolean;
}

export function InvoicePreviewBlock({
  totalHT,
  totalTTC,
  lineCount,
  onPreview,
  isGenerating,
}: InvoicePreviewBlockProps) {
  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <Eye className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground flex-1">Aperçu</h2>
      </header>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/40 p-2">
            <p className="text-[10px] text-muted-foreground">Lignes</p>
            <p className="text-base font-semibold">{lineCount}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <p className="text-[10px] text-muted-foreground">HT</p>
            <p className="text-base font-semibold">{totalHT.toFixed(2)} €</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-2">
            <p className="text-[10px] text-primary">TTC</p>
            <p className="text-base font-bold text-primary">{totalTTC.toFixed(2)} €</p>
          </div>
        </div>
        <Button
          onClick={onPreview}
          disabled={isGenerating || lineCount === 0}
          variant="outline"
          className="w-full gap-1.5"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Aperçu PDF
        </Button>
      </div>
    </section>
  );
}
