// Coverage of `PostgreSqlConnection.transformPlaceholder` for the
// `forceTypeCast = true` branch (PostgreSqlConnection.ts:95-141). When a
// const value source is projected as a SELECT column,
// `PostgreSqlSqlBuilder._appendColumnValue` forwards through
// `__toSql(forceTypeCast = true)`; each typed const triggers the
// matching `::<pg-type>` placeholder cast in `transformPlaceholder`.
// `::bool` is already covered by the existing
// `insert.multi-row.test.ts` (custom-boolean remap goes through the
// same path with `forceTypeCast = true`); this file adds the other
// typed casts: `::int4`, `::int8`, `::float8`, `::text`, `::uuid`,
// `::date`, `::time`, `::timestamp`.
//
// The closing block (`const-custom-* …`) exercises the value-shape
// fallback (PostgreSqlConnection.ts:124-140): `customInt`,
// `customDouble`, `customLocalDate`, `custom` etc. drop through the
// type switch and the cast is picked from `typeof valueSentToDB`
// (`bigint → ::int8`; `number` int32 → `::int4`; `number` int64 →
// `::int8`; `number` float → `::float8`; anything else → no cast).
//
// PostgreSQL-specific: every other dialect's `transformPlaceholder`
// either no-ops (no `::cast` syntax) or uses a wholly different
// mechanism — there is no parallel file in other dialect folders.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('const-int-forces-int4-cast', async () => {
        // PostgreSqlConnection.ts:102-103.
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
        // PostgreSqlConnection.ts:104-105.
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
        // PostgreSqlConnection.ts:108-109.
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
        // PostgreSqlConnection.ts:112-113.
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
        // PostgreSqlConnection.ts:114-115.
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

    // Not applicable on bun_sql_postgres: Bun.SQL's PostgreSQL adapter
    // currently serialises `Date` parameters via `Date#toString()` (e.g.
    // `"Mon Jan 15 2024 …"`) instead of an ISO/timestamp format, so
    // PostgreSQL rejects the bound value with `invalid input syntax for
    // type date|timestamp` whenever a `localDate` / `localDateTime`
    // `Date` reaches the driver. The fix has to land upstream in Bun.
    // See https://github.com/oven-sh/bun/issues/29010 for the bug
    // report. Body kept verbatim from the canonical pg cell so a fix
    // here is a `/* */` removal and nothing else.
    /*
    test('const-localdate-forces-date-cast', async () => {
        // PostgreSqlConnection.ts:116-117.
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
    */

    test('const-localtime-forces-time-cast', async () => {
        // PostgreSqlConnection.ts:118-119.
        const t = new Date('1970-01-01T12:34:56Z')
        ctx.mockNext(t)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(t, 'localTime'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::time as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "12:34:56",
          ]
        `)
    })

    // Not applicable on bun_sql_postgres: Bun.SQL's PostgreSQL adapter
    // currently serialises `Date` parameters via `Date#toString()` (e.g.
    // `"Mon Jan 15 2024 …"`) instead of an ISO/timestamp format, so
    // PostgreSQL rejects the bound value with `invalid input syntax for
    // type date|timestamp` whenever a `localDate` / `localDateTime`
    // `Date` reaches the driver. The fix has to land upstream in Bun.
    // See https://github.com/oven-sh/bun/issues/29010 for the bug
    // report. Body kept verbatim from the canonical pg cell so a fix
    // here is a `/* */` removal and nothing else.
    /*
    test('const-localdatetime-forces-timestamp-cast', async () => {
        // PostgreSqlConnection.ts:120-121.
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
    */

    test('const-custom-int-small-falls-through-to-int4-cast', async () => {
        // PostgreSqlConnection.ts:128-131. `customInt` is not enumerated
        // in the type switch, so the placeholder cast is decided from
        // `typeof valueSentToDB`. A plain int32 number routes to `::int4`.
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

    test('const-custom-int-large-falls-through-to-int8-cast', async () => {
        // PostgreSqlConnection.ts:132-134. A `customInt` whose runtime
        // value exceeds int32 routes to `::int8` from the same fallback
        // ladder. 9_999_999_999 > 2^31-1 (2_147_483_647).
        type AuditPosition = number & { readonly __brand: 'AuditPosition' }
        const pos = 9_999_999_999 as AuditPosition
        ctx.mockNext(pos)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<AuditPosition, 'AuditPosition'>(pos, 'customInt', 'AuditPosition'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int8 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            9999999999,
          ]
        `)
    })

    test('const-custom-int-bigint-falls-through-to-int8-cast', async () => {
        // PostgreSqlConnection.ts:124-126. `typeof valueSentToDB ===
        // 'bigint'` is checked before the number ladder, so a `bigint`
        // value on a `customInt` const routes to `::int8` even though
        // `customInt` itself never appears in the switch.
        type LargeCount = bigint & { readonly __brand: 'LargeCount' }
        const c = 12345678901234n as LargeCount
        ctx.mockNext(c)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<LargeCount, 'LargeCount'>(c, 'customInt', 'LargeCount'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int8 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            12345678901234n,
          ]
        `)
    })

    test('const-custom-double-falls-through-to-float8-cast', async () => {
        // PostgreSqlConnection.ts:135-137. `customDouble` carries a
        // non-integer number; the `Number.isInteger` branch falls into
        // `::float8`.
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

    test('const-custom-string-falls-through-without-cast', async () => {
        // PostgreSqlConnection.ts:140. A `custom` typeName whose value is
        // a string ends the fallback ladder at the final bare `return
        // placeholder` — no cast appended. Realistic shape: a branded
        // slug carried through a domain helper.
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

    // Not applicable on bun_sql_postgres: Bun.SQL's PostgreSQL adapter
    // currently serialises `Date` parameters via `Date#toString()` (e.g.
    // `"Mon Jan 15 2024 …"`) instead of an ISO/timestamp format, so
    // PostgreSQL rejects the bound value with `invalid input syntax for
    // type date|timestamp` whenever a `localDate` / `localDateTime`
    // `Date` reaches the driver. The fix has to land upstream in Bun.
    // See https://github.com/oven-sh/bun/issues/29010 for the bug
    // report. Body kept verbatim from the canonical pg cell so a fix
    // here is a `/* */` removal and nothing else.
    /*
    test('const-custom-localdate-falls-through-without-cast', async () => {
        // PostgreSqlConnection.ts:140. A `customLocalDate` carries a
        // Date object; `typeof` is `object` so the number/bigint ladder
        // is skipped and the placeholder is emitted bare. Distinct from
        // the enumerated `'localDate'` case (which routes to `::date`).
        type SettlementDate = Date & { readonly __brand: 'SettlementDate' }
        const d = new Date('2024-02-20T00:00:00Z') as SettlementDate
        ctx.mockNext(d)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<SettlementDate, 'SettlementDate'>(d, 'customLocalDate', 'SettlementDate'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-02-20T00:00:00.000Z,
          ]
        `)
    })
    */
})
