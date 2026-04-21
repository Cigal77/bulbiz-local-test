import { Wrench, Package, ShoppingBag, Truck, MoreHorizontal } from "lucide-react";

export type QuoteItemType = "standard" | "main_oeuvre" | "deplacement" | "materiel" | "fourniture";

export type DiscountUnit = "PERCENT" | "EUR";

export interface QuoteItem {
  id: string;
  label: string;
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  vat_rate: number;
  discount: number;
  discount_unit?: DiscountUnit;
  type: QuoteItemType;
  /** Référence de la ligne IA d'origine (vide si ligne ajoutée manuellement). Sert au panneau IA pour permettre le retrait/régénération. */
  ai_ref?: string;
}

export const SECTIONS = [
  { key: "main_oeuvre" as const, label: "Main d'œuvre", icon: Wrench },
  { key: "materiel" as const, label: "Matériel", icon: Package },
  { key: "fourniture" as const, label: "Fournitures", icon: ShoppingBag },
  { key: "deplacement" as const, label: "Déplacement", icon: Truck },
  { key: "standard" as const, label: "Divers", icon: MoreHorizontal },
] as const;

export function createEmptyItem(
  type: QuoteItemType = "standard",
  defaultVatRate: number = 10,
): QuoteItem {
  const defaults: Record<QuoteItemType, Partial<QuoteItem>> = {
    standard: { label: "", unit: "u", unit_price: 0, vat_rate: defaultVatRate },
    main_oeuvre: { label: "Main d'œuvre", unit: "h", unit_price: 65, vat_rate: defaultVatRate },
    deplacement: { label: "Déplacement", unit: "forfait", unit_price: 35, vat_rate: 20 },
    materiel: { label: "", unit: "u", unit_price: 0, vat_rate: defaultVatRate },
    fourniture: { label: "", unit: "u", unit_price: 0, vat_rate: defaultVatRate },
  };
  return {
    id: crypto.randomUUID(),
    description: "",
    qty: 1,
    discount: 0,
    vat_rate: defaultVatRate,
    unit_price: 0,
    label: "",
    unit: "u",
    type,
    ...defaults[type],
  };
}

export function calcLineTotal(item: QuoteItem): number {
  const base = item.qty * item.unit_price;
  const d = item.discount || 0;
  if (item.discount_unit === "EUR") return Math.max(0, base - d);
  return base - (base * d) / 100;
}

export function calcLineTva(item: QuoteItem): number {
  return (calcLineTotal(item) * item.vat_rate) / 100;
}

export function calcTotals(items: QuoteItem[]) {
  const total_ht = items.reduce((s, i) => s + calcLineTotal(i), 0);
  const total_tva = items.reduce((s, i) => s + calcLineTva(i), 0);
  return { total_ht, total_tva, total_ttc: total_ht + total_tva };
}

export const UNIT_OPTIONS = ["u", "h", "m", "m²", "m³", "kg", "L", "forfait", "lot"];

export const QUOTE_TEMPLATES: Record<string, { label: string; items: Omit<QuoteItem, "id">[] }> = {
  fuite: {
    label: "Intervention fuite",
    items: [
      { label: "Déplacement", description: "", qty: 1, unit: "forfait", unit_price: 35, vat_rate: 20, discount: 0, type: "deplacement" },
      { label: "Main d'œuvre", description: "Recherche et réparation de fuite", qty: 1, unit: "h", unit_price: 65, vat_rate: 10, discount: 0, type: "main_oeuvre" },
      { label: "Fournitures plomberie", description: "", qty: 1, unit: "lot", unit_price: 25, vat_rate: 20, discount: 0, type: "fourniture" },
    ],
  },
  chauffe_eau: {
    label: "Remplacement chauffe-eau",
    items: [
      { label: "Déplacement", description: "", qty: 1, unit: "forfait", unit_price: 35, vat_rate: 20, discount: 0, type: "deplacement" },
      { label: "Chauffe-eau 200L", description: "Fourniture et pose", qty: 1, unit: "u", unit_price: 650, vat_rate: 10, discount: 0, type: "materiel" },
      { label: "Raccordements", description: "Plomberie et électrique", qty: 1, unit: "forfait", unit_price: 120, vat_rate: 10, discount: 0, type: "fourniture" },
      { label: "Main d'œuvre", description: "Dépose ancien + pose", qty: 3, unit: "h", unit_price: 65, vat_rate: 10, discount: 0, type: "main_oeuvre" },
      { label: "Enlèvement ancien chauffe-eau", description: "", qty: 1, unit: "forfait", unit_price: 50, vat_rate: 20, discount: 0, type: "standard" },
    ],
  },
  debouchage: {
    label: "Débouchage",
    items: [
      { label: "Déplacement", description: "", qty: 1, unit: "forfait", unit_price: 35, vat_rate: 20, discount: 0, type: "deplacement" },
      { label: "Débouchage canalisation", description: "Furet mécanique ou haute pression", qty: 1, unit: "forfait", unit_price: 150, vat_rate: 10, discount: 0, type: "standard" },
      { label: "Main d'œuvre", description: "", qty: 1, unit: "h", unit_price: 65, vat_rate: 10, discount: 0, type: "main_oeuvre" },
    ],
  },
};
