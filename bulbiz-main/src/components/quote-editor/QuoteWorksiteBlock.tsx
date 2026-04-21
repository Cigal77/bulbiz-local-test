import { useState, useEffect } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface QuoteWorksiteBlockProps {
  worksiteAddress: string | null;
  clientAddress?: string | null;
  onChange: (address: string | null) => void;
  disabled?: boolean;
}

export function QuoteWorksiteBlock({
  worksiteAddress,
  clientAddress,
  onChange,
  disabled,
}: QuoteWorksiteBlockProps) {
  const initialSame = !worksiteAddress || worksiteAddress === clientAddress;
  const [sameAsClient, setSameAsClient] = useState(initialSame);

  useEffect(() => {
    if (sameAsClient && clientAddress && worksiteAddress !== clientAddress) {
      onChange(clientAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sameAsClient, clientAddress]);

  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <MapPin className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground flex-1">Infos chantier</h2>
        <div className="flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground">Idem client</Label>
          <Switch
            checked={sameAsClient}
            onCheckedChange={setSameAsClient}
            disabled={disabled}
          />
        </div>
      </header>
      <div className="p-4">
        <div className="space-y-1">
          <Label className="text-[10px]">Adresse du chantier</Label>
          <Input
            className="h-9 text-sm"
            placeholder="N°, rue, ville…"
            value={sameAsClient ? clientAddress ?? "" : worksiteAddress ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || sameAsClient}
          />
        </div>
      </div>
    </section>
  );
}
