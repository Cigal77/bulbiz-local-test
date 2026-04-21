import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DossierContext {
  category?: string | null;
  description?: string | null;
  problem_types?: string[] | null;
}

export interface DetectedIntervention {
  id: string;
  label: string;
  score: number;
  parent_label?: string | null;
}

/** Normalise une chaîne pour matching keyword-insensible. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Détecte la (les) intervention(s) la plus probable depuis le dossier
 * en matchant catégorie + description + problem_types contre problem_taxonomy.keywords.
 */
export function useInterventionDetection(dossier?: DossierContext | null) {
  return useQuery({
    queryKey: [
      "intervention-detection",
      dossier?.category,
      dossier?.description?.slice(0, 200),
      (dossier?.problem_types ?? []).join("|"),
    ],
    queryFn: async (): Promise<DetectedIntervention[]> => {
      if (!dossier) return [];

      const { data: nodes, error } = await supabase
        .from("problem_taxonomy")
        .select("id, label, keywords, parent_id")
        .or("user_id.is.null");
      if (error) throw error;

      const haystack = norm(
        [dossier.category, dossier.description, ...(dossier.problem_types ?? [])]
          .filter(Boolean)
          .join(" "),
      );
      if (!haystack) return [];

      // Build parent lookup
      const byId = new Map<string, { id: string; label: string; parent_id: string | null }>();
      (nodes ?? []).forEach((n: any) => byId.set(n.id, n));

      const scored: DetectedIntervention[] = [];
      for (const n of nodes ?? []) {
        if (!n.parent_id) continue; // skip top-level categories, we want leaves
        const labelN = norm(n.label);
        let score = 0;
        // Strong match on the label itself
        if (labelN && haystack.includes(labelN)) score += 50;
        // Keywords
        for (const kw of (n.keywords as string[] | null) ?? []) {
          const kn = norm(kw);
          if (kn.length < 3) continue;
          if (haystack.includes(kn)) score += 15;
        }
        if (score > 0) {
          const parent = n.parent_id ? byId.get(n.parent_id) : null;
          scored.push({ id: n.id, label: n.label, score, parent_label: parent?.label ?? null });
        }
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, 3);
    },
    enabled: !!dossier && (!!dossier.category || !!dossier.description),
    staleTime: 1000 * 60 * 5,
  });
}
