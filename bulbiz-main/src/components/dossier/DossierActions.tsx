import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import type { Dossier } from "@/hooks/useDossier";
import { useDossierActions } from "@/hooks/useDossierActions";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Phone, MessageSquarePlus, FileText, Bell, BellOff, Calendar, RefreshCw, Loader2,
  Mic, Camera, Map, Receipt, CheckCircle2, Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { VoiceRecorderDialog } from "./VoiceRecorderDialog";
import { MediaUploadDialog } from "./MediaUploadDialog";
import { ImportDevisDialog } from "./ImportDevisDialog";
import { ImportFactureDialog } from "./ImportFactureDialog";

interface DossierActionsProps {
  dossier: Dossier;
}

export function DossierActions({ dossier }: DossierActionsProps) {
  const navigate = useNavigate();
  const { toggleRelance, sendRelance, addNote } = useDossierActions(dossier.id);
  const { uploadFiles } = useMediaUpload(dossier.id);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [importDevisOpen, setImportDevisOpen] = useState(false);
  const [importFactureOpen, setImportFactureOpen] = useState(false);

  // Listen for custom events from NextStepBanner
  useEffect(() => {
    const openVoice = () => setVoiceOpen(true);
    const openPhoto = () => setPhotoOpen(true);
    window.addEventListener("open-voice-recorder", openVoice);
    window.addEventListener("open-photo-upload", openPhoto);
    return () => {
      window.removeEventListener("open-voice-recorder", openVoice);
      window.removeEventListener("open-photo-upload", openPhoto);
    };
  }, []);

  const status = dossier.status;

  // Allow marking intervention as done from any pre-completion status
  const canMarkDone = !["rdv_termine", "invoice_pending", "invoice_paid", "clos_signe", "clos_perdu"].includes(status);

  const markDone = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("dossiers")
        .update({
          status: "rdv_termine",
          status_changed_at: new Date().toISOString(),
          appointment_status: "done",
        } as any)
        .eq("id", dossier.id);
      if (error) throw error;
      await supabase.from("historique").insert({
        dossier_id: dossier.id,
        user_id: user?.id ?? null,
        action: "intervention_done",
        details: "Intervention marquée comme réalisée",
      });
    },
    onSuccess: () => {
      toast({ title: "Intervention réalisée ✅" });
      queryClient.invalidateQueries({ queryKey: ["dossier", dossier.id] });
      queryClient.invalidateQueries({ queryKey: ["historique", dossier.id] });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote.mutate(noteText.trim(), {
      onSuccess: () => {
        toast({ title: "Note ajoutée" });
        setNoteText("");
        setNoteOpen(false);
      },
    });
  };

  const handleToggleRelance = () => {
    toggleRelance.mutate(!dossier.relance_active, {
      onSuccess: () =>
        toast({ title: dossier.relance_active ? "Relances désactivées" : "Relances activées" }),
    });
  };

  const handleSendRelance = () => {
    const type = status === "devis_envoye" ? "devis_non_signe" as const : "info_manquante" as const;
    sendRelance.mutate(type, {
      onSuccess: () => toast({ title: "Relance envoyée !" }),
      onError: (e) => toast({ title: "Erreur d'envoi", description: e.message, variant: "destructive" }),
    });
  };

  const handleVoiceSave = async (blob: Blob, duration: number) => {
    await uploadFiles.mutateAsync({ files: [blob], category: "audio", duration });
    toast({ title: "Note vocale enregistrée" });
  };

  const handlePhotoUpload = async (files: File[]) => {
    for (const f of files) {
      const cat = f.type.startsWith("video/") ? "video" as const : "image" as const;
      await uploadFiles.mutateAsync({ files: [f], category: cat });
    }
    toast({ title: `${files.length} fichier(s) ajouté(s)` });
  };

  const handlePlanUpload = async (files: File[]) => {
    await uploadFiles.mutateAsync({ files, category: "plan" });
    toast({ title: "Plan ajouté" });
  };

  // Status-aware visibility for contextual actions
  const showRelancerNow = ["devis_envoye", "invoice_pending"].includes(status);
  const showToggleRelance = ["devis_envoye", "invoice_pending"].includes(status);

  return (
    <div className="space-y-4">
      {/* Quick actions */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Actions rapides</h3>

        {/* Primary: Pré-devis IA — desktop only (sur mobile le bouton vit dans l'éditeur de devis) */}
        <Button
          variant="default"
          className="hidden md:flex w-full justify-start gap-2 h-11 bg-gradient-to-r from-primary to-primary/80"
          onClick={() => navigate(`/dossier/${dossier.id}/devis?ai=auto`)}
        >
          <Sparkles className="h-4 w-4" />
          Générer un pré-devis avec l'IA
        </Button>
        <Button
          variant="default"
          className="w-full justify-start gap-2 h-11"
          onClick={() => navigate(`/devis/new?dossier=${dossier.id}`)}
        >
          <FileText className="h-4 w-4" />
          Créer un devis
        </Button>
        <Button
          variant="default"
          className="w-full justify-start gap-2 h-11"
          onClick={() => navigate(`/facture/new?dossier=${dossier.id}`)}
        >
          <Receipt className="h-4 w-4" />
          Créer une facture
        </Button>

        <div className="h-px bg-border my-2" />

        {/* 1. Phone */}
        <Button variant="outline" className="w-full justify-start gap-2" disabled={!dossier.client_phone} asChild={!!dossier.client_phone}>
          {dossier.client_phone ? (
            <a href={`tel:${dossier.client_phone}`}>
              <Phone className="h-4 w-4 text-primary" />
              Appeler le client
            </a>
          ) : (
            <span>
              <Phone className="h-4 w-4 text-muted-foreground" />
              Téléphone non renseigné
            </span>
          )}
        </Button>

        {/* 2. Note text */}
        <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setNoteOpen(!noteOpen)}>
          <MessageSquarePlus className="h-4 w-4 text-primary" />
          Ajouter une note
        </Button>

        {noteOpen && (
          <div className="space-y-2 pt-1">
            <Textarea
              placeholder="Écrire une note…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddNote} disabled={addNote.isPending || !noteText.trim()}>
                Enregistrer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setNoteOpen(false); setNoteText(""); }}>
                Annuler
              </Button>
            </div>
          </div>
        )}

        {/* 3. Voice note */}
        <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setVoiceOpen(true)}>
          <Mic className="h-4 w-4 text-primary" />
          Ajouter note vocale
        </Button>

        {/* 4. Photo / Video */}
        <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setPhotoOpen(true)}>
          <Camera className="h-4 w-4 text-primary" />
          Ajouter photo / vidéo
        </Button>

        {/* 5. Relancer maintenant (contextual) */}
        {showRelancerNow && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handleSendRelance}
            disabled={sendRelance.isPending || !dossier.client_email}
          >
            {sendRelance.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 text-primary" />
            )}
            Relancer maintenant
          </Button>
        )}

        {/* 6. Importer devis (always available) */}
        <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setImportDevisOpen(true)}>
          <FileText className="h-4 w-4 text-primary" />
          Importer devis (PDF)
        </Button>

        {/* 7. Importer facture (always available) */}
        <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setImportFactureOpen(true)}>
          <Receipt className="h-4 w-4 text-primary" />
          Importer facture (PDF)
        </Button>

        {/* 8. Toggle relances (contextual) */}
        {showToggleRelance && (
          <Button
            variant="outline"
            className={cn("w-full justify-start gap-2", !dossier.relance_active && "text-muted-foreground")}
            onClick={handleToggleRelance}
          >
            {dossier.relance_active ? (
              <BellOff className="h-4 w-4 text-destructive" />
            ) : (
              <Bell className="h-4 w-4 text-primary" />
            )}
            {dossier.relance_active ? "Stop relances" : "Activer relances"}
          </Button>
        )}

        {/* Intervention terminée */}
        {canMarkDone && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => markDone.mutate()}
            disabled={markDone.isPending}
          >
            {markDone.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-primary" />}
            Intervention terminée
          </Button>
        )}
      </div>

      {/* Dialogs */}
      <VoiceRecorderDialog open={voiceOpen} onClose={() => setVoiceOpen(false)} onSave={handleVoiceSave} />
      <MediaUploadDialog open={photoOpen} onClose={() => setPhotoOpen(false)} onUpload={handlePhotoUpload} mode="photo_video" />
      <MediaUploadDialog open={planOpen} onClose={() => setPlanOpen(false)} onUpload={handlePlanUpload} mode="plan" />
      <ImportDevisDialog open={importDevisOpen} onClose={() => setImportDevisOpen(false)} dossierId={dossier.id} clientEmail={dossier.client_email} />
      <ImportFactureDialog open={importFactureOpen} onClose={() => setImportFactureOpen(false)} dossierId={dossier.id} clientEmail={dossier.client_email} />
    </div>
  );
}