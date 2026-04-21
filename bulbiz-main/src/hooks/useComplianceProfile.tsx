import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  computeComplianceScore,
  type ComplianceProfile,
  type InsuranceProfile,
  type ComplianceSettings,
} from "@/lib/compliance-engine";

export function useComplianceProfile() {
  const { user } = useAuth();
  const { profile, update: updateProfile, isLoading: profileLoading } = useProfile();
  const qc = useQueryClient();

  const insuranceQuery = useQuery({
    queryKey: ["insurance_profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insurance_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as InsuranceProfile | null;
    },
    enabled: !!user?.id,
  });

  const settingsQuery = useQuery({
    queryKey: ["compliance_settings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as ComplianceSettings | null;
    },
    enabled: !!user?.id,
  });

  const updateInsurance = useMutation({
    mutationFn: async (values: Partial<InsuranceProfile>) => {
      const { error } = await supabase
        .from("insurance_profiles")
        .upsert({ ...values, user_id: user!.id }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insurance_profile", user?.id] }),
  });

  const updateSettings = useMutation({
    mutationFn: async (values: Partial<ComplianceSettings>) => {
      const { error } = await supabase
        .from("compliance_settings")
        .upsert({ ...values, user_id: user!.id }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compliance_settings", user?.id] }),
  });

  const complianceProfile: ComplianceProfile | null = profile
    ? {
        legal_form: (profile as any).legal_form ?? null,
        company_name: profile.company_name,
        trade_name: (profile as any).trade_name ?? null,
        owner_first_name: (profile as any).owner_first_name ?? null,
        owner_last_name: (profile as any).owner_last_name ?? null,
        first_name: profile.first_name,
        last_name: profile.last_name,
        capital_amount: (profile as any).capital_amount ?? null,
        rcs_city: (profile as any).rcs_city ?? null,
        siren: (profile as any).siren ?? null,
        siret: profile.siret,
        tva_intracom: profile.tva_intracom,
        email: profile.email,
        phone: profile.phone,
        address: profile.address,
        vat_applicable: profile.vat_applicable,
        vat_exemption_293b: (profile as any).vat_exemption_293b ?? false,
        vat_on_debits: (profile as any).vat_on_debits ?? false,
        iban: (profile as any).iban ?? null,
        bic: (profile as any).bic ?? null,
        accepted_payment_methods: (profile as any).accepted_payment_methods ?? null,
        payment_terms_default: profile.payment_terms_default,
        late_penalty_rate: (profile as any).late_penalty_rate ?? null,
        fixed_recovery_fee_b2b: (profile as any).fixed_recovery_fee_b2b ?? true,
        onboarding_compliance_completed_at:
          (profile as any).onboarding_compliance_completed_at ?? null,
      }
    : null;

  const score = computeComplianceScore(complianceProfile, insuranceQuery.data ?? null, settingsQuery.data ?? null);

  return {
    profile: complianceProfile,
    rawProfile: profile ?? null,
    insurance: insuranceQuery.data ?? null,
    settings: settingsQuery.data ?? null,
    isLoading: profileLoading || insuranceQuery.isLoading || settingsQuery.isLoading,
    score,
    updateProfile,
    updateInsurance,
    updateSettings,
  };
}
