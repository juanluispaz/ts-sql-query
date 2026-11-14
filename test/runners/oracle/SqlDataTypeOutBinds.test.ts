// What the Oracle runner does with the SQL data type of a column (withSqlDataType): the returning of a column that is a
// large object of text is received in an OUT bind of a CLOB, whole, without declaring the type in typesByName, and a
// text of a known length in a buffer of that length; an object of a JSON column is bound as a JSON.

import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import { OracleConnection } from '../../../src/connections/OracleConnection.js'
import { Table } from '../../../src/Table.js'
import { withSqlDataType } from '../../../src/TypeAdapter.js'
import { OracleDBQueryRunner } from '../../../src/queryRunners/OracleDBQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/oracle/runners.js'

class DBConnection extends OracleConnection<'DBConnection'> { }
class TNote extends Table<DBConnection, 'TNote'> {
    id = this.primaryKey('id', 'int')
    body = this.optionalColumn('body', 'string', withSqlDataType({ family: 'character string', largeObject: true }))
    plain = this.optionalColumn('plain', 'string')
    code = this.optionalColumn('code', 'string', withSqlDataType({ family: 'character string', length: 10, lengthUnit: 'characters' }))
    constructor() {
        super('rt_sql_type_note')
    }
}
const tNote = new TNote()
class TDocument extends Table<DBConnection, 'TDocument'> {
    id = this.primaryKey('id', 'int')
    doc = this.optionalColumn<{ a: number }, 'Doc'>('doc', 'custom', 'Doc', withSqlDataType({ family: 'document', format: 'json' }))
    constructor() {
        super('rt_sql_type_document')
    }
}
const tDocument = new TDocument()

// The binds the runner gives oracledb, kept to look at them
class InspectedRunner extends OracleDBQueryRunner {
    lastBinds: Record<string, any> | undefined
    protected override bindParams(params: any[], resolveOutBinds?: boolean, procedure?: boolean): Record<string, any> {
        this.lastBinds = super.bindParams(params, resolveOutBinds, procedure)
        return this.lastBinds
    }
}

describe.skipIf(!isRealDbEnabled('oracle', 'docker', 'newest', 'oracledb'))('Oracle: the OUT bind of a returning, from the SQL data type of its column', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    let connection: import('oracledb').Connection | undefined
    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
        const oracledb = (await import('oracledb')).default
        connection = await oracledb.getConnection({ user: db.user, password: db.password, connectString: db.connectString })
        try { await connection.execute('drop table rt_sql_type_note purge') } catch { /* it doesn't exist */ }
        await connection.execute('create table rt_sql_type_note (id number primary key, body clob, plain clob, code varchar2(10 char))')
    }, 300_000)
    afterAll(async () => {
        try { await connection?.execute('drop table rt_sql_type_note purge') } catch { /* already dropped */ }
        await connection?.close()
        await db?.release()
    }, 300_000)

    test('a-large-object-of-text-is-returned-whole', async () => {
        const runner = new InspectedRunner(connection!)
        const conn = new DBConnection(runner)
        const long = 'x'.repeat(40_000)
        const row = await conn.insertInto(tNote).set({ id: 1, body: long, code: 'abc' }).returning({ body: tNote.body, code: tNote.code }).executeInsertOne()
        expect(row.body?.length).toBe(40_000)
        expect(row.code).toBe('abc')
        const outBinds = Object.values(runner.lastBinds!).filter(bind => bind && typeof bind === 'object' && 'dir' in bind)
        // The CLOB, as a CLOB; the text of 10 characters in a buffer of 10 characters of 4 bytes
        expect(outBinds.map(bind => ({ type: bind.type?.name, maxSize: bind.maxSize }))).toEqual([{ type: 'DB_TYPE_CLOB', maxSize: 32767 }, { type: undefined, maxSize: 40 }])
    })

    test('without-a-sql-data-type-a-long-text-needs-types-by-name', async () => {
        const conn = new DBConnection(new OracleDBQueryRunner(connection!))
        let error: unknown
        try {
            await conn.insertInto(tNote).set({ id: 2, plain: 'y'.repeat(40_000) }).returning({ plain: tNote.plain }).executeInsertOne()
        } catch (e) {
            error = e
        }
        expect(String(error)).toMatch(/ORA-|NJS-|DPI-/)
    })

    test('an-object-of-a-json-column-is-bound-as-a-json', async () => {
        // Without a type, oracledb rejects an object (NJS-044)
        await connection!.execute('create table rt_sql_type_document (id number primary key, doc json)')
        try {
            const conn = new DBConnection(new OracleDBQueryRunner(connection!))
            await conn.insertInto(tDocument).set({ id: 1, doc: { a: 1 } }).executeInsert()
            const stored = (await connection!.execute<[string]>('select json_serialize(doc) from rt_sql_type_document')).rows
            expect(stored).toEqual([['{"a":1}']])
            expect(await conn.selectFrom(tDocument).selectOneColumn(tDocument.doc).executeSelectMany()).toEqual([{ a: 1 }])
        } finally {
            await connection!.execute('drop table rt_sql_type_document purge')
        }
    })
})
