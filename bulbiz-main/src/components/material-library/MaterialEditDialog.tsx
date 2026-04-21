import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUpsertMaterial, type LibraryMaterial, type MaterialUpsertPayload } from "@/hooks/useMaterialLibrary";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  material?: LibraryMaterial | null;
  initial?: Partial<MaterialUpsertPayload>;
}

const DEFAULT: MaterialUpsertPayload = {
  label: "",
  category_path: "Divers",
  subcategory: "",
  type: "PETITE_FOURNITURE",
  unit: "u",
  unit_price: 0,
  vat_rate: 10,
  default_qty: 1,
  tags: [],
  supplier: "",
  supplier_ref: "",
  internal_code: "",
  brand: "",
  notes: "",
  is_favorite: false,
};

export function MaterialEditDialog({ open, onOpenChange, material, initial }: Props) {
  const [form, setForm] = useState<MaterialUpsertPayload>(DEFAULT);
  const upsert = useUpsertMaterial();

  useEffect(() => {
    if (material) {
      setForm({
        id: material.id,
        label: material.label,
        category_path: material.category_path,
        subcategory: material.subcategory ?? "",
        type: material.type,
        unit: material.unit ?? "u",
        unit_price: Number(material.unit_price ?? 0),
        vat_rate: Number(material.vat_rate ?? 10),
        default_qty: Number(material.default_qty ?? 1),
        tags: material.tags ?? [],
        supplier: material.supplier ?? "",
        supplier_ref: material.supplier_ref ?? "",
        internal_code: material.internal_code ?? "",
        brand: material.brand ?? "",
        notes: material.notes ?? "",
        is_favorite: material.is_favorite,
      });
    } else {
      setForm({ ...DEFAULT, ...initial });
    }
  }, [material, initial, open]);

  const set = <K extends keyof MaterialUpsertPayload>(k: K, v: MaterialUpsertPayload[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.label.trim()) return;
    await upsert.mutateAsync(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{material ? "Modifier l'article" : "Nouvel article"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2 space-y-1">
            <Label>Nom *</Label>
            <Input value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="Robinet thermostatique" />
          </div>

          <div className="space-y-1">
            <Label>Catégorie</Label>
            <Input value={form.category_path} onChange={(e) => set("category_path", e.target.value)} placeholder="Plomberie" />
          </div>
          <div className="space-y-1">
            <Label>Sous-catégorie</Label>
            <Input value={form.subcategory ?? ""} onChange={(e) => set("subcategory", e.target.value)} placeholder="Robinetterie" />
          </div>

          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MATERIEL">Matériel</SelectItem>
                <SelectItem value="PETITE_FOURNITURE">Fourniture</SelectItem>
                <SelectItem value="MAIN_OEUVRE">Main-d'œuvre</SelectItem>
                <SelectItem value="DEPLACEMENT">Déplacement</SelectItem>
                <SelectItem value="standard">Forfait / Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Unité</Label>
            <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["u", "ml", "m²", "m³", "h", "j", "forfait", "kg", "L"].map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Prix HT (€)</Label>
            <Input type="number" step="0.01" value={form.unit_price} onChange={(e) => set("unit_price", parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-1">
            <Label>TVA (%)</Label>
            <Select value={String(form.vat_rate)} onValueChange={(v) => set("vat_rate", parseFloat(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0, 5.5, 10, 20].map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Marque</Label>
            <Input value={form.brand ?? ""} onChange={(e) => set("brand", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Fournisseur</Label>
            <Input value={form.supplier ?? ""} onChange={(e) => set("supplier", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Réf. fournisseur</Label>
            <Input value={form.supplier_ref ?? ""} onChange={(e) => set("supplier_ref", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Code interne</Label>
            <Input value={form.internal_code ?? ""} onChange={(e) => set("internal_code", e.target.value)} />
          </div>

          <div className="md:col-span-2 space-y-1">
            <Label>Notes</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>

          <div className="md:col-span-2 flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Marquer comme favori</Label>
              <p className="text-xs text-muted-foreground">Apparaîtra en tête dans l'autocomplete devis</p>
            </div>
            <Switch checked={form.is_favorite ?? false} onCheckedChange={(v) => set("is_favorite", v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={save} disabled={!form.label.trim() || upsert.isPending}>
            {upsert.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
