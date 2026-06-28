// Shared lifecycle helper for the docker-backed runners.
//
// Each runner used to start its container on the first `ctx.up()` and stop
// it as soon as the matching `ctx.down()` brought the refcount back to 0.
// `bun:test` (and vitest, by default) runs the `.test.ts` files of a cell
// sequentially in the same process, so the refcount oscillated `0 → 1 → 0`
// between every file, paying the container start-up cost again and again.
//
// The helper here flips the model: the container is started lazily on the
// first acquire and kept alive for the entire test process. Testcontainers'
// Ryuk sidecar reaps the container when the process exits (clean or crashy),
// so we still have zero leftover containers. The refcount is kept only for
// `acquireCount` instrumentation; release is a no-op for container
// lifecycle.
//
// Cross-process reuse is opt-in via the standard testcontainers env var
// `TESTCONTAINERS_REUSE_ENABLE=true`. Runners that wire `.withReuse()` into
// their builder will then keep the same container alive across separate
// `bun test` invocations, paying the start-up cost once per developer
// session instead of once per run.

export type AcquireFn<C> = () => Promise<C>

export interface ContainerHandle<C> {
    /** Get the container, starting it on first call (or reusing the running one). */
    acquire: () => Promise<C>
    /** Decrement the in-process refcount. The container is NOT stopped here. */
    release: () => Promise<void>
    /** Stop and forget the container immediately. Currently unused in normal
     *  flows — Ryuk handles cleanup at process exit — but exposed for tests
     *  that need to assert teardown behaviour. */
    forceStop: () => Promise<void>
}

/**
 * `reuseEnabled()` reports whether the testcontainers cross-process reuse
 * flag is set. Runners can branch on this to call `.withReuse()` on their
 * builder.
 */
export function reuseEnabled(): boolean {
    return process.env['TESTCONTAINERS_REUSE_ENABLE'] === 'true'
}

/**
 * Stable name for the meta table each runner writes the schema/seed hash
 * into. Picked to be obvious in `\dt` output, unlikely to collide with
 * any documented domain table, and a valid unquoted identifier in every
 * dialect we support (Oracle in particular rejects leading underscores
 * for unquoted identifiers).
 */
export const SCHEMA_HASH_META_TABLE = 'tssqlquery_meta'

/**
 * Name of the dedicated control database where the schema-hash meta
 * table lives. Separated from the worker test databases so the per-worker
 * reset logic does not have to special-case "the database that owns the
 * hash row". Same string serves as the Oracle meta user (Oracle has no
 * separate database concept — each user owns a schema, so the meta
 * "database" is a user with one table in it).
 */
export const META_DB_NAME = 'tssqlquery_meta'

/**
 * Base name of the per-worker test database. The actual database name
 * is `${BASE_WORKER_DB_NAME}_w${workerId}` when parallel mode is on,
 * or just `${BASE_WORKER_DB_NAME}` when it is off. Oracle uses
 * `${BASE_ORACLE_USER}` as the per-worker schema-owner instead.
 */
export const BASE_WORKER_DB_NAME = 'tssqlquery'
export const BASE_ORACLE_USER = 'tsapp'

/**
 * Read the worker id from whichever env var the active test runner
 * sets. Both `bun test` and `vitest` expose Jest-compatible IDs (so
 * does `jest`), so a single helper covers all three. Returns 1 when
 * none is set — that is the right answer for a serial single-process
 * invocation, where everyone shares "worker 1".
 *
 * IDs are 1-based across all three runners; we preserve that.
 */
export function workerId(): number {
    const candidates = [
        process.env['BUN_TEST_WORKER_ID'],
        process.env['VITEST_POOL_ID'],
        process.env['JEST_WORKER_ID'],
    ]
    for (const v of candidates) {
        if (v === undefined || v === '') continue
        const n = Number(v)
        if (Number.isFinite(n) && n > 0) return Math.floor(n)
    }
    return 1
}

