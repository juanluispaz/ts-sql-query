// Docker preflight + warmup for the `--docker` matrix.
//
// WHY THIS EXISTS
// ----------------
// The full `--docker` matrix brings up five heavyweight engines (postgres,
// mariadb, mysql, oracle, sqlserver) and hits them from up to one worker per
// CPU. With container reuse off-by-default-per-process, every engine used to
// COLD-START SIMULTANEOUSLY the instant the parallel pass began — a memory
// spike that, on a Docker host sized below the matrix's needs, gets the
// biggest container (typically SQL Server) OOM-killed. The symptom is a
// cascade of `Failed to connect to <port>` / pool-exhaustion / hook-timeout
// failures that look like test bugs but are pure infrastructure starvation.
//
// WHAT IT DOES
// ------------
// Run once by `tests.sh` BEFORE the test phases, only in reuse mode (the only
// mode where a container started here survives to the test workers — reusable
// containers are exempt from Ryuk reaping). Two steps:
//
//   1. RESOURCE CHECK — read the Docker runtime's advertised memory and
//      compare it to a conservative estimate for the engines this run will
//      actually use. When it's short this is a HARD ERROR that ABORTS the run
//      (exit 3) with exact numbers and how to raise the memory — far better
//      than letting the run dissolve into 50 cryptic connection timeouts. The
//      block is on by default; downgrade it to a warning-and-proceed with
//      `TSSQLQUERY_DOCKER_MEMORY_STRICT=0`.
//
//   2. SEQUENTIAL WARMUP — start each needed engine's container ONE AT A TIME,
//      waiting for it to become healthy before the next. This spreads the
//      cold-start memory cost over time instead of stacking it, so the peak
//      stays well under the simultaneous-start peak. We drive a representative
//      cell's `ctx.up()` (then `ctx.down()`) per engine: that reuses the exact
//      same container builder the test runners use — so the reuse hash matches
//      and the workers attach to THIS container — and front-loads the
//      once-per-container schema-hash validation too.
//
// INPUT
// -----
// argv = one real docker cell coord per engine (`<db>/<version>/<connector>`),
// computed by `real_docker_rep_cells` in `scripts/_test-common.sh`. All
// connectors of an engine share a single container, so one cell per engine is
// enough to warm it. The `TS_SQL_QUERY_DOCKER` / `TESTCONTAINERS_REUSE_ENABLE`
// env vars are already exported by `tests.sh`, so the representative cell's
// `realDbEnabled` resolves true exactly when it would for the real run.

import { getContainerRuntimeClient } from 'testcontainers'

/**
 * Conservative steady-state memory each engine's container wants, in GiB.
 * Deliberately a little above the idle footprint so the estimate accounts for
 * query load + the per-worker schema reseed churn. Used only to size the
 * resource-check warning — never to cap a container (that would be a hard
 * limit, a separate concern). Tune here if an image's footprint changes.
 */
const ENGINE_MEMORY_GIB: Readonly<Record<string, number>> = {
    postgres: 0.5,
    mysql: 1.0,
    mariadb: 1.0,
    oracle: 2.5,
    sqlserver: 3.0,
}

/**
 * Headroom on top of the summed engine footprints: the testcontainers Ryuk
 * sidecar, image/page cache inside the Docker VM, and a safety margin so the
 * host isn't sized to the exact theoretical sum.
 */
const OVERHEAD_GIB = 1.0

const BYTES_PER_GIB = 1024 ** 3

/** A representative cell handed in on argv. */
interface RepCell {
    /** The original `<db>/<version>/<connector>` coord. */
    readonly coord: string
    /** First path segment — the engine / container owner (`postgres`, …). */
    readonly engine: string
}

/** The slice of a cell's `TestContext` the warmup actually touches. */
interface WarmableContext {
    readonly label: string
    readonly realDbEnabled: boolean
    readonly timeoutMs: number
    up(): Promise<void>
    down(): Promise<void>
}

function parseRepCells(argv: readonly string[]): RepCell[] {
    const out: RepCell[] = []
    const seen = new Set<string>()
    for (const raw of argv) {
        const coord = raw.replace(/\/+$/, '')
        if (coord === '') continue
        const engine = coord.split('/')[0] ?? ''
        if (engine === '' || seen.has(engine)) continue
        seen.add(engine)
        out.push({ coord, engine })
    }
    return out
}

/** GiB the given engines are estimated to need, rounded to one decimal. */
function requiredGiB(engines: readonly string[]): number {
    let sum = OVERHEAD_GIB
    for (const e of engines) sum += ENGINE_MEMORY_GIB[e] ?? 1.0
    return Math.round(sum * 10) / 10
}

/**
 * Lines describing how to raise the Docker memory budget, tailored to the
 * host platform. Docker Desktop (macOS / Windows) caps the VM's memory in its
 * settings; native Linux Docker uses the host's RAM directly (so the cap there
 * usually means a Lima/Colima/WSL VM).
 */
function howToRaiseMemory(recommendGiB: number): string[] {
    const lines: string[] = []
    if (process.platform === 'darwin' || process.platform === 'win32') {
        lines.push(`      How to raise it (Docker Desktop): open Docker Desktop →`)
        lines.push(`      Settings (gear icon) → Resources → "Memory limit" slider →`)
        lines.push(`      set it to ≥ ${recommendGiB} GiB → "Apply & restart", then re-run.`)
        lines.push(`      (Make sure the host actually has that much free RAM.)`)
    } else {
        lines.push(`      How to raise it: native Linux Docker uses the host RAM directly,`)
        lines.push(`      so this usually means a VM cap. With Colima:`)
        lines.push(`        colima stop && colima start --memory ${recommendGiB}`)
        lines.push(`      With Docker Desktop / Lima / WSL2, raise the VM's memory in its`)
        lines.push(`      settings (or .wslconfig) to ≥ ${recommendGiB} GiB and restart it.`)
    }
    return lines
}

