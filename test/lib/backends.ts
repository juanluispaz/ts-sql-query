// Three orthogonal flags drive what a test does at runtime:
//
//   TS_SQL_QUERY_DBS    — comma list of database folder names under
//                         `test/db/` (e.g. `postgres,mariadb,sqlite`).
//                         Special values: `all` (default) and `none`. This
//                         only narrows the SCOPE of the run — which tests
//                         participate — it does not change what any
//                         individual test does.
//
//   TS_SQL_QUERY_DOCKER — `on` or `off` (default `off`). Gates whether the
//                         real-DB branch of a docker-backed connector
//                         actually runs. Every test executes regardless of
//                         this flag — when the real branch is gated off,
//                         it transparently falls back to the mock. There
//                         is no duplicated code path: the same body
//                         describes both modes.
//
//   TS_SQL_QUERY_DOCKER_SCOPE — `all` (default) or `newest`. When `newest`
//                         only the cells under `<db>/newest/*` keep their
//                         real-DB branch active; older versions transparently
//                         fall back to the mock. Same shape as the WASM toggle:
//                         the test bodies do not change, only the gate.
//                         Motivation is speed — for most regressions, hitting
//                         a single recent version per DB catches the issue
//                         without paying for the full version matrix.
//                         No-op when TS_SQL_QUERY_DOCKER is off.
//
//   TS_SQL_QUERY_WASM   — `on` or `off` (default `on`). Same idea as
//                         TS_SQL_QUERY_DOCKER but for the in-process WASM
//                         connectors (pglite, sqlite-wasm-OO1). Those
//                         engines bootstrap their WebAssembly heap inside
//                         the worker process and are heavily CPU-bound
//                         under parallel runners; setting this to `off`
//                         lets `tests` (without --wasm) keep the WASM
//                         cells in the matrix while routing them through
//                         the mock instead of paying the WASM bootstrap
//                         cost.
//
// Together they let `tests` (no flags) and `tests --docker` (no --wasm)
// exercise the whole suite without paying the cost of the real backends
// those flags disable — every test still runs, the SQL + params + type +
// mock-round-trip assertions still fire, and the in-process connectors
// not affected by the flag (e.g. native sqlite under --wasm off) keep
// running their real DB.

export type DockerMode = 'on' | 'off'
export type WasmMode = 'on' | 'off'
export type DockerScope = 'all' | 'newest'

/**
 * Tag of which heavyweight backend a connector needs for its real-DB
 * branch. The category groups connectors by **gating profile** (what
 * has to be enabled to take the real path), not by implementation:
 *
 *   - `docker`: needs a real DB container (mariadb, mysql2, oracledb,
 *     mssql, pg, postgres, bun_sql_postgres). Gated by `--docker`.
 *   - `wasm`: needs a WebAssembly module bootstrap (pglite,
 *     sqlite-wasm-OO1). Gated by `--wasm`. Pulled out as its own
 *     category because the bootstrap is CPU-bound and dominates wall
 *     time under parallel workers — see the two-phase split in
 *     `scripts/tests.sh`.
 *   - `native`: needs nothing extra. Always real. Today these are the
 *     embedded SQLite drivers (better-sqlite3, bun_sqlite,
 *     node_sqlite, sqlite3). Note that pglite / sqlite-wasm-OO1 are
 *     also in-process, but they belong to `wasm` because their
 *     gating profile differs.
 */
export type RealDbBackend = 'docker' | 'wasm' | 'native'

/** True iff this database folder is in scope for the current run. */
export function isBackendEnabled(database: string): boolean {
    return ENABLED_DBS === 'all' || ENABLED_DBS.has(database)
}

/** True iff docker-backed real-DB branches should fire. */
export function isDockerEnabled(): boolean {
    return DOCKER_MODE === 'on'
}

/** True iff WASM-backed real-DB branches should fire. */
export function isWasmEnabled(): boolean {
    return WASM_MODE === 'on'
}

/** Which docker-backed cells get a real DB. `newest` mocks every other version. */
export function dockerScope(): DockerScope {
    return DOCKER_SCOPE
}

/**
 * Convenience for connector setups: a connector's real-DB branch fires
 * iff its database is in scope AND the kind of heavyweight backend it
 * needs (docker / wasm / nothing) is enabled.
 *
 * The legacy boolean overload (`isRealDbEnabled(db, needsDocker)`) is
 * kept for callers that pre-date the WASM toggle: `true` is read as
 * `'docker'`, `false` as `'native'`.
 *
 * The optional `version` is the cell's `<version>` folder (e.g. `newest`,
 * `oldest`). It is only inspected when `requires === 'docker'` and the
 * scope is narrowed to `newest`: callers that omit it bypass the scope
 * check (the existing WASM / native paths). Docker-backed
 * `create*TestContext` factories derive it from `spec.label`.
 */
export function isRealDbEnabled(database: string, requires: RealDbBackend | boolean, version?: string): boolean {
    const kind: RealDbBackend = typeof requires === 'boolean'
        ? (requires ? 'docker' : 'native')
        : requires
    if (!isBackendEnabled(database)) return false
    if (kind === 'docker' && !isDockerEnabled()) return false
    if (kind === 'wasm' && !isWasmEnabled()) return false
    if (kind === 'docker' && DOCKER_SCOPE === 'newest' && version !== undefined && version !== 'newest') return false
    return true
}

// ---- parsing ------------------------------------------------------------

const ENABLED_DBS: 'all' | ReadonlySet<string> = parseDbsFlag()
const DOCKER_MODE: DockerMode = parseDockerFlag()
const WASM_MODE: WasmMode = parseWasmFlag()
const DOCKER_SCOPE: DockerScope = parseDockerScopeFlag()

function parseDbsFlag(): 'all' | ReadonlySet<string> {
    const raw = readEnv('TS_SQL_QUERY_DBS')
    if (raw === undefined || raw === '' || raw === 'all') return 'all'
    if (raw === 'none') return new Set()
    const out = new Set<string>()
    for (const part of raw.split(',')) {
        const t = part.trim()
        if (t !== '') out.add(t)
    }
    return out
}

function parseDockerFlag(): DockerMode {
    const raw = readEnv('TS_SQL_QUERY_DOCKER')
    if (raw === undefined || raw === '') return 'off'
    if (raw === 'on' || raw === 'off') return raw
    throw new Error(`TS_SQL_QUERY_DOCKER must be "on" or "off" (got: ${raw})`)
}

function parseWasmFlag(): WasmMode {
    const raw = readEnv('TS_SQL_QUERY_WASM')
    // Defaults to `on` because WASM connectors run in-process and have
    // no external dependency that a typical developer would want to opt
    // out of by accident. The `tests` CLI sets this to `off` when invoked
    // without `--wasm`, to skip the WASM bootstrap cost; passing `--wasm`
    // re-enables it for the sequential second pass.
    if (raw === undefined || raw === '') return 'on'
    if (raw === 'on' || raw === 'off') return raw
    throw new Error(`TS_SQL_QUERY_WASM must be "on" or "off" (got: ${raw})`)
}

function parseDockerScopeFlag(): DockerScope {
    const raw = readEnv('TS_SQL_QUERY_DOCKER_SCOPE')
    if (raw === undefined || raw === '') return 'all'
    if (raw === 'all' || raw === 'newest') return raw
    throw new Error(`TS_SQL_QUERY_DOCKER_SCOPE must be "all" or "newest" (got: ${raw})`)
}

function readEnv(name: string): string | undefined {
    if (typeof process === 'undefined') return undefined
    const v = process.env[name]
    return v === undefined ? undefined : v.trim()
}
