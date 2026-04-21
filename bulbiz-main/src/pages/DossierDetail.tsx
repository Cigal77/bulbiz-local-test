import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { FloatingVoiceButton } from "@/components/dossier/FloatingVoiceButton";
import { useDossier, useDossierHistorique, useDossierMedias } from "@/hooks/useDossier";
import { useDossierActions } from "@/hooks/useDossierActions";
import { useQuotes } from "@/hooks/useQuotes";
import { ClientBlock } from "@/components/dossier/ClientBlock";
import { DossierProgressBanner } from "@/components/dossier/DossierProgressBanner";
import { NextStepBanner } from "@/components/dossier/NextStepBanner";
import { InterventionBlock } from "@/components/dossier/InterventionBlock";
import { AccessBlock } from "@/components/dossier/AccessBlock";
import { MediaGallery } from "@/components/dossier/MediaGallery";
import { SummaryBlock } from "@/components/dossier/SummaryBlock";
import { HistoriqueTimeline } from "@/components/dossier/HistoriqueTimeline";
import { DossierActions } from "@/components/dossier/DossierActions";
import { ClientLinkBlock } from "@/components/dossier/ClientLinkBlock";
import { QuoteBlock } from "@/components/dossier/QuoteBlock";
import { AppointmentBlock } from "@/components/dossier/AppointmentBlock";
import { AppointmentBanner } from "@/components/dossier/AppointmentBanner";
import { InvoiceBlock } from "@/components/dossier/InvoiceBlock";
import { ImportDevisDialog } from "@/components/dossier/ImportDevisDialog";
import { ImportFactureDialog } from "@/components/dossier/ImportFactureDialog";
import { DeleteDossierDialog } from "@/components/dashboard/DeleteDossierDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Trash2, Phone, MapPin, ChevronDown, Navigation, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BulbizLogo } from "@/components/BulbizLogo";
import { SmartSlotSheet } from "@/components/dossier/SmartSlotSheet";
import { useRef, useState, useEffect } from "react";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

function CollapsibleSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors min-h-[48px]">
        {title}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function DossierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { data: dossier, isLoading } = useDossier(id!);
  const { data: historique = [], isLoading: histLoading } = useDossierHistorique(id!);
  const { data: medias = [], isLoading: mediasLoading } = useDossierMedias(id!);
  const { data: quotes = [] } = useQuotes(id!);
  const { softDelete } = useDossierActions(id!);
  const { toast } = useToast();
  const appointmentRef = useRef<HTMLDivElement>(null);
  const [importDevisOpen, setImportDevisOpen] = useState(false);
  const [importFactureOpen, setImportFactureOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [smartSlotOpen, setSmartSlotOpen] = useState(false);

  useEffect(() => {
    const openDevis = () => setImportDevisOpen(true);
    const openFacture = () => setImportFactureOpen(true);
    window.addEventListener("open-import-devis", openDevis);
    window.addEventListener("open-import-facture", openFacture);
    return () => {
      window.removeEventListener("open-import-devis", openDevis);
      window.removeEventListener("open-import-facture", openFacture);
    };
  }, []);

  // Auto-open import dialog when redirected from CreateDossier with ?import=devis|facture
  useEffect(() => {
    const importParam = searchParams.get("import");
    if (importParam === "devis") {
      setImportDevisOpen(true);
      setSearchParams({}, { replace: true });
    } else if (importParam === "facture") {
      setImportFactureOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col bg-background min-h-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-5 w-48" />
        </header>
        <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        </main>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-background gap-4">
        <p className="text-lg font-medium text-foreground">Dossier introuvable</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour au dashboard
        </Button>
      </div>
    );
  }

  const clientName = dossier.client_first_name || dossier.client_last_name
    ? `${dossier.client_first_name ?? ""} ${dossier.client_last_name ?? ""}`.trim()
    : "Dossier sans nom";

  const mapsUrl = dossier.google_place_id
    ? `https://www.google.com/maps/search/?api=1&query_place_id=${dossier.google_place_id}`
    : dossier.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dossier.address)}`
    : null;

  const wazeUrl = dossier.lat && dossier.lng
    ? `https://waze.com/ul?ll=${dossier.lat},${dossier.lng}&navigate=yes`
    : dossier.address
    ? `https://waze.com/ul?q=${encodeURIComponent(dossier.address)}&navigate=yes`
    : null;

  return (
    <div className="flex flex-1 flex-col bg-background min-h-0">
      {/* Compact header */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 backdrop-blur px-3 sm:px-6 py-2.5">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0 h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {!isMobile && <BulbizLogo size={20} />}
        <div className="flex-1 min-w-0 ml-1">
          <span className="font-semibold text-foreground text-sm truncate block">{clientName}</span>
        </div>

        {/* Quick actions in header on mobile */}
        {isMobile && (
          <div className="flex items-center gap-1 shrink-0">
            {dossier.client_phone && (
              <Button variant="ghost" size="icon" asChild className="h-9 w-9">
                <a href={`tel:${dossier.client_phone}`}>
                  <Phone className="h-4 w-4 text-primary" />
                </a>
              </Button>
            )}
            {(mapsUrl || wazeUrl) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <MapPin className="h-4 w-4 text-primary" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {mapsUrl && (
                    <DropdownMenuItem asChild>
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Google Maps
                      </a>
                    </DropdownMenuItem>
                  )}
                  {wazeUrl && (
                    <DropdownMenuItem asChild>
                      <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                        <Navigation className="h-4 w-4" />
                        Waze
                      </a>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        <Badge className={cn("text-[10px] shrink-0", STATUS_COLORS[dossier.status])}>
          {STATUS_LABELS[dossier.status]}
        </Badge>
      </header>

      {/* Content */}
      <main className="flex-1 p-3 sm:p-6 max-w-6xl mx-auto w-full">
        {isMobile ? (
          /* ═══ MOBILE LAYOUT ═══ */
          <div className="space-y-3 pb-4">
            {/* Progress + Next step (always visible) */}
            <DossierProgressBanner dossier={dossier} />
            <NextStepBanner
              dossier={dossier}
              onScrollToAppointment={() => appointmentRef.current?.scrollIntoView({ behavior: "smooth" })}
            />

            {/* Résumé de la demande — always visible */}
            <SummaryBlock dossier={dossier} mediaCount={medias?.length ?? 0} historiqueCount={historique?.length ?? 0} quotesCount={quotes?.length ?? 0} />

            {/* Actions rapides — above everything else */}
            <DossierActions dossier={dossier} />

            <AppointmentBanner
              dossier={dossier}
              onNavigateToAppointment={() => appointmentRef.current?.scrollIntoView({ behavior: "smooth" })}
            />

            {/* Client & Intervention */}
            <CollapsibleSection title="📋 Client & Intervention" defaultOpen>
              <div className="space-y-3">
                <ClientBlock dossier={dossier} />
                <InterventionBlock dossier={dossier} />
                <AccessBlock dossier={dossier} />
              </div>
            </CollapsibleSection>

            {/* Devis */}
            <CollapsibleSection title="📝 Devis" defaultOpen={["rdv_termine", "devis_a_faire", "devis_envoye", "devis_signe"].includes(dossier.status)}>
              <QuoteBlock dossier={dossier} />
            </CollapsibleSection>

            <CollapsibleSection title="🧾 Facture" defaultOpen={["devis_signe", "invoice_pending", "invoice_paid"].includes(dossier.status)}>
              <InvoiceBlock dossier={dossier} />
            </CollapsibleSection>

            <CollapsibleSection title="📷 Médias">
              <MediaGallery medias={medias} isLoading={mediasLoading} dossierId={dossier.id} />
            </CollapsibleSection>

            <CollapsibleSection title="📜 Historique">
              <HistoriqueTimeline historique={historique} isLoading={histLoading} />
            </CollapsibleSection>

            {/* Rendez-vous — en bas */}
            <div ref={appointmentRef}>
              <AppointmentBlock dossier={dossier} onOpenSmartSheet={() => setSmartSlotOpen(true)} />
            </div>

            {/* Lien client — au dessus de supprimer */}
            <ClientLinkBlock dossier={dossier} />

            {/* Delete */}
            <div className="rounded-xl border border-destructive/20 bg-card p-4">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Supprimer le dossier
              </Button>
            </div>
          </div>
        ) : (
          /* ═══ DESKTOP LAYOUT — same order as mobile ═══ */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <DossierProgressBanner dossier={dossier} />
              <NextStepBanner
                dossier={dossier}
                onScrollToAppointment={() => appointmentRef.current?.scrollIntoView({ behavior: "smooth" })}
              />
              <SummaryBlock dossier={dossier} mediaCount={medias?.length ?? 0} historiqueCount={historique?.length ?? 0} quotesCount={quotes?.length ?? 0} />
              <AppointmentBanner
                dossier={dossier}
                onNavigateToAppointment={() => appointmentRef.current?.scrollIntoView({ behavior: "smooth" })}
              />
              <ClientBlock dossier={dossier} />
              <InterventionBlock dossier={dossier} />
              <AccessBlock dossier={dossier} />
              <QuoteBlock dossier={dossier} />
              <InvoiceBlock dossier={dossier} />
              <MediaGallery medias={medias} isLoading={mediasLoading} dossierId={dossier.id} />
              <HistoriqueTimeline historique={historique} isLoading={histLoading} />
              <div ref={appointmentRef}>
                <AppointmentBlock dossier={dossier} onOpenSmartSheet={() => setSmartSlotOpen(true)} />
              </div>
            </div>
            <div className="space-y-4">
              <DossierActions dossier={dossier} />
              <ClientLinkBlock dossier={dossier} />
              <div className="rounded-xl border border-destructive/20 bg-card p-5">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer le dossier
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Import dialogs */}
      <ImportDevisDialog open={importDevisOpen} onClose={() => setImportDevisOpen(false)} dossierId={dossier.id} clientEmail={dossier.client_email} />
      <ImportFactureDialog open={importFactureOpen} onClose={() => setImportFactureOpen(false)} dossierId={dossier.id} clientEmail={dossier.client_email} />

      {/* Delete dialog */}
      <DeleteDossierDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={(reason) => {
          softDelete.mutate(reason, {
            onSuccess: () => {
              toast({ title: "Dossier déplacé dans la corbeille" });
              navigate("/");
            },
            onError: (e) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
          });
          setDeleteOpen(false);
        }}
        clientName={clientName}
      />

      {/* Smart slot sheet */}
      <SmartSlotSheet open={smartSlotOpen} onOpenChange={setSmartSlotOpen} dossier={dossier} />

      {/* FAB – mobile only, visible when RDV not confirmed/done */}
      {isMobile && ["none", "cancelled", "rdv_pending", "slots_proposed"].includes((dossier as any).appointment_status || "none") && (
        <button
          onClick={() => setSmartSlotOpen(true)}
          className={cn(
            "fixed bottom-24 right-4 z-20 flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-3 shadow-lg hover:bg-primary/90 transition-all",
            (dossier as any).appointment_status === "rdv_pending" && "animate-pulse"
          )}
        >
          <Calendar className="h-5 w-5" />
          <span className="text-sm font-semibold">RDV</span>
        </button>
      )}

      {/* Floating voice note button – always visible */}
      <FloatingVoiceButton dossierId={id!} />
    </div>
  );
}
