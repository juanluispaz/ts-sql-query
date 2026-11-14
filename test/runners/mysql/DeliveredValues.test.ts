// A boolean through the MySQL query runners: sent, the driver writes it so MySQL stores 1 and 0; read, a TINYINT(1)
// arrives as the number 1 or 0, and an expression like `true`, a BIGINT for MySQL, as the text '1' or '0' on mysql2
// (its big integers as text) and as a number on Bun SQL. The library reads all of them as a boolean.

import mysql2 from 'mysql2'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { MySql2QueryRunner } from '../../../src/queryRunners/MySql2QueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mysql/runners.js'

const isBun = typeof globalThis.Bun !== 'undefined'
type Db = Awaited<ReturnType<typeof acquireRunnerTestDatabase>>

function describeBoolean(label: string, enabled: boolean, table: string, expression: Record<string, unknown>, create: (db: Db) => Promise<{ runner: QueryRunner, close(): Promise<unknown> }>): void {
    describe.skipIf(!enabled)(label + ': a boolean', () => {
        let db: Db | undefined
        let created: { runner: QueryRunner, close(): Promise<unknown> } | undefined
        beforeAll(async () => {
            db = await acquireRunnerTestDatabase()
            created = await create(db)
        }, 300_000)
        afterAll(async () => {
            await created?.close()
            await db?.release()
        }, 300_000)

        test('sent-as-1-and-0-and-read-as-numbers', async () => {
            const runner = created!.runner
            await runner.executeQuery('executeDatabaseSchemaModification', `create table ${table} (id int primary key, b tinyint(1))`, [])
            try {
                await runner.executeQuery('insert', `insert into ${table} values (1, ?), (2, ?)`, [true, false])
                expect(await runner.executeQuery('selectManyRows', `select id, b, cast(b as char) as txt from ${table} order by id`, [])).toEqual([{ id: 1, b: 1, txt: '1' }, { id: 2, b: 0, txt: '0' }])
                expect(await runner.executeQuery('selectOneRow', 'select true as t, false as f, ? as p', [true])).toEqual(expression)
            } finally {
                await runner.executeQuery('executeDatabaseSchemaModification', `drop table ${table}`, [])
            }
        })
    })
}

describeBoolean('MySql2QueryRunner', isRealDbEnabled('mysql', 'docker', 'newest', 'mysql2'), 'rt_bool_mysql2', { t: '1', f: '0', p: '1' }, async (db) => {
    const connection = mysql2.createConnection({ host: db.host, port: db.port, user: db.user, password: db.password, database: db.database })
    return { runner: new MySql2QueryRunner(connection), close: () => new Promise<void>(resolve => connection.end(() => resolve())) }
})

describeBoolean('BunSqlMySqlQueryRunner (MySQL)', isBun && isRealDbEnabled('mysql', 'docker', 'newest', 'bun_sql_mysql'), 'rt_bool_bun', { t: 1, f: 0, p: 1 }, async (db) => {
    const { SQL } = await import('bun')
    const { BunSqlMySqlQueryRunner } = await import('../../../src/queryRunners/BunSqlMySqlQueryRunner.js')
    const sql = new SQL({ adapter: 'mysql', hostname: db.host, port: db.port, username: db.user, password: db.password, database: db.database, foundRows: true, allowPublicKeyRetrieval: true, max: 2 })
    return { runner: new BunSqlMySqlQueryRunner(sql), close: () => sql.close() }
})
