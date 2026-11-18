import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";

import { formatRelative, type SessionDto } from "@hogaria/shared";

import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { authClient } from "@/lib/authClient";
import { useOnlineStatus } from "@/lib/useOnlineStatus";

import { sessionsQueryKey, useSessions } from "../api";

export const SECURITY_TEXT = {
  heading: "Seguridad",
  devices: "Dispositivos",
  thisDevice: "Este dispositivo",
  closeSession: "Cerrar sesión",
  closeOthers: "Cerrar sesión en todos los demás",
  closeOthersConfirm: "¿Cerrar la sesión en todos los demás dispositivos?",
  closeOthersDescription: "Tendrás que volver a entrar en ellos.",
  signOut: "Cerrar sesión",
  sessionClosed: "Sesión cerrada",
  othersClosed: "Has cerrado las demás sesiones",
  loadError: "No se han podido cargar tus dispositivos",
  actionError: "No se ha podido cerrar la sesión. Inténtalo de nuevo",
  offline: "Sin conexión: no puedes cerrar sesiones ahora.",
} as const;

const confirmSession = (label: string) => `¿Cerrar la sesión en ${label}?`;

/** Perfil → Seguridad (spec 01 §7): dispositivos con sesión abierta y cierre de sesión. */
export function SecuritySection() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const online = useOnlineStatus();
  const sessions = useSessions();

  const [target, setTarget] = useState<SessionDto | null>(null);
  const [confirmOthers, setConfirmOthers] = useState(false);
  const [pending, setPending] = useState<"one" | "others" | "signout" | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: sessionsQueryKey });

  async function revokeOne(session: SessionDto) {
    setPending("one");
    const { error } = await authClient.revokeSession({ token: session.token });
    setPending(null);
    setTarget(null);
    if (error) return toast(SECURITY_TEXT.actionError);
    toast(SECURITY_TEXT.sessionClosed);
    await refresh();
  }

  async function revokeOthers() {
    setPending("others");
    const { error } = await authClient.revokeOtherSessions();
    setPending(null);
    setConfirmOthers(false);
    if (error) return toast(SECURITY_TEXT.actionError);
    toast(SECURITY_TEXT.othersClosed);
    await refresh();
  }

  async function signOut() {
    setPending("signout");
    const { error } = await authClient.signOut();
    setPending(null);
    if (error) return toast(SECURITY_TEXT.actionError);
    // Al salir de las rutas privadas, el RealtimeProvider se desmonta y destruye el socket.
    queryClient.clear();
    await navigate("/entrar", { replace: true });
  }

  const list = sessions.data ?? [];
  const hasOthers = list.some((s) => !s.isCurrent);

  return (
    <section id="seguridad" aria-labelledby="seguridad-title" className="flex flex-col gap-3">
      <h2 id="seguridad-title" className="font-[family-name:var(--font-sign)] text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]">
        {SECURITY_TEXT.heading}
      </h2>

      <div className="rounded-[var(--radius-md)] border border-[var(--grout)] bg-[var(--surface)]">
        <h3 className="px-4 pt-4 text-[16px] font-semibold text-[var(--ink)]">{SECURITY_TEXT.devices}</h3>

        {sessions.isPending ? (
          <ul aria-busy="true" aria-label={SECURITY_TEXT.devices} className="flex flex-col gap-3 p-4">
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <Skeleton className="h-12 w-full" />
              </li>
            ))}
          </ul>
        ) : sessions.isError ? (
          <div className="p-4">
            <ErrorState message={SECURITY_TEXT.loadError} onRetry={() => void sessions.refetch()} />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--grout)]">
            {list.map((session) => (
              <li key={session.id} className="flex min-h-[64px] items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[16px] text-[var(--ink)]">
                    <span className="truncate">{session.deviceLabel}</span>
                    {session.isCurrent ? (
                      <span className="inline-flex h-6 items-center rounded-[var(--radius-xs)] bg-[var(--primary-soft)] px-2 text-[12px] font-medium text-[var(--on-primary-soft)]">
                        {SECURITY_TEXT.thisDevice}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[14px] text-[var(--ink-muted)]">Última actividad {formatRelative(session.updatedAt)}</p>
                </div>
                {session.isCurrent ? null : (
                  <Button
                    variant="ghost"
                    className="shrink-0"
                    disabled={!online || pending !== null}
                    onClick={() => setTarget(session)}
                    aria-label={`${SECURITY_TEXT.closeSession} en ${session.deviceLabel}`}
                  >
                    {SECURITY_TEXT.closeSession}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="p-4 pt-2">
          <Button variant="secondary" className="w-full" disabled={!online || !hasOthers || pending !== null} onClick={() => setConfirmOthers(true)}>
            {SECURITY_TEXT.closeOthers}
          </Button>
        </div>
      </div>

      {!online ? <p className="text-[14px] text-[var(--ink-muted)]">{SECURITY_TEXT.offline}</p> : null}

      <Button variant="danger" className="w-full" disabled={!online} loading={pending === "signout"} onClick={() => void signOut()}>
        {SECURITY_TEXT.signOut}
      </Button>

      <Dialog open={target !== null} onOpenChange={(open) => (open ? null : setTarget(null))}>
        {target ? (
          <DialogContent title={confirmSession(target.deviceLabel)}>
            <div className="flex flex-col gap-2">
              <Button variant="danger" loading={pending === "one"} onClick={() => void revokeOne(target)}>
                {SECURITY_TEXT.closeSession}
              </Button>
              <DialogClose asChild>
                <Button variant="secondary">Cancelar</Button>
              </DialogClose>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={confirmOthers} onOpenChange={setConfirmOthers}>
        <DialogContent title={SECURITY_TEXT.closeOthersConfirm} description={SECURITY_TEXT.closeOthersDescription}>
          <div className="flex flex-col gap-2">
            <Button variant="danger" loading={pending === "others"} onClick={() => void revokeOthers()}>
              {SECURITY_TEXT.closeOthers}
            </Button>
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
