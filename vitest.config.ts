import { defineConfig } from 'vitest/config'

/**
 * Pure-logic specs only: JSON parsing, three-state mapping, append-only
 * history, key redaction, endpoint prefill parsing, and the spawn argument
 * builder. No host package or Python interpreter is loaded at runtime; a
 * `.tsx` spec that renders opts into jsdom with its own `@vitest-environment`
 * pragma.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
  },
})
