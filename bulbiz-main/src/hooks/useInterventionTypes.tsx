import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InterventionType {
  id: string;
  slug: string;
  name: string;
  sector_id: string | null;
  synonyms: string[];
  description: string | null;
  sort_order: number;
}

export interface InterventionPack {
  id: string;
  intervention_type_id: string;
  required_products: PackLine[];
  often_added_products: PackLine[];
  optional_products: PackLine[];
  labor_lines: PackLine[];
  travel_lines: PackLine[];
  waste_lines: PackLine[];
  qualification_questions: { key: string; question: string; options?: string[] }[];
}

export interface PackLine {
  label: string;
  unit: string;
  qty: number;
  unit_price?: number;
  vat_rate?: number;
  category_slug?: string;
  description?: string;
}

export function useInterventionTypes() {
  return useQuery({
    queryKey: ["intervention-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intervention_types")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as InterventionType[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useInterventionPack(interventionTypeId: string | null) {
  return useQuery({
    queryKey: ["intervention-pack", interventionTypeId],
    queryFn: async () => {
      if (!interventionTypeId) return null;
      const { data, error } = await supabase
        .from("intervention_product_packs")
        .select("*")
        .eq("intervention_type_id", interventionTypeId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as InterventionPack | null;
    },
    enabled: !!interventionTypeId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Détecte le type d'intervention à partir d'un texte (description dossier, problem_types).
 * Retourne l'intervention la plus pertinente via match keywords/synonyms.
 */
export function detectInterventionType(
  text: string,
  interventions: InterventionType[]
): InterventionType | null {
  if (!text || !interventions.length) return null;
  const norm = text.toLowerCase();
  let best: { it: InterventionType; score: number } | null = null;
  for (const it of interventions) {
    let score = 0;
    if (norm.includes(it.name.toLowerCase())) score += 10;
    for (const syn of it.synonyms ?? []) {
      if (syn && norm.includes(syn.toLowerCase())) score += 5;
    }
    if (score > 0 && (!best || score > best.score)) best = { it, score };
  }
  return best?.it ?? null;
}
