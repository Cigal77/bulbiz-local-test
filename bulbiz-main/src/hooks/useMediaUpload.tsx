import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type MediaCategory = "image" | "video" | "audio" | "plan" | "note";

export function useMediaUpload(dossierId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["medias", dossierId] });
    queryClient.invalidateQueries({ queryKey: ["historique", dossierId] });
  };

  const addHistorique = async (action: string, details?: string) => {
    await supabase.from("historique").insert({
      dossier_id: dossierId,
      user_id: user?.id ?? null,
      action,
      details,
    });
  };

  const uploadFiles = useMutation({
    mutationFn: async ({
      files,
      category,
      duration,
    }: {
      files: File[] | Blob[];
      category: Exclude<MediaCategory, "note">;
      duration?: number;
    }) => {
      if (!user) throw new Error("Non authentifié");

      for (const file of files) {
        const fileName = file instanceof File ? file.name : `note-vocale-${Date.now()}.webm`;
        const fileType = file instanceof File ? file.type : "audio/webm";
        const fileSize = file.size;
        const storagePath = `${user.id}/${dossierId}/${Date.now()}-${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("dossier-medias")
          .upload(storagePath, file, { contentType: fileType });
        if (uploadError) throw uploadError;

        // Insert media record with storage path (bucket is private, signed URLs generated on read)
        const { error: insertError } = await supabase.from("medias").insert({
          dossier_id: dossierId,
          user_id: user.id,
          file_name: fileName,
          file_type: fileType,
          file_url: storagePath,
          file_size: fileSize,
          media_category: category,
          duration: duration ?? null,
        });
        if (insertError) throw insertError;

        // Add historique
        const labels: Record<Exclude<MediaCategory, "note">, string> = {
          image: "Photo ajoutée",
          video: "Vidéo ajoutée",
          audio: "Note vocale ajoutée",
          plan: "Plan ajouté",
        };
        const durationStr = duration ? ` (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")})` : "";
        await addHistorique("media_added", `${labels[category]}${durationStr} — ${fileName}`);
      }
    },
    onSuccess: invalidate,
  });

  // Stores a text note directly in the medias table so it appears
  // alongside photos, videos and voice notes in the media feed.
  const addNote = useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("Non authentifié");

      const { error } = await supabase.from("medias").insert({
        dossier_id: dossierId,
        user_id: user.id,
        file_name: text,
        file_type: "text/plain",
        file_url: "note://local",
        file_size: null,
        media_category: "note",
        duration: null,
      });
      if (error) throw error;

      await addHistorique("note", text);
    },
    onSuccess: invalidate,
  });

  const deleteMedia = useMutation({
    mutationFn: async (mediaId: string) => {
      const { error } = await supabase.from("medias").delete().eq("id", mediaId);
      if (error) throw error;
      await addHistorique("media_deleted", "Média supprimé");
    },
    onSuccess: invalidate,
  });

  return { uploadFiles, addNote, deleteMedia };
}