import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Wrench, Package, Lightbulb, PackageOpen, Sparkles, Zap, Target } from "lucide-react";
import { ProblemTreePanel } from "./ProblemTreePanel";
import { MaterialPickerPanel } from "./MaterialPickerPanel";
import { BundleSuggestionPanel } from "./BundleSuggestionPanel";
import { AiQuoteDraftPanel } from "./AiQuoteDraftPanel";
import { SmartSuggestionsPanel } from "./SmartSuggestionsPanel";
import { InterventionSuggestionsPanel } from "./InterventionSuggestionsPanel";
import { InterventionTreeView } from "./InterventionTreeView";
import type { QuoteItem } from "@/lib/quote-types";
import type { PackLine } from "@/hooks/useInterventionTypes";
import { useIsMobile } from "@/hooks/use-mobile";

interface AssistantSidebarProps {
  onAddItem: (item: Omit<QuoteItem, "id">) => void;
  onAddItems: (items: Omit<QuoteItem, "id">[]) => void;
  onSetLabourContext: (tags: string[], problemLabel: string) => void;
  dossierId: string;
  quoteId?: string | null;
  dossierCategory?: string;
  dossierDescription?: string;
  dossierProblemTypes?: string[] | null;
  currentItems?: { label?: string | null; id?: string }[];
  defaultTab?: "smart" | "ai" | "pack" | "tree" | "packs" | "problems" | "material";
  autoGenerateAi?: boolean;
  onRemoveAiLine?: (aiRef: string) => void;
  onRemoveAllAi?: () => void;
  presentAiRefs?: string[];
  /** Quand cette clé change, ouvre l'onglet IA et relance la génération. */
  aiTriggerKey?: number;
  /** Quand cette clé change (mobile), ouvre automatiquement le drawer. */
  openDrawerKey?: number;
}

function AssistantContent({
  onAddItem,
  onAddItems,
  onSetLabourContext,
  dossierId,
  quoteId,
  dossierCategory,
  dossierDescription,
  dossierProblemTypes,
  currentItems = [],
  defaultTab = "pack",
  autoGenerateAi,
  onRemoveAiLine,
  onRemoveAllAi,
  presentAiRefs,
  aiTriggerKey,
}: AssistantSidebarProps) {
  const contextText = [dossierDescription, ...(dossierProblemTypes ?? [])].filter(Boolean).join(" ");
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // Quand on déclenche l'IA depuis le header, basculer sur l'onglet IA.
  useEffect(() => {
    if (aiTriggerKey && aiTriggerKey > 0) setActiveTab("ai");
  }, [aiTriggerKey]);

  // Suivre les changements de defaultTab (ex: arrivée via ?ai=auto).
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const handleAddPackLines = (lines: PackLine[]) => {
    const items: Omit<QuoteItem, "id">[] = lines.map((l) => ({
      label: l.label,
      description: l.description ?? "",
      qty: l.qty,
      unit: l.unit,
      unit_price: l.unit_price ?? 0,
      vat_rate: l.vat_rate ?? 10,
      discount: 0,
      type: "standard",
    }));
    onAddItems(items);
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
      <TabsList className="w-full grid grid-cols-6 h-10 mb-3 mx-0">
        <TabsTrigger value="pack" className="gap-1 text-xs font-semibold px-1">
          <Target className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Pack</span>
        </TabsTrigger>
        <TabsTrigger value="tree" className="gap-1 text-xs font-semibold px-1">
          <Wrench className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Arbre</span>
        </TabsTrigger>
        <TabsTrigger value="smart" className="gap-1 text-xs font-semibold px-1">
          <Zap className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Smart</span>
        </TabsTrigger>
        <TabsTrigger value="ai" className="gap-1 text-xs font-semibold px-1">
          <Sparkles className="h-3.5 w-3.5" />
          IA
        </TabsTrigger>
        <TabsTrigger value="packs" className="gap-1 text-xs font-semibold px-1">
          <PackageOpen className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Mes packs</span>
        </TabsTrigger>
        <TabsTrigger value="material" className="gap-1 text-xs font-semibold px-1">
          <Package className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Mat.</span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="pack" className="flex-1 mt-0 overflow-y-auto pr-1">
        <InterventionSuggestionsPanel contextText={contextText} onAddLines={handleAddPackLines} />
      </TabsContent>
      <TabsContent value="tree" className="flex-1 mt-0 overflow-hidden">
        <InterventionTreeView contextText={contextText} onAddLines={handleAddPackLines} />
      </TabsContent>
      <TabsContent value="smart" className="flex-1 mt-0 overflow-hidden">
        <SmartSuggestionsPanel
          dossierId={dossierId}
          dossierCategory={dossierCategory}
          dossierDescription={dossierDescription}
          dossierProblemTypes={dossierProblemTypes}
          currentItems={currentItems}
          onAddItem={onAddItem}
          onAddItems={onAddItems}
        />
      </TabsContent>
      <TabsContent value="ai" className="flex-1 mt-0 overflow-hidden">
        <AiQuoteDraftPanel
          dossierId={dossierId}
          quoteId={quoteId}
          autoGenerate={autoGenerateAi}
          onAddItem={onAddItem}
          onAddItems={onAddItems}
          onRemoveAiLine={onRemoveAiLine}
          onRemoveAllAi={onRemoveAllAi}
          presentAiRefs={presentAiRefs}
          triggerKey={aiTriggerKey}
        />
      </TabsContent>
      <TabsContent value="packs" className="flex-1 mt-0 overflow-hidden">
        <BundleSuggestionPanel
          dossierCategory={dossierCategory}
          dossierDescription={dossierDescription}
          onAddItems={onAddItems}
          onAddItem={onAddItem}
        />
      </TabsContent>
      <TabsContent value="material" className="flex-1 mt-0 overflow-hidden">
        <MaterialPickerPanel onAddItem={onAddItem} />
      </TabsContent>
    </Tabs>
  );
}

export function AssistantSidebar(props: AssistantSidebarProps) {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Ouvrir auto le drawer quand le bouton "Pré-devis IA" du header est cliqué (mobile).
  useEffect(() => {
    if (props.openDrawerKey && props.openDrawerKey > 0) setDrawerOpen(true);
  }, [props.openDrawerKey]);

  if (isMobile) {
    return (
      <>
        <Button
          className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full shadow-lg gap-0"
          size="icon"
          onClick={() => setDrawerOpen(true)}
        >
          <Sparkles className="h-5 w-5" />
        </Button>

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="bottom" className="h-[90vh] p-0 flex flex-col rounded-t-xl">
            <SheetHeader className="px-4 pt-4 pb-2">
              <SheetTitle className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Assistant devis
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden px-4 pb-4">
              <AssistantContent {...props} />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <aside className="w-[380px] shrink-0 border-r bg-card/50 flex flex-col sticky top-[88px] h-[calc(100vh-88px)] overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2 border-b">
        <Lightbulb className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Assistant devis</h2>
      </div>
      <div className="flex-1 overflow-hidden px-4 pt-3 pb-4">
        <AssistantContent {...props} />
      </div>
    </aside>
  );
}
