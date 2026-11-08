// Real error conditions, per database, for the error-mapping tests in
// test/runners/ (see describeErrorScenarios in runnerContract.ts).
//
// Each scenario provokes one error on the runner's real engine — a duplicate
// key, a missing table, a deadlock between two sessions, a statement timeout —
// and states the reason the library must report for it, from what the error
// means, not from what the mapper happens to return. Every runner of the
// database runs every scenario, so each one also checks how that driver's
// error object is read (code, number, constraint and column names).
//
// Scenarios create their own objects (rt_err_*) and drop them afterwards; the
// probe tables of dialects.ts (rt_probe seeded with ids 1, 2, 3) are there too.

import { expect } from '../../lib/testRunner.js'
import type { DatabaseType, QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import type { TsSqlErrorReason } from '../../../src/TsSqlError.js'
import type { RunnerConnectionFailure } from '../../lib/containerLifecycle.js'

type Expected = { reason: TsSqlErrorReason['reason'], [field: string]: unknown }

export interface ErrorScenarioContext {
    readonly runner: QueryRunner
    /**
     * Another session on the same database (a second runner from the same
     * factory), for the errors that need two: deadlocks, lock timeouts,
     * serialization failures. Closed after the scenario.
     */
    otherSession(): Promise<QueryRunner>
}

export interface ErrorScenario {
    readonly name: string
    /** Run before the scenario, each with executeDatabaseSchemaModification. */
    readonly setup?: readonly string[]
    /** Run after it (errors ignored), each with executeDatabaseSchemaModification. */
    readonly cleanup?: readonly string[]
    /**
     * Needs a database server: a second session on the same database, or a
     * condition an in-process engine (PGlite) doesn't survive.
     */
    readonly serverOnly?: boolean
    /** Only these runners (describe labels) run it: the error depends on how the driver sends the statement. */
    readonly onlyRunners?: readonly string[]
    /** What fails: its rejection is the error under test. */
    run(ctx: ErrorScenarioContext): Promise<unknown>
    readonly expected: Expected
}

function ddl(sql: string) {
    return ({ runner }: ErrorScenarioContext) => runner.executeDatabaseSchemaModification(sql)
}

function query(sql: string) {
    return ({ runner }: ErrorScenarioContext) => runner.executeSelectManyRows(sql)
}

function mutation(sql: string) {
    return ({ runner }: ErrorScenarioContext) => runner.executeUpdate(sql)
}

/** A select with `count` parameters in an `in` list, written with `placeholder(index)` (index from 0) */
function queryWithParameters(count: number, placeholder: (index: number) => string) {
    const placeholders = Array.from({ length: count }, (_, index) => placeholder(index)).join(', ')
    const params = Array.from({ length: count }, (_, index) => index)
    return ({ runner }: ErrorScenarioContext) => runner.executeSelectManyRows(`select 1 as one where 1 in (${placeholders})`, params)
}

/**
 * The failure of a statement another session will interrupt, with its handler
 * attached at once: the rejection may arrive before the test awaits it.
 */
function failureOf(statement: Promise<unknown>): Promise<unknown> {
    return statement.then(() => { throw new Error('Expected the statement to be interrupted') }, (error: unknown) => error)
}

/** Runs `fn` inside a transaction of `runner` and rolls it back whatever happens. */
async function inTransaction(runner: QueryRunner, fn: () => Promise<unknown>): Promise<unknown> {
    await runner.executeBeginTransaction()
    try {
        return await fn()
    } finally {
        if (runner.isTransactionActive()) {
            await runner.executeRollback().catch(() => undefined)
        }
    }
}

/**
 * Two sessions each lock one rt_probe row and then ask for the other's: the
 * database breaks the deadlock by failing one of them. Returns that failure.
 */
async function deadlock(ctx: ErrorScenarioContext, lockRow: (id: number) => string): Promise<unknown> {
    const a = ctx.runner
    const b = await ctx.otherSession()
    await a.executeBeginTransaction()
    await b.executeBeginTransaction()
    // The failed session rolls back at once: Oracle only undoes the failed
    // statement, so the other session would wait for its lock otherwise.
    const failureOf = (runner: QueryRunner, sql: string) => runner.executeUpdate(sql).then(
        () => undefined,
        async (error: unknown) => {
            await runner.executeRollback().catch(() => undefined)
            return { error }
        })
    try {
        await a.executeUpdate(lockRow(1))
        await b.executeUpdate(lockRow(2))
        const failures = await Promise.all([failureOf(a, lockRow(2)), failureOf(b, lockRow(1))])
        const failure = failures.find(f => f !== undefined)
        if (!failure) throw new Error('Expected a deadlock')
        throw failure.error
    } finally {
        for (const runner of [a, b]) {
            if (runner.isTransactionActive()) {
                await runner.executeRollback().catch(() => undefined)
            }
        }
    }
}

// ---- PostgreSQL ------------------------------------------------------------

const postgresScenarios: readonly ErrorScenario[] = [
    {
        name: 'more-parameters-than-allowed',
        run: queryWithParameters(65536, index => '$' + (index + 1)),
        expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'parameters' },
    },
    {
        // The failed insert aborts the transaction: PostgreSQL answers the commit with ROLLBACK, not an error
        name: 'commit-after-a-failed-statement',
        run: async ({ runner }) => {
            await runner.executeBeginTransaction()
            await runner.executeInsert(`insert into rt_probe (id, name) values (1, 'dup')`).catch(() => undefined)
            try {
                await runner.executeCommit()
            } catch (error) {
                await runner.executeRollback()
                throw error
            }
        },
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'transaction rolled back' },
    },
    {
        name: 'transaction-whose-failed-statement-was-caught',
        onlyRunners: ['PgQueryRunner', 'PgPoolQueryRunner', 'PgLiteQueryRunner', 'BunSqlPostgresQueryRunner', 'PostgresQueryRunner'],
        run: ({ runner }) => runner.executeInTransaction(async () => {
            await runner.executeInsert(`insert into rt_probe (id, name) values (1, 'dup')`).catch(() => undefined)
        }, runner),
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'transaction rolled back' },
    },
    {
        // A statement after the transaction of postgres.js was rolled back with its rollback() isn't sent, and the
        // transaction rejects with that refusal
        name: 'statement-after-the-driver-rolled-back-the-transaction',
        onlyRunners: ['PostgresQueryRunner'],
        run: ({ runner }) => runner.executeInTransaction(async () => {
            await runner.execute(transaction => (transaction as { rollback(): Promise<void> }).rollback())
            await runner.executeSelectManyRows('select 1')
        }, runner),
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'transaction rolled back', databaseErrorCode: 'TRANSACTION_ROLLED_BACK' },
    },
    {
        // postgres.js refuses a begin sent on a connection of its pool, outside sql.begin or sql.reserve
        name: 'begin-on-a-connection-of-the-pool',
        onlyRunners: ['PostgresQueryRunner'],
        run: mutation('begin'),
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'unsupported operation', databaseErrorCode: 'UNSAFE_TRANSACTION' },
    },
    {
        name: 'duplicate-primary-key',
        run: mutation(`insert into rt_probe (id, name) values (1, 'dup')`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'unique', constraintName: 'rt_probe_pkey', tableName: 'rt_probe', databaseErrorNumber: '23505' },
    },
    {
        name: 'null-in-a-not-null-column',
        run: mutation(`insert into rt_probe (id, name) values (10, null)`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'not null', tableName: 'rt_probe', columnName: 'name' },
    },
    {
        name: 'foreign-key-without-parent',
        setup: ['create table rt_err_child (id integer primary key, probe_id integer constraint rt_err_child_fk references rt_probe (id))'],
        cleanup: ['drop table if exists rt_err_child'],
        run: mutation(`insert into rt_err_child (id, probe_id) values (1, 99)`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'foreign key', constraintName: 'rt_err_child_fk', tableName: 'rt_err_child' },
    },
    {
        name: 'check-constraint',
        setup: ['create table rt_err_check (n integer constraint rt_err_check_positive check (n > 0))'],
        cleanup: ['drop table if exists rt_err_check'],
        run: mutation(`insert into rt_err_check (n) values (-1)`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'check', constraintName: 'rt_err_check_positive', tableName: 'rt_err_check' },
    },
    {
        name: 'exclusion-constraint',
        setup: ['create table rt_err_booking (during int4range, constraint rt_err_no_overlap exclude using gist (during with &&))'],
        cleanup: ['drop table if exists rt_err_booking'],
        run: async ({ runner }) => {
            await runner.executeInsert(`insert into rt_err_booking (during) values ('[1,5)')`)
            return runner.executeInsert(`insert into rt_err_booking (during) values ('[3,8)')`)
        },
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'exclusion', constraintName: 'rt_err_no_overlap', tableName: 'rt_err_booking' },
    },
    {
        name: 'drop-a-referenced-table',
        setup: ['create table rt_err_child (id integer primary key, probe_id integer references rt_probe (id))'],
        cleanup: ['drop table if exists rt_err_child'],
        run: ddl('drop table rt_probe'),
        expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'dependent objects still exist' },
    },
    {
        name: 'division-by-zero',
        run: query('select 1 / 0'),
        expected: { reason: 'SQL_DIVISION_BY_ZERO' },
    },
    {
        name: 'scalar-subquery-with-several-rows',
        run: query('select (select id from rt_probe)'),
        expected: { reason: 'SQL_CARDINALITY_VIOLATION' },
    },
    {
        name: 'syntax-error',
        run: query('selec 1'),
        expected: { reason: 'SQL_SYNTAX_ERROR', databaseErrorNumber: '42601' },
    },
    {
        name: 'missing-table',
        run: query('select * from rt_err_missing'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'table or view', objectName: 'rt_err_missing' },
    },
    {
        name: 'missing-column',
        run: query('select rt_err_missing from rt_probe'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'column', objectName: 'rt_err_missing' },
    },
    {
        name: 'missing-function',
        run: query('select rt_err_missing()'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'routine' },
    },
    {
        name: 'missing-schema',
        run: ddl('create table rt_err_missing_schema.t (id integer)'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'schema', objectName: 'rt_err_missing_schema' },
    },
    {
        name: 'missing-type',
        run: ddl('drop type rt_err_missing_type'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND' },
    },
    {
        name: 'missing-prepared-statement',
        run: mutation('execute rt_err_missing_statement'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'prepared statement' },
    },
    {
        name: 'missing-cursor',
        run: ({ runner }) => inTransaction(runner, () => runner.executeUpdate('close rt_err_missing_cursor')),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'cursor' },
    },
    {
        name: 'table-already-exists',
        run: ddl('create table rt_probe (id integer)'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'table or view', objectName: 'rt_probe' },
    },
    {
        name: 'duplicate-column-in-a-definition',
        run: ddl('create table rt_err_dup (a integer, a integer)'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'column' },
    },
    {
        name: 'function-already-exists',
        run: ddl('create function rt_answer() returns integer language sql as $$ select 1 $$'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'routine' },
    },
    {
        name: 'ambiguous-column',
        run: query('select id from rt_probe a, rt_probe b'),
        expected: { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifierType: 'column', identifierErrorType: 'ambiguous', identifier: 'id' },
    },
    {
        name: 'duplicate-alias',
        run: query('select 1 from rt_probe a, rt_probe a'),
        expected: { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifierType: 'alias', identifierErrorType: 'duplicate' },
    },
    {
        name: 'column-outside-the-group-by',
        run: query('select id, count(*) from rt_probe'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid grouping' },
    },
    {
        name: 'branches-of-different-types',
        run: query(`select case when true then 1 else 'a'::text end`),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'type mismatch' },
    },
    {
        name: 'order-by-outside-a-select-distinct',
        run: query('select distinct id from rt_probe order by name'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid reference' },
    },
    {
        name: 'two-primary-keys',
        run: ddl('create table rt_err_two_pk (a integer primary key, b integer primary key)'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid definition' },
    },
    {
        name: 'foreign-key-to-a-non-unique-column',
        run: ddl('create table rt_err_child (id integer, n integer references rt_probe (amount))'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid definition' },
    },
    {
        name: 'integer-out-of-range',
        run: query('select 2147483647::integer + 1'),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'out of range' },
    },
    {
        name: 'value-too-long',
        run: mutation(`insert into rt_probe (id, name) values (10, '${'x'.repeat(51)}')`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'too long' },
    },
    {
        name: 'text-that-is-not-a-number',
        run: query(`select 'abc'::integer`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value' },
    },
    {
        name: 'text-that-is-not-a-date',
        run: query(`select 'not a date'::date`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid format' },
    },
    {
        name: 'date-out-of-range',
        run: query(`select '2020-13-45'::date`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'out of range' },
    },
    {
        name: 'invalid-regular-expression',
        run: query(`select 'a' ~ '('`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid regular expression' },
    },
    {
        name: 'invalid-encoding',
        run: query(`select convert_from('\\xff'::bytea, 'UTF8')`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid encoding' },
    },
    {
        name: 'json-path-without-the-member',
        run: query(`select jsonb_path_query('{}', 'strict $.a')`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid json' },
    },
    {
        name: 'sequence-past-its-maximum',
        setup: ['create sequence rt_err_seq minvalue 0 maxvalue 1 start 1'],
        cleanup: ['drop sequence if exists rt_err_seq'],
        run: ({ runner }) => runner.executeSelectManyRows(`select nextval('rt_err_seq'), nextval('rt_err_seq')`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'sequence limit' },
    },
    {
        name: 'invalid-setting-value',
        run: mutation(`set statement_timeout = 'abc'`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value' },
    },
    {
        name: 'setting-that-cannot-change-now',
        run: mutation(`set shared_buffers = '1MB'`),
        expected: { reason: 'SQL_CONFIGURATION_ERROR', configurationErrorType: 'runtime parameter' },
    },
    {
        name: 'feature-not-supported',
        run: query('select count(*) from rt_probe for update'),
        expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED' },
    },
    {
        name: 'write-in-a-read-only-transaction',
        run: async ({ runner }) => {
            await runner.executeBeginTransaction([undefined, 'read only'])
            try {
                return await runner.executeUpdate(`update rt_probe set name = 'x'`)
            } finally {
                await runner.executeRollback().catch(() => undefined)
            }
        },
        expected: { reason: 'SQL_READ_ONLY_VIOLATION' },
    },
    {
        name: 'statement-in-an-aborted-transaction',
        run: ({ runner }) => inTransaction(runner, async () => {
            await runner.executeSelectManyRows('select 1 / 0').catch(() => undefined)
            return runner.executeSelectManyRows('select 1')
        }),
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'aborted' },
    },
    {
        name: 'isolation-level-set-after-a-query',
        run: ({ runner }) => inTransaction(runner, async () => {
            await runner.executeSelectManyRows('select 1')
            return runner.executeUpdate('set transaction isolation level serializable')
        }),
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'active transaction' },
    },
    {
        name: 'savepoint-outside-a-transaction',
        run: mutation('savepoint rt_err_savepoint'),
        expected: { reason: 'NOT_IN_TRANSACTION' },
    },
    {
        name: 'rollback-to-a-missing-savepoint',
        run: ({ runner }) => inTransaction(runner, () => runner.executeUpdate('rollback to savepoint rt_err_missing')),
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid savepoint' },
    },
    {
        name: 'commit-inside-a-function-call',
        run: ({ runner }) => inTransaction(runner, () => runner.executeUpdate('do $$ begin commit; end $$')),
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid state' },
    },
    {
        name: 'exception-raised-by-user-code',
        run: mutation(`do $$ begin raise exception 'rt_err raised'; end $$`),
        expected: { reason: 'SQL_USER_DEFINED_ERROR', databaseErrorNumber: 'P0001', databaseErrorMessage: 'rt_err raised' },
    },
    {
        name: 'unbounded-recursion',
        serverOnly: true,
        setup: ['create or replace function rt_err_recurse(n integer) returns integer language sql as $$ select rt_err_recurse(n + 1) $$'],
        cleanup: ['drop function if exists rt_err_recurse(integer)'],
        run: query('select rt_err_recurse(1)'),
        expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED' },
    },
    {
        name: 'parameter-the-statement-does-not-use',
        onlyRunners: ['PgQueryRunner', 'PgPoolQueryRunner'],
        run: ({ runner }) => runner.executeSelectManyRows('select 1', [1]),
        expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'wrong count' },
    },
    {
        name: 'parameter-of-unknown-type',
        run: ({ runner }) => {
            const params: any[] = []
            return runner.executeSelectManyRows(`select ${runner.addParam(params, null, '', '', false)} is null`, params)
        },
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'type mismatch' },
    },
    {
        name: 'statement-timeout',
        serverOnly: true,
        run: ({ runner }) => inTransaction(runner, async () => {
            await runner.executeUpdate(`set local statement_timeout = 100`)
            return runner.executeSelectManyRows('select pg_sleep(2)')
        }),
        expected: { reason: 'SQL_TIMEOUT', timeoutType: 'statement' },
    },
    {
        name: 'lock-timeout',
        serverOnly: true,
        run: async (ctx) => {
            const other = await ctx.otherSession()
            await other.executeBeginTransaction()
            try {
                await other.executeUpdate(`update rt_probe set name = 'locked' where id = 1`)
                return await inTransaction(ctx.runner, async () => {
                    await ctx.runner.executeUpdate(`set local lock_timeout = 100`)
                    return ctx.runner.executeUpdate(`update rt_probe set name = 'waiting' where id = 1`)
                })
            } finally {
                await other.executeRollback().catch(() => undefined)
            }
        },
        expected: { reason: 'SQL_TIMEOUT', timeoutType: 'lock' },
    },
    {
        name: 'deadlock',
        serverOnly: true,
        run: (ctx) => deadlock(ctx, id => `update rt_probe set name = 'deadlock' where id = ${id}`),
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'deadlock' },
    },
    {
        name: 'serialization-failure',
        serverOnly: true,
        run: async (ctx) => {
            const a = ctx.runner
            const b = await ctx.otherSession()
            await a.executeBeginTransaction(['snapshot'])
            try {
                await a.executeSelectManyRows('select name from rt_probe where id = 1')
                await b.executeUpdate(`update rt_probe set name = 'changed' where id = 1`)
                return await a.executeUpdate(`update rt_probe set name = 'stale' where id = 1`)
            } finally {
                await a.executeRollback().catch(() => undefined)
            }
        },
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'serialization failure' },
    },
    {
        name: 'statement-cancelled-from-another-session',
        serverOnly: true,
        run: async (ctx) => {
            const other = await ctx.otherSession()
            return inTransaction(ctx.runner, async () => {
                const pid = await ctx.runner.executeSelectOneColumnOneRow('select pg_backend_pid()')
                const sleeping = failureOf(ctx.runner.executeSelectManyRows('select pg_sleep(5)'))
                await new Promise(resolve => setTimeout(resolve, 300))
                await other.executeSelectManyRows(`select pg_cancel_backend(${Number(pid)})`)
                throw await sleeping
            })
        },
        expected: { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled' },
    },
    {
        name: 'permission-denied',
        setup: [
            // Roles belong to the cluster: the runners of other files may be creating it at the same time
            `do $$ begin create role rt_err_limited; exception when duplicate_object or unique_violation then null; end $$`,
        ],
        run: ({ runner }) => inTransaction(runner, async () => {
            await runner.executeUpdate('set local role rt_err_limited')
            return runner.executeSelectManyRows('select * from rt_probe')
        }),
        expected: { reason: 'SQL_PERMISSION_DENIED' },
    },
    {
        name: 'database-already-exists',
        run: ddl('create database postgres'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'database' },
    },
    {
        name: 'schema-already-exists',
        run: ddl('create schema public'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'schema' },
    },
    {
        name: 'role-already-exists',
        run: mutation('do $$ begin execute format(\'create role %I\', current_user); end $$'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS' },
    },
    {
        name: 'prepared-statement-already-exists',
        run: ({ runner }) => inTransaction(runner, async () => {
            await runner.executeUpdate('prepare rt_err_statement as select 1')
            try {
                return await runner.executeUpdate('prepare rt_err_statement as select 1')
            } finally {
                await runner.executeUpdate('deallocate rt_err_statement').catch(() => undefined)
            }
        }),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'prepared statement' },
    },
    {
        name: 'cursor-already-exists',
        run: ({ runner }) => inTransaction(runner, async () => {
            await runner.executeUpdate('declare rt_err_cursor cursor for select 1')
            return runner.executeUpdate('declare rt_err_cursor cursor for select 1')
        }),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'cursor' },
    },
    {
        name: 'reserved-schema-name',
        // PGlite runs in single-user mode, where system names are allowed
        serverOnly: true,
        run: ddl('create schema pg_rt_err'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid identifier' },
    },
    {
        name: 'drop-a-table-as-a-view',
        run: ddl('drop view rt_probe'),
        expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'wrong object type' },
    },
    {
        name: 'ambiguous-function-call',
        setup: [
            'create or replace function rt_err_overloaded(n integer) returns integer language sql as $$ select n $$',
            'create or replace function rt_err_overloaded(n bigint) returns bigint language sql as $$ select n $$',
        ],
        cleanup: ['drop function if exists rt_err_overloaded(integer)', 'drop function if exists rt_err_overloaded(bigint)'],
        run: query(`select rt_err_overloaded('1')`),
        expected: { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifierType: 'routine', identifierErrorType: 'ambiguous' },
    },
    {
        name: 'recursive-reference-in-a-subquery',
        run: query('with recursive t (n) as (select 1 union all select (select n from t) + 1 from t where n < 3) select * from t'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid recursion' },
    },
    {
        name: 'window-frame-that-starts-after-it-ends',
        run: query('select sum(id) over (order by id rows between current row and 1 preceding) from rt_probe'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid windowing' },
    },
    {
        name: 'write-through-a-view-outside-its-check-option',
        setup: ['create or replace view rt_err_small as select id, name from rt_probe where id < 10 with check option'],
        cleanup: ['drop view if exists rt_err_small'],
        run: mutation(`insert into rt_err_small (id, name) values (20, 'big')`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'check' },
    },
    {
        name: 'current-value-before-next-value',
        setup: ['create sequence rt_err_unused_seq'],
        cleanup: ['drop sequence if exists rt_err_unused_seq'],
        run: query(`select currval('rt_err_unused_seq')`),
        expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'invalid state' },
    },
    {
        name: 'execute-of-a-null-statement',
        run: mutation('do $$ begin execute null; end $$'),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'null not allowed' },
    },
    {
        name: 'invalid-xml',
        run: query(`select xmlparse(document '<a>')`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid xml' },
    },
    {
        name: 'select-into-strict-without-rows',
        run: mutation('do $$ declare n integer; begin select id into strict n from rt_probe where id = 99; end $$'),
        expected: { reason: 'SQL_ROUTINE_ERROR' },
    },
    {
        name: 'select-into-strict-with-several-rows',
        run: mutation('do $$ declare n integer; begin select id into strict n from rt_probe; end $$'),
        expected: { reason: 'SQL_CARDINALITY_VIOLATION' },
    },
    {
        name: 'failed-assertion',
        run: mutation('do $$ begin assert false; end $$'),
        expected: { reason: 'SQL_ROUTINE_ERROR' },
    },
    {
        name: 'case-without-a-matching-branch',
        run: mutation('do $$ begin case 1 when 2 then null; end case; end $$'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'case not found' },
    },
    {
        name: 'function-ending-without-a-return',
        setup: ['create or replace function rt_err_no_return() returns integer language plpgsql as $$ begin end $$'],
        cleanup: ['drop function if exists rt_err_no_return()'],
        run: query('select rt_err_no_return()'),
        expected: { reason: 'SQL_ROUTINE_ERROR' },
    },
    {
        name: 'stacked-diagnostics-outside-a-handler',
        run: mutation('do $$ declare m text; begin get stacked diagnostics m = message_text; end $$'),
        expected: { reason: 'SQL_ROUTINE_ERROR' },
    },
]

// ---- MySQL and MariaDB -----------------------------------------------------

const mysqlLikeScenarios: readonly ErrorScenario[] = [
    {
        name: 'duplicate-primary-key',
        run: mutation(`insert into rt_probe (id, name) values (1, 'dup')`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'unique', constraintName: 'PRIMARY', databaseErrorNumber: 1062 },
    },
    {
        name: 'null-in-a-not-null-column',
        run: mutation(`insert into rt_probe (id, name) values (10, null)`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'not null', columnName: 'name' },
    },
    {
        name: 'foreign-key-without-parent',
        setup: ['create table rt_err_child (id int primary key, probe_id int, constraint rt_err_child_fk foreign key (probe_id) references rt_probe (id))'],
        cleanup: ['drop table if exists rt_err_child'],
        run: mutation(`insert into rt_err_child (id, probe_id) values (1, 99)`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'foreign key', constraintName: 'rt_err_child_fk' },
    },
    {
        name: 'delete-a-referenced-row',
        setup: [
            'create table rt_err_child (id int primary key, probe_id int, constraint rt_err_child_fk foreign key (probe_id) references rt_probe (id))',
            'insert into rt_err_child (id, probe_id) values (1, 1)',
        ],
        cleanup: ['drop table if exists rt_err_child'],
        run: mutation(`delete from rt_probe where id = 1`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'foreign key', constraintName: 'rt_err_child_fk' },
    },
    {
        name: 'check-constraint',
        setup: ['create table rt_err_check (n int, constraint rt_err_check_positive check (n > 0))'],
        cleanup: ['drop table if exists rt_err_check'],
        run: mutation(`insert into rt_err_check (n) values (-1)`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'check', constraintName: 'rt_err_check_positive' },
    },
    {
        name: 'division-by-zero-in-a-write',
        run: mutation(`update rt_probe set amount = 1 / 0 where id = 1`),
        expected: { reason: 'SQL_DIVISION_BY_ZERO' },
    },
    {
        name: 'scalar-subquery-with-several-rows',
        run: query('select (select id from rt_probe)'),
        expected: { reason: 'SQL_CARDINALITY_VIOLATION' },
    },
    {
        name: 'syntax-error',
        run: query('selec 1'),
        expected: { reason: 'SQL_SYNTAX_ERROR', databaseErrorNumber: 1064 },
    },
    {
        name: 'missing-table',
        run: query('select * from rt_err_missing'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'table or view' },
    },
    {
        name: 'missing-column',
        run: query('select rt_err_missing from rt_probe'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'column', columnName: 'rt_err_missing' },
    },
    {
        name: 'missing-function',
        run: query('select rt_err_missing()'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'routine' },
    },
    {
        name: 'missing-database',
        run: query('select * from rt_err_missing_db.rt_probe'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND' },
    },
    {
        name: 'table-already-exists',
        run: ddl('create table rt_probe (id int)'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'table or view' },
    },
    {
        name: 'duplicate-column-in-a-definition',
        run: ddl('create table rt_err_dup (a int, a int)'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'column' },
    },
    {
        name: 'ambiguous-column',
        run: query('select id from rt_probe a, rt_probe b'),
        expected: { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifierType: 'column' },
    },
    {
        name: 'aggregate-in-a-where',
        run: query('select id from rt_probe where count(*) > 1'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid grouping' },
    },
    {
        name: 'integer-out-of-range',
        run: mutation(`update rt_probe set amount = 2147483648 where id = 1`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'out of range', columnName: 'amount' },
    },
    {
        name: 'value-too-long',
        run: mutation(`insert into rt_probe (id, name) values (10, '${'x'.repeat(51)}')`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'too long', columnName: 'name' },
    },
    {
        name: 'text-that-is-not-a-number',
        run: mutation(`update rt_probe set amount = 'abc' where id = 1`),
        expected: { reason: 'SQL_INVALID_VALUE', columnName: 'amount' },
    },
    {
        name: 'text-that-is-not-a-date',
        setup: ['create table rt_err_dates (d date)'],
        cleanup: ['drop table if exists rt_err_dates'],
        run: mutation(`insert into rt_err_dates (d) values ('not a date')`),
        expected: { reason: 'SQL_INVALID_VALUE', columnName: 'd' },
    },
    {
        name: 'unknown-system-variable',
        run: mutation('set rt_err_missing = 1'),
        expected: { reason: 'SQL_CONFIGURATION_ERROR' },
    },
    {
        name: 'write-in-a-read-only-transaction',
        run: async ({ runner }) => {
            await runner.executeBeginTransaction([undefined, 'read only'])
            try {
                return await runner.executeUpdate(`update rt_probe set name = 'x'`)
            } finally {
                await runner.executeRollback().catch(() => undefined)
            }
        },
        expected: { reason: 'SQL_READ_ONLY_VIOLATION' },
    },
    {
        name: 'rollback-to-a-missing-savepoint',
        run: ({ runner }) => inTransaction(runner, () => runner.executeUpdate('rollback to savepoint rt_err_missing')),
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid savepoint' },
    },
    {
        name: 'signal-raised-by-a-routine',
        setup: [
            'drop procedure if exists rt_err_signal',
            `create procedure rt_err_signal() begin signal sqlstate '45000' set message_text = 'rt_err raised'; end`,
        ],
        cleanup: ['drop procedure if exists rt_err_signal'],
        run: mutation('call rt_err_signal()'),
        expected: { reason: 'SQL_USER_DEFINED_ERROR', databaseErrorNumber: 1644, databaseErrorMessage: 'rt_err raised' },
    },
    {
        name: 'signal-with-its-own-error-number',
        setup: [
            'drop procedure if exists rt_err_signal_number',
            `create procedure rt_err_signal_number() begin signal sqlstate '45000' set mysql_errno = 64999, message_text = 'rt_err numbered'; end`,
        ],
        cleanup: ['drop procedure if exists rt_err_signal_number'],
        run: mutation('call rt_err_signal_number()'),
        expected: { reason: 'SQL_USER_DEFINED_ERROR', databaseErrorNumber: 64999, databaseErrorMessage: 'rt_err numbered' },
    },
    {
        name: 'procedure-called-with-too-many-arguments',
        run: mutation('call rt_touch(1)'),
        expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'wrong count' },
    },
    {
        name: 'statement-killed-from-another-session',
        serverOnly: true,
        run: async (ctx) => {
            // The killed statement runs on the other session: the mariadb driver
            // treats the interruption as fatal and closes that connection.
            const victim = await ctx.otherSession()
            return inTransaction(victim, async () => {
                const id = await victim.executeSelectOneColumnOneRow('select connection_id()')
                const sleeping = failureOf(victim.executeSelectManyRows('select count(*) from rt_probe where sleep(5) = 0'))
                await new Promise(resolve => setTimeout(resolve, 300))
                await ctx.runner.executeUpdate(`kill query ${Number(id)}`)
                throw await sleeping
            })
        },
        expected: { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled' },
    },
    {
        name: 'lock-wait-timeout',
        serverOnly: true,
        run: async (ctx) => {
            const other = await ctx.otherSession()
            await other.executeBeginTransaction()
            try {
                await other.executeUpdate(`update rt_probe set name = 'locked' where id = 1`)
                return await inTransaction(ctx.runner, async () => {
                    await ctx.runner.executeUpdate('set innodb_lock_wait_timeout = 1')
                    return ctx.runner.executeUpdate(`update rt_probe set name = 'waiting' where id = 1`)
                })
            } finally {
                await other.executeRollback().catch(() => undefined)
            }
        },
        expected: { reason: 'SQL_TIMEOUT', timeoutType: 'lock' },
    },
    {
        name: 'deadlock',
        serverOnly: true,
        run: (ctx) => deadlock(ctx, id => `update rt_probe set name = 'deadlock' where id = ${id}`),
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'deadlock' },
    },
    {
        name: 'drop-a-missing-index',
        run: ddl('drop index rt_err_missing on rt_probe'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND' },
    },
    {
        name: 'drop-a-missing-trigger',
        run: ddl('drop trigger rt_err_missing'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'trigger' },
    },
    {
        name: 'unknown-collation',
        run: query(`select 'a' collate rt_err_missing`),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'collation' },
    },
    {
        name: 'database-already-exists',
        run: async ({ runner }) => runner.executeDatabaseSchemaModification('create database ' + await runner.executeSelectOneColumnOneRow('select database()')),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'database' },
    },
    {
        name: 'procedure-already-exists',
        run: ddl('create procedure rt_touch() begin end'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'routine' },
    },
    {
        name: 'index-name-already-used',
        setup: ['create table rt_err_indexed (n int)', 'create index rt_err_indexed_n on rt_err_indexed (n)'],
        cleanup: ['drop table if exists rt_err_indexed'],
        run: ddl('create index rt_err_indexed_n on rt_err_indexed (n)'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'index' },
    },
    {
        name: 'column-name-ending-in-a-space',
        run: ddl('create table rt_err_bad_name (`n ` int)'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid identifier' },
    },
    {
        name: 'not-null-column-over-existing-nulls',
        setup: ['create table rt_err_nullable (n int)', 'insert into rt_err_nullable (n) values (null)'],
        cleanup: ['drop table if exists rt_err_nullable'],
        run: ddl('alter table rt_err_nullable modify n int not null'),
        // MySQL reports an invalid use of NULL (1138), MariaDB truncated data (1265)
        expected: { reason: 'SQL_INVALID_VALUE' },
    },
    {
        name: 'isolation-level-changed-inside-a-transaction',
        run: ({ runner }) => inTransaction(runner, async () => {
            await runner.executeSelectManyRows('select 1')
            return runner.executeUpdate('set transaction isolation level serializable')
        }),
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'active transaction' },
    },
    {
        name: 'cursor-closed-before-being-opened',
        setup: [
            'drop procedure if exists rt_err_cursor',
            'create procedure rt_err_cursor() begin declare c cursor for select id from rt_probe; close c; end',
        ],
        cleanup: ['drop procedure if exists rt_err_cursor'],
        run: mutation('call rt_err_cursor()'),
        expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectType: 'cursor', objectStateErrorType: 'invalid state' },
    },
]

const mysqlScenarios: readonly ErrorScenario[] = [
    ...mysqlLikeScenarios,
    {
        // mysql2 and mariadb write the values into the SQL text before sending it
        name: 'more-parameters-than-allowed',
        onlyRunners: ['BunSqlMySqlQueryRunner'],
        run: queryWithParameters(65536, () => '?'),
        expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'parameters' },
    },
    {
        name: 'invalid-json',
        setup: ['create table rt_err_json (j json)'],
        cleanup: ['drop table if exists rt_err_json'],
        run: mutation(`insert into rt_err_json (j) values ('{')`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid json' },
    },
    {
        name: 'invalid-regular-expression',
        run: query(`select 'a' regexp '('`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid regular expression' },
    },
    {
        name: 'column-outside-the-group-by',
        run: query('select id, count(*) from rt_probe'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid grouping' },
    },
    {
        name: 'statement-timeout',
        run: query('select /*+ MAX_EXECUTION_TIME(100) */ count(*) from information_schema.columns a, information_schema.columns b, information_schema.columns c'),
        expected: { reason: 'SQL_TIMEOUT', timeoutType: 'statement' },
    },
    {
        name: 'recursion-past-the-depth-limit',
        run: query('with recursive t (n) as (select 1 union all select n + 1 from t) select count(*) from t'),
        expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED' },
    },
]

const mariadbScenarios: readonly ErrorScenario[] = [
    ...mysqlLikeScenarios,
    {
        // innodb_snapshot_isolation, on by default from MariaDB 11.6.2
        name: 'serialization-failure',
        serverOnly: true,
        run: async (ctx) => {
            const a = ctx.runner
            const b = await ctx.otherSession()
            await a.executeBeginTransaction(['snapshot'])
            try {
                await a.executeSelectManyRows('select name from rt_probe where id = 1')
                await b.executeUpdate(`update rt_probe set name = 'changed' where id = 1`)
                return await a.executeUpdate(`update rt_probe set name = 'stale' where id = 1`)
            } finally {
                await a.executeRollback().catch(() => undefined)
            }
        },
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'serialization failure' },
    },
    {
        // mysql2 and mariadb write the values into the SQL text before sending it
        name: 'more-parameters-than-allowed',
        onlyRunners: ['BunSqlMySqlQueryRunner'],
        run: queryWithParameters(65536, () => '?'),
        expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'parameters' },
    },
    {
        name: 'invalid-regular-expression',
        run: query(`select 'a' regexp '('`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid regular expression' },
    },
    {
        name: 'statement-timeout',
        run: query('set statement max_statement_time = 0.1 for select count(*) from information_schema.columns a, information_schema.columns b, information_schema.columns c'),
        expected: { reason: 'SQL_TIMEOUT', timeoutType: 'statement' },
    },
    {
        name: 'sequence-past-its-maximum',
        setup: ['create sequence rt_err_seq start with 1 minvalue 0 maxvalue 1 nocycle'],
        cleanup: ['drop sequence if exists rt_err_seq'],
        run: query('select nextval(rt_err_seq) as a, nextval(rt_err_seq) as b'),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'sequence limit' },
    },
    {
        name: 'next-value-of-a-table',
        run: query('select nextval(rt_probe)'),
        expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'wrong object type' },
    },
    {
        name: 'unknown-role',
        run: mutation('set role rt_err_missing'),
        // ER_INVALID_ROLE: the role doesn't exist or isn't granted
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT' },
    },
]