/**
 * Parallel-DBs mode is on by default and turned off explicitly by
 * setting `TSSQLQUERY_PARALLEL_DBS=false`. When on, every worker gets
 * its own database (or Oracle user); when off, every worker shares the
 * single legacy database. The opt-out exists for resource-constrained
 * setups and for debugging a single failing cell in isolation.
 */
export function parallelDbsEnabled(): boolean {
    return process.env['TSSQLQUERY_PARALLEL_DBS'] !== 'false'
}

/**
 * Compose the per-worker name for a given base prefix. With parallel
 * mode off this returns the base verbatim (single shared name). With
 * parallel mode on it appends `_w<id>`.
 *
 * Use it for both database names (`workerName('tssqlquery')`) and
 * Oracle users (`workerName('tsapp')`).
 */
export function workerName(base: string): string {
    if (!parallelDbsEnabled()) return base
    return `${base}_w${workerId()}`
}

/**
 * SQL LIKE pattern that matches every per-worker name derived from the
 * same base, used by the validator to drop every worker DB (or every
 * Oracle worker user) when the schema/seed hash changes. The pattern
 * deliberately does NOT match the bare base name (parallel-off mode):
 * the reset path adds the base name explicitly so the same code path
 * cleans up both layouts.
 */
export function workerNameLikePattern(base: string): string {
    return `${base}\\_w%`
}

/**
 * Stable BIGINT key passed to `pg_advisory_lock`. Derived from
 * "ts-sql-query/validate" — pinned so any process attached to the same
 * postgres cluster competes for the same lock. Keep it inside the
 * postgres BIGINT range.
 */
export const VALIDATE_LOCK_KEY_BIGINT = 7321819874823123n

/**
 * Stable string handle for the engines that take a named lock
 * (`GET_LOCK` on mysql/mariadb, `sp_getapplock` on sqlserver,
 * `DBMS_LOCK.allocate_unique` on oracle).
 */
export const VALIDATE_LOCK_NAME = 'tssqlquery_validate'

/**
 * Memoise a connector-level runner factory so the underlying pool /
 * connection is built exactly once per worker process and reused
 * across every test file the worker handles. The original `shutdown`
 * is intentionally never called — the resource lives until the
 * process exits, mirroring the `createContainerHandle` keep-alive
 * pattern.
 *
 * The factory is called with whatever per-file argument the engine's
 * `createRealRunner` passes (e.g. a worker DB URI). Subsequent calls
 * ignore the argument and return the cached runner: in practice the
 * argument is process-stable (it derives from `workerName(...)` and
 * env vars), and rejecting changes makes the contract obvious.
 *
 * Use this from inside every engine-specific factory in
 * `test/db/<engine>/runners.ts` so individual `setup.ts` files don't
 * have to grow per-connector memoisation state.
 *
 * `forceNew` rebuilds the cached resource from scratch (new pool + runner)
 * and replaces the shared entry, so every later call sees the fresh one too.
 * The previous resource is left to leak (consistent with the
 * never-shutdown-the-pool model above; the OS reclaims it at process exit).
 * The test harness uses this to DISCARD a connection whose transaction state
 * was poisoned by a commit that failed mid-flight under load — see
 * `recreateRealRunnerIfPoisoned` in `testContext.ts`.
 */
export function memoizeSharedRunner<ARG, RUNNER>(
    factory: (arg: ARG) => Promise<{ runner: RUNNER; shutdown(): Promise<void> }>,
): (arg: ARG, forceNew?: boolean) => Promise<{ runner: RUNNER; shutdown(): Promise<void> }> {
    let cached: { runner: RUNNER; shutdown(): Promise<void> } | null = null
    return async (arg: ARG, forceNew = false) => {
        if (cached === null || forceNew) {
            const built = await factory(arg)
            cached = {
                runner: built.runner,
                // Swallow the original shutdown — the pool/connection
                // is shared across every test file in this worker.
                // The OS reclaims sockets at process exit.
                shutdown: async () => { /* shared lifetime, intentional no-op */ },
            }
        }
        return cached
    }
}

