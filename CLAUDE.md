# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

ts-sql-query is a type-safe SQL query builder (not an ORM) for TypeScript that supports MariaDB, MySQL, Oracle, PostgreSQL, SQLite, and SQL Server, running on Node.js (>=22) and Bun. Published documentation lives at https://ts-sql-query.readthedocs.io/ and is built from [docs/](docs/) with `mkdocs`.

## Commands

The project supports both Node and Bun. **Day-to-day development prefers Bun** (faster, native SQLite, no compile step for examples); the **publish pipeline and CI stay on npm/Node** — keep both paths working but reach for `bun` first when running things locally. Each script in `package.json` has a **single name** (no `bun:`-prefixed twin): the underlying shell script detects whether `bun run` or `npm run` invoked it (via `npm_config_user_agent`) and dispatches to `bun test`/`bun run` or `vitest`/`tsx` accordingly.

- **Typecheck only** (closest thing to a lint): prefer `bun run validate:tsgo` (or `npm run validate:tsgo`) — runs `tsgo --noEmit` (TypeScript 7 Go-based compiler, ~6× faster). Fall back to `bun run validate` / `npm run validate` (`tsc --noEmit`) for the authoritative TS 6 check when diagnosing a discrepancy or before pushing to CI.
- **Build the publishable artifact**: prefer `bun run build:tsgo` (or `npm run build:tsgo`) for fast local sanity checks of the build output — wipes `dist/`, runs `tsgo -p tsconfig.build.json`. The publish flow (`npm run dist*`) still runs `npm run build` (`tsc -p tsconfig.build.json`) intentionally — `tsgo` is preview, so the artifact that actually ships is the one `tsc` emits. Don't switch the publish path to bun or tsgo.
- **First-time setup** (after clone or after pulling Prisma schema changes): `bun install && bun run generate-prisma` (or the `npm` equivalents). Examples that use Prisma will fail without this.
- **Run the full example matrix** (requires Docker + Oracle Instant Client, ~13 min): `bun run all-examples` (Bun-native) or `npm run all-examples` (Node/tsx). Same script name, runtime is detected. See [test/README.md](test/README.md) for the Oracle Instant Client setup and disk requirements (~89 GB total).
- **Run docker-free examples**: `bun run no-docker-examples` locally; `npm run no-docker-examples` is what CI runs. Both cover documentation examples plus SQLite/PgLite backends.
- **Run a single example/test**: `bun ./src/examples/<File>.ts` (or `tsx ./src/examples/<File>.ts`). Each example is a self-contained script with its own `main()`.
- **Coverage**: `npm run coverage` (wraps `all-examples` with `nyc`; HTML report in `coverage/index.html`). Node-only; the script pins `npm_config_user_agent` so it always takes the tsx branch — don't invoke it via `bun run`.
- **Publish**: `npm run dist` / `dist-alpha` / `dist-beta` (Node only — pipeline expectation).
- **Docs preview**: `npm run docs` (requires `mkdocs` from the `.venv`).
- **The new `test/` matrix** (separate from the legacy `src/examples/` suite above): use the `tests:*` CLI family. Each has `--help`.
    - `bun run tests` — full matrix, parallel, mocked (no docker, no real WASM). ~1.5 s for 1281 tests; the default fast loop.
    - `bun run tests --docker` — same matrix, docker-backed connectors hit their real DB (container reuse on by default). ~17 s.
    - `bun run tests --docker --wasm` — full real coverage (parallel main pass + sequential real-WASM second pass). ~21 s.
    - `bun run tests:focus <coord>` — one coordinate (e.g. `postgres/newest/pg`, optionally `…/file.test.ts`). Same flags as `tests`.
    - `bun run tests:wasm` — just the WASM cells (pglite, sqlite-wasm-OO1), serially.
    - `bun run tests:audit` — symmetry audit across every `(db × version × connector)` cell. Pre-merge check.
    - `bun run tests:stop-containers` — stop the warm docker containers `--docker --docker-mode reuse` left running.

