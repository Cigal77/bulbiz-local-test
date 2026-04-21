import { useNavigate, useLocation } from "react-router-dom";
import { ClipboardList, FolderOpen, Plus, Calendar, Settings, LogOut, Library, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useDossiers } from "@/hooks/useDossiers";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useMemo } from "react";
import { isToday, parseISO } from "date-fns";
import { BulbizLogo } from "@/components/BulbizLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function useDesktopBadges() {
  const { data: dossiers } = useDossiers();
  return useMemo(() => {
    if (!dossiers) return { todo: 0, rdv: 0 };
    let todo = 0;
    let rdv = 0;
    for (const d of dossiers) {
      if (["nouveau", "a_qualifier", "en_attente_rdv"].includes(d.status) && d.appointment_status === "none") todo++;
      if (d.status === "rdv_termine" || d.status === "devis_a_faire") todo++;
      if (d.status === "devis_envoye") todo++;
      if (d.status === "devis_signe") todo++;
      if (d.status === "invoice_pending") todo++;
      if (d.appointment_date && d.appointment_status === "rdv_confirmed" && isToday(parseISO(d.appointment_date))) {
        rdv++;
        todo++;
      }
      if (["rdv_pending", "slots_proposed", "client_selected"].includes(d.appointment_status as string)) {
        rdv++;
        todo++;
      }
    }
    return { todo, rdv };
  }, [dossiers]);
}

const NAV_ITEMS = [
  { id: "todo", icon: ClipboardList, label: "À faire", path: "/a-faire" },
  { id: "dossiers", icon: FolderOpen, label: "Dossiers", path: "/" },
  { id: "rdv", icon: Calendar, label: "Rendez-vous", path: "/rdv" },
  { id: "biblio", icon: Library, label: "Matériel", path: "/bibliotheque-materiel" },
  { id: "settings", icon: Settings, label: "Paramètres", path: "/parametres" },
];

export function DesktopSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const badges = useDesktopBadges();
  const isAdmin = useIsAdmin();

  const navItems = useMemo(() => {
    const base = [...NAV_ITEMS];
    if (isAdmin) {
      base.push({ id: "admin-catalog", icon: Database, label: "Catalogue", path: "/admin/catalogue/sources" });
    }
    return base;
  }, [isAdmin]);

  const badgeMap: Record<string, number> = {
    todo: badges.todo,
    rdv: badges.rdv,
  };

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r bg-sidebar h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4">
        <BulbizLogo size={24} />
      </div>

      <Separator />

      {/* New dossier CTA */}
      <div className="px-3 py-3">
        <Button className="w-full gap-2" size="sm" onClick={() => navigate("/nouveau")}>
          <Plus className="h-4 w-4" />
          Nouveau dossier
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.path === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.path);
          const badge = badgeMap[item.id] || 0;

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {badge > 0 && (
                <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 space-y-2">
        <Separator />
        <div className="flex items-center justify-between px-1 pt-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground"
            title="Déconnexion"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-sidebar-foreground/40 px-1 truncate">{user?.email}</p>
      </div>
    </aside>
  );
}
