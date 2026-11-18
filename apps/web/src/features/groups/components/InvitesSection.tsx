import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError, OfflineError } from "@/lib/apiClient";

import { useCreateInvite, useInvites, useRevokeInvite } from "../api";
import { inviteRippleKey } from "../realtime";
import { InviteLinkSheet } from "./InviteLinkSheet";
import { RippleItem } from "./RippleItem";

import type { CreatedGroupInviteDto, GroupInviteDto } from "@hogaria/shared";

export const INVITES_TEXT = {
  invite: "Invitar a alguien",
  pending: "Pendientes",
  empty: "No hay invitaciones pendientes",
  previous: "Anteriores (30 días)",
  revoke: "Revocar",
  revokeTitle: "¿Revocar esta invitación?",
  revokeBody: "El enlace dejará de funcionar.",
  revoked: "Invitación revocada",
  loadError: "No se han podido cargar las invitaciones",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** "caduca en 7 días" / "caduca mañana" / "caduca hoy". */
export function expiresIn(expiresAt: string, now: Date = new Date()): string {
  const days = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / DAY_MS));
  if (days === 0) return "caduca hoy";
  if (days === 1) return "caduca mañana";
  return `caduca en ${days} días`;
}

/** Línea de una invitación no activa: "Usada por Luis", "Revocada" o "Caducada". */
export function pastInviteLabel(invite: GroupInviteDto): string {
  if (invite.status === "USED") return `Usada por ${invite.usedByName ?? "Usuario eliminado"}`;
  if (invite.status === "REVOKED") return "Revocada";
  return "Caducada";
}

export interface InvitesSectionProps {
  groupId: string;
  groupName: string;
  myName: string;
  timezone: string;
}

/** "INVITACIONES" de los ajustes del grupo (spec 02 §7, RN-02-10 a RN-02-15). */
export function InvitesSection({ groupId, groupName, myName, timezone }: InvitesSectionProps) {
  const { toast } = useToast();
  const invites = useInvites(groupId);
  const create = useCreateInvite(groupId);
  const revoke = useRevokeInvite(groupId);
  const [created, setCreated] = useState<CreatedGroupInviteDto | null>(null);
  const [toRevoke, setToRevoke] = useState<GroupInviteDto | null>(null);

  const showError = (error: Error, fallback: string) => {
    if (error instanceof OfflineError) return; // el apiClient ya ha avisado
    toast(error instanceof ApiError ? (error.detail ?? error.message) : fallback);
  };

  function invite() {
    create.mutate(undefined, {
      onSuccess: (result) => setCreated(result),
      onError: (error) => showError(error, "No se ha podido crear la invitación. Inténtalo de nuevo"),
    });
  }

  function confirmRevoke() {
    if (!toRevoke) return;
    revoke.mutate(toRevoke.id, {
      onSuccess: () => {
        setToRevoke(null);
        toast(INVITES_TEXT.revoked);
      },
      onError: (error) => {
        setToRevoke(null);
        showError(error, "No se ha podido revocar la invitación. Inténtalo de nuevo");
      },
    });
  }

  const pending = invites.data?.filter((i) => i.status === "ACTIVE") ?? [];
  const previous = invites.data?.filter((i) => i.status !== "ACTIVE") ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Button requiresConnection loading={create.isPending} onClick={invite}>
        {INVITES_TEXT.invite}
      </Button>

      {invites.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando invitaciones">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : invites.isError ? (
        <ErrorState message={INVITES_TEXT.loadError} onRetry={() => void invites.refetch()} />
      ) : (
        <>
          <div>
            <h3 className="mb-1 text-[14px] font-semibold text-[var(--ink)]">{INVITES_TEXT.pending}</h3>
            {pending.length === 0 ? (
              <p className="py-2 text-[14px] text-[var(--ink-muted)]">{INVITES_TEXT.empty}</p>
            ) : (
              <ul className="divide-y divide-[var(--grout)]">
                {pending.map((i) => (
                  <RippleItem key={i.id} rippleKey={inviteRippleKey(i.id)} className="flex min-h-[48px] items-center justify-between gap-3 py-1">
                    <span className="text-[14px] text-[var(--ink)]">
                      Creada por {i.createdByName ?? "Usuario eliminado"} · {expiresIn(i.expiresAt)}
                    </span>
                    <Button variant="ghost" requiresConnection onClick={() => setToRevoke(i)}>
                      {INVITES_TEXT.revoke}
                    </Button>
                  </RippleItem>
                ))}
              </ul>
            )}
          </div>

          {previous.length > 0 ? (
            <details className="group">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[14px] font-semibold text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" strokeWidth={1.75} aria-hidden />
                {INVITES_TEXT.previous}
              </summary>
              <ul className="divide-y divide-[var(--grout)]">
                {previous.map((i) => (
                  <RippleItem key={i.id} rippleKey={inviteRippleKey(i.id)} className="py-2 text-[14px] text-[var(--ink-muted)]">
                    {pastInviteLabel(i)}
                  </RippleItem>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}

      {created ? (
        <InviteLinkSheet
          open
          onOpenChange={(open) => (open ? undefined : setCreated(null))}
          url={created.url}
          expiresAt={created.invite.expiresAt}
          groupName={groupName}
          myName={myName}
          timezone={timezone}
        />
      ) : null}

      <Dialog open={toRevoke !== null} onOpenChange={(open) => (open ? undefined : setToRevoke(null))}>
        <DialogContent title={INVITES_TEXT.revokeTitle} description={INVITES_TEXT.revokeBody}>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button variant="danger" requiresConnection loading={revoke.isPending} onClick={confirmRevoke}>
              {INVITES_TEXT.revoke}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
