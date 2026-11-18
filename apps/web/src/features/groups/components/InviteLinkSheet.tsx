import { useRef } from "react";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Sheet, SheetContent } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

export const INVITE_LINK_TEXT = {
  title: "Enlace de invitación",
  share: "Compartir enlace",
  copy: "Copiar enlace",
  copied: "Enlace copiado",
  notice: (date: string) => `Este enlace solo se muestra ahora. Sirve para una persona y caduca el ${date}.`,
} as const;

export interface InviteLinkSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  expiresAt: string;
  groupName: string;
  myName: string;
  timezone: string;
}

/** "12 de noviembre" en la zona del hogar. */
export function formatInviteExpiry(expiresAt: string, timezone: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: timezone }).format(new Date(expiresAt));
}

/**
 * `Sheet` "Enlace de invitación" (spec 02 §7, RN-02-11): el enlace solo se ve ahora.
 * "Compartir enlace" solo si existe `navigator.share` (cancelar no es un error); "Copiar enlace"
 * con `navigator.clipboard` y, si no se puede, selecciona el texto del campo.
 */
export function InviteLinkSheet({ open, onOpenChange, url, expiresAt, groupName, myName, timezone }: InviteLinkSheetProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  function selectField() {
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  async function share() {
    try {
      await navigator.share({
        title: `Únete a ${groupName} en Hogaria`,
        text: `${myName} te invita a ${groupName} en Hogaria`,
        url,
      });
    } catch {
      // El usuario ha cancelado (AbortError) o el sistema no ha podido: no es un error que mostrar.
    }
  }

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error("Sin portapapeles");
      await navigator.clipboard.writeText(url);
      toast(INVITE_LINK_TEXT.copied);
    } catch {
      selectField();
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={INVITE_LINK_TEXT.title} className="pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-4">
          <FormField label="Enlace">
            <Input ref={inputRef} value={url} readOnly onFocus={(e) => e.currentTarget.select()} className="font-mono text-[14px]" />
          </FormField>
          <p className="text-[14px] text-[var(--ink-muted)]">{INVITE_LINK_TEXT.notice(formatInviteExpiry(expiresAt, timezone))}</p>
          <div className="flex flex-col gap-2">
            {canShare ? <Button onClick={() => void share()}>{INVITE_LINK_TEXT.share}</Button> : null}
            <Button variant={canShare ? "secondary" : "primary"} onClick={() => void copy()}>
              {INVITE_LINK_TEXT.copy}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
