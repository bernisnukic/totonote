module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/electron',
    'plugin:import/typescript',
  ],
  parser: '@typescript-eslint/parser',
  overrides: [
    {
      // Build and test config files import their tooling through package `exports` maps
      // (e.g. 'vitest/config'), which the import plugin's default resolver cannot follow.
      // The imports are real — tsc and the tools themselves resolve them fine — so the
      // rule only produces a false positive here.
      files: ['*.config.ts', '*.config.mts', '*.config.js', '*.config.mjs'],
      rules: {
        'import/no-unresolved': 'off',
      },
    },
  ],
};
