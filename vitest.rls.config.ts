import { defineConfig } from 'vitest/config'
import path from 'node:path'

// RLS / database tests need a live Postgres (Supabase) and four env vars.
// They are excluded from the default `npm test` run because they are slow
// and require infrastructure. Run with `npm run test:rls` after exporting
// the SUPABASE_TEST_* env vars listed in tests/security/rls/README.md.
export default defineConfig({
  test: {
    include: ['tests/security/rls/**/*.{test,spec}.ts'],
    exclude: ['node_modules/**'],
    environment: 'node',
    testTimeout: 60_000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
})
