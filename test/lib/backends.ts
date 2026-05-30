// Per-kind real/mock gate. This file parses three INTERNAL env vars —
// `TS_SQL_QUERY_DOCKER` / `TS_SQL_QUERY_WASM` / `TS_SQL_QUERY_NATIVE` — each
// of which is `all` | `none` | `newest` | a comma list of
// `<db>/<version>/<connector>` cell keys, and decides per cell whether its
// real-DB branch fires (otherwise the cell transparently falls back to the
// mock — the test body still runs).
//
// These vars are an internal script↔runtime channel: users drive them
// through the `--docker` / `--wasm` / `--native` flags, never by hand. The
// full contract — what each value means and how the flags (incl. their
// coords) resolve into these strings — is documented in
// `scripts/_test-common.sh` (the side that produces them). KEEP IN SYNC with
// that resolution.
//
// Absent defaults (only when a cell file is run directly, not via `tests`):
// docker = none, wasm = all, native = all.

/**
 * Tag of which heavyweight backend a connector needs for its real-DB branch.
 * Groups connectors by **gating profile** (which `--flag` enables their real
 * path), not by implementation:
 *
 *   - `docker`: needs a real DB container (mariadb, mysql2, oracledb, mssql,
 *     pg, postgres, bun_sql_postgres). Gated by `--docker`.
 *   - `wasm`: needs a WebAssembly module bootstrap (pglite, sqlite-wasm-OO1).
 *     Gated by `--wasm`. Its own category because the bootstrap is CPU-bound
 *     and dominates wall time under parallel workers — see the two-phase split
 *     in `scripts/tests.sh`.
 *   - `native`: embedded SQLite drivers (better-sqlite3, bun_sqlite,
 *     node_sqlite, sqlite3) — no extra infra. Gated by `--native` (default
 *     `all`, i.e. real). pglite / sqlite-wasm-OO1 are also in-process but
 *     belong to `wasm` because their gating profile differs.
 */
export type RealDbBackend = 'docker' | 'wasm' | 'native'

interface Selection {
    readonly mode: 'all' | 'none' | 'newest' | 'cells'
    readonly cells?: ReadonlySet<string>
}

/**
 * A connector's real-DB branch fires iff the cell is selected as `real` for
 * its backend KIND under the current flags.
 *
 * The legacy boolean overload (`isRealDbEnabled(db, needsDocker)`) maps
 * `true → 'docker'`, `false → 'native'`.
 *
 * `version` and `connector` are the cell's `<version>` / `<connector>` folders
 * (from `spec.label = "<version> / <connector>"`). They are required for the
 * `newest` (version) and `<cell-list>` (db/version/connector) selections;
 * `all` / `none` ignore them. The `create*TestContext` factories pass both.
 */
export function isRealDbEnabled(
    database: string,
    requires: RealDbBackend | boolean,
    version?: string,
    connector?: string,
): boolean {
    const kind: RealDbBackend = typeof requires === 'boolean'
        ? (requires ? 'docker' : 'native')
        : requires
    const sel = kind === 'docker' ? DOCKER_SEL : kind === 'wasm' ? WASM_SEL : NATIVE_SEL
    switch (sel.mode) {
        case 'none': return false
        case 'all': return true
        case 'newest': return version === 'newest'
        case 'cells':
            if (version === undefined || connector === undefined || sel.cells === undefined) return false
            return sel.cells.has(`${database}/${version}/${connector}`)
    }
}

// ---- parsing ------------------------------------------------------------

const DOCKER_SEL: Selection = parseSelection(readEnv('TS_SQL_QUERY_DOCKER'), 'none')
const WASM_SEL: Selection = parseSelection(readEnv('TS_SQL_QUERY_WASM'), 'all')
const NATIVE_SEL: Selection = parseSelection(readEnv('TS_SQL_QUERY_NATIVE'), 'all')

function parseSelection(raw: string | undefined, fallback: 'all' | 'none'): Selection {
    if (raw === undefined || raw === '') return { mode: fallback }
    if (raw === 'all' || raw === 'none' || raw === 'newest') return { mode: raw }
    // Anything else is a comma list of `<db>/<version>/<connector>` cell keys.
    const cells = new Set<string>()
    for (const part of raw.split(',')) {
        const t = part.trim()
        if (t !== '') cells.add(t)
    }
    return { mode: 'cells', cells }
}

function readEnv(name: string): string | undefined {
    if (typeof process === 'undefined') return undefined
    const v = process.env[name]
    return v === undefined ? undefined : v.trim()
}
