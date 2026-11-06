import globals from 'globals';

export default [
  { ignores: ['node_modules/**', '.*/**', 'output/**', 'sample/**', 'muestra/**', 'reference/**', 'dist/**', 'out/**', 'coverage/**'] },
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.es2025 },
    rules: {
      'no-undef': 'error',
      'no-const-assign': 'error',
      'no-dupe-args': 'error',
      'no-dupe-class-members': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'valid-typeof': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  { files: ['scripts/**/*.js', 'tools/**/*.js', 'tests/**/*.js', 'bin/*.js', 'config/*.js', 'src/action/*.js', 'src/cli/*.js', 'src/github/*.js', 'eslint.config.js'], languageOptions: { globals: globals.node } },
  { files: ['assets/**/*.js', 'src/studio/**/*.js', 'src/sharing/*.js', 'src/browser/*.js'], languageOptions: { globals: globals.browser } },
];
