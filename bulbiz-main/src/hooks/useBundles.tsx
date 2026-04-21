import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BundleTemplate {
  id: string;
  bundle_name: string;
  description: string | null;
  trigger_category: string;
  trigger_keywords: string[];
  notes: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface BundleItem {
  id: string;
  bundle_id: string;
  label: string;
  description: string;
  item_type: string;
  unit: string;
  default_qty: number;
  unit_price: number;
  vat_rate: number;
  is_optional: boolean;
  sort_order: number;
}

export function useBundleTemplates(category?: string) {
  return useQuery({
    queryKey: ["bundle-templates", category],
    queryFn: async () => {
      let query = supabase
        .from("bundle_templates")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (category) {
        query = query.eq("trigger_category", category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as BundleTemplate[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useBundleItems(bundleId: string | null) {
  return useQuery({
    queryKey: ["bundle-items", bundleId],
    queryFn: async () => {
      if (!bundleId) return [];
      const { data, error } = await supabase
        .from("bundle_template_items")
        .select("*")
        .eq("bundle_id", bundleId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as BundleItem[];
    },
    enabled: !!bundleId,
  });
}

/** Returns bundles matching a dossier's category and description keywords */
export function useSuggestedBundles(category?: string, description?: string) {
  const { data: allBundles = [], isLoading } = useBundleTemplates();

  const suggested = allBundles.filter((b) => {
    // Match by category
    if (category && b.trigger_category === category) return true;
    // Match by keywords in description
    if (description) {
      const desc = description.toLowerCase();
      return b.trigger_keywords.some((kw) => desc.includes(kw.toLowerCase()));
    }
    return false;
  });

  // If no matches, return all bundles sorted
  const result = suggested.length > 0 ? suggested : allBundles;

  return { data: result, allBundles, isLoading };
}
