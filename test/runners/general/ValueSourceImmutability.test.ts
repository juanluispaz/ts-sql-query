// A value source doesn't change once created: what gives another one (another optionality, an aggregate, the optional
// values of an aggregated array as null) gives a new one and leaves the original as it was, also when the function of
// a fragment returns one of its arguments.

import { describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { Table } from '../../../src/Table.js'

let queries: string[] = []
let rows: any[] = []

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    // The second argument, optional when one of them has no value
    secondOf = this.buildFragmentWithMaybeOptionalArgs(this.arg('int', 'optional'), this.arg('int', 'optional')).as((_first, second) => second)
    // An aggregate function that gives its argument as it is
    aggregateOf = this.buildAggregateFragmentWithArgs(this.arg('int', 'required')).as((value) => value)
}

class TItem extends Table<DBConnection, 'TItem'> {
    id = this.primaryKey('id', 'int')
    amount = this.column('amount', 'int')
    note = this.optionalColumn('note', 'string')
    constructor() { super('item') }
}

const conn = new DBConnection(new MockQueryRunner((type, query) => {
    queries.push(query)
    if (type === 'selectOneColumnOneRow') {
        return 1
    }
    return rows
}))
const tItem = new TItem()

describe('value sources', () => {
    test('a fragment function that returns its argument gives the optionality to its result, not to the argument', async () => {
        // A required column given to an optional argument, with the other argument without value
        const second = conn.secondOf(null, tItem.id)
        rows = [{ second: null, id: null }]
        // The result is optional: its null is read
        expect(await conn.selectFrom(tItem).select({ second }).executeSelectMany()).toEqual([{}])
        // The column stays required: its null is an error
        await expect(conn.selectFrom(tItem).select({ id: tItem.id }).executeSelectMany()).rejects.toThrow('Expected a value as result of the column `id` at index `0`')
    })

    test('a function of aggregate fragments that returns its argument makes its result an aggregate, not the argument', async () => {
        const aggregate = conn.aggregateOf(tItem.amount)
        rows = [{ total: 3, amount: 3 }]
        queries = []
        await conn.selectFrom(tItem).select({ total: aggregate }).executeSelectPage()
        await conn.selectFrom(tItem).select({ amount: tItem.amount }).executeSelectPage()
        expect(queries).toEqual([
            'select amount as total from item',
            'with result_for_count as (select amount as total from item) select count(*) from result_for_count',
            'select amount as amount from item',
            'select count(*) from item',
        ])
    })

    test('projectingOptionalValuesAsNullable gives a new aggregated array and leaves the original as it was', async () => {
        const notes = conn.aggregateAsArray({ id: tItem.id, note: tItem.note })
        const notesAsNullable = notes.projectingOptionalValuesAsNullable()
        rows = [{ notes: [{ id: 1, note: null }], notesAsNullable: [{ id: 1, note: null }] }]
        expect(await conn.selectFrom(tItem).select({ notes, notesAsNullable }).executeSelectMany()).toEqual([
            { notes: [{ id: 1 }], notesAsNullable: [{ id: 1, note: null }] },
        ])
    })

    test('projectingOptionalValuesAsNullable of a disallowed aggregated array stays disallowed', () => {
        const notes = conn.aggregateAsArray({ note: tItem.note }).disallowWhen(true, 'Notes are not allowed').projectingOptionalValuesAsNullable()
        expect(() => conn.selectFrom(tItem).select({ notes }).query()).toThrow('Notes are not allowed')
    })
})