**Reserved names** — `test` and any `test:*` in `package.json` are **user-only aliases**. The agent must use the canonical `tests` / `tests:focus` / `tests:wasm` / `tests:audit` / `tests:stop-containers` instead. If you see `test` / `test:foo` in `package.json`, assume the user added it as a personal shortcut and **do not run it** unless explicitly instructed; treat it as opaque.

## Testing strategy

Tests are intentionally structured as runnable example scripts in [src/examples/](src/examples/) — not unit tests. The rationale (from [test/README.md](test/README.md)):

- Each example exercises the **public API only**, so it doubles as user-facing reference code.
- The same scenario is implemented per database (`PgExample.ts`, `MySql2Example.ts`, `MariaDBExample.ts`, `OracleDBExample.ts`, `MssqlTediousExample.ts`, multiple SQLite variants) and per query runner / driver combination (better-sqlite3, mariadb, mssql, mysql2, oracledb, pg, postgres, prisma, Bun's built-ins, etc.).
- [src/examples/documentation/](src/examples/documentation/) holds per-database scripts whose output is what the docs render — keep these in sync when changing public behavior.
- The docker-backed tests run against real database servers; mocks are avoided. When adding a feature, add coverage to every applicable per-database example, not just one.
- Some examples are guarded by Node-version checks inside [scripts/no-docker-examples.sh](scripts/no-docker-examples.sh) and [scripts/all-examples.sh](scripts/all-examples.sh) (inside the `else` branch — `$runtime = "bun"` skips them). Today `NodeSqliteExample.ts` and `NodeSqliteSynchronousExample.ts` are skipped on Node 22 (they use `DatabaseSync.function()`, which is only available from Node 24) and run with `NODE_OPTIONS='--experimental-sqlite'` on Node 24+ (required on 24, no-op on 26). When adding an example that depends on a Node feature introduced in a specific version, follow the same `if [ "$NODE_MAJOR" -ge N ]; then … else echo "Skipping …"; fi` pattern instead of failing the whole script.

## Architecture

The library is layered. Read top-down when tracing a query through the system:

1. **User-facing entry points** (`src/Connection.ts`, `src/Table.ts`, `src/View.ts`, `src/TypeAdapter.ts`, `src/Values.ts`, `src/dynamicCondition.ts`) — these and the listed subfolders in [README.md#install](README.md) are the only stable public surface. Anything outside that list (notably `src/internal/`, `src/queryBuilders/`, `src/sqlBuilders/`, `src/complexProjections/`, `src/utils/`) is implementation detail and may change.
2. **Per-database `Connection` subclass** in [src/connections/](src/connections/) (e.g. `PostgreSqlConnection`, `MySqlConnection`, `SqliteConnection`, `OracleConnection`, `SqlServerConnection`, `MariaDBConnection`). Users subclass one of these and define their tables/views/sequences/procedures on it. All share `AbstractConnection` / `AbstractAdvancedConnection`.
3. **`SqlBuilder` for that database** in [src/sqlBuilders/](src/sqlBuilders/) (one per backend, all inherit `AbstractSqlBuilder` — ~3k lines and the heart of dialect handling). The Connection wires itself to its SqlBuilder in its constructor.
4. **`QueryBuilder` family** in [src/queryBuilders/](src/queryBuilders/) (`SelectQueryBuilder`, `InsertQueryBuilder`, `UpdateQueryBuilder`, `DeleteQueryBuilder`, `FragmentQueryBuilder`, `DynamicConditionBuilder`, `SequenceQueryBuilder`) — fluent builders returned to the user; they accumulate state and hand it to the SqlBuilder when an `execute*` method is called.
5. **Value expressions** in [src/expressions/](src/expressions/) define the type-safe expression tree (`values.ts` is the master list of `*ValueSource` interfaces); [src/internal/ValueSourceImpl.ts](src/internal/ValueSourceImpl.ts) implements them.
6. **`QueryRunner`** in [src/queryRunners/](src/queryRunners/) abstracts the underlying driver (`PgPoolQueryRunner`, `MySql2QueryRunner`, `BetterSqlite3QueryRunner`, `PrismaQueryRunner`, etc., plus wrappers like `ConsoleLogQueryRunner`, `InterceptorQueryRunner`, `MockQueryRunner`). A Connection accepts any QueryRunner — this is the seam users override to log, mock, or chain behavior.
7. **Complex projections** in [src/complexProjections/](src/complexProjections/) implement nested object selection, optional-as-null vs optional-as-undefined, aggregated-array projection, left-join handling, picking, and compound queries. Two separate result-shape projectors exist (`resultWithOptionalsAsNull` vs `resultWithOptionalsAsUndefined`) — when adding result-shape logic, update both.

[src/simplifiedDefinition.txt](src/simplifiedDefinition.txt) is a hand-maintained simplified view of the public type surface — useful as a map when navigating the heavily generic real types.

## Module / TypeScript conventions

- ESM-only (`"type": "module"`). **Relative imports must use the `.js` extension** even when pointing at a `.ts` file (`verbatimModuleSyntax` + `isolatedModules` are on). Type-only imports must use `import type`.
- Strictness is high: `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`, `exactOptionalPropertyTypes`. Don't suppress these — fix the type.
- Target `es2023`, module `node20`, `rootDir: src`, `outDir: dist`. Indentation is 4 spaces (see [.editorconfig](.editorconfig)).
- With `exactOptionalPropertyTypes` on, `prop?: T` is not the same as `prop?: T | undefined`. Optional internal fields and `TsSqlErrorReason` union members spell out `| undefined` explicitly so callers can assign `undefined` to them. When you add a new optional field that may be assigned `undefined` (vs. just left absent), declare it as `T | undefined`.

## When adding or changing public behavior

1. Implement in the relevant layer (`SqlBuilder` for dialect-specific SQL emission; `QueryBuilder` / `expressions` for the fluent API).
2. Add the scenario to the corresponding script in [src/examples/documentation/](src/examples/documentation/) for **every** supported database (the docs render their output).
3. If it affects driver-level execution, also touch the relevant per-driver example in [src/examples/](src/examples/).
4. Run `bun run validate` and at minimum `bun run no-docker-examples` before pushing; CI runs both on Node 22/24/26 and Bun.
5. **Adding a public symbol or file**:
    - The public surface is **enumerated** in the `exports` map in [package.json](package.json) — wildcards are only used for the `unsupported/*` escape hatch. A new file is *not* publicly importable until you add an explicit entry there.
    - If the new symbol is **cross-database**, also re-export it from [src/index.ts](src/index.ts) (the aggregated root entry consumers reach via `import 'ts-sql-query'`). Use `export type` / `export` correctly because of `verbatimModuleSyntax`.
    - **Database-specific** additions (per-connection, per-driver runner, error mapper) go only in the `exports` map by subpath, never in the barrel.
    - Documentation snippets should import cross-database symbols from the root entry with a trailing `// or 'ts-sql-query/<subpath>'` comment; database-specific symbols stay on their subpath.
    - Never widen the public surface by adding exports under `internal/`, `expressions/`, `queryBuilders/`, `sqlBuilders/`, `utils/` or `complexProjections/` — those remain reachable only via the `unsupported/<original/path>` escape hatch.
6. **Writing changelog entries** in [docs/CHANGELOG.md](docs/CHANGELOG.md): write from the **library user's perspective**, not the contributor's. Describe what consumers will see — API additions, behavior changes, type-surface shifts, migration steps — and skip purely internal refactors that don't change the public surface. Internal-only work (compiler flag tightening, dependency updates, build-pipeline tweaks) goes under the **Internal changes** subsection and only when the user might still notice a side effect (e.g. a flag enabling stricter consumer typings). If a change doesn't affect anything a user imports, observes at runtime, or sees in their TS errors, don't add it to the changelog.
