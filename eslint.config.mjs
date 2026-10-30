import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'test-results', 'playwright-report', 'coverage', '.claude'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Les variables inutilisées sont déjà signalées par tsc (noUnusedLocals/noUnusedParameters)
      '@typescript-eslint/no-unused-vars': 'off',
      // Dette connue (phase 3 du plan) : signalée sans bloquer
      '@typescript-eslint/no-explicit-any': 'warn',
      // Code existant (ex: `game;` pour faire taire noUnusedParameters, blocs vides) : à nettoyer progressivement
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-case-declarations': 'warn',
      'no-dupe-else-if': 'warn',
      'no-empty': 'warn',
      // `let { x, y, a } = ...` reste autorisé si au moins une variable est réassignée
      'prefer-const': ['error', { destructuring: 'all' }],
    },
  },
  {
    files: ['test/**/*.ts'],
    languageOptions: { globals: { ...globals.jest } },
  },
);
