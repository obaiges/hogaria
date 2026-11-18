import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { MAX_GROUP_MEMBERS, type PublicInviteDto } from "@hogaria/shared";

import logoDark from "@/assets/logo-horizontal-dark.svg";
import logo from "@/assets/logo-horizontal.svg";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useMe } from "@/features/auth/api";
import { PENDING_INVITE_KEY } from "@/features/auth/pending-invite";
import { ApiError, OfflineError } from "@/lib/apiClient";
import { appUrl, authClient } from "@/lib/authClient";

import { useAcceptInvite, usePublicInvite } from "../api";

export const INVITE_TEXT = {
  invitedBy: (name: string | null) => (name ? `${name} te invita a unirte a` : "Te invitan a unirte a"),
  expires: (date: string) => `La invitación caduca el ${date}.`,
  createAccount: "Crear cuenta",
  google: "Continuar con Google",
  haveAccount: "Ya tengo cuenta",
  join: (groupName: string) => `Unirme a ${groupName}`,
  joined: (groupName: string) => `Te has unido a ${groupName}`,
  alreadyMember: (groupName: string) => `Ya formas parte de ${groupName}`,
  invalid: "Invitación no válida o caducada",
  invalidHint: "Pide a alguien del hogar que te envíe un enlace nuevo.",
  goHome: "Ir a Hogaria",
  full: `Este hogar ya tiene el máximo de ${MAX_GROUP_MEMBERS} miembros`,
  loadError: "No se ha podido cargar la invitación",
} as const;

/** `sessionStorage['hogaria:pendingInvite']`: el registro muestra el hogar al que se une (spec 01 §7). */
export function savePendingInvite(token: string, invite: PublicInviteDto): void {
  try {
    sessionStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({ token, groupName: invite.groupName, groupEmoji: invite.groupEmoji }));
  } catch {
    // Sin almacenamiento (modo privado): el registro sigue funcionando con la cookie `hogaria_invite`.
  }
}

/** "21 de noviembre". */
function longDate(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "Europe/Madrid" }).format(new Date(iso));
}

const isStatus = (error: unknown, status: number) => error instanceof ApiError && error.status === status;

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="sticky top-0 z-30">
        <OfflineBanner />
      </div>
      <main id="contenido" className="px-4 pb-10 pt-10">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
          <div className="flex justify-center">
            <img src={logo} alt="Hogaria" className="logo-light h-10 w-auto" />
            <img src={logoDark} alt="Hogaria" className="logo-dark h-10 w-auto" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * `/invite/:token` (spec 02 §7, pública): estados válida sin sesión, válida con sesión, ya
 * miembro, no válida (`410`) y hogar lleno (`409`).
 */
export function InvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const me = useMe();
  const invite = usePublicInvite(token);
  const accept = useAcceptInvite(token);
  const [gone, setGone] = useState(false);
  const [full, setFull] = useState(false);
  const redirected = useRef(false);

  // Ya miembro al cargar (con sesión, o al volver de Google con una cuenta nueva): directo al hogar.
  const data = invite.data;
  useEffect(() => {
    if (!data?.alreadyMember || !data.groupId || redirected.current) return;
    redirected.current = true;
    toast(INVITE_TEXT.alreadyMember(data.groupName));
    void navigate(`/g/${data.groupId}`, { replace: true });
  }, [data, navigate, toast]);

  function join() {
    if (!data) return;
    setFull(false);
    accept.mutate(undefined, {
      onSuccess: (result) => {
        toast(result.alreadyMember ? INVITE_TEXT.alreadyMember(data.groupName) : INVITE_TEXT.joined(data.groupName));
        void navigate(`/g/${result.groupId}`, { replace: true });
      },
      onError: (error) => {
        if (error instanceof OfflineError) return; // el apiClient ya ha avisado
        if (isStatus(error, 410)) setGone(true);
        else if (isStatus(error, 409)) setFull(true);
        else toast(error instanceof ApiError ? (error.detail ?? error.message) : "No se ha podido aceptar la invitación. Inténtalo de nuevo");
      },
    });
  }

  if (gone || isStatus(invite.error, 410) || isStatus(invite.error, 404)) {
    return (
      <Screen>
        <ErrorState message={INVITE_TEXT.invalid} />
        <p className="text-center text-[16px] text-[var(--ink-muted)]">{INVITE_TEXT.invalidHint}</p>
        <Button variant="secondary" onClick={() => void navigate("/")}>
          {INVITE_TEXT.goHome}
        </Button>
      </Screen>
    );
  }

  if (invite.isError) {
    return (
      <Screen>
        <ErrorState message={INVITE_TEXT.loadError} onRetry={() => void invite.refetch()} />
      </Screen>
    );
  }

  if (!data || me.isPending || data.alreadyMember) {
    return (
      <Screen>
        <div aria-busy="true" aria-label="Cargando invitación" className="flex flex-col gap-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </Screen>
    );
  }

  const signedIn = Boolean(me.data);
  const volver = `/invite/${token}`;

  return (
    <Screen>
      <div className="flex flex-col gap-2 text-center">
        <p className="text-[16px] text-[var(--ink-muted)]">{INVITE_TEXT.invitedBy(data.invitedByName)}</p>
        <h1 className="font-sign text-[32px] font-semibold uppercase leading-tight tracking-[0.04em]">
          <span aria-hidden>{data.groupEmoji}</span> {data.groupName}
        </h1>
        <p className="text-[14px] text-[var(--ink-muted)]">{INVITE_TEXT.expires(longDate(data.expiresAt))}</p>
      </div>

      {full ? (
        <p role="alert" className="rounded-[var(--radius-sm)] border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-[14px] text-[var(--danger)]">
          {INVITE_TEXT.full}
        </p>
      ) : null}

      {signedIn ? (
        <Button requiresConnection loading={accept.isPending} onClick={join} className="w-full">
          {INVITE_TEXT.join(data.groupName)}
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <Button
            requiresConnection
            className="w-full"
            onClick={() => {
              savePendingInvite(token, data);
              void navigate("/registro");
            }}
          >
            {INVITE_TEXT.createAccount}
          </Button>
          <Button
            variant="secondary"
            requiresConnection
            className="w-full"
            onClick={() =>
              void authClient.signIn.social({ provider: "google", callbackURL: appUrl(volver), errorCallbackURL: appUrl(volver) })
            }
          >
            {INVITE_TEXT.google}
          </Button>
          <Link
            to={`/entrar?volver=${encodeURIComponent(volver)}`}
            onClick={() => savePendingInvite(token, data)}
            className="self-center text-[16px] font-semibold text-[var(--primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            {INVITE_TEXT.haveAccount}
          </Link>
        </div>
      )}
    </Screen>
  );
}
