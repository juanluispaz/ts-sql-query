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
    createContainerRegistry,
    hashSqlFiles,
    memoizeSharedRunner,
    META_DB_NAME,
    reuseEnabled,
    SCHEMA_HASH_META_TABLE,
    VALIDATE_LOCK_NAME,
    workerName,
    workerNameLikePattern,
    type RunnerConnectionFailure,
    UNREACHABLE_PORT,
} from '../../lib/containerLifecycle.js'
import { imageForCell, newestImage } from '../../lib/dockerImages.js'
import { createTestContext, type TestContext } from '../../lib/testContext.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { DBConnection } from './domain/connection.js'


/**
 * `TestContext<DBConnection>` extended with Oracle-specific connection
 * factories. Each `withXxx(...)` returns a `DBConnection` (subclass)
 * whose protected config field is pinned to the requested value. The
 * subclass shares `ctx.conn`'s underlying `CaptureInterceptor` /
 * driver, so:
 *
 *   - SQL emitted by the alt connection lands in `ctx.lastSql`.
 *   - In real-DB mode the query reaches the same backing database
 *     `ctx.conn` sees — no second driver-level connection is opened.
 *
 * These factories are the **only** sanctioned way to instantiate a
 * `DBConnection` inside a test file; tests must not construct their
 * own runner or `new DBConnection(...)`.
 */
export interface OracleTestContext extends TestContext<DBConnection> {
    /**
     * A collation name accepted by the underlying engine — used by
     * `config.insensitive-collation.test.ts` so the
     * `insensitiveCollation = '<name>'` branch emits SQL that
     * actually runs against the real DB. Each dialect picks the
     * built-in case-insensitive collation that ships with a default
     * install (SQLite: `NOCASE`, PostgreSQL: `"C"`, MySQL/MariaDB:
     * `utf8mb4_general_ci`, Oracle: `BINARY_CI`, SQL Server:
     * `Latin1_General_CI_AS`).
     */
    readonly exampleInsensitiveCollation: string
    // A collation with which the equality ignores case
    readonly exampleCollationForInsensitiveEquality: string
    /** A `DBConnection` whose `insensitiveCollation` is pinned to `collation`. */
    withInsensitiveCollation(collation: string | undefined): DBConnection
    /**
     * A `DBConnection` whose `replaceInsensitiveCollation` is pinned to
     * `collation` — the Oracle-only knob for how `replaceAllInsensitive`
     * collates each operand (`''` opts out to a bare `replace(...)`).
     */
    withReplaceInsensitiveCollation(collation: string): DBConnection
    /** A `DBConnection` whose `uuidStrategy` is pinned to `strategy`. */
    withUuidStrategy(strategy: 'string' | 'custom-functions' | 'built-in'): DBConnection
    /** A `DBConnection` with `allowEmptyString` enabled (empty strings kept, not mapped to null). */
    withAllowEmptyString(): DBConnection
    /** A `DBConnection` whose `replaceCollation` is pinned to `collation` (`''` opts out to a bare `replace(...)`). */
    withReplaceCollation(collation: string): DBConnection
    /** A `DBConnection` whose `concatFunction` is pinned to `functionName`. */
    withConcatFunction(functionName: string): DBConnection
    /** A `DBConnection` with `ignoreNullInConcat` enabled (keeps Oracle's native `||` NULL semantics). */
    withIgnoreNullInConcat(): DBConnection
}

/**
 * Wrap a base `TestContext<DBConnection>` with Oracle-specific
 * connection factories. Each `withXxx` reaches into the live
 * `ctx.conn.queryRunner` (the shared interceptor) — `ctx.up()` must
 * have run before any helper is called.
 */
