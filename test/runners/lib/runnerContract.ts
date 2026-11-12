// The behaviour every query runner promises through the QueryRunner interface,
// checked against the runner's real engine with hand-written SQL (see
// dialects.ts). Each test/runners/<db>/<Runner>.test.ts calls
// describeRunnerContract with a factory for its runner; what a database can't
// do (no RETURNING, no procedures, the levels it doesn't offer) is decided by
// its dialect, so the same contract fits every runner.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../lib/testRunner.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { QueryExecutionSource, TsSqlError, TsSqlProcessingError, TsSqlQueryExecutionError } from '../../../src/TsSqlError.js'
import { ChainedQueryRunner } from '../../../src/queryRunners/ChainedQueryRunner.js'
import { queryContainsMutationReturningClause, setMetadata } from '../../../src/utils/metadataSymbols.js'
import type { RunnerDialect } from './dialects.js'
import { CONNECTION_FAILURES, ERROR_SCENARIOS } from './errorScenarios.js'
import { DRIVER_NAMED_ERROR_NUMBERS, raisedErrors } from './raisedErrors.js'
import type { RunnerConnectionFailure } from '../../lib/containerLifecycle.js'

type RunnerClass = { getErrorReason(error: unknown, database?: any): { reason: string }, isSqlError(error: unknown): boolean }

export interface RunnerUnderTest {
    readonly runner: QueryRunner
    close(): Promise<void>
    /** The runner class, when the test file can only load it inside create() (the Bun runners: Node can't import them). */
    readonly runnerClass?: RunnerClass
}

export interface RunnerContractOptions {
    /** describe() label, e.g. 'PgPoolQueryRunner'. */
    readonly label: string
    readonly dialect: RunnerDialect
    /** Whether the runner's engine is available in this run (see isRealDbEnabled). */
    readonly realEnabled: boolean
    /**
     * Builds the runner. With a `failure` (a database server's runner only),
     * one whose connection fails that way, from acquireRunnerTestDatabase(failure).
     */
    create(failure?: RunnerConnectionFailure): Promise<RunnerUnderTest>
    /** The runner was built with nested transactions allowed. */
    readonly nestedTransactions?: boolean
    /** A pool runner: it holds a dedicated connection only inside a transaction. */
    readonly pool?: boolean
    /** commit/rollback without a transaction are accepted (Oracle's single-connection runner: Oracle is always in one). */
    readonly endWithoutTransaction?: boolean
    /** The runner class, whose static getErrorReason / isSqlError the runner's own methods mirror. */
    readonly runnerClass?: RunnerClass
    readonly timeoutMs?: number
    /**
     * Run the database's error scenarios (errorScenarios.ts) on this runner;
     * default true. A variant of a runner already tested (nested transactions,
     * SynchronousPromise) maps errors the same way and turns them off.
     */
    readonly errorScenarios?: boolean
    /**
     * Properties a real error of this driver has, that the synthetic error
     * cases of its mapper (test/runners/general/mappers/) fill in: the guard
     * that the shape they copy is still the driver's.
     */
    readonly errorFields?: readonly string[]
    /** create('client timeout') gives the driver a short timeout of its own (see CLIENT_TIMEOUTS). */
    readonly clientTimeout?: boolean
    /** A database server: a second create() reaches the same database (not an in-process one); default true but on SQLite. */
    readonly sharedDatabase?: boolean
    /**
     * The driver doesn't tell that the database rolled the transaction back by itself (no flag of the connection, nothing
     * in the error), and the library sends no query to ask: the tests of such a transaction don't apply.
     */
    readonly rolledBackTransactionUndetected?: boolean
    /**
     * The driver rejects a script of several statements in one call unless it is configured to accept them (mysql2 and
     * mariadb without `multipleStatements`)
     */
    readonly schemaScriptRejected?: boolean
    /** Runs a statement with the driver's own API on the connection execute(fn) / getCurrentNativeConnection() give */
    readonly nativeExecute: (connection: any, sql: string) => Promise<unknown>
}

const SEED: readonly { id: number, name: string, amount: number | null }[] = [
    { id: 1, name: 'one', amount: 10 },
    { id: 2, name: 'two', amount: 20 },
    { id: 3, name: 'three', amount: null },
]

const ALL_LEVELS = ['read uncommitted', 'read committed', 'repeatable read', 'snapshot', 'serializable'] as const

/**
 * Adds a parameter with the name and the category of its type, as the SqlBuilders do: SQL Server
 * binds it with that type instead of inferring one from the value (a null can't be inferred).
 * Harmless on the databases whose runner doesn't read it.
 */
export function addTypedParam(runner: QueryRunner, params: any[], value: unknown, type: 'int' | 'string'): string {
    return runner.addParam(params, value, type, type, false)
}

/** Rows with their id as a number (an Oracle OUT bind returns it as a string; the library converts it later). */
function withNumericIds(rows: readonly any[]): any[] {
    return rows.map(row => ({ ...row, id: Number(row.id) })).sort((a, b) => a.id - b.id)
}

export function reasonOf(error: unknown): string | undefined {
    return error instanceof TsSqlError ? error.errorReason.reason : undefined
}

export async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
    try {
        await promise
    } catch (e) {
        return e
    }
    throw new Error('Expected the promise to be rejected')
}

