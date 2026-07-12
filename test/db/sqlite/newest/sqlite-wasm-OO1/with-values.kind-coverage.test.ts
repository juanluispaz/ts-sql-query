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
import { CustomBooleanTypeAdapter, type TypeAdapter } from '../../../../../src/TypeAdapter.js'
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

// A boolean VALUES column carrying a CustomBooleanTypeAdapter ('Y'/'N') — the
// boolean × adapter-object arm of `Values.column('boolean', adapter)`. The write
// path maps true→'Y' (a string), distinct from the plain boolean VALUES column
// whose value binds directly under the dialect's boolean cast.
class VBoolAdapterSampler extends Values<DBConnection, 'boolAdapterSampler'> {
    flag = this.column('boolean', new CustomBooleanTypeAdapter('Y', 'N'))
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

    test('values-tuple-boolean-column-with-custom-boolean-adapter', async () => {
        // The boolean × CustomBooleanTypeAdapter arm of `Values.column(type, adapter)`:
        // the adapter maps true→'Y' / false→'N', so passing flag:true binds the STRING
        // 'Y' in the VALUES tuple (distinct from the plain boolean VALUES column, which
        // binds the boolean directly under the dialect's boolean cast), and the read
        // maps 'Y' back to true. Observable in both the bound param ('Y') and the
        // result value (true).
        const expected = [{ flag: true }]
        ctx.mockNext([{ flag: true }])
        const v = Values.create(VBoolAdapterSampler, 'boolAdapterSampler', [{ flag: true }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ flag: v.flag })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with boolAdapterSampler(flag) as (values (case when ? then 'Y' else 'N' end)) select (flag = 'Y') as flag from boolAdapterSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ flag: boolean }>>>()
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with temporalSampler("d", "t", ts) as (values (?, ?, ?)) select "d" as "d", "t" as "t", ts as ts from temporalSampler"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with customTemporalSampler("d", "t", ts) as (values (?, ?, ?)) select "d" as "d", "t" as "t", ts as ts from customTemporalSampler"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with virtualSampler("n") as (values (?)) select "n" as "n", ? as vbig, ? as vdbl, ? as vopt from virtualSampler"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with bracketSampler("n") as (values (?)) select "n" as "n", upper('led') as vtag, upper('led') as vtagO from bracketSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ n: number; vtag: string; vtagO?: string }>>>()
        expect(rows).toEqual(expected)
    })

    // ---- VALVIEW per-kind dispatch fan-out (round-44 T4)
    // A no-op TypeAdapter: read and write both delegate straight to `next`. It
    // fires each kind's trailing-adapter overload without altering the bound
    // param or the read value. The observable-transform adapter arms are already
    // pinned above (scaledTenth / customBoolean / plusOffset / bracket), so these
    // fan-out cells isolate the per-kind overload + adapter dispatch path alone.
    const passthroughAdapter: TypeAdapter = {
        transformValueFromDB(value, type, next) {
            return next.transformValueFromDB(value, type)
        },
        transformValueToDB(value, type, next) {
            return next.transformValueToDB(value, type)
        },
    }

    test('values-tuple-required-column-per-remaining-kind-no-adapter', async () => {
        // Required `column(kind)` (no adapter) for the base/custom kinds not yet a
        // Values-tuple member: plain `string`, `customInt` ('Cents' -> int) and
        // `customDouble` ('Money' -> double). Each emits its own cast in the tuple
        // and round-trips unchanged.
        class VReqSampler extends Values<DBConnection, 'reqSampler'> {
            str   = this.column('string')
            cents = this.column<number, 'Cents'>('customInt', 'Cents')
            money = this.column<number, 'Money'>('customDouble', 'Money')
        }
        const row = { str: 'abc', cents: 12, money: 3.5 }
        const expected = [row]
        ctx.mockNext(expected)
        const v = Values.create(VReqSampler, 'reqSampler', [row])
        const rows = await ctx.conn.selectFrom(v)
            .select({ str: v.str, cents: v.cents, money: v.money })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with reqSampler(str, cents, money) as (values (?, ?, ?)) select str as str, cents as cents, money as money from reqSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "abc",
            12,
            3.5,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ str: string; cents: number; money: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('values-tuple-required-column-per-kind-with-passthrough-adapter', async () => {
        // The trailing-adapter arm `column(kind, adapter)` per required kind not yet
        // exercised with an adapter — bigint/double/string plus custom kinds
        // customDouble/customComparable/custom/enum. passthroughAdapter is inert, so
        // the tuple casts + bound params match the no-adapter arm; this pins that
        // each kind's adapter overload compiles and its adapter dispatch fires.
        class VReqAdapterSampler extends Values<DBConnection, 'reqAdapterSampler'> {
            big   = this.column('bigint', passthroughAdapter)
            dbl   = this.column('double', passthroughAdapter)
            str   = this.column('string', passthroughAdapter)
            money = this.column<number, 'Money'>('customDouble', 'Money', passthroughAdapter)
            ver   = this.column<string, 'Semver'>('customComparable', 'Semver', passthroughAdapter)
            chan  = this.column<ReleaseChannel, 'ReleaseChannel'>('custom', 'ReleaseChannel', passthroughAdapter)
            act   = this.column<WorklogActivity, 'WorklogActivity'>('enum', 'WorklogActivity', passthroughAdapter)
        }
        const row = { big: 100n, dbl: 2.5, str: 'abc', money: 3.5, ver: '1.2.0', chan: 'stable' as ReleaseChannel, act: 'coding' as WorklogActivity }
        const expected = [row]
        ctx.mockNext(expected)
        const v = Values.create(VReqAdapterSampler, 'reqAdapterSampler', [row])
        const rows = await ctx.conn.selectFrom(v)
            .select({ big: v.big, dbl: v.dbl, str: v.str, money: v.money, ver: v.ver, chan: v.chan, act: v.act })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with reqAdapterSampler(big, dbl, str, money, ver, chan, act) as (values (?, ?, ?, ?, ?, ?, ?)) select big as big, dbl as dbl, str as str, money as money, ver as ver, chan as chan, act as act from reqAdapterSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100n,
            2.5,
            "abc",
            3.5,
            "1.2.0",
            "stable",
            "coding",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ big: bigint; dbl: number; str: string; money: number; ver: string; chan: ReleaseChannel; act: WorklogActivity }>>>()
        expect(rows).toEqual(expected)
    })

    test('values-tuple-required-uuid-and-custom-uuid-column-with-passthrough-adapter', async () => {
        // The trailing-adapter arm of `column('uuid' | 'customUuid', …, adapter)`.
        // passthroughAdapter is inert; uuids are compared case-insensitively because
        // some engines normalise the case on read.
        class VReqAdapterUuidSampler extends Values<DBConnection, 'reqAdapterUuidSampler'> {
            ref     = this.column('uuid', passthroughAdapter)
            signing = this.column<string, 'SigningKey'>('customUuid', 'SigningKey', passthroughAdapter)
        }
        const ref     = '0a8f9c1e-1111-4222-8333-444455556666'
        const signing = '11111111-2222-4333-8444-555566667777'
        ctx.mockNext([{ ref, signing }])
        const v = Values.create(VReqAdapterUuidSampler, 'reqAdapterUuidSampler', [{ ref, signing }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ ref: v.ref, signing: v.signing })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with reqAdapterUuidSampler(ref, signing) as (values (?, ?)) select ref as ref, signing as signing from reqAdapterUuidSampler"`)
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

    test('values-tuple-optional-column-per-kind-no-adapter', async () => {
        // `optionalColumn(kind)` (no adapter) per kind not yet an optional
        // Values-tuple member: boolean/int/bigint/double/string plus custom kinds
        // customInt/customDouble/customComparable/custom/enum. Every leaf is
        // optional, so the projected object is all-optional (`?: T | undefined`);
        // present values round-trip.
        class VOptSampler extends Values<DBConnection, 'optSampler'> {
            flag  = this.optionalColumn('boolean')
            n     = this.optionalColumn('int')
            big   = this.optionalColumn('bigint')
            dbl   = this.optionalColumn('double')
            str   = this.optionalColumn('string')
            cents = this.optionalColumn<number, 'Cents'>('customInt', 'Cents')
            money = this.optionalColumn<number, 'Money'>('customDouble', 'Money')
            ver   = this.optionalColumn<string, 'Semver'>('customComparable', 'Semver')
            chan  = this.optionalColumn<ReleaseChannel, 'ReleaseChannel'>('custom', 'ReleaseChannel')
            act   = this.optionalColumn<WorklogActivity, 'WorklogActivity'>('enum', 'WorklogActivity')
        }
        const row = { flag: true, n: 7, big: 100n, dbl: 2.5, str: 'abc', cents: 12, money: 3.5, ver: '1.2.0', chan: 'stable' as ReleaseChannel, act: 'coding' as WorklogActivity }
        const expected = [row]
        ctx.mockNext(expected)
        const v = Values.create(VOptSampler, 'optSampler', [row])
        const rows = await ctx.conn.selectFrom(v)
            .select({ flag: v.flag, n: v.n, big: v.big, dbl: v.dbl, str: v.str, cents: v.cents, money: v.money, ver: v.ver, chan: v.chan, act: v.act })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with optSampler(flag, "n", big, dbl, str, cents, money, ver, chan, act) as (values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)) select flag as flag, "n" as "n", big as big, dbl as dbl, str as str, cents as cents, money as money, ver as ver, chan as chan, act as act from optSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            7,
            100n,
            2.5,
            "abc",
            12,
            3.5,
            "1.2.0",
            "stable",
            "coding",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ flag?: boolean | undefined; n?: number | undefined; big?: bigint | undefined; dbl?: number | undefined; str?: string | undefined; cents?: number | undefined; money?: number | undefined; ver?: string | undefined; chan?: ReleaseChannel | undefined; act?: WorklogActivity | undefined }>>>()
        expect(rows).toEqual(expected)
    })

    test('values-tuple-optional-uuid-and-custom-uuid-column-no-adapter', async () => {
        // `optionalColumn('uuid')` / `optionalColumn('customUuid', 'SigningKey')`.
        // All-optional object (`?: T | undefined`); present values round-trip,
        // compared case-insensitively.
        class VOptUuidSampler extends Values<DBConnection, 'optUuidSampler'> {
            ref     = this.optionalColumn('uuid')
            signing = this.optionalColumn<string, 'SigningKey'>('customUuid', 'SigningKey')
        }
        const ref     = '0a8f9c1e-1111-4222-8333-444455556666'
        const signing = '11111111-2222-4333-8444-555566667777'
        ctx.mockNext([{ ref, signing }])
        const v = Values.create(VOptUuidSampler, 'optUuidSampler', [{ ref, signing }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ ref: v.ref, signing: v.signing })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with optUuidSampler(ref, signing) as (values (?, ?)) select ref as ref, signing as signing from optUuidSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
            "11111111-2222-4333-8444-555566667777",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ ref?: string | undefined; signing?: string | undefined }>>>()
        expect(rows.map((r) => ({ ref: r.ref?.toLowerCase(), signing: r.signing?.toLowerCase() })))
            .toEqual([{ ref, signing }])
    })

    test('values-tuple-optional-column-per-kind-with-passthrough-adapter', async () => {
        // The optional trailing-adapter arm `optionalColumn(kind, adapter)` per kind
        // — boolean/bigint/double/string + customDouble/customComparable/custom/enum.
        // passthroughAdapter is inert; all-optional object; present values round-trip.
        class VOptAdapterSampler extends Values<DBConnection, 'optAdapterSampler'> {
            flag  = this.optionalColumn('boolean', passthroughAdapter)
            big   = this.optionalColumn('bigint', passthroughAdapter)
            dbl   = this.optionalColumn('double', passthroughAdapter)
            str   = this.optionalColumn('string', passthroughAdapter)
            money = this.optionalColumn<number, 'Money'>('customDouble', 'Money', passthroughAdapter)
            ver   = this.optionalColumn<string, 'Semver'>('customComparable', 'Semver', passthroughAdapter)
            chan  = this.optionalColumn<ReleaseChannel, 'ReleaseChannel'>('custom', 'ReleaseChannel', passthroughAdapter)
            act   = this.optionalColumn<WorklogActivity, 'WorklogActivity'>('enum', 'WorklogActivity', passthroughAdapter)
        }
        const row = { flag: true, big: 100n, dbl: 2.5, str: 'abc', money: 3.5, ver: '1.2.0', chan: 'stable' as ReleaseChannel, act: 'coding' as WorklogActivity }
        const expected = [row]
        ctx.mockNext(expected)
        const v = Values.create(VOptAdapterSampler, 'optAdapterSampler', [row])
        const rows = await ctx.conn.selectFrom(v)
            .select({ flag: v.flag, big: v.big, dbl: v.dbl, str: v.str, money: v.money, ver: v.ver, chan: v.chan, act: v.act })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with optAdapterSampler(flag, big, dbl, str, money, ver, chan, act) as (values (?, ?, ?, ?, ?, ?, ?, ?)) select flag as flag, big as big, dbl as dbl, str as str, money as money, ver as ver, chan as chan, act as act from optAdapterSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            100n,
            2.5,
            "abc",
            3.5,
            "1.2.0",
            "stable",
            "coding",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ flag?: boolean | undefined; big?: bigint | undefined; dbl?: number | undefined; str?: string | undefined; money?: number | undefined; ver?: string | undefined; chan?: ReleaseChannel | undefined; act?: WorklogActivity | undefined }>>>()
        expect(rows).toEqual(expected)
    })

    test('values-tuple-optional-uuid-and-custom-uuid-column-with-passthrough-adapter', async () => {
        // The optional uuid / customUuid trailing-adapter arm. passthroughAdapter is
        // inert; all-optional object; present values round-trip case-insensitively.
        class VOptAdapterUuidSampler extends Values<DBConnection, 'optAdapterUuidSampler'> {
            ref     = this.optionalColumn('uuid', passthroughAdapter)
            signing = this.optionalColumn<string, 'SigningKey'>('customUuid', 'SigningKey', passthroughAdapter)
        }
        const ref     = '0a8f9c1e-1111-4222-8333-444455556666'
        const signing = '11111111-2222-4333-8444-555566667777'
        ctx.mockNext([{ ref, signing }])
        const v = Values.create(VOptAdapterUuidSampler, 'optAdapterUuidSampler', [{ ref, signing }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ ref: v.ref, signing: v.signing })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with optAdapterUuidSampler(ref, signing) as (values (?, ?)) select ref as ref, signing as signing from optAdapterUuidSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
            "11111111-2222-4333-8444-555566667777",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ ref?: string | undefined; signing?: string | undefined }>>>()
        expect(rows.map((r) => ({ ref: r.ref?.toLowerCase(), signing: r.signing?.toLowerCase() })))
            .toEqual([{ ref, signing }])
    })

    test('values-tuple-required-virtual-column-from-fragment-per-kind', async () => {
        // Required `virtualColumnFromFragment(kind, fn)` per kind not yet a
        // Values-view virtual column — boolean/int + custom kinds customInt/
        // customDouble/customComparable/custom/enum. Each computes a const fragment
        // in the outer SELECT (not a tuple member); the anchor `n` keeps the object
        // non-empty. Pins the projected type + value per kind.
        class VVReqSampler extends Values<DBConnection, 'vvReqSampler'> {
            n      = this.column('int')
            vint   = this.virtualColumnFromFragment('int', (f) => f.sql`${ctx.conn.const(42, 'int')}`)
            vcents = this.virtualColumnFromFragment<number, 'Cents'>('customInt', 'Cents', (f) => f.sql`${ctx.conn.const<number, 'Cents'>(12, 'customInt', 'Cents')}`)
            vmoney = this.virtualColumnFromFragment<number, 'Money'>('customDouble', 'Money', (f) => f.sql`${ctx.conn.const<number, 'Money'>(3.5, 'customDouble', 'Money')}`)
            vver   = this.virtualColumnFromFragment<string, 'Semver'>('customComparable', 'Semver', (f) => f.sql`${ctx.conn.const<string, 'Semver'>('1.2.0', 'customComparable', 'Semver')}`)
            vchan  = this.virtualColumnFromFragment<ReleaseChannel, 'ReleaseChannel'>('custom', 'ReleaseChannel', (f) => f.sql`${ctx.conn.const<ReleaseChannel, 'ReleaseChannel'>('stable', 'custom', 'ReleaseChannel')}`)
            vact   = this.virtualColumnFromFragment<WorklogActivity, 'WorklogActivity'>('enum', 'WorklogActivity', (f) => f.sql`${ctx.conn.const<WorklogActivity, 'WorklogActivity'>('coding', 'enum', 'WorklogActivity')}`)
        }
        const expected = [{ n: 7, vint: 42, vcents: 12, vmoney: 3.5, vver: '1.2.0', vchan: 'stable' as ReleaseChannel, vact: 'coding' as WorklogActivity }]
        ctx.mockNext(expected)
        const v = Values.create(VVReqSampler, 'vvReqSampler', [{ n: 7 }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ n: v.n, vint: v.vint, vcents: v.vcents, vmoney: v.vmoney, vver: v.vver, vchan: v.vchan, vact: v.vact })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with vvReqSampler("n") as (values (?)) select "n" as "n", ? as vint, ? as vcents, ? as vmoney, ? as vver, ? as vchan, ? as vact from vvReqSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            42,
            12,
            3.5,
            "1.2.0",
            "stable",
            "coding",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ n: number; vint: number; vcents: number; vmoney: number; vver: string; vchan: ReleaseChannel; vact: WorklogActivity }>>>()
        expect(rows).toEqual(expected)
    })

    test('values-tuple-required-virtual-uuid-and-custom-uuid-column-from-fragment', async () => {
        // Required uuid / customUuid virtual columns computed from a const fragment.
        // Compared case-insensitively.
        const uuidRef  = '0a8f9c1e-1111-4222-8333-444455556666'
        const uuidSign = '11111111-2222-4333-8444-555566667777'
        class VVReqUuidSampler extends Values<DBConnection, 'vvReqUuidSampler'> {
            n        = this.column('int')
            vref     = this.virtualColumnFromFragment('uuid', (f) => f.sql`${ctx.conn.const(uuidRef, 'uuid')}`)
            vsigning = this.virtualColumnFromFragment<string, 'SigningKey'>('customUuid', 'SigningKey', (f) => f.sql`${ctx.conn.const<string, 'SigningKey'>(uuidSign, 'customUuid', 'SigningKey')}`)
        }
        ctx.mockNext([{ n: 7, vref: uuidRef, vsigning: uuidSign }])
        const v = Values.create(VVReqUuidSampler, 'vvReqUuidSampler', [{ n: 7 }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ n: v.n, vref: v.vref, vsigning: v.vsigning })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with vvReqUuidSampler("n") as (values (?)) select "n" as "n", ? as vref, ? as vsigning from vvReqUuidSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            "0a8f9c1e-1111-4222-8333-444455556666",
            "11111111-2222-4333-8444-555566667777",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ n: number; vref: string; vsigning: string }>>>()
        expect(rows.map((r) => ({ n: r.n, vref: r.vref.toLowerCase(), vsigning: r.vsigning.toLowerCase() })))
            .toEqual([{ n: 7, vref: uuidRef, vsigning: uuidSign }])
    })

    test('values-tuple-optional-virtual-column-from-fragment-per-kind', async () => {
        // Optional `optionalVirtualColumnFromFragment(kind, fn)` per kind —
        // boolean/int/bigint + custom kinds customInt/customDouble/customComparable/
        // custom/enum. The anchor `n` is required, so optional leaves project as
        // `?: T` (no `| undefined`); present const values round-trip.
        class VVOptSampler extends Values<DBConnection, 'vvOptSampler'> {
            n      = this.column('int')
            vint   = this.optionalVirtualColumnFromFragment('int', (f) => f.sql`${ctx.conn.optionalConst(42, 'int')}`)
            vbig   = this.optionalVirtualColumnFromFragment('bigint', (f) => f.sql`${ctx.conn.optionalConst(100n, 'bigint')}`)
            vcents = this.optionalVirtualColumnFromFragment<number, 'Cents'>('customInt', 'Cents', (f) => f.sql`${ctx.conn.optionalConst<number, 'Cents'>(12, 'customInt', 'Cents')}`)
            vmoney = this.optionalVirtualColumnFromFragment<number, 'Money'>('customDouble', 'Money', (f) => f.sql`${ctx.conn.optionalConst<number, 'Money'>(3.5, 'customDouble', 'Money')}`)
            vver   = this.optionalVirtualColumnFromFragment<string, 'Semver'>('customComparable', 'Semver', (f) => f.sql`${ctx.conn.optionalConst<string, 'Semver'>('1.2.0', 'customComparable', 'Semver')}`)
            vchan  = this.optionalVirtualColumnFromFragment<ReleaseChannel, 'ReleaseChannel'>('custom', 'ReleaseChannel', (f) => f.sql`${ctx.conn.optionalConst<ReleaseChannel, 'ReleaseChannel'>('stable', 'custom', 'ReleaseChannel')}`)
            vact   = this.optionalVirtualColumnFromFragment<WorklogActivity, 'WorklogActivity'>('enum', 'WorklogActivity', (f) => f.sql`${ctx.conn.optionalConst<WorklogActivity, 'WorklogActivity'>('coding', 'enum', 'WorklogActivity')}`)
        }
        const expected = [{ n: 7, vint: 42, vbig: 100n, vcents: 12, vmoney: 3.5, vver: '1.2.0', vchan: 'stable' as ReleaseChannel, vact: 'coding' as WorklogActivity }]
        ctx.mockNext(expected)
        const v = Values.create(VVOptSampler, 'vvOptSampler', [{ n: 7 }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ n: v.n, vint: v.vint, vbig: v.vbig, vcents: v.vcents, vmoney: v.vmoney, vver: v.vver, vchan: v.vchan, vact: v.vact })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with vvOptSampler("n") as (values (?)) select "n" as "n", ? as vint, ? as vbig, ? as vcents, ? as vmoney, ? as vver, ? as vchan, ? as vact from vvOptSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            42,
            100n,
            12,
            3.5,
            "1.2.0",
            "stable",
            "coding",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ n: number; vint?: number; vbig?: bigint; vcents?: number; vmoney?: number; vver?: string; vchan?: ReleaseChannel; vact?: WorklogActivity }>>>()
        expect(rows).toEqual(expected)
    })

    test('values-tuple-optional-virtual-uuid-and-custom-uuid-column-from-fragment', async () => {
        // Optional uuid / customUuid virtual columns computed from a const fragment.
        // Anchor `n` required, so leaves project `?: string`. Compared case-insensitively.
        const uuidRef  = '0a8f9c1e-1111-4222-8333-444455556666'
        const uuidSign = '11111111-2222-4333-8444-555566667777'
        class VVOptUuidSampler extends Values<DBConnection, 'vvOptUuidSampler'> {
            n        = this.column('int')
            vref     = this.optionalVirtualColumnFromFragment('uuid', (f) => f.sql`${ctx.conn.optionalConst(uuidRef, 'uuid')}`)
            vsigning = this.optionalVirtualColumnFromFragment<string, 'SigningKey'>('customUuid', 'SigningKey', (f) => f.sql`${ctx.conn.optionalConst<string, 'SigningKey'>(uuidSign, 'customUuid', 'SigningKey')}`)
        }
        ctx.mockNext([{ n: 7, vref: uuidRef, vsigning: uuidSign }])
        const v = Values.create(VVOptUuidSampler, 'vvOptUuidSampler', [{ n: 7 }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ n: v.n, vref: v.vref, vsigning: v.vsigning })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with vvOptUuidSampler("n") as (values (?)) select "n" as "n", ? as vref, ? as vsigning from vvOptUuidSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            "0a8f9c1e-1111-4222-8333-444455556666",
            "11111111-2222-4333-8444-555566667777",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ n: number; vref?: string; vsigning?: string }>>>()
        expect(rows.map((r) => ({ n: r.n, vref: r.vref?.toLowerCase(), vsigning: r.vsigning?.toLowerCase() })))
            .toEqual([{ n: 7, vref: uuidRef, vsigning: uuidSign }])
    })

    test('values-tuple-optional-virtual-temporal-column-from-fragment-via-null-value', async () => {
        // Optional virtual temporal columns (localDate / localTime / localDateTime)
        // computed from a null optionalConst: a Date does not round-trip identically
        // through the per-dialect cast, so each is supplied null and reads back
        // absent. Required-temporal and custom-temporal virtual columns are omitted
        // for the same round-trip reason (see the tuple temporal tests above).
        class VVTemporalSampler extends Values<DBConnection, 'vvTemporalSampler'> {
            n   = this.column('int')
            vd  = this.optionalVirtualColumnFromFragment('localDate', (f) => f.sql`${ctx.conn.optionalConst(null, 'localDate')}`)
            vt  = this.optionalVirtualColumnFromFragment('localTime', (f) => f.sql`${ctx.conn.optionalConst(null, 'localTime')}`)
            vts = this.optionalVirtualColumnFromFragment('localDateTime', (f) => f.sql`${ctx.conn.optionalConst(null, 'localDateTime')}`)
        }
        ctx.mockNext([{ n: 7, vd: null, vt: null, vts: null }])
        const v = Values.create(VVTemporalSampler, 'vvTemporalSampler', [{ n: 7 }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ n: v.n, vd: v.vd, vt: v.vt, vts: v.vts })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with vvTemporalSampler("n") as (values (?)) select "n" as "n", ? as vd, ? as vt, ? as vts from vvTemporalSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            null,
            null,
            null,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ n: number; vd?: Date; vt?: Date; vts?: Date }>>>()
        expect(rows).toEqual([{ n: 7 }])
    })

    test('values-tuple-required-virtual-column-from-fragment-per-kind-with-passthrough-adapter', async () => {
        // The required virtual-column trailing-adapter arm per kind (mirror of the
        // no-adapter required-virtual test with an inert passthroughAdapter): fires
        // each kind's `virtualColumnFromFragment(…, adapter)` overload. SQL/params/
        // values match the no-adapter arm.
        class VVReqAdapterSampler extends Values<DBConnection, 'vvReqAdapterSampler'> {
            n      = this.column('int')
            vint   = this.virtualColumnFromFragment('int', (f) => f.sql`${ctx.conn.const(42, 'int')}`, passthroughAdapter)
            vcents = this.virtualColumnFromFragment<number, 'Cents'>('customInt', 'Cents', (f) => f.sql`${ctx.conn.const<number, 'Cents'>(12, 'customInt', 'Cents')}`, passthroughAdapter)
            vmoney = this.virtualColumnFromFragment<number, 'Money'>('customDouble', 'Money', (f) => f.sql`${ctx.conn.const<number, 'Money'>(3.5, 'customDouble', 'Money')}`, passthroughAdapter)
            vver   = this.virtualColumnFromFragment<string, 'Semver'>('customComparable', 'Semver', (f) => f.sql`${ctx.conn.const<string, 'Semver'>('1.2.0', 'customComparable', 'Semver')}`, passthroughAdapter)
            vchan  = this.virtualColumnFromFragment<ReleaseChannel, 'ReleaseChannel'>('custom', 'ReleaseChannel', (f) => f.sql`${ctx.conn.const<ReleaseChannel, 'ReleaseChannel'>('stable', 'custom', 'ReleaseChannel')}`, passthroughAdapter)
            vact   = this.virtualColumnFromFragment<WorklogActivity, 'WorklogActivity'>('enum', 'WorklogActivity', (f) => f.sql`${ctx.conn.const<WorklogActivity, 'WorklogActivity'>('coding', 'enum', 'WorklogActivity')}`, passthroughAdapter)
        }
        const expected = [{ n: 7, vint: 42, vcents: 12, vmoney: 3.5, vver: '1.2.0', vchan: 'stable' as ReleaseChannel, vact: 'coding' as WorklogActivity }]
        ctx.mockNext(expected)
        const v = Values.create(VVReqAdapterSampler, 'vvReqAdapterSampler', [{ n: 7 }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ n: v.n, vint: v.vint, vcents: v.vcents, vmoney: v.vmoney, vver: v.vver, vchan: v.vchan, vact: v.vact })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with vvReqAdapterSampler("n") as (values (?)) select "n" as "n", ? as vint, ? as vcents, ? as vmoney, ? as vver, ? as vchan, ? as vact from vvReqAdapterSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            42,
            12,
            3.5,
            "1.2.0",
            "stable",
            "coding",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ n: number; vint: number; vcents: number; vmoney: number; vver: string; vchan: ReleaseChannel; vact: WorklogActivity }>>>()
        expect(rows).toEqual(expected)
    })

    test('values-tuple-required-virtual-uuid-and-custom-uuid-column-from-fragment-with-passthrough-adapter', async () => {
        // Required uuid / customUuid virtual columns with an inert passthroughAdapter.
        const uuidRef  = '0a8f9c1e-1111-4222-8333-444455556666'
        const uuidSign = '11111111-2222-4333-8444-555566667777'
        class VVReqAdapterUuidSampler extends Values<DBConnection, 'vvReqAdapterUuidSampler'> {
            n        = this.column('int')
            vref     = this.virtualColumnFromFragment('uuid', (f) => f.sql`${ctx.conn.const(uuidRef, 'uuid')}`, passthroughAdapter)
            vsigning = this.virtualColumnFromFragment<string, 'SigningKey'>('customUuid', 'SigningKey', (f) => f.sql`${ctx.conn.const<string, 'SigningKey'>(uuidSign, 'customUuid', 'SigningKey')}`, passthroughAdapter)
        }
        ctx.mockNext([{ n: 7, vref: uuidRef, vsigning: uuidSign }])
        const v = Values.create(VVReqAdapterUuidSampler, 'vvReqAdapterUuidSampler', [{ n: 7 }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ n: v.n, vref: v.vref, vsigning: v.vsigning })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with vvReqAdapterUuidSampler("n") as (values (?)) select "n" as "n", ? as vref, ? as vsigning from vvReqAdapterUuidSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            "0a8f9c1e-1111-4222-8333-444455556666",
            "11111111-2222-4333-8444-555566667777",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ n: number; vref: string; vsigning: string }>>>()
        expect(rows.map((r) => ({ n: r.n, vref: r.vref.toLowerCase(), vsigning: r.vsigning.toLowerCase() })))
            .toEqual([{ n: 7, vref: uuidRef, vsigning: uuidSign }])
    })

    test('values-tuple-optional-virtual-column-from-fragment-per-kind-with-passthrough-adapter', async () => {
        // The optional virtual-column trailing-adapter arm per kind (mirror of the
        // no-adapter optional-virtual test with an inert passthroughAdapter).
        class VVOptAdapterSampler extends Values<DBConnection, 'vvOptAdapterSampler'> {
            n      = this.column('int')
            vint   = this.optionalVirtualColumnFromFragment('int', (f) => f.sql`${ctx.conn.optionalConst(42, 'int')}`, passthroughAdapter)
            vbig   = this.optionalVirtualColumnFromFragment('bigint', (f) => f.sql`${ctx.conn.optionalConst(100n, 'bigint')}`, passthroughAdapter)
            vcents = this.optionalVirtualColumnFromFragment<number, 'Cents'>('customInt', 'Cents', (f) => f.sql`${ctx.conn.optionalConst<number, 'Cents'>(12, 'customInt', 'Cents')}`, passthroughAdapter)
            vmoney = this.optionalVirtualColumnFromFragment<number, 'Money'>('customDouble', 'Money', (f) => f.sql`${ctx.conn.optionalConst<number, 'Money'>(3.5, 'customDouble', 'Money')}`, passthroughAdapter)
            vver   = this.optionalVirtualColumnFromFragment<string, 'Semver'>('customComparable', 'Semver', (f) => f.sql`${ctx.conn.optionalConst<string, 'Semver'>('1.2.0', 'customComparable', 'Semver')}`, passthroughAdapter)
            vchan  = this.optionalVirtualColumnFromFragment<ReleaseChannel, 'ReleaseChannel'>('custom', 'ReleaseChannel', (f) => f.sql`${ctx.conn.optionalConst<ReleaseChannel, 'ReleaseChannel'>('stable', 'custom', 'ReleaseChannel')}`, passthroughAdapter)
            vact   = this.optionalVirtualColumnFromFragment<WorklogActivity, 'WorklogActivity'>('enum', 'WorklogActivity', (f) => f.sql`${ctx.conn.optionalConst<WorklogActivity, 'WorklogActivity'>('coding', 'enum', 'WorklogActivity')}`, passthroughAdapter)
        }
        const expected = [{ n: 7, vint: 42, vbig: 100n, vcents: 12, vmoney: 3.5, vver: '1.2.0', vchan: 'stable' as ReleaseChannel, vact: 'coding' as WorklogActivity }]
        ctx.mockNext(expected)
        const v = Values.create(VVOptAdapterSampler, 'vvOptAdapterSampler', [{ n: 7 }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ n: v.n, vint: v.vint, vbig: v.vbig, vcents: v.vcents, vmoney: v.vmoney, vver: v.vver, vchan: v.vchan, vact: v.vact })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with vvOptAdapterSampler("n") as (values (?)) select "n" as "n", ? as vint, ? as vbig, ? as vcents, ? as vmoney, ? as vver, ? as vchan, ? as vact from vvOptAdapterSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            42,
            100n,
            12,
            3.5,
            "1.2.0",
            "stable",
            "coding",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ n: number; vint?: number; vbig?: bigint; vcents?: number; vmoney?: number; vver?: string; vchan?: ReleaseChannel; vact?: WorklogActivity }>>>()
        expect(rows).toEqual(expected)
    })

    test('values-tuple-optional-virtual-uuid-and-custom-uuid-column-from-fragment-with-passthrough-adapter', async () => {
        // Optional uuid / customUuid virtual columns with an inert passthroughAdapter.
        const uuidRef  = '0a8f9c1e-1111-4222-8333-444455556666'
        const uuidSign = '11111111-2222-4333-8444-555566667777'
        class VVOptAdapterUuidSampler extends Values<DBConnection, 'vvOptAdapterUuidSampler'> {
            n        = this.column('int')
            vref     = this.optionalVirtualColumnFromFragment('uuid', (f) => f.sql`${ctx.conn.optionalConst(uuidRef, 'uuid')}`, passthroughAdapter)
            vsigning = this.optionalVirtualColumnFromFragment<string, 'SigningKey'>('customUuid', 'SigningKey', (f) => f.sql`${ctx.conn.optionalConst<string, 'SigningKey'>(uuidSign, 'customUuid', 'SigningKey')}`, passthroughAdapter)
        }
        ctx.mockNext([{ n: 7, vref: uuidRef, vsigning: uuidSign }])
        const v = Values.create(VVOptAdapterUuidSampler, 'vvOptAdapterUuidSampler', [{ n: 7 }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ n: v.n, vref: v.vref, vsigning: v.vsigning })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with vvOptAdapterUuidSampler("n") as (values (?)) select "n" as "n", ? as vref, ? as vsigning from vvOptAdapterUuidSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            "0a8f9c1e-1111-4222-8333-444455556666",
            "11111111-2222-4333-8444-555566667777",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ n: number; vref?: string; vsigning?: string }>>>()
        expect(rows.map((r) => ({ n: r.n, vref: r.vref?.toLowerCase(), vsigning: r.vsigning?.toLowerCase() })))
            .toEqual([{ n: 7, vref: uuidRef, vsigning: uuidSign }])
    })

    test('values-tuple-optional-virtual-temporal-column-from-fragment-with-passthrough-adapter-via-null-value', async () => {
        // Optional virtual temporal columns with an inert passthroughAdapter, each
        // supplied null (Date round-trip caveat as above); reads back absent.
        class VVTemporalAdapterSampler extends Values<DBConnection, 'vvTemporalAdapterSampler'> {
            n   = this.column('int')
            vd  = this.optionalVirtualColumnFromFragment('localDate', (f) => f.sql`${ctx.conn.optionalConst(null, 'localDate')}`, passthroughAdapter)
            vt  = this.optionalVirtualColumnFromFragment('localTime', (f) => f.sql`${ctx.conn.optionalConst(null, 'localTime')}`, passthroughAdapter)
            vts = this.optionalVirtualColumnFromFragment('localDateTime', (f) => f.sql`${ctx.conn.optionalConst(null, 'localDateTime')}`, passthroughAdapter)
        }
        ctx.mockNext([{ n: 7, vd: null, vt: null, vts: null }])
        const v = Values.create(VVTemporalAdapterSampler, 'vvTemporalAdapterSampler', [{ n: 7 }])
        const rows = await ctx.conn.selectFrom(v)
            .select({ n: v.n, vd: v.vd, vt: v.vt, vts: v.vts })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with vvTemporalAdapterSampler("n") as (values (?)) select "n" as "n", ? as vd, ? as vt, ? as vts from vvTemporalAdapterSampler"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            null,
            null,
            null,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ n: number; vd?: Date; vt?: Date; vts?: Date }>>>()
        expect(rows).toEqual([{ n: 7 }])
    })
})
