import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defaultFixtureName, FAKE_GEMINI_MODEL, FakeGeminiClient } from './fake-gemini.client.js';

const ingredientsSchema = z.object({ ingredients: z.array(z.string()) });

function fixturesDir(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'hogaria-ai-'));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, `${name}.json`), JSON.stringify(content));
  return dir;
}

describe('FakeGeminiClient', () => {
  it('lee test/fixtures/ai por defecto', async () => {
    const fake = new FakeGeminiClient().useFixture('FRIDGE_DETECT', 'smoke.ok');
    const res = await fake.generateStructured({ feature: 'FRIDGE_DETECT', prompt: 'nevera', schema: ingredientsSchema });
    expect(res).toEqual({ data: { ingredients: ['huevos', 'leche', 'tomate'] }, model: FAKE_GEMINI_MODEL, inputTokens: 120, outputTokens: 30 });
    expect(fake.calls).toEqual([{ feature: 'FRIDGE_DETECT', prompt: 'nevera', imageCount: 0, fixture: 'smoke.ok' }]);
  });

  it('usa <feature>.ok por defecto y valida con el schema', async () => {
    expect(defaultFixtureName('FRIDGE_RECIPES')).toBe('fridge-recipes.ok');
    const dir = fixturesDir({ 'receipt.ok': { data: { ingredients: 'no es un array' } } });
    const fake = new FakeGeminiClient(dir);
    await expect(fake.generateStructured({ feature: 'RECEIPT', prompt: 'x', schema: ingredientsSchema })).rejects.toBeInstanceOf(z.ZodError);
  });

  it('simula errores, cancelación y fixtures que no existen', async () => {
    const dir = fixturesDir({ 'chat.ok': { data: { ingredients: [] } } });
    const fake = new FakeGeminiClient(dir).failNext(new Error('timeout'));
    const input = { feature: 'CHAT' as const, prompt: 'hola', schema: ingredientsSchema };

    await expect(fake.generateStructured(input)).rejects.toThrow('timeout');
    await expect(fake.generateStructured(input)).resolves.toMatchObject({ data: { ingredients: [] }, inputTokens: 0 });

    const controller = new AbortController();
    controller.abort(new Error('cancelado'));
    await expect(fake.generateStructured({ ...input, signal: controller.signal })).rejects.toThrow('cancelado');

    fake.useFixture('CHAT', 'no-existe');
    await expect(fake.generateStructured(input)).rejects.toThrow(/no se pudo leer el fixture/);

    fake.reset();
    expect(fake.calls).toEqual([]);
  });
});
