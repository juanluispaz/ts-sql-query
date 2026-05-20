// Factories that produce a `TestContext` for the oracle database.
//
// One factory per connector. Each `test/db/oracle/<version>/<connector>/setup.ts`
// is a thin call into the matching factory.
//
// The real engine runs in a generic testcontainers container (gvenzl/oracle-free
// image — Oracle Database Free 23ai). The oracledb driver and runner are
// loaded via dynamic import inside `createRealRunner` so the file parses
// with docker off (no testcontainer call ever fires).

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isRealDbEnabled } from '../../lib/backends.js'
import {
    BASE_ORACLE_USER,
    createContainerHandle,
    hashSqlFiles,
    memoizeSharedRunner,
    META_DB_NAME,
    reuseEnabled,
    SCHEMA_HASH_META_TABLE,
    VALIDATE_LOCK_NAME,
    workerName,
    workerNameLikePattern,
} from '../../lib/containerLifecycle.js'
import { createTestContext, type TestContext } from '../../lib/testContext.js'
import { DBConnection } from './domain/connection.js'

const DATABASE = 'oracle'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = resolve(__dirname, './domain/schema.sql')
const SEED_PATH = resolve(__dirname, './domain/seed.sql')

const ORACLE_IMAGE = 'gvenzl/oracle-free:23-slim-faststart'
const ORACLE_PASSWORD = 'OracleTestPass1!'
const SERVICE_NAME = 'FREEPDB1'
// Oracle has no separate "database" concept per test — each user owns a
// schema. The per-worker test "database" is therefore a per-worker user,
// and the meta "database" is its own user (META_DB_NAME / META_PASSWORD)
// disjoint from the worker users. `system` is used only to manage users
// (CREATE / DROP USER, GRANT) and to acquire the DBMS_LOCK; nothing
// else in the test infra ever sees it.
const APP_PASSWORD = 'TsAppPass1!'
const META_PASSWORD = 'MetaPass1!'

type StartedContainer = {
    getHost(): string
    getMappedPort(p: number): number
    stop(): Promise<unknown>
}

// Container is started lazily on the first acquire and kept alive for the
// entire test process — see `test/lib/containerLifecycle.ts`. With the
// `TESTCONTAINERS_REUSE_ENABLE=true` env var the container also survives
// across separate `bun test` invocations (especially valuable for the
// Oracle image, whose cold start is the longest of the suite).
const container = createContainerHandle<StartedContainer>(async () => {
    const { GenericContainer, Wait } = await import('testcontainers')
    const builder = new GenericContainer(ORACLE_IMAGE)
        .withEnvironment({
            ORACLE_PASSWORD,
        })
        .withExposedPorts(1521)
        .withWaitStrategy(Wait.forLogMessage(/DATABASE IS READY TO USE/, 1))
        .withStartupTimeout(300_000)
    if (reuseEnabled()) builder.withReuse()
    const started = (await builder.start()) as unknown as StartedContainer
    // Runs once per process. Validates the schema/seed hash against the
    // meta user and, when stale, drops every per-worker user (and the
    // meta user) so they get rebuilt cleanly. `DBMS_LOCK.request`
    // serialises this across workers running in parallel processes.
    await validateOrResetForReuse(started.getHost(), started.getMappedPort(1521))
    return started
})
const acquireContainer = container.acquire
const releaseContainer = container.release

