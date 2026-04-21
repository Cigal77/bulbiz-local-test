import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Mic } from "lucide-react";
import { VoiceQuoteSheet } from "@/components/quote-editor/VoiceQuoteSheet";
import type { VoiceAction } from "@/lib/voice-quote-types";
import { cn } from "@/lib/utils";
import { useDossier } from "@/hooks/useDossier";
import { useProfile } from "@/hooks/useProfile";
import { useQuotes } from "@/hooks/useQuotes";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QuoteHeaderBar } from "@/components/quote-editor/QuoteHeaderBar";
import { QuoteSectionChecklist } from "@/components/quote-editor/QuoteSectionChecklist";
import { AssistantSidebar } from "@/components/quote-editor/AssistantSidebar";
import { QuoteSections } from "@/components/quote-editor/QuoteSections";
import { QuoteClientBlock, type QuoteClientData } from "@/components/quote-editor/QuoteClientBlock";
import { QuoteWorksiteBlock } from "@/components/quote-editor/QuoteWorksiteBlock";
import { QuoteDocumentBlock } from "@/components/quote-editor/QuoteDocumentBlock";
import { QuotePreviewBlock } from "@/components/quote-editor/QuotePreviewBlock";
import { QuickActionsBar } from "@/components/quote-editor/QuickActionsBar";
import { PdfPreviewDialog } from "@/components/quote-editor/PdfPreviewDialog";
import { DossierPrefillBanner, type PrefillField } from "@/components/documents/DossierPrefillBanner";
import { DossierContextSummary } from "@/components/documents/DossierContextSummary";
import { useDossierMedias } from "@/hooks/useDossier";
import { ComplianceChecklist } from "@/components/compliance/ComplianceChecklist";
import { ComplianceBlockerDialog } from "@/components/compliance/ComplianceBlockerDialog";
import { useComplianceProfile } from "@/hooks/useComplianceProfile";
import { validateQuoteForGeneration } from "@/lib/compliance-engine";
import type { QuoteItem } from "@/lib/quote-types";
import { calcTotals } from "@/lib/quote-types";
import { useIsMobile } from "@/hooks/use-mobile";
import { InterventionDetectedBadge } from "@/components/quote-editor/InterventionDetectedBadge";
import { SaveAsKitDialog } from "@/components/quote-editor/SaveAsKitDialog";
import type { PackLine } from "@/hooks/useInterventionTypes";

