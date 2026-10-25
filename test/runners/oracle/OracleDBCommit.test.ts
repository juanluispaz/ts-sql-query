// Oracle runs every statement inside a transaction and oracledb doesn't commit
// it unless asked: outside a transaction begun through ts-sql-query each
// statement must be committed, as on every other database. Checked from a
// second session, which only sees committed rows.

import oracledb from 'oracledb'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { OracleDBQueryRunner } from '../../../src/queryRunners/OracleDBQueryRunner.js'
import { OracleDBPoolQueryRunner } from '../../../src/queryRunners/OracleDBPoolQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/oracle/runners.js'
import { rejectionOf } from '../lib/runnerContract.js'

describe.skipIf(!isRealDbEnabled('oracle', 'docker', 'newest', 'oracledb'))('Oracle runners: commit', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    let connection: oracledb.Connection | undefined
    let other: oracledb.Connection | undefined
    let pool: oracledb.Pool | undefined
    let single: QueryRunner | undefined
    let pooled: QueryRunner | undefined
    const visibleElsewhere = async (id: number) => Number((await other!.execute<[number]>('select count(*) from rt_commit where id = :0', [id])).rows![0]![0])

    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
        const config = { user: db.user, password: db.password, connectString: db.connectString }
        connection = await oracledb.getConnection(config)
        other = await oracledb.getConnection(config)
        pool = await oracledb.createPool({ ...config, poolMin: 0, poolMax: 2 })
        single = new OracleDBQueryRunner(connection)
        pooled = new OracleDBPoolQueryRunner(pool)
        await single.executeDatabaseSchemaModification("begin execute immediate 'drop table rt_commit'; exception when others then if sqlcode != -942 then raise; end if; end;")
        await single.executeDatabaseSchemaModification('create table rt_commit (id number(10) primary key)')
    }, 300_000)
    afterAll(async () => {
        await connection?.close()
        await other?.close()
        await pool?.close(0)
        await db?.release()
    }, 300_000)

    for (const which of ['single', 'pooled'] as const) {
        const runnerOf = () => which === 'single' ? single! : pooled!
        const base = which === 'single' ? 100 : 200

        test(`${which}-runner-commits-a-statement-outside-a-transaction`, async () => {
            await runnerOf().executeInsert(`insert into rt_commit (id) values (${base + 1})`)
            expect(await visibleElsewhere(base + 1)).toBe(1)
        })

        test(`${which}-runner-commits-a-transaction-only-at-commit`, async () => {
            const r = runnerOf()
            await r.executeBeginTransaction()
            await r.executeInsert(`insert into rt_commit (id) values (${base + 2})`)
            expect(await visibleElsewhere(base + 2)).toBe(0)
            await r.executeCommit()
            expect(await visibleElsewhere(base + 2)).toBe(1)
        })

        test(`${which}-runner-rolls-a-transaction-back`, async () => {
            const r = runnerOf()
            await r.executeBeginTransaction(['read committed'])
            await r.executeInsert(`insert into rt_commit (id) values (${base + 3})`)
            await r.executeRollback()
            expect(await visibleElsewhere(base + 3)).toBe(0)
        })
    }

    test('pooled-runner-begin-the-engine-refuses-leaves-no-transaction-behind', async () => {
        // Oracle takes an isolation level OR an access mode; the pool runner begins
        // the transaction on the first query, where the engine refuses both together.
        const r = pooled!
        await r.executeBeginTransaction(['snapshot', 'read only'])
        expect(r.isSqlError(await rejectionOf(r.executeSelectOneColumnOneRow('select 1 from dual')))).toBe(true)
        await r.executeRollback()
        expect(r.isTransactionActive()).toBe(false)
        expect(Number(await r.executeSelectOneColumnOneRow('select 1 from dual'))).toBe(1)
    })
})
