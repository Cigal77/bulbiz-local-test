import { useNavigate } from "react-router-dom";
import { useComplianceProfile } from "@/hooks/useComplianceProfile";
import { ComplianceScoreRing } from "@/components/compliance/ComplianceScoreRing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Receipt,
  Shield,
  Wallet,
  Hash,
  Palette,
  Users,
  FileText,
  Archive,
} from "lucide-react";
import { getMissingMandatoryFields } from "@/lib/compliance-engine";

const SECTIONS = [
  { id: "identity", label: "Identité légale", icon: Building2, codes: ["legal_form", "siret", "company_name", "address", "email", "capital", "rcs_city"] },
  { id: "vat", label: "Régime TVA", icon: Receipt, codes: ["tva_intracom"] },
  { id: "insurance", label: "Assurance décennale", icon: Shield, codes: ["insurer", "policy"] },
  { id: "payment", label: "Paiement & règlement", icon: Wallet, codes: ["iban", "payment_terms"] },
  { id: "numbering", label: "Numérotation", icon: Hash, codes: [] },
  { id: "branding", label: "Identité visuelle PDF", icon: Palette, codes: [] },
  { id: "customers", label: "Clients pro", icon: Users, codes: [] },
  { id: "efacture", label: "Préparation e-facturation", icon: FileText, codes: [] },
  { id: "archive", label: "Archivage", icon: Archive, codes: [] },
];

export default function ComplianceSettings() {
  const navigate = useNavigate();
  const { profile, insurance, settings, isLoading, score } = useComplianceProfile();

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const missing = getMissingMandatoryFields(profile, insurance, settings);

  const sectionStatus = (codes: string[]) => {
    const sectionMissing = missing.filter((m) => codes.includes(m.code));
    return sectionMissing.length === 0 ? "ok" : "warn";
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/parametres")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Documents & conformité</h1>
          <p className="text-sm text-muted-foreground">Tout ce qu'il faut pour des devis et factures conformes.</p>
        </div>
      </div>

      {/* Score */}
      <Card>
        <CardContent className="pt-6 flex flex-col sm:flex-row items-center gap-6">
          <ComplianceScoreRing score={score} label="conforme" />
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-lg font-semibold mb-1">
              {score >= 90 ? "Vous êtes prêt à facturer 🎉" : score >= 60 ? "Presque prêt" : "Configuration à compléter"}
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              {missing.length === 0
                ? "Toutes vos mentions obligatoires sont configurées."
                : `${missing.length} information${missing.length > 1 ? "s" : ""} obligatoire${missing.length > 1 ? "s" : ""} restante${missing.length > 1 ? "s" : ""}.`}
            </p>
            {!profile?.onboarding_compliance_completed_at ? (
              <Button onClick={() => navigate("/onboarding/conformite")}>
                Lancer l'onboarding guidé
              </Button>
            ) : missing.length > 0 ? (
              <Button variant="outline" onClick={() => navigate("/onboarding/conformite")}>
                Reprendre l'onboarding
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SECTIONS.map((s) => {
          const status = sectionStatus(s.codes);
          const Icon = s.icon;
          return (
            <Card
              key={s.id}
              id={s.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => navigate("/onboarding/conformite")}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{s.label}</CardTitle>
                  </div>
                  {status === "ok" ? (
                    <Badge variant="outline" className="border-success text-success">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Conforme
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-warning text-warning">
                      <AlertTriangle className="h-3 w-3 mr-1" /> À compléter
                    </Badge>
                  )}
                </div>
              </CardHeader>
              {status !== "ok" && (
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  {missing
                    .filter((m) => s.codes.includes(m.code))
                    .map((m) => m.message)
                    .join(" · ")}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
