import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

interface ErrorLog {
  id: string;
  created_at: string;
  source: string;
  function_name: string | null;
  error_message: string;
  error_stack: string | null;
  user_id: string | null;
  metadata: Record<string, unknown>;
  resolved: boolean;
}

export default function AdminErrors() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [resolvedFilter, setResolvedFilter] = useState<string>("unresolved");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Check admin role
  useEffect(() => {
    if (!user) return;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user]);

  // Fetch errors
  useEffect(() => {
    if (!isAdmin) return;
    fetchErrors();
  }, [isAdmin, sourceFilter, resolvedFilter]);

  async function fetchErrors() {
    setLoading(true);
    let query = supabase
      .from("error_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (sourceFilter !== "all") {
      query = query.eq("source", sourceFilter);
    }
    if (resolvedFilter === "unresolved") {
      query = query.eq("resolved", false);
    } else if (resolvedFilter === "resolved") {
      query = query.eq("resolved", true);
    }

    const { data } = await query;
    setErrors((data as unknown as ErrorLog[]) || []);
    setLoading(false);
  }

  async function toggleResolved(id: string, current: boolean) {
    await supabase
      .from("error_logs")
      .update({ resolved: !current } as Record<string, unknown>)
      .eq("id", id);
    setErrors((prev) =>
      prev.map((e) => (e.id === id ? { ...e, resolved: !current } : e))
    );
  }

  if (authLoading || isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const unresolvedCount = errors.filter((e) => !e.resolved).length;
  const clientCount = errors.filter((e) => e.source === "client").length;
  const edgeCount = errors.filter((e) => e.source === "edge_function").length;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Erreurs système</h1>
        <Button variant="outline" size="sm" onClick={fetchErrors} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Rafraîchir
        </Button>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-foreground">{errors.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Non résolues</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-destructive">{unresolvedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Client</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-foreground">{clientCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Serveur</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-foreground">{edgeCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes sources</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="edge_function">Serveur</SelectItem>
          </SelectContent>
        </Select>
        <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="unresolved">Non résolues</SelectItem>
            <SelectItem value="resolved">Résolues</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : errors.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
          <p>Aucune erreur trouvée 🎉</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Date</TableHead>
                <TableHead className="w-24">Source</TableHead>
                <TableHead className="w-36">Fonction</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.map((err) => (
                <>
                  <TableRow
                    key={err.id}
                    className="cursor-pointer"
                    onClick={() => setExpandedId(expandedId === err.id ? null : err.id)}
                  >
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(err.created_at).toLocaleString("fr-FR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={err.source === "client" ? "secondary" : "destructive"} className="text-xs">
                        {err.source === "client" ? "Client" : "Serveur"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono truncate max-w-[140px]">
                      {err.function_name || "—"}
                    </TableCell>
                    <TableCell className="text-xs truncate max-w-[300px]">
                      <div className="flex items-center gap-1">
                        {err.resolved ? (
                          <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                        )}
                        <span className="truncate">{err.error_message}</span>
                        {expandedId === err.id ? (
                          <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleResolved(err.id, err.resolved);
                        }}
                      >
                        {err.resolved ? "Rouvrir" : "Résolu"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedId === err.id && (
                    <TableRow key={`${err.id}-detail`}>
                      <TableCell colSpan={5} className="bg-muted/50">
                        <div className="space-y-2 text-xs">
                          {err.error_stack && (
                            <div>
                              <p className="font-semibold text-muted-foreground mb-1">Stack trace</p>
                              <pre className="bg-background rounded p-2 overflow-auto max-h-40 text-[10px] font-mono whitespace-pre-wrap">
                                {err.error_stack}
                              </pre>
                            </div>
                          )}
                          {err.metadata && Object.keys(err.metadata).length > 0 && (
                            <div>
                              <p className="font-semibold text-muted-foreground mb-1">Metadata</p>
                              <pre className="bg-background rounded p-2 overflow-auto max-h-40 text-[10px] font-mono whitespace-pre-wrap">
                                {JSON.stringify(err.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                          {err.user_id && (
                            <p className="text-muted-foreground">
                              <span className="font-semibold">User ID:</span> {err.user_id}
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
