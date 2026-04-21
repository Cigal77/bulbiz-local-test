import { useState } from "react";
import type { Media } from "@/hooks/useDossier";
import { Image, Film, FileText, Mic, Trash2, Download, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MediaGalleryProps {
  medias: Media[];
  isLoading: boolean;
  dossierId?: string;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function NoteCard({ item, onDelete }: { item: Media; onDelete?: (id: string) => void }) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <>
      <div className="flex gap-3 rounded-xl border border-border bg-muted/40 p-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <MessageSquare className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
            {(item as any).note_text || item.file_name}
          </p>
          {item.created_at && (
            <p className="text-xs text-muted-foreground">
              {format(new Date(item.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
            </p>
          )}
        </div>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteId(item.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette note ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId && onDelete) { onDelete(deleteId); setDeleteId(null); } }}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MediaSection({
  title,
  icon,
  items,
  onDelete,
}: {
  title: string;
  icon: React.ReactNode;
  items: Media[];
  onDelete?: (id: string) => void;
}) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {icon}
        <span>{title} ({items.length})</span>
      </div>

      {title === "Notes vocales" ? (
        <div className="space-y-2">
          {items.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-2">
              <Mic className="h-4 w-4 text-primary shrink-0" />
              <audio controls src={m.file_url} className="flex-1 h-8" preload="metadata" />
              {(m as any).duration && (
                <span className="text-xs text-muted-foreground tabular-nums">{formatDuration((m as any).duration)}</span>
              )}
              {onDelete && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(m.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : title === "Plans" ? (
        <div className="space-y-2">
          {items.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
              {m.file_type === "application/pdf" ? (
                <FileText className="h-5 w-5 text-primary shrink-0" />
              ) : (
                <img src={m.file_url} alt={m.file_name} className="h-12 w-12 rounded object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{m.file_name}</p>
                <p className="text-xs text-muted-foreground">{m.file_size ? `${(m.file_size / 1024).toFixed(0)} KB` : ""}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                  <a href={m.file_url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </Button>
                {onDelete && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(m.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map((m) => {
            const isImage = m.file_type.startsWith("image/");
            const isVideo = m.file_type.startsWith("video/");
            return (
              <div key={m.id} className="group relative aspect-square rounded-lg overflow-hidden bg-muted border border-border">
                {isImage ? (
                  <a href={m.file_url} target="_blank" rel="noopener noreferrer">
                    <img src={m.file_url} alt={m.file_name} className="h-full w-full object-cover" loading="lazy" />
                  </a>
                ) : isVideo ? (
                  <video src={m.file_url} controls className="h-full w-full object-cover" preload="metadata" />
                ) : (
                  <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="flex h-full w-full flex-col items-center justify-center gap-1 p-2">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground text-center truncate w-full">{m.file_name}</span>
                  </a>
                )}
                {onDelete && (
                  <button
                    onClick={() => setDeleteId(m.id)}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce média ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId && onDelete) { onDelete(deleteId); setDeleteId(null); } }}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function MediaGallery({ medias, isLoading, dossierId }: MediaGalleryProps) {
  const mediaUpload = useMediaUpload(dossierId ?? "");
  const { toast } = useToast();

  const handleDelete = dossierId ? (id: string) => {
    mediaUpload.deleteMedia.mutate(id, {
      onSuccess: () => toast({ title: "Média supprimé" }),
      onError: (e) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
    });
  } : undefined;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Médias</h3>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const getCategory = (m: Media): string => {
    const cat = (m as any).media_category;
    if (cat === "note") return "note";
    if (cat && cat !== "image") return cat;
    if (m.file_type?.startsWith("video/")) return "video";
    if (m.file_type?.startsWith("audio/")) return "audio";
    if (m.file_type === "application/pdf") return "plan";
    return "image";
  };

  // Unified feed: all items sorted by date descending, notes mixed in
  const notes  = medias.filter((m) => getCategory(m) === "note");
  const images = medias.filter((m) => getCategory(m) === "image");
  const videos = medias.filter((m) => getCategory(m) === "video");
  const audios = medias.filter((m) => getCategory(m) === "audio");
  const plans  = medias.filter((m) => getCategory(m) === "plan");

  const totalCount = medias.length;
  const hasAny = totalCount > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Médias {hasAny && <span className="text-foreground">({totalCount})</span>}
      </h3>

      {!hasAny ? (
        <p className="text-sm text-muted-foreground">Aucun média attaché.</p>
      ) : (
        <div className="space-y-5">
          {/* Notes texte — carte dans le flux */}
          {notes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Notes ({notes.length})</span>
              </div>
              <div className="space-y-2">
                {notes.map((m) => (
                  <NoteCard key={m.id} item={m} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}

          <MediaSection title="Photos"        icon={<Image   className="h-3.5 w-3.5" />} items={images} onDelete={handleDelete} />
          <MediaSection title="Vidéos"        icon={<Film    className="h-3.5 w-3.5" />} items={videos} onDelete={handleDelete} />
          <MediaSection title="Notes vocales" icon={<Mic     className="h-3.5 w-3.5" />} items={audios} onDelete={handleDelete} />
          <MediaSection title="Plans"         icon={<FileText className="h-3.5 w-3.5" />} items={plans}  onDelete={handleDelete} />
        </div>
      )}
    </div>
  );
}