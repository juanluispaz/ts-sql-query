// The objects a dynamic pick, a dynamic condition and its extension receive go up to 5 levels, as a complex
// projection: a rule of the extension of a dynamic condition is accepted at every level, also the fourth, and an
// object deeper than 5 levels isn't accepted.

import { describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { Table } from '../../../src/Table.js'
import { dynamicPick } from '../../../src/dynamic/pick.js'

class DB extends PostgreSqlConnection<'DB'> { }

class TItem extends Table<DB, 'TItem'> {
    id = this.primaryKey('id', 'int')
    name = this.column('name', 'string')
    constructor() {
        super('item')
    }
}

describe('The levels of a projection, a pick and a dynamic condition', () => {
    test('a-rule-of-the-extension-is-accepted-at-the-fourth-level', () => {
        const tItem = new TItem()
        const conn = new DB(new MockQueryRunner(() => []))
        const definition = { a: { b: { c: { id: tItem.id } } } }
        const extension = { a: { b: { c: { above: (value: number) => tItem.id.greaterThan(value) } } } }
        const condition = conn.dynamicConditionFor(definition, extension).withValues({ a: { b: { c: { above: 3, id: { lessThan: 9 } } } } })
        expect(conn.selectFrom(tItem).where(condition).select({ id: tItem.id }).query()).toBe('select id as id from item where id > $1 and id < $2')
    })

    test('an-object-deeper-than-5-levels-is-not-accepted', () => {
        const tItem = new TItem()
        const five = { a: { b: { c: { d: { id: tItem.id } } } } }
        expect(dynamicPick(five, { a: { b: { c: { d: { id: true } } } } })).toEqual(five)
        const six = { a: { b: { c: { d: { e: { id: tItem.id } } } } } }
        // @ts-expect-error a pick goes up to 5 levels, as a complex projection
        expect(dynamicPick(six, {})).toEqual({})
    })
})
