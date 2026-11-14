// What tedious, the driver of mssql, delivers for the types the runner doesn't ask in another form: a BIGINT as text,
// a DECIMAL as a number (the connection converts a decimal column of the result to text), a BIT as a boolean, and a
// datetimeoffset as its instant.

import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import { MssqlPoolQueryRunner } from '../../../src/queryRunners/MssqlPoolQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/sqlserver/runners.js'

describe.skipIf(!isRealDbEnabled('sqlserver', 'docker', 'newest', 'mssql'))('MssqlPoolQueryRunner: the values tedious delivers', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    let pool: import('mssql').ConnectionPool | undefined
    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
        pool = await new db.mssql.ConnectionPool({ ...db.config, pool: { max: 2, min: 0 } }).connect()
    }, 300_000)
    afterAll(async () => {
        await pool?.close()
        await db?.release()
    }, 300_000)

    test('a-bigint-a-decimal-a-bit-and-a-datetimeoffset', async () => {
        const row = await new MssqlPoolQueryRunner(pool!).executeSelectOneRow(`select cast(9007199254740993 as bigint) as i8, cast(7 as int) as i4,
            cast(1.5 as decimal(10, 2)) as dec, cast(1 as bit) as b, cast('2024-01-14T18:15:30.123+09:00' as datetimeoffset(3)) as dto`, [])
        expect(row).toEqual({ i8: '9007199254740993', i4: 7, dec: 1.5, b: true, dto: new Date('2024-01-14T09:15:30.123Z') })
    })
})
