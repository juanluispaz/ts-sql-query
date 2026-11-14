// NoExecutionQueryRunner: a connection made only to use its methods writes the SQL of its database, and every query and
// every statement of a transaction is rejected with QUERY_NOT_ALLOWED, without reaching a database.

import { describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { Table } from '../../../src/Table.js'
import { NoExecutionQueryRunner } from '../../../src/queryRunners/NoExecutionQueryRunner.js'
import { reasonOf } from '../lib/runnerContract.js'

class DBConnection extends PostgreSqlConnection<'DBConnection'> { }
class TItem extends Table<DBConnection, 'TItem'> {
    id = this.primaryKey('id', 'int')
    name = this.column('name', 'string')
    constructor() {
        super('item')
    }
}
const tItem = new TItem()

async function reasonOfRejection(execute: () => Promise<unknown>): Promise<string | undefined> {
    try {
        await execute()
        return 'executed'
    } catch (error) {
        return reasonOf(error)
    }
}

describe('NoExecutionQueryRunner', () => {
    const conn = new DBConnection(new NoExecutionQueryRunner('postgreSql'))

    test('it-writes-the-sql-of-its-database', () => {
        expect(conn.selectFrom(tItem).where(tItem.id.equals(1)).select({ name: tItem.name }).query()).toBe('select name as name from item where id = $1')
    })

    test('every-query-is-rejected', async () => {
        expect(await reasonOfRejection(() => conn.selectFrom(tItem).select({ name: tItem.name }).executeSelectMany())).toBe('QUERY_NOT_ALLOWED')
        expect(await reasonOfRejection(() => conn.insertInto(tItem).set({ id: 1, name: 'a' }).executeInsert())).toBe('QUERY_NOT_ALLOWED')
        expect(await reasonOfRejection(() => conn.update(tItem).set({ name: 'b' }).where(tItem.id.equals(1)).executeUpdate())).toBe('QUERY_NOT_ALLOWED')
        expect(await reasonOfRejection(() => conn.deleteFrom(tItem).where(tItem.id.equals(1)).executeDelete())).toBe('QUERY_NOT_ALLOWED')
        expect(await reasonOfRejection(() => conn.transaction(() => conn.selectFromNoTable().selectOneColumn(conn.const(1, 'int')).executeSelectOne()))).toBe('QUERY_NOT_ALLOWED')
    })
})
