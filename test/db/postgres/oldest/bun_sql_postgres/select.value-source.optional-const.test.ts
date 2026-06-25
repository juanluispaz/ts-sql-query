// Per-keyword coverage of `optionalConst(value, keyword[, typeName])`. Each
// keyword arm returns a distinct `*ValueSource<…, 'optional'>` and a distinct
// emitted placeholder/cast. This file projects one value per arm through
// `selectFromNoTable().select({...})` (each optional const projects as
// `key?: T`) and pins the emitted SQL (the cast ladder is dialect-specific;
// each cell records its own) plus the resolved leaf type. The null-arm test
// drives the `null` input through `selectOneColumn` to reach the `T | null`
// cardinality.
//
// Custom typeNames are the ones the domain connection marshals through their
// native base (Money->double, ReleaseTag->int, SigningKey->uuid, Semver->
// string, ReleaseDay/CutoffClock/SignOffStamp->localDate/Time/DateTime), so the
// const values round-trip typed on every engine — except the two localDate
// arms, whose const value round-trip is driver-specific (driven via `null` in
// the localdate-keyword-cast-and-type test).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { ReleaseChannel, WorklogActivity } from '../../domain/connection.js'
import { ctx } from './setup.js'

const UUID_V = '0a8f9c1e-1111-4222-8333-444455556666'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('optional-const/int-double-bigint-boolean', async () => {
        // The int/double/bigint/boolean arms of optionalConst — the emitted
        // SQL/cast and the 'optional' leaf type.
        const expected = { i: 7, d: 1.5, bi: 9n, b: true }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFromNoTable()
            .select({
                i:  ctx.conn.optionalConst(7, 'int'),
                d:  ctx.conn.optionalConst(1.5, 'double'),
                bi: ctx.conn.optionalConst(9n, 'bigint'),
                b:  ctx.conn.optionalConst(true, 'boolean'),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int4 as "i", $2::float8 as "d", $3::int8 as bi, $4::bool as "b""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            1.5,
            9n,
            true,
          ]
        `)
        assertType<Exact<typeof row, { i?: number | undefined; d?: number | undefined; bi?: bigint | undefined; b?: boolean | undefined }>>()
        expect(row).toEqual(expected)
    })

    test('optional-const/uuid-enum-custom-comparable', async () => {
        // uuid (-> string), enum (-> the branded union), custom (equality, ->
        // the branded union), customComparable (-> string). The branded leaves
        // resolve to their underlying TS type.
        const expected = { u: UUID_V, e: 'coding' as WorklogActivity, c: 'stable' as ReleaseChannel, cc: '1.2.0' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFromNoTable()
            .select({
                u:  ctx.conn.optionalConst(UUID_V, 'uuid'),
                e:  ctx.conn.optionalConst<WorklogActivity, 'WorklogActivity'>('coding', 'enum', 'WorklogActivity'),
                c:  ctx.conn.optionalConst<ReleaseChannel, 'ReleaseChannel'>('stable', 'custom', 'ReleaseChannel'),
                cc: ctx.conn.optionalConst<string, 'Semver'>('1.2.0', 'customComparable', 'Semver'),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::uuid as "u", $2 as "e", $3 as "c", $4 as cc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
            "coding",
            "stable",
            "1.2.0",
          ]
        `)
        assertType<Exact<typeof row, { u?: string | undefined; e?: WorklogActivity | undefined; c?: ReleaseChannel | undefined; cc?: string | undefined }>>()
        expect(row).toEqual(expected)
    })

    test('optional-const/custom-numeric-and-uuid', async () => {
        // customInt (-> number), customDouble (-> number), customUuid
        // (-> string). Brands carry through; the leaves are the underlying type.
        const expected = { ci: 7, cd: 1.5, cu: UUID_V }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFromNoTable()
            .select({
                ci: ctx.conn.optionalConst<number, 'ReleaseTag'>(7, 'customInt', 'ReleaseTag'),
                cd: ctx.conn.optionalConst<number, 'Money'>(1.5, 'customDouble', 'Money'),
                cu: ctx.conn.optionalConst<string, 'SigningKey'>(UUID_V, 'customUuid', 'SigningKey'),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int4 as ci, $2::float8 as cd, $3 as cu"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            1.5,
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        assertType<Exact<typeof row, { ci?: number | undefined; cd?: number | undefined; cu?: string | undefined }>>()
        expect(row).toEqual(expected)
    })

    test('optional-const/temporal-time-and-datetime', async () => {
        // localTime / localDateTime and their custom siblings customLocalTime /
        // customLocalDateTime (-> Date), all 'optional'. These four round-trip a
        // const value cleanly on every engine. A time-only value sits on
        // 1970-01-01. (The localDate arms are driven via null below.)
        const lt  = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        const ldt = new Date(Date.UTC(2024, 0, 14, 12, 30, 0))
        const expected = { lt, ldt, clt: lt, cldt: ldt }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFromNoTable()
            .select({
                lt:   ctx.conn.optionalConst(lt, 'localTime'),
                ldt:  ctx.conn.optionalConst(ldt, 'localDateTime'),
                clt:  ctx.conn.optionalConst<Date, 'CutoffClock'>(lt, 'customLocalTime', 'CutoffClock'),
                cldt: ctx.conn.optionalConst<Date, 'SignOffStamp'>(ldt, 'customLocalDateTime', 'SignOffStamp'),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::time as lt, $2::timestamp as ldt, $3 as clt, $4 as cldt"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "17:00:00",
            "2024-01-14T12:30:00.000Z",
            "17:00:00",
            "2024-01-14T12:30:00.000Z",
          ]
        `)
        assertType<Exact<typeof row, {
            lt?: Date | undefined; ldt?: Date | undefined; clt?: Date | undefined; cldt?: Date | undefined
        }>>()
        expect(row).toEqual(expected)
    })

    test('optional-const/localdate-keyword-cast-and-type', async () => {
        // The `localDate` / `customLocalDate` arms — the emitted placeholder
        // cast (pg `::date` for the enumerated keyword, bare for the custom one)
        // and the `Date | null` leaf. The value is driven with `null` because a
        // non-null date const echoed back is not round-trippable on every driver
        // (mariadb returns it as `2024-1-15 0:0:0`, which the localDate
        // marshaller rejects); `null` skips the date parser, so the cast + type
        // are validated on the real engine.
        ctx.mockNext(null)
        const ld = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.optionalConst(null, 'localDate'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::date as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
          ]
        `)
        assertType<Exact<typeof ld, Date | null>>()
        expect(ld).toBeNull()

        ctx.mockNext(null)
        const cld = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.optionalConst<Date, 'ReleaseDay'>(null, 'customLocalDate', 'ReleaseDay'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
          ]
        `)
        assertType<Exact<typeof cld, Date | null>>()
        expect(cld).toBeNull()
    })

    test('optional-const/null-arm-projects-as-T-or-null', async () => {
        // The `null` input on the `optional` overload — `selectOneColumn` gives
        // the `T | null` cardinality, and a null value comes back null.
        ctx.mockNext(null)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.optionalConst(null, 'int'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int4 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
          ]
        `)
        assertType<Exact<typeof v, number | null>>()
        expect(v).toBeNull()
    })
})
