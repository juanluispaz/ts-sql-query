// Configuration for monocart-coverage-reports (MCR), consumed by
// vitest-monocart-coverage when --coverage-format=monocart is passed
// under vitest. MCR auto-discovers this file via the file name.
//
// The bun branch of --coverage-format=monocart does NOT read this
// file — it goes through test/lib/coverage/lcovToMonocart.ts, which
// drives MCR programmatically with options tuned to istanbul input
// (bun's lcov is collapsed to lines, so the V8 report isn't usable
// there). Keep config knobs that matter to both paths in sync by
// hand when adjusting.
//
// Format note: this is .mjs (not .ts) because MCR's config loader
// uses Node's native require/import — no TypeScript transformer is
// in scope when MCR resolves its config, so a .ts file errors with
// "Unknown file extension". JSDoc + the @type import below keeps it
// typechecked under tsc via verbatim-import inference.

// The object-form filter is evaluated top-to-bottom; the first
// matching pattern wins. Negative entries come first so they
// pre-empt the catch-all at the bottom.
const scope = process.env['TS_SQL_QUERY_COVERAGE_SCOPE'] ?? 'library'
const filter = {
    '**/node_modules/**': false,
    '**/test/**': false,
    ...(scope === 'runners'
        ? { '**/src/queryRunners/*/**': false, '**/src/queryRunners/**': true, '**/src/utils/transactionIsolationLevel.ts': true, '**/src/**': false }
        : scope === 'mappers'
            ? { '**/src/queryRunners/connectorErrorMappers/**': true, '**/src/queryRunners/databaseErrorMappers/**': true, '**/src/**': false }
        : scope === 'all'
            ? { '**/src/**': true }
            : { '**/src/queryRunners/**': false, '**/src/utils/transactionIsolationLevel.ts': false, '**/src/**': true }),
}

/** @type {import('monocart-coverage-reports').CoverageReportOptions} */
const config = {
    name: 'ts-sql-query coverage',
    outputDir: '.test-report/coverage',
    // Native V8 byte-range report (the differentiating feature
    // vs. istanbul-style html) + a terminal summary so green/red
    // is visible without opening the browser. `lcov: true` is
    // shorthand for also writing lcov.info alongside, which keeps
    // CI consumers happy.
    reports: ['v8', 'console-summary'],
    lcov: true,

    // MCR does NOT honour vitest's `coverage.exclude` automatically
    // when used as a custom provider via vitest-monocart-coverage;
    // its own filtering is the only path. Keep `filter` in sync
    // with vitest.config.ts (`test.coverage`) and bunfig.toml
    // (`coveragePathIgnorePatterns`) so all three entry points
    // produce coverage for the same set of files, per the tests
    // CLI's `--coverage-scope` (TS_SQL_QUERY_COVERAGE_SCOPE):
    // `library` (default), `runners`, `mappers` or `all`.
    //
    // sourceFilter applies to the source files; entryFilter to the
    // V8 raw-coverage entries before sourcemap unpacking (under the
    // vitest+v8 path vitest's own collector already produces entries
    // for src files only, so it is belt-and-braces).
    sourceFilter: filter,
    entryFilter: filter,
}

export default config
