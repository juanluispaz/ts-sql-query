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
import type { TypeAdapter } from '../../../../../src/TypeAdapter.js'
import { DBConnection, type ReleaseChannel, type ReleaseTag, type WorklogActivity } from '../../domain/connection.js'
import { ctx } from './setup.js'

class VKindSampler extends Values<DBConnection, 'kindSampler'> {
    n    = this.column('int')
    big  = this.column('bigint')
    dbl  = this.column('double')
    flag = this.column('boolean')
}

// A value-scaling TypeAdapter (read ÷10, write ×10) for the Values-side
// `column(type, adapter)` (adapter-object) arm below. Declared inline: it
// needs no domain fixture.
const scaledTenthAdapter: TypeAdapter = {
    transformValueFromDB(value, type, next) {
        const v = next.transformValueFromDB(value, type)
        return typeof v === 'number' ? v / 10 : v
    },
    transformValueToDB(value, type, next) {
        return next.transformValueToDB(typeof value === 'number' ? value * 10 : value, type)
    },
}

class VScaledSampler extends Values<DBConnection, 'scaledSampler'> {
    score = this.column('int', scaledTenthAdapter)
}

// A value-shifting TypeAdapter (read +1000, write -1000) for the CUSTOM-kind
// `column(type, typeName, adapter)` arm below. Declared inline: it needs no
// domain fixture, and the domain's own equivalent adapter is not exported.
const plusOffsetAdapter: TypeAdapter = {
    transformValueFromDB(value, type, next) {
        const v = next.transformValueFromDB(value, type)
        return typeof v === 'number' ? v + 1000 : v
    },
    transformValueToDB(value, type, next) {
        return next.transformValueToDB(typeof value === 'number' ? value - 1000 : value, type)
    },
}

// Branded text-collapsing kinds as real VALUES-tuple columns: customComparable
// ('Semver'), custom ('ReleaseChannel') and enum ('WorklogActivity'). All
// collapse to text, so they round-trip on every dialect.
class VBrandedSampler extends Values<DBConnection, 'brandedSampler'> {
    ver  = this.column<string>('customComparable', 'Semver')
    chan = this.column<ReleaseChannel>('custom', 'ReleaseChannel')
    act  = this.column<WorklogActivity>('enum', 'WorklogActivity')
}

