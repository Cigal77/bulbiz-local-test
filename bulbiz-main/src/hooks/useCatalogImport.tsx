import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CsvImportPayload {
  filename: string;
  rows: Record<string, any>[];
  mapping: Record<string, string>; // csv col -> bulbiz field
  dedup_strategy: "skip" | "update" | "duplicate";
}

export interface CsvImportResult {
  job_id: string;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  error_details: { row: number; message: string }[];
}

export function useCatalogImport() {
  return useMutation({
    mutationFn: async (payload: CsvImportPayload): Promise<CsvImportResult> => {
      const { data, error } = await supabase.functions.invoke("import-catalog-csv", { body: payload });
      if (error) throw error;
      return data as CsvImportResult;
    },
    onError: (e: any) => toast.error("Import échoué : " + e.message),
  });
}

// Mapping cible
export const TARGET_FIELDS = [
  { key: "label", label: "Nom de l'article", required: true },
  { key: "category_path", label: "Catégorie" },
  { key: "subcategory", label: "Sous-catégorie" },
  { key: "description", label: "Description" },
  { key: "unit", label: "Unité" },
  { key: "unit_price", label: "Prix HT" },
  { key: "vat_rate", label: "TVA (%)" },
  { key: "type", label: "Type de ligne" },
  { key: "supplier", label: "Fournisseur" },
  { key: "supplier_ref", label: "Référence fournisseur" },
  { key: "internal_code", label: "Code interne" },
  { key: "brand", label: "Marque" },
  { key: "notes", label: "Notes" },
] as const;

const FUZZY_MAP: Record<string, string> = {
  nom: "label",
  name: "label",
  article: "label",
  designation: "label",
  désignation: "label",
  libelle: "label",
  libellé: "label",
  category: "category_path",
  categorie: "category_path",
  catégorie: "category_path",
  subcategory: "subcategory",
  "sous-categorie": "subcategory",
  "sous-catégorie": "subcategory",
  description: "description",
  desc: "description",
  unit: "unit",
  unite: "unit",
  unité: "unit",
  prix: "unit_price",
  "prix ht": "unit_price",
  price: "unit_price",
  pu: "unit_price",
  pu_ht: "unit_price",
  tva: "vat_rate",
  vat: "vat_rate",
  "taux tva": "vat_rate",
  type: "type",
  fournisseur: "supplier",
  supplier: "supplier",
  ref: "supplier_ref",
  reference: "supplier_ref",
  référence: "supplier_ref",
  "ref fournisseur": "supplier_ref",
  code: "internal_code",
  "code interne": "internal_code",
  marque: "brand",
  brand: "brand",
  notes: "notes",
  remarque: "notes",
};

export function autoDetectMapping(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const h of headers) {
    const norm = h.trim().toLowerCase();
    if (FUZZY_MAP[norm]) result[h] = FUZZY_MAP[norm];
  }
  return result;
}
