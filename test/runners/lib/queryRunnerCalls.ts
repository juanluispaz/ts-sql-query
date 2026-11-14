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
    { type: 'selectOneRow', shape: 'row', call: (r, q, p) => r.executeQuery('selectOneRow', q, p) },
    { type: 'selectManyRows', shape: 'rows', call: (r, q, p) => r.executeQuery('selectManyRows', q, p) },
    { type: 'selectOneColumnOneRow', shape: 'value', call: (r, q, p) => r.executeQuery('selectOneColumnOneRow', q, p) },
    { type: 'selectOneColumnManyRows', shape: 'values', call: (r, q, p) => r.executeQuery('selectOneColumnManyRows', q, p) },
    { type: 'insert', shape: 'count', call: (r, q, p) => r.executeQuery('insert', q, p) },
    { type: 'insertReturningLastInsertedId', shape: 'value', call: (r, q, p) => r.executeQuery('insertReturningLastInsertedId', q, p) },
    { type: 'insertReturningMultipleLastInsertedId', shape: 'values', call: (r, q, p) => r.executeQuery('insertReturningMultipleLastInsertedId', q, p) },
    { type: 'insertReturningOneRow', shape: 'row', call: (r, q, p) => r.executeQuery('insertReturningOneRow', q, p) },
    { type: 'insertReturningManyRows', shape: 'rows', call: (r, q, p) => r.executeQuery('insertReturningManyRows', q, p) },
    { type: 'insertReturningOneColumnOneRow', shape: 'value', call: (r, q, p) => r.executeQuery('insertReturningOneColumnOneRow', q, p) },
    { type: 'insertReturningOneColumnManyRows', shape: 'values', call: (r, q, p) => r.executeQuery('insertReturningOneColumnManyRows', q, p) },
    { type: 'update', shape: 'count', call: (r, q, p) => r.executeQuery('update', q, p) },
    { type: 'updateReturningOneRow', shape: 'row', call: (r, q, p) => r.executeQuery('updateReturningOneRow', q, p) },
    { type: 'updateReturningManyRows', shape: 'rows', call: (r, q, p) => r.executeQuery('updateReturningManyRows', q, p) },
    { type: 'updateReturningOneColumnOneRow', shape: 'value', call: (r, q, p) => r.executeQuery('updateReturningOneColumnOneRow', q, p) },
    { type: 'updateReturningOneColumnManyRows', shape: 'values', call: (r, q, p) => r.executeQuery('updateReturningOneColumnManyRows', q, p) },
    { type: 'delete', shape: 'count', call: (r, q, p) => r.executeQuery('delete', q, p) },
    { type: 'deleteReturningOneRow', shape: 'row', call: (r, q, p) => r.executeQuery('deleteReturningOneRow', q, p) },
    { type: 'deleteReturningManyRows', shape: 'rows', call: (r, q, p) => r.executeQuery('deleteReturningManyRows', q, p) },
    { type: 'deleteReturningOneColumnOneRow', shape: 'value', call: (r, q, p) => r.executeQuery('deleteReturningOneColumnOneRow', q, p) },
    { type: 'deleteReturningOneColumnManyRows', shape: 'values', call: (r, q, p) => r.executeQuery('deleteReturningOneColumnManyRows', q, p) },
    { type: 'executeProcedure', shape: 'none', call: (r, q, p) => r.executeQuery('executeProcedure', q, p) },
    { type: 'executeFunction', shape: 'value', call: (r, q, p) => r.executeQuery('executeFunction', q, p) },
    { type: 'executeDatabaseSchemaModification', shape: 'none', call: (r, q, p) => r.executeQuery('executeDatabaseSchemaModification', q, p) },
    { type: 'executeConnectionConfiguration', shape: 'none', call: (r, q, p) => r.executeQuery('executeConnectionConfiguration', q, p) },
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
