// Coverage of `onlyWhenOrNull(when)` / `ignoreWhenAsNull(when)` on
// value sources in SELECT projections. Both methods sit on every
// comparable value source
// and short-circuit at SQL-build time:
//
//   - `onlyWhenOrNull(false)` / `ignoreWhenAsNull(true)` replace the
//     value source with `NULL` in the emitted SQL.
//   - `onlyWhenOrNull(true)`  / `ignoreWhenAsNull(false)` are pure
//     pass-through — the column is emitted unchanged.
//
// Both also widen the TS-level result to `OPTIONAL`, so the projected
// property becomes absent in the optional-as-undefined shape.
//
// The boolean siblings `.onlyWhen(...)` / `.ignoreWhen(...)` on a boolean
// value source are a WHERE-clause gate instead: they drop the predicate
// entirely when the gate is not satisfied (no NULL substitution).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('onlyWhenOrNull-true-emits-column', async () => {
        // True-branch: the value source flows through untouched. The
        // TS-level type is still widened to optional because the method
        // returns `OPTIONAL` regardless of the runtime condition.
        const expected = [{ id: 1, priority: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:       tIssue.id,
                priority: tIssue.priority.onlyWhenOrNull(true),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as priority from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; priority?: number }>>>()
        expect(result).toEqual(expected)
    })

    test('onlyWhenOrNull-false-emits-null-literal', async () => {
        // False-branch: the projection is replaced with `NULL` at SQL
        // build time. No `priority` column is read. The mock returns the
        // shape the driver would return on a NULL column (the property
        // is absent in optional-as-undefined).
        ctx.mockNext([{ id: 1 }])
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:       tIssue.id,
                priority: tIssue.priority.onlyWhenOrNull(false),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, null as priority from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; priority?: number }>>>()
    })

    test('ignoreWhenAsNull-mirrors-onlyWhenOrNull-with-inverted-flag', async () => {
        // `ignoreWhenAsNull(true)` and `onlyWhenOrNull(false)` should
        // produce the same SQL — both replace the column with `NULL`.
        // We pick the `true` branch here so the snapshot is the
        // null-emitting one; the pass-through case is implied.
        ctx.mockNext([{ id: 1 }])
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:       tIssue.id,
                priority: tIssue.priority.ignoreWhenAsNull(true),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, null as priority from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; priority?: number }>>>()
    })

    test('onlyWhenOrNull-on-nullable-column-keeps-optional', async () => {
        // `body` is already optional; chaining the gate keeps it
        // optional and emits the column in the true branch.
        ctx.mockNext([{ id: 2, body: 'Use new tokens' }, { id: 3 }])
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([2, 3]))
            .select({
                id:   tIssue.id,
                body: tIssue.body.onlyWhenOrNull(true),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`body\` as \`body\` from issue where id in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; body?: string }>>>()
    })

    test('onlyWhenOrNull-composes-with-arithmetic', async () => {
        // The gate sits on the result of `.add(...)` — the snapshot
        // proves the expression is the one short-circuited, not the
        // underlying column. False branch replaces the whole `priority+1`
        // expression with `NULL`.
        ctx.mockNext([{ id: 1 }])
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:     tIssue.id,
                bumped: tIssue.priority.add(1).onlyWhenOrNull(false),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, null as bumped from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; bumped?: number }>>>()
    })

    test('onlyWhenOrNull-true-with-arithmetic-emits-full-expression', async () => {
        // Mirror of the above — true branch keeps the full `priority+1`
        // expression intact. Confirms the gate doesn't wrap the
        // expression in any extra `CASE WHEN` envelope when it passes.
        const expected = [{ id: 1, bumped: 3 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:     tIssue.id,
                bumped: tIssue.priority.add(1).onlyWhenOrNull(true),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority + ? as bumped from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; bumped?: number }>>>()
        expect(result).toEqual(expected)
    })

    test('boolean-only-when-gates-where', async () => {
        // `.onlyWhen(...)` on a boolean value source (the predicate
        // `priority > 1`) is a WHERE-gate: `true` keeps the predicate, `false`
        // drops it entirely (no WHERE). Priorities are {2,1,3,2} for ids
        // {1,2,3,4}, so `priority > 1` keeps 1, 3 and 4.
        const kept = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(kept)
        const keptRows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.greaterThan(1).onlyWhen(true))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof keptRows, Array<{ id: number }>>>()
        expect(keptRows).toEqual(kept)

        const all = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(all)
        const allRows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.greaterThan(1).onlyWhen(false))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(allRows).toEqual(all)
    })

    test('boolean-ignore-when-gates-where', async () => {
        // `.ignoreWhen(...)` is the inverse gate on a `BooleanValueSource`:
        // `true` drops the predicate (no WHERE → every row); `false` keeps it.
        const all = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(all)
        const allRows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.greaterThan(1).ignoreWhen(true))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof allRows, Array<{ id: number }>>>()
        expect(allRows).toEqual(all)

        const kept = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(kept)
        const keptRows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.greaterThan(1).ignoreWhen(false))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(keptRows).toEqual(kept)
    })
})
