// Coverage of the "*IfValue" family and the NULL-coalescing modifiers
// on ValueSource. These methods sit on the value-source layer
// and dominate the still-uncovered function count there:
//
//   - `valueWhenNull(default)` — `COALESCE`-style fallback. The default
//     can be a literal or another value source; the result type narrows
//     from `T | null` to `T` (or stays optional if the default is too).
//   - `nullIfValue(probe)` — `NULLIF` semantics. Returns NULL when the
//     expression equals `probe`. The result type widens to optional.
//   - `equalsIfValue` / `lessThanIfValue` / `greaterThanIfValue` —
//     "skip on undefined" predicates. When the RHS is `undefined` (or
//     `null` / empty string per the library's rules) the comparison is
//     elided from the WHERE clause; otherwise it behaves as the
//     `IfValue`-less version. The behavioural contract is the same as
//     `equals`, only conditional.
//   - `inIfValue([])` — the "empty array of probes" case. With a
//     non-empty array it behaves like `in`; with `undefined` *or* `[]`
//     it elides (the "IfValue" suffix is the only rule that applies).
//     Distinct from `.in([])`, which short-circuits to the FALSE
//     constant via `_falseValueForCondition` (see
//     `select.where.empty-in.test.ts`).
//
// All assertions pin both the emitted SQL (so dialect-specific
// renderings are visible per cell) and the runtime value (so the mock
// round-trip is honored).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('valueWhenNull-numeric-with-literal-default', async () => {
        // `tIssue.assigneeId.valueWhenNull(0)` — the optional column
        // becomes required (`number`) at the type level. SQL emits
        // `coalesce(assignee_id, ?)`.
        const expected = [
            { id: 1, owner: 1 },
            { id: 2, owner: 2 },
            { id: 3, owner: 0 },
            { id: 4, owner: 3 },
        ]
        ctx.mockNext(expected)

        const rows = await ctx.conn.selectFrom(tIssue)
            .select({
                id:    tIssue.id,
                owner: tIssue.assigneeId.valueWhenNull(0),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, isnull(assignee_id, @0) as owner from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; owner: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('valueWhenNull-with-column-as-default', async () => {
        // The default is another column (`tIssue.id`) instead of a
        // literal. Distinct from the literal-default test because the
        // RHS is a value source — the type system widens the result
        // optional flag if the column-default is itself optional.
        const expected = [
            { id: 1, owner: 1 },
            { id: 2, owner: 2 },
            { id: 3, owner: 3 },
            { id: 4, owner: 3 },
        ]
        ctx.mockNext(expected)

        const rows = await ctx.conn.selectFrom(tIssue)
            .select({
                id:    tIssue.id,
                owner: tIssue.assigneeId.valueWhenNull(tIssue.id),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, isnull(assignee_id, id) as owner from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; owner: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('nullIfValue-numeric', async () => {
        // `priority.nullIfValue(0)` returns NULL when priority equals
        // the probe, the value itself otherwise. SQL is `nullif(...)`
        // on every dialect we test. Mock returns the projection
        // shape; the real DB validates the structure.
        const expected = [
            { id: 1, priorityOrNull: 2 },
            { id: 2, priorityOrNull: 1 },
            { id: 3, priorityOrNull: 3 },
            { id: 4, priorityOrNull: 2 },
        ]
        ctx.mockNext(expected)

        const rows = await ctx.conn.selectFrom(tIssue)
            .select({
                id:             tIssue.id,
                priorityOrNull: tIssue.priority.nullIfValue(0),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(priority, @0) as priorityOrNull from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; priorityOrNull?: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('equalsIfValue-skips-on-undefined', async () => {
        // The `.equalsIfValue(undefined)` predicate is elided — the
        // WHERE clause carries no clause for the column. Pinning this
        // is the whole point of `IfValue`: a single source expression
        // that gracefully degrades when the runtime value is missing.
        const expected = [
            { id: 1 },
            { id: 2 },
            { id: 3 },
            { id: 4 },
        ]
        ctx.mockNext(expected)

        const filter: string | undefined = undefined
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equalsIfValue(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('lessThanIfValue-and-greaterThanIfValue-mixed', async () => {
        // Combines two IfValue predicates AND-joined. One is elided
        // (undefined), one fires (concrete value). The emitted WHERE
        // contains only the fired predicate (priority > 1): issues 1, 3, 4
        // have priority 2, 3, 2; issue 2 (priority 1) is excluded.
        const expected = [
            { id: 1 },
            { id: 3 },
            { id: 4 },
        ]
        ctx.mockNext(expected)

        const minP: number | undefined = 1
        const maxP: number | undefined = undefined
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.greaterThanIfValue(minP)
                .and(tIssue.priority.lessThanIfValue(maxP)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority > @0 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('inIfValue-with-empty-array-elides-predicate', async () => {
        // `inIfValue([])` elides — it behaves like a missing value
        // (the "IfValue" suffix marks "drop on missing"), so the WHERE
        // emits nothing for that predicate. Contrast with `.in([])`
        // which the library short-circuits to `where 0`/false (see
        // `select.where.empty-in.test.ts`). The mock returns the full
        // seed because the SELECT has no effective filter, and the
        // real DB returns the same 4 rows.
        const expected = [
            { id: 1 },
            { id: 2 },
            { id: 3 },
            { id: 4 },
        ]
        ctx.mockNext(expected)
        const ids: number[] = []
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.inIfValue(ids))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })
    test('valueWhenNull-required-receiver-optional-default-becomes-optional', async () => {
        // the `valueWhenNull(VALUE)` overload REPLACES the receiver's
        // optionality with the default's. `title` is required, `body` is
        // optional → the result is optional, even though at runtime `title`
        // is never null so the coalesce always yields it.
        const expected = [{ x: 'Update hero copy' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ x: tIssue.title.valueWhenNull(tIssue.body) })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select isnull(title, body) as [x] from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ x?: string | undefined }>>>()
        expect(result).toEqual(expected)
    })})
