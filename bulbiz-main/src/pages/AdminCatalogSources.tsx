import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useDataSources, useIngestionJobs, useUpsertDataSource, useDeleteDataSource, type DataSource } from "@/hooks/useDataSources";
import { useIngestSource } from "@/hooks/useIngestSource";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Database, Trash2, Edit, Loader2, CheckCircle2, AlertCircle, Play, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-muted text-muted-foreground",
  running: "bg-blue-500/10 text-blue-700",
  paused: "bg-yellow-500/10 text-yellow-700",
  error: "bg-destructive/10 text-destructive",
  completed: "bg-green-500/10 text-green-700",
  failed: "bg-destructive/10 text-destructive",
  pending: "bg-muted text-muted-foreground",
  partial: "bg-orange-500/10 text-orange-700",
};

export default function AdminCatalogSources() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [editing, setEditing] = useState<DataSource | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const { data: sources = [], isLoading } = useDataSources();
  const { data: jobs = [] } = useIngestionJobs();
  const upsert = useUpsertDataSource();
  const del = useDeleteDataSource();
  const ingest = useIngestSource();
  const [reclassifying, setReclassifying] = useState(false);
  const [reclassifyResult, setReclassifyResult] = useState<{
    processed: number;
    ai: number;
    heuristic: number;
  } | null>(null);

  const runReclassify = async () => {
    setReclassifying(true);
    setReclassifyResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("classify-catalog-ai", {
        body: { scope: "bulbiz", force: true, limit: 1000 },
      });
      if (error) throw error;
      setReclassifyResult({
        processed: data?.processed ?? 0,
        ai: data?.ai_classified ?? 0,
        heuristic: data?.heuristic_classified ?? 0,
      });
      toast.success(`${data?.processed ?? 0} articles reclassés`);
    } catch (e: any) {
      toast.error("Reclassement échoué : " + (e?.message ?? "erreur inconnue"));
    } finally {
      setReclassifying(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  if (loading || isAdmin === null) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  const openCreate = () => { setEditing(null); setEditOpen(true); };
  const openEdit = (s: DataSource) => { setEditing(s); setEditOpen(true); };

  return (
    <div className="container max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Sources catalogue BTP</h1>
            <p className="text-xs text-muted-foreground">Pipeline d'ingestion produit (admin)</p>
          </div>
        </div>
        <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1.5" /> Nouvelle source</Button>
      </div>

      {/* Reclassement IA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Reclassement IA de la base matériel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Analyse tous les articles Bulbiz BTP avec l'IA pour leur attribuer un secteur principal,
            des secteurs secondaires (siphon = plomberie + sanitaire + évacuation), une catégorie,
            des tags et synonymes. À lancer après chaque ajout massif au catalogue Bulbiz.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={runReclassify} disabled={reclassifying} size="sm">
              {reclassifying ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Reclassement en cours…</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-1.5" /> Lancer le reclassement IA</>
              )}
            </Button>
            {reclassifyResult && (
              <span className="text-xs text-muted-foreground">
                {reclassifyResult.processed} articles classés
                {reclassifyResult.ai > 0 && ` • ${reclassifyResult.ai} via IA`}
                {reclassifyResult.heuristic > 0 && ` • ${reclassifyResult.heuristic} via heuristique`}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sources */}
      <Card>
        <CardHeader><CardTitle className="text-base">Sources de données ({sources.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : sources.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Aucune source. Crée la première.</p>
          ) : (
            <div className="space-y-2">
              {sources.map((s) => (
                <div key={s.id} className="flex items-start justify-between gap-3 p-3 rounded-md border bg-background">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{s.name}</span>
                      <Badge variant="outline" className="text-[10px]">{s.source_type}</Badge>
                      <Badge className={STATUS_COLORS[s.status] ?? ""}>{s.status}</Badge>
                    </div>
                    {s.base_url && <p className="text-xs text-muted-foreground truncate">{s.base_url}</p>}
                    {s.notes && <p className="text-xs text-muted-foreground mt-1">{s.notes}</p>}
                    {s.last_sync_at && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Dernière sync : {format(new Date(s.last_sync_at), "dd MMM yyyy HH:mm", { locale: fr })}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {(s.source_type === "csv" || s.source_type === "website" || s.source_type === "firecrawl") && s.base_url && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Lancer l'ingestion"
                        disabled={ingest.isPending}
                        onClick={() => ingest.mutate(s.id)}
                      >
                        {ingest.isPending && ingest.variables === s.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Play className="h-3.5 w-3.5 text-primary" />}
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Supprimer "${s.name}" ?`)) del.mutate(s.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Jobs d'ingestion */}
      <Card>
        <CardHeader><CardTitle className="text-base">Jobs d'ingestion récents</CardTitle></CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Aucun job pour le moment.</p>
          ) : (
            <div className="space-y-1.5">
              {jobs.slice(0, 20).map((j) => (
                <div key={j.id} className="flex items-center gap-3 p-2 rounded border text-xs">
                  {j.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                   j.status === "failed" ? <AlertCircle className="h-4 w-4 text-destructive" /> :
                   <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <span className="flex-1">
                    {format(new Date(j.created_at), "dd/MM HH:mm")}
                    {" · "}
                    <Badge className={STATUS_COLORS[j.status] ?? ""}>{j.status}</Badge>
                  </span>
                  <span className="text-muted-foreground">
                    {j.items_created} créés · {j.items_updated} maj · {j.items_flagged} flag
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <SourceEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        source={editing}
        onSave={(payload) => { upsert.mutate(payload, { onSuccess: () => setEditOpen(false) }); }}
      />
    </div>
  );
}

function SourceEditDialog({
  open, onOpenChange, source, onSave,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  source: DataSource | null;
  onSave: (payload: Partial<DataSource> & { id?: string }) => void;
}) {
  const [form, setForm] = useState<Partial<DataSource>>({
    name: "",
    source_type: "manual",
    base_url: "",
    notes: "",
    status: "idle",
  });

  useEffect(() => {
    if (open) {
      setForm(source ? {
        name: source.name,
        source_type: source.source_type,
        base_url: source.base_url ?? "",
        notes: source.notes ?? "",
        status: source.status,
      } : { name: "", source_type: "manual", base_url: "", notes: "", status: "idle" });
    }
  }, [open, source]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{source ? "Modifier la source" : "Nouvelle source"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Nom</label>
            <Input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Catalogue Cedeo" />
          </div>
          <div>
            <label className="text-xs font-medium">Type</label>
            <Select value={form.source_type} onValueChange={(v) => setForm((f) => ({ ...f, source_type: v as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Saisie manuelle</SelectItem>
                <SelectItem value="csv">Import CSV</SelectItem>
                <SelectItem value="website">Site web (scraping)</SelectItem>
                <SelectItem value="firecrawl">Firecrawl</SelectItem>
                <SelectItem value="pdf">PDF catalogue</SelectItem>
                <SelectItem value="supplier_feed">Flux fournisseur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium">URL de base</label>
            <Input value={form.base_url ?? ""} onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))} placeholder="https://..." />
          </div>
          <div>
            <label className="text-xs font-medium">Notes</label>
            <Textarea value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => onSave({ ...form, id: source?.id })} disabled={!form.name?.trim()}>
            {source ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
