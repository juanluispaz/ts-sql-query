// Coverage of the three FragmentFunction factories exposed
// via the protected `buildFragmentWithArgs`, `buildFragmentWithArgsIfValue`
// and `buildFragmentWithMaybeOptionalArgs` builders. Each returns a
// dispatcher `(...args) => AnyValueSource` whose body lives
//
// The three dispatchers expose different branches:
//   - `FragmentFunctionBuilder.as` — coerces literal args via
//     `SqlOperationConstValueSource`; passes `ValueSource` args
//     through unchanged.
//   - `FragmentFunctionBuilderIfValue.as` — same, plus the
//     value+optional + `_isValue` check that short-circuits to
//     `SqlOperationValueSourceIfValueAlwaysNoop` when the arg is
//     present but rejected by `_isValue`.
//   - `FragmentFunctionBuilderMaybeOptional.as` — coerces args while
//     tracking the merged `optionalType` (via `__mergeOptional`
//     and stamps the merged value on the result.
//
// The factories are `protected` on the connection so the canonical
// way to expose them — see [docs/queries/sql-fragments.md](../../../../../docs/queries/sql-fragments.md)
// — is to declare them as fields on the application's connection
// subclass. The shared
// [`DBConnection`](../../domain/connection.ts) carries `intLeftShift`,
// `intEqualsIfValue` and `intPlus` for exactly that purpose, so the
// test uses `ctx.conn.intLeftShift(...)` directly with no extra
// scaffolding.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('build-fragment-with-args-coerces-int-literals', async () => {
        // Both args are literal numbers → both coerce to
        // SqlOperationConstValueSource. SQL must contain bound
        // placeholders for each.
        ctx.mockNext([{ r: 20 }])
        const rows = await ctx.conn.selectFromNoTable()
            .select({ r: ctx.conn.intLeftShift(5, 2) })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int << $2::int as "r""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ r: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual([{ r: 20 }])
        else expect(rows[0]!.r).toBe(20)
    })

    test('build-fragment-with-args-passes-value-source-through', async () => {
        // ValueSource args bypass coercion. `ctx.conn.const(...)`
        // returns a ValueSource → it lands in `impl` unchanged.
        ctx.mockNext([{ r: 16 }])
        const rows = await ctx.conn.selectFromNoTable()
            .select({ r: ctx.conn.intLeftShift(ctx.conn.const(4, 'int'), ctx.conn.const(2, 'int')) })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int << $2::int as "r""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
            2,
          ]
        `)
        if (!ctx.realDbEnabled) expect(rows).toEqual([{ r: 16 }])
        else expect(rows[0]!.r).toBe(16)
    })

    test('build-fragment-with-args-if-value-emits-when-value-present', async () => {
        // First arg literal 1 (required → coerce). Second arg is
        // valueArg+optional → `_isValue(2) = true` → coerce and
        // dispatch normally. The fragment is used in WHERE which is
        // the canonical surface for IfValue fragments.
        ctx.mockNext([{ x: 1 }])
        await ctx.conn.selectFromNoTable()
            .select({ x: ctx.conn.const(1, 'int') })
            .where(ctx.conn.intEqualsIfValue(1, 2))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int4 as "x" where $2 = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            2,
          ]
        `)
    })

    test('build-fragment-with-args-if-value-short-circuits-noop-on-undefined', async () => {
        // First arg literal 1 (required). Second arg is `undefined`
        // — `_isValue(undefined)` returns false → the dispatcher
        // returns `SqlOperationValueSourceIfValueAlwaysNoop()`, a
        // sentinel boolean ValueSource. Used in WHERE it drops the
        // entire clause from the emitted SQL. The plain SELECT that
        // remains is valid in every dialect, so this test runs in
        // both mock and real modes.
        ctx.mockNext([{ x: 1 }])
        await ctx.conn.selectFromNoTable()
            .select({ x: ctx.conn.const(1, 'int') })
            .where(ctx.conn.intEqualsIfValue(1, undefined))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int4 as "x""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })

    test('build-fragment-with-maybe-optional-args-coerces-and-merges-optional', async () => {
        // Both args are present literals → each coerces to `required`.
        // The result inherits the merged `optionalType = required`.
        // The snapshot pins the emission.
        ctx.mockNext([{ r: 7 }])
        const rows = await ctx.conn.selectFromNoTable()
            .select({ r: ctx.conn.intPlus(3, 4) })
            .executeSelectMany()
        // A5: both args present → MergeOptionalUnion collapses to required.
        assertType<Exact<typeof rows, Array<{ r: number }>>>()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int + $2::int as "r""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            4,
          ]
        `)
        expect(rows).toEqual([{ r: 7 }]) // 3 + 4
    })

    test('build-fragment-with-maybe-optional-args-tracks-optional-on-undefined', async () => {
        // Passing `undefined` to an optional arg makes
        // `_isValue(undefined)` false → that arg's argOptionalType is
        // marked `optional`. The result inherits `__mergeOptional`'s
        // computation over both args.
        ctx.mockNext([{ r: null }])
        const rows = await ctx.conn.selectFromNoTable()
            .select({ r: ctx.conn.intPlus(undefined, 5) })
            .executeSelectMany()
        // A5: one arg undefined → MergeOptionalUnion degrades to optional.
        assertType<Exact<typeof rows, Array<{ r?: number | undefined }>>>()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int + $2::int as "r""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
            5,
          ]
        `)
        // The merged optionalType degraded to `optional`, so projecting
        // a NULL (NULL + 5 = NULL) yields the column as `undefined`
        // instead of throwing MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE.
        expect(rows).toEqual([{ r: undefined }])
    })

    test('build-fragment-with-maybe-optional-args-reads-optional-from-value-source-argument', async () => {
        // A5: the maybe-optional result optionality can come from a VALUE-SOURCE
        // argument's optionalType, not only from a present/absent literal.
        // `conn.const(3,'int')` is required, `tIssue.assigneeId` is optional →
        // MergeOptionalUnion yields an optional result. Row id=1 has
        // assignee_id=1, so r = 3 + 1 = 4.
        const expected = [{ r: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ r: ctx.conn.intPlus(ctx.conn.const(3, 'int'), tIssue.assigneeId) })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int + assignee_id::int as "r" from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ r?: number | undefined }>>>()
        expect(rows).toEqual(expected)
    })
    test('build-fragment-with-args-arity-1-over-bigint-arg', async () => {
        // A 1-ary `buildFragmentWithArgs` whose single arg is a `bigint` —
        // exercises the bigint arg coercion. abs(-5) = 5n.
        ctx.mockNext([{ r: 5n }])
        const rows = await ctx.conn.selectFromNoTable()
            .select({ r: ctx.conn.bigintAbs(-5n) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select abs($1::int8) as "r""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            -5n,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ r: bigint }>>>()
        expect(rows).toEqual([{ r: 5n }])
    })

    test('build-fragment-with-args-if-value-arity-1-emits-when-present', async () => {
        // A 1-ary `buildFragmentWithArgsIfValue` over a `valueArg`. Value 5 is
        // present -> `_isValue` true -> the predicate is emitted.
        ctx.mockNext([{ x: 1 }])
        await ctx.conn.selectFromNoTable()
            .select({ x: ctx.conn.const(1, 'int') })
            .where(ctx.conn.intIsPositiveIfValue(5))
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int4 as "x" where $2::int > 0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            5,
          ]
        `)
    })

    test('build-fragment-with-args-if-value-arity-1-skips-on-undefined', async () => {
        // The same 1-ary IfValue with `undefined` -> `_isValue` false -> the
        // whole predicate drops, leaving a bare valid SELECT.
        ctx.mockNext([{ x: 1 }])
        await ctx.conn.selectFromNoTable()
            .select({ x: ctx.conn.const(1, 'int') })
            .where(ctx.conn.intIsPositiveIfValue(undefined))
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int4 as "x""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })

    test('build-fragment-with-maybe-optional-args-arity-3-over-string', async () => {
        // A 3-ary `buildFragmentWithMaybeOptionalArgs` over `string` args. The
        // middle arg is `undefined` -> bound NULL and the merged optionalType
        // degrades to optional; coalesce('a', NULL, 'c') = 'a'.
        ctx.mockNext([{ r: 'a' }])
        const rows = await ctx.conn.selectFromNoTable()
            .select({ r: ctx.conn.coalesce3('a', undefined, 'c') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select coalesce($1, $2, $3) as "r""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a",
            null,
            "c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ r?: string | undefined }>>>()
        expect(rows).toEqual([{ r: 'a' }])
    })
})
