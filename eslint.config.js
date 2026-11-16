// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions は Deno（Edge Functions）向けのコードなので、アプリとは別に確認する
    ignores: ['dist/*', 'supabase/functions/*'],
  },
  {
    // Jest のセットアップファイルでは jest がグローバルに提供される
    files: ['jest.setup.js'],
    languageOptions: {
      globals: { jest: 'readonly' },
    },
  },
]);
