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
import { tIssue, tIssueWorklog, tProjectRelease } from '../../domain/connection.js'
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce(assignee_id, $1) as owner from issue order by id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce(assignee_id, id) as owner from issue order by id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(priority, $1) as "priorityOrNull" from issue order by id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority > $1 order by id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select coalesce(title, body) as "x" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ x?: string | undefined }>>>()
        expect(result).toEqual(expected)
    })

    test('temporal/local-date-null-if-value-literal', async () => {
        // `valueWhenNull` / `nullIfValue` redefined per temporal type — the
        // numeric/string arms are covered above; this and the next tests pin
        // the localDate / localTime / localDateTime arms (plain and custom),
        // both the literal-Date overload and the value-source overload.
        //
        // `nullIfValue(literalDate)` on a localDate column → result is optional.
        // worklog 2: work_date 2024-03-05, probe 2024-03-04 (≠) → the date.
        const expected = { id: 2, d: new Date(Date.UTC(2024, 2, 5, 10, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(2))
            .select({ id: tIssueWorklog.id, d: tIssueWorklog.workDate.nullIfValue(new Date(Date.UTC(2024, 2, 4, 0, 0, 0))) })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(work_date, $1) as "d" from issue_worklog where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-03-04T00:00:00.000Z",
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; d?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('temporal/local-time-value-when-null-literal', async () => {
        // `valueWhenNull(literalTime)` on a localTime column → result required.
        // worklog 1: started_at 09:15:00 (not null) → the column value.
        const expected = { id: 1, t: new Date(Date.UTC(1970, 0, 1, 9, 15, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, t: tIssueWorklog.startedAt.valueWhenNull(new Date(Date.UTC(1970, 0, 1, 8, 0, 0))) })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce(started_at, $1) as "t" from issue_worklog where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "08:00:00",
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; t: Date }>>()
        expect(row).toEqual(expected)
    })

    test('temporal/local-date-time-null-if-value-source', async () => {
        // `nullIfValue(valueSource)` overload on a localDateTime column — the
        // value-source arm. `created_at.nullIfValue(created_at)` is always NULL
        // (a column never differs from itself), so the optional leaf is absent
        // regardless of the seed timestamp.
        const expected = { id: 1 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, d: tIssue.createdAt.nullIfValue(tIssue.createdAt) })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(created_at, created_at) as "d" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; d?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('temporal/custom-local-date-null-if-value-literal', async () => {
        // Custom twin: `nullIfValue(literalDate)` on a customLocalDate column
        // (releasedOn / 'ReleaseDay'). release 2: released_on 2024-02-20,
        // probe 2024-01-15 (≠) → the date.
        const expected = { id: 2, d: new Date(Date.UTC(2024, 1, 20, 10, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(2))
            .select({ id: tProjectRelease.id, d: tProjectRelease.releasedOn.nullIfValue(new Date(Date.UTC(2024, 0, 15, 0, 0, 0))) })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(released_on, $1) as "d" from project_release where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15T00:00:00.000Z",
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; d?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('temporal/custom-local-date-time-value-when-null-literal-on-null-row', async () => {
        // Custom twin: `valueWhenNull(literalDateTime)` on a customLocalDateTime
        // column (signedOffAt / 'SignOffStamp'). release 2 has signed_off_at
        // NULL, so the coalesce substitutes the literal fallback → result
        // required.
        const expected = { id: 2, x: new Date(Date.UTC(2099, 0, 1, 0, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(2))
            .select({ id: tProjectRelease.id, x: tProjectRelease.signedOffAt.valueWhenNull(new Date(Date.UTC(2099, 0, 1, 0, 0, 0))) })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce(signed_off_at, $1) as "x" from project_release where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2099-01-01T00:00:00.000Z",
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; x: Date }>>()
        expect(row).toEqual(expected)
    })

    test('temporal/custom-local-time-value-when-null-source', async () => {
        // Custom twin: `valueWhenNull(valueSource)` overload on a customLocalTime
        // column (cutoffTime / 'CutoffClock'). `cutoff_time.valueWhenNull(cutoff_time)`
        // yields the column value (never null) → 17:00:00 for release 1.
        const expected = { id: 1, x: new Date(Date.UTC(1970, 0, 1, 17, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, x: tProjectRelease.cutoffTime.valueWhenNull(tProjectRelease.cutoffTime) })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce(cutoff_time, cutoff_time) as "x" from project_release where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; x: Date }>>()
        expect(row).toEqual(expected)
    })
})
