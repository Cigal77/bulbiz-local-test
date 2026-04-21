import { useLocation, useNavigate } from "react-router-dom";
import { ClipboardList, FolderOpen, Plus, Calendar, Settings, FileText, Receipt, Library } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDossiers, type Dossier } from "@/hooks/useDossiers";
import { useMemo, useState } from "react";
import { isToday, parseISO } from "date-fns";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { DossierPickerSheet } from "@/components/DossierPickerSheet";
import { ImportDevisDialog } from "@/components/dossier/ImportDevisDialog";
import { ImportFactureDialog } from "@/components/dossier/ImportFactureDialog";

function useActionBadges() {
  const { data: dossiers } = useDossiers();
  return useMemo(() => {
    if (!dossiers) return { todo: 0, rdvToday: 0, rdvPending: 0 };
    let todo = 0;
    let rdvToday = 0;
    let rdvPending = 0;
    for (const d of dossiers) {
      // New flow: RDV → Intervention → Devis → Facture
      if (["nouveau", "a_qualifier", "en_attente_rdv"].includes(d.status) && d.appointment_status === "none") todo++;
      if (d.status === "rdv_termine" || d.status === "devis_a_faire") todo++;
      if (d.status === "devis_envoye") todo++;
      if (d.status === "devis_signe") todo++;
      if (d.status === "invoice_pending") todo++;
      if (d.appointment_date && d.appointment_status === "rdv_confirmed" && isToday(parseISO(d.appointment_date))) {
        rdvToday++;
        todo++;
      }
      // Count pending RDVs (slots proposed, client selected, or confirmed upcoming)
      if (["rdv_pending", "slots_proposed", "client_selected"].includes(d.appointment_status as string)) {
        rdvPending++;
        todo++;
      }
    }
    return { todo, rdvToday, rdvPending };
  }, [dossiers]);
}

