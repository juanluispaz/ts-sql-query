// An empty text in a date column of SQLite follows the rule of every type: read and sent as null, unless the
// connection allows the empty string. SQLite keeps the text written by another program as it is.

import Database from 'better-sqlite3'
import { describe, expect, test } from '../../lib/testRunner.js'
import { SqliteConnection } from '../../../src/connections/SqliteConnection.js'
import { Table } from '../../../src/Table.js'
import { BetterSqlite3QueryRunner } from '../../../src/queryRunners/BetterSqlite3QueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { reasonOf } from '../lib/runnerContract.js'

class DBConnection extends SqliteConnection<'DBConnection'> { }

class TMoment extends Table<DBConnection, 'TMoment'> {
    id = this.primaryKey('id', 'int')
    d = this.optionalColumn('d', 'localDate')
    t = this.optionalColumn('t', 'localTime')
    dt = this.optionalColumn('dt', 'localDateTime')
    constructor() {
        super('moment')
    }
}
const tMoment = new TMoment()

describe.skipIf(!isRealDbEnabled('sqlite', 'native', 'newest', 'better-sqlite3'))('SQLite: an empty text in a date column', () => {
    test('an-empty-text-is-read-as-null', async () => {
        const db = new Database(':memory:')
        try {
            db.exec("create table moment (id integer primary key, d text, t text, dt text); insert into moment values (1, '', '', '')")
            const conn = new DBConnection(new BetterSqlite3QueryRunner(db))
            const row = await conn.selectFrom(tMoment).select({ id: tMoment.id, d: tMoment.d, t: tMoment.t, dt: tMoment.dt }).executeSelectOne()
            expect(row).toEqual({ id: 1 })
        } finally {
            db.close()
        }
    })

    test('an-empty-text-is-sent-as-null', async () => {
        const db = new Database(':memory:')
        try {
            db.exec('create table moment (id integer primary key, d text, t text, dt text)')
            const conn = new DBConnection(new BetterSqlite3QueryRunner(db))
            const empty = '' as unknown as Date
            let outcome = 'executed'
            try {
                await conn.insertInto(tMoment).set({ id: 1, d: empty, t: empty, dt: empty }).executeInsert()
            } catch (error) {
                outcome = 'rejected: ' + reasonOf(error)
            }
            expect(outcome).toBe('executed')
            expect(db.prepare('select d, t, dt from moment').all()).toEqual([{ d: null, t: null, dt: null }])
        } finally {
            db.close()
        }
    })
})
