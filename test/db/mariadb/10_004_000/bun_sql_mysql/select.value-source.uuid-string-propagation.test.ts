// `.asString()` on a uuid column erases the value type to `string` but keeps a
// private "this came from a uuid" marker. SQL Server reads that marker to wrap
// the value in `convert(nvarchar(36), …)` whenever it would otherwise feed a
// `uniqueidentifier` to a string function — here `.concat(...)`. The marker has
// to be COPIED when the string value source is wrapped by another builder
// method; if a wrapper dropped it, SQL Server would feed the raw
// `uniqueidentifier` to `+` (via the uuid-aware branch of `_concat`) and the
// query would silently mis-compile.
//
// Each test wraps `tIssue.externalRef.asString()` with one wrapper, then applies
// `.concat('-x')` so the convert is observable in the emitted SQL. The gates use
// an OPEN condition (`allowWhen(true)` / `disallowWhen(false)`) so the query
// BUILDS and there is SQL to inspect. Values are pinned against seeded issue 1
// (external_ref REF1), compared case-insensitively because a real
// `uniqueidentifier` round-trips upper-cased on SQL Server and lower-cased
// elsewhere.
//
// A contrast test runs the same `.concat('-x')` through the same wrapper on a
// plain (non-uuid) string column (`tIssue.title`): no marker, so NO convert —
// which is what distinguishes "the marker survived" from "SQL Server always
// converts".

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