/**
 * Read the Docker runtime's advertised memory + cpu and compare to the
 * estimated need. Returns true when the run may proceed, false when it must be
 * HARD-blocked (insufficient memory — the default). The block is downgraded to
 * a warning-and-proceed only when `TSSQLQUERY_DOCKER_MEMORY_STRICT=0` (or
 * `false`) is set. A daemon that can't be queried is treated as "proceed" — we
 * never block on an unknown; the warmup that follows surfaces any real
 * connectivity problem.
 */
async function checkResources(engines: readonly string[]): Promise<boolean> {
    const need = requiredGiB(engines)
    let hostGiB: number
    let cpus: number
    try {
        const client = await getContainerRuntimeClient()
        hostGiB = client.info.containerRuntime.memory / BYTES_PER_GIB
        cpus = client.info.containerRuntime.cpus
    } catch (err) {
        console.warn(`[docker-preflight] could not read Docker runtime info (${(err as Error).message}); skipping the memory check.`)
        return true
    }

    const hostStr = hostGiB.toFixed(1)
    const engineList = engines.join(', ')
    console.error(`[docker-preflight] Docker: ${hostStr} GiB RAM, ${cpus} CPUs · selected engines: ${engineList} (≈ ${need} GiB needed)`)

    if (hostGiB >= need) return true

    // Insufficient memory. Block by default; only proceed when explicitly
    // downgraded to a warning via the opt-out env.
    const v = process.env['TSSQLQUERY_DOCKER_MEMORY_STRICT']
    const block = !(v === '0' || v === 'false' || v === 'off' || v === 'no')
    const recommend = Math.ceil(need + 2)
    console.error('')
    console.error(`  ❌ ERROR: Docker has only ${hostStr} GiB but the selected engines (${engineList})`)
    console.error(`     need ≈ ${need} GiB to run reliably under the parallel matrix.`)
    console.error('     Running anyway gets the biggest container OOM-killed mid-run — a cascade')
    console.error('     of "Failed to connect" / pool-exhaustion / hook-timeout failures that')
    console.error('     look like test bugs but are infrastructure starvation.')
    console.error('')
    for (const line of howToRaiseMemory(recommend)) console.error(line)
    console.error('')
    console.error(`      Or run fewer engines at once, e.g. \`bun run tests postgres/newest/pg --docker\`.`)
    console.error('')

    if (block) {
        console.error('  Aborting before the run. (Set TSSQLQUERY_DOCKER_MEMORY_STRICT=0 to proceed anyway.)')
        return false
    }
    console.error('  TSSQLQUERY_DOCKER_MEMORY_STRICT=0 set — proceeding despite the shortfall.')
    return true
}

/** Start one engine's container by driving a representative cell's up()/down(). */
async function warmupEngine(cell: RepCell): Promise<boolean> {
    let mod: { ctx?: WarmableContext }
    try {
        mod = await import(`../db/${cell.coord}/setup.js`) as { ctx?: WarmableContext }
    } catch (err) {
        console.warn(`[docker-preflight] ${cell.engine}: could not load ${cell.coord}/setup.ts (${(err as Error).message}); skipping warmup.`)
        return false
    }
    const ctx = mod.ctx
    if (!ctx) {
        console.warn(`[docker-preflight] ${cell.engine}: ${cell.coord}/setup.ts has no exported \`ctx\`; skipping warmup.`)
        return false
    }
    if (!ctx.realDbEnabled) {
        // The selection doesn't put this engine on a real container — nothing
        // to warm (shouldn't happen given the shell only passes real cells,
        // but it keeps the warmup honest if the gate logic drifts).
        console.error(`[docker-preflight] ${cell.engine}: not real-enabled under the current flags; skipping.`)
        return false
    }

    const budgetMs = ctx.timeoutMs > 0 ? ctx.timeoutMs : 360_000
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`warmup exceeded ${Math.round(budgetMs / 1000)}s`)), budgetMs)
    })
    try {
        await Promise.race([ctx.up(), timeout])
        console.error(`[docker-preflight] ${cell.engine}: ready (via ${cell.coord}).`)
        return true
    } catch (err) {
        console.warn(`[docker-preflight] ${cell.engine}: warmup did not complete (${(err as Error).message}); the lazy path will retry during the run.`)
        return false
    } finally {
        if (timer) clearTimeout(timer)
        // down() releases the test-side handles; the container itself stays
        // alive (reuse exempts it from Ryuk), which is the whole point.
        try { await ctx.down() } catch { /* best-effort */ }
    }
}

async function main(): Promise<number> {
    const reps = parseRepCells(process.argv.slice(2))
    if (reps.length === 0) {
        // Nothing real and docker-backed in this run — no-op.
        return 0
    }

    const engines = reps.map(r => r.engine)
    const mayProceed = await checkResources(engines)
    if (!mayProceed) return 3

    console.error(`[docker-preflight] warming ${reps.length} docker engine(s) sequentially: ${engines.join(', ')}`)
    for (const cell of reps) {
        await warmupEngine(cell)
    }
    return 0
}

// The representative `ctx.up()` calls open driver pools whose idle sockets
// keep the event loop alive, so a plain return would hang the process. The
// container lives in Docker (external to this process), so a hard exit after
// the warmup side effects are done is correct and clean.
main().then(
    (code) => process.exit(code),
    (err) => {
        console.warn(`[docker-preflight] unexpected error: ${(err as Error).stack ?? err}`)
        // Best-effort: never let a preflight glitch block the actual run.
        process.exit(0)
    },
)
