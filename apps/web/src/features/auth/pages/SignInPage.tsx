import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";

import { isEmailIdentifier, signInInput } from "@hogaria/shared";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { appUrl, authClient } from "@/lib/authClient";

import { afterSignInPath, meQuery, SESSION_ENDED_MESSAGE } from "../api";
import { parseRetryAfter, SIGN_IN_MESSAGES, signInErrorMessage } from "../auth-errors";
import { AuthLayout, FormError, FormNotice } from "../components/AuthLayout";
import { PasswordInput } from "../components/PasswordInput";

/** `?error=` al volver de Google (spec 01 §7). */
function googleErrorMessage(code: string | null): string | null {
  if (!code) return null;
  if (code === "INVITE_REQUIRED") return "Necesitas una invitación para crear una cuenta.";
  if (code === "ACCOUNT_BLOCKED") return SIGN_IN_MESSAGES.accountBlocked;
  return "No se ha podido entrar con Google. Inténtalo de nuevo.";
}

type FieldErrors = Partial<Record<"identifier" | "password", string>>;

export function SignInPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(googleErrorMessage(params.get("error")));
  const [loading, setLoading] = useState(false);

  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = signInInput.safeParse({ identifier, password });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        errors[key] ??= issue.message;
      }
      setFieldErrors(errors);
      (errors.identifier ? identifierRef : passwordRef).current?.focus();
      return;
    }
    setFieldErrors({});
    setLoading(true);

    let retryAfter: number | null = null;
    const fetchOptions = {
      onError: (ctx: { response: Response }) => {
        retryAfter = parseRetryAfter(ctx.response.headers.get("Retry-After"));
      },
    };
    const { identifier: id, password: pwd } = parsed.data;
    const { error } = isEmailIdentifier(id)
      ? await authClient.signIn.email({ email: id, password: pwd }, fetchOptions)
      : await authClient.signIn.username({ username: id.toLowerCase(), password: pwd }, fetchOptions);
    setLoading(false);

    if (error) {
      setFormError(signInErrorMessage(error.code, retryAfter));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
    void navigate(afterSignInPath(location.search), { replace: true });
  }

  async function signInWithGoogle() {
    const volver = afterSignInPath(location.search);
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: appUrl(volver), errorCallbackURL: appUrl("/entrar") });
    if (error) setFormError(googleErrorMessage("GOOGLE"));
  }

  return (
    <AuthLayout
      title="Entrar"
      intro={
        params.get("cuenta") === "borrada" ? (
          <FormNotice>Tu cuenta se ha borrado. ¡Gracias por usar Hogaria!</FormNotice>
        ) : params.get("sesion") === "cerrada" ? (
          <FormNotice>{SESSION_ENDED_MESSAGE}</FormNotice>
        ) : null
      }
      footer={
        <>
          <p>¿No tienes cuenta? Hogaria funciona solo por invitación: pide a alguien de tu hogar que te envíe un enlace.</p>
          <p className="flex gap-4">
            <Link className="underline" to="/legal/privacidad">
              Privacidad
            </Link>
            <Link className="underline" to="/legal/terminos">
              Términos
            </Link>
          </p>
        </>
      }
    >
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        <div ref={errorRef} tabIndex={-1} className="outline-none">
          <FormError>{formError}</FormError>
        </div>
        <FormField label="Email o nombre de usuario" error={fieldErrors.identifier}>
          <Input
            ref={identifierRef}
            name="identifier"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </FormField>
        <FormField label="Contraseña" error={fieldErrors.password}>
          <PasswordInput ref={passwordRef} name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </FormField>
        <Link to="/recuperar" className="self-start text-[14px] font-medium text-[var(--primary)] underline-offset-2 hover:underline">
          ¿Has olvidado tu contraseña?
        </Link>
        <Button type="submit" loading={loading} className="w-full">
          {loading ? "Entrando…" : "Entrar"}
        </Button>
        <div className="flex items-center gap-3 text-[14px] text-[var(--ink-muted)]" aria-hidden>
          <span className="h-px flex-1 bg-[var(--grout)]" />o<span className="h-px flex-1 bg-[var(--grout)]" />
        </div>
        <Button type="button" variant="secondary" className="w-full" onClick={() => void signInWithGoogle()}>
          Continuar con Google
        </Button>
      </form>
    </AuthLayout>
  );
}
