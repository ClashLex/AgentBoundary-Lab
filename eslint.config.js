import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  { ignores: ['dist/**', 'node_modules/**', '.npm-cache/**'] },
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended]
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser }
  },
  {
    files: ['src/**/*.tsx'],
    extends: [reactHooks.configs.flat.recommended]
  },
  {
    files: ['server/**/*.ts', 'scripts/**/*.mjs', 'eslint.config.js'],
    languageOptions: { globals: globals.node }
  }
]);
