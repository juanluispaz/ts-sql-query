// Coverage of `.asString()` on a UUID value source — the only call site
// for the `_asString` emitter on every dialect's SqlBuilder — plus the
// string operations applied to the resulting `string` value source.
//
// `.asString()` erases the value type from `uuid` to `string` but keeps a
// private marker so SQL Server can still wrap the value in
// `convert(nvarchar(36), …)` wherever a `uniqueidentifier` would otherwise be
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
import { tIssue, tProjectRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'

const UUID_VALUE = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const REF1 = '0a8f9c1e-1111-4222-8333-444455556666' // issue 1
const REF2 = '7b3e9d20-2222-4c55-9b66-dddd00009999' // issue 2
const SIGNING_KEY1 = '0a8f9c1e-1111-4222-8333-444455556666' // release 1
const SIGNING_KEY3 = '7b3e9d20-2222-4c55-9b66-dddd00009999' // release 3

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "f47ac10b-58cc-4372-a567-0e02b2c3d479",
          ]
        `)
        expect(result).toBe(UUID_VALUE)
    })

    test('uuid-asString-on-column', async () => {
        ctx.mockNext(REF1)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.externalRef.asString())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select external_ref as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof ref, string | null>>()
        expect(ref).toEqual(REF1)
    })

    test('uuid-asString-concat', async () => {
        // The receiver and the argument are both uuid-derived strings, so
        // both operand positions of the concat get the SQL Server convert.
        const expected = REF1 + REF1
        ctx.mockNext(expected)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.externalRef.asString().concat(tIssue.externalRef.asString()))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select concat(external_ref, external_ref) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof ref, string | null>>()
        expect(ref).toEqual(expected)
    })

    test('uuid-asString-trim', async () => {
        ctx.mockNext(REF1)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.externalRef.asString().trim())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select trim(external_ref) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof ref, string | null>>()
        expect(ref).toEqual(REF1)
    })

    test('uuid-asString-substring', async () => {
        const expected = REF1.substring(0, 8)
        ctx.mockNext(expected)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.externalRef.asString().substring(0, 8))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select substr(external_ref, ?, ?) as result from issue where id = ?"`)
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

    test('uuid-asString-valueWhenNull-fallback', async () => {
        // Issue 3 has a NULL external_ref; the uuid-derived receiver falls
        // back to the placeholder. Exercises the receiver-side convert.
        ctx.mockNext('(no ref)')
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .selectOneColumn(tIssue.externalRef.asString().valueWhenNull('(no ref)'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ifnull(external_ref, ?) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "(no ref)",
            3,
          ]
        `)
        assertType<Exact<typeof ref, string>>()
        expect(ref).toEqual('(no ref)')
    })

    test('uuid-asString-as-valueWhenNull-value', async () => {
        // Issue 1 has a NULL body, so the uuid-derived fallback value wins.
        // Exercises the argument-side convert of valueWhenNull.
        ctx.mockNext(REF1)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.body.valueWhenNull(tIssue.externalRef.asString()))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ifnull(\`body\`, external_ref) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof ref, string | null>>()
        expect(ref).toEqual(REF1)
    })

    test('uuid-asString-stringConcat', async () => {
        // Aggregates the two seeded refs of project 1. The aggregate is
        // unordered, so the value assertion split-and-sorts.
        const expected = [REF1, REF2]
        ctx.mockNext(expected.join(','))
        const refs = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .selectOneColumn(ctx.conn.stringConcat(tIssue.externalRef.asString(), ','))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select group_concat(external_ref separator ?) as result from issue where project_id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            ",",
            1,
          ]
        `)
        assertType<Exact<typeof refs, string | null>>()
        expect(refs!.split(',').sort()).toEqual([...expected].sort())
    })

    test('uuid-asString-stringConcatDistinct', async () => {
        // Same as stringConcat but DISTINCT. Project 1's two refs are
        // already distinct, so the split-and-sort assertion is unchanged.
        const expected = [REF1, REF2]
        ctx.mockNext(expected.join(','))
        const refs = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .selectOneColumn(ctx.conn.stringConcatDistinct(tIssue.externalRef.asString(), ','))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select group_concat(distinct external_ref separator ?) as result from issue where project_id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            ",",
            1,
          ]
        `)
        assertType<Exact<typeof refs, string | null>>()
        expect(refs!.split(',').sort()).toEqual([...expected].sort())
    })

    test('uuid-asString-startsWithInsensitive', async () => {
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().startsWithInsensitive('0A8F'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where lower(external_ref) like concat(lower(?), '%') order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where lower(external_ref) not like concat(lower(?), '%') order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where lower(external_ref) like concat('%', lower(?)) order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where lower(external_ref) not like concat('%', lower(?)) order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where lower(external_ref) like concat('%', lower(?), '%') order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where lower(external_ref) not like concat('%', lower(?), '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "beef",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('uuid-asString-in-typed-fragment', async () => {
        const expected = REF1.toUpperCase()
        ctx.mockNext(expected)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(ctx.conn.fragmentWithType('string', 'required').sql`upper(${tIssue.externalRef.asString()})`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select upper(external_ref) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof ref, string>>()
        expect(ref).toEqual(expected)
    })

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select upper(external_ref) as ref_upper,  id as id from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with w_uuid as (select external_ref as ref from issue where id = ?) select concat(ref, ?) as result from w_uuid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "-x",
          ]
        `)
        assertType<Exact<typeof ref, string | null>>()
        expect(ref).toEqual(expected)
    })
    test('customuuid-asString-on-optional-column', async () => {
        // `.asString()` on a branded `customUuid` column erases both the brand
        // and the uuid value type to a plain `string`. `signing_key` is optional,
        // so the single-column select resolves to `string | null`. Release 1
        // carries a signing key.
        ctx.mockNext(SIGNING_KEY1)
        const key = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(tProjectRelease.signingKey.asString())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select signing_key as result from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof key, string | null>>()
        expect(key).toEqual(SIGNING_KEY1)
    })

    test('customuuid-comparison-surface-in-where', async () => {
        // notEquals / in on an equality-only `customUuid` column filter the
        // rows. Release 3's signing key matches the IN list and differs from
        // release 1's key.
        const expected = [{ id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.notEquals(SIGNING_KEY1))
              .and(tProjectRelease.signingKey.in([SIGNING_KEY3]))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signing_key <> ? and signing_key in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
            "7b3e9d20-2222-4c55-9b66-dddd00009999",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('uuid-receiver-value-when-null-literal-on-null-row', async () => {
        // `valueWhenNull(literal)` on the UUID receiver directly (NOT via
        // `.asString()`) — the redefined uuid overload, result required.
        // Issue 3 has a NULL external_ref → the literal uuid fallback wins.
        ctx.mockNext(UUID_VALUE)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .selectOneColumn(tIssue.externalRef.valueWhenNull(UUID_VALUE))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ifnull(external_ref, ?) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "f47ac10b-58cc-4372-a567-0e02b2c3d479",
            3,
          ]
        `)
        assertType<Exact<typeof ref, string>>()
        expect(ref).toEqual(UUID_VALUE)
    })

    test('uuid-receiver-null-if-value-literal', async () => {
        // `nullIfValue(literal)` on the UUID receiver directly — the redefined
        // uuid overload, result optional. Issue 2's ref (REF2) ≠ the probe
        // (REF1), so the value is kept.
        ctx.mockNext(REF2)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .selectOneColumn(tIssue.externalRef.nullIfValue(REF1))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select nullif(external_ref, ?) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
            2,
          ]
        `)
        assertType<Exact<typeof ref, string | null>>()
        expect(ref).toEqual(REF2)
    })

    test('custom-uuid-receiver-null-if-value-literal', async () => {
        // `nullIfValue(literal)` on the CustomUuid receiver (signingKey /
        // 'SigningKey') directly — result optional. Release 1's signing key
        // (SIGNING_KEY1) ≠ the probe (SIGNING_KEY3), so the value is kept.
        ctx.mockNext(SIGNING_KEY1)
        const key = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(tProjectRelease.signingKey.nullIfValue(SIGNING_KEY3))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select nullif(signing_key, ?) as result from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "7b3e9d20-2222-4c55-9b66-dddd00009999",
            1,
          ]
        `)
        assertType<Exact<typeof key, string | null>>()
        expect(key).toEqual(SIGNING_KEY1)
    })

    test('custom-uuid-receiver-value-when-null-literal-on-null-row', async () => {
        // `valueWhenNull(literal)` on the CustomUuid receiver directly —
        // result required. Release 2 has a NULL signing_key → the literal
        // fallback wins.
        ctx.mockNext(UUID_VALUE)
        const key = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(2))
            .selectOneColumn(tProjectRelease.signingKey.valueWhenNull(UUID_VALUE))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ifnull(signing_key, ?) as result from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "f47ac10b-58cc-4372-a567-0e02b2c3d479",
            2,
          ]
        `)
        assertType<Exact<typeof key, string>>()
        expect(key).toEqual(UUID_VALUE)
    })

    test('custom-uuid-receiver-value-when-null-optional-value-source', async () => {
        // `valueWhenNull(optional value source)` on the CustomUuid receiver: the
        // optional VS default keeps the result optional. The default is
        // `.asOptional()` on the same column, present at runtime. Release 1's
        // signing_key is non-null.
        ctx.mockNext(REF1)
        const key = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(tProjectRelease.signingKey.valueWhenNull(tProjectRelease.signingKey.asOptional()))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ifnull(signing_key, signing_key) as result from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof key, string | null>>()
        expect(key).toEqual(REF1)
    })
})
