import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { dossierSchema, defaultDossierValues, type DossierFormData } from "@/lib/dossier-schema";
import { CATEGORY_LABELS, URGENCY_LABELS } from "@/lib/constants";
import { AddressAutocomplete, type AddressData } from "@/components/AddressAutocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ArrowLeft, PenLine, Loader2 } from "lucide-react";
import { BulbizLogo } from "@/components/BulbizLogo";
import type { Database } from "@/integrations/supabase/types";

type DossierSource = Database["public"]["Enums"]["dossier_source"];
type ProblemCategory = Database["public"]["Enums"]["problem_category"];
type UrgencyLevel = Database["public"]["Enums"]["urgency_level"];

const CATEGORIES: ProblemCategory[] = ["wc", "fuite", "chauffe_eau", "evier", "douche", "autre"];
const URGENCIES: UrgencyLevel[] = ["aujourdhui", "48h", "semaine"];

export default function CreateDossier() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const importType = searchParams.get("import");

  const form = useForm<DossierFormData>({
    resolver: zodResolver(dossierSchema),
    defaultValues: defaultDossierValues,
  });

  const handleAddressSelect = useCallback((data: AddressData) => {
    form.setValue("address", data.address);
    form.setValue("address_line", data.address_line || "");
    form.setValue("postal_code", data.postal_code || "");
    form.setValue("city", data.city || "");
    form.setValue("country", data.country || "");
    form.setValue("google_place_id", data.google_place_id || "");
    if (data.lat) form.setValue("lat", data.lat);
    if (data.lng) form.setValue("lng", data.lng);
  }, [form]);

  const createMutation = useMutation({
    mutationFn: async ({ data }: { data: DossierFormData }) => {
      const hasMinimalInfo = !!(data.client_first_name && data.client_phone && data.address);
      const initialStatus = hasMinimalInfo ? "nouveau" : "a_qualifier";

      const source: DossierSource = "manuel";

      const { data: dossier, error } = await supabase
        .from("dossiers")
        .insert({
          user_id: user!.id,
          client_first_name: data.client_first_name || null,
          client_last_name: data.client_last_name || null,
          client_phone: data.client_phone || null,
          client_email: data.client_email || null,
          address: data.address || null,
          address_line: data.address_line || null,
          postal_code: data.postal_code || null,
          city: data.city || null,
          country: data.country || null,
          google_place_id: data.google_place_id || null,
          lat: data.lat || null,
          lng: data.lng || null,
          category: data.category,
          urgency: data.urgency,
          description: data.description || null,
          source,
          status: initialStatus,
        })
        .select("id")
        .single();

      if (error) throw error;

      await supabase.from("historique").insert({
        dossier_id: dossier.id,
        user_id: user!.id,
        action: "created",
        details: `Dossier créé (création manuelle)${!hasMinimalInfo ? " – informations partielles" : ""}`,
      });

      return dossier;
    },
    onSuccess: async (dossier) => {
      queryClient.invalidateQueries({ queryKey: ["dossiers"] });

      const autoSend = (profile as any)?.auto_send_client_link !== false; // default true
      if (autoSend) {
        try {
          const { data } = await supabase.functions.invoke("send-client-link", {
            body: { dossier_id: dossier.id },
          });

          const parts: string[] = ["Dossier créé ✅"];
          if (data?.token_generated) parts.push("Lien client généré ✅");
          if (data?.email_sent) parts.push("Lien envoyé par email ✅");
          if (data?.sms_sent) parts.push("Lien envoyé par SMS ✅");
          if (data?.no_contact) parts.push("Coordonnées manquantes ⚠️");
          if (data?.email_error) parts.push("Erreur envoi email");
          if (data?.sms_error) parts.push("Erreur envoi SMS");

          toast({ title: "Dossier créé", description: parts.join(" • ") });
        } catch {
          toast({ title: "Dossier créé !", description: "Erreur lors de l'envoi automatique du lien client." });
        }
      } else {
        toast({ title: "Dossier créé !" });
      }

      navigate(importType ? `/dossier/${dossier.id}?import=${importType}` : `/dossier/${dossier.id}`);
    },
    onError: (e: Error) => {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: DossierFormData) => {
    createMutation.mutate({ data });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-4 sm:px-6 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <BulbizLogo size={20} />
        <span className="font-semibold text-foreground ml-2">Nouveau dossier</span>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-6">
          <PenLine className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Création manuelle</span>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</h3>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="client_first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prénom <span className="text-muted-foreground font-normal">(optionnel)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Jean" autoComplete="given-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="client_last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom <span className="text-muted-foreground font-normal">(optionnel)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Dupont" autoComplete="family-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="client_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone <span className="text-muted-foreground font-normal">(optionnel)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="06 12 34 56 78" type="tel" autoComplete="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="client_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email <span className="text-muted-foreground font-normal">(optionnel)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="client@email.com" type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Intervention</h3>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse <span className="text-muted-foreground font-normal">(optionnel)</span></FormLabel>
                    <FormControl>
                      <AddressAutocomplete
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onAddressSelect={handleAddressSelect}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="postal_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code postal</FormLabel>
                      <FormControl>
                        <Input placeholder="75001" autoComplete="postal-code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ville</FormLabel>
                      <FormControl>
                        <Input placeholder="Paris" autoComplete="address-level2" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description <span className="text-muted-foreground font-normal">(optionnel)</span></FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Décrivez le problème du client…"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Création…
                </>
              ) : (
                "Créer le dossier"
              )}
            </Button>
          </form>
        </Form>
      </main>
    </div>
  );
}