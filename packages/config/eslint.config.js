// Configuración compartida de ESLint (flat config).
// - `base`: TypeScript + orden de imports + reglas comunes (api, shared, web).
// - `react`: añade React y hooks (solo apps/web).
import js from '@eslint/js';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export const ignores = {
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/.turbo/**',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/*.d.ts',
  ],
};

export const base = tseslint.config(
  ignores,
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'import-x': importX },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2023 },
    },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      'no-console': ['error', { allow: ['debug', 'warn'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'import-x/no-duplicates': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
          pathGroups: [
            { pattern: '@hogaria/**', group: 'internal', position: 'before' },
            { pattern: '@/**', group: 'internal' },
          ],
          pathGroupsExcludedImportTypes: ['type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },
);

export const react = tseslint.config(...base, {
  files: ['**/*.{ts,tsx}'],
  plugins: { react: reactPlugin, 'react-hooks': reactHooks },
  languageOptions: {
    globals: { ...globals.browser, ...globals.serviceworker },
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  settings: { react: { version: 'detect' } },
  rules: {
    ...reactPlugin.configs.flat.recommended.rules,
    ...reactPlugin.configs.flat['jsx-runtime'].rules,
    ...reactHooks.configs.recommended.rules,
    'react/no-danger': 'error',
    'react/prop-types': 'off',
  },
});

export default base;
