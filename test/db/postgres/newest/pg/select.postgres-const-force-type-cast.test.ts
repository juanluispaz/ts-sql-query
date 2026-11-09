// Coverage of the PostgreSQL type a parameter gets for the
// `forceTypeCast = true` branch. When a
// const value source is projected as a SELECT column,
// `PostgreSqlSqlBuilder._appendColumnValue` forwards through
// `__toSql(forceTypeCast = true)`; each typed const triggers the
// matching `::<pg-type>` placeholder cast (pg, Bun SQL), or the matching
// typed parameter (postgres.js, PGlite).
// `::bool` is already covered by the existing
// `insert.multi-row.test.ts` (custom-boolean remap goes through the
// same path with `forceTypeCast = true`); this file adds the other
// typed casts: `::int4`, `::int8`, `::float8`, `::text`, `::uuid`,
// `::date`, `::time`, `::timestamp`.
//
// The closing block (`const-custom-* …`) exercises the value-shape
// fallback: `customInt`,
// `customDouble`, `customLocalDate`, `custom` etc. drop through the
// type switch and the cast is picked from `typeof valueSentToDB`
// (`bigint → ::int8`; `number` int32 → `::int4`; `number` int64 →
// `::int8`; `number` float → `::float8`; anything else → no cast).
//
// PostgreSQL-specific: every other dialect's query runner either
// ignores it (no `::cast` syntax) or uses a wholly different
// mechanism — there is no parallel file in other dialect folders.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('const-int-forces-int4-cast', async () => {
        ctx.mockNext(1)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(1, 'int'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int4 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })

    test('const-bigint-forces-int8-cast', async () => {
        ctx.mockNext(1n)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(1n, 'bigint'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int8 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1n,
          ]
        `)
    })

    test('const-double-forces-float8-cast', async () => {
        ctx.mockNext(1.5)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(1.5, 'double'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::float8 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1.5,
          ]
        `)
    })

    test('const-string-forces-text-cast', async () => {
        ctx.mockNext('hello')
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const('hello', 'string'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::text as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "hello",
          ]
        `)
    })

    test('const-uuid-forces-uuid-cast', async () => {
        ctx.mockNext('c733575e-b5ba-400c-8803-3d3d4bbcd52f')
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const('c733575e-b5ba-400c-8803-3d3d4bbcd52f', 'uuid'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::uuid as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "c733575e-b5ba-400c-8803-3d3d4bbcd52f",
          ]
        `)
    })

    test('const-localdate-forces-date-cast', async () => {
        const d = new Date('2024-01-15T00:00:00Z')
        ctx.mockNext(d)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(d, 'localDate'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::date as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-15T00:00:00.000Z,
          ]
        `)
    })

    test('const-localtime-forces-time-cast', async () => {
        const t = new Date('1970-01-01T12:34:56Z')
        ctx.mockNext(t)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(t, 'localTime'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::time as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1970-01-01T12:34:56.000Z,
          ]
        `)
    })

    test('const-localdatetime-forces-timestamp-cast', async () => {
        const ts = new Date('2024-01-15T12:34:56Z')
        ctx.mockNext(ts)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(ts, 'localDateTime'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::timestamp as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-15T12:34:56.000Z,
          ]
        `)
    })

    test('const-custom-int-is-cast-as-int4', async () => {
        // A `customInt` is cast as an `int`: `::int4`.
        // Realistic shape: a branded ID type tagged as `IssueId`.
        type IssueId = number & { readonly __brand: 'IssueId' }
        const id = 42 as IssueId
        ctx.mockNext(id)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<IssueId, 'IssueId'>(id, 'customInt', 'IssueId'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int4 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            42,
          ]
        `)
    })

    test('const-custom-bigint-is-cast-as-int8', async () => {
        // A `customBigint` is converted and cast as a `bigint`: `::int8`, also for a value past int32.
        type AuditPosition = bigint & { readonly __brand: 'AuditPosition' }
        const pos = 9_999_999_999n as AuditPosition
        ctx.mockNext('9999999999')
        const result = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<AuditPosition, 'AuditPosition'>(pos, 'customBigint', 'AuditPosition'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int8 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            9999999999n,
          ]
        `)
        assertType<Exact<typeof result, AuditPosition>>()
        expect(result).toBe(9_999_999_999n)
    })

    test('const-custom-double-is-cast-as-float8', async () => {
        // A `customDouble` is cast as a `double`: `::float8`.
        type Money = number & { readonly __brand: 'Money' }
        const amount = 19.99 as Money
        ctx.mockNext(amount)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<Money, 'Money'>(amount, 'customDouble', 'Money'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::float8 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            19.99,
          ]
        `)
    })

    test('const-custom-without-category-is-not-cast', async () => {
        // A `custom` has no category to cast by, and its value is a
        // string: no cast. Realistic shape: a branded slug carried through
        // a domain helper.
        type Slug = string & { readonly __brand: 'Slug' }
        const s = 'marketing-site' as Slug
        ctx.mockNext(s)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<Slug, 'Slug'>(s, 'custom', 'Slug'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "marketing-site",
          ]
        `)
    })

    test('const-custom-localdate-is-cast-as-date', async () => {
        // A `customLocalDate` is cast as a `localDate`: `::date`.
        type SettlementDate = Date & { readonly __brand: 'SettlementDate' }
        const d = new Date('2024-02-20T00:00:00Z') as SettlementDate
        ctx.mockNext(d)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<SettlementDate, 'SettlementDate'>(d, 'customLocalDate', 'SettlementDate'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::date as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-02-20T00:00:00.000Z,
          ]
        `)
    })

    test('const-custom-comparable-is-not-cast', async () => {
        // A `customComparable` has no category to cast by, and its value is
        // a string: no cast.
        type SemVer = string & { readonly __brand: 'SemVer' }
        const v = '1.2.0' as SemVer
        ctx.mockNext(v)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<SemVer, 'SemVer'>(v, 'customComparable', 'SemVer'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.2.0",
          ]
        `)
    })

    test('const-custom-uuid-is-cast-as-uuid', async () => {
        // A `customUuid` is cast as a `uuid`: `::uuid`.
        type ReleaseId = string & { readonly __brand: 'ReleaseId' }
        const id = 'c733575e-b5ba-400c-8803-3d3d4bbcd52f' as ReleaseId
        ctx.mockNext(id)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<ReleaseId, 'ReleaseId'>(id, 'customUuid', 'ReleaseId'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::uuid as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "c733575e-b5ba-400c-8803-3d3d4bbcd52f",
          ]
        `)
    })

    test('const-custom-localtime-is-cast-as-time', async () => {
        // A `customLocalTime` is cast as a `localTime`: `::time`.
        type CutoffClock = Date & { readonly __brand: 'CutoffClock' }
        const t = new Date('1970-01-01T17:00:00Z') as CutoffClock
        ctx.mockNext(t)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<CutoffClock, 'CutoffClock'>(t, 'customLocalTime', 'CutoffClock'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::time as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1970-01-01T17:00:00.000Z,
          ]
        `)
    })

    test('const-custom-localdatetime-is-cast-as-timestamp', async () => {
        // A `customLocalDateTime` is cast as a `localDateTime`: `::timestamp`.
        type SignOffStamp = Date & { readonly __brand: 'SignOffStamp' }
        const ts = new Date('2024-01-14T12:30:00Z') as SignOffStamp
        ctx.mockNext(ts)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<SignOffStamp, 'SignOffStamp'>(ts, 'customLocalDateTime', 'SignOffStamp'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::timestamp as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-14T12:30:00.000Z,
          ]
        `)
    })

    test('const-custom-localdate-in-a-date-part-carries-its-base-type', async () => {
        // The same `customLocalDate` const as the receiver of a date part: inside
        // `extract(... from $1)` nothing gives the parameter a type, so it is cast
        // to the type its custom type is based on.
        type SettlementDate = Date & { readonly __brand: 'SettlementDate' }
        const d = new Date('2024-02-20T00:00:00Z') as SettlementDate
        ctx.mockNext(2024)
        const year = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<SettlementDate, 'SettlementDate'>(d, 'customLocalDate', 'SettlementDate').getFullYear())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(year from $1::date) as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-02-20T00:00:00.000Z,
          ]
        `)
        expect(year).toBe(2024)
    })

    test('roundn-with-a-fractional-scale-rounds-the-scale', async () => {
        // `round(numeric, integer)` is the only overload: a fractional scale (1.6)
        // is cast to an integer (2), so 2.345 rounds to 2.35.
        ctx.mockNext(2.35)
        const rounded = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(2.345, 'double').roundn(1.6))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select round(($1)::numeric, ($2::float8)::int4) as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2.345,
            1.6,
          ]
        `)
        expect(rounded).toBe(2.35)
    })
})
