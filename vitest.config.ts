import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        include: ['test/**/*.test.ts'],
        // Force UTC before any test module loads (see
        // test/lib/setupTimezone.ts). Mirrored as a bun `preload` in
        // bunfig.toml so both runners marshal localDateTime identically.
        setupFiles: ['./test/lib/setupTimezone.ts'],
        // Per-test timeout. The default 5s is too tight for the
        // docker-backed cells under heavy parallel load (an Oracle
        // `withReseed` drops + recreates the schema and can spike
        // past 5s during contention). 60s covers the worst legitimate
        // cases without masking hangs for long. Mirrored in the bun
        // branch of `scripts/_test-common.sh` (`bun test --timeout 60000`).
        // No explicit `hookTimeout` — vitest inherits `testTimeout`
        // for hooks, matching bun's single-knob behaviour. The slow
        // hooks (`beforeAll`/`afterAll` doing container start/stop)
        // already override per-call with `ctx.timeoutMs` (180_000),
        // so the inherited default never bites them.
        testTimeout: 60_000,
        // Reuse each worker's module graph across the test files it runs
        // instead of tearing the environment down and re-importing every
        // module per file. With ~3k+ files the per-file re-import is the
        // dominant cost: on the full `newest` matrix it took the cumulative
        // `import` phase from ~493s to ~64s and cut wall time ~8x
        // (79s -> 9.5s), bringing vitest into bun's ballpark — bun is fast
        // for exactly this reason (it never re-isolates per file). This is
        // the vitest equivalent of that model. Trade-off: module-level state
        // now persists across files within a worker, so a test that mutates a
        // shared singleton could leak into the next file; the suite's cells
        // are self-contained (a fresh connection + mock/real runner per test),
        // so this stays green across mock + native-real. Kept on the default
        // `forks` pool on purpose — `threads` would additionally need
        // `TZ=UTC` in the ENVIRONMENT (the late `process.env.TZ` mutation in
        // test/lib/setupTimezone.ts is ignored once a worker isolate has
        // touched Date) and has shown an intermittent native-addon segfault.
        isolate: false,
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
        // A `--reporter` given on the CLI keeps the options this config
        // declares for the same reporter, but a reporter declared here is
        // also enabled when the CLI names none — so the html entry is only
        // declared when the CLI asks for it.
        ...(process.argv.includes('--reporter=html')
            ? { reporters: [['html', { outputDir: '.test-report' }]] }
            : {}),
        // The file reporters write here instead of vitest's `.vitest/`;
        // junit.xml is where bun's junit reporter writes too.
        outputFile: {
            junit: '.test-report/junit.xml',
            json: '.test-report/report.json',
        },
        coverage: {
            // Coverage scope, chosen by the tests CLI's `--coverage-scope`
            // (TS_SQL_QUERY_COVERAGE_SCOPE).
            //   * library (default): the library without its query runners,
            //     the legacy examples and the test infrastructure. Mirrored in
            //     bunfig.toml's `coveragePathIgnorePatterns` so both runners
            //     report on the same set of files. The runners are excluded
            //     because their driver code would dilute the library's signal.
            //   * runners: the query runners alone (the error-mapper folders
            //     are not part of it), plus the src/utils/ file only the
            //     runners use (the isolation-level translation), as a
            //     separate report.
            //   * mappers: the two error-mapper folders alone, as a separate
            //     report.
            //   * all: every file under src/ but the legacy examples.
            ...(process.env['TS_SQL_QUERY_COVERAGE_SCOPE'] === 'runners'
                ? { include: ['src/queryRunners/*.ts', 'src/utils/transactionIsolationLevel.ts'] }
                : process.env['TS_SQL_QUERY_COVERAGE_SCOPE'] === 'mappers'
                    ? { include: ['src/queryRunners/connectorErrorMappers/*.ts', 'src/queryRunners/databaseErrorMappers/*.ts'] }
                : process.env['TS_SQL_QUERY_COVERAGE_SCOPE'] === 'all'
                    ? { include: ['src/**/*.ts'] }
                    : { exclude: ['test/**', 'src/queryRunners/*', 'src/queryRunners/connectorErrorMappers/*', 'src/queryRunners/databaseErrorMappers/*', 'src/utils/transactionIsolationLevel.ts'] }),
            reportsDirectory: '.test-report/coverage',
        },
    },
})
