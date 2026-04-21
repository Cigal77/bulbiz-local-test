import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyDocumentStateProps {
  type: "quote" | "invoice";
  onCreate?: () => void;
}

export function EmptyDocumentState({ type, onCreate }: EmptyDocumentStateProps) {
  const isQuote = type === "quote";
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center rounded-xl border border-dashed border-border bg-card/40">
      <div className="rounded-full bg-primary/10 p-4 mb-4">
        <FileText className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">
        {isQuote ? "Aucun devis pour le moment" : "Aucune facture pour le moment"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-5">
        {isQuote
          ? "Vos devis apparaîtront ici. Bulbiz les rend conformes automatiquement."
          : "Vos factures apparaîtront ici. Bulbiz les rend conformes automatiquement."}
      </p>
      {onCreate && (
        <Button onClick={onCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          {isQuote ? "Créer mon premier devis" : "Créer ma première facture"}
        </Button>
      )}
    </div>
  );
}
