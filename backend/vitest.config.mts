import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        // Integration tests share one database, so they must not interleave.
        fileParallelism: false,
        testTimeout: 30_000,
        hookTimeout: 60_000,
    },
});