const REF1 = '0a8f9c1e-1111-4222-8333-444455556666' // issue 1 external_ref
const REF2 = '7b3e9d20-2222-4c55-9b66-dddd00009999' // issue 2 external_ref

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('uuid-string-propagation/survives-allow-when', async () => {
        // `.allowWhen(true, …)` is transparent on the allowed path; the uuid
        // marker must survive it so the downstream concat still converts.
        const expected = REF1 + '-x'
        ctx.mockNext(expected)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.externalRef.asString().allowWhen(true, 'ref gate').concat('-x'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select concat(external_ref, ?) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "-x",
            1,
          ]
        `)
        assertType<Exact<typeof ref, string | null>>()
        // Case-normalised: SQL Server round-trips a uniqueidentifier upper-cased,
        // every other engine lower-cased, and the mock echoes the seeded value —
        // so compare case-insensitively rather than branch on the backend. The
        // `convert(...)` treatment this test exists to pin is in the SQL snapshot
        // above, not in the value.
        expect((ref ?? '').toLowerCase()).toEqual(expected.toLowerCase())
    })

    test('uuid-string-propagation/survives-disallow-when', async () => {
        // `.disallowWhen(false, …)` is the twin of allowWhen(true): the inverted
        // gate is open, so the marker must survive it just the same.
        const expected = REF1 + '-x'
        ctx.mockNext(expected)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.externalRef.asString().disallowWhen(false, 'ref gate').concat('-x'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select concat(external_ref, ?) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "-x",
            1,
          ]
        `)
        assertType<Exact<typeof ref, string | null>>()
        // Case-normalised: SQL Server round-trips a uniqueidentifier upper-cased,
        // every other engine lower-cased, and the mock echoes the seeded value —
        // so compare case-insensitively rather than branch on the backend. The
        // `convert(...)` treatment this test exists to pin is in the SQL snapshot
        // above, not in the value.
        expect((ref ?? '').toLowerCase()).toEqual(expected.toLowerCase())
    })

    test('uuid-string-propagation/survives-as-optional', async () => {
        // `.asOptional()` re-wraps the source in a Noop that keeps the marker;
        // the concat still converts. Issue 1's ref is non-null.
        const expected = REF1 + '-x'
        ctx.mockNext(expected)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.externalRef.asString().asOptional().concat('-x'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select concat(external_ref, ?) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "-x",
            1,
          ]
        `)
        assertType<Exact<typeof ref, string | null>>()
        // Case-normalised: SQL Server round-trips a uniqueidentifier upper-cased,
        // every other engine lower-cased, and the mock echoes the seeded value —
        // so compare case-insensitively rather than branch on the backend. The
        // `convert(...)` treatment this test exists to pin is in the SQL snapshot
        // above, not in the value.
        expect((ref ?? '').toLowerCase()).toEqual(expected.toLowerCase())
    })

    test('uuid-string-propagation/survives-as-required-in-optional-object', async () => {
        // `.asRequiredInOptionalObject()` also re-wraps in a Noop carrying the
        // marker. On a single-column select the optionality resolves to
        // `string | null`; the concat still converts.
        const expected = REF1 + '-x'
        ctx.mockNext(expected)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.externalRef.asString().asRequiredInOptionalObject().concat('-x'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select concat(external_ref, ?) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "-x",
            1,
          ]
        `)
        assertType<Exact<typeof ref, string | null>>()
        // Case-normalised: SQL Server round-trips a uniqueidentifier upper-cased,
        // every other engine lower-cased, and the mock echoes the seeded value —
        // so compare case-insensitively rather than branch on the backend. The
        // `convert(...)` treatment this test exists to pin is in the SQL snapshot
        // above, not in the value.
        expect((ref ?? '').toLowerCase()).toEqual(expected.toLowerCase())
    })

    test('uuid-string-propagation/plain-string-through-wrapper-no-convert', async () => {
        // Contrast: the same `.allowWhen(true, …).concat('-x')` on a plain string
        // column (title) carries no uuid marker, so SQL Server emits `title + @0`
        // with NO convert. Issue 1's title is 'Update hero copy'; a plain string
        // round-trips unchanged, and the required column keeps the result required.
        const expected = 'Update hero copy-x'
        ctx.mockNext(expected)
        const value = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.title.allowWhen(true, 'title gate').concat('-x'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select concat(title, ?) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "-x",
            1,
          ]
        `)
        assertType<Exact<typeof value, string>>()
        expect(value).toEqual(expected)
    })

    test('uuid-sent-in-upper-case-is-read-back', async () => {
        // Issue 1's external reference is set to a uuid written in upper case.
        // Before MariaDB 10.7 the column is a CHAR(36), with the uuid strategy
        // 'string': the connection sends and reads the uuid in lower case, and an
        // equality with the lower-case text of the same uuid finds the row.
        const upper = 'C733575E-B5BA-400C-8803-3D3D4BBCD52F'
        const lower = 'c733575e-b5ba-400c-8803-3d3d4bbcd52f'
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const updated = await ctx.conn.update(tIssue)
                .set({ externalRef: upper })
                .where(tIssue.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set external_ref = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "c733575e-b5ba-400c-8803-3d3d4bbcd52f",
                1,
              ]
            `)
            expect(updated).toEqual(1)

            ctx.mockNext(lower)
            const readBack = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .selectOneColumn(tIssue.externalRef)
                .executeSelectOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select external_ref as result from issue where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof readBack, string | null>>()
            expect(readBack).toEqual(lower)

            ctx.mockNext(1)
            const foundId = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.externalRef.equals(lower))
                .selectOneColumn(tIssue.id)
                .executeSelectNoneOrOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from issue where external_ref = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "c733575e-b5ba-400c-8803-3d3d4bbcd52f",
              ]
            `)
            assertType<Exact<typeof foundId, number | null>>()
            expect(foundId).toEqual(1)
        })
    })

    test('uuid-column-through-cte-converts-in-outer-select-and-where', async () => {
        // The CTE projects the uuid column as it is, without `.asString()`; the
        // outer query reads it as the uuid value and filters on its text with
        // `.asString().contains('4222')`, a piece only issue 1's reference has.
        // A database that stores a uuid in a binary form converts it to its text
        // once, in the outer query, both in the projection and in the where.
        const expected = { id: 1, title: 'Update hero copy', ref: REF1 }
        ctx.mockNext(expected)
        const issueRef = ctx.conn.selectFrom(tIssue)
            .select({
                id:    tIssue.id,
                title: tIssue.title,
                ref:   tIssue.externalRef,
            })
            .forUseInQueryAs('issue_ref')
        const row = await ctx.conn.selectFrom(issueRef)
            .select({
                id:    issueRef.id,
                title: issueRef.title,
                ref:   issueRef.ref,
            })
            .where(issueRef.ref.asString().contains('4222'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with issue_ref as (select id as id, title as title, external_ref as \`ref\` from issue) select id as id, title as title, \`ref\` as \`ref\` from issue_ref where \`ref\` like concat('%', ?, '%')"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "4222",
          ]
        `)
        assertType<Exact<typeof row, { id: number, title: string, ref?: string }>>()
        expect(row).toEqual(expected)
    })

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — json_arrayagg (aggregateAsArray / JSON array projection) requires MariaDB 10.5+; earlier releases have no json_arrayagg function.
    /*
    test('uuid-column-through-cte-in-an-inline-aggregated-array', async () => {
        // The same raw uuid column of a CTE, read as the elements of an inline
        // aggregated array ordered by id. Issues 1 and 2 have an external
        // reference; issues 3 and 4 are left out by the `isNotNull` filter.
        // Each element gets the uuid text of its row, converted once.
        const expected = {
            refs: [
                { id: 1, ref: REF1 },
                { id: 2, ref: REF2 },
            ],
        }
        ctx.mockNext(expected)
        const issueRef = ctx.conn.selectFrom(tIssue)
            .select({
                id:  tIssue.id,
                ref: tIssue.externalRef,
            })
            .forUseInQueryAs('issue_ref')
        const refs = ctx.conn.selectFrom(issueRef)
            .select({
                id:  issueRef.id,
                ref: issueRef.ref,
            })
            .where(issueRef.ref.isNotNull())
            .orderBy('id')
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFromNoTable()
            .select({ refs })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with issue_ref as (select id as id, external_ref as \`ref\` from issue) select cast((select json_arrayagg(json_object('id', id, 'ref', \`ref\`) order by id) from issue_ref where \`ref\` is not null) as char) as refs"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { refs: Array<{ id: number, ref?: string }> }>>()
        expect(row).toEqual(expected)
    })
    */
})

// Tests referencing these are commented out above with NOT-SUPPORTED
// markers; keep the bindings referenced so noUnusedLocals stays green.
void REF2