export default function QuoteEditor() {
  const { dossierId } = useParams<{ dossierId: string }>();
  const [searchParams] = useSearchParams();
  const quoteId = searchParams.get("quote");
  const aiAuto = searchParams.get("ai") === "auto";
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: dossier, isLoading: dossierLoading } = useDossier(dossierId!);
  const { profile } = useProfile();
  const { data: quotes = [] } = useQuotes(dossierId!);
  const isMobile = useIsMobile();

  const [items, setItems] = useState<QuoteItem[]>([]);
  const [notes, setNotes] = useState("");
  const [labourSummary, setLabourSummary] = useState("");
  const [problemLabel, setProblemLabel] = useState<string | undefined>();
  const [validityDays, setValidityDays] = useState(30);
  const [currentQuoteId, setCurrentQuoteId] = useState<string | null>(quoteId);
  const [quoteNumber, setQuoteNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [client, setClient] = useState<QuoteClientData>({
    type: "individual", first_name: null, last_name: null, email: null, phone: null, company: null,
  });
  const [worksiteAddress, setWorksiteAddress] = useState<string | null>(null);
  const [depositType, setDepositType] = useState<string | null>(null);
  const [depositValue, setDepositValue] = useState<number | null>(null);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { profile: compProfile, insurance, settings } = useComplianceProfile();
  const { data: medias = [] } = useDossierMedias(dossierId!);
  const [blockerOpen, setBlockerOpen] = useState(false);
  const [blockerAction, setBlockerAction] = useState("générer ce devis");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [saveKitOpen, setSaveKitOpen] = useState(false);
  const [aiTriggerKey, setAiTriggerKey] = useState(0);
  const [openAiDrawerKey, setOpenAiDrawerKey] = useState(0);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const handleTriggerAi = useCallback(() => {
    setAiTriggerKey((k) => k + 1);
    if (isMobile) setOpenAiDrawerKey((k) => k + 1);
    setIsAiGenerating(true);
    // Re-active après 30s pour éviter de bloquer si la génération échoue silencieusement
    setTimeout(() => setIsAiGenerating(false), 30000);
  }, [isMobile]);

  const dossierContextText = [dossier?.description, ...(dossier?.problem_types ?? [])]
    .filter(Boolean)
    .join(" ");

  const handleAddPackLines = useCallback((lines: PackLine[]) => {
    const newItems = lines.map((l) => ({
      id: crypto.randomUUID(),
      label: l.label,
      description: l.description ?? "",
      qty: l.qty,
      unit: l.unit,
      unit_price: l.unit_price ?? 0,
      vat_rate: l.vat_rate ?? 10,
      discount: 0,
      type: "standard" as const,
    }));
    setItems((prev) => [...prev, ...newItems]);
    toast({ title: `✓ ${lines.length} ligne${lines.length > 1 ? "s" : ""} ajoutée${lines.length > 1 ? "s" : ""}` });
  }, [toast]);

  // Apply voice actions to quote items
  const applyVoiceActions = useCallback(
    async (actions: VoiceAction[], transcript: string) => {
      let next = [...items];
      let renamed: string | null = null;

      const findIndex = (ref: string) => {
        const byId = next.findIndex((it) => it.id === ref);
        if (byId !== -1) return byId;
        const lower = ref.toLowerCase();
        return next.findIndex((it) => it.label.toLowerCase().includes(lower));
      };

      for (const a of actions) {
        if (a.type === "add_line") {
          next.push({
            id: crypto.randomUUID(),
            label: a.label,
            description: a.description ?? "",
            qty: a.qty || 1,
            unit: a.unit || "u",
            unit_price: a.unit_price || 0,
            vat_rate: a.vat_rate ?? 10,
            discount: 0,
            type: a.line_type || "standard",
          });
        } else if (a.type === "delete_line") {
          const idx = findIndex(a.line_ref);
          if (idx !== -1) next.splice(idx, 1);
        } else if (a.type === "update_line") {
          const idx = findIndex(a.line_ref);
          if (idx === -1) continue;
          const numericFields = ["qty", "unit_price", "vat_rate", "discount"];
          const value = numericFields.includes(a.field) ? Number(a.value) : String(a.value);
          next[idx] = { ...next[idx], [a.field]: value } as typeof next[number];
        } else if (a.type === "set_discount") {
          if (a.line_ref === "global") {
            const totalHt = next.reduce((s, it) => s + it.qty * it.unit_price, 0);
            if (totalHt > 0) {
              const pct = a.unit === "PERCENT" ? a.value : (a.value / totalHt) * 100;
              next = next.map((it) => ({ ...it, discount: pct }));
            }
          } else {
            const idx = findIndex(a.line_ref);
            if (idx !== -1) {
              const it = next[idx];
              const pct =
                a.unit === "PERCENT"
                  ? a.value
                  : it.qty * it.unit_price > 0
                    ? (a.value / (it.qty * it.unit_price)) * 100
                    : 0;
              next[idx] = { ...it, discount: pct };
            }
          }
        } else if (a.type === "set_vat") {
          const idx = findIndex(a.line_ref);
          if (idx !== -1) next[idx] = { ...next[idx], vat_rate: Number(a.value) };
        } else if (a.type === "rename_quote") {
          renamed = a.value;
        }
      }

      setItems(next);
      if (renamed) setNotes((prev) => (prev ? `${renamed}\n${prev}` : renamed!));

      toast({
        title: `✓ ${actions.length} action${actions.length > 1 ? "s" : ""} appliquée${actions.length > 1 ? "s" : ""}`,
        description: transcript.slice(0, 80) + (transcript.length > 80 ? "…" : ""),
      });

      if (dossierId && user) {
        try {
          await supabase.from("historique").insert({
            dossier_id: dossierId,
            user_id: user.id,
            action: "voice_quote_edit",
            details: `${actions.length} action(s) vocales — « ${transcript.slice(0, 200)} »`,
          });
        } catch (e) {
          console.warn("historique insert failed", e);
        }
      }
    },
    [items, dossierId, user, toast],
  );

  const validation = validateQuoteForGeneration(
    {
      items,
      total_ttc: calcTotals(items).total_ttc,
      validity_days: validityDays,
      customer: dossier
        ? {
            type: "individual",
            first_name: dossier.client_first_name,
            last_name: dossier.client_last_name,
            email: dossier.client_email,
            address: dossier.address,
          }
        : null,
    },
    compProfile,
    insurance,
    settings,
  );

  // Load existing quote
  useEffect(() => {
    if (quoteId && quotes.length > 0) {
      const existing = quotes.find((q) => q.id === quoteId);
      if (existing) {
        setCurrentQuoteId(existing.id);
        setQuoteNumber(existing.quote_number);
        setNotes(existing.notes ?? "");
        setValidityDays(existing.validity_days ?? 30);
        const loadedItems = (existing.items as unknown as QuoteItem[]) ?? [];
        setItems(loadedItems);
      }
    }
  }, [quoteId, quotes]);

  useEffect(() => {
    if (!quoteId && profile?.default_validity_days) {
      setValidityDays(profile.default_validity_days);
    }
  }, [profile, quoteId]);

  // Prefill client + worksite from dossier — n'écrase JAMAIS un champ déjà touché
  const refreshFromDossier = useCallback(() => {
    if (!dossier) return;
    setClient((prev) => ({
      ...prev,
      first_name: touchedFields.has("first_name") ? prev.first_name : dossier.client_first_name,
      last_name: touchedFields.has("last_name") ? prev.last_name : dossier.client_last_name,
      email: touchedFields.has("email") ? prev.email : dossier.client_email,
      phone: touchedFields.has("phone") ? prev.phone : dossier.client_phone,
    }));
    if (!touchedFields.has("worksite")) {
      setWorksiteAddress(dossier.address ?? null);
    }
    toast({ title: "Données rechargées depuis le dossier" });
  }, [dossier, touchedFields, toast]);

  useEffect(() => {
    if (dossier) {
      setClient((prev) => ({
        ...prev,
        first_name: prev.first_name ?? dossier.client_first_name,
        last_name: prev.last_name ?? dossier.client_last_name,
        email: prev.email ?? dossier.client_email,
        phone: prev.phone ?? dossier.client_phone,
      }));
      setWorksiteAddress((prev) => prev ?? dossier.address ?? null);
    }
  }, [dossier]);

  // Wrappers qui marquent les champs comme "touchés"
  const handleClientChange = (next: QuoteClientData) => {
    const changed = new Set(touchedFields);
    (Object.keys(next) as Array<keyof QuoteClientData>).forEach((k) => {
      if (next[k] !== client[k]) changed.add(k as string);
    });
    setTouchedFields(changed);
    setClient(next);
  };

  const handleWorksiteChange = (addr: string | null) => {
    if (addr !== worksiteAddress) {
      setTouchedFields((prev) => new Set(prev).add("worksite"));
    }
    setWorksiteAddress(addr);
  };

  const prefillFields: PrefillField[] = dossier
    ? [
        {
          key: "name",
          label: "Nom",
          value: [client.first_name, client.last_name].filter(Boolean).join(" ") || null,
          modified: touchedFields.has("first_name") || touchedFields.has("last_name"),
        },
        { key: "email", label: "Email", value: client.email, modified: touchedFields.has("email") },
        { key: "phone", label: "Téléphone", value: client.phone, modified: touchedFields.has("phone") },
        {
          key: "worksite",
          label: "Chantier",
          value: worksiteAddress,
          modified: touchedFields.has("worksite"),
        },
      ]
    : [];

  // Auto-save
  const saveDraft = useCallback(async () => {
    if (!user || !dossierId) return;
    setIsSaving(true);
    try {
      const { total_ht, total_tva, total_ttc } = calcTotals(items);
      if (currentQuoteId) {
        await supabase.from("quotes").update({
          items: JSON.parse(JSON.stringify(items)),
          notes: notes || null,
          validity_days: validityDays,
          total_ht, total_tva, total_ttc,
        }).eq("id", currentQuoteId);
      } else {
        const clientName = dossier?.client_last_name || dossier?.client_first_name || null;
        const { data: numData, error: numError } = await supabase.rpc("generate_quote_number", {
          p_user_id: user.id,
          p_client_name: clientName,
        });
        if (numError) throw numError;
        setQuoteNumber(numData as string);

        const { data: newQuote, error: insertError } = await supabase
          .from("quotes")
          .insert([{
            dossier_id: dossierId,
            user_id: user.id,
            quote_number: numData as string,
            is_imported: false,
            status: "brouillon" as const,
            items: JSON.parse(JSON.stringify(items)),
            notes: notes || null,
            validity_days: validityDays,
            total_ht, total_tva, total_ttc,
          }])
          .select().single();
        if (insertError) throw insertError;
        setCurrentQuoteId(newQuote.id);

        await supabase.from("historique").insert({
          dossier_id: dossierId, user_id: user.id,
          action: "quote_created", details: `Devis ${numData} créé`,
        });
      }
    } catch (err: unknown) {
      console.error("Auto-save failed:", err);
    } finally {
      setIsSaving(false);
    }
  }, [user, dossierId, currentQuoteId, items, notes, validityDays]);

  useEffect(() => {
    if (items.length === 0 && !currentQuoteId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveDraft, 2000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [items, notes, validityDays, saveDraft]);

  const handleGeneratePdf = async () => {
    if (!validation.ok) {
      setBlockerAction("générer ce devis");
      setBlockerOpen(true);
      return;
    }
    await saveDraft();
    if (!currentQuoteId) {
      toast({ title: "Ajoutez au moins une ligne", variant: "destructive" });
      return;
    }
    setIsGeneratingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quote-pdf", {
        body: { quote_id: currentQuoteId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.pdf_url) {
        setPreviewPdfUrl(data.pdf_url);
        toast({ title: "PDF généré !" });
      } else {
        throw new Error("Aucune URL PDF reçue");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur";
      console.error("[QuoteEditor] generate-quote-pdf failed:", err);
      toast({ title: "Erreur PDF", description: message, variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSend = async () => {
    if (!validation.ok) {
      setBlockerAction("envoyer ce devis");
      setBlockerOpen(true);
      return;
    }
    await saveDraft();
    if (!currentQuoteId) return;
    setIsSending(true);
    try {
      const { error: pdfError } = await supabase.functions.invoke("generate-quote-pdf", {
        body: { quote_id: currentQuoteId },
      });
      if (pdfError) throw pdfError;
      const { error } = await supabase.functions.invoke("send-quote", {
        body: { quote_id: currentQuoteId },
      });
      if (error) throw error;
      toast({ title: "Devis envoyé au client !" });
      navigate(`/dossier/${dossierId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur";
      toast({ title: "Erreur d'envoi", description: message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  // Assistant callbacks
  const addItemFromAssistant = (item: Omit<QuoteItem, "id">) => {
    setItems(prev => [...prev, { ...item, id: crypto.randomUUID() }]);
  };

  const addItemsFromAssistant = (newItems: Omit<QuoteItem, "id">[]) => {
    const withIds = newItems.map(i => ({ ...i, id: crypto.randomUUID() }));
    setItems(prev => [...prev, ...withIds]);
  };

  // Retire une ligne IA précise du devis (par marqueur ai_ref).
  const removeAiLine = (aiRef: string) => {
    setItems(prev => prev.filter(i => i.ai_ref !== aiRef));
  };

  // Retire toutes les lignes IA du devis (préserve les lignes ajoutées manuellement).
  const removeAllAiLines = () => {
    setItems(prev => prev.filter(i => !i.ai_ref));
  };

  const presentAiRefs = items.map(i => i.ai_ref).filter((r): r is string => !!r);

  const handleSetLabourContext = (_tags: string[], label: string) => {
    setProblemLabel(label);
  };

  if (dossierLoading) {
    return (
      <div className="flex-1 bg-background p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-background gap-4">
        <p className="text-lg font-medium text-foreground">Dossier introuvable</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-background min-h-0">
      <QuoteHeaderBar
        dossier={dossier}
        quoteNumber={quoteNumber}
        isSaving={isSaving}
        isSending={isSending}
        isGeneratingPdf={isGeneratingPdf}
        itemCount={items.length}
        onBack={() => navigate(`/dossier/${dossierId}`)}
        onGeneratePdf={handleGeneratePdf}
        onSend={handleSend}
        onTriggerAi={handleTriggerAi}
        isGeneratingAi={isAiGenerating}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop assistant sidebar — always visible */}
        {!isMobile && (
          <AssistantSidebar
            onAddItem={addItemFromAssistant}
            onAddItems={addItemsFromAssistant}
            onSetLabourContext={handleSetLabourContext}
            dossierId={dossierId!}
            quoteId={currentQuoteId}
            dossierCategory={dossier.category}
            dossierDescription={dossier.description ?? undefined}
            dossierProblemTypes={dossier.problem_types ?? null}
            currentItems={items}
            defaultTab={aiAuto ? "ai" : "smart"}
            autoGenerateAi={aiAuto}
            onRemoveAiLine={removeAiLine}
            onRemoveAllAi={removeAllAiLines}
            presentAiRefs={presentAiRefs}
            aiTriggerKey={aiTriggerKey}
          />
        )}

        {/* Main content — 8 blocs */}
        <main className="flex-1 overflow-y-auto pb-24 md:pb-4">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 space-y-4">
            {/* 0a. Préremplissage depuis dossier */}
            <DossierPrefillBanner
              dossierRef={dossier.id}
              fields={prefillFields}
              onRefresh={refreshFromDossier}
            />

            {/* 0b. Résumé du dossier */}
            <DossierContextSummary
              category={dossier.category}
              urgency={dossier.urgency}
              description={dossier.description}
              notes={null}
              updatedAt={dossier.updated_at}
              mediaCount={medias.length}
            />

            {/* 0c. Intervention détectée */}
            <InterventionDetectedBadge
              contextText={dossierContextText}
              onLoadPack={handleAddPackLines}
            />

            {/* 1. Infos client */}
            <QuoteClientBlock value={client} onChange={handleClientChange} />

            {/* 2. Infos chantier */}
            <QuoteWorksiteBlock
              worksiteAddress={worksiteAddress}
              clientAddress={dossier.address ?? undefined}
              onChange={handleWorksiteChange}
            />

            {/* 3. Infos document */}
            <QuoteDocumentBlock
              quoteNumber={quoteNumber}
              validityDays={validityDays}
              depositType={depositType}
              depositValue={depositValue}
              onValidityChange={setValidityDays}
              onDepositTypeChange={setDepositType}
              onDepositValueChange={setDepositValue}
            />

            {/* 4. Lignes + 5. Totaux (inclus dans QuoteSections) */}
            <QuoteSectionChecklist items={items} />
            <QuoteSections
              items={items}
              setItems={setItems}
              labourSummary={labourSummary}
              onLabourSummaryChange={setLabourSummary}
              problemLabel={problemLabel}
              notes={notes}
              validityDays={validityDays}
              onNotesChange={setNotes}
              onValidityChange={setValidityDays}
              onSaveAsKit={() => setSaveKitOpen(true)}
              vatMode={(profile as any)?.vat_applicable === false ? "no_vat_293b" : "normal"}
              defaultVatRate={(profile as any)?.default_vat_rate ?? 10}
            />

            {/* 6. Checklist conformité */}
            <ComplianceChecklist validation={validation} title="Conformité du devis" />

            {/* 7. Aperçu */}
            <QuotePreviewBlock
              items={items}
              onPreview={handleGeneratePdf}
              isGenerating={isGeneratingPdf}
            />
          </div>
        </main>
      </div>

      {/* Sticky mobile actions */}
      {isMobile && (
        <QuickActionsBar
          isSaving={isSaving}
          isSending={isSending}
          isGeneratingPdf={isGeneratingPdf}
          canSend={items.length > 0}
          onPreview={handleGeneratePdf}
          onSend={handleSend}
        />
      )}

      {/* Mobile assistant (floating button + drawer) */}
      {isMobile && (
        <AssistantSidebar
          onAddItem={addItemFromAssistant}
          onAddItems={addItemsFromAssistant}
          onSetLabourContext={handleSetLabourContext}
          dossierId={dossierId!}
          quoteId={currentQuoteId}
          dossierCategory={dossier.category}
          dossierDescription={dossier.description ?? undefined}
          dossierProblemTypes={dossier.problem_types ?? null}
          currentItems={items}
          defaultTab={aiAuto ? "ai" : "smart"}
          autoGenerateAi={aiAuto}
          onRemoveAiLine={removeAiLine}
          onRemoveAllAi={removeAllAiLines}
          presentAiRefs={presentAiRefs}
          aiTriggerKey={aiTriggerKey}
          openDrawerKey={openAiDrawerKey}
        />
      )}

      <ComplianceBlockerDialog
        open={blockerOpen}
        onOpenChange={setBlockerOpen}
        validation={validation}
        action={blockerAction}
      />

      {/* Floating mic button — voice quote */}
      <button
        onClick={() => setVoiceOpen(true)}
        aria-label="Devis vocal"
        className={cn(
          "fixed z-40 flex items-center justify-center gap-2",
          "h-14 rounded-full shadow-lg",
          "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground",
          "hover:shadow-xl active:scale-95 transition-all",
          "ring-4 ring-primary/15",
          isMobile ? "bottom-24 right-4 w-14" : "bottom-6 right-6 px-5",
        )}
      >
        <Mic className="h-5 w-5" />
        {!isMobile && <span className="text-sm font-medium">Devis vocal</span>}
      </button>

      <VoiceQuoteSheet
        open={voiceOpen}
        onOpenChange={setVoiceOpen}
        quoteId={currentQuoteId}
        items={items}
        onApplyActions={applyVoiceActions}
      />

      <SaveAsKitDialog
        open={saveKitOpen}
        onOpenChange={setSaveKitOpen}
        items={items}
        defaultCategory={dossier?.category}
      />

      <PdfPreviewDialog
        open={!!previewPdfUrl}
        url={previewPdfUrl}
        title={quoteNumber ? `Devis ${quoteNumber}` : "Aperçu du devis"}
        onClose={() => setPreviewPdfUrl(null)}
      />
    </div>
  );
}
