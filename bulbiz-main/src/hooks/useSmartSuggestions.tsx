import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SuggestionBucket =
  | "essential" // Indispensable (weight >= 100)
  | "frequent" // Souvent ajouté (weight 60-99)
  | "habit" // Tes habitudes (déduit catalog_usage_log)
  | "consumable"
  | "labor_travel"
  | "option";

export interface SmartSuggestion {
  signature: string;
  material_id?: string | null;
  label: string;
  description?: string;
  unit: string;
  default_qty: number;
  unit_price: number;
  vat_rate: number;
  type: string; // line type
  weight: number; // 0-100+
  bucket: SuggestionBucket;
  source: "manoeuvre" | "bundle" | "correspondence" | "history";
  origin_label?: string; // ex. "Pack: Remplacement WC"
  usage_count_user?: number;
  is_user_favorite?: boolean;
}

const HABIT_MIN_USES = 3;

function classify(type: string | null | undefined, weight: number): SuggestionBucket {
  const t = (type ?? "").toLowerCase();
  if (t === "main_oeuvre" || t === "labor" || t === "deplacement" || t === "travel") return "labor_travel";
  if (t === "consommable" || t === "consumable") return "consumable";
  if (weight >= 100) return "essential";
  if (weight >= 60) return "frequent";
  return "option";
}

export function useSmartSuggestions(opts: {
  interventionId?: string | null;
  dossierCategory?: string | null;
  excludeSignatures?: Set<string>;
}) {
  const { user } = useAuth();
  const { interventionId, dossierCategory, excludeSignatures } = opts;

  return useQuery({
    queryKey: ["smart-suggestions", interventionId, dossierCategory, user?.id],
    queryFn: async (): Promise<SmartSuggestion[]> => {
      if (!user) return [];
      const out: SmartSuggestion[] = [];
      const seen = new Set<string>();

      const pushItem = (s: SmartSuggestion) => {
        const sig = s.signature;
        if (seen.has(sig)) return;
        if (excludeSignatures?.has(sig)) return;
        seen.add(sig);
        out.push(s);
      };

      // 1) Manoeuvres for this intervention
      if (interventionId) {
        const { data: manoeuvres } = await supabase
          .from("problem_to_manoeuvre")
          .select("id, label, description, unit, default_qty, unit_price, vat_rate, weight, type")
          .eq("problem_id", interventionId)
          .order("weight", { ascending: false });

        for (const m of manoeuvres ?? []) {
          pushItem({
            signature: `man:${(m.label ?? "").toLowerCase().trim()}`,
            label: m.label,
            description: m.description ?? "",
            unit: m.unit ?? "u",
            default_qty: Number(m.default_qty ?? 1),
            unit_price: Number(m.unit_price ?? 0),
            vat_rate: Number(m.vat_rate ?? 10),
            type: m.type ?? "standard",
            weight: Number(m.weight ?? 50),
            bucket: classify(m.type, Number(m.weight ?? 50)),
            source: "manoeuvre",
          });
        }
      }

      // 2) Bundle templates matching the dossier category
      if (dossierCategory) {
        const { data: bundles } = await supabase
          .from("bundle_templates")
          .select("id, bundle_name, trigger_category, trigger_keywords, user_id")
          .or(`user_id.is.null,user_id.eq.${user.id}`)
          .eq("is_active", true)
          .ilike("trigger_category", `%${dossierCategory}%`);

        const bundleIds = (bundles ?? []).map((b: any) => b.id);
        if (bundleIds.length > 0) {
          const { data: bItems } = await supabase
            .from("bundle_template_items")
            .select("bundle_id, label, description, unit, default_qty, unit_price, vat_rate, item_type, is_optional")
            .in("bundle_id", bundleIds);

          for (const it of bItems ?? []) {
            const parent = (bundles ?? []).find((b: any) => b.id === it.bundle_id);
            const weight = it.is_optional ? 40 : 100;
            pushItem({
              signature: `bun:${(it.label ?? "").toLowerCase().trim()}`,
              label: it.label,
              description: it.description ?? "",
              unit: it.unit ?? "u",
              default_qty: Number(it.default_qty ?? 1),
              unit_price: Number(it.unit_price ?? 0),
              vat_rate: Number(it.vat_rate ?? 10),
              type: it.item_type ?? "standard",
              weight,
              bucket: classify(it.item_type, weight),
              source: "bundle",
              origin_label: parent ? `Pack : ${parent.bundle_name}` : undefined,
            });
          }
        }
      }

      // 3) User habits — lignes saisies fréquemment (catalog_usage_log)
      const { data: usage } = await supabase
        .from("catalog_usage_log")
        .select("label, unit, unit_price, vat_rate, material_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);

      const habitMap = new Map<
        string,
        { count: number; item: SmartSuggestion }
      >();
      for (const row of usage ?? []) {
        const key = (row.label ?? "").trim().toLowerCase();
        if (!key) continue;
        const existing = habitMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          habitMap.set(key, {
            count: 1,
            item: {
              signature: `usr:${key}`,
              material_id: row.material_id,
              label: row.label,
              unit: row.unit ?? "u",
              default_qty: 1,
              unit_price: Number(row.unit_price ?? 0),
              vat_rate: Number(row.vat_rate ?? 10),
              type: "standard",
              weight: 80,
              bucket: "habit",
              source: "history",
            },
          });
        }
      }
      const habits = Array.from(habitMap.values())
        .filter((h) => h.count >= HABIT_MIN_USES)
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);
      for (const h of habits) {
        pushItem({ ...h.item, usage_count_user: h.count });
      }

      return out;
    },
    enabled: !!user,
    staleTime: 1000 * 30,
  });
}