function decorateOracleContext(base: TestContext<DBConnection>): OracleTestContext {
    return Object.assign(base, {
        exampleInsensitiveCollation: 'BINARY_CI',
        exampleCollationForInsensitiveEquality: 'BINARY_CI',
        withInsensitiveCollation(collation: string | undefined): DBConnection {
            class C extends DBConnection {
                protected override insensitiveCollation: string | undefined = collation
            }
            return base.withConnection(C)
        },
        withAllowEmptyString(): DBConnection {
            class C extends DBConnection {
                protected override allowEmptyString = true
            }
            return base.withConnection(C)
        },
        withReplaceCollation(collation: string): DBConnection {
            class C extends DBConnection {
                protected override replaceCollation = collation
            }
            return base.withConnection(C)
        },
        withConcatFunction(functionName: string): DBConnection {
            class C extends DBConnection {
                protected override concatFunction = functionName
            }
            return base.withConnection(C)
        },
        withIgnoreNullInConcat(): DBConnection {
            class C extends DBConnection {
                protected override ignoreNullInConcat = true
            }
            return base.withConnection(C)
        },
        withReplaceInsensitiveCollation(collation: string): DBConnection {
            class C extends DBConnection {
                protected override replaceInsensitiveCollation = collation
            }
            return base.withConnection(C)
        },
        withUuidStrategy(strategy: 'string' | 'custom-functions' | 'built-in'): DBConnection {
            class C extends DBConnection {
                protected override uuidStrategy: 'string' | 'custom-functions' | 'built-in' = strategy
            }
            return base.withConnection(C)
        },
    })
}

const DATABASE = 'oracle'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = resolve(__dirname, './domain/schema.sql')
const SEED_PATH = resolve(__dirname, './domain/seed.sql')
// Data-only reset used by the per-test reseed (onReseed) in place of the full
// schema rebuild — see ./domain/reset.sql. schema.sql's DROP+CREATE is kept
// only for the once-per-worker bootstrap. The reduction matters most here:
// every worker user shares one instance's data dictionary.
const RESET_PATH = resolve(__dirname, './domain/reset.sql')

// ---- Boolean storage ----------------------------------------------------
//
// A cell stores booleans one of two ways (`booleanStorage` of
// `OracleConnection`): `'number'`, a `NUMBER(1)` with 1 / 0 (the default, every
// Oracle version), or `'boolean'`, Oracle 23ai's `BOOLEAN` (only the `newest`
// tier: the older engines have no BOOLEAN).
//
// The `'boolean'` cells run against a variant of the shared domain, generated
// from schema.sql when it is read: the columns the domain declares as plain
// `boolean` (no CustomBooleanTypeAdapter) become `BOOLEAN`. `invoiced` stays a
// `NUMBER(1)`: it is declared with `CustomBooleanTypeAdapter(1, 0)`, the form a
// `NUMBER(1)` column takes when the storage is `'boolean'`. Each listed
// column must be declared exactly once as `NUMBER(1)`, so a change of
// schema.sql that moves one fails loud instead of leaving it a number.
//
// The variant lives in worker users of its own (`tsappbool`, `tsappbool_w<n>`),
// so a worker that runs cells of both storages never shares a table between
// the two schemas.
type BooleanStorage = 'number' | 'boolean'

const BOOLEAN_STORAGE_ORACLE_USER = `${BASE_ORACLE_USER}bool`

const NATIVE_BOOLEAN_COLUMNS = ['billable', 'is_signed', 'm_bool'] as const

function toNativeBooleanSchema(schemaSql: string): string {
    let out = schemaSql
    for (const column of NATIVE_BOOLEAN_COLUMNS) {
        const re = new RegExp(`^(\\s+${column}\\s+)NUMBER\\(1\\)`, 'gm')
        const count = out.match(re)?.length ?? 0
        if (count !== 1) {
            throw new Error(`test/db/oracle/runners.ts: the column ${column} must be declared once as NUMBER(1) in ${SCHEMA_PATH} to get its BOOLEAN variant, found ${count}`)
        }
        out = out.replace(re, '$1BOOLEAN')
    }
    return out
}

