const ts = require('typescript-eslint');
const angular = require('angular-eslint');

const tsConfigs = [
  ts.configs.eslintRecommended,
  ...ts.configs.recommendedTypeChecked,
  ...ts.configs.stylisticTypeChecked,
].map((config) => {
  if (!config.files) {
    return { ...config, files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'] };
  }
  return config;
});

const angularTsConfigs = [...angular.configs.tsRecommended].map((config) => {
  if (!config.files) {
    return { ...config, files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'] };
  }
  return config;
});

const templateConfigs = [
  ...angular.configs.templateRecommended,
  ...angular.configs.templateAccessibility,
].map((config) => {
  if (!config.files) {
    return { ...config, files: ['**/*.html'] };
  }
  return config;
});

module.exports = [
  {
    ignores: [
      'dist',
      'apps-script/dist',
      '.angular',
      'coverage',
      'node_modules',
      'playwright-report',
      'test-results',
      'package-lock.json',
    ],
  },
  ...tsConfigs,
  ...angularTsConfigs,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/array-type': 'off',
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    // Tool config files that sit outside the app, spec and backend tsconfigs: playwright.config.ts
    // is typechecked via e2e/tsconfig.json, and apps-script/vitest.config.mts is loaded by Vitest
    // itself. ESLint's project service looks for a tsconfig beside them and finds none, and
    // type-aware rules on a config file buy nothing, so they are off here rather than bent into
    // place with a synthetic project.
    files: ['playwright.config.ts', '**/*.mts'],
    ...ts.configs.disableTypeChecked,
  },
  {
    // The tooling scripts and the Apps Script bundler are plain Node ESM, outside any tsconfig.
    files: ['**/*.mjs'],
    ...ts.configs.disableTypeChecked,
    languageOptions: {
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
      },
    },
  },
  ...templateConfigs,
  {
    files: ['**/*.html'],
    rules: {},
  },
  {
    files: ['apps-script/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
      globals: {
        SpreadsheetApp: 'readonly',
        LockService: 'readonly',
        ContentService: 'readonly',
        UrlFetchApp: 'readonly',
        MailApp: 'readonly',
        PropertiesService: 'readonly',
        Session: 'readonly',
        Utilities: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
