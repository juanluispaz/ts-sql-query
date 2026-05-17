import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        include: ['test/**/*.test.ts'],
        // testcontainers needs time to pull and start images on first run.
        testTimeout: 60_000,
        hookTimeout: 120_000,
    },
})
