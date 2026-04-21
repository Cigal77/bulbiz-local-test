import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useComplianceProfile } from "@/hooks/useComplianceProfile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageLoader } from "@/components/PageLoader";

interface ComplianceGuardProps {
  children: ReactNode;
}

/**
 * Garde de redirection vers l'onboarding conformité.
 * Tolérant : ne redirige QUE si le profil n'a strictement aucun signal
 * de configuration préalable (pas de SIRET, pas de raison sociale,
 * pas d'onboarding daté, et aucun document déjà créé).
 */
export function ComplianceGuard({ children }: ComplianceGuardProps) {
  const { rawProfile, isLoading } = useComplianceProfile();
  const { user } = useAuth();
  const location = useLocation();

  const existingDocsQuery = useQuery({
    queryKey: ["compliance-guard-existing-docs", user?.id],
    queryFn: async () => {
      const [{ count: qCount }, { count: iCount }] = await Promise.all([
        supabase.from("quotes").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
      ]);
      return (qCount ?? 0) + (iCount ?? 0);
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  // On attend les données pour éviter une redirection prématurée
  if (isLoading || existingDocsQuery.isLoading || !user) return <PageLoader />;

  const p = rawProfile as any;
  const hasExistingDocs = (existingDocsQuery.data ?? 0) > 0;
  const hasOnboardingCompleted = !!p?.onboarding_compliance_completed_at;
  const hasMinimalSetup = !!(p?.siret || p?.siren || p?.company_name);

  // Compte considéré comme configuré si AU MOINS UN de ces signaux est présent
  const isConfigured = hasOnboardingCompleted || hasExistingDocs || hasMinimalSetup;

  if (!isConfigured) {
    return <Navigate to="/onboarding/conformite" state={{ from: location.pathname, reason: "compliance_required" }} replace />;
  }

  return <>{children}</>;
}
