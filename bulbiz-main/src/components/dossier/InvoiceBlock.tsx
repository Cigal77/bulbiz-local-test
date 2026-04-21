import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useInvoices, useInvoiceActions, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@/hooks/useInvoices";
import type { Dossier } from "@/hooks/useDossier";
import type { Invoice, InvoiceStatus } from "@/hooks/useInvoices"; // <- adapte si besoin
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import {
  FileText,
  Upload,
  Loader2,
  ExternalLink,
  Send,
  Trash2,
  FilePlus,
  Eye,
  Plus,
} from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface InvoiceBlockProps {
  dossier: Dossier;
}

/**
 * Objectif:
 * - même UX que QuoteBlock
 * - jamais "vide" (pas de return null qui re-clignote)
 * - bouton importer en haut + empty state cliquable
 */
export function InvoiceBlock({ dossier }: InvoiceBlockProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: invoices = [], isLoading, isFetching } = useInvoices(dossier.id);
  const { importPdf, updateStatus, deleteInvoice, sendInvoice } = useInvoiceActions(dossier.id); 
  // ↑ adapte: si tu n'as pas sendInvoice/importPdf dans ton hook, remplace par ton flow (event open-import-facture)

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  // ✅ Empêche le "je vois puis ça disparaît" : une fois rendu, on garde visible
  const [stickyVisible, setStickyVisible] = useState(false);
  useEffect(() => {
    if (isLoading || isFetching || invoices.length > 0) setStickyVisible(true);
  }, [isLoading, isFetching, invoices.length]);

  // Si tu veux le rendre toujours visible comme Devis : remplace par `const shouldShow = true;`
  const shouldShow = true; 
  if (!shouldShow) return null;

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({
        title: "Format invalide",
        description: "Seuls les fichiers PDF sont acceptés.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Option 1: tu as un vrai importPdf (comme devis)
      await importPdf.mutateAsync(file);

      // Option 2 (si tu préfères ton dialog): commente la ligne au-dessus et décommente ça
      // window.dispatchEvent(new CustomEvent("open-import-facture"));

      toast({ title: "Facture importée !" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleStatusChange = async (invoiceId: string, status: InvoiceStatus) => {
    try {
      await updateStatus.mutateAsync({ invoiceId, status });
      toast({ title: `Facture ${INVOICE_STATUS_LABELS[status].toLowerCase()}` });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const handleSendInvoice = async (inv: Invoice) => {
    if (!dossier.client_email) {
      toast({
        title: "Pas d'email client",
        description: "Ajoutez un email au dossier pour envoyer la facture.",
        variant: "destructive",
      });
      return;
    }

    setSendingId(inv.id);
    try {
      await sendInvoice.mutateAsync({ invoiceId: inv.id }); // adapte si besoin
      toast({ title: "Facture envoyée au client !" });
    } catch (err: any) {
      toast({ title: "Erreur d'envoi", description: err.message, variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const handleDelete = async (invoiceId: string) => {
    try {
      await deleteInvoice.mutateAsync(invoiceId);
      toast({ title: "Facture supprimée" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Facture
        </CardTitle>

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleImport}
          />
          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate(`/facture/new?dossier=${dossier.id}`)}
          >
            <Plus className="h-3.5 w-3.5" />
            {invoices.length === 0 ? "Créer" : "Nouvelle"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Importer
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {(isLoading || isFetching) ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-6 space-y-4">
            <FilePlus className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Aucune facture</p>
              <p className="text-xs text-muted-foreground">
                Créez une nouvelle facture ou importez un PDF existant.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
              <Button
                variant="default"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate(`/facture/new?dossier=${dossier.id}`)}
              >
                <Plus className="h-3.5 w-3.5" />
                Créer une facture
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Importer un PDF
              </Button>
            </div>
          </div>
        ) : (
          invoices.map((inv) => (
            <InvoiceRow
              key={inv.id}
              invoice={inv}
              dossier={dossier}
              onStatusChange={handleStatusChange}
              onSend={handleSendInvoice}
              onDelete={handleDelete}
              isSending={sendingId === inv.id}
              onEdit={() => navigate(`/dossier/${dossier.id}/facture/${inv.id}`)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function InvoiceRow({
  invoice,
  dossier,
  onStatusChange,
  onSend,
  onDelete,
  isSending,
  onEdit,
}: {
  invoice: Invoice;
  dossier: Dossier;
  onStatusChange: (id: string, status: InvoiceStatus) => void;
  onSend: (inv: Invoice) => void;
  onDelete: (id: string) => void;
  isSending: boolean;
  onEdit: () => void;
}) {
  // Adapte les champs si besoin
  const issuedAt = (invoice as any).issue_date || (invoice as any).created_at;
  const pdfUrl = (invoice as any).pdf_url;

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">
            {(invoice as any).invoice_number ?? "FACTURE"}
          </span>
          <Badge
            variant="secondary"
            className={cn("text-[10px] shrink-0", INVOICE_STATUS_COLORS[invoice.status])}
          >
            {INVOICE_STATUS_LABELS[invoice.status]}
          </Badge>
        </div>

        {issuedAt && (
          <span className="text-xs text-muted-foreground shrink-0">
            {format(new Date(issuedAt), "d MMM yyyy", { locale: fr })}
          </span>
        )}
      </div>

      {/* Only show total if it's > 0 */}
      {(invoice as any).total_ttc > 0 && (
        <p className="text-xs text-muted-foreground">
          Total : {Number((invoice as any).total_ttc).toFixed(2)} € TTC
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {pdfUrl && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
              Voir PDF
            </a>
          </Button>
        )}

        {/* Envoi email */}
        <Button
          variant={invoice.status === "draft" ? "default" : "outline"}
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => onSend(invoice)}
          disabled={isSending || !dossier.client_email}
        >
          {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          {invoice.status === "draft" ? "Envoyer au client" : "Renvoyer"}
        </Button>

        {/* Select statut */}
        <Select
          value={invoice.status}
          onValueChange={(v) => onStatusChange(invoice.id, v as InvoiceStatus)}
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {INVOICE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Delete */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
              <AlertDialogDescription>
                La facture {(invoice as any).invoice_number ?? ""} sera définitivement supprimée.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(invoice.id)}>Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}