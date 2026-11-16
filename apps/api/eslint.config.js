import { base } from '@hogaria/config/eslint';

export default [
  ...base,
  { ignores: ['src/generated/**'] },
  {
    // NestJS inyecta dependencias por el tipo del constructor (emitDecoratorMetadata):
    // esos imports deben ser de valor, no `import type`.
    files: ['src/**/*.ts'],
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
];
