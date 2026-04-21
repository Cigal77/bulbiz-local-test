import { useState } from "react";
import type { Dossier } from "@/hooks/useDossier";
import { useDossierActions } from "@/hooks/useDossierActions";
import { useToast } from "@/hooks/use-toast";
import { Phone, Mail, User, Pencil, X, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateEmail, EMAIL_VALIDATION_ERROR } from "@/lib/email-validation";
interface ClientBlockProps {
  dossier: Dossier;
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s.\-()]/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return "+33" + cleaned.slice(1);
  }
  return cleaned;
}

export function ClientBlock({ dossier }: ClientBlockProps) {
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(dossier.client_first_name ?? "");
  const [lastName, setLastName] = useState(dossier.client_last_name ?? "");
  const [phone, setPhone] = useState(dossier.client_phone ?? "");
  const [email, setEmail] = useState(dossier.client_email ?? "");
  const [emailError, setEmailError] = useState("");

  const { updateDossier } = useDossierActions(dossier.id);
  const { toast } = useToast();

  const startEdit = () => {
    setFirstName(dossier.client_first_name ?? "");
    setLastName(dossier.client_last_name ?? "");
    setPhone(dossier.client_phone ?? "");
    setEmail(dossier.client_email ?? "");
    setEmailError("");
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setEmailError("");
  };

  const save = async () => {
    if (email && !validateEmail(email)) {
      setEmailError(EMAIL_VALIDATION_ERROR);
      return;
    }

    const normalizedPhone = phone ? normalizePhone(phone) : null;
    const changedFields: string[] = [];

    if ((firstName || null) !== (dossier.client_first_name || null) ||
        (lastName || null) !== (dossier.client_last_name || null)) {
      changedFields.push("Nom client mis à jour");
    }
    if (normalizedPhone !== (dossier.client_phone || null)) {
      changedFields.push("Téléphone mis à jour");
    }
    if ((email || null) !== (dossier.client_email || null)) {
      changedFields.push("Email mis à jour");
    }

    if (changedFields.length === 0) {
      setEditing(false);
      return;
    }

    try {
      await updateDossier.mutateAsync({
        updates: {
          client_first_name: firstName || null,
          client_last_name: lastName || null,
          client_phone: normalizedPhone,
          client_email: email || null,
        },
        changedFields,
      });
      toast({ title: "Informations client mises à jour" });
      setEditing(false);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const hasNoContact = !dossier.client_phone && !dossier.client_email;

  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client — Édition</h3>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancel} disabled={updateDossier.isPending}>
              <X className="h-4 w-4" />
            </Button>
            <Button variant="default" size="icon" className="h-7 w-7" onClick={save} disabled={updateDossier.isPending}>
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Prénom</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nom</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Téléphone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" type="tel" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <Input
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
            placeholder="client@email.com"
            type="email"
            className={emailError ? "border-destructive" : ""}
          />
          {emailError && <p className="text-xs text-destructive">{emailError}</p>}
        </div>

        <Button className="w-full" onClick={save} disabled={updateDossier.isPending}>
          {updateDossier.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</h3>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={startEdit}>
          <Pencil className="h-3 w-3" />
          Modifier
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-foreground">
            {dossier.client_first_name || dossier.client_last_name
              ? `${dossier.client_first_name ?? ""} ${dossier.client_last_name ?? ""}`.trim()
              : <span className="text-muted-foreground italic">Non renseigné</span>}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {dossier.client_phone ? (
          <a href={`tel:${dossier.client_phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline font-medium">
            <Phone className="h-4 w-4" />
            {dossier.client_phone}
          </a>
        ) : (
          <button onClick={startEdit} className="flex items-center gap-2 text-sm text-muted-foreground italic hover:text-primary cursor-pointer">
            <Phone className="h-4 w-4" />
            Ajouter un téléphone
          </button>
        )}
        {dossier.client_email ? (
          <a href={`mailto:${dossier.client_email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <Mail className="h-4 w-4" />
            {dossier.client_email}
          </a>
        ) : (
          <button onClick={startEdit} className="flex items-center gap-2 text-sm text-muted-foreground italic hover:text-primary cursor-pointer">
            <Mail className="h-4 w-4" />
            Ajouter un email
          </button>
        )}
      </div>
      {hasNoContact && (
        <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-2.5 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Ajoutez email ou téléphone pour envoyer le lien client / devis / RDV.
        </div>
      )}
    </div>
  );
}
