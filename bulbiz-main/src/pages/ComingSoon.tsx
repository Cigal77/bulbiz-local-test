import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload } from "lucide-react";

const ComingSoon = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dossierId = searchParams.get("dossier");
  const isDevis = location.pathname.includes("devis");

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="mx-auto max-w-md text-center space-y-6">
        <span className="text-6xl">⏳</span>
        <h1 className="text-2xl font-bold text-foreground">
          Cette fonctionnalité arrive bientôt
        </h1>
        <p className="text-muted-foreground">
          Si vous êtes intéressé, contactez-nous au
        </p>
        <a href="tel:+33761397163" className="block font-semibold text-primary hover:underline text-lg">
          +33 7 61 39 71 63
        </a>

        <div className="flex flex-col gap-3 pt-2">
          {dossierId && (
            <Button
              onClick={() =>
                navigate(`/dossier/${dossierId}?import=${isDevis ? "devis" : "facture"}`)
              }
            >
              <Upload className="h-4 w-4" />
              Importer un {isDevis ? "devis" : "facture"} PDF
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate(-1 as any)}>
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ComingSoon;
