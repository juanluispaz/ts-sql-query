// A uuid kept as char(36) (the 'string' strategy) or as binary(16) (the 'binary' strategy), declared with the SQL data
// type of its column as the catalogue gives it: the same SQL, params and rows as without it.

import mysql2 from 'mysql2'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import { MySqlConnection } from '../../../src/connections/MySqlConnection.js'
import { MySql2QueryRunner } from '../../../src/queryRunners/MySql2QueryRunner.js'
import { NoExecutionQueryRunner } from '../../../src/queryRunners/NoExecutionQueryRunner.js'
import { IntType, Table, UuidType, withSqlDataType } from '../../../src/exports/v2/index.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mysql/runners.js'
import { shown, type FlowResult } from '../lib/emulatedSqlDataType.js'

class StringUuids extends MySqlConnection<'StringUuids'> { protected override uuidStrategy = 'string' as const }
class BinaryUuids extends MySqlConnection<'BinaryUuids'> { protected override uuidStrategy = 'binary' as const }

const stringTypes = new StringUuids(new NoExecutionQueryRunner())
const binaryTypes = new BinaryUuids(new NoExecutionQueryRunner())

class TStringUuid extends Table<StringUuids, 'TStringUuid'> {
    id = this.primaryKey('id', IntType)
    u = this.column('u', UuidType)
    constructor() { super('rt_emulated_uuid_string') }
}
class TStringUuidDeclared extends Table<StringUuids, 'TStringUuidDeclared'> {
    id = this.primaryKey('id', IntType)
    u = this.column('u', UuidType, withSqlDataType(stringTypes.sqlDataTypeFrom('char(36)')))
    constructor() { super('rt_emulated_uuid_string') }
}
class TBinaryUuid extends Table<BinaryUuids, 'TBinaryUuid'> {
    id = this.primaryKey('id', IntType)
    u = this.column('u', UuidType)
    constructor() { super('rt_emulated_uuid_binary') }
}
class TBinaryUuidDeclared extends Table<BinaryUuids, 'TBinaryUuidDeclared'> {
    id = this.primaryKey('id', IntType)
    u = this.column('u', UuidType, withSqlDataType(binaryTypes.sqlDataTypeFrom('binary(16)')))
    constructor() { super('rt_emulated_uuid_binary') }
}

const value = '1d2b5e7a-1c3f-4b6a-8d9e-0f1a2b3c4d5e'

describe.skipIf(!isRealDbEnabled('mysql', 'docker', 'newest', 'mysql2'))('MySQL: a uuid the database emulates, with the SQL data type of its column', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    let connection: mysql2.Connection | undefined
    function raw(sql: string): Promise<unknown> {
        return new Promise((resolve, reject) => connection!.query(sql, (error, result) => error ? reject(error) : resolve(result)))
    }
    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
        connection = mysql2.createConnection({ host: db.host, port: db.port, user: db.user, password: db.password, database: db.database })
        await raw('drop table if exists rt_emulated_uuid_string')
        await raw('drop table if exists rt_emulated_uuid_binary')
        await raw('create table rt_emulated_uuid_string (id int primary key, u char(36))')
        await raw('create table rt_emulated_uuid_binary (id int primary key, u binary(16))')
    }, 300_000)
    afterAll(async () => {
        await raw('drop table if exists rt_emulated_uuid_string')
        await raw('drop table if exists rt_emulated_uuid_binary')
        await new Promise<void>(resolve => connection ? connection.end(() => resolve()) : resolve())
        await db?.release()
    }, 300_000)

    async function stringFlow(table: TStringUuid | TStringUuidDeclared): Promise<FlowResult> {
        const conn = new StringUuids(new MySql2QueryRunner(connection!))
        const insert = conn.insertInto(table).set({ id: 1, u: value })
        const select = conn.selectFrom(table).where(table.u.equals(value)).select({ id: table.id, u: table.u })
        const queries = [shown(insert), shown(select)]
        await insert.executeInsert()
        const rows = await select.executeSelectMany()
        await raw('delete from rt_emulated_uuid_string')
        return { queries, rows }
    }
    async function binaryFlow(table: TBinaryUuid | TBinaryUuidDeclared): Promise<FlowResult> {
        const conn = new BinaryUuids(new MySql2QueryRunner(connection!))
        const insert = conn.insertInto(table).set({ id: 1, u: value })
        const select = conn.selectFrom(table).where(table.u.equals(value)).select({ id: table.id, u: table.u })
        const queries = [shown(insert), shown(select)]
        await insert.executeInsert()
        const rows = await select.executeSelectMany()
        await raw('delete from rt_emulated_uuid_binary')
        return { queries, rows }
    }

    test('a-uuid-kept-as-char-36', async () => {
        const plain = await stringFlow(new TStringUuid())
        expect(plain.rows).toEqual([{ id: 1, u: value }])
        expect(await stringFlow(new TStringUuidDeclared())).toEqual(plain)
    })

    test('a-uuid-kept-as-binary-16', async () => {
        const plain = await binaryFlow(new TBinaryUuid())
        expect(plain.queries[1]![0]).toContain('uuid_to_bin')
        expect(plain.rows).toEqual([{ id: 1, u: value }])
        expect(await binaryFlow(new TBinaryUuidDeclared())).toEqual(plain)
    })
})
