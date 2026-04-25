import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    include: ['tests/security/**/*.{test,spec}.ts'],
    exclude: ['tests/security/rls/**', 'node_modules/**'],
    environment: 'node',
    testTimeout: 30_000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
})
