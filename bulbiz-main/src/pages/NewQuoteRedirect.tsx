import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * Crée un nouveau devis pour un dossier puis redirige vers l'éditeur.
 * Utilise la route /dossier/:dossierId/devis qui gère la création (pas besoin
 * de pré-créer en DB — l'éditeur sauvegarde au premier enregistrement).
 */
export default function NewQuoteRedirect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const dossierId = searchParams.get("dossier");
    if (!dossierId) {
      toast({
        title: "Dossier manquant",
        description: "Impossible de créer un devis sans dossier client.",
        variant: "destructive",
      });
      navigate("/", { replace: true });
      return;
    }
    navigate(`/dossier/${dossierId}/devis`, { replace: true });
  }, [navigate, searchParams, toast]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
