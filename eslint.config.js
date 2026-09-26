import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // El core de ESLint no rastrea usos en JSX: se ignoran componentes
      // (Mayúscula), `motion`/`m` de framer-motion (<motion.div>, <m.div>) y
      // props renombradas a componente ({ icon: Icon }).
      'no-unused-vars': ['error', { varsIgnorePattern: '^(?:[A-Z_]|m$|motion$)', argsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Node runtime (config de build/test), no del browser: process, __dirname, etc.
    files: ['*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // jsdom (window/document) + Node (Buffer, global) para specs y setup de vitest.
    files: ['**/*.test.{js,jsx}', 'vitest.setup.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    // Node runtime (config de build/test), no del browser: process, __dirname, etc.
    files: ['*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // jsdom (window/document) + Node (Buffer, global) para specs y setup de vitest.
    files: ['**/*.test.{js,jsx}', 'vitest.setup.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
])
