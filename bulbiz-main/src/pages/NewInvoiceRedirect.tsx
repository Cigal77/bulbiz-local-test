import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

/**
 * Crée une facture brouillon minimale pour un dossier puis redirige
 * vers l'éditeur de facture qui requiert un :invoiceId.
 */
export default function NewInvoiceRedirect() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const dossierId = searchParams.get("dossier");
    if (!dossierId || !user) {
      if (!dossierId) {
        toast({
          title: "Dossier manquant",
          description: "Impossible de créer une facture sans dossier client.",
          variant: "destructive",
        });
        navigate("/", { replace: true });
      }
      return;
    }

    (async () => {
      try {
        // Récupère les infos du dossier pour préremplir
        const { data: dossier } = await supabase
          .from("dossiers")
          .select("client_first_name, client_last_name, client_email, client_phone, address")
          .eq("id", dossierId)
          .maybeSingle();

        // Récupère le profil pour hériter du mode TVA
        const { data: profile } = await supabase
          .from("profiles")
          .select("vat_applicable")
          .eq("user_id", user.id)
          .maybeSingle();
        const vatMode = (profile as any)?.vat_applicable === false ? "no_vat_293b" : "normal";

        // Génère le numéro
        const clientName = dossier?.client_last_name || dossier?.client_first_name || null;
        const { data: numData, error: numError } = await supabase.rpc("generate_invoice_number", {
          p_user_id: user.id,
          p_client_name: clientName,
        });
        if (numError) throw numError;

        // Crée la facture brouillon
        const { data: invoice, error: insertError } = await supabase
          .from("invoices")
          .insert({
            dossier_id: dossierId,
            user_id: user.id,
            invoice_number: numData as string,
            status: "draft",
            issue_date: new Date().toISOString().split("T")[0],
            client_first_name: dossier?.client_first_name ?? null,
            client_last_name: dossier?.client_last_name ?? null,
            client_email: dossier?.client_email ?? null,
            client_phone: dossier?.client_phone ?? null,
            client_address: dossier?.address ?? null,
            client_type: "individual",
            vat_mode: vatMode,
          } as never)
          .select("id")
          .single();

        if (insertError) throw insertError;

        navigate(`/dossier/${dossierId}/facture/${invoice.id}`, { replace: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erreur";
        toast({ title: "Erreur création facture", description: msg, variant: "destructive" });
        navigate(`/dossier/${dossierId}`, { replace: true });
      }
    })();
  }, [navigate, searchParams, toast, user]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
