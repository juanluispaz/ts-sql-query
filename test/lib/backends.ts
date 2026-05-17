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

/** Tag of which heavyweight backend a connector needs for its real-DB branch. */
export type RealDbBackend = 'docker' | 'wasm' | 'inprocess'

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

/**
 * Convenience for connector setups: a connector's real-DB branch fires
 * iff its database is in scope AND the kind of heavyweight backend it
 * needs (docker / wasm / nothing) is enabled.
 *
 * The legacy boolean overload (`isRealDbEnabled(db, needsDocker)`) is
 * kept for callers that pre-date the WASM toggle: `true` is read as
 * `'docker'`, `false` as `'inprocess'`.
 */
export function isRealDbEnabled(database: string, requires: RealDbBackend | boolean): boolean {
    const kind: RealDbBackend = typeof requires === 'boolean'
        ? (requires ? 'docker' : 'inprocess')
        : requires
    if (!isBackendEnabled(database)) return false
    if (kind === 'docker' && !isDockerEnabled()) return false
    if (kind === 'wasm' && !isWasmEnabled()) return false
    return true
}

// ---- parsing ------------------------------------------------------------

const ENABLED_DBS: 'all' | ReadonlySet<string> = parseDbsFlag()
const DOCKER_MODE: DockerMode = parseDockerFlag()
const WASM_MODE: WasmMode = parseWasmFlag()

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

function readEnv(name: string): string | undefined {
    if (typeof process === 'undefined') return undefined
    const v = process.env[name]
    return v === undefined ? undefined : v.trim()
}
