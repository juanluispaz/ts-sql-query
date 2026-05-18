import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        include: ['test/**/*.test.ts'],
        // testcontainers needs time to pull and start images on first run.
        testTimeout: 60_000,
        hookTimeout: 120_000,
        // Tolerate files that declare a `describe` with every `test(...)`
        // commented out per the symmetry rule (DESIGN.md §4). Without
        // this, vitest treats those as failed suites — a soft failure
        // with exit 0 normally, but a hard failure under --coverage
        // that also suppresses the coverage report. The flag only
        // relaxes the "no tests found" case; real assertion failures
        // still fail.
        passWithNoTests: true,
        // All HTML output (test execution + coverage) lands under
        // `.test-report/`. The test-exec report (`--reporter=html`,
        // requires @vitest/ui) writes here; the coverage report
        // lives in a subdirectory so the two share one wipe-and-go
        // root (see `clean_coverage_dir` in scripts/_test-common.sh).
        outputFile: {
            html: '.test-report/index.html',
        },
        coverage: {
            // Coverage scope. Mirrored in bunfig.toml's
            // `coveragePathIgnorePatterns` so both runners report on
            // the same set of files. Drops the legacy examples and
            // the test infrastructure itself, keeping the report
            // focused on the library's public surface.
            exclude: ['src/examples/**', 'test/**'],
            reportsDirectory: '.test-report/coverage',
        },
    },
})
