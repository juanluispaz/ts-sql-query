// Documentation snippets for the Time zones page (docs/configuration/time-zones.md).
//
// The suite runs under TZ=UTC, the first of the lines the page shows for this query.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProjectRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:time-zones/date-and-get-time-agree', async () => {
        // Release 1 was signed off at the wall clock 2024-01-14 12:30:00.
        ctx.mockNext({ value: new Date('2024-01-14T12:30:00.000Z'), epoch: 1705235400000 })
        const connection = ctx.conn

        // doc-start
        const row = await connection.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                value: tProjectRelease.signedOffAt,             // a Date, built by the application
                epoch: tProjectRelease.signedOffAt.getTime(),   // milliseconds, computed by the database
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select signed_off_at as value, floor(extract(epoch from signed_off_at) * 1000) as epoch from project_release where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { value?: Date; epoch?: number }>>()
        expect(row.epoch).toBe(1705235400000)
        expect(row.value?.getTime()).toBe(1705235400000)
    })
})