export function MobileBottomNav() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const badges = useActionBadges();

  // Action sheet state
  const [actionSheetOpen, setActionSheetOpen] = useState(false);

  // Dossier picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [importType, setImportType] = useState<"devis" | "facture" | null>(null);

  // Import dialog state
  const [importDevisOpen, setImportDevisOpen] = useState(false);
  const [importFactureOpen, setImportFactureOpen] = useState(false);
  const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(null);

  if (!isMobile) return null;

  const publicPaths = [
    "/auth",
    "/client",
    "/devis/validation",
    "/facture/view",
    "/reset-password",
    "/cgu",
    "/mentions-legales",
    "/politique-confidentialite",
    "/dpa",
    "/cookies",
  ];
  if (publicPaths.some((p) => location.pathname.startsWith(p))) return null;

  // PublicClientForm sur /:slug — exclure tout chemin hors routes app connues
  const appPaths = ["/", "/a-faire", "/rdv", "/dossier", "/nouveau", "/parametres", "/devis/new", "/facture/new"];
  const isAppPath = appPaths.some((p) => location.pathname === p || location.pathname.startsWith(p + "/"));
  if (!isAppPath) return null;

  const NAV_ITEMS = [
    {
      id: "todo",
      icon: ClipboardList,
      label: "À faire",
      path: "/a-faire",
      badge: badges.todo > 0 ? badges.todo : undefined,
      isActive: location.pathname === "/a-faire",
    },
    {
      id: "dossiers",
      icon: FolderOpen,
      label: "Dossiers",
      path: "/",
      isActive: location.pathname === "/" && !location.search,
    },
    {
      id: "plus",
      icon: Plus,
      label: "Nouveau",
      path: "",
      isAction: true,
      isActive: false,
    },
    {
      id: "rdv",
      icon: Calendar,
      label: "RDV",
      path: "/rdv",
      badge: badges.rdvToday + badges.rdvPending > 0 ? badges.rdvToday + badges.rdvPending : undefined,
      isActive: location.pathname === "/rdv",
    },
    {
      id: "settings",
      icon: Settings,
      label: "Réglages",
      path: "/parametres",
      isActive: location.pathname === "/parametres",
    },
  ];

  const handleNav = (item: (typeof NAV_ITEMS)[number]) => {
    if (item.isAction) {
      setActionSheetOpen(true);
    } else {
      navigate(item.path);
    }
  };

  const handleImportDevis = () => {
    setActionSheetOpen(false);
    setImportType("devis");
    setPickerOpen(true);
  };

  const handleImportFacture = () => {
    setActionSheetOpen(false);
    setImportType("facture");
    setPickerOpen(true);
  };

  const handleNouveauDossier = () => {
    setActionSheetOpen(false);
    navigate("/nouveau");
  };

  const handleOpenLibrary = () => {
    setActionSheetOpen(false);
    navigate("/bibliotheque-materiel");
  };

  const handleDossierSelected = (dossier: Dossier) => {
    setPickerOpen(false);
    setSelectedDossier(dossier);
    if (importType === "devis") {
      setImportDevisOpen(true);
    } else if (importType === "facture") {
      setImportFactureOpen(true);
    }
  };

  const handlePickerCreateNew = () => {
    setPickerOpen(false);
    navigate(importType ? `/nouveau?import=${importType}` : "/nouveau");
  };

  const pickerTitle =
    importType === "devis" ? "Importer un devis — Choisir un dossier" : "Importer une facture — Choisir un dossier";

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNav(item)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-lg transition-colors min-h-[44px] relative",
                item.isAction ? "text-primary-foreground" : item.isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              {item.isAction ? (
                <div className="flex items-center justify-center h-11 w-11 rounded-full bg-primary shadow-lg -mt-5 pointer-events-auto">
                  <item.icon className="h-5 w-5 text-primary-foreground" />
                </div>
              ) : (
                <div className="relative">
                  <item.icon className="h-5 w-5" />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>
              )}
              <span className={cn("text-[10px] font-medium leading-none", item.isAction ? "text-primary mt-0.5" : "")}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Action Sheet - main menu when clicking "+" */}
      <Drawer open={actionSheetOpen} onOpenChange={setActionSheetOpen}>
        <DrawerContent>
          <DrawerHeader className="pb-2">
            <DrawerTitle>Nouveau</DrawerTitle>
            <DrawerDescription>Que souhaitez-vous faire ?</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-2">
            <button
              onClick={handleNouveauDossier}
              className="w-full flex items-center gap-3 p-3.5 rounded-lg hover:bg-accent text-left transition-colors"
            >
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 shrink-0">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-medium text-sm">Nouveau dossier</div>
                <div className="text-xs text-muted-foreground">Créer un dossier client de zéro</div>
              </div>
            </button>

            <button
              onClick={handleImportDevis}
              className="w-full flex items-center gap-3 p-3.5 rounded-lg hover:bg-accent text-left transition-colors"
            >
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-500/10 shrink-0">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-sm">Importer un devis (PDF)</div>
                <div className="text-xs text-muted-foreground">Ajouter un devis à un dossier existant ou nouveau</div>
              </div>
            </button>

            <button
              onClick={handleImportFacture}
              className="w-full flex items-center gap-3 p-3.5 rounded-lg hover:bg-accent text-left transition-colors"
            >
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-orange-500/10 shrink-0">
                <Receipt className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="font-medium text-sm">Importer une facture (PDF)</div>
                <div className="text-xs text-muted-foreground">
                  Ajouter une facture à un dossier existant ou nouveau
                </div>
              </div>
            </button>

            <button
              onClick={handleOpenLibrary}
              className="w-full flex items-center gap-3 p-3.5 rounded-lg hover:bg-accent text-left transition-colors"
            >
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-500/10 shrink-0">
                <Library className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="font-medium text-sm">Bibliothèque matériel</div>
                <div className="text-xs text-muted-foreground">Consulter ou importer mes articles</div>
              </div>
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Dossier picker */}
      <DossierPickerSheet
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setImportType(null);
        }}
        onSelect={handleDossierSelected}
        onCreateNew={handlePickerCreateNew}
        title={pickerTitle}
      />

      {/* Import Devis Dialog */}
      {selectedDossier && (
        <ImportDevisDialog
          open={importDevisOpen}
          onClose={() => {
            setImportDevisOpen(false);
            setSelectedDossier(null);
            setImportType(null);
          }}
          dossierId={selectedDossier.id}
          clientEmail={selectedDossier.client_email}
        />
      )}

      {/* Import Facture Dialog */}
      {selectedDossier && (
        <ImportFactureDialog
          open={importFactureOpen}
          onClose={() => {
            setImportFactureOpen(false);
            setSelectedDossier(null);
            setImportType(null);
          }}
          dossierId={selectedDossier.id}
          clientEmail={selectedDossier.client_email}
        />
      )}
    </>
  );
}
