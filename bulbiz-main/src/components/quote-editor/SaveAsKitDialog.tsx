import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { QuoteItem } from "@/lib/quote-types";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  items: QuoteItem[];
  defaultCategory?: string;
}

export function SaveAsKitDialog({ open, onOpenChange, items, defaultCategory }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user || !name.trim() || items.length === 0) return;
    setSaving(true);
    try {
      const { data: bundle, error: bErr } = await supabase
        .from("bundle_templates")
        .insert({
          user_id: user.id,
          bundle_name: name.trim(),
          description: description.trim() || null,
          trigger_category: defaultCategory ?? "autre",
          trigger_keywords: keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
          is_active: true,
        })
        .select()
        .single();
      if (bErr) throw bErr;

      const bundleItems = items.map((it, idx) => ({
        bundle_id: bundle.id,
        label: it.label,
        description: it.description ?? null,
        unit: it.unit,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
        default_qty: it.qty,
        item_type: it.type,
        sort_order: idx,
      }));
      const { error: iErr } = await supabase.from("bundle_template_items").insert(bundleItems);
      if (iErr) throw iErr;

      toast.success(`Pack "${name}" enregistré (${items.length} ligne${items.length > 1 ? "s" : ""})`);
      onOpenChange(false);
      setName("");
      setDescription("");
      setKeywords("");
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enregistrer comme pack</DialogTitle>
          <DialogDescription>
            Sauvegarde ces {items.length} ligne{items.length > 1 ? "s" : ""} comme pack réutilisable
            sur tes futurs devis.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nom du pack *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Remplacement WC complet"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Quand utiliser ce pack…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mots-clés (séparés par virgule)</Label>
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="wc, toilette, cuvette"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "Enregistrement…" : "Enregistrer le pack"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
