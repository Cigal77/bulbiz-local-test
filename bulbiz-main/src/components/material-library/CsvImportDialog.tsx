import { useState, useRef } from "react";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";
import { useCatalogImport, autoDetectMapping, TARGET_FIELDS, type CsvImportResult } from "@/hooks/useCatalogImport";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Step = "upload" | "mapping" | "preview" | "importing" | "report";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CsvImportDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dedup, setDedup] = useState<"skip" | "update" | "duplicate">("skip");
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const importMut = useCatalogImport();
  const qc = useQueryClient();

  const reset = () => {
    setStep("upload");
    setFilename("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setDedup("skip");
    setResult(null);
  };

  const handleFile = (file: File) => {
    setFilename(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (!res.data.length) {
          toast.error("Fichier vide");
          return;
        }
        const hs = res.meta.fields ?? [];
        setHeaders(hs);
        setRows(res.data as Record<string, any>[]);
        setMapping(autoDetectMapping(hs));
        setStep("mapping");
      },
      error: (e) => toast.error("Lecture impossible : " + e.message),
    });
  };

  const runImport = async () => {
    setStep("importing");
    try {
      const r = await importMut.mutateAsync({ filename, rows, mapping, dedup_strategy: dedup });
      setResult(r);
      setStep("report");
      qc.invalidateQueries({ queryKey: ["material-library"] });
      qc.invalidateQueries({ queryKey: ["catalog-import-jobs"] });
    } catch {
      setStep("preview");
    }
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 300);
  };

  const labelMapped = !!Object.values(mapping).find((v) => v === "label");

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer mon matériel</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed rounded-lg p-10 text-center hover:bg-muted/50 transition-colors"
            >
              <UploadCloud className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="font-medium">Cliquez pour choisir un fichier CSV</p>
              <p className="text-xs text-muted-foreground mt-1">Format CSV uniquement, 5000 lignes max</p>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-2">
              <div>
                <p className="font-medium text-foreground mb-1">Astuce</p>
                <p>La 1ère ligne doit contenir les noms des colonnes (ex: nom, prix, tva, fournisseur). Le mapping sera détecté automatiquement.</p>
              </div>
              <a
                href="/exemple-catalogue.csv"
                download
                className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Télécharger un exemple CSV
              </a>
            </div>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm bg-muted/50 rounded p-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="font-medium">{filename}</span>
              <span className="text-muted-foreground">— {rows.length} lignes</span>
            </div>
            <p className="text-sm text-muted-foreground">Associez chaque colonne CSV à un champ Bulbiz.</p>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {headers.map((h) => (
                <div key={h} className="grid grid-cols-2 gap-2 items-center">
                  <div className="text-sm truncate">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{h}</code>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      ex: {String(rows[0]?.[h] ?? "").slice(0, 40)}
                    </p>
                  </div>
                  <Select
                    value={mapping[h] ?? "__ignore"}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v === "__ignore" ? "" : v }))}
                  >
                    <SelectTrigger className="h-8"><SelectValue placeholder="Ignorer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ignore">— Ignorer cette colonne —</SelectItem>
                      {TARGET_FIELDS.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}{(f as any).required ? " *" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {!labelMapped && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Le champ "Nom de l'article" doit être mappé.
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("upload")}>Retour</Button>
              <Button onClick={() => setStep("preview")} disabled={!labelMapped}>Aperçu</Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Aperçu des 5 premières lignes après mapping :</p>
            <div className="rounded border overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    {Object.entries(mapping).filter(([_, v]) => v).map(([_, field]) => (
                      <th key={field} className="text-left p-2 font-medium">
                        {TARGET_FIELDS.find((f) => f.key === field)?.label ?? field}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t">
                      {Object.entries(mapping).filter(([_, v]) => v).map(([col, field]) => (
                        <td key={field} className="p-2 truncate max-w-[150px]">{String(r[col] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 rounded border p-3">
              <Label className="text-sm">En cas de doublon (même code interne ou même nom)</Label>
              <RadioGroup value={dedup} onValueChange={(v: any) => setDedup(v)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="skip" id="r-skip" />
                  <Label htmlFor="r-skip" className="text-sm font-normal cursor-pointer">Ignorer (laisser l'existant)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="update" id="r-update" />
                  <Label htmlFor="r-update" className="text-sm font-normal cursor-pointer">Mettre à jour avec les nouvelles données</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="duplicate" id="r-dup" />
                  <Label htmlFor="r-dup" className="text-sm font-normal cursor-pointer">Créer en double (déconseillé)</Label>
                </div>
              </RadioGroup>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("mapping")}>Retour</Button>
              <Button onClick={runImport}>Importer {rows.length} lignes</Button>
            </DialogFooter>
          </div>
        )}

        {step === "importing" && (
          <div className="py-10 text-center space-y-3">
            <Progress value={66} />
            <p className="text-sm font-medium">Import en cours…</p>
            <p className="text-xs text-muted-foreground">Ne ferme pas cette fenêtre.</p>
          </div>
        )}

        {step === "report" && result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md bg-primary/10 p-3">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <p className="font-medium text-sm">Import terminé</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-sm">
              <div className="rounded border p-2"><div className="text-2xl font-bold text-primary">{result.created}</div><div className="text-xs text-muted-foreground">créés</div></div>
              <div className="rounded border p-2"><div className="text-2xl font-bold text-foreground">{result.updated}</div><div className="text-xs text-muted-foreground">mis à jour</div></div>
              <div className="rounded border p-2"><div className="text-2xl font-bold text-muted-foreground">{result.skipped}</div><div className="text-xs text-muted-foreground">ignorés</div></div>
              <div className="rounded border p-2"><div className="text-2xl font-bold text-destructive">{result.errors}</div><div className="text-xs text-muted-foreground">erreurs</div></div>
            </div>
            {result.error_details?.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Voir les {result.error_details.length} erreurs</summary>
                <div className="mt-2 max-h-40 overflow-y-auto space-y-1 rounded border p-2 bg-muted/30">
                  {result.error_details.slice(0, 50).map((e, i) => (
                    <div key={i}>Ligne {e.row}: {e.message}</div>
                  ))}
                </div>
              </details>
            )}
            <DialogFooter>
              <Button onClick={close}>Terminer</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
