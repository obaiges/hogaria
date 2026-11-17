import { defineConfig } from 'tsup';

export default defineConfig({
  // common-passwords va aparte para que la lista no entre en el bundle principal de la web.
  entry: ['src/index.ts', 'src/auth/common-passwords.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2023',
});