async function validateOrResetForReuse(host: string, port: number): Promise<void> {
    const [schemaSql, seedSql] = await Promise.all([
        readFile(SCHEMA_PATH, 'utf8'),
        readFile(SEED_PATH, 'utf8'),
    ])
    const currentHash = await hashSqlFiles(schemaSql, seedSql)

    // `DBMS_LOCK` requires EXECUTE privilege; `system` has it. The lock
    // handle is released automatically when the session closes (we
    // pass `release_on_commit => FALSE` so it stays held across the
    // explicit DDL commits during reset and we release it manually at
    // the end).
    const oracledb = await import('oracledb')
    const conn = await oracledb.getConnection({
        user: 'system',
        password: ORACLE_PASSWORD,
        connectString: `${host}:${port}/${SERVICE_NAME}`,
    })
    try {
        await conn.execute(
            `DECLARE
               l_handle VARCHAR2(128);
               l_result NUMBER;
             BEGIN
               DBMS_LOCK.allocate_unique(:name, l_handle);
               l_result := DBMS_LOCK.request(
                 lockhandle => l_handle,
                 lockmode => DBMS_LOCK.x_mode,
                 timeout => 60,
                 release_on_commit => FALSE
               );
               IF l_result <> 0 THEN
                 RAISE_APPLICATION_ERROR(-20001, 'failed to acquire DBMS_LOCK: ' || l_result);
               END IF;
             END;`,
            { name: VALIDATE_LOCK_NAME },
        )
        try {
            let storedHash: string | null = null
            try {
                const res = await conn.execute<{ HASH: string }>(
                    `SELECT hash FROM ${META_DB_NAME}.${SCHEMA_HASH_META_TABLE} FETCH FIRST 1 ROWS ONLY`,
                    [],
                    { outFormat: oracledb.OUT_FORMAT_OBJECT },
                )
                storedHash = res.rows?.[0]?.HASH ?? null
            } catch {
                // Meta user / table missing — fresh container.
            }

            if (storedHash === currentHash) return

            // Enumerate and drop every existing worker user — both the
            // parallel-on pattern (`tsapp_w%`) and the parallel-off
            // bare name (`tsapp`). DROP USER ... CASCADE deletes the
            // user and every object it owns. ORA-01918 means the user
            // didn't exist (fresh container); ignore it.
            const userRes = await conn.execute<{ USERNAME: string }>(
                `SELECT username FROM dba_users
                  WHERE username = :base OR username LIKE :pat ESCAPE '\\'`,
                {
                    base: BASE_ORACLE_USER.toUpperCase(),
                    pat: workerNameLikePattern(BASE_ORACLE_USER).toUpperCase(),
                },
                { outFormat: oracledb.OUT_FORMAT_OBJECT },
            )
            const usersToDrop = (userRes.rows ?? []).map(r => r.USERNAME)
            // Add the meta user so we recreate it from scratch with a
            // fresh hash row.
            usersToDrop.push(META_DB_NAME.toUpperCase())
            for (const u of usersToDrop) {
                try {
                    await conn.execute(`DROP USER ${u} CASCADE`)
                } catch (err: any) {
                    if (err?.errorNum !== 1918) throw err
                }
            }
            await conn.execute(
                `CREATE USER ${META_DB_NAME} IDENTIFIED BY "${META_PASSWORD}"`,
            )
            await conn.execute(`GRANT CONNECT, RESOURCE TO ${META_DB_NAME}`)
            await conn.execute(`GRANT UNLIMITED TABLESPACE TO ${META_DB_NAME}`)
            await conn.commit()

            const metaConn = await oracledb.getConnection({
                user: META_DB_NAME,
                password: META_PASSWORD,
                connectString: `${host}:${port}/${SERVICE_NAME}`,
            })
            try {
                await metaConn.execute(
                    `CREATE TABLE ${SCHEMA_HASH_META_TABLE} (hash VARCHAR2(64) NOT NULL)`,
                )
                await metaConn.execute(
                    `INSERT INTO ${SCHEMA_HASH_META_TABLE} (hash) VALUES (:1)`,
                    [currentHash],
                )
                await metaConn.commit()
            } finally {
                await metaConn.close()
            }
        } finally {
            await conn.execute(
                `DECLARE
                   l_handle VARCHAR2(128);
                   l_result NUMBER;
                 BEGIN
                   DBMS_LOCK.allocate_unique(:name, l_handle);
                   l_result := DBMS_LOCK.release(l_handle);
                 END;`,
                { name: VALIDATE_LOCK_NAME },
            )
        }
    } finally {
        await conn.close()
    }
}

// Oracle statements can contain semicolons inside PL/SQL anonymous blocks
// (`BEGIN ... END;`). Naively splitting on `;` would break those. The
// schema/seed files keep one PL/SQL block per line so we can split on
// blank-line boundaries, fall back to `;` at end-of-line otherwise.
//
// `oracledb.execute()` expects DDL/DML without a trailing `;` but PL/SQL
// anonymous blocks require the closing `END;` to be syntactically valid,
// so the split re-adds the `;` for blocks that begin with `BEGIN`/`DECLARE`.
function splitStatements(sql: string): string[] {
    const out: string[] = []
    for (const block of sql.split(/^\s*$/m)) {
        for (const piece of block.split(/;\s*(?:\n|$)/)) {
            const stmt = stripSqlLineComments(piece).trim()
            if (stmt.length === 0) continue
            if (/^(?:begin|declare)\b/i.test(stmt)) {
                out.push(stmt + ';')
            } else {
                out.push(stmt)
            }
        }
    }
    return out
}

// Strip `-- …` single-line comments before checking for emptiness so a block
// containing only header comments doesn't reach Oracle as a bare statement
// (which fails with ORA-00900).
function stripSqlLineComments(sql: string): string {
    return sql.replace(/--[^\n]*/g, '')
}

// Once-per-process flag: the worker user only needs creating the first
// time the runner starts inside a given process. Subsequent
// `bootstrapWorkerUserSchemaAndSeed` / `applySchemaAndSeedToOpenedConnection`
// calls skip the system connection.
let workerUserEnsured = false

