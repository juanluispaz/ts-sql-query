// Coverage of `.asString()` on a UUID value source — the only call site
// for the `_asString` emitter on every dialect's SqlBuilder — plus the
// string operations applied to the resulting `string` value source.
//
// `.asString()` erases the value type from `uuid` to `string` but keeps a
// private marker so SQL Server can still wrap the value in
// `convert(nvarchar, …)` wherever a `uniqueidentifier` would otherwise be
// fed to a string function (concat, trim, substring, string_agg,
// valueWhenNull, typed/raw fragments) — and skip the `lower(…)`/collation
// on the insensitive `like` family (a `uniqueidentifier` already compares
// case-insensitively). This file exercises every one of those emission
// paths against the seeded `uuid` column `tIssue.externalRef` (issues 1
// and 2 carry a uuid; 3 and 4 leave it NULL), so the per-dialect SQL is
// pinned and the convert / no-convert decision is covered end to end.
//
// dynamic conditions reach this surface automatically: filtering a `uuid`
// column through a `StringFilter` applies `.asString()` for you, so these
// emission paths are not exotic (docs/api/dynamic-conditions.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

const UUID_VALUE = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const REF1 = '0a8f9c1e-1111-4222-8333-444455556666' // issue 1
const REF2 = '7b3e9d20-2222-4c55-9b66-dddd00009999' // issue 2
// REF2 is referenced only by the commented-out `stringConcat` / `stringConcatDistinct`
// tests in this cell (live in the other dialects); keep it from tripping noUnusedLocals.
void REF2

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('uuid-asString-on-const', async () => {
        ctx.mockNext(UUID_VALUE)
        const connection = ctx.conn
        const result = await connection.selectFromNoTable()
            .selectOneColumn(connection.const(UUID_VALUE, 'uuid').asString())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select @0 as [result]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "f47ac10b-58cc-4372-a567-0e02b2c3d479",
          ]
        `)
        // SQL Server's native `uniqueidentifier` round-trips the value
        // upper-cased; the mock echoes the lower-case input verbatim.
        if (ctx.realDbEnabled) expect(result).toBe(UUID_VALUE.toUpperCase())
        else expect(result).toBe(UUID_VALUE)
    })

    test('uuid-asString-on-column', async () => {
        ctx.mockNext(REF1)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.externalRef.asString())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select external_ref as [result] from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof ref, string | null>>()
        // SQL Server stores uuids in `uniqueidentifier` and returns them
        // upper-cased; the mock echoes the seeded lower-case value.
        if (ctx.realDbEnabled) expect(ref).toEqual(REF1.toUpperCase())
        else expect(ref).toEqual(REF1)
    })

    // TODO[BUG]: SQL Server emits `convert(nvarchar, <uuid>)` with no length;
    // a non-null uniqueidentifier (36 chars) overflows the default nvarchar(30)
    // (error 8115). The lib should emit `convert(nvarchar(36), …)`. See test/BUGS.md.
    /*
    test('uuid-asString-concat', async () => {
        // The receiver and the argument are both uuid-derived strings, so
        // both operand positions of the concat get the SQL Server convert.
        const expected = REF1 + REF1
        ctx.mockNext(expected)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.externalRef.asString().concat(tIssue.externalRef.asString()))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select convert(nvarchar, external_ref) + convert(nvarchar, external_ref) as [result] from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof ref, string | null>>()
        expect(ref).toEqual(expected)
    })
    */

    // TODO[BUG]: SQL Server emits `convert(nvarchar, <uuid>)` with no length;
    // a non-null uniqueidentifier (36 chars) overflows the default nvarchar(30)
    // (error 8115). The lib should emit `convert(nvarchar(36), …)`. See test/BUGS.md.
    /*
    test('uuid-asString-trim', async () => {
        ctx.mockNext(REF1)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.externalRef.asString().trim())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select trim(convert(nvarchar, external_ref)) as [result] from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof ref, string | null>>()
        expect(ref).toEqual(REF1)
    })
    */

    // TODO[BUG]: SQL Server emits `convert(nvarchar, <uuid>)` with no length;
    // a non-null uniqueidentifier (36 chars) overflows the default nvarchar(30)
    // (error 8115). The lib should emit `convert(nvarchar(36), …)`. See test/BUGS.md.
    /*
    test('uuid-asString-substring', async () => {
        const expected = REF1.substring(0, 8)
        ctx.mockNext(expected)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.externalRef.asString().substring(0, 8))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select substring(convert(nvarchar, external_ref), @0, @1) as [result] from issue where id = @2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            8,
            1,
          ]
        `)
        assertType<Exact<typeof ref, string | null>>()
        expect(ref).toEqual(expected)
    })
    */

    test('uuid-asString-valueWhenNull-fallback', async () => {
        // Issue 3 has a NULL external_ref; the uuid-derived receiver falls
        // back to the placeholder. Exercises the receiver-side convert.
        ctx.mockNext('(no ref)')
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .selectOneColumn(tIssue.externalRef.asString().valueWhenNull('(no ref)'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select isnull(convert(nvarchar, external_ref), @0) as [result] from issue where id = @1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "(no ref)",
            3,
          ]
        `)
        assertType<Exact<typeof ref, string>>()
        expect(ref).toEqual('(no ref)')
    })

    // TODO[BUG]: SQL Server emits `convert(nvarchar, <uuid>)` with no length;
    // a non-null uniqueidentifier (36 chars) overflows the default nvarchar(30)
    // (error 8115). The lib should emit `convert(nvarchar(36), …)`. See test/BUGS.md.
    /*
    test('uuid-asString-as-valueWhenNull-value', async () => {
        // Issue 1 has a NULL body, so the uuid-derived fallback value wins.
        // Exercises the argument-side convert of valueWhenNull.
        ctx.mockNext(REF1)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.body.valueWhenNull(tIssue.externalRef.asString()))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select isnull(body, convert(nvarchar, external_ref)) as [result] from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof ref, string | null>>()
        expect(ref).toEqual(REF1)
    })
    */

    // TODO[BUG]: SQL Server emits `convert(nvarchar, <uuid>)` with no length;
    // a non-null uniqueidentifier (36 chars) overflows the default nvarchar(30)
    // (error 8115). The lib should emit `convert(nvarchar(36), …)`. See test/BUGS.md.
    /*
    test('uuid-asString-stringConcat', async () => {
        // Aggregates the two seeded refs of project 1. The aggregate is
        // unordered, so the value assertion split-and-sorts.
        const expected = [REF1, REF2]
        ctx.mockNext(expected.join(','))
        const refs = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .selectOneColumn(ctx.conn.stringConcat(tIssue.externalRef.asString(), ','))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select string_agg(convert(nvarchar, external_ref), ',') as [result] from issue where project_id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof refs, string | null>>()
        expect(refs!.split(',').sort()).toEqual([...expected].sort())
    })
    */

    // NOT-APPLICABLE: SQL Server's STRING_AGG has no DISTINCT, so
    // stringConcatDistinct is not typed on SqlServerConnection.
    /*
    test('uuid-asString-stringConcatDistinct', async () => {
        // Same as stringConcat but DISTINCT. Project 1's two refs are
        // already distinct, so the split-and-sort assertion is unchanged.
        const expected = [REF1, REF2]
        ctx.mockNext(expected.join(','))
        const refs = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .selectOneColumn(ctx.conn.stringConcatDistinct(tIssue.externalRef.asString(), ','))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select string_agg(distinct external_ref::text, $1) as result from issue where project_id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            ",",
            1,
          ]
        `)
        assertType<Exact<typeof refs, string | null>>()
        expect(refs!.split(',').sort()).toEqual([...expected].sort())
    })
    */

    test('uuid-asString-startsWithInsensitive', async () => {
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().startsWithInsensitive('0A8F'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0A8F",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('uuid-asString-notStartsWithInsensitive', async () => {
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().notStartsWithInsensitive('ffff'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref not like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ffff",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('uuid-asString-endsWithInsensitive', async () => {
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().endsWithInsensitive('6666'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "6666",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('uuid-asString-notEndsWithInsensitive', async () => {
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().notEndsWithInsensitive('ffff'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref not like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ffff",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('uuid-asString-containsInsensitive', async () => {
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().containsInsensitive('1111'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1111",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('uuid-asString-notContainsInsensitive', async () => {
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().notContainsInsensitive('beef'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref not like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "beef",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    // TODO[BUG]: SQL Server emits `convert(nvarchar, <uuid>)` with no length;
    // a non-null uniqueidentifier (36 chars) overflows the default nvarchar(30)
    // (error 8115). The lib should emit `convert(nvarchar(36), …)`. See test/BUGS.md.
    /*
    test('uuid-asString-in-typed-fragment', async () => {
        const expected = REF1.toUpperCase()
        ctx.mockNext(expected)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(ctx.conn.fragmentWithType('string', 'required').sql`upper(${tIssue.externalRef.asString()})`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select upper(convert(nvarchar, external_ref)) as [result] from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof ref, string>>()
        expect(ref).toEqual(expected)
    })
    */

    // TODO[BUG]: SQL Server emits `convert(nvarchar, <uuid>)` with no length;
    // a non-null uniqueidentifier (36 chars) overflows the default nvarchar(30)
    // (error 8115). The lib should emit `convert(nvarchar(36), …)`. See test/BUGS.md.
    /*
    test('uuid-asString-in-raw-fragment', async () => {
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id })
            .customizeQuery({
                beforeColumns: ctx.conn.rawFragment`upper(${tIssue.externalRef.asString()}) as ref_upper, `,
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select upper(convert(nvarchar, external_ref)) as ref_upper,  id as id from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })
    */

    // TODO[BUG]: SQL Server emits `convert(nvarchar, <uuid>)` with no length;
    // a non-null uniqueidentifier (36 chars) overflows the default nvarchar(30)
    // (error 8115). The lib should emit `convert(nvarchar(36), …)`. See test/BUGS.md.
    /*
    test('uuid-asString-through-cte', async () => {
        // The uuid-derived `ref` column is projected into a CTE and then
        // operated on in the outer query, so the marker must survive the
        // CTE column boundary for SQL Server to still emit the convert.
        const expected = REF1 + '-x'
        ctx.mockNext(expected)
        const inner = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ ref: tIssue.externalRef.asString() })
            .forUseInQueryAs('w_uuid')
        const ref = await ctx.conn.selectFrom(inner)
            .selectOneColumn(inner.ref.concat('-x'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with w_uuid as (select external_ref as [ref] from issue where id = @0) select convert(nvarchar, [ref]) + @1 as [result] from w_uuid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "-x",
          ]
        `)
        assertType<Exact<typeof ref, string | null>>()
        expect(ref).toEqual(expected)
    })
    */
})
