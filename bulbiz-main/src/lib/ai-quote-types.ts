import type { QuoteItem, QuoteItemType } from "./quote-types";

export type AiLineSource = "catalog" | "ai_fallback";

export interface AiQuoteLine {
  ref: string; // unique id within the draft
  label: string;
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  vat_rate: number;
  type: QuoteItemType;
  source: AiLineSource;
  catalog_item_id?: string | null;
  rationale?: string | null;
  voice_evidence?: string | null;
}

export interface AiQuoteVariant {
  label: string;
  description?: string;
  lines: AiQuoteLine[];
}

export interface AiAnalysisSources {
  audio_count: number;
  image_count: number;
  written_note_count: number;
  historic_note_count: number;
  past_quote_count: number;
  has_summary_cache: boolean;
  voice_transcript_used: boolean;
  dossier_voice_transcripts_count?: number;
}

export interface AiDetectedPhoto {
  photo_name: string;
  material_label: string;
  brand?: string;
  model_or_ref?: string;
  visible_state: string;
  dimensions?: string;
}

export interface AiQuoteDraft {
  log_id: string;
  title: string;
  summary: string;
  confidence: number; // 0..1
  lines: AiQuoteLine[];
  assumptions: string[];
  missing_questions: string[];
  variants: AiQuoteVariant[];
  catalog_match_count: number;
  ai_fallback_count: number;
  analysis_sources?: AiAnalysisSources;
  voice_transcript?: string;
  detected_from_photos?: AiDetectedPhoto[];
}

export function aiLineToQuoteItem(line: AiQuoteLine): Omit<QuoteItem, "id"> {
  return {
    label: line.label,
    description: line.description ?? "",
    qty: line.qty,
    unit: line.unit,
    unit_price: line.unit_price,
    vat_rate: line.vat_rate,
    discount: 0,
    type: line.type,
    ai_ref: line.ref,
  };
}
