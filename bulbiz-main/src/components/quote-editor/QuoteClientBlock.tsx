import { User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface QuoteClientData {
  type: "individual" | "business";
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone?: string | null;
  company?: string | null;
}

interface QuoteClientBlockProps {
  value: QuoteClientData;
  onChange: (next: QuoteClientData) => void;
  disabled?: boolean;
}

export function QuoteClientBlock({ value, onChange, disabled }: QuoteClientBlockProps) {
  const set = <K extends keyof QuoteClientData>(k: K, v: QuoteClientData[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <User className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground flex-1">Infos client</h2>
        <div className="flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground">Pro</Label>
          <Switch
            checked={value.type === "business"}
            onCheckedChange={(v) => set("type", v ? "business" : "individual")}
            disabled={disabled}
          />
        </div>
      </header>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Prénom</Label>
            <Input
              className="h-9 text-sm"
              value={value.first_name ?? ""}
              onChange={(e) => set("first_name", e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Nom</Label>
            <Input
              className="h-9 text-sm"
              value={value.last_name ?? ""}
              onChange={(e) => set("last_name", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Email</Label>
            <Input
              type="email"
              className="h-9 text-sm"
              value={value.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Téléphone</Label>
            <Input
              className="h-9 text-sm"
              value={value.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
        {value.type === "business" && (
          <div className="space-y-1">
            <Label className="text-[10px]">Raison sociale</Label>
            <Input
              className="h-9 text-sm"
              value={value.company ?? ""}
              onChange={(e) => set("company", e.target.value)}
              disabled={disabled}
            />
          </div>
        )}
      </div>
    </section>
  );
}
