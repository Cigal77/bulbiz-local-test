// Types for voice quote command interpretation
import type { QuoteItem, QuoteItemType } from "./quote-types";

export type VoiceMode = "command" | "dictation";

export type VoiceState =
  | "idle"
  | "listening"
  | "transcribing"
  | "interpreting"
  | "ready_to_validate"
  | "error";

export type VoiceActionType =
  | "add_line"
  | "update_line"
  | "delete_line"
  | "set_discount"
  | "set_vat"
  | "rename_quote";

export interface VoiceActionBase {
  id: string; // client-generated
  type: VoiceActionType;
  confidence: number; // 0..1
  accepted: boolean; // user toggle (default true)
  reason?: string;
}

export interface AddLineAction extends VoiceActionBase {
  type: "add_line";
  label: string;
  description?: string;
  qty: number;
  unit: string;
  unit_price: number;
  vat_rate: number;
  line_type: QuoteItemType;
  source?: "catalog" | "ai_fallback";
}

export interface UpdateLineAction extends VoiceActionBase {
  type: "update_line";
  line_ref: string; // matches QuoteItem.id OR fuzzy label
  field: "qty" | "unit_price" | "vat_rate" | "label" | "description" | "discount";
  value: string | number;
}

export interface DeleteLineAction extends VoiceActionBase {
  type: "delete_line";
  line_ref: string;
}

export interface SetDiscountAction extends VoiceActionBase {
  type: "set_discount";
  line_ref: string | "global";
  value: number;
  unit: "EUR" | "PERCENT";
}

export interface SetVatAction extends VoiceActionBase {
  type: "set_vat";
  line_ref: string;
  value: number;
}

export interface RenameQuoteAction extends VoiceActionBase {
  type: "rename_quote";
  value: string;
}

export type VoiceAction =
  | AddLineAction
  | UpdateLineAction
  | DeleteLineAction
  | SetDiscountAction
  | SetVatAction
  | RenameQuoteAction;

export interface VoiceAmbiguity {
  action_id: string;
  question: string;
  candidates: { line_ref: string; label: string }[];
}

export interface VoiceQuoteResult {
  transcript: string;
  actions: VoiceAction[];
  ambiguities: VoiceAmbiguity[];
  needs_confirmation: boolean;
  unmatched?: string;
}

export function actionDescription(a: VoiceAction, items: QuoteItem[]): string {
  const findLabel = (ref: string) =>
    items.find((i) => i.id === ref)?.label ??
    items.find((i) => i.label.toLowerCase().includes(ref.toLowerCase()))?.label ??
    ref;
  switch (a.type) {
    case "add_line":
      return `Ajouter "${a.label}" — ${a.qty} ${a.unit} × ${a.unit_price.toFixed(2)} €`;
    case "update_line":
      return `Modifier "${findLabel(a.line_ref)}" : ${a.field} → ${a.value}`;
    case "delete_line":
      return `Supprimer "${findLabel(a.line_ref)}"`;
    case "set_discount":
      return `Remise ${a.value}${a.unit === "PERCENT" ? "%" : "€"} sur "${a.line_ref === "global" ? "tout le devis" : findLabel(a.line_ref)}"`;
    case "set_vat":
      return `TVA ${a.value}% sur "${findLabel(a.line_ref)}"`;
    case "rename_quote":
      return `Renommer le devis : "${a.value}"`;
  }
}
