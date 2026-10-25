// Every QueryRunner method that executes something, with the shape of what it
// returns: the wrapper tests (Chained, Interceptor, Logging, ConsoleLog) call
// each one through the wrapper, and the MockQueryRunner test checks its shape
// gate for each.

import type { QueryRunner, QueryType } from '../../../src/queryRunners/QueryRunner.js'

/**
 * - row: a plain object, or nothing
 * - rows: an array of plain objects
 * - value: anything (one column, an id, a function's result)
 * - values: an array
 * - count: a number
 * - none: nothing (procedures, DDL, transaction control)
 */
export type ResultShape = 'row' | 'rows' | 'value' | 'values' | 'count' | 'none'

export interface RunnerCall {
    readonly type: QueryType
    readonly shape: ResultShape
    call(runner: QueryRunner, query: string, params: any[]): Promise<unknown>
}

export const QUERY_CALLS: readonly RunnerCall[] = [
    { type: 'selectOneRow', shape: 'row', call: (r, q, p) => r.executeSelectOneRow(q, p) },
    { type: 'selectManyRows', shape: 'rows', call: (r, q, p) => r.executeSelectManyRows(q, p) },
    { type: 'selectOneColumnOneRow', shape: 'value', call: (r, q, p) => r.executeSelectOneColumnOneRow(q, p) },
    { type: 'selectOneColumnManyRows', shape: 'values', call: (r, q, p) => r.executeSelectOneColumnManyRows(q, p) },
    { type: 'insert', shape: 'count', call: (r, q, p) => r.executeInsert(q, p) },
    { type: 'insertReturningLastInsertedId', shape: 'value', call: (r, q, p) => r.executeInsertReturningLastInsertedId(q, p) },
    { type: 'insertReturningMultipleLastInsertedId', shape: 'values', call: (r, q, p) => r.executeInsertReturningMultipleLastInsertedId(q, p) },
    { type: 'insertReturningOneRow', shape: 'row', call: (r, q, p) => r.executeInsertReturningOneRow(q, p) },
    { type: 'insertReturningManyRows', shape: 'rows', call: (r, q, p) => r.executeInsertReturningManyRows(q, p) },
    { type: 'insertReturningOneColumnOneRow', shape: 'value', call: (r, q, p) => r.executeInsertReturningOneColumnOneRow(q, p) },
    { type: 'insertReturningOneColumnManyRows', shape: 'values', call: (r, q, p) => r.executeInsertReturningOneColumnManyRows(q, p) },
    { type: 'update', shape: 'count', call: (r, q, p) => r.executeUpdate(q, p) },
    { type: 'updateReturningOneRow', shape: 'row', call: (r, q, p) => r.executeUpdateReturningOneRow(q, p) },
    { type: 'updateReturningManyRows', shape: 'rows', call: (r, q, p) => r.executeUpdateReturningManyRows(q, p) },
    { type: 'updateReturningOneColumnOneRow', shape: 'value', call: (r, q, p) => r.executeUpdateReturningOneColumnOneRow(q, p) },
    { type: 'updateReturningOneColumnManyRows', shape: 'values', call: (r, q, p) => r.executeUpdateReturningOneColumnManyRows(q, p) },
    { type: 'delete', shape: 'count', call: (r, q, p) => r.executeDelete(q, p) },
    { type: 'deleteReturningOneRow', shape: 'row', call: (r, q, p) => r.executeDeleteReturningOneRow(q, p) },
    { type: 'deleteReturningManyRows', shape: 'rows', call: (r, q, p) => r.executeDeleteReturningManyRows(q, p) },
    { type: 'deleteReturningOneColumnOneRow', shape: 'value', call: (r, q, p) => r.executeDeleteReturningOneColumnOneRow(q, p) },
    { type: 'deleteReturningOneColumnManyRows', shape: 'values', call: (r, q, p) => r.executeDeleteReturningOneColumnManyRows(q, p) },
    { type: 'executeProcedure', shape: 'none', call: (r, q, p) => r.executeProcedure(q, p) },
    { type: 'executeFunction', shape: 'value', call: (r, q, p) => r.executeFunction(q, p) },
    { type: 'executeDatabaseSchemaModification', shape: 'none', call: (r, q, p) => r.executeDatabaseSchemaModification(q, p) },
    { type: 'executeConnectionConfiguration', shape: 'none', call: (r, q, p) => r.executeConnectionConfiguration(q, p) },
]

/** A value of the given shape, as a mock would return it. */
export function sampleResult(shape: ResultShape): unknown {
    switch (shape) {
        case 'row': return { id: 1 }
        case 'rows': return [{ id: 1 }, { id: 2 }]
        case 'value': return 7
        case 'values': return [1, 2]
        case 'count': return 3
        case 'none': return undefined
    }
}
