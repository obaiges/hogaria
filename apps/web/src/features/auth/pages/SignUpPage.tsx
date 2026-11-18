import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";

import { signUpInput } from "@hogaria/shared";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { appUrl, authClient } from "@/lib/authClient";

import { parseRetryAfter, rateLimitedMessage } from "../auth-errors";
import { AuthLayout, FormError, FormNotice } from "../components/AuthLayout";
import { PasswordInput } from "../components/PasswordInput";
import { PENDING_INVITE_KEY } from "../pending-invite";

export { PENDING_INVITE_KEY };
export const RESEND_COOLDOWN_S = 60;

interface PendingInvite {
  token: string;
  groupName: string;
  groupEmoji: string;
}

function readPendingInvite(): PendingInvite | null {
  try {
    const raw = sessionStorage.getItem(PENDING_INVITE_KEY);
    const value = raw ? (JSON.parse(raw) as Partial<PendingInvite>) : null;
    return value?.token && value.groupName ? { token: value.token, groupName: value.groupName, groupEmoji: value.groupEmoji ?? "🏠" } : null;
  } catch {
    return null;
  }
}

type Field = "name" | "email" | "username" | "password" | "repeat";
type FieldErrors = Partial<Record<Field, string>>;
const FIELD_ORDER: Field[] = ["name", "email", "username", "password", "repeat"];

