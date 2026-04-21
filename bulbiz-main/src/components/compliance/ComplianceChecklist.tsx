import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertCircle, AlertTriangle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ValidationResult } from "@/lib/compliance-engine";

interface ComplianceChecklistProps {
  validation: ValidationResult;
  title?: string;
}

export function ComplianceChecklist({
  validation,
  title = "Conformité du document",
}: ComplianceChecklistProps) {
  const navigate = useNavigate();
  const hasBlockers = validation.blockers.length > 0;
  const hasWarnings = validation.warnings.length > 0;

  return (
    <Card className="border-l-4" style={{ borderLeftColor: hasBlockers ? "hsl(var(--destructive))" : hasWarnings ? "hsl(var(--warning, 38 92% 50%))" : "hsl(var(--success, 142 71% 45%))" }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {validation.ok ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <AlertCircle className="h-5 w-5 text-destructive" />
            )}
            {title}
          </CardTitle>
          <Badge variant={validation.ok ? "default" : "destructive"}>
            {validation.ok ? "Prêt" : `${validation.blockers.length} à corriger`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {validation.ok && !hasWarnings && (
          <p className="text-sm text-muted-foreground">
            Toutes les mentions obligatoires sont prêtes. Vous pouvez générer et envoyer le document.
          </p>
        )}

        {validation.blockers.map((b) => (
          <div
            key={b.code}
            className="flex items-start gap-2 text-sm p-2 rounded-md bg-destructive/5"
          >
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <span className="flex-1">{b.message}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => navigate(`/parametres/conformite#${b.section}`)}
            >
              Corriger <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        ))}

        {validation.warnings.map((w) => (
          <div
            key={w.code}
            className="flex items-start gap-2 text-sm p-2 rounded-md bg-warning/5"
          >
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <span className="flex-1 text-muted-foreground">{w.message}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
