import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, Share2, Link2, Loader2, MessageSquare, Mail, Phone, Pencil, RotateCcw } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

const DEFAULT_MESSAGE_TEMPLATE = `Bonjour,

Afin d'intervenir rapidement, merci de cliquer sur ce lien et de remplir les informations nécessaires.

Si possible, vous pouvez également ajouter des photos ou une vidéo du problème (facultatif).

Je regarderai votre demande et je vous recontacterai rapidement.`;

function generateSlug(firstName: string, lastName: string): string {
  const raw = `${firstName} ${lastName}`
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return raw || "mon-lien";
}

export function PublicLinkCard() {
  const { profile, update } = useProfile();
  const [slug, setSlug] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_MESSAGE_TEMPLATE);
  const [editingMessage, setEditingMessage] = useState(false);
  const [savingMessage, setSavingMessage] = useState(false);

  useEffect(() => {
    if (profile?.public_client_slug) {
      setSlug(profile.public_client_slug);
    } else if (profile) {
      setSlug(generateSlug(profile.first_name || "", profile.last_name || ""));
    }
    if (profile) {
      setMessageTemplate((profile as any).client_message_template || DEFAULT_MESSAGE_TEMPLATE);
    }
  }, [profile]);

  const publicUrl = `https://app.bulbiz.io/${slug}`;
  const clientMessage = `${messageTemplate}\n\n${publicUrl}`;

  async function handleSave() {
    if (!slug.trim()) return;
    const cleanSlug = slug
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!cleanSlug) return;

    setSaving(true);
    try {
      await update.mutateAsync({ public_client_slug: cleanSlug } as any);
      setSlug(cleanSlug);
      toast.success("Lien public sauvegardé");
    } catch (err: any) {
      if (err?.message?.includes("duplicate") || err?.message?.includes("unique")) {
        toast.error("Ce lien est déjà pris, choisissez-en un autre");
      } else {
        toast.error("Erreur lors de la sauvegarde");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMessage() {
    setSavingMessage(true);
    try {
      await update.mutateAsync({ client_message_template: messageTemplate } as any);
      setEditingMessage(false);
      toast.success("Message sauvegardé");
    } catch {
      toast.error("Erreur lors de la sauvegarde du message");
    } finally {
      setSavingMessage(false);
    }
  }

  function handleResetMessage() {
    setMessageTemplate(DEFAULT_MESSAGE_TEMPLATE);
  }

  function handleCopy() {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Lien copié !");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopyMessage() {
    navigator.clipboard.writeText(clientMessage);
    setCopiedMessage(true);
    toast.success("Message copié !");
    setTimeout(() => setCopiedMessage(false), 2000);
  }

  function handleShareEmail() {
    const subject = encodeURIComponent("Envoyez-moi vos photos et infos");
    const body = encodeURIComponent(clientMessage);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  }

  function handleShareSMS() {
    const body = encodeURIComponent(clientMessage);
    window.open(`sms:?body=${body}`, "_blank");
  }

  function handleShareWhatsApp() {
    const text = encodeURIComponent(clientMessage);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  const hasMessageChanged = messageTemplate !== ((profile as any)?.client_message_template || DEFAULT_MESSAGE_TEMPLATE);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Votre lien client Bulbiz
        </CardTitle>
        <CardDescription>
          Quand un client vous appelle, copiez le message ci-dessous et envoyez-le lui par SMS ou WhatsApp.
          Le client remplira les informations nécessaires (photo, description, adresse…).
          Sa demande sera automatiquement créée dans votre application Bulbiz sous forme de dossier.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="slug">Votre lien personnalisé</Label>
          <div className="flex gap-2">
            <div className="flex items-center bg-muted rounded-l-md px-3 text-sm text-muted-foreground border border-r-0">
              app.bulbiz.io/
            </div>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              className="rounded-l-none"
              placeholder="votre-nom"
            />
          </div>
        </div>

        {slug !== profile?.public_client_slug && (
          <Button onClick={handleSave} disabled={saving || !slug.trim()} size="sm" className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Sauvegarde..." : "Sauvegarder le lien"}
          </Button>
        )}

        {profile?.public_client_slug && (
          <>
            {/* Lien */}
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="text-sm font-mono truncate flex-1">{publicUrl}</span>
              <Button variant="ghost" size="icon" onClick={handleCopy} className="flex-shrink-0">
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            {/* Message prêt à envoyer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Message prêt à envoyer</Label>
                <div className="flex gap-1">
                  {!editingMessage ? (
                    <Button variant="ghost" size="sm" onClick={() => setEditingMessage(true)} className="gap-1 h-7 text-xs">
                      <Pencil className="h-3 w-3" />
                      Modifier
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={handleResetMessage} className="gap-1 h-7 text-xs text-muted-foreground">
                      <RotateCcw className="h-3 w-3" />
                      Par défaut
                    </Button>
                  )}
                </div>
              </div>

              {editingMessage ? (
                <div className="space-y-2">
                  <Textarea
                    value={messageTemplate}
                    onChange={(e) => setMessageTemplate(e.target.value)}
                    rows={6}
                    className="text-sm"
                    placeholder="Votre message personnalisé…"
                  />
                  <p className="text-xs text-muted-foreground">
                    Votre lien Bulbiz sera automatiquement ajouté à la fin du message.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveMessage} disabled={savingMessage || !messageTemplate.trim()} className="gap-2">
                      {savingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {savingMessage ? "Sauvegarde..." : "Sauvegarder le message"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setMessageTemplate((profile as any)?.client_message_template || DEFAULT_MESSAGE_TEMPLATE);
                      setEditingMessage(false);
                    }}>
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-line text-foreground">
                  {clientMessage}
                </div>
              )}
            </div>

            {/* Boutons d'action */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleCopy} className="flex-1 gap-2">
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                {copied ? "Lien copié" : "Copier le lien"}
              </Button>
              <Button variant="outline" onClick={handleCopyMessage} className="flex-1 gap-2">
                {copiedMessage ? <Check className="h-4 w-4 text-primary" /> : <MessageSquare className="h-4 w-4" />}
                {copiedMessage ? "Message copié" : "Copier le message"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex-1 gap-2">
                    <Share2 className="h-4 w-4" />
                    Partager
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleShareWhatsApp} className="gap-2">
                    <MessageSquare className="h-4 w-4" />
                    WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleShareSMS} className="gap-2">
                    <Phone className="h-4 w-4" />
                    SMS
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleShareEmail} className="gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <p className="text-xs text-muted-foreground">
              💡 Envoyez toujours le même message : copiez-le et collez-le dans SMS ou WhatsApp quand un client vous appelle.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
