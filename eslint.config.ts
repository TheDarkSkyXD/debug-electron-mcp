import boundaries from '@boundaries/eslint-plugin';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const sourceLayerTypes = ['transport', 'application', 'adapter', 'persistence', 'shared'];

export default tseslint.config(
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-case-declarations': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'warn',
    },
  },
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'transport', pattern: 'src/transport' },
        { type: 'application', pattern: 'src/application' },
        { type: 'adapter', pattern: 'src/adapters/electron' },
        { type: 'persistence', pattern: 'src/adapters/persistence' },
        { type: 'shared', pattern: 'src/shared' },
      ],
      'boundaries/files': [{ category: 'composition', pattern: 'src/index.ts' }],
      'boundaries/legacy-warnings': false,
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkUnknownLocals: true,
          policies: [
            {
              from: { element: { type: 'transport' } },
              allow: {
                to: {
                  element: { types: { anyOf: ['transport', 'application', 'shared'] } },
                },
              },
            },
            {
              from: { element: { type: 'application' } },
              allow: {
                to: { element: { types: { anyOf: ['application', 'shared'] } } },
              },
            },
            {
              from: { element: { type: 'adapter' } },
              allow: {
                to: { element: { types: { anyOf: ['adapter', 'application', 'shared'] } } },
              },
            },
            {
              from: { element: { type: 'persistence' } },
              allow: {
                to: { element: { types: { anyOf: ['persistence', 'application', 'shared'] } } },
              },
            },
            {
              from: { element: { type: 'shared' } },
              allow: { to: { element: { type: 'shared' } } },
            },
            {
              from: { file: { categories: 'composition' } },
              allow: {
                to: { element: { types: { anyOf: sourceLayerTypes } } },
              },
            },
          ],
        },
      ],
      'boundaries/no-unknown-dependencies': ['error', { require: 'element' }],
      'boundaries/no-unknown-files': 'error',
    },
  },
  {
    files: ['src/application/**/*.ts', 'src/transport/**/*.ts', 'src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'playwright',
                'playwright/**',
                'ws',
                'ws/**',
                'fs',
                'fs/**',
                'node:fs',
                'node:fs/**',
                'os',
                'node:os',
                'path',
                'path/**',
                'node:path',
                'node:path/**',
                'child_process',
                'node:child_process',
              ],
              message: 'Platform APIs belong behind an application-owned adapter.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/adapters/persistence/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['playwright', 'playwright/**', 'ws', 'ws/**'],
              message: 'Electron SDKs belong in an Electron adapter.',
            },
          ],
        },
      ],
    },
  },
  { files: ['tests/**/*'], rules: { 'no-console': 'off' } },
  {
    files: ['scripts/**/*'],
    rules: { 'no-console': 'off' },
  },
  {
    ignores: [
      '.agent/**',
      '.agents/**',
      'coverage/**',
      'dist/**',
      'examples/**',
      'node_modules/**',
      'webpack.config.cjs',
    ],
  },
);
