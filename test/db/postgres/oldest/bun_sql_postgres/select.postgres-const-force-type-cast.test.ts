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
// fallback: `IntegersType`,
// `RealsType`, `LocalDatesType`, `EqualableType` etc. drop through the
// type switch and the cast is picked from `typeof valueSentToDB`
// (`bigint → ::int8`; `number` int32 → `::int4`; `number` int64 →
// `::int8`; `number` float → `::float8`; anything else → no cast).
//
// PostgreSQL-specific: every other dialect's query runner either
// ignores it (no `::cast` syntax) or uses a wholly different
// mechanism — there is no parallel file in other dialect folders.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'
import { ComparableType, EqualableType, IntegersType, LocalDateTimesType, LocalDatesType, LocalTimesType, RealsType, UuidsType } from '../../../../../src/exports/v2/index.js'

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

    test('const-own-int-is-cast-as-int4', async () => {
        // An `IntegersType` is cast as an `int`: `::int4`.
        // Realistic shape: a branded ID type tagged as `IssueId`.
        type IssueId = number & { readonly __brand: 'IssueId' }
        abstract class IssueIdType extends IntegersType<IssueId, 'IssueId'> { static override readonly type = 'IssueId' }
        const id = 42 as IssueId
        ctx.mockNext(id)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(id, IssueIdType))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int4 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            42,
          ]
        `)
    })

    test('const-own-double-is-cast-as-float8', async () => {
        // A `RealsType` is cast as a `double`: `::float8`.
        type Money = number & { readonly __brand: 'Money' }
        abstract class MoneyType extends RealsType<Money, 'Money'> { static override readonly type = 'Money' }
        const amount = 19.99 as Money
        ctx.mockNext(amount)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(amount, MoneyType))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::float8 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            19.99,
          ]
        `)
    })

    test('const-own-without-category-is-not-cast', async () => {
        // A `EqualableType` has no category to cast by, and its value is a
        // string: no cast. Realistic shape: a branded slug carried through
        // a domain helper.
        type Slug = string & { readonly __brand: 'Slug' }
        abstract class SlugType extends EqualableType<Slug, 'Slug'> { static override readonly type = 'Slug' }
        const s = 'marketing-site' as Slug
        ctx.mockNext(s)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(s, SlugType))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "marketing-site",
          ]
        `)
    })

    test('const-own-localdate-is-cast-as-date', async () => {
        // A `LocalDatesType` is cast as a `localDate`: `::date`.
        type SettlementDate = Date & { readonly __brand: 'SettlementDate' }
        abstract class SettlementDateType extends LocalDatesType<SettlementDate, 'SettlementDate'> { static override readonly type = 'SettlementDate' }
        const d = new Date('2024-02-20T00:00:00Z') as SettlementDate
        ctx.mockNext(d)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(d, SettlementDateType))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::date as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-02-20T00:00:00.000Z,
          ]
        `)
    })

    test('const-own-comparable-is-not-cast', async () => {
        // A `ComparableType` has no category to cast by, and its value is
        // a string: no cast.
        type SemVer = string & { readonly __brand: 'SemVer' }
        abstract class SemVerType extends ComparableType<SemVer, 'SemVer'> { static override readonly type = 'SemVer' }
        const v = '1.2.0' as SemVer
        ctx.mockNext(v)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(v, SemVerType))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.2.0",
          ]
        `)
    })

    test('const-own-uuid-is-cast-as-uuid', async () => {
        // An `UuidsType` is cast as a `uuid`: `::uuid`.
        type ReleaseId = string & { readonly __brand: 'ReleaseId' }
        abstract class ReleaseIdType extends UuidsType<ReleaseId, 'ReleaseId'> { static override readonly type = 'ReleaseId' }
        const id = 'c733575e-b5ba-400c-8803-3d3d4bbcd52f' as ReleaseId
        ctx.mockNext(id)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(id, ReleaseIdType))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::uuid as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "c733575e-b5ba-400c-8803-3d3d4bbcd52f",
          ]
        `)
    })

    test('const-own-localtime-is-cast-as-time', async () => {
        // A `LocalTimesType` is cast as a `localTime`: `::time`.
        type CutoffClock = Date & { readonly __brand: 'CutoffClock' }
        abstract class CutoffClockType extends LocalTimesType<CutoffClock, 'CutoffClock'> { static override readonly type = 'CutoffClock' }
        const t = new Date('1970-01-01T17:00:00Z') as CutoffClock
        ctx.mockNext(t)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(t, CutoffClockType))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::time as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1970-01-01T17:00:00.000Z,
          ]
        `)
    })

    test('const-own-localdatetime-is-cast-as-timestamp', async () => {
        // A `LocalDateTimesType` is cast as a `localDateTime`: `::timestamp`.
        type SignOffStamp = Date & { readonly __brand: 'SignOffStamp' }
        abstract class SignOffStampType extends LocalDateTimesType<SignOffStamp, 'SignOffStamp'> { static override readonly type = 'SignOffStamp' }
        const ts = new Date('2024-01-14T12:30:00Z') as SignOffStamp
        ctx.mockNext(ts)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(ts, SignOffStampType))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::timestamp as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-14T12:30:00.000Z,
          ]
        `)
    })

})
