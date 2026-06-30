// A `Values` view with one column per numeric / boolean base kind (bigint / double /
// boolean), pinning the distinct per-kind cast the dialect emits inside the
// `(values (...))` tuple; the row round-trips through the bound params and back.
//
// Temporal kinds (localDate / localTime / localDateTime) are pinned by their
// cast only (via a null value): a Date carried through a VALUES tuple does not
// round-trip to an identical Date across the per-dialect VALUES-cast path.

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with kindSampler as (select * from (values (@0, @1, @2, @3)) as kindSampler([n], big, dbl, flag)) select [n] as [n], big as big, dbl as dbl, flag as flag from kindSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            100n,
            2.5,
            true,
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with brandedSampler as (select * from (values (@0, @1, @2)) as brandedSampler(ver, chan, act)) select ver as ver, chan as chan, act as act from brandedSampler"`)
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

    test('values-tuple-cast-per-temporal-kind-via-null-value', async () => {
        // Temporal kinds (localDate / localTime / localDateTime) each emit their
        // own cast inside the VALUES tuple. A Date carried through a VALUES tuple
        // does not round-trip to an identical Date across the per-dialect cast
        // path, so every temporal leaf is supplied as null: the cast the tuple
        // emits is what this pins, and each null leaf reads back absent.
        class VTemporalSampler extends Values<DBConnection, 'temporalSampler'> {
            d  = this.optionalColumn('localDate')
            t  = this.optionalColumn('localTime')
            ts = this.optionalColumn('localDateTime')
        }
        ctx.mockNext([{ d: null, t: null, ts: null }])
        const v = Values.create(VTemporalSampler, 'temporalSampler', [
            { d: null, t: null, ts: null },
        ])
        const rows = await ctx.conn.selectFrom(v)
            .select({ d: v.d, t: v.t, ts: v.ts })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with temporalSampler as (select * from (values (@0, @1, @2)) as temporalSampler([d], [t], ts)) select [d] as [d], [t] as [t], ts as ts from temporalSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
            null,
            null,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ d?: Date | undefined; t?: Date | undefined; ts?: Date | undefined }>>>()
        expect(rows).toEqual([{}])
    })

    test('values-tuple-cast-per-uuid-kind', async () => {
        // A plain uuid and a branded customUuid (SigningKey) as real VALUES-tuple
        // columns: each emits its uuid cast inside the tuple and round-trips
        // through the bound params. uuid values are compared case-insensitively
        // because some engines normalise the case on read.
        class VUuidSampler extends Values<DBConnection, 'uuidSampler'> {
            ref     = this.column('uuid')
            signing = this.column<string>('customUuid', 'SigningKey')
        }
        const ref     = '0a8f9c1e-1111-4222-8333-444455556666'
        const signing = '11111111-2222-4333-8444-555566667777'
        ctx.mockNext([{ ref, signing }])
        const v = Values.create(VUuidSampler, 'uuidSampler', [{ ref, signing }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ ref: v.ref, signing: v.signing })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with uuidSampler as (select * from (values (@0, @1)) as uuidSampler([ref], signing)) select [ref] as [ref], signing as signing from uuidSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
            "11111111-2222-4333-8444-555566667777",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ ref: string; signing: string }>>>()
        expect(rows.map((r) => ({ ref: r.ref.toLowerCase(), signing: r.signing.toLowerCase() })))
            .toEqual([{ ref, signing }])
    })


    test('values-tuple-cast-per-custom-temporal-kind-via-null-value', async () => {
        // B-5 / T3-d (§A): branded custom-temporal kinds as VALUES-tuple columns —
        // customLocalDate ('ReleaseDay'), customLocalTime ('CutoffClock') and
        // customLocalDateTime ('SignOffStamp'). Each routes through the
        // connection's temporal `baseTypeForCustom` arms (-> localDate / localTime
        // / localDateTime), reached here via a VALUES tuple instead of a
        // Table/View. As with the plain-temporal tuple test, a Date does not
        // round-trip identically through the per-dialect VALUES cast, so every
        // leaf is supplied as null: the cast the tuple emits is what this pins,
        // and each null leaf reads back absent.
        class VCustomTemporalSampler extends Values<DBConnection, 'customTemporalSampler'> {
            d  = this.optionalColumn<Date>('customLocalDate', 'ReleaseDay')
            t  = this.optionalColumn<Date>('customLocalTime', 'CutoffClock')
            ts = this.optionalColumn<Date>('customLocalDateTime', 'SignOffStamp')
        }
        ctx.mockNext([{ d: null, t: null, ts: null }])
        const v = Values.create(VCustomTemporalSampler, 'customTemporalSampler', [
            { d: null, t: null, ts: null },
        ])
        const rows = await ctx.conn.selectFrom(v)
            .select({ d: v.d, t: v.t, ts: v.ts })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with customTemporalSampler as (select * from (values (@0, @1, @2)) as customTemporalSampler([d], [t], ts)) select [d] as [d], [t] as [t], ts as ts from customTemporalSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
            null,
            null,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ d?: Date | undefined; t?: Date | undefined; ts?: Date | undefined }>>>()
        expect(rows).toEqual([{}])
    })
})
