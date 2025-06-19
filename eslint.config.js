import { FlatCompat } from '@eslint/eslintrc';
import path from 'path';
import { fileURLToPath } from 'url';
import js from '@eslint/js';

// mimic CommonJS variables -- not needed if using CommonJS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname, // Ensure plugins are resolved correctly
  recommendedConfig: js.configs.recommended, // Add the recommended config
});

export default [
  {
    ignores: ['tailwind.config.cjs'],
  },
  // mimic ESLintRC-style extends
  // Remove eslint:recommended as it's now part of FlatCompat's base
  ...compat.extends('plugin:react/recommended'),
  ...compat.extends('plugin:react-hooks/recommended'),
  ...compat.extends('plugin:@typescript-eslint/recommended'),
  ...compat.extends('plugin:prettier/recommended'),
  {
    languageOptions: {
      // parser: "@typescript-eslint/parser", // This will be handled by compat.extends
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        browser: true,
        node: true,
        es6: true,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    plugins: {
      // These will be handled by compat.extends
      // "@typescript-eslint": "@typescript-eslint/eslint-plugin",
      // "react": "eslint-plugin-react",
      // "react-hooks": "eslint-plugin-react-hooks",
      // "prettier": "eslint-plugin-prettier"
    },
    rules: {
      'prettier/prettier': 'error',
      'react/react-in-jsx-scope': 'off', // Not needed with React 17+
      '@typescript-eslint/explicit-module-boundary-types': 'off', // Preference, can be enabled
      '@typescript-eslint/no-explicit-any': 'warn', // Warn instead of error for 'any'
      'no-console': 'warn', // Warn about console.log statements
      '@typescript-eslint/no-unused-vars': [
        'warn', // or "error" based on preference
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'react/no-unescaped-entities': ['error', { forbid: ['>', '"', '}'] }],
    },
  },
];
