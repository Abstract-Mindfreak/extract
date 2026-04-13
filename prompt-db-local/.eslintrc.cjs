module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  ignorePatterns: ['dist', 'dist-electron', 'coverage', 'renderer/dist'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'eslint-config-prettier'
  ],
  overrides: [
    {
      files: ['renderer/src/**/*.{ts,tsx}'],
      rules: {
        'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
      }
    },
    {
      files: ['extension/**/*.js'],
      globals: {
        chrome: 'readonly'
      }
    },
    {
      files: ['scripts/**/*.cjs'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off'
      }
    }
  ]
};