// The schema, seed and reset of a storage. The seed and the reset are the same
// for both: Oracle 23ai converts the 1 / 0 the seed inserts into a BOOLEAN
// column to true / false.
async function readDomainSql(storage: BooleanStorage): Promise<{ schema: string, seed: string, reset: string }> {
    const [schema, seed, reset] = await Promise.all([
        readFile(SCHEMA_PATH, 'utf8'),
        readFile(SEED_PATH, 'utf8'),
        readFile(RESET_PATH, 'utf8'),
    ])
    return { schema: storage === 'boolean' ? toNativeBooleanSchema(schema) : schema, seed, reset }
}

// The connection of a `'boolean'` cell.
class BooleanStorageDBConnection extends DBConnection {
    protected override booleanStorage: 'number' | 'boolean' = 'boolean'
}

const ORACLE_PASSWORD = 'OracleTestPass1!'

// The Oracle service name depends on the image: gvenzl/oracle-free (23ai,
// newest) registers `FREEPDB1`, but gvenzl/oracle-xe (pre-23ai, used by the
// `oldest` folder under `--docker-version closest`) registers `XEPDB1` — an
// oracle-xe container rejects a `FREEPDB1` connectString with NJS-518. Deriving
// the name from the resolved image keeps every connectString correct without a
// per-call constant. A normal run resolves one oracle image per process
// (all-newest under `--docker-version latest`, or the single version under
// `closest`, guardrailed to ≤1 version/engine), so the value is stable
// process-wide.
function isOracleXeImage(image: string): boolean {
    return image.startsWith('gvenzl/oracle-xe')
}
function serviceNameForImage(image: string): string {
    return isOracleXeImage(image) ? 'XEPDB1' : 'FREEPDB1'
}
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
// Oracle image, whose cold start is the longest of the suite). `lockKey`
// serialises the first-acquire across worker processes so the
// reuse-lookup-then-create dance in testcontainers (which holds only an
// in-process lock) doesn't spawn duplicate containers under cold start.
const containers = createContainerRegistry<StartedContainer>(async (image) => {
    if (image !== newestImage(DATABASE)) {
        console.error(`[docker-version] ${DATABASE}: using ${image}`)
    }
    const { GenericContainer, Wait } = await import('testcontainers')
    const builder = new GenericContainer(image)
        .withEnvironment({
            ORACLE_PASSWORD,
        })
        .withExposedPorts(1521)
        .withWaitStrategy(Wait.forLogMessage(/DATABASE IS READY TO USE/, 1))
        .withStartupTimeout(300_000)
    if (reuseEnabled()) builder.withReuse()
    const started = (await builder.start()) as unknown as StartedContainer
    // Runs once per process per image. Validates the schema/seed hash against
    // the meta user and, when stale, drops every per-worker user (and the
    // meta user) so they get rebuilt cleanly. `DBMS_LOCK.request`
    // serialises this across workers running in parallel processes.
    await validateOrResetForReuse(started.getHost(), started.getMappedPort(1521), serviceNameForImage(image))
    return started
})

