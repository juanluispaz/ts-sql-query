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
import { tIssue, tIssueWorklog, tProjectRelease } from '../../domain/connection.js'
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? << ? as "r""`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? << ? as "r""`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "x" where ? = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "x""`)
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
        // both args present → MergeOptionalUnion collapses to required.
        assertType<Exact<typeof rows, Array<{ r: number }>>>()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? + ? as "r""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            4,
          ]
        `)
        // 3 + 4 = 7 on the real engine and the primed mock alike.
        expect(rows).toEqual([{ r: 7 }])
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
        // one arg undefined → MergeOptionalUnion degrades to optional.
        assertType<Exact<typeof rows, Array<{ r?: number | undefined }>>>()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? + ? as "r""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
            5,
          ]
        `)
        // result projection is shaped by the merged optionalType — if
        // it stayed `required`, projecting null would have thrown
        // MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE. Reaching this
        // point means the merge correctly degraded to optional. On the
        // real engine `NULL + 5` is NULL, which the optional projector
        // surfaces as undefined/null; the row still exists either way.
        expect(rows).toHaveLength(1)
        expect(rows[0]!.r ?? null).toBeNull()
    })

    test('build-fragment-with-maybe-optional-args-reads-optional-from-value-source-argument', async () => {
        // the maybe-optional result optionality can come from a VALUE-SOURCE
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? + assignee_id as "r" from issue where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select abs(?) as "r""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            -5,
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "x" where ? > 0"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "x""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select coalesce(?, ?, ?) as "r""`)
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

    // ── buildFragmentWithArgs at arities 3 and 5 ──
    test('args-arity-3-coalesce', async () => {
        ctx.mockNext([{ r: 'a' }])
        const rows = await ctx.conn.selectFromNoTable()
            .select({ r: ctx.conn.frag3Args('a', 'b', 'c') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select coalesce(?, ?, ?) as "r""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a",
            "b",
            "c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ r: string }>>>()
        expect(rows).toEqual([{ r: 'a' }])
    })

    test('args-arity-5-coalesce', async () => {
        ctx.mockNext([{ r: 'a' }])
        const rows = await ctx.conn.selectFromNoTable()
            .select({ r: ctx.conn.frag5Args('a', 'b', 'c', 'd', 'e') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select coalesce(?, ?, ?, ?, ?) as "r""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a",
            "b",
            "c",
            "d",
            "e",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ r: string }>>>()
        expect(rows).toEqual([{ r: 'a' }])
    })

    // ── buildFragmentWithArgsIfValue at arities 0, 3, 4, 5 ──
    test('args-if-value-arity-0-constant-predicate', async () => {
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.frag0IfValue())
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where 1 = 1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('args-if-value-arity-3-emits-when-present', async () => {
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.frag3IfValue('z', 'y', 'z'))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where coalesce(?, ?) = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "z",
            "y",
            "z",
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('args-if-value-arity-3-skips-on-undefined', async () => {
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.frag3IfValue('z', 'y', undefined))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('args-if-value-arity-4-emits-when-present', async () => {
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.frag4IfValue('z', 'y', 'x', 'z'))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where coalesce(?, ?, ?) = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "z",
            "y",
            "x",
            "z",
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('args-if-value-arity-5-emits-when-present', async () => {
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.frag5IfValue('z', 'y', 'x', 'w', 'z'))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where coalesce(?, ?, ?, ?) = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "z",
            "y",
            "x",
            "w",
            "z",
          ]
        `)
        expect(rows).toEqual(expected)
    })

    // ── buildFragmentWithMaybeOptionalArgs at arities 0, 4, 5 ──
    test('maybe-optional-args-arity-0-constant', async () => {
        ctx.mockNext([{ r: 42 }])
        const rows = await ctx.conn.selectFromNoTable()
            .select({ r: ctx.conn.frag0MaybeOptional() })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select 42 as "r""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ r: number }>>>()
        expect(rows).toEqual([{ r: 42 }])
    })

    test('maybe-optional-args-arity-4-coalesce', async () => {
        ctx.mockNext([{ r: 'a' }])
        const rows = await ctx.conn.selectFromNoTable()
            .select({ r: ctx.conn.frag4MaybeOptional('a', undefined, 'c', 'd') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select coalesce(?, ?, ?, ?) as "r""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a",
            null,
            "c",
            "d",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ r?: string | undefined }>>>()
        expect(rows).toEqual([{ r: 'a' }])
    })

    test('maybe-optional-args-arity-5-coalesce', async () => {
        ctx.mockNext([{ r: 'a' }])
        const rows = await ctx.conn.selectFromNoTable()
            .select({ r: ctx.conn.frag5MaybeOptional('a', undefined, 'c', 'd', 'e') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select coalesce(?, ?, ?, ?, ?) as "r""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a",
            null,
            "c",
            "d",
            "e",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ r?: string | undefined }>>>()
        expect(rows).toEqual([{ r: 'a' }])
    })

    // ── buildAggregateFragmentWithArgs at arities 0, 2-5 (over issue 1) ──
    test('aggregate-args-arity-0-count', async () => {
        ctx.mockNext(1)
        const r = await ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1))
            .selectOneColumn(ctx.conn.agg0Count()).executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof r, number>>()
        expect(r).toBe(1)
    })

    test('aggregate-args-arity-2-sum', async () => {
        ctx.mockNext(3)
        const r = await ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1))
            .selectOneColumn(ctx.conn.agg2Sum(tIssue.priority, tIssue.id)).executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(priority + id) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof r, number>>()
        expect(r).toBe(3)
    })

    test('aggregate-args-arity-3-sum', async () => {
        ctx.mockNext(4)
        const r = await ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1))
            .selectOneColumn(ctx.conn.agg3Sum(tIssue.priority, tIssue.id, tIssue.number)).executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(priority + id + number) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof r, number>>()
        expect(r).toBe(4)
    })

    test('aggregate-args-arity-4-sum', async () => {
        ctx.mockNext(5)
        const r = await ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1))
            .selectOneColumn(ctx.conn.agg4Sum(tIssue.priority, tIssue.id, tIssue.number, tIssue.projectId)).executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(priority + id + number + project_id) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof r, number>>()
        expect(r).toBe(5)
    })

    test('aggregate-args-arity-5-sum', async () => {
        ctx.mockNext(7)
        const r = await ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1))
            .selectOneColumn(ctx.conn.agg5Sum(tIssue.priority, tIssue.id, tIssue.number, tIssue.projectId, tIssue.priority)).executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(priority + id + number + project_id + priority) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof r, number>>()
        expect(r).toBe(7)
    })

    // ── buildAggregateFragmentWithMaybeOptionalArgs at arities 0, 2-5 ──
    test('aggregate-maybe-optional-arity-0-count', async () => {
        ctx.mockNext(1)
        const r = await ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1))
            .selectOneColumn(ctx.conn.aggMO0Count()).executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof r, number>>()
        expect(r).toBe(1)
    })

    test('aggregate-maybe-optional-arity-2-max', async () => {
        ctx.mockNext(3)
        const r = await ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1))
            .selectOneColumn(ctx.conn.aggMO2Max(tIssue.priority, tIssue.id)).executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(priority + id) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof r, number>>()
        expect(r).toBe(3)
    })

    test('aggregate-maybe-optional-arity-3-max', async () => {
        ctx.mockNext(4)
        const r = await ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1))
            .selectOneColumn(ctx.conn.aggMO3Max(tIssue.priority, tIssue.id, tIssue.number)).executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(priority + id + number) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof r, number>>()
        expect(r).toBe(4)
    })

    test('aggregate-maybe-optional-arity-4-max', async () => {
        ctx.mockNext(5)
        const r = await ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1))
            .selectOneColumn(ctx.conn.aggMO4Max(tIssue.priority, tIssue.id, tIssue.number, tIssue.projectId)).executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(priority + id + number + project_id) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof r, number>>()
        expect(r).toBe(5)
    })

    test('aggregate-maybe-optional-arity-5-max', async () => {
        ctx.mockNext(7)
        const r = await ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1))
            .selectOneColumn(ctx.conn.aggMO5Max(tIssue.priority, tIssue.id, tIssue.number, tIssue.projectId, tIssue.priority)).executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(priority + id + number + project_id + priority) as result from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof r, number>>()
        expect(r).toBe(7)
    })

    // ── buildAggregateFragmentWithArgsIfValue (used in HAVING,
    // the canonical surface for aggregate IfValue predicates) ──
    test('aggregate-if-value-arity-0-predicate', async () => {
        const expected = [{ pid: 1 }, { pid: 2 }, { pid: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({ pid: tIssue.projectId }).groupBy('pid')
            .having(ctx.conn.aggIV0Predicate()).orderBy('pid').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid from issue group by project_id having count(*) > 0 order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('aggregate-if-value-arity-1-count', async () => {
        const expected = [{ pid: 1 }, { pid: 2 }, { pid: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({ pid: tIssue.projectId }).groupBy('pid')
            .having(ctx.conn.aggIV1Count(0)).orderBy('pid').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid from issue group by project_id having count(*) > ? order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('aggregate-if-value-arity-3-sum', async () => {
        const expected = [{ pid: 1 }, { pid: 2 }, { pid: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({ pid: tIssue.projectId }).groupBy('pid')
            .having(ctx.conn.aggIV3Sum(tIssue.priority, tIssue.id, 0)).orderBy('pid').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid from issue group by project_id having sum(priority + id) > ? order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('aggregate-if-value-arity-4-sum', async () => {
        const expected = [{ pid: 1 }, { pid: 2 }, { pid: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({ pid: tIssue.projectId }).groupBy('pid')
            .having(ctx.conn.aggIV4Sum(tIssue.priority, tIssue.id, tIssue.number, 0)).orderBy('pid').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid from issue group by project_id having sum(priority + id + number) > ? order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('aggregate-if-value-arity-5-sum', async () => {
        const expected = [{ pid: 1 }, { pid: 2 }, { pid: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({ pid: tIssue.projectId }).groupBy('pid')
            .having(ctx.conn.aggIV5Sum(tIssue.priority, tIssue.id, tIssue.number, tIssue.projectId, 0)).orderBy('pid').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid from issue group by project_id having sum(priority + id + number + project_id) > ? order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    // ── arg / valueArg keyword arms (column = literal, column context) ──
    test('arg-keyword-double', async () => {
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.doubleEq(tIssue.estimatedHours, 2.5))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2.5,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('arg-keyword-custom-comparable', async () => {
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.customComparableEq(tProjectRelease.version, '1.2.0'))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where version = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.2.0",
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('arg-keyword-custom', async () => {
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.customEq(tProjectRelease.channel, 'stable'))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where channel = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "stable",
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('arg-keyword-enum', async () => {
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.enumEq(tIssueWorklog.activity, 'coding'))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where activity = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "coding",
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('arg-keyword-custom-uuid', async () => {
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.customUuidEq(tProjectRelease.signingKey, '0a8f9c1e-1111-4222-8333-444455556666'))
            .select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signing_key = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('arg-keyword-boolean', async () => {
        // The fragment ORs the boolean column
        // with the boolean value (condition context), so the library's boolean
        // emulation renders each operand as a predicate and the SQL is portable
        // even on engines with no native boolean. `billable OR true` is true for
        // every worklog.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.booleanOrFragment(tIssueWorklog.billable, true))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billable or ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        expect(rows).toEqual(expected)
    })
})
