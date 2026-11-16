import { react } from '@hogaria/config/eslint';

export default [
  ...react,
  {
    ignores: ['dist/**', 'dev-dist/**'],
  },
];
