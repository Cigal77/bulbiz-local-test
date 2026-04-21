import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const CONTEXT_CHIPS = [
  { key: "depannage", label: "Dépannage" },
  { key: "remplacement", label: "Remplacement" },
  { key: "installation", label: "Installation" },
  { key: "renovation", label: "Rénovation" },
  { key: "recherche_fuite", label: "Recherche de fuite" },
  { key: "debouchage", label: "Débouchage" },
  { key: "urgence", label: "Urgence" },
];

const TOGGLES = [
  { key: "includeTravel", label: "Inclure déplacement" },
  { key: "includeDiagnosis", label: "Inclure diagnostic" },
  { key: "includeTests", label: "Inclure tests / remise en service" },
  { key: "difficultAccess", label: "Accès difficile" },
  { key: "emergency", label: "Intervention urgence" },
];

interface LabourSummaryBlockProps {
  value: string;
  onChange: (value: string) => void;
  problemLabel?: string;
}

export function LabourSummaryBlock({ value, onChange, problemLabel }: LabourSummaryBlockProps) {
  const { toast } = useToast();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [variants, setVariants] = useState<{ short: string; standard: string; reassuring: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeVariant, setActiveVariant] = useState("standard");

  const toggleChip = (key: string) => {
    setSelectedTags((prev) => (prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]));
  };

  const toggleSwitch = (key: string) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = async () => {
    if (selectedTags.length === 0) {
      toast({ title: "Sélectionnez au moins un type d'intervention", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-labour-summary", {
        body: { context_tags: selectedTags, toggles, problem_label: problemLabel },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setVariants(data);
      // Auto-apply standard variant
      if (data?.standard) {
        onChange(data.standard);
        setActiveVariant("standard");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur";
      toast({ title: "Erreur IA", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const applyVariant = (variant: "short" | "standard" | "reassuring") => {
    if (variants?.[variant]) {
      onChange(variants[variant]);
      setActiveVariant(variant);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Résumé main d'œuvre (assisté)</h3>
      </div>

      {/* Context chips */}
      <div className="flex flex-wrap gap-1.5">
        {CONTEXT_CHIPS.map((chip) => (
          <Badge
            key={chip.key}
            variant={selectedTags.includes(chip.key) ? "default" : "outline"}
            className="cursor-pointer select-none text-xs"
            onClick={() => toggleChip(chip.key)}
          >
            {chip.label}
          </Badge>
        ))}
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {TOGGLES.map((t) => (
          <div key={t.key} className="flex items-center gap-2">
            <Switch
              id={`toggle-${t.key}`}
              checked={!!toggles[t.key]}
              onCheckedChange={() => toggleSwitch(t.key)}
              className="scale-90"
            />
            <Label htmlFor={`toggle-${t.key}`} className="text-xs cursor-pointer">{t.label}</Label>
          </div>
        ))}
      </div>

      {/* Generate button */}
      <Button size="sm" onClick={handleGenerate} disabled={isLoading} className="gap-1.5">
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Proposer un résumé
      </Button>

      {/* Variant tabs */}
      {variants && (
        <Tabs value={activeVariant} onValueChange={(v) => applyVariant(v as "short" | "standard" | "reassuring")}>
          <TabsList className="w-full grid grid-cols-3 h-8">
            <TabsTrigger value="short" className="text-xs">Courte</TabsTrigger>
            <TabsTrigger value="standard" className="text-xs">Standard pro</TabsTrigger>
            <TabsTrigger value="reassuring" className="text-xs">Rassurante</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Editable textarea */}
      <Textarea
        placeholder="Le résumé main d'œuvre apparaîtra ici…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="text-sm"
      />
    </div>
  );
}