export function describeRunnerContract(opts: RunnerContractOptions): void {
    const { dialect } = opts
    const timeout = opts.timeoutMs ?? 180_000
    let under: RunnerUnderTest | undefined
    const r = (): QueryRunner => {
        if (!under) throw new Error(opts.label + ': runner read before beforeAll')
        return under.runner
    }
    const col = dialect.column
    const probeColumns = `${col('id')}, ${col('name')}`

    async function reseed(): Promise<void> {
        const runner = r()
        while (runner.isTransactionActive()) {
            await runner.executeRollback()
        }
        await runner.executeDelete('delete from rt_probe')
        await runner.executeDelete('delete from rt_auto')
        for (const row of SEED) {
            const params: any[] = []
            const sql = `insert into rt_probe (id, name, amount) values (${addTypedParam(runner, params, row.id, 'int')}, ${addTypedParam(runner, params, row.name, 'string')}, ${addTypedParam(runner, params, row.amount, 'int')})`
            await runner.executeInsert(sql, params)
        }
    }

    async function count(): Promise<number> {
        return Number(await r().executeSelectOneColumnOneRow('select count(*) from rt_probe'))
    }

    describe.skipIf(!opts.realEnabled)(opts.label, () => {
        beforeAll(async () => {
            under = await opts.create()
            for (const ddl of dialect.setup) {
                await under.runner.executeDatabaseSchemaModification(ddl)
            }
        }, timeout)
        afterAll(async () => {
            if (under) {
                await under.close()
                under = undefined
            }
        }, timeout)
        beforeEach(reseed, timeout)

        // ---- reads -------------------------------------------------------

        test('select-one-row', async () => {
            const p: any[] = []
            const row = await r().executeSelectOneRow(`select ${probeColumns} from rt_probe where id = ${r().addParam(p, 1, 'int', 'int', false)}`, p)
            expect(row).toEqual({ id: 1, name: 'one' })
        })

        test('select-one-row-without-rows-is-undefined', async () => {
            const p: any[] = []
            const row = await r().executeSelectOneRow(`select ${probeColumns} from rt_probe where id = ${r().addParam(p, 99, 'int', 'int', false)}`, p)
            expect(row).toBeUndefined()
        })

        test('select-one-row-with-two-rows-fails', async () => {
            const error = await rejectionOf(r().executeSelectOneRow(`select ${probeColumns} from rt_probe`))
            expect(reasonOf(error)).toBe('MORE_THAN_ONE_ROW')
        })

        test('select-many-rows', async () => {
            const rows = await r().executeSelectManyRows(`select ${probeColumns} from rt_probe order by id`)
            // Spread: Bun SQL's row arrays carry extra properties (count, command)
            expect([...rows]).toEqual([{ id: 1, name: 'one' }, { id: 2, name: 'two' }, { id: 3, name: 'three' }])
        })

        test('select-one-column-one-row', async () => {
            const p: any[] = []
            const value = await r().executeSelectOneColumnOneRow(`select ${col('name')} from rt_probe where id = ${r().addParam(p, 2, 'int', 'int', false)}`, p)
            expect(value).toBe('two')
        })

        test('select-one-column-one-row-without-rows-is-undefined', async () => {
            const p: any[] = []
            const value = await r().executeSelectOneColumnOneRow(`select ${col('name')} from rt_probe where id = ${r().addParam(p, 99, 'int', 'int', false)}`, p)
            expect(value).toBeUndefined()
        })

        test('select-one-column-one-row-with-two-columns-fails', async () => {
            const p: any[] = []
            const error = await rejectionOf(r().executeSelectOneColumnOneRow(`select ${probeColumns} from rt_probe where id = ${r().addParam(p, 1, 'int', 'int', false)}`, p))
            expect(reasonOf(error)).toBe('ONLY_ONE_COLUMN_EXPECTED')
        })

        test('select-one-column-one-row-with-two-rows-fails', async () => {
            const error = await rejectionOf(r().executeSelectOneColumnOneRow(`select ${col('name')} from rt_probe`))
            expect(reasonOf(error)).toBe('MORE_THAN_ONE_ROW')
        })

        test('select-one-column-many-rows', async () => {
            const values = await r().executeSelectOneColumnManyRows(`select ${col('name')} from rt_probe order by id`)
            expect(values).toEqual(['one', 'two', 'three'])
        })

        test('select-one-column-many-rows-with-two-columns-fails', async () => {
            const error = await rejectionOf(r().executeSelectOneColumnManyRows(`select ${probeColumns} from rt_probe`))
            expect(reasonOf(error)).toBe('ONLY_ONE_COLUMN_EXPECTED')
        })

        test('select-null-value', async () => {
            const p: any[] = []
            const value = await r().executeSelectOneColumnOneRow(`select ${col('amount')} from rt_probe where id = ${r().addParam(p, 3, 'int', 'int', false)}`, p)
            expect(value).toBeNull()
        })

        // ---- inserts -----------------------------------------------------

        test('insert-reports-inserted-rows', async () => {
            const p: any[] = []
            const inserted = await r().executeInsert(`insert into rt_probe (id, name) values (${r().addParam(p, 10, 'int', 'int', false)}, ${r().addParam(p, 'ten', 'string', 'string', false)})`, p)
            expect(inserted).toBe(1)
            expect(await count()).toBe(4)
        })

        test('insert-returning-last-inserted-id', async () => {
            const p1: any[] = []
            const first = Number(await r().executeInsertReturningLastInsertedId(dialect.insertReturningId(r(), p1, 'auto one'), p1))
            const p2: any[] = []
            const second = Number(await r().executeInsertReturningLastInsertedId(dialect.insertReturningId(r(), p2, 'auto two'), p2))
            expect(first).toBeGreaterThan(0)
            expect(second).toBeGreaterThan(first)
        })

        test.skipIf(!dialect.insertReturningIds)('insert-returning-multiple-last-inserted-ids', async () => {
            const p: any[] = []
            const ids = (await r().executeInsertReturningMultipleLastInsertedId(dialect.insertReturningIds!(r(), p, ['many one', 'many two']), p)).map(Number)
            expect(ids).toHaveLength(2)
            expect(ids[1]!).toBeGreaterThan(ids[0]!)
        })

        test.skipIf(!dialect.insertReturningRow)('insert-returning-one-row', async () => {
            const p: any[] = []
            const row = await r().executeInsertReturningOneRow(dialect.insertReturningRow!(r(), p, 20, 'twenty'), p)
            expect(withNumericIds([row])).toEqual([{ id: 20, name: 'twenty' }])
        })

        test.skipIf(!dialect.insertReturningRow)('insert-returning-many-rows', async () => {
            const p: any[] = []
            const rows = await r().executeInsertReturningManyRows(dialect.insertReturningRow!(r(), p, 21, 'twenty-one'), p)
            expect(withNumericIds(rows)).toEqual([{ id: 21, name: 'twenty-one' }])
        })

        // ---- updates -----------------------------------------------------

        test('update-reports-updated-rows', async () => {
            const p: any[] = []
            const updated = await r().executeUpdate(`update rt_probe set amount = ${r().addParam(p, 5, 'int', 'int', false)} where id >= ${r().addParam(p, 2, 'int', 'int', false)}`, p)
            expect(updated).toBe(2)
        })

        test.skipIf(!dialect.updateReturningRow)('update-returning-one-row', async () => {
            const p: any[] = []
            const row = await r().executeUpdateReturningOneRow(dialect.updateReturningRow!(r(), p, 'THREE', 3), p)
            expect(withNumericIds([row])).toEqual([{ id: 3, name: 'THREE' }])
        })

        test.skipIf(!dialect.updateReturningRow)('update-returning-one-row-with-two-rows-fails', async () => {
            const p: any[] = []
            const error = await rejectionOf(r().executeUpdateReturningOneRow(dialect.updateReturningRow!(r(), p, 'X', 2), p))
            expect(reasonOf(error)).toBe('MORE_THAN_ONE_ROW')
        })

        test.skipIf(!dialect.updateReturningRow)('update-returning-many-rows', async () => {
            const p: any[] = []
            const rows = await r().executeUpdateReturningManyRows(dialect.updateReturningRow!(r(), p, 'X', 2), p)
            expect(withNumericIds(rows)).toEqual([{ id: 2, name: 'X' }, { id: 3, name: 'X' }])
        })

        test.skipIf(!dialect.updateReturningId)('update-returning-one-column-one-row', async () => {
            const p: any[] = []
            const id = await r().executeUpdateReturningOneColumnOneRow(dialect.updateReturningId!(r(), p, 'X', 3), p)
            expect(Number(id)).toBe(3)
        })

        test.skipIf(!dialect.updateReturningId)('update-returning-one-column-many-rows', async () => {
            const p: any[] = []
            const ids = await r().executeUpdateReturningOneColumnManyRows(dialect.updateReturningId!(r(), p, 'X', 2), p)
            expect(ids.map(Number).sort()).toEqual([2, 3])
        })

        test.skipIf(!dialect.updateReturningRow)('update-returning-one-column-one-row-with-two-columns-fails', async () => {
            const p: any[] = []
            const error = await rejectionOf(r().executeUpdateReturningOneColumnOneRow(dialect.updateReturningRow!(r(), p, 'X', 3), p))
            expect(reasonOf(error)).toBe('ONLY_ONE_COLUMN_EXPECTED')
        })

        test('update-flagged-without-returning-clause-runs-as-a-plain-update', async () => {
            // An empty `returning({})` makes the SqlBuilder emit no returning
            // clause and flag the params; the runner then runs a plain update and
            // reports no returned rows.
            const p: any[] = []
            const sql = `update rt_probe set name = ${r().addParam(p, 'plain', 'string', 'string', false)} where id = ${r().addParam(p, 1, 'int', 'int', false)}`
            setMetadata(p, queryContainsMutationReturningClause, false)
            const rows = await r().executeUpdateReturningManyRows(sql, p)
            expect(rows).toEqual([])
            const p2: any[] = []
            expect(await r().executeSelectOneColumnOneRow(`select ${col('name')} from rt_probe where id = ${r().addParam(p2, 1, 'int', 'int', false)}`, p2)).toBe('plain')
        })

        // ---- deletes -----------------------------------------------------

        test('delete-reports-deleted-rows', async () => {
            const p: any[] = []
            const deleted = await r().executeDelete(`delete from rt_probe where id >= ${r().addParam(p, 2, 'int', 'int', false)}`, p)
            expect(deleted).toBe(2)
            expect(await count()).toBe(1)
        })

        test.skipIf(!dialect.deleteReturningRow)('delete-returning-one-row', async () => {
            const p: any[] = []
            const row = await r().executeDeleteReturningOneRow(dialect.deleteReturningRow!(r(), p, 3), p)
            expect(withNumericIds([row])).toEqual([{ id: 3, name: 'three' }])
        })

        test.skipIf(!dialect.deleteReturningRow)('delete-returning-many-rows', async () => {
            const p: any[] = []
            const rows = await r().executeDeleteReturningManyRows(dialect.deleteReturningRow!(r(), p, 2), p)
            expect(withNumericIds(rows)).toEqual([{ id: 2, name: 'two' }, { id: 3, name: 'three' }])
        })

        // ---- one-column returning and the shape errors of mutations -----

        test.skipIf(!dialect.insertReturningRow)('insert-returning-one-column-one-row', async () => {
            const p: any[] = []
            const sql = (dialect.insertReturningIdWithClause ?? dialect.insertReturningId)(r(), p, 'auto')
            expect(Number(await r().executeInsertReturningOneColumnOneRow(sql, p))).toBeGreaterThan(0)
        })

        test.skipIf(!dialect.insertReturningIds)('insert-returning-one-column-many-rows', async () => {
            const p: any[] = []
            expect(await r().executeInsertReturningOneColumnManyRows(dialect.insertReturningIds!(r(), p, ['a', 'b']), p)).toHaveLength(2)
        })

        test.skipIf(!dialect.insertReturningIds)('insert-returning-last-inserted-id-with-two-rows-fails', async () => {
            const p: any[] = []
            expect(reasonOf(await rejectionOf(r().executeInsertReturningLastInsertedId(dialect.insertReturningIds!(r(), p, ['a', 'b']), p)))).toBe('MORE_THAN_ONE_ROW')
        })

        test.skipIf(!dialect.insertReturningRow)('insert-returning-last-inserted-id-with-two-columns-fails', async () => {
            const p: any[] = []
            expect(reasonOf(await rejectionOf(r().executeInsertReturningLastInsertedId(dialect.insertReturningRow!(r(), p, 30, 'thirty'), p)))).toBe('ONLY_ONE_COLUMN_EXPECTED')
        })

        test.skipIf(!dialect.insertReturningRows)('insert-returning-multiple-last-inserted-ids-with-two-columns-fails', async () => {
            const p: any[] = []
            const sql = dialect.insertReturningRows!(r(), p, [{ id: 31, name: 'a' }, { id: 32, name: 'b' }])
            expect(reasonOf(await rejectionOf(r().executeInsertReturningMultipleLastInsertedId(sql, p)))).toBe('ONLY_ONE_COLUMN_EXPECTED')
        })

        test.skipIf(!dialect.insertReturningRows)('insert-returning-one-row-with-two-rows-fails', async () => {
            const p: any[] = []
            const sql = dialect.insertReturningRows!(r(), p, [{ id: 33, name: 'a' }, { id: 34, name: 'b' }])
            expect(reasonOf(await rejectionOf(r().executeInsertReturningOneRow(sql, p)))).toBe('MORE_THAN_ONE_ROW')
        })

        test.skipIf(!dialect.insertReturningRows)('insert-returning-one-column-one-row-with-two-rows-fails', async () => {
            const p: any[] = []
            const sql = dialect.insertReturningRows!(r(), p, [{ id: 35, name: 'a' }, { id: 36, name: 'b' }])
            expect(reasonOf(await rejectionOf(r().executeInsertReturningOneColumnOneRow(sql, p)))).toBe('MORE_THAN_ONE_ROW')
        })

        test.skipIf(!dialect.insertReturningRow)('insert-returning-one-column-with-two-columns-fails', async () => {
            const p1: any[] = []
            expect(reasonOf(await rejectionOf(r().executeInsertReturningOneColumnOneRow(dialect.insertReturningRow!(r(), p1, 37, 'a'), p1)))).toBe('ONLY_ONE_COLUMN_EXPECTED')
            const p2: any[] = []
            expect(reasonOf(await rejectionOf(r().executeInsertReturningOneColumnManyRows(dialect.insertReturningRow!(r(), p2, 38, 'b'), p2)))).toBe('ONLY_ONE_COLUMN_EXPECTED')
        })

        test.skipIf(!dialect.insertReturningIdWithClause)('insert-returning-last-inserted-id-through-a-returning-clause', async () => {
            const p: any[] = []
            expect(Number(await r().executeInsertReturningLastInsertedId(dialect.insertReturningIdWithClause!(r(), p, 'clause'), p))).toBeGreaterThan(0)
        })

        test.skipIf(!dialect.insertNothing)('insert-of-no-row-returns-no-id', async () => {
            const p1: any[] = []
            const id = await r().executeInsertReturningLastInsertedId(dialect.insertReturningId(r(), p1, 'first'), p1)
            const p2: any[] = []
            expect(await r().executeInsertReturningLastInsertedId(dialect.insertNothing!(r(), p2, Number(id)), p2)).toBeNull()
        })

        test.skipIf(!dialect.updateReturningRow)('update-returning-one-column-many-rows-with-two-columns-fails', async () => {
            const p: any[] = []
            expect(reasonOf(await rejectionOf(r().executeUpdateReturningOneColumnManyRows(dialect.updateReturningRow!(r(), p, 'X', 2), p)))).toBe('ONLY_ONE_COLUMN_EXPECTED')
        })

        test.skipIf(!dialect.updateReturningId)('update-returning-one-column-one-row-with-two-rows-fails', async () => {
            const p: any[] = []
            expect(reasonOf(await rejectionOf(r().executeUpdateReturningOneColumnOneRow(dialect.updateReturningId!(r(), p, 'X', 2), p)))).toBe('MORE_THAN_ONE_ROW')
        })

        test.skipIf(!dialect.deleteReturningId)('delete-returning-one-column', async () => {
            const p1: any[] = []
            expect(Number(await r().executeDeleteReturningOneColumnOneRow(dialect.deleteReturningId!(r(), p1, 3), p1))).toBe(3)
            const p2: any[] = []
            expect((await r().executeDeleteReturningOneColumnManyRows(dialect.deleteReturningId!(r(), p2, 1), p2)).map(Number).sort()).toEqual([1, 2])
        })

        test.skipIf(!dialect.deleteReturningRow)('delete-returning-shape-errors', async () => {
            const p1: any[] = []
            expect(reasonOf(await rejectionOf(r().executeDeleteReturningOneRow(dialect.deleteReturningRow!(r(), p1, 2), p1)))).toBe('MORE_THAN_ONE_ROW')
            await reseed()
            const p2: any[] = []
            expect(reasonOf(await rejectionOf(r().executeDeleteReturningOneColumnOneRow(dialect.deleteReturningRow!(r(), p2, 3), p2)))).toBe('ONLY_ONE_COLUMN_EXPECTED')
            await reseed()
            const p3: any[] = []
            expect(reasonOf(await rejectionOf(r().executeDeleteReturningOneColumnOneRow(dialect.deleteReturningId!(r(), p3, 2), p3)))).toBe('MORE_THAN_ONE_ROW')
            await reseed()
            const p4: any[] = []
            expect(reasonOf(await rejectionOf(r().executeDeleteReturningOneColumnManyRows(dialect.deleteReturningRow!(r(), p4, 2), p4)))).toBe('ONLY_ONE_COLUMN_EXPECTED')
        })

        test('insert-of-a-duplicate-key-fails', async () => {
            const runner = r()
            const p: any[] = []
            const error = await rejectionOf(runner.executeInsert(`insert into rt_probe (id, name) values (${runner.addParam(p, 1, 'int', 'int', false)}, ${runner.addParam(p, 'dup', 'string', 'string', false)})`, p))
            expect(runner.isSqlError(error)).toBe(true)
            expect(typeof runner.getErrorReason(error).reason).toBe('string')
        })

        test.skipIf(dialect.database !== 'sqlite')('boolean-params-are-sent-as-numbers', async () => {
            const p: any[] = []
            expect(await r().executeSelectOneColumnOneRow(`select ${r().addParam(p, true, '', '', false)} + ${r().addParam(p, false, '', '', false)}`, p)).toBe(1)
        })

        // ---- procedures and functions ------------------------------------

        test.skipIf(!dialect.procedureCall)('execute-procedure', async () => {
            expect(await r().executeProcedure(dialect.procedureCall!)).toBeUndefined()
        })

        test.skipIf(!dialect.functionCall)('execute-function', async () => {
            expect(Number(await r().executeFunction(dialect.functionCall!))).toBe(42)
        })

        test('execute-function-shape-errors', async () => {
            const alias = (name: string) => dialect.database === 'oracle' ? `"${name}"` : name
            expect(reasonOf(await rejectionOf(r().executeFunction(`select 1 as ${alias('a')}, 2 as ${alias('b')}` + dialect.fromNoTable)))).toBe('ONLY_ONE_COLUMN_EXPECTED')
            expect(reasonOf(await rejectionOf(r().executeFunction(`select ${col('id')} from rt_probe`)))).toBe('MORE_THAN_ONE_ROW')
            expect(await r().executeFunction(`select ${col('id')} from rt_probe where id < 0`)).toBeUndefined()
        })

        // ---- transactions ------------------------------------------------

        test('begin-and-commit-keeps-the-change', async () => {
            const runner = r()
            await runner.executeBeginTransaction()
            expect(runner.isTransactionActive()).toBe(true)
            await runner.executeDelete('delete from rt_probe')
            await runner.executeCommit()
            expect(runner.isTransactionActive()).toBe(false)
            expect(await count()).toBe(0)
        })

        test('begin-and-rollback-discards-the-change', async () => {
            const runner = r()
            await runner.executeBeginTransaction()
            await runner.executeDelete('delete from rt_probe')
            await runner.executeRollback()
            expect(runner.isTransactionActive()).toBe(false)
            expect(await count()).toBe(3)
        })

        test('commit-without-transaction', async () => {
            if (opts.endWithoutTransaction) {
                expect(await r().executeCommit()).toBeUndefined()
            } else {
                // With the promise of the runner: a synchronous runner only works with its own
                const rejected = r().createRejectedPromise(new Error('expected'))
                await rejectionOf(rejected)
                const promise = r().executeCommit()
                expect(promise.constructor).toBe(rejected.constructor)
                expect(reasonOf(await rejectionOf(promise))).toBe('NOT_IN_TRANSACTION')
            }
        })

        test('rollback-without-transaction', async () => {
            if (opts.endWithoutTransaction) {
                expect(await r().executeRollback()).toBeUndefined()
            } else {
                // With the promise of the runner: a synchronous runner only works with its own
                const rejected = r().createRejectedPromise(new Error('expected'))
                await rejectionOf(rejected)
                const promise = r().executeRollback()
                expect(promise.constructor).toBe(rejected.constructor)
                expect(reasonOf(await rejectionOf(promise))).toBe('NOT_IN_TRANSACTION')
            }
        })

        test('nested-begin', async () => {
            const runner = r()
            await runner.executeBeginTransaction()
            if (opts.nestedTransactions) {
                await runner.executeBeginTransaction()
                await runner.executeCommit()
                expect(runner.isTransactionActive()).toBe(true)
            } else {
                expect(reasonOf(await rejectionOf(runner.executeBeginTransaction()))).toBe('NESTED_TRANSACTION_NOT_SUPPORTED')
            }
            await runner.executeRollback()
            expect(runner.isTransactionActive()).toBe(false)
        })

        test('execute-in-transaction-commits', async () => {
            const runner = r()
            const result = await runner.executeInTransaction(async () => {
                expect(runner.isTransactionActive()).toBe(true)
                await runner.executeDelete('delete from rt_probe')
                return 'done'
            }, runner)
            expect(result).toBe('done')
            expect(await count()).toBe(0)
        })

        test('execute-in-transaction-rolls-back-on-error', async () => {
            const runner = r()
            const failure = new Error('application failure')
            const error = await rejectionOf(runner.executeInTransaction(async () => {
                await runner.executeDelete('delete from rt_probe')
                throw failure
            }, runner))
            expect(error).toBe(failure)
            expect(runner.isTransactionActive()).toBe(false)
            expect(await count()).toBe(3)
        })

        test('execute-in-transaction-keeps-the-body-error-when-the-rollback-fails', async () => {
            // executeInTransaction ends the transaction through the outermost
            // query runner the connection uses; here one whose rollback rolls
            // back and then fails.
            const runner = r()
            const rollbackFailure = new Error('rollback failure')
            class FailingRollback extends ChainedQueryRunner<QueryRunner> {
                override executeRollback(): Promise<void> {
                    return this.queryRunner.executeRollback().then(() => { throw rollbackFailure })
                }
            }
            const outermost = new FailingRollback(runner)
            const executionFailure = new TsSqlQueryExecutionError(new QueryExecutionSource('source'), { reason: 'UNKNOWN' }, 'body failure')
            const error = await rejectionOf(runner.executeInTransaction(async () => { throw executionFailure }, outermost))
            expect(error).toBe(executionFailure)
            const rollbackError = (error as TsSqlQueryExecutionError).rollbackError
            if (rollbackError !== undefined) {
                expect(rollbackError).toBe(rollbackFailure)
            }
            const plainFailure = new Error('plain body failure')
            expect(await rejectionOf(runner.executeInTransaction(async () => { throw plainFailure }, outermost))).toBe(plainFailure)
            expect(runner.isTransactionActive()).toBe(false)
            expect(await count()).toBe(3)
        })

        for (const level of ALL_LEVELS) {
            const offered = dialect.isolationLevels.includes(level)
            const enabled = !dialect.levelsNotEnabled?.includes(level)
            test(`begin-with-isolation-level-${level.replace(/ /g, '-')}`, async () => {
                const runner = r()
                if (offered && !enabled) {
                    await runner.executeBeginTransaction([level])
                    expect(runner.isSqlError(await rejectionOf(count()))).toBe(true)
                    // The server may have aborted the transaction already, refusing the rollback
                    await runner.executeRollback().catch(() => undefined)
                    expect(runner.isTransactionActive()).toBe(false)
                    // The connection doesn't keep the level the transaction couldn't use
                    expect(await count()).toBe(3)
                } else if (offered) {
                    await runner.executeBeginTransaction([level])
                    expect(await count()).toBe(3)
                    await runner.executeCommit()
                } else {
                    const error = await rejectionOf(runner.executeBeginTransaction([level]))
                    expect(reasonOf(error)).toBe('TRANSACTION_LEVEL_NOT_SUPPORTED')
                    expect(runner.isTransactionActive()).toBe(false)
                }
            })
        }

        test('execute-in-transaction-with-isolation-level', async () => {
            const runner = r()
            const level = dialect.isolationLevels[0]
            if (level) {
                expect(await runner.executeInTransaction(() => count(), runner, [level])).toBe(3)
            } else {
                const error = await rejectionOf(runner.executeInTransaction(() => count(), runner, ['serializable']))
                expect(reasonOf(error)).toBe('TRANSACTION_LEVEL_NOT_SUPPORTED')
            }
        })

        test('begin-with-unknown-isolation-level-fails', async () => {
            const error = await rejectionOf(r().executeBeginTransaction(['dirty' as any]))
            expect(reasonOf(error)).toBe('TRANSACTION_LEVEL_NOT_SUPPORTED')
        })

        test('begin-with-access-mode', async () => {
            const runner = r()
            if (dialect.accessModeAlone) {
                await runner.executeBeginTransaction([undefined, 'read only'])
                // Without a table: Oracle refuses a read-only transaction reading a table created moments before (ORA-01466)
                expect(Number(await runner.executeSelectOneColumnOneRow('select 1' + dialect.fromNoTable))).toBe(1)
                await runner.executeCommit()
            } else {
                const error = await rejectionOf(runner.executeBeginTransaction([undefined, 'read only']))
                expect(reasonOf(error)).toBe('TRANSACTION_ACCESS_MODE_NOT_SUPPORTED')
            }
            expect(runner.isTransactionActive()).toBe(false)
        })

        test.skipIf(!dialect.levelWithAccessMode)('begin-with-isolation-level-and-access-mode', async () => {
            const runner = r()
            await runner.executeBeginTransaction([dialect.isolationLevels[0], 'read only'])
            expect(await count()).toBe(3)
            await runner.executeCommit()
        })

        test('begin-with-unknown-access-mode-fails', async () => {
            const error = await rejectionOf(r().executeBeginTransaction([undefined, 'write only' as any]))
            expect(reasonOf(error)).toBe('TRANSACTION_ACCESS_MODE_NOT_SUPPORTED')
            expect(r().isTransactionActive()).toBe(false)
        })

        // ---- the rest of the interface -----------------------------------

        test('database-and-use-database', () => {
            const runner = r()
            expect(runner.database).toBe(dialect.database)
            runner.useDatabase(dialect.database)
            const other = dialect.database === 'postgreSql' ? 'mySql' : 'postgreSql'
            let error: unknown
            try {
                runner.useDatabase(other)
            } catch (e) {
                error = e
            }
            expect(reasonOf(error)).toBe('UNSUPPORTED_DATABASE')
        })

        test('native-runner-and-transaction', async () => {
            const runner = r()
            expect(runner.getNativeRunner()).toBeDefined()
            runner.getCurrentNativeConnection()
            await runner.executeInTransaction(async () => {
                runner.getCurrentNativeConnection()
            }, runner)
        })

        test('execute-hands-over-the-native-connection', async () => {
            const result = await r().execute(async (connection) => {
                expect(connection).toBeDefined()
                return 'ran'
            })
            expect(result).toBe('ran')
        })

        test('execute-hands-over-the-connection-of-the-transaction', async () => {
            const runner = r()
            const insert = `insert into rt_probe (id, name) values (50, 'native')`
            await runner.executeBeginTransaction()
            try {
                await runner.execute(connection => opts.nativeExecute(connection, insert))
                expect(await count()).toBe(4)
            } finally {
                await runner.executeRollback()
            }
            expect(await count()).toBe(3)
        })

        test('execute-hands-over-the-connection-of-the-transaction-begun-with-a-function', async () => {
            const runner = r()
            const insert = `insert into rt_probe (id, name) values (50, 'native')`
            const undo = new Error('undo')
            const error = await rejectionOf(runner.executeInTransaction(async () => {
                await runner.execute(connection => opts.nativeExecute(connection, insert))
                expect(await count()).toBe(4)
                throw undo
            }, runner))
            expect(error).toBe(undo)
            expect(await count()).toBe(3)
        })

        test('execute-outside-a-transaction', async () => {
            const runner = r()
            let current: unknown = 'not read'
            await runner.execute(async connection => {
                current = runner.getCurrentNativeConnection()
                await opts.nativeExecute(connection, 'select count(*) from rt_probe')
            })
            expect(current).toBeUndefined()
            expect(runner.getCurrentNativeConnection()).toBeUndefined()
        })

        test('current-native-connection-is-the-one-of-the-transaction', async () => {
            const runner = r()
            const insert = `insert into rt_probe (id, name) values (50, 'native')`
            await runner.executeBeginTransaction()
            try {
                let given: unknown
                await runner.execute(async connection => { given = connection })
                const current = runner.getCurrentNativeConnection()
                expect(current).toBeDefined()
                expect(current).toBe(given)
                await opts.nativeExecute(current, insert)
                expect(await count()).toBe(4)
            } finally {
                await runner.executeRollback()
            }
            expect(await count()).toBe(3)
            expect(runner.getCurrentNativeConnection()).toBeUndefined()
        })

        test('current-native-connection-of-a-transaction-begun-with-a-function', async () => {
            const runner = r()
            const insert = `insert into rt_probe (id, name) values (50, 'native')`
            const undo = new Error('undo')
            const error = await rejectionOf(runner.executeInTransaction(async () => {
                // A pool query runner takes the connection with the first statement of the transaction
                expect(await count()).toBe(3)
                await opts.nativeExecute(runner.getCurrentNativeConnection(), insert)
                expect(await count()).toBe(4)
                throw undo
            }, runner))
            expect(error).toBe(undo)
            expect(await count()).toBe(3)
        })

        test.skipIf(dialect.database !== 'postgreSql')('commit-rolled-back-carries-the-failed-statement', async () => {
            const runner = r()
            await runner.executeBeginTransaction()
            const failure = await rejectionOf(runner.executeInsert(`insert into rt_probe (id, name) values (1, 'dup')`))
            const error = await rejectionOf(runner.executeCommit())
            await runner.executeRollback()
            expect(reasonOf(error)).toBe('TRANSACTION_ERROR')
            expect((error as { cause?: unknown }).cause).toBe(failure)
        })

        const rollsBack = opts.rolledBackTransactionUndetected ? undefined : dialect.statementThatRollsBackTheTransaction
        const rolledBackRows = async () => Number(await r().executeSelectOneColumnOneRow('select count(*) from rt_probe where id >= 60'))

        test.skipIf(!rollsBack)('transaction-rolled-back-by-the-database', async () => {
            const runner = r()
            await runner.executeBeginTransaction()
            await runner.executeInsert(`insert into rt_probe (id, name) values (60, 'before')`)
            const failure = await rejectionOf(runner.executeInsert(rollsBack!))
            const next = await rejectionOf(runner.executeInsert(`insert into rt_probe (id, name) values (61, 'after')`))
            const commit = await rejectionOf(runner.executeCommit())
            expect(runner.isTransactionActive()).toBe(true)
            await runner.executeRollback()
            expect(runner.isTransactionActive()).toBe(false)
            expect([reasonOf(next), (next as { cause?: unknown }).cause === failure]).toEqual(['TRANSACTION_ERROR', true])
            expect([reasonOf(commit), (commit as { cause?: unknown }).cause === failure]).toEqual(['TRANSACTION_ERROR', true])
            expect(await rolledBackRows()).toBe(0)
        })

        test.skipIf(!rollsBack)('transaction-rolled-back-by-the-database-after-a-caught-failure', async () => {
            const runner = r()
            await runner.executeBeginTransaction()
            await runner.executeInsert(`insert into rt_probe (id, name) values (60, 'before')`)
            // A duplicate key only fails its own statement
            await rejectionOf(runner.executeInsert(`insert into rt_probe (id, name) values (1, 'dup')`))
            const failure = await rejectionOf(runner.executeInsert(rollsBack!))
            const commit = await rejectionOf(runner.executeCommit())
            await runner.executeRollback()
            expect([reasonOf(commit), (commit as { cause?: unknown }).cause === failure]).toEqual(['TRANSACTION_ERROR', true])
            expect(await rolledBackRows()).toBe(0)
        })

        test.skipIf(!rollsBack)('transaction-function-rolled-back-by-the-database', async () => {
            const runner = r()
            const error = await rejectionOf(runner.executeInTransaction(async () => {
                await runner.executeInsert(`insert into rt_probe (id, name) values (60, 'before')`)
                await rejectionOf(runner.executeInsert(rollsBack!))
                await rejectionOf(runner.executeInsert(`insert into rt_probe (id, name) values (61, 'after')`))
            }, runner))
            expect(reasonOf(error)).toBe('TRANSACTION_ERROR')
            expect(runner.isTransactionActive()).toBe(false)
            expect(await rolledBackRows()).toBe(0)
        })

        test('execute-combined', async () => {
            const runner = r()
            const result = await runner.executeCombined(() => count(), () => runner.executeSelectOneColumnManyRows(`select ${col('id')} from rt_probe order by id`))
            expect([result[0], result[1].map(Number)]).toEqual([3, [1, 2, 3]])
        })

        test('connection-configuration', async () => {
            const runner = r()
            if (opts.pool) {
                // Outside a transaction a pool runner has no dedicated connection to configure
                expect(reasonOf(await rejectionOf(runner.executeConnectionConfiguration(dialect.connectionConfiguration)))).toBe('NOT_IN_TRANSACTION')
                await runner.executeBeginTransaction()
                expect(await runner.executeConnectionConfiguration(dialect.connectionConfiguration)).toBeUndefined()
                await runner.executeCommit()
            } else {
                expect(await runner.executeConnectionConfiguration(dialect.connectionConfiguration)).toBeUndefined()
            }
        })

        test('schema-modification-script-of-several-statements-runs-whole', async () => {
            // Every statement of the script runs, or the call fails: never only the first one
            const runner = r()
            const { script, cleanup } = dialect.schemaScript
            const removeIt = async () => {
                for (const sql of cleanup) {
                    await runner.executeDatabaseSchemaModification(sql).catch(() => undefined)
                }
            }
            await removeIt()
            try {
                const failure = await runner.executeDatabaseSchemaModification(script).then(() => undefined, (e: unknown) => e)
                const lastTableExists = await runner.executeSelectOneColumnOneRow('select count(*) from rt_script_b').then(() => true, () => false)
                if (opts.schemaScriptRejected) {
                    expect(failure).toBeInstanceOf(Error)
                    expect(lastTableExists).toBe(false)
                } else {
                    expect(failure).toBeUndefined()
                    expect(lastTableExists).toBe(true)
                }
            } finally {
                await removeIt()
            }
        })

        test('promises-and-capabilities', async () => {
            const runner = r()
            expect(await runner.createResolvedPromise(7)).toBe(7)
            const failure = new Error('rejected')
            expect(await rejectionOf(runner.createRejectedPromise(failure))).toBe(failure)
            expect(runner.isMocked()).toBe(false)
            expect(typeof runner.lowLevelTransactionManagementSupported()).toBe('boolean')
            expect(typeof runner.executeInTransactionCallsBeginAndCommit()).toBe('boolean')
            expect(runner.nestedTransactionsSupported()).toBe(!!opts.nestedTransactions)
        })

        test('out-params', () => {
            const runner = r()
            const params: any[] = []
            if (dialect.database === 'oracle') {
                expect(runner.addOutParam(params, 'id', 'int', 'int', false)).toBe(':0')
                expect(params).toHaveLength(1)
            } else {
                let error: unknown
                try {
                    runner.addOutParam(params, 'id', 'int', 'int', false)
                } catch (e) {
                    error = e
                }
                expect(reasonOf(error)).toBe('OUT_PARAMS_NOT_SUPPORTED')
            }
        })

        // ---- concurrent use ----------------------------------------------

        test.skipIf(!!opts.nestedTransactions)('two-transactions-begun-at-once', async () => {
            // A query runner is one connection: a second transaction begun while
            // the first is being begun is refused — by the runner, or by the
            // database when the first BEGIN already reached it.
            const runner = r()
            const results = await Promise.allSettled([runner.executeBeginTransaction(), runner.executeBeginTransaction()])
            const errors = results.filter(result => result.status === 'rejected').map(result => (result as PromiseRejectedResult).reason)
            expect(errors.length).toBeGreaterThan(0)
            for (const error of errors) {
                expect(['NESTED_TRANSACTION_NOT_SUPPORTED', 'FORBIDDEN_CONCURRENT_USAGE'].includes(reasonOf(error)!) || runner.isSqlError(error)).toBe(true)
            }
            while (runner.isTransactionActive()) {
                await runner.executeRollback().catch(() => undefined)
            }
            expect(await count()).toBe(3)
        })

        test.skipIf(!opts.pool)('two-queries-at-once-outside-a-transaction', async () => {
            // A pool runner takes a connection per query outside a transaction;
            // two at once on the same runner is a concurrent use it refuses when
            // they overlap (they may not: the first can finish before the second
            // gets its connection).
            const runner = r()
            const results = await Promise.allSettled([count(), count(), count()])
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    expect(result.value).toBe(3)
                } else {
                    expect(reasonOf(result.reason)).toBe('FORBIDDEN_CONCURRENT_USAGE')
                }
            }
            expect(await count()).toBe(3)
            expect(runner.isTransactionActive()).toBe(false)
        })

        // ---- errors ------------------------------------------------------

        test('sql-error-is-recognised', async () => {
            const runner = r()
            const error = await rejectionOf(runner.executeSelectManyRows(`select missing_column from rt_probe`))
            expect(runner.isSqlError(error)).toBe(true)
            expect(typeof runner.getErrorReason(error).reason).toBe('string')
        })

        test('static-error-classification', async () => {
            const runnerClass = under?.runnerClass ?? opts.runnerClass
            if (!runnerClass) throw new Error(opts.label + ': no runnerClass')
            const sqlError = await rejectionOf(r().executeSelectManyRows(`select missing_column from rt_probe`))
            expect(runnerClass.isSqlError(sqlError)).toBe(true)
            expect(runnerClass.getErrorReason(sqlError, dialect.database)).toEqual(r().getErrorReason(sqlError))
            const library = new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'probe')
            expect(runnerClass.getErrorReason(library, dialect.database)).toEqual({ reason: 'NOT_IN_TRANSACTION' })
            expect(runnerClass.isSqlError(library)).toBe(true)
            expect(runnerClass.isSqlError(new Error('application'))).toBe(false)
        })

        test('library-error-keeps-its-reason', () => {
            const runner = r()
            const error = new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'probe')
            expect(runner.getErrorReason(error)).toEqual({ reason: 'NOT_IN_TRANSACTION' })
            expect(runner.isSqlError(error)).toBe(true)
        })

        // ---- error mapping -----------------------------------------------

        const scenarios = opts.errorScenarios === false ? [] : ERROR_SCENARIOS[dialect.database] ?? []
        const sharedDatabase = opts.sharedDatabase ?? dialect.database !== 'sqlite'
        for (const scenario of scenarios) {
            const skip = (!!scenario.serverOnly && !sharedDatabase) || (!!scenario.onlyRunners && !scenario.onlyRunners.includes(opts.label))
            test.skipIf(skip)('error.' + scenario.name, async () => {
                const runner = r()
                const others: RunnerUnderTest[] = []
                for (const sql of scenario.setup ?? []) {
                    await runner.executeDatabaseSchemaModification(sql)
                }
                try {
                    const error = await rejectionOf(scenario.run({
                        runner,
                        async otherSession() {
                            const other = await opts.create()
                            others.push(other)
                            return other.runner
                        },
                    }))
                    expect(runner.isSqlError(error)).toBe(true)
                    expect(runner.getErrorReason(error)).toMatchObject(scenario.expected)
                } finally {
                    for (const other of others) {
                        await other.close().catch(() => undefined)
                    }
                    while (runner.isTransactionActive()) {
                        await runner.executeRollback().catch(() => undefined)
                    }
                    for (const sql of scenario.cleanup ?? []) {
                        await runner.executeDatabaseSchemaModification(sql).catch(() => undefined)
                    }
                }
            }, timeout)
        }

        // The codes the engine raises on demand, on a session of their own: a
        // code that means a broken connection may break it, and then it is replaced
        const raised = opts.errorScenarios === false || !sharedDatabase ? [] : raisedErrors(dialect.database)
        let raiseSession: RunnerUnderTest | undefined
        afterAll(async () => {
            await raiseSession?.close().catch(() => undefined)
            raiseSession = undefined
        }, timeout)
        for (const entry of raised) {
            test('raised.' + entry.number, async () => {
                raiseSession ??= await opts.create()
                const session = raiseSession
                const error = await rejectionOf(session.runner.executeUpdate(entry.sql))
                try {
                    await session.runner.executeSelectManyRows('select 1' + dialect.fromNoTable)
                } catch {
                    raiseSession = undefined
                    await Promise.race([session.close().catch(() => undefined), new Promise(resolve => setTimeout(resolve, 2000))])
                }
                expect(session.runner.isSqlError(error)).toBe(true)
                const code = dialect.database === 'mySql' && DRIVER_NAMED_ERROR_NUMBERS.has(entry.number as number) ? {} : { databaseErrorCode: entry.code }
                expect(session.runner.getErrorReason(error)).toMatchObject({ ...entry.expected, ...code, databaseErrorNumber: entry.number })
            }, timeout)
        }

        test.skipIf(opts.errorScenarios === false || !opts.errorFields)('error.driver-error-shape', async () => {
            const error = await rejectionOf(r().executeSelectManyRows('select rt_err_missing from rt_probe'))
            for (const field of opts.errorFields!) {
                expect({ field, present: !!error && typeof error === 'object' && field in error }).toEqual({ field, present: true })
            }
        }, timeout)

        test.skipIf(opts.errorScenarios === false || !opts.clientTimeout)('error.client-timeout', async () => {
            const slow = await opts.create('client timeout')
            try {
                const error = await rejectionOf(slow.runner.executeUpdate(dialect.sleep!))
                expect(slow.runner.isSqlError(error)).toBe(true)
                expect(slow.runner.getErrorReason(error)).toMatchObject({ reason: 'SQL_TIMEOUT', timeoutType: 'statement' })
            } finally {
                await Promise.race([slow.close().catch(() => undefined), new Promise(resolve => setTimeout(resolve, 2000))])
            }
        }, timeout)

        const connectionFailures = opts.errorScenarios === false ? {} : CONNECTION_FAILURES[dialect.database] ?? {}
        for (const [failure, expected] of Object.entries(connectionFailures)) {
            test.skipIf(!sharedDatabase)('error.connection-' + failure.replaceAll(' ', '-'), async () => {
                // The driver may fail while connecting (inside create) or at the first query
                let failing: RunnerUnderTest | undefined
                let error: unknown
                try {
                    failing = await opts.create(failure as RunnerConnectionFailure)
                    await failing.runner.executeSelectManyRows('select 1' + dialect.fromNoTable)
                } catch (e) {
                    error = e
                } finally {
                    // Some drivers never finish ending a connection that failed to open
                    await Promise.race([failing?.close().catch(() => undefined), new Promise(resolve => setTimeout(resolve, 2000))])
                }
                expect(error).toBeDefined()
                const runnerClass = failing?.runnerClass ?? under?.runnerClass ?? opts.runnerClass
                if (!runnerClass) throw new Error(opts.label + ': no runnerClass')
                expect(runnerClass.isSqlError(error)).toBe(true)
                expect(runnerClass.getErrorReason(error, dialect.database)).toMatchObject(expected)
            }, timeout)
        }

        test.skipIf(opts.errorScenarios === false)('error.query-on-a-closed-connection', async () => {
            const closed = await opts.create()
            await closed.close()
            const error = await rejectionOf(closed.runner.executeSelectManyRows('select 1' + dialect.fromNoTable))
            expect(closed.runner.isSqlError(error)).toBe(true)
            expect(closed.runner.getErrorReason(error)).toMatchObject({ reason: 'SQL_CONNECTION_ERROR' })
        }, timeout)
    })
}