// A read-bracketing TypeAdapter (read wraps a string value in [...], write
// passthrough) for the virtualColumnFromFragment trailing-adapter arm below.
// Declared inline; the domain's own equivalent adapter is not exported.
const bracketAdapter: TypeAdapter = {
    transformValueFromDB(value, type, next) {
        const v = next.transformValueFromDB(value, type)
        return typeof v === 'string' ? '[' + v + ']' : v
    },
    transformValueToDB(value, type, next) {
        return next.transformValueToDB(value, type)
    },
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with kindSampler(\`n\`, big, dbl, flag) as (values (?, ?, ?, ?)) select \`n\` as \`n\`, big as big, dbl as dbl, flag as flag from kindSampler"`)
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

    test('values-tuple-column-with-type-adapter-scales-write-and-read', async () => {
        // The `Values.column(type, adapter)` adapter-object arm: `score` carries
        // scaledTenthAdapter (write ×10, read ÷10). Passing score 5 binds the
        // SCALED value 10 in the VALUES tuple, and the read divides it back to 5.
        // Observable in both the bound param (10) and the result value (5).
        const expected = [{ score: 5 }]
        ctx.mockNext([{ score: 50 }])
        const v = Values.create(VScaledSampler, 'scaledSampler', [{ score: 5 }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ score: v.score })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with scaledSampler(score) as (values (?)) select score as score from scaledSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ score: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('values-tuple-custom-kind-column-with-type-adapter-shifts-write-and-read', async () => {
        // The CUSTOM-kind arm of `Values.column(type, typeName, adapter)` — the
        // `adapter2` slot reached only when a custom kind ('customInt'/'ReleaseTag')
        // ALSO carries a TRAILING TypeAdapter. `ordinal` is a branded `ReleaseTag`
        // carrying plusOffsetAdapter (write -1000, read +1000). Passing ordinal 3005
        // binds the SHIFTED value 2005 in the VALUES tuple, and the read shifts it
        // back +1000 to 3005. Observable in both the bound param (2005) and the
        // result value (3005). The 'ReleaseTag' typeName is marshalled to its int
        // base by the connection's baseTypeForCustom, so the tuple casts to int.
        class VReleaseTagSampler extends Values<DBConnection, 'releaseTagSampler'> {
            ordinal = this.column<ReleaseTag, 'ReleaseTag'>('customInt', 'ReleaseTag', plusOffsetAdapter)
        }
        const expected = [{ ordinal: 3005 as ReleaseTag }]
        ctx.mockNext([{ ordinal: 2005 }])
        const v = Values.create(VReleaseTagSampler, 'releaseTagSampler', [{ ordinal: 3005 as ReleaseTag }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ ordinal: v.ordinal })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with releaseTagSampler(ordinal) as (values (?)) select ordinal as ordinal from releaseTagSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2005,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ ordinal: ReleaseTag }>>>()
        expect(rows).toEqual(expected)
    })

    test('values-tuple-optional-custom-kind-column-with-type-adapter-shifts-and-passes-null', async () => {
        // An OPTIONAL VALUES-tuple column of a custom kind (customInt / ReleaseTag)
        // carrying a trailing TypeAdapter (plusOffsetAdapter, write -1000 / read
        // +1000), so the leaf is `ordinal?: ReleaseTag`. Present: 3005 binds the
        // shifted 2005 in the VALUES tuple and reads back +1000 to 3005. Null: the
        // adapter passes null through (the shift branch is skipped), so the optional
        // leaf reads back absent. The 'ReleaseTag' typeName is marshalled to its int
        // base by the connection’s baseTypeForCustom, so the tuple casts to int.
        class VOptionalReleaseTagSampler extends Values<DBConnection, 'optionalReleaseTagSampler'> {
            ordinal = this.optionalColumn<ReleaseTag, 'ReleaseTag'>('customInt', 'ReleaseTag', plusOffsetAdapter)
        }
        ctx.mockNext([{ ordinal: 2005 }])
        const v1 = Values.create(VOptionalReleaseTagSampler, 'optionalReleaseTagSampler', [{ ordinal: 3005 as ReleaseTag }])
        const present = await ctx.conn.selectFrom(v1)
            .select({ ordinal: v1.ordinal })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with optionalReleaseTagSampler(ordinal) as (values (?)) select ordinal as ordinal from optionalReleaseTagSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2005,
          ]
        `)
        assertType<Exact<typeof present, Array<{ ordinal?: ReleaseTag | undefined }>>>()
        expect(present).toEqual([{ ordinal: 3005 }])

        ctx.mockNext([{ ordinal: null }])
        const v2 = Values.create(VOptionalReleaseTagSampler, 'optionalReleaseTagSampler', [{ ordinal: null }])
        const none = await ctx.conn.selectFrom(v2)
            .select({ ordinal: v2.ordinal })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with optionalReleaseTagSampler(ordinal) as (values (?)) select ordinal as ordinal from optionalReleaseTagSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
          ]
        `)
        expect(none).toEqual([{}])
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with temporalSampler(\`d\`, \`t\`, ts) as (values (?, ?, ?)) select \`d\` as \`d\`, \`t\` as \`t\`, ts as ts from temporalSampler"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with uuidSampler(ref, signing) as (values (?, ?)) select ref as ref, signing as signing from uuidSampler"`)
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
        // Branded custom-temporal kinds as VALUES-tuple columns —
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with customTemporalSampler(\`d\`, \`t\`, ts) as (values (?, ?, ?)) select \`d\` as \`d\`, \`t\` as \`t\`, ts as ts from customTemporalSampler"`)
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

    test('values-tuple-virtual-column-from-fragment-per-kind', async () => {
        // `Values.virtualColumnFromFragment` / `optionalVirtualColumnFromFragment`
        // over base kinds: a required `bigint` and a required `double` virtual
        // column plus a `double` optional virtual column. Each is computed from a
        // const fragment in the
        // outer SELECT (not carried in the VALUES tuple), pinning the projected
        // type and value per kind through the shared virtual-column dispatcher.
        class VVirtualSampler extends Values<DBConnection, 'virtualSampler'> {
            n    = this.column('int')
            vbig = this.virtualColumnFromFragment('bigint', (fragment) => fragment.sql`${ctx.conn.const(100n, 'bigint')}`)
            vdbl = this.virtualColumnFromFragment('double', (fragment) => fragment.sql`${ctx.conn.const(2.5, 'double')}`)
            vopt = this.optionalVirtualColumnFromFragment('double', (fragment) => fragment.sql`${ctx.conn.const(9.5, 'double')}`)
        }
        const expected = [{ n: 7, vbig: 100n, vdbl: 2.5, vopt: 9.5 }]
        ctx.mockNext(expected)
        const v = Values.create(VVirtualSampler, 'virtualSampler', [{ n: 7 }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ n: v.n, vbig: v.vbig, vdbl: v.vdbl, vopt: v.vopt })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with virtualSampler(\`n\`) as (values (?)) select \`n\` as \`n\`, ? as vbig, ? as vdbl, ? as vopt from virtualSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            100n,
            2.5,
            9.5,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ n: number; vbig: bigint; vdbl: number; vopt?: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('values-tuple-optional-column-with-type-adapter-scales-and-passes-null', async () => {
        // The `Values.optionalColumn(type, adapter)` adapter-object arm — the
        // optional twin of `column(type, adapter)` above. `score` carries
        // scaledTenthAdapter and is optional, so the leaf is `score?: number`.
        // Present: score 5 binds the scaled value (write ×10) and reads it back
        // (÷10) to 5. Null: the adapter passes null through (the ×10/÷10 branch is
        // skipped), so the optional leaf reads back absent.
        class VScaledOptionalSampler extends Values<DBConnection, 'scaledOptionalSampler'> {
            score = this.optionalColumn('int', scaledTenthAdapter)
        }
        ctx.mockNext([{ score: 50 }])
        const v1 = Values.create(VScaledOptionalSampler, 'scaledOptionalSampler', [{ score: 5 }])
        const present = await ctx.conn.selectFrom(v1)
            .select({ score: v1.score })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with scaledOptionalSampler(score) as (values (?)) select score as score from scaledOptionalSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
          ]
        `)
        assertType<Exact<typeof present, Array<{ score?: number | undefined }>>>()
        expect(present).toEqual([{ score: 5 }])

        ctx.mockNext([{ score: null }])
        const v2 = Values.create(VScaledOptionalSampler, 'scaledOptionalSampler', [{ score: null }])
        const none = await ctx.conn.selectFrom(v2)
            .select({ score: v2.score })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with scaledOptionalSampler(score) as (values (?)) select score as score from scaledOptionalSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
          ]
        `)
        expect(none).toEqual([{}])
    })

    test('values-tuple-virtual-column-from-fragment-with-type-adapter-brackets-read', async () => {
        // A Values `virtualColumnFromFragment` (required) and
        // `optionalVirtualColumnFromFragment` (optional), each carrying a trailing
        // TypeAdapter. Both compute `upper('led')` → 'LED' in the outer SELECT and
        // bracketAdapter wraps the read value → '[LED]'.
        class VBracketSampler extends Values<DBConnection, 'bracketSampler'> {
            n     = this.column('int')
            vtag  = this.virtualColumnFromFragment('string', (fragment) => fragment.sql`upper('led')`, bracketAdapter)
            vtagO = this.optionalVirtualColumnFromFragment('string', (fragment) => fragment.sql`upper('led')`, bracketAdapter)
        }
        const expected = [{ n: 7, vtag: '[LED]', vtagO: '[LED]' }]
        // The mock is primed with the RAW db value ('LED'); bracketAdapter wraps
        // each on read to the asserted '[LED]'.
        ctx.mockNext([{ n: 7, vtag: 'LED', vtagO: 'LED' }])
        const v = Values.create(VBracketSampler, 'bracketSampler', [{ n: 7 }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ n: v.n, vtag: v.vtag, vtagO: v.vtagO })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with bracketSampler(\`n\`) as (values (?)) select \`n\` as \`n\`, upper('led') as vtag, upper('led') as vtagO from bracketSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ n: number; vtag: string; vtagO?: string }>>>()
        expect(rows).toEqual(expected)
    })

})
