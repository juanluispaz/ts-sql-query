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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when raw_to_uuid(external_ref) is null then null else raw_to_uuid(external_ref) || :0 end as "result" from issue where id = :1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when raw_to_uuid(external_ref) is null then null else raw_to_uuid(external_ref) || :0 end as "result" from issue where id = :1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when raw_to_uuid(external_ref) is null then null else raw_to_uuid(external_ref) || :0 end as "result" from issue where id = :1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when raw_to_uuid(external_ref) is null then null else raw_to_uuid(external_ref) || :0 end as "result" from issue where id = :1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title || :0 as "result" from issue where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "-x",
            1,
          ]
        `)
        assertType<Exact<typeof value, string>>()
        expect(value).toEqual(expected)
    })
})
