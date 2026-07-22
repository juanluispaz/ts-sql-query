// Docker images per version folder, for the `--docker-version closest` mode.
//
// The test matrix organises each database into version folders on disk —
// `test/db/<db>/<version>/`. Per `PER_DATABASE_LAYOUT.md` the folder names are:
//   - `newest`  → compatibilityVersion `Number.POSITIVE_INFINITY` (library default)
//   - `<literal>` → the literal value of a documented breakpoint (e.g. `10_005_000`)
//   - `oldest`  → a representative value below the lowest documented breakpoint
//
// This map mirrors that: `ENGINE_IMAGES[<db>][<version-folder>]` is the docker
// image that folder runs against.
//
//   - By default (`--docker-version latest`) every cell runs against the
//     database's `newest` image, whatever its own folder.
//   - Under `--docker-version closest`, a cell runs against ITS OWN version
//     folder's image (e.g. `postgres/oldest` → postgres:17-alpine), so an agent
//     can confirm the version-specific SQL runs on a real engine of that
//     version. Opt-in and narrow (see the guardrails in `scripts/tests.sh`) —
//     the older images are separate containers.
//
// The entries are PRE-POPULATED from the documented breakpoints per engine
// (`docs/configuration/supported-databases/<db>.md`), so the agent that
// implements a version folder does NOT have to research which image it needs —
// the folder name is the map key, and its image is already here. They are
// UNVERIFIED until each folder + its tests exist and run (today only
// `postgres/oldest` has an actual cell). The highest breakpoint of an engine has
// no folder of its own: `compatibilityVersion` at that value emits SQL identical
// to `newest` (nothing is documented above it), so `newest` covers it.
//
// Each image is a deliberate, hand-maintained choice — no arithmetic, no
// "closest-below" guessing — and may be a DIFFERENT repository (pre-23ai Oracle
// lives in `gvenzl/oracle-xe`, not `gvenzl/oracle-free`). A `closest` cell whose
// folder has no entry is a hard error. SQLite is absent: embedded (native /
// WASM), no container, so `closest` never touches its cells.

export const ENGINE_IMAGES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    // Breakpoint 18_000_000 (== newest).
    postgres: {
        newest: 'postgres:18-alpine',
        oldest: 'postgres:17-alpine',
    },
    // Breakpoints 8_000_019 (== newest), 8_000_017, 8_000_000. 8.0.x covers both
    // sub-newest breakpoints; oldest is MySQL 5.x.
    mysql: {
        newest: 'mysql:9',
        '8_000_017': 'mysql:8.0',
        '8_000_000': 'mysql:8.0',
        // MySQL <8.0 has no arm64 image; 5.7 is amd64-only (it is the only option
        // for the <8.0 code path). Like SQL Server / Oracle it runs emulated on
        // Apple Silicon — but its manifest lists amd64 WITHOUT arm64, so (unlike
        // those single-arch images that auto-emulate) Docker needs
        // `DOCKER_DEFAULT_PLATFORM=linux/amd64` to emulate it instead of erroring.
        // Fine on amd64 CI. Verified: emulates + connects (5.7.44) with that set.
        oldest: 'mysql:5.7',
    },
    // Breakpoints 13_000_001 (== newest; OLD_VALUE, not yet GA), 10_005_000,
    // 10_004_000, 10_003_003. oldest is the 10.3 line (docs: don't go below 10.3).
    // newest pinned to 12.3 (current latest) — bump when a newer release ships.
    mariadb: {
        newest: 'mariadb:12.3',
        '10_005_000': 'mariadb:10.5',
        '10_004_000': 'mariadb:10.4',
        '10_003_003': 'mariadb:10.3',
        oldest: 'mariadb:10.3',
    },
    // Breakpoint 23_004_000 (== newest). Pre-23ai is the separate oracle-xe repo.
    oracle: {
        newest: 'gvenzl/oracle-free:23-slim-faststart',
        oldest: 'gvenzl/oracle-xe:21-slim-faststart',
    },
    // Breakpoints 17_000_000 (2025, == newest), 16_000_000 (2022). oldest is 2019.
    sqlserver: {
        newest: 'mcr.microsoft.com/mssql/server:2025-latest',
        '16_000_000': 'mcr.microsoft.com/mssql/server:2022-latest',
        oldest: 'mcr.microsoft.com/mssql/server:2019-latest',
    },
}

/**
 * Reports whether `--docker-version closest` is active for this process. The
 * flag is serialised by `tests.sh` into the internal `TS_SQL_QUERY_DOCKER_VERSION`
 * env var (`latest` — the default — or `closest`). Absent ⇒ `latest`.
 */
export function closestVersionEnabled(): boolean {
    if (typeof process === 'undefined') return false
    return (process.env['TS_SQL_QUERY_DOCKER_VERSION'] ?? 'latest').trim() === 'closest'
}

/**
 * The database's default image — its `newest` folder's image. This is what a
 * normal (`latest`) run uses for every cell, and the single source of truth
 * each `test/db/<db>/runners.ts` reads instead of hardcoding the tag.
 */
export function newestImage(database: string): string {
    const image = ENGINE_IMAGES[database]?.['newest']
    if (image === undefined) throw new Error(`No 'newest' docker image mapped for database '${database}' in test/lib/dockerImages.ts`)
    return image
}

/**
 * The image a version FOLDER runs against under `--docker-version closest`: a
 * direct lookup in the hard `ENGINE_IMAGES` map. No arithmetic, no
 * "closest-below" guessing — an unmapped folder is a HARD ERROR (fail loud
 * rather than silently run on the wrong engine). This is the ONE place that
 * turns a `<db>/<version>` into its closest image; every consumer (the per-cell
 * resolver below, the preflight warmup, and the closest guardrail) goes through
 * it, so the map stays the single source of truth — nothing recomputes it.
 */
export function closestImage(database: string, version: string): string {
    const image = ENGINE_IMAGES[database]?.[version]
    if (image === undefined) {
        throw new Error(
            `--docker-version closest: no docker image mapped for ${database}/${version}. ` +
            `Add it to ENGINE_IMAGES['${database}'] in test/lib/dockerImages.ts. ` +
            `See test/ENGINE_LIFECYCLE.md § Version-specific docker.`,
        )
    }
    return image
}

/**
 * The image a cell should run against: its own version folder's image under
 * `--docker-version closest` (real cells only), otherwise the `newest` image.
 *
 * Under `closest`, a REAL cell whose version folder has no entry is a HARD
 * ERROR — it fails loud rather than silently running on the wrong engine.
 */
export function imageForCell(database: string, version: string, realDbEnabled: boolean): string {
    if (!closestVersionEnabled() || !realDbEnabled) return newestImage(database)
    return closestImage(database, version)
}
