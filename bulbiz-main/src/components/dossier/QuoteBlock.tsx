import { useState, useRef } from "react";
import { XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuotes, useQuoteActions, QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from "@/hooks/useQuotes";
import type { Quote, QuoteStatus } from "@/hooks/useQuotes";
import type { Dossier } from "@/hooks/useDossier";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Upload, Loader2, ExternalLink, Send, Trash2, FilePlus, Copy, CheckCircle2, ShieldCheck, Plus, FileCheck2, Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AiPreQuoteDialog } from "@/components/dossier/AiPreQuoteDialog";

interface QuoteBlockProps {
  dossier: Dossier;
}

export function QuoteBlock({ dossier }: QuoteBlockProps) {
  const { data: quotes = [], isLoading } = useQuotes(dossier.id);
  const { importPdf, updateStatus, deleteQuote, transformToInvoice } = useQuoteActions(dossier.id);
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [transformingId, setTransformingId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const handleTransform = async (quote: Quote) => {
    setTransformingId(quote.id);
    try {
      const { invoiceId, invoiceNumber } = await transformToInvoice.mutateAsync(quote.id);
      toast({
        title: "Facture créée à partir du devis",
        description: `${invoiceNumber} — vérifie et ajuste avant envoi`,
      });
      navigate(`/dossier/${dossier.id}/facture/${invoiceId}`);
    } catch (err: any) {
      toast({ title: "Erreur transformation", description: err.message, variant: "destructive" });
    } finally {
      setTransformingId(null);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "Format invalide", description: "Seuls les fichiers PDF sont acceptés.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      await importPdf.mutateAsync(file);
      toast({ title: "Devis importé !" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleStatusChange = async (quoteId: string, status: QuoteStatus) => {
    try {
      await updateStatus.mutateAsync({ quoteId, status });
      toast({ title: `Devis ${QUOTE_STATUS_LABELS[status].toLowerCase()}` });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const handleSendQuote = async (quote: Quote) => {
    if (!dossier.client_email) {
      toast({ title: "Pas d'email client", description: "Ajoutez un email au dossier pour envoyer le devis.", variant: "destructive" });
      return;
    }
    setSendingId(quote.id);
    try {
      const { error } = await supabase.functions.invoke("send-quote", {
        body: { quote_id: quote.id },
      });
      if (error) throw error;
      toast({ title: "Devis envoyé au client !" });
    } catch (err: any) {
      toast({ title: "Erreur d'envoi", description: err.message, variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const handleDelete = async (quoteId: string) => {
    try {
      await deleteQuote.mutateAsync(quoteId);
      toast({ title: "Devis supprimé" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  // Always show quote block - import PDF is always available

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Devis
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
            variant="secondary"
            size="sm"
            className="gap-1.5 bg-primary/10 text-primary hover:bg-primary/15"
            onClick={() => setAiOpen(true)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Pré-devis IA
          </Button>
          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate(`/devis/new?dossier=${dossier.id}`)}
          >
            <Plus className="h-3.5 w-3.5" />
            {quotes.length === 0 ? "Créer" : "Nouveau"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Importer
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : quotes.length === 0 ? (
          <div className="text-center py-6 space-y-4">
            <FilePlus className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Aucun devis</p>
              <p className="text-xs text-muted-foreground">
                Créez un nouveau devis ou importez un PDF existant.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5 bg-primary/10 text-primary hover:bg-primary/15"
                onClick={() => setAiOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Générer avec l'IA
              </Button>
              <Button
                variant="default"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate(`/devis/new?dossier=${dossier.id}`)}
              >
                <Plus className="h-3.5 w-3.5" />
                Créer un devis
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
          quotes.map((quote) => (
            <QuoteRow
              key={quote.id}
              quote={quote}
              dossier={dossier}
              onStatusChange={handleStatusChange}
              onSend={handleSendQuote}
              onDelete={handleDelete}
              isSending={sendingId === quote.id}
              onTransform={handleTransform}
              isTransforming={transformingId === quote.id}
            />
          ))
        )}
      </CardContent>
      <AiPreQuoteDialog open={aiOpen} onClose={() => setAiOpen(false)} dossier={dossier} />
    </Card>
  );
}

function QuoteRow({
  quote,
  dossier,
  onStatusChange,
  onSend,
  onDelete,
  isSending,
  onTransform,
  isTransforming,
}: {
  quote: Quote;
  dossier: Dossier;
  onStatusChange: (id: string, status: QuoteStatus) => void;
  onSend: (q: Quote) => void;
  onDelete: (id: string) => void;
  isSending: boolean;
  onTransform: (q: Quote) => void;
  isTransforming: boolean;
}) {
  const { toast } = useToast();

  const copySignatureLink = () => {
    const url = `${window.location.origin}/devis/validation?token=${(quote as any).signature_token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Lien copié !" });
  };

  const hasSignatureToken = !!(quote as any).signature_token;
  const isValidated = quote.status === "signe" && !!(quote as any).accepted_at;
  const isRefused = quote.status === "refuse" && !!(quote as any).refused_at;

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{quote.quote_number}</span>
          <Badge variant="secondary" className={cn("text-[10px] shrink-0", QUOTE_STATUS_COLORS[quote.status])}>
            {QUOTE_STATUS_LABELS[quote.status]}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {format(new Date(quote.created_at), "d MMM yyyy", { locale: fr })}
        </span>
      </div>

      {/* Validation proof */}
      {isValidated && (
        <div className="flex items-start gap-2 rounded-md bg-success/10 border border-success/20 p-2.5">
          <ShieldCheck className="h-4 w-4 text-success shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <p className="font-medium text-success">Validé par le client</p>
            <p className="text-muted-foreground">
              {format(new Date((quote as any).accepted_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
              {(quote as any).accepted_ip && ` (IP: ${(quote as any).accepted_ip})`}
            </p>
          </div>
        </div>
      )}

      {isRefused && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-2.5">
          <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <p className="font-medium text-destructive">Refusé par le client</p>
            <p className="text-muted-foreground">
              {format(new Date((quote as any).refused_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
            </p>
            {(quote as any).refused_reason && (
              <p className="text-muted-foreground">Motif : {(quote as any).refused_reason}</p>
            )}
          </div>
        </div>
      )}

      {/* Signature link */}
      {hasSignatureToken && quote.status === "envoye" && (
        <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full" onClick={copySignatureLink}>
          <Copy className="h-3 w-3" />
          Copier le lien de validation client
        </Button>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {quote.pdf_url && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
            <a href={quote.pdf_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
              Voir PDF
            </a>
          </Button>
        )}

        {quote.status === "brouillon" && (
          <Button
            variant="default"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => onSend(quote)}
            disabled={isSending || !dossier.client_email}
          >
            {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Envoyer au client
          </Button>
        )}

        {quote.status === "envoye" && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => onSend(quote)}
            disabled={isSending}
          >
            {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Renvoyer
          </Button>
        )}

        {/* Transformer en facture — visible si devis envoyé/signé avec lignes */}
        {(quote.status === "signe" || quote.status === "envoye") && (quote.total_ttc ?? 0) > 0 && (
          <Button
            variant={quote.status === "signe" ? "default" : "outline"}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => onTransform(quote)}
            disabled={isTransforming}
          >
            {isTransforming ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileCheck2 className="h-3 w-3" />}
            Transformer en facture
          </Button>
        )}

        <Select
          value={quote.status}
          onValueChange={(v) => onStatusChange(quote.id, v as QuoteStatus)}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["brouillon", "envoye", "signe", "refuse"] as QuoteStatus[]).map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {QUOTE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce devis ?</AlertDialogTitle>
              <AlertDialogDescription>
                Le devis {quote.quote_number} sera définitivement supprimé.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(quote.id)}>Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}