async function ensureWorkerUserExists(host: string, port: number, workerUser: string): Promise<void> {
    if (workerUserEnsured) return
    const oracledb = await import('oracledb')
    const sys = await oracledb.getConnection({
        user: 'system',
        password: ORACLE_PASSWORD,
        connectString: `${host}:${port}/${SERVICE_NAME}`,
    })
    try {
        const res = await sys.execute<{ COUNT: number }>(
            `SELECT COUNT(*) AS count FROM dba_users WHERE username = :u`,
            { u: workerUser.toUpperCase() },
            { outFormat: oracledb.OUT_FORMAT_OBJECT },
        )
        if ((res.rows?.[0]?.COUNT ?? 0) === 0) {
            // Two workers racing to CREATE USER would otherwise crash
            // with ORA-01920. Catch the duplicate and treat it as
            // success.
            try {
                await sys.execute(`CREATE USER ${workerUser} IDENTIFIED BY "${APP_PASSWORD}"`)
                await sys.execute(`GRANT CONNECT, RESOURCE TO ${workerUser}`)
                await sys.execute(`GRANT UNLIMITED TABLESPACE TO ${workerUser}`)
                await sys.commit()
            } catch (err: any) {
                if (err?.errorNum !== 1920) throw err
            }
        }
    } finally {
        await sys.close()
    }
    workerUserEnsured = true
}

async function applySchemaAndSeedToOpenedConnection(conn: import('oracledb').Connection): Promise<void> {
    const [schemaSql, seedSql] = await Promise.all([
        readFile(SCHEMA_PATH, 'utf8'),
        readFile(SEED_PATH, 'utf8'),
    ])
    for (const stmt of splitStatements(schemaSql)) {
        await conn.execute(stmt)
    }
    for (const stmt of splitStatements(seedSql)) {
        await conn.execute(stmt)
    }
    await conn.commit()
}

// First-time setup: the runner's pool does not exist yet because the worker
// user must be created before the pool can authenticate against it. This
// path opens a one-shot direct connection to bootstrap the schema/seed.
// Subsequent reseeds borrow from the runner's pool — see `onReseed` below.
async function bootstrapWorkerUserSchemaAndSeed(host: string, port: number): Promise<string> {
    const workerUser = workerName(BASE_ORACLE_USER)
    await ensureWorkerUserExists(host, port, workerUser)

    const oracledb = await import('oracledb')
    const conn = await oracledb.getConnection({
        user: workerUser,
        password: APP_PASSWORD,
        connectString: `${host}:${port}/${SERVICE_NAME}`,
    })
    try {
        await applySchemaAndSeedToOpenedConnection(conn)
    } finally {
        await conn.close()
    }
    return workerUser
}

// ---- Real oracle (docker) test context ----------------------------------

export interface OracleTestSpec {
    label: string
    canonicalForDocs?: boolean
    compatibilityVersion?: number
}

export function createOracleDBPoolTestContext(spec: OracleTestSpec): TestContext<DBConnection> {
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ true)
    const buildRunner = memoizeSharedRunner(async (params: { host: string; port: number; workerUser: string }) => {
        const oracledb = await import('oracledb')
        const { OracleDBPoolQueryRunner } = await import('../../../src/queryRunners/OracleDBPoolQueryRunner.js')
        const pool = await oracledb.createPool({
            user: params.workerUser,
            password: APP_PASSWORD,
            connectString: `${params.host}:${params.port}/${SERVICE_NAME}`,
            poolMin: 1,
            poolMax: 4,
        })
        return {
            runner: new OracleDBPoolQueryRunner(pool),
            shutdown: async () => { await pool.close(0) },
        }
    })

    return createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'oracle',
        realDbEnabled,
        timeoutMs: 300_000,
        async createRealRunner() {
            const container = await acquireContainer()
            const host = container.getHost()
            const port = container.getMappedPort(1521)
            const workerUser = await bootstrapWorkerUserSchemaAndSeed(host, port)
            return await buildRunner({ host, port, workerUser })
        },
        async onReseed(runner) {
            // Reuse the runner's existing oracledb pool instead of opening a
            // fresh driver-level connection (which costs an Oracle auth
            // handshake on every test that exercises a commit path — a real
            // bottleneck under the parallel matrix).
            const pool = runner.getNativeRunner() as import('oracledb').Pool
            const conn = await pool.getConnection()
            try {
                await applySchemaAndSeedToOpenedConnection(conn)
            } finally {
                await conn.close()  // releases back to pool
            }
        },
        async onDown() {
            await releaseContainer()
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    })
}
