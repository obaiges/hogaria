import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { emailSchema, passwordSchema } from "@hogaria/shared";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { appUrl, authClient } from "@/lib/authClient";

import { parseRetryAfter, rateLimitedMessage } from "../auth-errors";
import { AuthLayout, FormError } from "../components/AuthLayout";
import { PasswordInput } from "../components/PasswordInput";

export const RESET_REQUESTED_MESSAGE = "Si existe una cuenta con ese email, te hemos enviado un enlace. Caduca en 30 minutos.";

/** `/recuperar`: pedir enlace o, con `?token`, poner la nueva contraseña (spec 01 §7). */
export function RecoverPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  if (params.get("error") === "INVALID_TOKEN") return <InvalidLink />;
  return token ? <NewPasswordForm token={token} /> : <RequestLinkForm />;
}

function RequestLinkForm() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      emailRef.current?.focus();
      return;
    }
    setFieldError(undefined);
    setFormError(null);
    setLoading(true);
    let retryAfter: number | null = null;
    const { error } = await authClient.requestPasswordReset(
      { email: parsed.data, redirectTo: appUrl("/recuperar") },
      { onError: (ctx: { response: Response }) => void (retryAfter = parseRetryAfter(ctx.response.headers.get("Retry-After"))) },
    );
    setLoading(false);
    // Siempre el mismo mensaje, exista o no la cuenta (RN-01-16), salvo el límite de peticiones.
    if (error?.code === "RATE_LIMITED") {
      setFormError(rateLimitedMessage(retryAfter));
      return;
    }
    setSent(true);
  }

  return (
    <AuthLayout
      title="Recuperar contraseña"
      footer={
        <Link to="/entrar" className="font-medium text-[var(--primary)] underline">
          Volver a entrar
        </Link>
      }
    >
      {sent ? (
        <p role="status" className="text-[16px]">
          {RESET_REQUESTED_MESSAGE}
        </p>
      ) : (
        <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
          <FormError>{formError}</FormError>
          <FormField label="Email" error={fieldError}>
            <Input ref={emailRef} name="email" type="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          <Button type="submit" loading={loading} className="w-full">
            Enviar enlace
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

function NewPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<{ password?: string; repeat?: string }>({});
  const [invalid, setInvalid] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const repeatRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (errors.password) passwordRef.current?.focus();
    else if (errors.repeat) repeatRef.current?.focus();
  }, [errors]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    let next: typeof errors = {};
    if (!parsed.success) next.password = parsed.error.issues[0]?.message;
    else {
      const { checkPasswordPolicy } = await import("@hogaria/shared/common-passwords");
      const policy = checkPasswordPolicy(password);
      if (policy) next.password = policy;
    }
    if (!next.password && repeat !== password) next.repeat = "Las contraseñas no coinciden";
    if (next.password || next.repeat) {
      setErrors(next);
      return;
    }
    setErrors({});
    setLoading(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);
    if (!error) {
      setDone(true);
      return;
    }
    if (error.code === "VALIDATION_ERROR") {
      next = { password: error.message ?? "Revisa la contraseña" };
      setErrors(next);
    } else setInvalid(true);
  }

  if (invalid) return <InvalidLink />;

  return (
    <AuthLayout title="Nueva contraseña">
      {done ? (
        <>
          <p role="status" className="text-[16px]">
            Contraseña cambiada. Ya puedes entrar.
          </p>
          <Button className="w-full" onClick={() => void navigate("/entrar")}>
            Entrar
          </Button>
        </>
      ) : (
        <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
          <FormField label="Nueva contraseña" hint="Mínimo 10 caracteres" error={errors.password}>
            <PasswordInput ref={passwordRef} name="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormField>
          <FormField label="Repite la contraseña" error={errors.repeat}>
            <PasswordInput ref={repeatRef} name="repeat" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </FormField>
          <Button type="submit" loading={loading} className="w-full">
            Guardar contraseña
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

function InvalidLink() {
  const navigate = useNavigate();
  return (
    <AuthLayout title="Recuperar contraseña">
      <ErrorState message="El enlace no es válido o ha caducado." />
      <Button variant="secondary" className="w-full" onClick={() => void navigate("/recuperar")}>
        Pedir otro enlace
      </Button>
    </AuthLayout>
  );
}
