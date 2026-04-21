import { useState } from "react";
import { Mic } from "lucide-react";
import { VoiceRecorderDialog } from "@/components/dossier/VoiceRecorderDialog";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FloatingVoiceButtonProps {
  dossierId: string;
}

export function FloatingVoiceButton({ dossierId }: FloatingVoiceButtonProps) {
  const [open, setOpen] = useState(false);
  const { uploadFiles } = useMediaUpload(dossierId);
  const { toast } = useToast();

  const handleSave = async (blob: Blob, duration: number) => {
    await uploadFiles.mutateAsync({
      files: [blob],
      category: "audio",
      duration,
    });
    toast({ title: "🎙️ Note vocale enregistrée" });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed z-50 flex items-center justify-center",
          "h-12 w-12 rounded-full",
          "bg-primary text-primary-foreground shadow-lg",
          "hover:bg-primary/90 active:scale-95 transition-all",
          "bottom-20 left-4 md:bottom-6 md:right-6 md:left-auto"
        )}
        aria-label="Note vocale"
      >
        <Mic className="h-5 w-5" />
      </button>

      <VoiceRecorderDialog
        open={open}
        onClose={() => setOpen(false)}
        onSave={handleSave}
      />
    </>
  );
}
