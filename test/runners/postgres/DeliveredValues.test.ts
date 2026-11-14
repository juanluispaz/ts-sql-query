// What pg delivers for the types its runner doesn't parse itself: the parsers of the client, which the library reads
// (the runner parses only a date and a timestamp, DriverConfiguration.test.ts).

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import { PgQueryRunner } from '../../../src/queryRunners/PgQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/postgres/runners.js'

describe.skipIf(!isRealDbEnabled('postgres', 'docker', 'newest', 'pg'))('PgQueryRunner: the values pg delivers', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    let client: pg.Client | undefined
    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
        client = new pg.Client({ connectionString: db.uri })
        await client.connect()
    }, 300_000)
    afterAll(async () => {
        await client?.end()
        await db?.release()
    }, 300_000)

    test('the-types-the-runner-doesnt-parse-come-as-the-client-parses-them', async () => {
        const row = await new PgQueryRunner(client!).executeSelectOneRow(`select 9007199254740993::int8 as int8, 1.50::numeric as num, '10:30:15.123'::time as t,
            '19:30:15.123+09'::timetz as ttz, '2024-01-14 18:15:30.123+09'::timestamptz as tstz, 7::int4 as int4, 1.5::float8 as float8, true as b,
            (select count(*) from (values (1), (2)) as v (x)) as c`, [])
        // int8, numeric, time, timetz and a count as text; timestamptz as its instant; int4 and float8 as numbers
        expect(row).toEqual({ int8: '9007199254740993', num: '1.50', t: '10:30:15.123', ttz: '19:30:15.123+09', tstz: new Date('2024-01-14T09:15:30.123Z'), int4: 7, float8: 1.5, b: true, c: '2' })
    })
})
