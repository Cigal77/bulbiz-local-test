import { User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Invoice } from "@/hooks/useInvoices";

interface InvoiceClientBlockProps {
  form: Partial<Invoice>;
  onChange: (patch: Partial<Invoice>) => void;
  disabled?: boolean;
}

export function InvoiceClientBlock({ form, onChange, disabled }: InvoiceClientBlockProps) {
  const isPro = form.client_type === "business";
  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <User className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground flex-1">Infos client</h2>
        <div className="flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground">Pro</Label>
          <Switch
            checked={isPro}
            onCheckedChange={(v) => onChange({ client_type: v ? "business" : "individual" })}
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
              value={form.client_first_name ?? ""}
              onChange={(e) => onChange({ client_first_name: e.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Nom</Label>
            <Input
              className="h-9 text-sm"
              value={form.client_last_name ?? ""}
              onChange={(e) => onChange({ client_last_name: e.target.value })}
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
              value={form.client_email ?? ""}
              onChange={(e) => onChange({ client_email: e.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Téléphone</Label>
            <Input
              className="h-9 text-sm"
              value={form.client_phone ?? ""}
              onChange={(e) => onChange({ client_phone: e.target.value })}
              disabled={disabled}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Adresse</Label>
          <Input
            className="h-9 text-sm"
            value={form.client_address ?? ""}
            onChange={(e) => onChange({ client_address: e.target.value })}
            disabled={disabled}
          />
        </div>
        {isPro && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Raison sociale</Label>
              <Input
                className="h-9 text-sm"
                value={form.client_company ?? ""}
                onChange={(e) => onChange({ client_company: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">SIREN</Label>
              <Input
                className="h-9 text-sm"
                value={form.customer_siren ?? ""}
                onChange={(e) => onChange({ customer_siren: e.target.value })}
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
