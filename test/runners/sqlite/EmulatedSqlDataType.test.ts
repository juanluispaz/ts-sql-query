// A date kept as TEXT (the default strategy of SQLite), declared with the SQL data type of its column as the catalogue
// gives it: the same SQL, params and rows as without it.

import Database from 'better-sqlite3'
import { describe, expect, test } from '../../lib/testRunner.js'
import { SqliteConnection } from '../../../src/connections/SqliteConnection.js'
import { BetterSqlite3QueryRunner } from '../../../src/queryRunners/BetterSqlite3QueryRunner.js'
import { NoExecutionQueryRunner } from '../../../src/queryRunners/NoExecutionQueryRunner.js'
import { IntType, LocalDateType, Table, withSqlDataType } from '../../../src/exports/v2/index.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { shown, type FlowResult } from '../lib/emulatedSqlDataType.js'

class DBConnection extends SqliteConnection<'DBConnection'> { }
const types = new DBConnection(new NoExecutionQueryRunner())

class TEvent extends Table<DBConnection, 'TEvent'> {
    id = this.primaryKey('id', IntType)
    day = this.column('day', LocalDateType)
    constructor() { super('rt_emulated_date') }
}
class TEventDeclared extends Table<DBConnection, 'TEventDeclared'> {
    id = this.primaryKey('id', IntType)
    day = this.column('day', LocalDateType, withSqlDataType(types.sqlDataTypeFrom('TEXT')))
    constructor() { super('rt_emulated_date') }
}

const day = new Date('2024-01-15T00:00:00.000Z')

describe.skipIf(!isRealDbEnabled('sqlite', 'native', 'newest', 'better-sqlite3'))('SQLite: a date the database emulates, with the SQL data type of its column', () => {
    async function flow(db: Database.Database, table: TEvent | TEventDeclared): Promise<FlowResult> {
        const conn = new DBConnection(new BetterSqlite3QueryRunner(db))
        const insert = conn.insertInto(table).set({ id: 1, day })
        const select = conn.selectFrom(table).where(table.day.equals(day)).select({ id: table.id, day: table.day, month: table.day.getMonth() })
        const queries = [shown(insert), shown(select)]
        await insert.executeInsert()
        const rows = await select.executeSelectMany()
        db.exec('delete from rt_emulated_date')
        return { queries, rows }
    }

    test('a-date-kept-as-text', async () => {
        const db = new Database(':memory:')
        db.exec('create table rt_emulated_date (id integer primary key, day text)')
        const plain = await flow(db, new TEvent())
        // A localDate is read at 10:00 UTC of its day
        expect(plain.rows).toEqual([{ id: 1, day: new Date('2024-01-15T10:00:00.000Z'), month: 0 }])
        expect(await flow(db, new TEventDeclared())).toEqual(plain)
        db.close()
    })
})
