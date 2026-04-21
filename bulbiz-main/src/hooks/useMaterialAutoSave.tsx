import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AutoSaveLine {
  label: string;
  unit: string;
  unit_price: number;
  vat_rate: number;
  /** Type de la ligne dans le devis. Détermine la catégorisation dans le catalogue. */
  line_type?: "standard" | "main_oeuvre" | "deplacement" | "materiel" | "fourniture";
  description?: string;
}

const TYPE_TO_CATALOG: Record<NonNullable<AutoSaveLine["line_type"]>, { type: string; category: string }> = {
  main_oeuvre: { type: "MAIN_OEUVRE", category: "Mes saisies / Main d'œuvre" },
  deplacement: { type: "DEPLACEMENT", category: "Mes saisies / Déplacement" },
  materiel:    { type: "MATERIEL",    category: "Mes saisies / Matériel" },
  fourniture:  { type: "PETITE_FOURNITURE", category: "Mes saisies / Fournitures" },
  standard:    { type: "standard",    category: "Mes saisies / Divers" },
};

/**
 * Enregistre automatiquement une ligne saisie à la main dans le catalogue
 * personnel de l'artisan, ou met à jour son usage si elle existe déjà.
 * Silencieux : aucune erreur n'est remontée à l'utilisateur.
 */
export function useMaterialAutoSave() {
  const { user } = useAuth();

  const saveLineToCatalog = useCallback(
    async (line: AutoSaveLine): Promise<"created" | "updated" | "skipped"> => {
      if (!user) return "skipped";
      const label = (line.label || "").trim();
      if (label.length < 3) return "skipped";
      if (!Number.isFinite(line.unit_price) || line.unit_price <= 0) return "skipped";

      const unit = line.unit || "u";
      const vat_rate = Number.isFinite(line.vat_rate) ? line.vat_rate : 10;
      const mapping = TYPE_TO_CATALOG[line.line_type ?? "standard"];

      try {
        // Recherche d'un doublon exact (label insensible à la casse + unité + type) dans le catalogue de l'utilisateur
        const { data: existing } = await supabase
          .from("catalog_material")
          .select("id, usage_count")
          .eq("user_id", user.id)
          .ilike("label", label)
          .eq("unit", unit)
          .eq("type", mapping.type)
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from("catalog_material")
            .update({
              usage_count: (existing.usage_count ?? 0) + 1,
              last_used_at: new Date().toISOString(),
              last_used_price: line.unit_price,
            })
            .eq("id", existing.id);
          return "updated";
        }

        const { error } = await supabase.from("catalog_material").insert({
          user_id: user.id,
          label,
          unit,
          unit_price: line.unit_price,
          vat_rate,
          type: mapping.type,
          category_path: mapping.category,
          notes: line.description || null,
          usage_count: 1,
          last_used_at: new Date().toISOString(),
          last_used_price: line.unit_price,
          tags: [],
          active: true,
        });
        if (error) {
          console.warn("[useMaterialAutoSave] insert failed", error.message);
          return "skipped";
        }
        return "created";
      } catch (e) {
        console.warn("[useMaterialAutoSave] exception", e);
        return "skipped";
      }
    },
    [user],
  );

  return { saveLineToCatalog };
}
