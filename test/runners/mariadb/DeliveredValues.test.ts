// A boolean through the MariaDB query runners: sent, the driver writes it so MariaDB stores 1 and 0; read, a
// TINYINT(1) and an expression like `true` arrive as the numbers 1 and 0, which the library reads as a boolean.

import mariadb from 'mariadb'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { MariaDBQueryRunner } from '../../../src/queryRunners/MariaDBQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mariadb/runners.js'

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
            await runner.executeDatabaseSchemaModification(`create table ${table} (id int primary key, b tinyint(1))`, [])
            try {
                await runner.executeInsert(`insert into ${table} values (1, ?), (2, ?)`, [true, false])
                expect(await runner.executeSelectManyRows(`select id, b, cast(b as char) as txt from ${table} order by id`, [])).toEqual([{ id: 1, b: 1, txt: '1' }, { id: 2, b: 0, txt: '0' }])
                expect(await runner.executeSelectOneRow('select true as t, false as f, ? as p', [true])).toEqual(expression)
            } finally {
                await runner.executeDatabaseSchemaModification(`drop table ${table}`, [])
            }
        })
    })
}

describeBoolean('MariaDBQueryRunner', isRealDbEnabled('mariadb', 'docker', 'newest', 'mariadb'), 'rt_bool_mariadb', { t: 1, f: 0, p: 1 }, async (db) => {
    const connection = await mariadb.createConnection({ host: db.host, port: db.port, user: db.user, password: db.password, database: db.database })
    return { runner: new MariaDBQueryRunner(connection), close: () => connection.end() }
})

describeBoolean('BunSqlMySqlQueryRunner (MariaDB)', isBun && isRealDbEnabled('mariadb', 'docker', 'newest', 'bun_sql_mysql'), 'rt_bool_bun', { t: 1, f: 0, p: 1 }, async (db) => {
    const { SQL } = await import('bun')
    const { BunSqlMySqlQueryRunner } = await import('../../../src/queryRunners/BunSqlMySqlQueryRunner.js')
    const sql = new SQL({ adapter: 'mariadb', hostname: db.host, port: db.port, username: db.user, password: db.password, database: db.database, foundRows: true, max: 2 })
    return { runner: new BunSqlMySqlQueryRunner(sql), close: () => sql.close() }
})
