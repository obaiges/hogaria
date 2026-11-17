import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().url().optional(),
  API_URL: z.string().url().optional(),
  COOKIE_DOMAIN: z.string().optional().default(''),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL es obligatoria'),
  LOG_LEVEL: z.string().optional().default('info'),

  BETTER_AUTH_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  SIGNUP_REQUIRES_INVITE: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  AI_LIMIT_FRIDGE_DETECT: z.coerce.number().int().optional(),
  AI_LIMIT_FRIDGE_RECIPES: z.coerce.number().int().optional(),
  AI_LIMIT_CHAT: z.coerce.number().int().optional(),
  AI_LIMIT_RECEIPT: z.coerce.number().int().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
});

const refinedEnvSchema = envSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production' && (env.BETTER_AUTH_SECRET ?? '').length < 32) {
    ctx.addIssue({ code: 'custom', path: ['BETTER_AUTH_SECRET'], message: 'obligatoria en producción (mínimo 32 caracteres: openssl rand -base64 32)' });
  }
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = refinedEnvSchema.safeParse(config);
  if (!result.success) {
    const messages = result.error.issues.map((i) => `${i.path.join('.') || 'env'}: ${i.message}`);
    throw new Error(`Configuración de entorno inválida:\n${messages.join('\n')}`);
  }
  return result.data;
}