/**
 * Hash the content of the SQL files that define the test domain
 * (typically `schema.sql` + `seed.sql`). The result is stored in
 * `SCHEMA_HASH_META_TABLE` on the reused container so the next process
 * to attach can tell whether anything changed.
 */
export async function hashSqlFiles(...contents: string[]): Promise<string> {
    const { createHash } = await import('node:crypto')
    const h = createHash('sha256')
    for (const c of contents) h.update(c)
    return h.digest('hex')
}

/**
 * Cross-process mutex backed by an exclusive lockfile in `os.tmpdir()`.
 * Used to serialise the testcontainers reuse-lookup-then-create dance
 * across parallel worker processes: testcontainers' own
 * `reusableContainerCreationLock` is in-process only, so 12 bun
 * workers all calling `withReuse().start()` at the same instant race
 * past `fetchByLabel` (no container has the hash label visible yet)
 * and each create their own container. Holding this lock around the
 * factory means only the first worker reaches `docker create`; the
 * rest wait on the lockfile, then find the container by hash label
 * and reuse it.
 *
 * Stale locks left by a crashed process are reclaimed once the file's
 * mtime is older than `staleMs` (default 5 min — comfortably above a
 * cold container start).
 */
async function withCrossProcessLock<T>(name: string, fn: () => Promise<T>, staleMs = 5 * 60_000): Promise<T> {
    const { open: fsOpen, stat: fsStat, unlink: fsUnlink } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join: pathJoin } = await import('node:path')

    const sanitized = name.replace(/[^A-Za-z0-9._-]/g, '_')
    const lockPath = pathJoin(tmpdir(), `ts-sql-query-${sanitized}.lock`)

    while (true) {
        try {
            const handle = await fsOpen(lockPath, 'wx')
            try {
                return await fn()
            } finally {
                try { await handle.close() } catch { /* ignore */ }
                try { await fsUnlink(lockPath) } catch { /* ignore */ }
            }
        } catch (err) {
            const e = err as NodeJS.ErrnoException
            if (e.code !== 'EEXIST') throw err
            // Lock is held by another process — or by a dead one.
            try {
                const st = await fsStat(lockPath)
                if (Date.now() - st.mtimeMs > staleMs) {
                    await fsUnlink(lockPath).catch(() => undefined)
                }
            } catch { /* stat race — the holder may have just released; retry */ }
            await new Promise(resolve => setTimeout(resolve, 50))
        }
    }
}

/**
 * Wrap a lazy container factory in the keep-alive lifecycle described above.
 * `factory` is called exactly once per process — subsequent acquires return
 * the same `Promise`.
 *
 * When `options.lockKey` is set AND testcontainers reuse is enabled, the
 * first factory call in this process is also serialised across processes
 * via a lockfile keyed by `lockKey`. This prevents parallel workers from
 * racing past testcontainers' `fetchByLabel` lookup and creating duplicate
 * containers with the same reuse hash. The `lockKey` should be stable per
 * runner (e.g. the docker image name) so all workers funnel through the
 * same lockfile.
 */
export function createContainerHandle<C extends { stop: () => Promise<unknown> }>(
    factory: AcquireFn<C>,
    options: { lockKey?: string } = {},
): ContainerHandle<C> {
    let promise: Promise<C> | null = null

    return {
        async acquire(): Promise<C> {
            if (promise === null) {
                promise = options.lockKey !== undefined && reuseEnabled()
                    ? withCrossProcessLock(options.lockKey, factory)
                    : factory()
            }
            return await promise
        },
        async release(): Promise<void> {
            // Intentional no-op: we used to `c.stop()` here when the
            // refcount hit zero, which killed the container between every
            // test file. The container is now stopped only when the test
            // process exits (Ryuk handles that automatically).
        },
        async forceStop(): Promise<void> {
            if (promise === null) return
            const current = promise
            promise = null
            const c = await current
            await c.stop()
        },
    }
}
