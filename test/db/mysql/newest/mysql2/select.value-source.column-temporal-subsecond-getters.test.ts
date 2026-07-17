// Coverage of the PLAIN-COLUMN arm of the temporal date-part getters — the
// sibling of the const-cast arm in
// select.value-source.const-temporal-getters.test.ts. A JS Date only carries
// millisecond precision, so no `const(..., 'localDateTime')` receiver can express
// a sub-millisecond instant; a microsecond value can only enter through a column.
// tTemporalPrecision.microStamp is seeded with 12:30:59.999600 (999600 µs), and
// the getters' SQL-side truncation must keep getSeconds() at 59 (not round up to
// 60) and getMilliseconds() at 999 (not round up to 1000, nor wrap to 0). The
// microseconds only exist in a real engine, so the values matter under the real
// DB; the mock returns the same expected row.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tTemporalPrecision } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('column-localdatetime-subsecond-getters-truncate', async () => {
        const expected = [{ s: 59, ms: 999 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tTemporalPrecision)
            .where(tTemporalPrecision.id.equals(1))
            .select({
                s:  tTemporalPrecision.microStamp.getSeconds(),
                ms: tTemporalPrecision.microStamp.getMilliseconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select second(micro_stamp) as \`s\`, floor(microsecond(micro_stamp) / 1000) as ms from temporal_precision where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ s: number; ms: number }>>>()
        expect(rows).toEqual(expected)
    })
})
