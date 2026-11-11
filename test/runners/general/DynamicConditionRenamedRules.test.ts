// The rules of a dynamic condition that version 2 renamed (smaller, larger, smallAs, largeAs, lessOrEquals,
// greaterOrEquals and their IfValue) are still applied by withValues, with their name of version 2, so a filter written
// for version 1, like one another system sends, keeps working; the types don't declare them. Each gives the SQL, and
// on PGlite the rows, of its name of version 2.

import { describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { PgLiteQueryRunner } from '../../../src/queryRunners/PgLiteQueryRunner.js'
import { Table } from '../../../src/Table.js'
import { TsSqlError } from '../../../src/TsSqlError.js'
import type { DynamicCondition } from '../../../src/dynamic/condition.js'
import { isRealDbEnabled } from '../../lib/backends.js'

class DB extends PostgreSqlConnection<'DB'> { }

class TItem extends Table<DB, 'TItem'> {
    id = this.primaryKey('id', 'int')
    name = this.column('name', 'string')
    price = this.column('price', 'double')
    constructor() {
        super('item')
    }
}

type Definition = { id: 'int', name: 'string', product: { price: 'double' } }
const definitionOf = (tItem: TItem) => ({ id: tItem.id, name: tItem.name, product: { price: tItem.price } })

// A filter as another system sends it: the JSON of a request, which has no type
function fromRequest(json: string): DynamicCondition<Definition> {
    return JSON.parse(json)
}

function queryOf(conn: DB, tItem: TItem, filter: DynamicCondition<Definition>) {
    return conn.selectFrom(tItem).where(conn.dynamicConditionFor(definitionOf(tItem)).withValues(filter)).select({ id: tItem.id }).orderBy('id')
}

const renamed: Array<[string, string]> = [
    ['smaller', 'lessThan'], ['smallerIfValue', 'lessThanIfValue'],
    ['larger', 'greaterThan'], ['largerIfValue', 'greaterThanIfValue'],
    ['smallAs', 'lessOrEqual'], ['smallAsIfValue', 'lessOrEqualIfValue'],
    ['largeAs', 'greaterOrEqual'], ['largeAsIfValue', 'greaterOrEqualIfValue'],
    ['lessOrEquals', 'lessOrEqual'], ['lessOrEqualsIfValue', 'lessOrEqualIfValue'],
    ['greaterOrEquals', 'greaterOrEqual'], ['greaterOrEqualsIfValue', 'greaterOrEqualIfValue'],
]

describe('The rules of a dynamic condition that version 2 renamed', () => {
    test('the-types-do-not-declare-them', () => {
        // @ts-expect-error a filter written in code uses the names of version 2
        const filter: DynamicCondition<Definition> = { id: { smaller: 5 } }
        expect(filter).toEqual({ id: { smaller: 5 } })
    })

    test('each-renamed-rule-gives-the-sql-of-its-name-of-version-2', () => {
        const tItem = new TItem()
        const conn = new DB(new MockQueryRunner(() => []))
        for (const [v1Rule, v2Rule] of renamed) {
            const v1Query = queryOf(conn, tItem, fromRequest(`{ "id": { "${v1Rule}": 3 } }`))
            const v2Query = queryOf(conn, tItem, fromRequest(`{ "id": { "${v2Rule}": 3 } }`))
            expect({ v1Rule, sql: v1Query.query(), params: v1Query.params() }).toEqual({ v1Rule, sql: v2Query.query(), params: v2Query.params() })
        }
        expect(queryOf(conn, tItem, fromRequest('{ "id": { "smaller": 3 }, "product": { "price": { "largeAs": 2 } } }')).query()).toBe(
            'select id as id from item where id < $1 and price >= $2 order by id')
        // An IfValue without a value adds no condition, as its name of version 2
        expect(queryOf(conn, tItem, fromRequest('{ "id": { "smallerIfValue": null, "largeAs": 1 } }')).query()).toBe(
            'select id as id from item where id >= $1 order by id')
    })

    test('a-renamed-rule-next-to-its-name-of-version-2-applies-both', () => {
        const tItem = new TItem()
        const conn = new DB(new MockQueryRunner(() => []))
        const query = queryOf(conn, tItem, fromRequest('{ "id": { "lessThan": 3, "smaller": 5, "smallAs": 9, "lessOrEquals": 8 } }'))
        expect(query.query()).toBe('select id as id from item where id < $1 and id < $2 and id <= $3 and id <= $4 order by id')
        expect(query.params()).toEqual([3, 5, 9, 8])
    })

    test('a-column-or-a-rule-of-the-extension-named-like-a-renamed-rule-keeps-its-meaning', () => {
        const tItem = new TItem()
        const conn = new DB(new MockQueryRunner(() => []))
        // A rule of the extension applies at its level and inside the filter of each column of that level, before the
        // rules of a column
        const extension = {
            larger: (value: number) => tItem.price.greaterThan(value),
            smallAs: (value: string) => tItem.name.lessOrEqual(value),
        }
        const condition = conn.dynamicConditionFor({ smaller: tItem.id, name: tItem.name }, extension)
            .withValues(JSON.parse('{ "smaller": { "lessThan": 3 }, "larger": 2, "name": { "smallAs": "m", "largeAs": "a" } }'))
        expect(conn.selectFrom(tItem).where(condition).select({ id: tItem.id }).query()).toBe(
            'select id as id from item where id < $1 and price > $2 and name <= $3 and name >= $4')
    })

    test('an-unknown-rule-is-still-rejected-with-the-name-it-was-sent-with', () => {
        const tItem = new TItem()
        const conn = new DB(new MockQueryRunner(() => []))
        let error: unknown
        try {
            queryOf(conn, tItem, fromRequest('{ "id": { "smallerThan": 3 } }'))
        } catch (e) {
            error = e
        }
        expect(error instanceof TsSqlError ? error.errorReason : error).toEqual({ reason: 'DYNAMIC_CONDITION_UNKNOWN_OPERATION', path: 'id', name: 'smallerThan' })
    })

    test.skipIf(!isRealDbEnabled('postgres', 'wasm', 'newest', 'pglite'))('pglite-gives-the-same-rows-as-the-rules-of-version-2', async () => {
        const { PGlite } = await import('@electric-sql/pglite')
        const db = await PGlite.create('memory://', { postgresqlconf: ["timezone = 'UTC'"] })
        try {
            await db.exec("create table item (id int primary key, name text not null, price float8 not null); insert into item values (1, 'a', 1.5), (2, 'b', 2.5), (3, 'c', 3.5), (4, 'd', 4.5), (5, 'e', 5.5)")
            const conn = new DB(new PgLiteQueryRunner(db))
            const tItem = new TItem()
            const v1Rows = await queryOf(conn, tItem, fromRequest('{ "id": { "largeAs": 2, "smaller": 5 }, "or": [{ "name": { "lessOrEquals": "b" } }, { "product": { "price": { "larger": 3.5 } } }] }')).executeSelectMany()
            const v2Rows = await queryOf(conn, tItem, { id: { greaterOrEqual: 2, lessThan: 5 }, or: [{ name: { lessOrEqual: 'b' } }, { product: { price: { greaterThan: 3.5 } } }] }).executeSelectMany()
            expect(v1Rows).toEqual([{ id: 2 }, { id: 4 }])
            expect(v1Rows).toEqual(v2Rows)
        } finally {
            await db.close()
        }
    })
})
