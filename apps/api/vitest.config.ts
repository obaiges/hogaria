import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Dos proyectos (docs/07-testing.md):
// - unit: `src/**/*.spec.ts`, sin BBDD.
// - integration: `test/**/*.int.spec.ts` con supertest y Postgres (`hogaria_test`):
//   `globalSetup` resetea la BBDD una vez; cada test trunca las tablas. En serie
//   (un solo proceso) para que los archivos no se pisen en la BBDD.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
          setupFiles: ['test/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/**/*.int.spec.ts'],
          setupFiles: ['test/setup.ts', 'test/setup-int.ts'],
          globalSetup: ['test/global-setup.ts'],
          pool: 'forks',
          fileParallelism: false,
          maxWorkers: 1,
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.service.ts'],
      thresholds: { lines: 80 },
    },
  },
});