// ---- SQL Server ------------------------------------------------------------

const sqlServerScenarios: readonly ErrorScenario[] = [
    {
        name: 'duplicate-primary-key',
        run: mutation(`insert into rt_probe (id, name) values (1, 'dup')`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'unique', databaseErrorNumber: 2627 },
    },
    {
        name: 'duplicate-in-a-unique-index',
        setup: ['create table rt_err_unique (n int)', 'create unique index rt_err_unique_n on rt_err_unique (n)', 'insert into rt_err_unique (n) values (1)'],
        cleanup: ['drop table if exists rt_err_unique'],
        run: mutation(`insert into rt_err_unique (n) values (1)`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'unique', constraintName: 'rt_err_unique_n', databaseErrorNumber: 2601 },
    },
    {
        name: 'null-in-a-not-null-column',
        run: mutation(`insert into rt_probe (id, name) values (10, null)`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'not null', columnName: 'name' },
    },
    {
        name: 'foreign-key-without-parent',
        setup: ['create table rt_err_child (id int primary key, probe_id int constraint rt_err_child_fk references rt_probe (id))'],
        cleanup: ['drop table if exists rt_err_child'],
        run: mutation(`insert into rt_err_child (id, probe_id) values (1, 99)`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'foreign key', constraintName: 'rt_err_child_fk' },
    },
    {
        name: 'delete-a-referenced-row',
        setup: [
            'create table rt_err_child (id int primary key, probe_id int constraint rt_err_child_fk references rt_probe (id))',
            'insert into rt_err_child (id, probe_id) values (1, 1)',
        ],
        cleanup: ['drop table if exists rt_err_child'],
        run: mutation(`delete from rt_probe where id = 1`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'foreign key', constraintName: 'rt_err_child_fk' },
    },
    {
        name: 'check-constraint',
        setup: ['create table rt_err_check (n int constraint rt_err_check_positive check (n > 0))'],
        cleanup: ['drop table if exists rt_err_check'],
        run: mutation(`insert into rt_err_check (n) values (-1)`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'check', constraintName: 'rt_err_check_positive' },
    },
    {
        name: 'drop-a-referenced-table',
        setup: ['create table rt_err_child (id int primary key, probe_id int constraint rt_err_child_fk references rt_probe (id))'],
        cleanup: ['drop table if exists rt_err_child'],
        run: ddl('drop table rt_probe'),
        expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'dependent objects still exist' },
    },
    {
        name: 'division-by-zero',
        run: query('select 1 / 0'),
        expected: { reason: 'SQL_DIVISION_BY_ZERO' },
    },
    {
        name: 'scalar-subquery-with-several-rows',
        run: query('select (select id from rt_probe)'),
        expected: { reason: 'SQL_CARDINALITY_VIOLATION' },
    },
    {
        name: 'syntax-error',
        run: query('select 1 +'),
        expected: { reason: 'SQL_SYNTAX_ERROR' },
    },
    {
        name: 'missing-table',
        run: query('select * from rt_err_missing'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'table or view', objectName: 'rt_err_missing' },
    },
    {
        name: 'missing-column',
        run: query('select rt_err_missing from rt_probe'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'column', columnName: 'rt_err_missing' },
    },
    {
        name: 'missing-procedure',
        run: mutation('exec rt_err_missing'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'routine', objectName: 'rt_err_missing' },
    },
    {
        name: 'missing-database',
        run: mutation('use rt_err_missing_db'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'database', objectName: 'rt_err_missing_db' },
    },
    {
        name: 'table-already-exists',
        run: ddl('create table rt_probe (id int)'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectName: 'rt_probe' },
    },
    {
        name: 'ambiguous-column',
        run: query('select id from rt_probe a, rt_probe b'),
        expected: { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifier: 'id' },
    },
    {
        name: 'unbound-multi-part-identifier',
        run: query('select x.id from rt_probe'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid reference' },
    },
    {
        name: 'column-outside-the-group-by',
        run: query('select id, count(*) from rt_probe'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid grouping' },
    },
    {
        name: 'sum-of-text',
        run: query('select sum(name) from rt_probe'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'type mismatch' },
    },
    {
        name: 'conversion-not-allowed',
        run: query('select cast(1 as date)'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'type mismatch' },
    },
    {
        name: 'integer-out-of-range',
        run: query('select cast(2147483647 as int) + 1'),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'out of range' },
    },
    {
        name: 'value-too-long',
        run: mutation(`insert into rt_probe (id, name) values (10, '${'x'.repeat(51)}')`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'too long', columnName: 'name' },
    },
    {
        name: 'text-that-is-not-a-number',
        run: query(`select cast('abc' as int)`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value' },
    },
    {
        name: 'text-that-is-not-a-date',
        run: query(`select cast('not a date' as date)`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid format' },
    },
    {
        name: 'procedure-called-with-too-many-arguments',
        run: mutation('exec rt_touch 1'),
        expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'too many' },
    },
    {
        name: 'procedure-called-without-its-argument',
        setup: ['create or alter procedure rt_err_needs_arg @n int as begin return end'],
        cleanup: ['drop procedure if exists rt_err_needs_arg'],
        run: mutation('exec rt_err_needs_arg'),
        expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing', parameterName: '@n' },
    },
    {
        name: 'commit-without-a-transaction',
        run: mutation('commit transaction'),
        expected: { reason: 'NOT_IN_TRANSACTION' },
    },
    {
        name: 'rollback-to-a-missing-savepoint',
        run: ({ runner }) => inTransaction(runner, () => runner.executeUpdate('rollback transaction rt_err_missing')),
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid savepoint' },
    },
    {
        name: 'write-in-a-doomed-transaction',
        serverOnly: true,
        run: async (ctx) => {
            // On its own session: the batch leaves XACT_ABORT on and the transaction open
            const other = await ctx.otherSession()
            return other.executeUpdate(`set xact_abort on; begin transaction; begin try insert into rt_probe (id, name) values (1, 'dup') end try begin catch insert into rt_probe (id, name) values (11, 'x') end catch`)
        },
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'aborted' },
    },
    {
        name: 'exception-thrown-by-user-code',
        run: mutation(`throw 50001, 'rt_err raised', 1`),
        expected: { reason: 'SQL_USER_DEFINED_ERROR', databaseErrorNumber: 50001, databaseErrorMessage: 'rt_err raised' },
    },
    {
        name: 'raiserror-with-its-own-message',
        run: mutation(`raiserror('rt_err raised', 16, 1)`),
        expected: { reason: 'SQL_USER_DEFINED_ERROR', databaseErrorNumber: 50000, databaseErrorMessage: 'rt_err raised' },
    },
    {
        name: 'permission-denied',
        serverOnly: true,
        setup: [`if user_id('rt_err_limited') is null create user rt_err_limited without login`],
        run: async (ctx) => {
            // On its own session, in one batch: the impersonation never outlives it
            const other = await ctx.otherSession()
            return other.executeSelectManyRows(`execute as user = 'rt_err_limited'; select * from rt_probe`)
        },
        expected: { reason: 'SQL_PERMISSION_DENIED' },
    },
    {
        name: 'lock-timeout',
        serverOnly: true,
        run: async (ctx) => {
            const other = await ctx.otherSession()
            await other.executeBeginTransaction()
            try {
                await other.executeUpdate(`update rt_probe set name = 'locked' where id = 1`)
                // In the same batch: the runner runs each statement through
                // sp_executesql, where a SET lasts only that call
                return await ctx.runner.executeUpdate(`set lock_timeout 100; update rt_probe set name = 'waiting' where id = 1`)
            } finally {
                await other.executeRollback().catch(() => undefined)
            }
        },
        expected: { reason: 'SQL_TIMEOUT', timeoutType: 'lock' },
    },
    {
        name: 'deadlock',
        serverOnly: true,
        run: (ctx) => deadlock(ctx, id => `update rt_probe set name = 'deadlock' where id = ${id}`),
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'deadlock' },
    },
    {
        name: 'database-already-exists',
        run: ddl('create database master'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'database' },
    },
    {
        name: 'index-already-exists',
        setup: ['create table rt_err_indexed (n int)', 'create index rt_err_indexed_n on rt_err_indexed (n)'],
        cleanup: ['drop table if exists rt_err_indexed'],
        run: ddl('create index rt_err_indexed_n on rt_err_indexed (n)'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'index' },
    },
    {
        name: 'missing-index-in-a-hint',
        run: query('select * from rt_probe with (index(rt_err_missing))'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'index' },
    },
    {
        name: 'operand-type-clash',
        run: query(`select 1 where cast(1 as int) = cast('2020-01-01' as date)`),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'type mismatch' },
    },
    {
        name: 'procedure-past-the-nesting-limit',
        setup: ['create or alter procedure rt_err_recurse as begin exec rt_err_recurse end'],
        cleanup: ['drop procedure if exists rt_err_recurse'],
        run: mutation('exec rt_err_recurse'),
        expected: { reason: 'SQL_ROUTINE_ERROR' },
    },
    {
        name: 'insert-past-the-row-limit',
        setup: ['create table rt_err_rows (id int)'],
        cleanup: ['drop table if exists rt_err_rows'],
        run: mutation('insert into rt_err_rows (id) values ' + Array.from({ length: 1001 }, (_, i) => '(' + i + ')').join(', ')),
        expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'statement elements', limit: 1000 },
    },
    {
        name: 'more-parameters-than-allowed',
        run: queryWithParameters(2101, index => '@' + index),
        expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'parameters', limit: 2100 },
    },
    {
        name: 'window-function-in-a-where',
        run: query('select id from rt_probe where row_number() over (order by id) = 1'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid windowing' },
    },
    {
        name: 'negative-substring-length',
        run: query(`select substring('abc', 1, -1)`),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid argument' },
    },
    {
        name: 'aggregate-in-the-recursive-part',
        run: query('with t (n) as (select 1 union all select max(n) + 1 from t where n < 3) select * from t'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid recursion' },
    },
    {
        name: 'aggregate-in-the-group-by',
        run: query('select count(*) from rt_probe group by count(*)'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid grouping' },
    },
    {
        name: 'insert-with-more-values-than-columns',
        run: mutation(`insert into rt_probe (id) values (10, 'ten')`),
        expected: { reason: 'SQL_CARDINALITY_VIOLATION' },
    },
    {
        name: 'union-of-different-column-counts',
        run: query('select 1 union select 1, 2'),
        expected: { reason: 'SQL_CARDINALITY_VIOLATION' },
    },
    {
        name: 'invalid-xml',
        run: query(`select cast('<a>' as xml)`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid xml' },
    },
    {
        name: 'invalid-json',
        run: query(`select json_value('{', '$.a')`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid json' },
    },
    {
        name: 'undeclared-variable',
        run: query('select @rt_err_missing'),
        expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing' },
    },
    {
        name: 'cast-to-an-unknown-type',
        run: query('select cast(1 as rt_err_missing_type)'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid identifier' },
    },
    {
        name: 'call-of-a-missing-function',
        run: query('select dbo.rt_err_missing()'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid reference' },
    },
    {
        name: 'empty-column-alias',
        run: query('select 1 as []'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid definition' },
    },
    {
        name: 'sp-executesql-with-a-number',
        run: mutation('exec sp_executesql 1'),
        expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid value' },
    },
    {
        name: 'invalid-regular-expression',
        run: query(`select 1 where regexp_like('a', '(')`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid regular expression' },
    },
]

// ---- Oracle ----------------------------------------------------------------

function oracleDrop(kind: 'table' | 'sequence' | 'procedure', name: string): string {
    const code = kind === 'table' ? -942 : kind === 'sequence' ? -2289 : -4043
    return `begin execute immediate 'drop ${kind} ${name}'; exception when others then if sqlcode != ${code} then raise; end if; end;`
}

const oracleScenarios: readonly ErrorScenario[] = [
    {
        name: 'duplicate-in-a-unique-constraint',
        setup: [oracleDrop('table', 'rt_err_unique'), 'create table rt_err_unique (n number(10) constraint rt_err_unique_n unique)', 'insert into rt_err_unique (n) values (1)'],
        cleanup: [oracleDrop('table', 'rt_err_unique')],
        run: mutation(`insert into rt_err_unique (n) values (1)`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'unique', constraintName: 'RT_ERR_UNIQUE_N', tableName: 'RT_ERR_UNIQUE', columnName: 'N', databaseErrorNumber: 1 },
    },
    {
        name: 'null-in-a-not-null-column',
        run: mutation(`insert into rt_probe (id, name) values (10, null)`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'not null', tableName: 'RT_PROBE', columnName: 'NAME' },
    },
    {
        name: 'foreign-key-without-parent',
        setup: [oracleDrop('table', 'rt_err_child'), 'create table rt_err_child (id number(10) primary key, probe_id number(10) constraint rt_err_child_fk references rt_probe (id))'],
        cleanup: [oracleDrop('table', 'rt_err_child')],
        run: mutation(`insert into rt_err_child (id, probe_id) values (1, 99)`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'foreign key', constraintName: 'RT_ERR_CHILD_FK' },
    },
    {
        name: 'delete-a-referenced-row',
        setup: [
            oracleDrop('table', 'rt_err_child'),
            'create table rt_err_child (id number(10) primary key, probe_id number(10) constraint rt_err_child_fk references rt_probe (id))',
            'insert into rt_err_child (id, probe_id) values (1, 1)',
        ],
        cleanup: [oracleDrop('table', 'rt_err_child')],
        run: mutation(`delete from rt_probe where id = 1`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'foreign key', constraintName: 'RT_ERR_CHILD_FK' },
    },
    {
        name: 'check-constraint',
        setup: [oracleDrop('table', 'rt_err_check'), 'create table rt_err_check (n number(10) constraint rt_err_check_positive check (n > 0))'],
        cleanup: [oracleDrop('table', 'rt_err_check')],
        run: mutation(`insert into rt_err_check (n) values (-1)`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'check', constraintName: 'RT_ERR_CHECK_POSITIVE' },
    },
    {
        name: 'division-by-zero',
        run: query('select 1 / 0 from dual'),
        expected: { reason: 'SQL_DIVISION_BY_ZERO' },
    },
    {
        name: 'scalar-subquery-with-several-rows',
        run: query('select (select id from rt_probe) from dual'),
        expected: { reason: 'SQL_CARDINALITY_VIOLATION' },
    },
    {
        name: 'syntax-error',
        run: query('select 1 +  from dual'),
        expected: { reason: 'SQL_SYNTAX_ERROR' },
    },
    {
        name: 'missing-table',
        run: query('select * from rt_err_missing'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'table or view' },
    },
    {
        name: 'missing-column',
        run: query('select rt_err_missing from rt_probe'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'column' },
    },
    {
        name: 'missing-sequence',
        run: query('select rt_err_missing_seq.nextval from dual'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'sequence' },
    },
    {
        name: 'table-already-exists',
        run: ddl('create table rt_probe (id number(10))'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS' },
    },
    {
        name: 'duplicate-column-in-a-definition',
        run: ddl('create table rt_err_dup (a number(10), a number(10))'),
        expected: { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifierType: 'column', identifierErrorType: 'duplicate' },
    },
    {
        name: 'ambiguous-column',
        run: query('select id from rt_probe a, rt_probe b'),
        expected: { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifierType: 'column', identifierErrorType: 'ambiguous' },
    },
    {
        name: 'column-outside-the-group-by',
        run: query('select id, count(*) from rt_probe'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid grouping' },
    },
    {
        name: 'aggregate-in-a-where',
        run: query('select id from rt_probe where count(*) > 1'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid grouping' },
    },
    {
        name: 'number-past-its-precision',
        run: mutation('update rt_probe set amount = 100000000000 where id = 1'),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'out of range' },
    },
    {
        name: 'value-too-long',
        run: mutation(`insert into rt_probe (id, name) values (10, '${'x'.repeat(51)}')`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'too long', columnName: 'NAME' },
    },
    {
        name: 'text-that-is-not-a-number',
        run: query(`select to_number('abc') from dual`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value' },
    },
    {
        name: 'text-that-is-not-a-date',
        run: query(`select to_date('2020-01-xx', 'YYYY-MM-DD') from dual`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid format' },
    },
    {
        name: 'invalid-regular-expression',
        run: query(`select 1 from dual where regexp_like('a', '(')`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid regular expression' },
    },
    {
        name: 'invalid-json',
        run: query(`select json_value('{', '$.a' error on error) from dual`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid json' },
    },
    {
        name: 'sequence-past-its-maximum',
        setup: [oracleDrop('sequence', 'rt_err_seq'), 'create sequence rt_err_seq minvalue 0 maxvalue 1 start with 1 nocycle'],
        cleanup: [oracleDrop('sequence', 'rt_err_seq')],
        run: async ({ runner }) => {
            await runner.executeSelectManyRows('select rt_err_seq.nextval from dual')
            return runner.executeSelectManyRows('select rt_err_seq.nextval from dual')
        },
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'sequence limit' },
    },
    {
        name: 'exception-raised-by-user-code',
        run: mutation(`begin raise_application_error(-20001, 'rt_err raised'); end;`),
        expected: { reason: 'SQL_USER_DEFINED_ERROR', databaseErrorNumber: 20001, databaseErrorMessage: expect.stringContaining('rt_err raised') },
    },
    {
        name: 'write-in-a-read-only-transaction',
        run: async ({ runner }) => {
            await runner.executeBeginTransaction([undefined, 'read only'])
            try {
                return await runner.executeUpdate(`update rt_probe set name = 'x'`)
            } finally {
                await runner.executeRollback().catch(() => undefined)
            }
        },
        expected: { reason: 'SQL_READ_ONLY_VIOLATION' },
    },
    {
        name: 'rollback-to-a-missing-savepoint',
        run: ({ runner }) => inTransaction(runner, async () => {
            await runner.executeUpdate(`update rt_probe set name = 'x' where id = 1`)
            return runner.executeUpdate('rollback to savepoint rt_err_missing')
        }),
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid savepoint' },
    },
    {
        name: 'row-locked-by-another-session',
        serverOnly: true,
        run: async (ctx) => {
            const other = await ctx.otherSession()
            await other.executeBeginTransaction()
            try {
                await other.executeUpdate(`update rt_probe set name = 'locked' where id = 1`)
                return await inTransaction(ctx.runner, () => ctx.runner.executeSelectManyRows('select id from rt_probe where id = 1 for update nowait'))
            } finally {
                await other.executeRollback().catch(() => undefined)
            }
        },
        expected: { reason: 'SQL_TIMEOUT', timeoutType: 'lock' },
    },
    {
        name: 'deadlock',
        serverOnly: true,
        run: (ctx) => deadlock(ctx, id => `update rt_probe set name = 'deadlock' where id = ${id}`),
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'deadlock' },
    },
    {
        name: 'serialization-failure',
        serverOnly: true,
        run: async (ctx) => {
            const a = ctx.runner
            const b = await ctx.otherSession()
            await a.executeBeginTransaction(['snapshot'])
            try {
                await a.executeSelectManyRows('select name from rt_probe where id = 1')
                await b.executeBeginTransaction()
                await b.executeUpdate(`update rt_probe set name = 'changed' where id = 1`)
                await b.executeCommit()
                return await a.executeUpdate(`update rt_probe set name = 'stale' where id = 1`)
            } finally {
                await a.executeRollback().catch(() => undefined)
            }
        },
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'serialization failure' },
    },
    {
        name: 'drop-a-missing-index',
        run: ddl('drop index rt_err_missing'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'index' },
    },
    {
        name: 'drop-a-missing-procedure',
        run: ddl('drop procedure rt_err_missing'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND' },
    },
    {
        name: 'drop-a-missing-trigger',
        run: ddl('drop trigger rt_err_missing'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'trigger' },
    },
    {
        name: 'column-list-already-indexed',
        setup: [oracleDrop('table', 'rt_err_indexed'), 'create table rt_err_indexed (n number(10))', 'create index rt_err_indexed_a on rt_err_indexed (n)'],
        cleanup: [oracleDrop('table', 'rt_err_indexed')],
        run: ddl('create index rt_err_indexed_b on rt_err_indexed (n)'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'index' },
    },
    {
        name: 'column-already-exists',
        run: ddl('alter table rt_probe add (name varchar2(10))'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'column' },
    },
    {
        name: 'constraint-name-already-used',
        setup: [oracleDrop('table', 'rt_err_named'), 'create table rt_err_named (n number(10) constraint rt_err_named_n check (n > 0))'],
        cleanup: [oracleDrop('table', 'rt_err_named')],
        run: ddl('alter table rt_err_named add constraint rt_err_named_n check (n < 100)'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS' },
    },
    {
        name: 'view-with-errors',
        setup: ['create or replace force view rt_err_broken as select rt_err_missing from dual'],
        cleanup: [`begin execute immediate 'drop view rt_err_broken'; exception when others then null; end;`],
        run: query('select * from rt_err_broken'),
        expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'invalid state' },
    },
    {
        name: 'inconsistent-datatypes',
        run: query('select 1 from dual where sysdate = 1'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'type mismatch' },
    },
    {
        name: 'union-of-different-types',
        run: query(`select 1 from dual union select 'a' from dual`),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'type mismatch' },
    },
    {
        name: 'union-of-different-column-counts',
        run: query('select 1, 2 from dual union select 1 from dual'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid reference' },
    },
    {
        name: 'identifier-too-long',
        run: query(`select 1 as ${'a'.repeat(200)} from dual`),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid identifier' },
    },
    {
        name: 'window-function-in-a-where',
        run: query('select id from rt_probe where row_number() over (order by id) = 1'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid windowing' },
    },
    {
        name: 'set-transaction-after-a-statement',
        run: ({ runner }) => inTransaction(runner, async () => {
            await runner.executeUpdate(`update rt_probe set name = 'x' where id = 1`)
            return runner.executeUpdate('set transaction read only')
        }),
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid state' },
    },
    {
        name: 'insufficient-privileges',
        run: ddl('create user rt_err_user identified by rt_err_password'),
        expected: { reason: 'SQL_PERMISSION_DENIED' },
    },
    {
        name: 'trigger-with-compilation-errors',
        setup: [
            oracleDrop('table', 'rt_err_triggered'),
            'create table rt_err_triggered (n number(10))',
            'create or replace trigger rt_err_broken_trigger before insert on rt_err_triggered for each row begin rt_err_missing; end;',
        ],
        cleanup: [oracleDrop('table', 'rt_err_triggered')],
        run: mutation('insert into rt_err_triggered (n) values (1)'),
        expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'invalid state' },
    },
    {
        name: 'function-with-compilation-errors',
        setup: ['create or replace function rt_err_broken_function return number as begin return rt_err_missing; end;'],
        cleanup: [`begin execute immediate 'drop function rt_err_broken_function'; exception when others then null; end;`],
        run: query('select rt_err_broken_function() from dual'),
        expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'invalid state' },
    },
    {
        name: 'invalid-xml',
        run: query(`select xmltype('<a>') from dual`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid xml' },
    },
    {
        name: 'statement-broken-off-by-the-client',
        onlyRunners: ['OracleDBQueryRunner'],
        run: async ({ runner }) => {
            const connection = runner.getNativeRunner() as { break(): Promise<void> }
            const sleeping = failureOf(runner.executeUpdate('begin dbms_session.sleep(5); end;'))
            await new Promise(resolve => setTimeout(resolve, 300))
            await connection.break()
            throw await sleeping
        },
        expected: { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled' },
    },
]

// ---- SQLite ----------------------------------------------------------------

const sqliteScenarios: readonly ErrorScenario[] = [
    {
        // A parameter numbered past the limit: the limit itself depends on how SQLite was built (32766 by default, more
        // in Bun), so its number is beyond any of them
        name: 'more-parameters-than-allowed',
        run: ({ runner }) => runner.executeSelectManyRows('select ?999999999 as one', [1]),
        expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'parameters' },
    },
    {
        name: 'duplicate-primary-key',
        run: mutation(`insert into rt_probe (id, name) values (1, 'dup')`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'unique', tableName: 'rt_probe', columnName: 'id' },
    },
    {
        name: 'duplicate-in-a-unique-index',
        setup: ['create table rt_err_unique (n integer)', 'create unique index rt_err_unique_n on rt_err_unique (n)', 'insert into rt_err_unique (n) values (1)'],
        cleanup: ['drop table if exists rt_err_unique'],
        run: mutation(`insert into rt_err_unique (n) values (1)`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'unique', tableName: 'rt_err_unique', columnName: 'n' },
    },
    {
        name: 'null-in-a-not-null-column',
        run: mutation(`insert into rt_probe (id, name) values (10, null)`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'not null', tableName: 'rt_probe', columnName: 'name' },
    },
    {
        name: 'foreign-key-without-parent',
        setup: ['pragma foreign_keys = on', 'create table rt_err_child (id integer primary key, probe_id integer references rt_probe (id))'],
        cleanup: ['drop table if exists rt_err_child', 'pragma foreign_keys = off'],
        run: mutation(`insert into rt_err_child (id, probe_id) values (1, 99)`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'foreign key' },
    },
    {
        name: 'check-constraint',
        setup: ['create table rt_err_check (n integer constraint rt_err_check_positive check (n > 0))'],
        cleanup: ['drop table if exists rt_err_check'],
        run: mutation(`insert into rt_err_check (n) values (-1)`),
        expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'check', constraintName: 'rt_err_check_positive' },
    },
    {
        name: 'text-in-a-strict-integer-column',
        setup: ['create table rt_err_strict (n integer) strict'],
        cleanup: ['drop table if exists rt_err_strict'],
        run: mutation(`insert into rt_err_strict (n) values ('abc')`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value' },
    },
    {
        name: 'abort-raised-by-a-trigger',
        setup: [
            'create table rt_err_guarded (n integer)',
            `create trigger rt_err_guard before insert on rt_err_guarded begin select raise(abort, 'rt_err raised'); end`,
        ],
        cleanup: ['drop table if exists rt_err_guarded'],
        run: mutation('insert into rt_err_guarded (n) values (1)'),
        // SQLITE_CONSTRAINT_TRIGGER: only RAISE in a trigger reports it
        onlyRunners: ['BetterSqlite3QueryRunner', 'BunSqliteQueryRunner', 'BunSqlSqliteQueryRunner', 'NodeSqliteQueryRunner', 'Sqlite3WasmOO1QueryRunner'],
        expected: { reason: 'SQL_USER_DEFINED_ERROR', databaseErrorMessage: expect.stringContaining('rt_err raised') },
    },
    {
        name: 'syntax-error',
        run: query('selec 1'),
        expected: { reason: 'SQL_SYNTAX_ERROR' },
    },
    {
        name: 'missing-table',
        run: query('select * from rt_err_missing'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'table or view', objectName: 'rt_err_missing' },
    },
    {
        name: 'missing-column',
        run: query('select rt_err_missing from rt_probe'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'column', objectName: 'rt_err_missing' },
    },
    {
        name: 'missing-function',
        run: query('select rt_err_missing()'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'routine', objectName: 'rt_err_missing' },
    },
    {
        name: 'missing-collation',
        run: query(`select 1 where 'a' = 'b' collate rt_err_missing`),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'collation', objectName: 'rt_err_missing' },
    },
    {
        name: 'table-already-exists',
        run: ddl('create table rt_probe (id integer)'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectName: 'rt_probe' },
    },
    {
        name: 'duplicate-column-in-a-definition',
        run: ddl('create table rt_err_dup (a integer, a integer)'),
        expected: { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifierType: 'column', identifierErrorType: 'duplicate' },
    },
    {
        name: 'ambiguous-column',
        run: query('select id from rt_probe a, rt_probe b'),
        expected: { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifierType: 'column', identifierErrorType: 'ambiguous', identifier: 'id' },
    },
    {
        name: 'aggregate-in-a-where',
        run: query('select id from rt_probe where count(*) > 1'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid grouping' },
    },
    {
        name: 'integer-overflow',
        run: query('select abs(-9223372036854775807 - 1)'),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'out of range' },
    },
    {
        name: 'blob-too-big',
        // Bun's SQLite (bun:sqlite, Bun SQL, node:sqlite under Bun) is built with a larger SQLITE_MAX_LENGTH
        onlyRunners: ['BetterSqlite3QueryRunner', 'Sqlite3WasmOO1QueryRunner'],
        run: query('select zeroblob(2000000000)'),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'too long' },
    },
    {
        name: 'malformed-json',
        run: query(`select json('{')`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid json' },
    },
    {
        name: 'write-in-a-query-only-connection',
        setup: ['pragma query_only = 1'],
        cleanup: ['pragma query_only = 0'],
        run: mutation(`update rt_probe set name = 'x'`),
        expected: { reason: 'SQL_READ_ONLY_VIOLATION' },
    },
    {
        name: 'commit-without-a-transaction',
        run: mutation('commit'),
        expected: { reason: 'NOT_IN_TRANSACTION' },
    },
    {
        name: 'release-a-missing-savepoint',
        run: mutation('release rt_err_missing'),
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid savepoint' },
    },
    {
        name: 'database-that-cannot-be-opened',
        run: ddl(`attach database '/rt_err_missing_dir/rt_err.db' as rt_err`),
        expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' },
    },
    {
        name: 'begin-inside-a-transaction',
        run: ({ runner }) => inTransaction(runner, () => runner.executeUpdate('begin')),
        expected: { reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' },
    },
    {
        name: 'rollback-without-a-transaction',
        run: mutation('rollback'),
        expected: { reason: 'NOT_IN_TRANSACTION' },
    },
    {
        name: 'drop-a-missing-index',
        run: ddl('drop index rt_err_missing'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'index', objectName: 'rt_err_missing' },
    },
    {
        name: 'drop-a-missing-trigger',
        run: ddl('drop trigger rt_err_missing'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'trigger', objectName: 'rt_err_missing' },
    },
    {
        name: 'table-in-an-unknown-database',
        run: ddl('create table rt_err_missing.t (n integer)'),
        expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'database', objectName: 'rt_err_missing' },
    },
    {
        name: 'view-already-exists',
        setup: ['create view rt_err_view as select id from rt_probe'],
        cleanup: ['drop view if exists rt_err_view'],
        run: ddl('create view rt_err_view as select id from rt_probe'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'table or view', objectName: 'rt_err_view' },
    },
    {
        name: 'index-already-exists',
        setup: ['create index rt_err_index on rt_probe (name)'],
        cleanup: ['drop index if exists rt_err_index'],
        run: ddl('create index rt_err_index on rt_probe (name)'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'index', objectName: 'rt_err_index' },
    },
    {
        name: 'trigger-already-exists',
        setup: ['create trigger rt_err_trigger after insert on rt_probe begin select 1; end'],
        cleanup: ['drop trigger if exists rt_err_trigger'],
        run: ddl('create trigger rt_err_trigger after insert on rt_probe begin select 1; end'),
        expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'trigger', objectName: 'rt_err_trigger' },
    },
    {
        name: 'write-into-a-view',
        setup: ['create view rt_err_view as select id from rt_probe'],
        cleanup: ['drop view if exists rt_err_view'],
        run: mutation('insert into rt_err_view (id) values (10)'),
        expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'wrong object type', objectName: 'rt_err_view' },
    },
    {
        name: 'index-on-a-view',
        setup: ['create view rt_err_view as select id from rt_probe'],
        cleanup: ['drop view if exists rt_err_view'],
        run: ddl('create index rt_err_view_id on rt_err_view (id)'),
        expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'wrong object type' },
    },
    {
        name: 'incomplete-statement',
        run: query('select ('),
        expected: { reason: 'SQL_SYNTAX_ERROR' },
    },
    {
        name: 'unrecognized-token',
        run: query('select #'),
        expected: { reason: 'SQL_SYNTAX_ERROR' },
    },
    {
        name: 'vacuum-inside-a-transaction',
        run: ({ runner }) => inTransaction(runner, () => runner.executeUpdate('vacuum')),
        expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'active transaction' },
    },
    {
        name: 'sub-select-with-two-columns',
        run: query('select 1 where 1 in (select 1, 2)'),
        expected: { reason: 'SQL_CARDINALITY_VIOLATION' },
    },
    {
        name: 'recursive-table-referenced-twice',
        run: query('with recursive t (n) as (select 1 union all select t.n + 1 from t, t as u where t.n < 3) select * from t'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid recursion' },
    },
    {
        name: 'window-frame-that-starts-after-it-ends',
        run: query('select sum(id) over (order by id rows between 1 following and current row) from rt_probe'),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid windowing' },
    },
    {
        name: 'foreign-key-to-a-non-unique-column',
        setup: ['pragma foreign_keys = on', 'create table rt_err_child (id integer primary key, probe_name varchar(50) references rt_probe (name))'],
        cleanup: ['drop table if exists rt_err_child', 'pragma foreign_keys = off'],
        run: mutation(`insert into rt_err_child (id, probe_name) values (1, 'one')`),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid definition' },
    },
    {
        name: 'on-conflict-without-a-matching-constraint',
        run: mutation(`insert into rt_probe (id, name) values (10, 'ten') on conflict (name) do nothing`),
        expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid reference' },
    },
    {
        name: 'text-as-a-rowid',
        run: mutation(`insert into rt_auto (id, name) values ('abc', 'x')`),
        expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value' },
    },
    {
        name: 'parameter-the-statement-does-not-use',
        // bun:sqlite, Bun SQL and sqlite-wasm ignore the extra value, and so does better-sqlite3 binding the values
        // from an object (only the parameters the statement has are read from it)
        onlyRunners: ['NodeSqliteQueryRunner'],
        run: ({ runner }) => runner.executeSelectManyRows('select 1', [1]),
        expected: { reason: 'SQL_INVALID_PARAMETER' },
    },
    {
        name: 'parameter-the-statement-is-missing',
        // node:sqlite and sqlite-wasm bind NULL for it
        onlyRunners: ['BetterSqlite3QueryRunner', 'BunSqliteQueryRunner', 'BunSqlSqliteQueryRunner'],
        run: ({ runner }) => runner.executeSelectManyRows('select ?1, ?2', [1]),
        // better-sqlite3 names the missing parameter (missing), Bun says how many it expected (wrong count)
        expected: { reason: 'SQL_INVALID_PARAMETER' },
    },
    {
        name: 'function-called-with-the-wrong-argument-count',
        run: query('select abs(1, 2)'),
        expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'wrong count' },
    },
    {
        name: 'file-that-is-not-a-database',
        // A file outside the virtual filesystem of sqlite-wasm
        onlyRunners: ['BetterSqlite3QueryRunner', 'BunSqliteQueryRunner', 'BunSqlSqliteQueryRunner', 'NodeSqliteQueryRunner'],
        cleanup: ['detach database rt_err_not_a_db'],
        run: ddl(`attach database '/etc/hosts' as rt_err_not_a_db`),
        expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' },
    },
]

/**
 * What a connection that fails on purpose (acquireRunnerTestDatabase(failure))
 * is reported as, per database server.
 */
export const CONNECTION_FAILURES: Partial<Record<DatabaseType, Partial<Record<RunnerConnectionFailure, Expected>>>> = {
    postgreSql: {
        'wrong password': { reason: 'SQL_AUTHENTICATION_ERROR' },
        'unreachable': { reason: 'SQL_CONNECTION_ERROR' },
        'unknown database': { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'database' },
    },
    mySql: {
        'wrong password': { reason: 'SQL_AUTHENTICATION_ERROR' },
        'unreachable': { reason: 'SQL_CONNECTION_ERROR' },
        'unknown database': { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'database' },
    },
    mariaDB: {
        'wrong password': { reason: 'SQL_AUTHENTICATION_ERROR' },
        'unreachable': { reason: 'SQL_CONNECTION_ERROR' },
        'unknown database': { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'database' },
    },
    oracle: {
        'wrong password': { reason: 'SQL_AUTHENTICATION_ERROR' },
        'unreachable': { reason: 'SQL_CONNECTION_ERROR' },
        'unknown database': { reason: 'SQL_CONNECTION_ERROR' },
    },
    sqlServer: {
        'wrong password': { reason: 'SQL_AUTHENTICATION_ERROR' },
        'unreachable': { reason: 'SQL_CONNECTION_ERROR' },
        // The login fails (18456) without saying the database doesn't exist
        'unknown database': { reason: 'SQL_AUTHENTICATION_ERROR' },
    },
}

export const ERROR_SCENARIOS: Partial<Record<DatabaseType, readonly ErrorScenario[]>> = {
    postgreSql: postgresScenarios,
    mySql: mysqlScenarios,
    mariaDB: mariadbScenarios,
    sqlServer: sqlServerScenarios,
    oracle: oracleScenarios,
    sqlite: sqliteScenarios,
}
