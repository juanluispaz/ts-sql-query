// Coverage of `PostgreSqlConnection.transformPlaceholder` for the
// `forceTypeCast = true` branch (PostgreSqlConnection.ts:95-122). When a
// const value source is projected as a SELECT column,
// `PostgreSqlSqlBuilder._appendColumnValue` forwards through
// `__toSql(forceTypeCast = true)`; each typed const triggers the
// matching `::<pg-type>` placeholder cast in `transformPlaceholder`.
// `::bool` is already covered by the existing
// `insert.multi-row.test.ts` (custom-boolean remap goes through the
// same path with `forceTypeCast = true`); this file adds the other
// typed casts: `::int4`, `::int8`, `::float8`, `::text`, `::uuid`,
// `::date`, `::timestamp::time`, `::timestamp`.
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
        ctx.mockNext('11111111-1111-1111-1111-111111111111')
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const('11111111-1111-1111-1111-111111111111', 'uuid'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::uuid as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "11111111-1111-1111-1111-111111111111",
          ]
        `)
    })

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

    // TODO[BUG] PostgreSqlConnection.ts:119 emits `placeholder + '::timestamp::time'`
    // for the `'localTime'` branch when `forceTypeCast = true`, but
    // `transformValueToDB('localTime', Date)` ships a bare `'HH:MM:SS'`
    // string. PostgreSQL rejects the intermediate `'12:34:56'::timestamp`
    // cast with `invalid input syntax for type timestamp`. Verified
    // empirically against PG 18 — see `test/BUGS.md` for the open entry.
    // Body kept verbatim from the canonical pg cell so the fix is a
    // one-character src patch (drop `::timestamp`) + uncommenting + a
    // snapshot refresh.
    /*
    test('const-localtime-forces-timestamp-time-cast', async () => {
        // PostgreSqlConnection.ts:118-119 — `localTime` actually emits
        // `::timestamp::time`, a two-stage cast.
        const t = new Date('1970-01-01T12:34:56Z')
        ctx.mockNext(t)
        await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(t, 'localTime'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::timestamp::time as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "12:34:56",
          ]
        `)
    })
    */

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
})
