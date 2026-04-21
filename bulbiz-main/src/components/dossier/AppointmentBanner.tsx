import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Dossier } from "@/hooks/useDossier";
import type { AppointmentStatus } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Clock, Phone, MapPin, Navigation, AlertTriangle, Send } from "lucide-react";

interface AppointmentBannerProps {
  dossier: Dossier;
  onNavigateToAppointment?: () => void;
}

export function AppointmentBanner({ dossier, onNavigateToAppointment }: AppointmentBannerProps) {
  const status = ((dossier as any).appointment_status || "none") as AppointmentStatus;

  if (status === "none" || status === "done" || status === "cancelled") return null;

  const appointmentDate = (dossier as any).appointment_date as string | null;
  const timeStart = (dossier as any).appointment_time_start as string | null;
  const timeEnd = (dossier as any).appointment_time_end as string | null;

  // Confirmed RDV - prominent banner
  if (status === "rdv_confirmed" && appointmentDate) {
    const dateStr = format(new Date(appointmentDate), "EEEE d MMMM yyyy", { locale: fr });
    const timeStr = timeStart && timeEnd ? `${timeStart.slice(0, 5)} à ${timeEnd.slice(0, 5)}` : "";

    const address = dossier.address;
    const lat = (dossier as any).lat;
    const lng = (dossier as any).lng;
    const hasCoords = lat && lng;

    return (
      <div className="rounded-xl bg-success/10 border border-success/20 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Calendar className="h-5 w-5 text-success shrink-0 mt-0.5" />
          <div>
            <p className="text-base font-semibold text-foreground capitalize">
              Rendez-vous : {dateStr}
            </p>
            {timeStr && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="h-3.5 w-3.5" />
                {timeStr}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {hasCoords && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                asChild
              >
                <a
                  href={`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Waze
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                asChild
              >
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Google Maps
                </a>
              </Button>
            </>
          )}
          {!hasCoords && address && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                asChild
              >
                <a
                  href={`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Waze
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                asChild
              >
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Google Maps
                </a>
              </Button>
            </>
          )}
          {dossier.client_phone && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              asChild
            >
              <a href={`tel:${dossier.client_phone}`}>
                <Phone className="h-3.5 w-3.5" />
                Appeler le client
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Pending statuses - action banner
  const bannerConfig: Partial<Record<AppointmentStatus, { label: string; cta: string; icon: React.ReactNode; bgClass: string; borderClass: string }>> = {
    rdv_pending: {
      label: "Rendez-vous : en attente de créneaux",
      cta: "Proposer des créneaux",
      icon: <AlertTriangle className="h-5 w-5 text-warning" />,
      bgClass: "bg-warning/10",
      borderClass: "border-warning/20",
    },
    slots_proposed: {
      label: "Rendez-vous : créneaux envoyés, en attente du client",
      cta: "Renvoyer le lien",
      icon: <Send className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
      bgClass: "bg-blue-50 dark:bg-blue-900/10",
      borderClass: "border-blue-200 dark:border-blue-800/30",
    },
    client_selected: {
      label: "Rendez-vous : le client a choisi un créneau",
      cta: "Confirmer le RDV",
      icon: <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />,
      bgClass: "bg-orange-50 dark:bg-orange-900/10",
      borderClass: "border-orange-200 dark:border-orange-800/30",
    },
  };

  const config = bannerConfig[status];
  if (!config) return null;

  return (
    <div className={cn("rounded-xl border p-4 flex items-center justify-between gap-3", config.bgClass, config.borderClass)}>
      <div className="flex items-center gap-3">
        {config.icon}
        <p className="text-sm font-medium text-foreground">{config.label}</p>
      </div>
      {onNavigateToAppointment && (
        <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={onNavigateToAppointment}>
          {config.cta}
        </Button>
      )}
    </div>
  );
}