export function SignUpPage() {
  const [invite] = useState(readPendingInvite);
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<Field, string>>({ name: "", email: "", username: "", password: "", repeat: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  /** `INVITE_REQUIRED` con una invitación pendiente: la cookie de 1 h caducó (spec 01 §10). */
  const [inviteExpired, setInviteExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const repeatRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  const set = (field: Field) => (event: { target: { value: string } }) => setValues((v) => ({ ...v, [field]: event.target.value }));

  function showFieldErrors(errors: FieldErrors) {
    setFieldErrors(errors);
    const first = FIELD_ORDER.find((f) => errors[f]);
    if (!first) return;
    const refs = { name: nameRef, email: emailRef, username: usernameRef, password: passwordRef, repeat: repeatRef };
    refs[first].current?.focus();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setInviteExpired(false);
    setEmailTaken(false);

    const { repeat, ...input } = values;
    const errors: FieldErrors = {};
    const parsed = signUpInput.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors[issue.path[0] as Field] ??= issue.message;
    }
    if (!errors.password && repeat !== values.password) errors.repeat = "Las contraseñas no coinciden";
    if (!errors.password && parsed.success) {
      // La lista de contraseñas comunes se carga solo aquí (no entra en el bundle principal).
      const { checkPasswordPolicy } = await import("@hogaria/shared/common-passwords");
      const policy = checkPasswordPolicy(values.password, { email: parsed.data.email, username: parsed.data.username });
      if (policy) errors.password = policy;
    }
    if (Object.keys(errors).length || !parsed.success) {
      showFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setLoading(true);

    let retryAfter: number | null = null;
    const { error } = await authClient.signUp.email(
      { ...parsed.data, callbackURL: appUrl("/") },
      { onError: (ctx: { response: Response }) => void (retryAfter = parseRetryAfter(ctx.response.headers.get("Retry-After"))) },
    );
    setLoading(false);

    if (!error) {
      try {
        sessionStorage.removeItem(PENDING_INVITE_KEY);
      } catch {
        // sin sessionStorage no hay nada que borrar
      }
      setSentTo(parsed.data.email);
      return;
    }
    switch (error.code) {
      case "INVITE_REQUIRED":
        setInviteExpired(invite !== null);
        setFormError("Necesitas una invitación para registrarte. Pide a alguien de tu hogar que te envíe un enlace.");
        break;
      case "USER_ALREADY_EXISTS":
      case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
        setEmailTaken(true);
        setFormError("Ese email ya tiene cuenta.");
        break;
      case "USERNAME_IS_ALREADY_TAKEN":
        showFieldErrors({ username: "Ese nombre de usuario ya existe" });
        break;
      case "RATE_LIMITED":
        setFormError(rateLimitedMessage(retryAfter));
        break;
      default:
        setFormError(error.message ?? "No se ha podido crear la cuenta. Inténtalo de nuevo.");
    }
  }

  if (sentTo) return <CheckYourEmail email={sentTo} />;

  return (
    <AuthLayout
      title="Crear cuenta"
      intro={
        invite ? (
          <p className="text-[16px]">
            Crea tu cuenta para unirte a {invite.groupEmoji} {invite.groupName}
          </p>
        ) : (
          <FormNotice>Hogaria es solo por invitación. Si te han invitado, abre el enlace que te enviaron.</FormNotice>
        )
      }
      footer={
        <p>
          ¿Ya tienes cuenta?{" "}
          <Link to="/entrar" className="font-medium text-[var(--primary)] underline">
            Entrar
          </Link>
        </p>
      }
    >
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        <div ref={errorRef} tabIndex={-1} className="outline-none">
          {formError ? (
            <FormError>
              {formError}
              {emailTaken ? (
                <>
                  {" "}
                  <Link to="/entrar" className="underline">
                    ¿Quieres entrar?
                  </Link>
                </>
              ) : null}
            </FormError>
          ) : null}
          {formError && inviteExpired && invite ? (
            <div className="mt-3 flex flex-col gap-2">
              <FormNotice>Tu invitación ha caducado en este navegador. Vuelve a abrir el enlace.</FormNotice>
              <Button type="button" variant="secondary" onClick={() => void navigate(`/invite/${encodeURIComponent(invite.token)}`)}>
                Abrir la invitación
              </Button>
            </div>
          ) : null}
        </div>
        <FormField label="Nombre" hint="Así te verán en el hogar" error={fieldErrors.name}>
          <Input ref={nameRef} name="name" autoComplete="name" value={values.name} onChange={set("name")} />
        </FormField>
        <FormField label="Email" error={fieldErrors.email}>
          <Input ref={emailRef} name="email" type="email" autoComplete="email" autoCapitalize="none" value={values.email} onChange={set("email")} />
        </FormField>
        <FormField label="Nombre de usuario" hint="Solo minúsculas, números, punto y guion bajo" error={fieldErrors.username}>
          <Input
            ref={usernameRef}
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={values.username}
            onChange={set("username")}
          />
        </FormField>
        <FormField label="Contraseña" hint="Mínimo 10 caracteres" error={fieldErrors.password}>
          <PasswordInput ref={passwordRef} name="password" autoComplete="new-password" value={values.password} onChange={set("password")} />
        </FormField>
        <FormField label="Repite la contraseña" error={fieldErrors.repeat}>
          <PasswordInput ref={repeatRef} name="repeat" autoComplete="new-password" value={values.repeat} onChange={set("repeat")} />
        </FormField>
        <Button type="submit" loading={loading} className="w-full">
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => void authClient.signIn.social({ provider: "google", callbackURL: appUrl("/"), errorCallbackURL: appUrl("/entrar") })}
        >
          Continuar con Google
        </Button>
      </form>
    </AuthLayout>
  );
}

/** Estado "Revisa tu email" con reenvío limitado a uno cada 60 s (RN-01-14). */
function CheckYourEmail({ email }: { email: string }) {
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function resend() {
    setCooldown(RESEND_COOLDOWN_S);
    let retryAfter: number | null = null;
    const { error } = await authClient.sendVerificationEmail(
      { email, callbackURL: appUrl("/") },
      { onError: (ctx: { response: Response }) => void (retryAfter = parseRetryAfter(ctx.response.headers.get("Retry-After"))) },
    );
    setMessage(error ? (error.code === "RATE_LIMITED" ? rateLimitedMessage(retryAfter) : "No se ha podido reenviar. Inténtalo más tarde.") : "Te hemos enviado otro enlace.");
  }

  return (
    <AuthLayout title="Revisa tu email">
      <p className="text-[16px]">Te hemos enviado un enlace a {email}. Ábrelo para activar tu cuenta.</p>
      {message ? <p role="status" className="text-[14px] text-[var(--ink-muted)]">{message}</p> : null}
      <Button variant="secondary" className="w-full" disabled={cooldown > 0} onClick={() => void resend()}>
        {cooldown > 0 ? `Reenviar en ${cooldown} s` : "Reenviar email"}
      </Button>
      <Link to="/entrar" className="text-center font-medium text-[var(--primary)] underline">
        Volver a entrar
      </Link>
    </AuthLayout>
  );
}