async function validateOrResetForReuse(host: string, port: number, serviceName: string): Promise<void> {
    // One hash covers both storages: the SQL the `number` users get and the SQL
    // the `boolean` users get, so a change of either rebuilds every worker user.
    const numberSql = await readDomainSql('number')
    const booleanSql = await readDomainSql('boolean')
    const currentHash = await hashSqlFiles(numberSql.schema, numberSql.seed, booleanSql.schema, booleanSql.seed)

    // `DBMS_LOCK` requires EXECUTE privilege; `system` has it. The lock
    // handle is released automatically when the session closes (we
    // pass `release_on_commit => FALSE` so it stays held across the
    // explicit DDL commits during reset and we release it manually at
    // the end).
    const oracledb = (await import('oracledb')).default
    const conn = await oracledb.getConnection({
        user: 'system',
        password: ORACLE_PASSWORD,
        connectString: `${host}:${port}/${serviceName}`,
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

            // Enumerate and drop every existing worker user of both storages —
            // the parallel-on pattern (`tsapp_w%`, `tsappbool_w%`) and the
            // parallel-off bare name (`tsapp`, `tsappbool`). DROP USER ...
            // CASCADE deletes the user and every object it owns. ORA-01918
            // means the user didn't exist (fresh container); ignore it.
            const usersToDrop: string[] = []
            for (const baseUser of [BASE_ORACLE_USER, BOOLEAN_STORAGE_ORACLE_USER]) {
                const userRes = await conn.execute<{ USERNAME: string }>(
                    `SELECT username FROM dba_users
                      WHERE username = :base OR username LIKE :pat ESCAPE '\\'`,
                    {
                        base: baseUser.toUpperCase(),
                        pat: workerNameLikePattern(baseUser).toUpperCase(),
                    },
                    { outFormat: oracledb.OUT_FORMAT_OBJECT },
                )
                usersToDrop.push(...(userRes.rows ?? []).map(r => r.USERNAME))
            }
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
                connectString: `${host}:${port}/${serviceName}`,
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
//
// `CREATE [OR REPLACE] PROCEDURE/FUNCTION/TRIGGER/PACKAGE` blocks
// contain internal `;` between statements in the body. Treating each
// such CREATE as one indivisible block (no `;\n` split) keeps the
// definition intact; the harness then passes it straight through to
// `oracledb.execute()`, which IS happy to compile PL/SQL bodies as
// long as the trailing `END;` is preserved (we strip a trailing `;`
// and re-add exactly one).
function splitStatements(sql: string): string[] {
    const out: string[] = []
    for (const block of sql.split(/^\s*$/m)) {
        const blockTrimmed = stripSqlLineComments(block).trim()
        if (blockTrimmed.length === 0) continue
        if (/^create\s+(?:or\s+replace\s+)?(?:procedure|function|trigger|package(?:\s+body)?)\b/i.test(blockTrimmed)) {
            out.push(blockTrimmed.replace(/;?\s*$/, '') + ';')
            continue
        }
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

// Once-per-process record: a worker user only needs creating the first
// time the runner starts inside a given process. Subsequent
// `bootstrapWorkerUserSchemaAndSeed` / `applySchemaAndSeedToOpenedConnection`
// calls skip the system connection. Keyed by user: a process that runs cells
// of both boolean storages owns one user of each.
const workerUsersEnsured = new Set<string>()

async function ensureWorkerUserExists(host: string, port: number, workerUser: string, image: string): Promise<void> {
    if (workerUsersEnsured.has(workerUser)) return
    const serviceName = serviceNameForImage(image)
    const oracledb = (await import('oracledb')).default
    const sys = await oracledb.getConnection({
        user: 'system',
        password: ORACLE_PASSWORD,
        connectString: `${host}:${port}/${serviceName}`,
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
        // gvenzl/oracle-xe (pre-23ai): its RESOURCE role does NOT include
        // CREATE VIEW, so the shared domain's `CREATE OR REPLACE VIEW …`
        // statements fail with ORA-01031 during schema apply. oracle-free
        // (23ai) creates those views fine under RESOURCE alone, so the grant
        // is only needed — and only issued — on oracle-xe. Idempotent, so it
        // also repairs a worker user carried over (without the grant) in a
        // reused container.
        if (isOracleXeImage(image)) {
            await sys.execute(`GRANT CREATE VIEW TO ${workerUser}`)
            await sys.commit()
        }
        // Reading v$session, to wait for a statement of another session to be running (the runner tests); `system`
        // can't grant v_$session itself (ORA-01031). Idempotent, so it also repairs a user of a reused container.
        await sys.execute(`GRANT SELECT_CATALOG_ROLE TO ${workerUser}`)
        await sys.commit()
    } finally {
        await sys.close()
    }
    workerUsersEnsured.add(workerUser)
}

async function applySchemaAndSeedToOpenedConnection(conn: import('oracledb').Connection, storage: BooleanStorage): Promise<void> {
    const sql = await readDomainSql(storage)
    for (const stmt of splitStatements(sql.schema)) {
        await conn.execute(stmt)
    }
    for (const stmt of splitStatements(sql.seed)) {
        await conn.execute(stmt)
    }
    await conn.commit()
}

// Data-only baseline restore used by the per-test reseed: reset.sql (DELETE +
// identity/sequence rewind) instead of the heavy schema.sql, then the same
// seed. Leaves the exact post-bootstrap state without the DROP+CREATE
// shared-dictionary churn.
async function applyResetAndSeedToOpenedConnection(conn: import('oracledb').Connection, storage: BooleanStorage): Promise<void> {
    const sql = await readDomainSql(storage)
    for (const stmt of splitStatements(sql.reset)) {
        await conn.execute(stmt)
    }
    for (const stmt of splitStatements(sql.seed)) {
        await conn.execute(stmt)
    }
    await conn.commit()
}

// Oracle 23ai (gvenzl/oracle-free, `newest`) ships built-in UUID_TO_RAW /
// RAW_TO_UUID; pre-23ai (gvenzl/oracle-xe, `oldest` under
// `--docker-version closest`) does NOT, so the shared seed's `UUID_TO_RAW(...)`
// and the library's emitted `raw_to_uuid(...)` would fail. On oracle-xe the
// runner creates these as user-defined functions in the worker schema before
// applying schema/seed; Oracle resolves the names case-insensitively, so they
// stand in for the missing built-ins. Canonical (non-reordering) bodies from
// docs/configuration/supported-databases/oracle.md § UUID utility functions —
// the 16 bytes are stored as-is (accepts any hex, including the v4 uuids in the
// seed), and the read wraps in `lower(...)` so the output matches Oracle 23ai's
// lowercase built-in and the same value assertions pass on both images. The
// `raw_to_uuid` NULL guard is required beyond the docs snippet: Oracle's `||`
// reads NULL as '' so an unguarded body would return '----' for a NULL RAW
// (breaking the NULL rows), whereas the 23ai built-in returns NULL. Kept
// out of the shared schema.sql/seed.sql so `newest` keeps its real built-ins.
// One blank-line-separated CREATE per block so `splitStatements` emits each as
// its own statement (its CREATE FUNCTION branch keeps the PL/SQL body intact).
const ORACLE_XE_UUID_FUNCTIONS_SQL = `
CREATE OR REPLACE FUNCTION uuid_to_raw(uuid IN char) RETURN raw AS
BEGIN
    RETURN HEXTORAW(REPLACE(uuid, '-'));
END uuid_to_raw;

CREATE OR REPLACE FUNCTION raw_to_uuid(raw_uuid IN raw) RETURN char IS
    hex_text char(32);
BEGIN
    IF raw_uuid IS NULL THEN RETURN NULL; END IF;
    hex_text := RAWTOHEX(raw_uuid);
    RETURN lower(SUBSTR(hex_text, 1, 8) || '-' ||
                 SUBSTR(hex_text, 9, 4) || '-' ||
                 SUBSTR(hex_text, 13, 4) || '-' ||
                 SUBSTR(hex_text, 17, 4) || '-' ||
                 SUBSTR(hex_text, 21));
END raw_to_uuid;
`

async function applyUuidCompatFunctions(conn: import('oracledb').Connection): Promise<void> {
    for (const stmt of splitStatements(ORACLE_XE_UUID_FUNCTIONS_SQL)) {
        await conn.execute(stmt)
    }
    await conn.commit()
}

// First-time setup: the runner's pool does not exist yet because the worker
// user must be created before the pool can authenticate against it. This
// path opens a one-shot direct connection to bootstrap the schema/seed.
// Subsequent reseeds borrow from the runner's pool — see `onReseed` below.
async function bootstrapWorkerUserSchemaAndSeed(host: string, port: number, image: string, storage: BooleanStorage = 'number'): Promise<string> {
    const serviceName = serviceNameForImage(image)
    const workerUser = workerName(storage === 'boolean' ? BOOLEAN_STORAGE_ORACLE_USER : BASE_ORACLE_USER)
    await ensureWorkerUserExists(host, port, workerUser, image)

    const oracledb = (await import('oracledb')).default
    const conn = await oracledb.getConnection({
        user: workerUser,
        password: APP_PASSWORD,
        connectString: `${host}:${port}/${serviceName}`,
    })
    try {
        // Create the UUID compat functions BEFORE schema/seed so the seed's
        // UUID_TO_RAW resolves. oracle-free (23ai) keeps its real built-ins.
        if (isOracleXeImage(image)) {
            await applyUuidCompatFunctions(conn)
        }
        await applySchemaAndSeedToOpenedConnection(conn, storage)
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
    /**
     * How the connection stores a boolean (`booleanStorage` of
     * `OracleConnection`): `'number'` (the default, `NUMBER(1)` 1 / 0) or
     * `'boolean'` (Oracle 23ai's `BOOLEAN`). With `'boolean'` the cell gets
     * the schema variant of `readDomainSql('boolean')` in worker users of its
     * own, and every connection of the context stores booleans natively.
     */
    booleanStorage?: BooleanStorage
}

export function createOracleDBPoolTestContext(spec: OracleTestSpec): OracleTestContext {
    const version = spec.label.split(' / ')[0] ?? ''
    const connector = spec.label.split(' / ')[1] ?? ''
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ true, version, connector)
    const image = imageForCell(DATABASE, version, realDbEnabled)
    const serviceName = serviceNameForImage(image)
    const booleanStorage: BooleanStorage = spec.booleanStorage ?? 'number'
    const buildRunner = memoizeSharedRunner(async (params: { host: string; port: number; workerUser: string }) => {
        const oracledb = (await import('oracledb')).default
        const { OracleDBPoolQueryRunner } = await import('../../../src/queryRunners/OracleDBPoolQueryRunner.js')
        const pool = await oracledb.createPool({
            user: params.workerUser,
            password: APP_PASSWORD,
            connectString: `${params.host}:${params.port}/${serviceName}`,
            // Open connections lazily (poolMin 0) instead of eagerly establishing
            // one per worker at createPool time. With ~12 workers that is 12
            // simultaneous Oracle auth handshakes against the shared instance at
            // the start of the parallel pass; since tests run sequentially within
            // a worker, the first query creates the connection just-in-time with
            // no contention spike. poolMax unchanged for the rare multi-connection
            // test (transaction + reseed borrow).
            poolMin: 0,
            poolMax: 4,
            // The driver's statement cache keys on the SQL TEXT and retains the
            // bind-type metadata of the first execution. This suite emits the same
            // text from many tests with different bind types — every `const(...)`
            // over `selectFromNoTable()` is `select :0 as "result" from dual` — so a
            // string const executed after an int/boolean/date one is re-bound with
            // the cached type and Oracle rejects it (ORA-01858 / ORA-01722). The
            // tests pass in isolation and fail only in file order, which is the
            // fingerprint of the cache rather than of the emitted SQL. Disabling it
            // makes each execution re-parse with its own bind types.
            //
            // This deviates from the driver default (30) on purpose. It is a
            // testing-only concern: an application would have to emit two
            // byte-identical SQL texts that bind different types at the same
            // position on one pooled connection, which is essentially what this
            // suite alone does by fanning every value kind over `const(...)`.
            // See LIMITATIONS.md, "Oracle: bind parameters carry no declared
            // type, so oracledb's statement cache can re-bind them with a
            // stale one".
            //
            // Two things worth knowing before "restoring the default":
            //   - Cost is ~1.7%: this cell measured 80.2s / 82.2s at 0 vs
            //     79.9s / 79.8s at 30 (two runs each, warm container). Every
            //     execution re-parses, but it does not move the needle.
            //   - The default is the FRAGILE option, not the safe one. At 30
            //     exactly one test of this cell fails — but WHICH one depends on
            //     file order, because the first string bind after a numeric one
            //     absorbs the stale type and the rest then pass. Inserting a test
            //     into that fan-out migrates the failure elsewhere. Disabling the
            //     cache removes the order coupling instead of documenting it.
            stmtCacheSize: 0,
        })
        return {
            runner: new OracleDBPoolQueryRunner(pool),
            shutdown: async () => { await pool.close(0) },
        }
    })

    const base = createTestContext<DBConnection>({
        label: spec.label,
        mockQueryRunner: 'OracleDBPoolQueryRunner',
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'oracle',
        realDbEnabled,
        timeoutMs: 300_000,
        async createRealRunner(forceNew = false) {
            const container = await containers.getFor(image).acquire()
            const host = container.getHost()
            const port = container.getMappedPort(1521)
            const workerUser = await bootstrapWorkerUserSchemaAndSeed(host, port, image, booleanStorage)
            // `forceNew` rebuilds a fresh runner (clean transaction state) when
            // the harness discards a connection poisoned by a failed commit.
            return await buildRunner({ host, port, workerUser }, forceNew)
        },
        async onReseed(runner) {
            // Reuse the runner's existing oracledb pool instead of opening a
            // fresh driver-level connection (which costs an Oracle auth
            // handshake on every test that exercises a commit path — a real
            // bottleneck under the parallel matrix).
            const pool = runner.getNativeRunner() as import('oracledb').Pool
            const conn = await pool.getConnection()
            try {
                await applyResetAndSeedToOpenedConnection(conn, booleanStorage)
            } finally {
                await conn.close()  // releases back to pool
            }
        },
        async onDown() {
            await containers.getFor(image).release()
        },
        buildConnection(interceptor, compatibilityVersion) {
            return booleanStorage === 'boolean'
                ? new BooleanStorageDBConnection(interceptor, compatibilityVersion)
                : new DBConnection(interceptor, compatibilityVersion)
        },
    })
    if (booleanStorage === 'boolean') {
        // Every connection a test builds through the context stores booleans
        // natively too: the subclass a test passes to `withConnection` (and the
        // ones the `withXxx` helpers build) is extended once more with the
        // storage pinned to `'boolean'`.
        const withConnection = base.withConnection.bind(base)
        base.withConnection = <T extends DBConnection>(subclass: new (queryRunner: QueryRunner, compatibilityVersion?: number) => T): T => {
            const Subclass = subclass as unknown as new (queryRunner: QueryRunner, compatibilityVersion?: number) => DBConnection
            class WithBooleanStorage extends Subclass {
                protected override booleanStorage: 'number' | 'boolean' = 'boolean'
            }
            return withConnection(WithBooleanStorage) as unknown as T
        }
    }
    return decorateOracleContext(base)
}

// ---- Direct query-runner tests (test/runners/) --------------------------

// The engine and worker database the query-runner tests in test/runners/
// connect their own driver to: the newest image, with the worker database
// bootstrapped exactly as the cells get it. With a `failure`, the parameters
// of a connection that fails that way (nothing is held: release() is a no-op).
export async function acquireRunnerTestDatabase(failure?: RunnerConnectionFailure): Promise<{ user: string, password: string, connectString: string, release(): Promise<void> }> {
    const image = newestImage(DATABASE)
    const container = await containers.getFor(image).acquire()
    const host = container.getHost()
    const port = container.getMappedPort(1521)
    const user = await bootstrapWorkerUserSchemaAndSeed(host, port, image)
    if (failure && failure !== 'client timeout') {
        await containers.getFor(image).release()
        return {
            user,
            password: failure === 'wrong password' ? 'rt_err_wrong' : APP_PASSWORD,
            connectString: `${host}:${failure === 'unreachable' ? UNREACHABLE_PORT : port}/${failure === 'unknown database' ? 'rt_err_missing_service' : serviceNameForImage(image)}`,
            release: async () => undefined,
        }
    }
    return { user, password: APP_PASSWORD, connectString: `${host}:${port}/${serviceNameForImage(image)}`, release: () => containers.getFor(image).release() }
}
