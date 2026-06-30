// A `Values` view with one column per numeric / boolean base kind (bigint / double /
// boolean), pinning the distinct per-kind cast the dialect emits inside the
// `(values (...))` tuple; the row round-trips through the bound params and back.
//
// Temporal kinds (localDate / localTime / localDateTime) are deliberately excluded:
// a Date carried through a VALUES tuple does not round-trip to an identical Date
// across the per-dialect VALUES-cast path.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Values } from '../../../../../src/Values.js'
import { DBConnection, type ReleaseChannel, type WorklogActivity } from '../../domain/connection.js'
import { ctx } from './setup.js'

class VKindSampler extends Values<DBConnection, 'kindSampler'> {
    n    = this.column('int')
    big  = this.column('bigint')
    dbl  = this.column('double')
    flag = this.column('boolean')
}

// Branded text-collapsing kinds as real VALUES-tuple columns: customComparable
// ('Semver'), custom ('ReleaseChannel') and enum ('WorklogActivity'). All
// collapse to text, so they round-trip on every dialect.
class VBrandedSampler extends Values<DBConnection, 'brandedSampler'> {
    ver  = this.column<string>('customComparable', 'Semver')
    chan = this.column<ReleaseChannel>('custom', 'ReleaseChannel')
    act  = this.column<WorklogActivity>('enum', 'WorklogActivity')
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('values-tuple-cast-per-numeric-and-boolean-kind', async () => {
        // One VALUES row carrying one column per numeric/boolean base kind. Each
        // kind emits its own cast in the tuple (e.g. int8 / float8 / bool on
        // postgres); the row round-trips unchanged.
        const row = { n: 7, big: 100n, dbl: 2.5, flag: true }
        const expected = [row]
        ctx.mockNext(expected)
        const v = Values.create(VKindSampler, 'kindSampler', [row])
        const rows = await ctx.conn.selectFrom(v)
            .select({ n: v.n, big: v.big, dbl: v.dbl, flag: v.flag })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with kindSampler("n", big, dbl, flag) as (values (?, ?, ?, ?)) select "n" as "n", big as big, dbl as dbl, flag as flag from kindSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            100n,
            2.5,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ n: number; big: bigint; dbl: number; flag: boolean }>>>()
        expect(rows).toEqual(expected)
    })
    test('values-tuple-cast-per-branded-text-kind', async () => {
        // One VALUES row per branded text-collapsing kind: customComparable
        // ('Semver'), custom ('ReleaseChannel') and enum ('WorklogActivity').
        // Each collapses to text inside the tuple and round-trips unchanged.
        const row = { ver: '1.2.0', chan: 'stable' as ReleaseChannel, act: 'coding' as WorklogActivity }
        const expected = [row]
        ctx.mockNext(expected)
        const v = Values.create(VBrandedSampler, 'brandedSampler', [row])
        const rows = await ctx.conn.selectFrom(v)
            .select({ ver: v.ver, chan: v.chan, act: v.act })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with brandedSampler(ver, chan, act) as (values (?, ?, ?)) select ver as ver, chan as chan, act as act from brandedSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.2.0",
            "stable",
            "coding",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ ver: string; chan: ReleaseChannel; act: WorklogActivity }>>>()
        expect(rows).toEqual(expected)
    })

})
