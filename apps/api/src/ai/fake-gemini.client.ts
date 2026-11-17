import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { AiFeatureName, GeminiClient, GenerateStructuredInput, GenerateStructuredResult } from './gemini-client.js';

/** Formato de `test/fixtures/ai/*.json`. */
export interface AiFixture {
  data: unknown;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface GeminiCall {
  feature: AiFeatureName;
  prompt: string;
  imageCount: number;
  fixture: string;
}

/** `test/fixtures/ai` relativo a `apps/api`, que es el cwd de los tests y del arranque. */
export const DEFAULT_AI_FIXTURES_DIR = resolve(process.cwd(), 'test/fixtures/ai');

export const FAKE_GEMINI_MODEL = 'fake-gemini';

/** `FRIDGE_DETECT` → `fridge-detect.ok` (fixture por defecto de cada función). */
export function defaultFixtureName(feature: AiFeatureName): string {
  return `${feature.toLowerCase().replace(/_/g, '-')}.ok`;
}

/**
 * Nunca llama a Gemini: devuelve fixtures por nombre y valida `data` con el `schema`
 * de la llamada, igual que hará el cliente real.
 * - `useFixture(feature, name)`: fija el fixture de una función (por defecto `<feature>.ok`).
 * - `failNext(error)`: la próxima llamada lanza `error` (timeout, 503…).
 */
export class FakeGeminiClient implements GeminiClient {
  readonly calls: GeminiCall[] = [];
  private readonly fixtures = new Map<AiFeatureName, string>();
  private readonly errors: Error[] = [];

  constructor(private readonly fixturesDir: string = DEFAULT_AI_FIXTURES_DIR) {}

  useFixture(feature: AiFeatureName, name: string): this {
    this.fixtures.set(feature, name);
    return this;
  }

  failNext(error: Error): this {
    this.errors.push(error);
    return this;
  }

  // async para que cualquier error (fixture, schema) sea un rechazo y no una excepción síncrona.
  async generateStructured<T>(input: GenerateStructuredInput<T>): Promise<GenerateStructuredResult<T>> {
    const fixture = this.fixtures.get(input.feature) ?? defaultFixtureName(input.feature);
    this.calls.push({ feature: input.feature, prompt: input.prompt, imageCount: input.images?.length ?? 0, fixture });
    if (input.signal?.aborted) throw input.signal.reason ?? new Error('Aborted');
    const error = this.errors.shift();
    if (error) throw error;

    const raw = this.load(fixture);
    return {
      data: input.schema.parse(raw.data),
      model: raw.model ?? FAKE_GEMINI_MODEL,
      inputTokens: raw.inputTokens ?? 0,
      outputTokens: raw.outputTokens ?? 0,
    };
  }

  reset(): void {
    this.calls.length = 0;
    this.fixtures.clear();
    this.errors.length = 0;
  }

  private load(name: string): AiFixture {
    const file = join(this.fixturesDir, `${name}.json`);
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as AiFixture;
    } catch (cause) {
      throw new Error(`FakeGeminiClient: no se pudo leer el fixture ${file}`, { cause });
    }
  }
}
