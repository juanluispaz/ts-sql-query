// A boolean kept as NUMBER(1) (booleanStorage 'number', the default), declared with the SQL data type of its column as
// the catalogue gives it: the same SQL, params and rows as without it.

import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import { OracleConnection } from '../../../src/connections/OracleConnection.js'
import { OracleDBQueryRunner } from '../../../src/queryRunners/OracleDBQueryRunner.js'
import { NoExecutionQueryRunner } from '../../../src/queryRunners/NoExecutionQueryRunner.js'
import { BooleanType, IntType, Table, withSqlDataType } from '../../../src/exports/v2/index.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/oracle/runners.js'
import { shown, type FlowResult } from '../lib/emulatedSqlDataType.js'

class DBConnection extends OracleConnection<'DBConnection'> { }
const types = new DBConnection(new NoExecutionQueryRunner())

class TFlag extends Table<DBConnection, 'TFlag'> {
    id = this.primaryKey('id', IntType)
    b = this.column('b', BooleanType)
    constructor() { super('rt_emulated_boolean') }
}
class TFlagDeclared extends Table<DBConnection, 'TFlagDeclared'> {
    id = this.primaryKey('id', IntType)
    b = this.column('b', BooleanType, withSqlDataType(types.sqlDataTypeFrom('NUMBER(1)')))
    constructor() { super('rt_emulated_boolean') }
}

describe.skipIf(!isRealDbEnabled('oracle', 'docker', 'newest', 'oracledb'))('Oracle: a boolean the database emulates, with the SQL data type of its column', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    let connection: import('oracledb').Connection | undefined
    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
        const oracledb = (await import('oracledb')).default
        connection = await oracledb.getConnection({ user: db.user, password: db.password, connectString: db.connectString })
        try { await connection.execute('drop table rt_emulated_boolean purge') } catch { /* it doesn't exist */ }
        await connection.execute('create table rt_emulated_boolean (id number primary key, b number(1))')
    }, 300_000)
    afterAll(async () => {
        try { await connection?.execute('drop table rt_emulated_boolean purge') } catch { /* already dropped */ }
        await connection?.close()
        await db?.release()
    }, 300_000)

    async function flow(table: TFlag | TFlagDeclared): Promise<FlowResult> {
        const conn = new DBConnection(new OracleDBQueryRunner(connection!))
        const insert = conn.insertInto(table).set({ id: 1, b: true })
        const select = conn.selectFrom(table).where(table.b.equals(true)).select({ id: table.id, b: table.b, negated: table.b.negate() })
        const queries = [shown(insert), shown(select)]
        await insert.executeInsert()
        const rows = await select.executeSelectMany()
        await connection!.execute('delete from rt_emulated_boolean')
        return { queries, rows }
    }

    test('a-boolean-kept-as-number-1', async () => {
        const plain = await flow(new TFlag())
        expect(plain.rows).toEqual([{ id: 1, b: true, negated: false }])
        expect(await flow(new TFlagDeclared())).toEqual(plain)
    })
})
