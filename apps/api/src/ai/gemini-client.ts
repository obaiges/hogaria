import type { z } from 'zod';

export const GEMINI_CLIENT = Symbol('GEMINI_CLIENT');

export type AiFeatureName = 'FRIDGE_DETECT' | 'FRIDGE_RECIPES' | 'CHAT' | 'RECEIPT';

export interface AiImage {
  mimeType: string;
  data: Buffer;
}

export interface GenerateStructuredInput<T> {
  feature: AiFeatureName;
  prompt: string;
  /** Valida la salida del modelo. */
  schema: z.ZodType<T>;
  /** JSON Schema que se envía a Gemini como `responseSchema`. */
  responseSchema?: Record<string, unknown>;
  images?: AiImage[];
  signal?: AbortSignal;
}

export interface GenerateStructuredResult<T> {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Cliente de Gemini (solo en el backend). En test: `FakeGeminiClient` con fixtures;
 * el real llega en HOG-650 y `streamChat` en HOG-705.
 */
export interface GeminiClient {
  generateStructured<T>(input: GenerateStructuredInput<T>): Promise<GenerateStructuredResult<T>>;
}
