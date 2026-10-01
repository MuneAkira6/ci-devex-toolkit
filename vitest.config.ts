import { defineConfig } from 'vitest/config'

// Every tool keeps its Vitest tests in <tool>/test/. The shell self-test of two-repos-one-worktree is
// not a Vitest file; it runs with `pnpm assets:selftest`.
export default defineConfig({
  test: {
    include: ['*/test/**/*.test.ts'],
  },
})
