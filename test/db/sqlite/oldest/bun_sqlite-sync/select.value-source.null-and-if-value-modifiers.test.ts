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
import { tIssue, tIssueWorklog, tOrganization, tProject, tProjectRelease, tProjectReview, tReleaseDraft, type ReleaseChannel, type ReleaseStage, type WorklogActivity } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

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

        const rows = sync(ctx.conn.selectFrom(tIssue)
            .select({
                id:    tIssue.id,
                owner: tIssue.assigneeId.valueWhenNull(0),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(assignee_id, ?) as owner from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; owner: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('valueWhenNull-int-receiver-widens-to-a-fractional-double-fallback', async () => {
        // Locks the valueWhenNull numeric-type promotion. The result was declared
        // as the RECEIVER's `int`, but the null-coalescing call (see the snapshot)
        // resolves to the wider double when the fallback is a double, so a NULL int
        // row returns the double's fraction — which the marshaller's int arm rejected
        // with INVALID_VALUE_RECEIVED_FROM_DATABASE. The fallback here is
        // `priority.divide(2)` (a double source that casts to float, so PostgreSQL
        // resolves the param type from the cast instead of inferring int and
        // rejecting the fraction at bind), so the declared type now promotes to
        // double, like minValue / maxValue / add already do. assignee_id is NULL only
        // for issue 3 (priority 3 -> 3/2 = 1.5), whose fallback surfaces the fraction.
        const expected = [
            { id: 1, w: 1 },
            { id: 2, w: 2 },
            { id: 3, w: 1.5 },
            { id: 4, w: 3 },
        ]
        ctx.mockNext(expected)

        const rows = sync(ctx.conn.selectFrom(tIssue)
            .select({
                id: tIssue.id,
                w:  tIssue.assigneeId.valueWhenNull(tIssue.priority.divide(2)),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(assignee_id, cast(priority as real) / ?) as "w" from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; w: number }>>>()
        expect(rows).toEqual(expected)
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

        const rows = sync(ctx.conn.selectFrom(tIssue)
            .select({
                id:    tIssue.id,
                owner: tIssue.assigneeId.valueWhenNull(tIssue.id),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(assignee_id, id) as owner from issue order by id"`)
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

        const rows = sync(ctx.conn.selectFrom(tIssue)
            .select({
                id:             tIssue.id,
                priorityOrNull: tIssue.priority.nullIfValue(0),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(priority, ?) as priorityOrNull from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; priorityOrNull?: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('nullIfValue-string-literal', async () => {
        // `status.nullIfValue('closed')` on a string column returns NULL when the
        // column equals the literal probe, the value otherwise. Emits
        // `nullif(status, $1)` and the result is `?: string` (optional). Seeded
        // statuses: issue 1 'open', issue 2 'in_progress', issue 3 'open', issue 4
        // 'closed' → issue 4 collapses to an absent key, the rest keep their
        // status.
        const expected = [
            { id: 1, statusOrNull: 'open' },
            { id: 2, statusOrNull: 'in_progress' },
            { id: 3, statusOrNull: 'open' },
            { id: 4 },
        ]
        ctx.mockNext([
            { id: 1, statusOrNull: 'open' },
            { id: 2, statusOrNull: 'in_progress' },
            { id: 3, statusOrNull: 'open' },
            { id: 4, statusOrNull: null },
        ])

        const rows = sync(ctx.conn.selectFrom(tIssue)
            .select({
                id:           tIssue.id,
                statusOrNull: tIssue.status.nullIfValue('closed'),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(status, ?) as statusOrNull from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "closed",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; statusOrNull?: string }>>>()
        expect(rows).toEqual(expected)
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
        const rows = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equalsIfValue(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany())

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
        const rows = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.greaterThanIfValue(minP)
                .and(tIssue.priority.lessThanIfValue(maxP)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority > ? order by id"`)
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
        const rows = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.inIfValue(ids))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany())

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
        const result = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ x: tIssue.title.valueWhenNull(tIssue.body) })
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ifnull(title, body) as "x" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ x?: string }>>>()
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
        const row = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(2))
            .select({ id: tIssueWorklog.id, d: tIssueWorklog.workDate.nullIfValue(new Date(Date.UTC(2024, 2, 4, 0, 0, 0))) })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(work_date, ?) as "d" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-03-04",
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
        const row = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, t: tIssueWorklog.startedAt.valueWhenNull(new Date(Date.UTC(1970, 0, 1, 8, 0, 0))) })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(started_at, ?) as "t" from issue_worklog where id = ?"`)
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
        const row = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, d: tIssue.createdAt.nullIfValue(tIssue.createdAt) })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(created_at, created_at) as "d" from issue where id = ?"`)
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
        const row = sync(ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(2))
            .select({ id: tProjectRelease.id, d: tProjectRelease.releasedOn.nullIfValue(new Date(Date.UTC(2024, 0, 15, 0, 0, 0))) })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(released_on, ?) as "d" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15",
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
        const row = sync(ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(2))
            .select({ id: tProjectRelease.id, x: tProjectRelease.signedOffAt.valueWhenNull(new Date(Date.UTC(2099, 0, 1, 0, 0, 0))) })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(signed_off_at, ?) as "x" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2099-01-01 00:00:00",
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
        const row = sync(ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, x: tProjectRelease.cutoffTime.valueWhenNull(tProjectRelease.cutoffTime) })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(cutoff_time, cutoff_time) as "x" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; x: Date }>>()
        expect(row).toEqual(expected)
    })

    test('temporal/local-date-value-when-null', async () => {
        // `valueWhenNull` on a plain localDate column (workDate, required).
        // Both overloads in one projection — `d` a literal-Date fallback, `d2` a
        // value-source fallback (workDate itself). workDate is never null, so the
        // coalesce always yields the column value → required `Date` on both.
        // worklog 2: work_date 2024-03-05.
        const expected = {
            id: 2,
            d:  new Date(Date.UTC(2024, 2, 5, 10, 0, 0)),
            d2: new Date(Date.UTC(2024, 2, 5, 10, 0, 0)),
        }
        ctx.mockNext(expected)
        const row = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(2))
            .select({
                id: tIssueWorklog.id,
                d:  tIssueWorklog.workDate.valueWhenNull(new Date(Date.UTC(2024, 0, 1, 0, 0, 0))),
                d2: tIssueWorklog.workDate.valueWhenNull(tIssueWorklog.workDate),
            })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(work_date, ?) as "d", ifnull(work_date, work_date) as d2 from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-01",
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; d: Date; d2: Date }>>()
        expect(row).toEqual(expected)
    })

    test('temporal/local-date-time-value-when-null', async () => {
        // `valueWhenNull` on a plain localDateTime column
        // (organization created_at, required — seeded with an explicit timestamp
        // so the value is deterministic). Both overloads — `d` a literal-DateTime
        // fallback, `d2` a value-source fallback (created_at itself). created_at is
        // never null → required `Date` on both. organization 1: 2023-06-15 08:00:00.
        const expected = {
            id: 1,
            d:  new Date(Date.UTC(2023, 5, 15, 8, 0, 0)),
            d2: new Date(Date.UTC(2023, 5, 15, 8, 0, 0)),
        }
        ctx.mockNext(expected)
        const row = sync(ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id: tOrganization.id,
                d:  tOrganization.createdAt.valueWhenNull(new Date(Date.UTC(2099, 0, 1, 0, 0, 0))),
                d2: tOrganization.createdAt.valueWhenNull(tOrganization.createdAt),
            })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(created_at, ?) as "d", ifnull(created_at, created_at) as d2 from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2099-01-01 00:00:00",
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; d: Date; d2: Date }>>()
        expect(row).toEqual(expected)
    })

    test('temporal/custom-local-date-value-when-null', async () => {
        // `valueWhenNull` on a customLocalDate column
        // (releasedOn / 'ReleaseDay', required). Both overloads — `d` a literal-Date
        // fallback, `d2` a value-source fallback (releasedOn itself). releasedOn is
        // never null → required `Date` on both. release 2: released_on 2024-02-20.
        const expected = {
            id: 2,
            d:  new Date(Date.UTC(2024, 1, 20, 10, 0, 0)),
            d2: new Date(Date.UTC(2024, 1, 20, 10, 0, 0)),
        }
        ctx.mockNext(expected)
        const row = sync(ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(2))
            .select({
                id: tProjectRelease.id,
                d:  tProjectRelease.releasedOn.valueWhenNull(new Date(Date.UTC(2099, 0, 1, 0, 0, 0))),
                d2: tProjectRelease.releasedOn.valueWhenNull(tProjectRelease.releasedOn),
            })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(released_on, ?) as "d", ifnull(released_on, released_on) as d2 from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2099-01-01",
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; d: Date; d2: Date }>>()
        expect(row).toEqual(expected)
    })

    test('temporal/local-time-null-if-value', async () => {
        // `nullIfValue` on a plain localTime column (startedAt, optional).
        // Both overloads — `t` a literal-Time probe (08:00:00 ≠ the column, so the
        // value is kept), `t2` a value-source probe (startedAt itself, so nullif is
        // always NULL and the leaf is absent). nullIfValue widens to optional on both.
        // worklog 1: started_at 09:15:00.
        const expected = { id: 1, t: new Date(Date.UTC(1970, 0, 1, 9, 15, 0)) }
        ctx.mockNext({ id: 1, t: new Date(Date.UTC(1970, 0, 1, 9, 15, 0)), t2: null })
        const row = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                t:  tIssueWorklog.startedAt.nullIfValue(new Date(Date.UTC(1970, 0, 1, 8, 0, 0))),
                t2: tIssueWorklog.startedAt.nullIfValue(tIssueWorklog.startedAt),
            })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(started_at, ?) as "t", nullif(started_at, started_at) as t2 from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "08:00:00",
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; t?: Date; t2?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('temporal/custom-local-time-null-if-value', async () => {
        // `nullIfValue` on a customLocalTime column
        // (cutoffTime / 'CutoffClock', required). Both overloads — `t` a literal-Time
        // probe (16:00:00 ≠ the column, value kept), `t2` a value-source probe
        // (cutoffTime itself → always NULL, leaf absent). nullIfValue widens to
        // optional on both. release 1: cutoff_time 17:00:00.
        const expected = { id: 1, t: new Date(Date.UTC(1970, 0, 1, 17, 0, 0)) }
        ctx.mockNext({ id: 1, t: new Date(Date.UTC(1970, 0, 1, 17, 0, 0)), t2: null })
        const row = sync(ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                id: tProjectRelease.id,
                t:  tProjectRelease.cutoffTime.nullIfValue(new Date(Date.UTC(1970, 0, 1, 16, 0, 0))),
                t2: tProjectRelease.cutoffTime.nullIfValue(tProjectRelease.cutoffTime),
            })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(cutoff_time, ?) as "t", nullif(cutoff_time, cutoff_time) as t2 from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "16:00:00",
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; t?: Date; t2?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('temporal/custom-local-date-time-null-if-value', async () => {
        // `nullIfValue` on a customLocalDateTime column
        // (signedOffAt / 'SignOffStamp', optional). Both overloads — `x` a
        // literal-DateTime probe (2099-01-01 ≠ the column, value kept), `x2` a
        // value-source probe (signedOffAt itself → always NULL, leaf absent).
        // nullIfValue widens to optional on both. release 1: signed_off_at
        // 2024-01-14 12:30:00.
        const expected = { id: 1, x: new Date(Date.UTC(2024, 0, 14, 12, 30, 0)) }
        ctx.mockNext({ id: 1, x: new Date(Date.UTC(2024, 0, 14, 12, 30, 0)), x2: null })
        const row = sync(ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                id: tProjectRelease.id,
                x:  tProjectRelease.signedOffAt.nullIfValue(new Date(Date.UTC(2099, 0, 1, 0, 0, 0))),
                x2: tProjectRelease.signedOffAt.nullIfValue(tProjectRelease.signedOffAt),
            })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(signed_off_at, ?) as "x", nullif(signed_off_at, signed_off_at) as x2 from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2099-01-01 00:00:00",
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; x?: Date; x2?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('boolean/value-when-null-and-null-if-value-on-plain-boolean', async () => {
        // `valueWhenNull(boolean)` / `nullIfValue(boolean)` on a nullable plain
        // boolean receiver (`billable`), with a boolean literal fallback/probe.
        // valueWhenNull(true) re-imposes `required` (coalesce), nullIfValue(false)
        // re-imposes `optional` (nullif). worklog 1: billable TRUE; worklog 2: FALSE;
        // worklog 3: NULL. So bwn = {true, false, true}; bni is NULL (absent) wherever
        // billable equals false OR is null (worklogs 2 and 3).
        ctx.mockNext([
            { id: 1, bwn: true,  bni: true },
            { id: 2, bwn: false, bni: null },
            { id: 3, bwn: true,  bni: null },
        ])
        const expected = [
            { id: 1, bwn: true,  bni: true },
            { id: 2, bwn: false },
            { id: 3, bwn: true },
        ]
        const rows = sync(ctx.conn.selectFrom(tIssueWorklog)
            .select({
                id:  tIssueWorklog.id,
                bwn: tIssueWorklog.billable.valueWhenNull(true),
                bni: tIssueWorklog.billable.nullIfValue(false),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(billable, ?) as bwn, nullif(billable, ?) as bni from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            0,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; bwn: boolean; bni?: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('boolean/value-when-null-and-null-if-value-on-custom-boolean-remaps-in-coalesce', async () => {
        // Custom-boolean receiver: `approved` is a nullable boolean carrying the
        // string CustomBooleanTypeAdapter ('A'/'R'), so it remaps to `(approved =
        // 'A')` and the coalesce / nullif wrap THAT remapped predicate —
        // `coalesce((approved = 'A'), $1)` / `nullif((approved = 'A'), $2)`. The
        // fallback/probe are plain booleans. worklog 1: approved 'A' → true; worklog
        // 2: 'R' → false; worklog 3: NULL → (NULL = 'A') is NULL, so awn coalesces to
        // the true fallback.
        ctx.mockNext([
            { id: 1, awn: true,  ani: true },
            { id: 2, awn: false, ani: null },
            { id: 3, awn: true,  ani: null },
        ])
        const expected = [
            { id: 1, awn: true,  ani: true },
            { id: 2, awn: false },
            { id: 3, awn: true },
        ]
        const rows = sync(ctx.conn.selectFrom(tIssueWorklog)
            .select({
                id:  tIssueWorklog.id,
                awn: tIssueWorklog.approved.valueWhenNull(true),
                ani: tIssueWorklog.approved.nullIfValue(false),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull((approved = 'A'), ?) as awn, nullif((approved = 'A'), ?) as ani from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            0,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; awn: boolean; ani?: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('boolean/value-when-null-and-null-if-value-with-value-source-double-remap', async () => {
        // The `valueWhenNull<VALUE>` / `nullIfValue<VALUE>` VALUE-SOURCE overloads on
        // a BOOLEAN receiver: the fallback/probe is ANOTHER
        // value source rather than a plain boolean, so BOTH operands remap through
        // their CustomBooleanTypeAdapter — `coalesce((approved = 'A'), (invoiced =
        // 1))` / `nullif((approved = 'A'), (invoiced = 1))` (approved uses the string
        // 'A'/'R' adapter, invoiced the numeric 1/0 adapter). `invoiced` is required,
        // so `valueWhenNull` yields a required boolean. worklog 1: approved 'A'→true,
        // invoiced 1→true → awn true; worklog 3: approved NULL, invoiced 1→true → awn
        // coalesces to true. `nullif` returns NULL on every row here, so `ani` is
        // absent throughout.
        ctx.mockNext([
            { id: 1, awn: true,  ani: null },
            { id: 2, awn: false, ani: null },
            { id: 3, awn: true,  ani: null },
        ])
        const expected = [
            { id: 1, awn: true },
            { id: 2, awn: false },
            { id: 3, awn: true },
        ]
        const rows = sync(ctx.conn.selectFrom(tIssueWorklog)
            .select({
                id:  tIssueWorklog.id,
                awn: tIssueWorklog.approved.valueWhenNull(tIssueWorklog.invoiced),
                ani: tIssueWorklog.approved.nullIfValue(tIssueWorklog.invoiced),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull((approved = 'A'), (invoiced = 1)) as awn, nullif((approved = 'A'), (invoiced = 1)) as ani from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; awn: boolean; ani?: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('boolean/if-value-source-and-or-with-concrete-boolean-collapses-to-projectable-boolean', async () => {
        // A live IfValueSource (`status.equalsIfValue(value)`) combined via `.and` /
        // `.or` with a concrete BooleanValueSource operand (`priority.greaterThan(1)`)
        // collapses to a projectable `BooleanValueSource` (an IfValueSource operand
        // would instead keep it a non-projectable IfValueSource). The status filter is
        // a present value, so both predicates fire.
        // issue 1: status 'open', priority 2 → and (T&T)=true,  or (T|T)=true
        // issue 2: status 'in_progress', priority 1 → and (F&F)=false, or (F|F)=false
        // issue 4: status 'closed', priority 2 → and (F&T)=false, or (F|T)=true
        const statusFilter: string = 'open'
        const expected = [
            { id: 1, andFlag: true,  orFlag: true },
            { id: 2, andFlag: false, orFlag: false },
            { id: 4, andFlag: false, orFlag: true },
        ]
        ctx.mockNext(expected)
        const rows = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 4]))
            .select({
                id:      tIssue.id,
                andFlag: tIssue.status.equalsIfValue(statusFilter).and(tIssue.priority.greaterThan(1)),
                orFlag:  tIssue.status.equalsIfValue(statusFilter).or(tIssue.priority.greaterThan(1)),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, status = ? and priority > ? as andFlag, status = ? or priority > ? as orFlag from issue where id in (?, ?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            1,
            "open",
            1,
            1,
            2,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; andFlag: boolean; orFlag: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('null-modifiers-on-custom-comparable-version-leaf', async () => {
        // `version` is a customComparable column typed as the bare
        // ComparableValueSource — no leaf overrides its Nullable family, so the
        // base-interface redeclarations of `valueWhenNull` / `nullIfValue` /
        // `asOptional` (plus inherited `isNotNull`) are reached by NO other leaf.
        // The assertions pin the brand-preserving return type: coalesce stays a
        // required `string`, nullif widens to optional, asOptional marks optional.
        // Seed versions: '1.2.0'(1), '1.3.0-beta.1'(2), '0.9.0'(3); nullIfValue's
        // probe '0.9.0' collapses release 3's `vni` to an absent key.
        const expected = [
            { id: 1, v: '1.2.0',        vni: '1.2.0',        vopt: '1.2.0' },
            { id: 2, v: '1.3.0-beta.1', vni: '1.3.0-beta.1', vopt: '1.3.0-beta.1' },
            { id: 3, v: '0.9.0',                             vopt: '0.9.0' },
        ]
        ctx.mockNext([
            { id: 1, v: '1.2.0',        vni: '1.2.0',        vopt: '1.2.0' },
            { id: 2, v: '1.3.0-beta.1', vni: '1.3.0-beta.1', vopt: '1.3.0-beta.1' },
            { id: 3, v: '0.9.0',        vni: null,           vopt: '0.9.0' },
        ])
        const rows = sync(ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.isNotNull())
            .select({
                id:   tProjectRelease.id,
                v:    tProjectRelease.version.valueWhenNull('0.0.0'),
                vni:  tProjectRelease.version.nullIfValue('0.9.0'),
                vopt: tProjectRelease.version.asOptional(),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(version, ?) as "v", nullif(version, ?) as vni, version as vopt from project_release where version is not null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0.0.0",
            "0.9.0",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; v: string; vni?: string; vopt?: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('null-modifiers-on-custom-channel-leaf', async () => {
        // `channel` is a `custom` (equality-only) column typed as the bare
        // EqualableValueSource — same bare-base situation as version above, but on
        // the Equalable redeclarations. The value type is the
        // ReleaseChannel union, so the brand is preserved through coalesce / nullif
        // / asOptional. Seed channels: 'stable'(1), 'beta'(2), 'canary'(3);
        // nullIfValue's probe 'canary' collapses release 3's `cni`.
        const expected = [
            { id: 1, c: 'stable', cni: 'stable', copt: 'stable' },
            { id: 2, c: 'beta',   cni: 'beta',   copt: 'beta'   },
            { id: 3, c: 'canary',                copt: 'canary' },
        ]
        ctx.mockNext([
            { id: 1, c: 'stable', cni: 'stable', copt: 'stable' },
            { id: 2, c: 'beta',   cni: 'beta',   copt: 'beta'   },
            { id: 3, c: 'canary', cni: null,     copt: 'canary' },
        ])
        const rows = sync(ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.isNotNull())
            .select({
                id:   tProjectRelease.id,
                c:    tProjectRelease.channel.valueWhenNull('stable'),
                cni:  tProjectRelease.channel.nullIfValue('canary'),
                copt: tProjectRelease.channel.asOptional(),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(channel, ?) as "c", nullif(channel, ?) as cni, channel as copt from project_release where channel is not null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "stable",
            "canary",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; c: ReleaseChannel; cni?: ReleaseChannel; copt?: ReleaseChannel }>>>()
        expect(rows).toEqual(expected)
    })

    test('null-modifiers-on-enum-activity-leaf', async () => {
        // `activity` is an `enum` column typed as the bare EqualableValueSource —
        // the third bare-base leaf. The value type is the WorklogActivity union;
        // valueWhenNull / nullIfValue / asOptional preserve it. Seed activities:
        // 'coding'(1), 'review'(2), 'meeting'(3); nullIfValue's probe 'meeting'
        // collapses worklog 3's `ani`.
        const expected = [
            { id: 1, a: 'coding',  ani: 'coding', aopt: 'coding'  },
            { id: 2, a: 'review',  ani: 'review', aopt: 'review'  },
            { id: 3, a: 'meeting',                aopt: 'meeting' },
        ]
        ctx.mockNext([
            { id: 1, a: 'coding',  ani: 'coding', aopt: 'coding'  },
            { id: 2, a: 'review',  ani: 'review', aopt: 'review'  },
            { id: 3, a: 'meeting', ani: null,     aopt: 'meeting' },
        ])
        const rows = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.isNotNull())
            .select({
                id:   tIssueWorklog.id,
                a:    tIssueWorklog.activity.valueWhenNull('coding'),
                ani:  tIssueWorklog.activity.nullIfValue('meeting'),
                aopt: tIssueWorklog.activity.asOptional(),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(activity, ?) as "a", nullif(activity, ?) as ani, activity as aopt from issue_worklog where activity is not null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "coding",
            "meeting",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; a: WorklogActivity; ani?: WorklogActivity; aopt?: WorklogActivity }>>>()
        expect(rows).toEqual(expected)
    })

    test('null-modifiers-on-optional-enum-hits-real-null-branch', async () => {
        // `stage` is an OPTIONAL enum on tReleaseDraft, so the Nullable family reaches a real NULL
        // row. Draft 1 sets stage 'candidate'; draft 2 leaves it NULL. valueWhenNull substitutes
        // 'draft' on the NULL row, nullIfValue keeps the present value and drops the null, asOptional
        // drops the null. A second query proves isNull selects the NULL row (draft 2).
        const expected = [
            { id: 1, coalesced: 'candidate', nulled: 'candidate', opt: 'candidate' },
            { id: 2, coalesced: 'draft' },
        ]
        ctx.mockNext([
            { id: 1, coalesced: 'candidate', nulled: 'candidate', opt: 'candidate' },
            { id: 2, coalesced: 'draft', nulled: null, opt: null },
        ])
        const rows = sync(ctx.conn.selectFrom(tReleaseDraft)
            .select({
                id:        tReleaseDraft.id,
                coalesced: tReleaseDraft.stage.valueWhenNull('draft'),
                nulled:    tReleaseDraft.stage.nullIfValue('final'),
                opt:       tReleaseDraft.stage.asOptional(),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(stage, ?) as coalesced, nullif(stage, ?) as nulled, stage as opt from release_draft order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "draft",
            "final",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; coalesced: ReleaseStage; nulled?: ReleaseStage; opt?: ReleaseStage }>>>()
        expect(rows).toEqual(expected)

        ctx.mockNext([2])
        const nullIds = sync(ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.stage.isNull())
            .selectOneColumn(tReleaseDraft.id)
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from release_draft where stage is null"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof nullIds, number[]>>()
        expect(nullIds).toEqual([2])
    })

    test('null-modifiers-on-optional-custom-hits-real-null-branch', async () => {
        // The `custom` kind: `channel` is an OPTIONAL custom column (ReleaseChannel) on
        // tReleaseDraft. Draft 1 sets 'beta'; draft 2 leaves it NULL. valueWhenNull('stable')
        // substitutes on the NULL row, nullIfValue keeps the present value, asOptional drops the null,
        // isNull selects draft 2.
        const expected = [
            { id: 1, coalesced: 'beta', nulled: 'beta', opt: 'beta' },
            { id: 2, coalesced: 'stable' },
        ]
        ctx.mockNext([
            { id: 1, coalesced: 'beta', nulled: 'beta', opt: 'beta' },
            { id: 2, coalesced: 'stable', nulled: null, opt: null },
        ])
        const rows = sync(ctx.conn.selectFrom(tReleaseDraft)
            .select({
                id:        tReleaseDraft.id,
                coalesced: tReleaseDraft.channel.valueWhenNull('stable'),
                nulled:    tReleaseDraft.channel.nullIfValue('canary'),
                opt:       tReleaseDraft.channel.asOptional(),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(channel, ?) as coalesced, nullif(channel, ?) as nulled, channel as opt from release_draft order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "stable",
            "canary",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; coalesced: ReleaseChannel; nulled?: ReleaseChannel; opt?: ReleaseChannel }>>>()
        expect(rows).toEqual(expected)

        ctx.mockNext([2])
        const nullIds = sync(ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.channel.isNull())
            .selectOneColumn(tReleaseDraft.id)
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from release_draft where channel is null"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof nullIds, number[]>>()
        expect(nullIds).toEqual([2])
    })

    test('null-modifiers-on-optional-custom-comparable-hits-real-null-branch', async () => {
        // The `customComparable` kind: `minVersion` is an OPTIONAL customComparable column (Semver
        // typeName) on tReleaseDraft. Draft 1 sets '1.0.0'; draft 2 leaves it NULL.
        // valueWhenNull('0.0.0') substitutes on the NULL row, nullIfValue keeps the present value,
        // asOptional drops the null, isNull selects draft 2.
        const expected = [
            { id: 1, coalesced: '1.0.0', nulled: '1.0.0', opt: '1.0.0' },
            { id: 2, coalesced: '0.0.0' },
        ]
        ctx.mockNext([
            { id: 1, coalesced: '1.0.0', nulled: '1.0.0', opt: '1.0.0' },
            { id: 2, coalesced: '0.0.0', nulled: null, opt: null },
        ])
        const rows = sync(ctx.conn.selectFrom(tReleaseDraft)
            .select({
                id:        tReleaseDraft.id,
                coalesced: tReleaseDraft.minVersion.valueWhenNull('0.0.0'),
                nulled:    tReleaseDraft.minVersion.nullIfValue('9.9.9'),
                opt:       tReleaseDraft.minVersion.asOptional(),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(min_version, ?) as coalesced, nullif(min_version, ?) as nulled, min_version as opt from release_draft order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0.0.0",
            "9.9.9",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; coalesced: string; nulled?: string; opt?: string }>>>()
        expect(rows).toEqual(expected)

        ctx.mockNext([2])
        const nullIds = sync(ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.minVersion.isNull())
            .selectOneColumn(tReleaseDraft.id)
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from release_draft where min_version is null"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof nullIds, number[]>>()
        expect(nullIds).toEqual([2])
    })

    test('is-null-is-not-null-on-optional-custom-double', async () => {
        // isNull / isNotNull on the OPTIONAL customDouble column `budget` ('Money')
        // on tReleaseDraft. Draft 1 sets budget 1500.5 (present -> n false, nn true);
        // draft 2 leaves it NULL (-> n true, nn false), so the NULL branch is real.
        const expected = [
            { id: 1, n: false, nn: true },
            { id: 2, n: true,  nn: false },
        ]
        ctx.mockNext(expected)
        const rows = sync(ctx.conn.selectFrom(tReleaseDraft)
            .select({
                id: tReleaseDraft.id,
                n:  tReleaseDraft.budget.isNull(),
                nn: tReleaseDraft.budget.isNotNull(),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, budget is null as "n", budget is not null as nn from release_draft order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; n: boolean; nn: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('is-null-is-not-null-on-optional-custom-local-date', async () => {
        // isNull / isNotNull on the OPTIONAL customLocalDate column `targetDay`
        // ('ReleaseDay') on tReleaseDraft. Draft 1 sets target_day 2024-07-10
        // (present); draft 2 leaves it NULL, realising the NULL branch.
        const expected = [
            { id: 1, n: false, nn: true },
            { id: 2, n: true,  nn: false },
        ]
        ctx.mockNext(expected)
        const rows = sync(ctx.conn.selectFrom(tReleaseDraft)
            .select({
                id: tReleaseDraft.id,
                n:  tReleaseDraft.targetDay.isNull(),
                nn: tReleaseDraft.targetDay.isNotNull(),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, target_day is null as "n", target_day is not null as nn from release_draft order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; n: boolean; nn: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('is-null-is-not-null-on-optional-custom-local-time', async () => {
        // isNull / isNotNull on the OPTIONAL customLocalTime column `cutoff`
        // ('CutoffClock') on tReleaseDraft. Draft 1 sets cutoff 08:30:00 (present);
        // draft 2 leaves it NULL, realising the NULL branch.
        const expected = [
            { id: 1, n: false, nn: true },
            { id: 2, n: true,  nn: false },
        ]
        ctx.mockNext(expected)
        const rows = sync(ctx.conn.selectFrom(tReleaseDraft)
            .select({
                id: tReleaseDraft.id,
                n:  tReleaseDraft.cutoff.isNull(),
                nn: tReleaseDraft.cutoff.isNotNull(),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cutoff is null as "n", cutoff is not null as nn from release_draft order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; n: boolean; nn: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('value-source-null-modifiers-on-optional-enum-leaf', async () => {
        // The value-source overloads of `valueWhenNull` / `nullIfValue` on an enum column —
        // the fallback/probe is another value source (a self-reference to `stage`), so the
        // result optionality follows the arg: `coalesce(stage, stage)` stays optional. Draft 1
        // stage 'candidate' (both operands present); draft 2 stage NULL → coalesce of two NULLs
        // is NULL (absent). `nullif(stage, stage)` is always NULL, so `nvs` is absent everywhere.
        const expected = [
            { id: 1, cvs: 'candidate' },
            { id: 2 },
        ]
        ctx.mockNext([
            { id: 1, cvs: 'candidate', nvs: null },
            { id: 2, cvs: null, nvs: null },
        ])
        const rows = sync(ctx.conn.selectFrom(tReleaseDraft)
            .select({
                id:  tReleaseDraft.id,
                cvs: tReleaseDraft.stage.valueWhenNull(tReleaseDraft.stage),
                nvs: tReleaseDraft.stage.nullIfValue(tReleaseDraft.stage),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(stage, stage) as cvs, nullif(stage, stage) as nvs from release_draft order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; cvs?: ReleaseStage; nvs?: ReleaseStage }>>>()
        expect(rows).toEqual(expected)
    })
    test('value-source-null-modifiers-on-optional-custom-leaf', async () => {
        // The value-source overloads on a `custom` (ReleaseChannel) column, via a `channel`
        // self-reference. `coalesce(channel, channel)` keeps the brand and stays optional;
        // `nullif(channel, channel)` is always NULL. Draft 1 channel 'beta'; draft 2 NULL.
        const expected = [
            { id: 1, cvs: 'beta' },
            { id: 2 },
        ]
        ctx.mockNext([
            { id: 1, cvs: 'beta', nvs: null },
            { id: 2, cvs: null, nvs: null },
        ])
        const rows = sync(ctx.conn.selectFrom(tReleaseDraft)
            .select({
                id:  tReleaseDraft.id,
                cvs: tReleaseDraft.channel.valueWhenNull(tReleaseDraft.channel),
                nvs: tReleaseDraft.channel.nullIfValue(tReleaseDraft.channel),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(channel, channel) as cvs, nullif(channel, channel) as nvs from release_draft order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; cvs?: ReleaseChannel; nvs?: ReleaseChannel }>>>()
        expect(rows).toEqual(expected)
    })
    test('value-source-null-modifiers-on-optional-custom-comparable-leaf', async () => {
        // The value-source overloads on a `customComparable` (Semver) column, via a
        // `minVersion` self-reference. `coalesce(min_version, min_version)` stays optional;
        // `nullif(min_version, min_version)` is always NULL. Draft 1 min_version '1.0.0'; draft 2 NULL.
        const expected = [
            { id: 1, cvs: '1.0.0' },
            { id: 2 },
        ]
        ctx.mockNext([
            { id: 1, cvs: '1.0.0', nvs: null },
            { id: 2, cvs: null, nvs: null },
        ])
        const rows = sync(ctx.conn.selectFrom(tReleaseDraft)
            .select({
                id:  tReleaseDraft.id,
                cvs: tReleaseDraft.minVersion.valueWhenNull(tReleaseDraft.minVersion),
                nvs: tReleaseDraft.minVersion.nullIfValue(tReleaseDraft.minVersion),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(min_version, min_version) as cvs, nullif(min_version, min_version) as nvs from release_draft order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; cvs?: string; nvs?: string }>>>()
        expect(rows).toEqual(expected)
    })
    test('modifier-trio-on-enum-activity-leaf', async () => {
        // `asRequiredInOptionalObject` / `onlyWhenOrNull(false)` / `ignoreWhenAsNull(true)` on an
        // enum column. `asRequiredInOptionalObject()` passes the column through (brand preserved,
        // `req?: WorklogActivity`); the other two replace the value source with a typed NULL at
        // build time, so `own` / `ign` are absent under optional-as-undefined. Worklog 1 activity
        // 'coding'.
        const expected = { id: 1, req: 'coding' }
        ctx.mockNext({ id: 1, req: 'coding' })
        const row = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id:  tIssueWorklog.id,
                req: tIssueWorklog.activity.asRequiredInOptionalObject(),
                own: tIssueWorklog.activity.onlyWhenOrNull(false),
                ign: tIssueWorklog.activity.ignoreWhenAsNull(true),
            })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, activity as req, null as own, null as ign from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; req?: WorklogActivity; own?: WorklogActivity; ign?: WorklogActivity }>>()
        expect(row).toEqual(expected)
    })
    test('modifier-trio-on-custom-channel-leaf', async () => {
        // The same modifier trio on a `custom` (ReleaseChannel) column.
        // `asRequiredInOptionalObject()` keeps the ReleaseChannel brand; the two NULL-substitution
        // modifiers drop to absent. Release 1 channel 'stable'.
        const expected = { id: 1, req: 'stable' }
        ctx.mockNext({ id: 1, req: 'stable' })
        const row = sync(ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                id:  tProjectRelease.id,
                req: tProjectRelease.channel.asRequiredInOptionalObject(),
                own: tProjectRelease.channel.onlyWhenOrNull(false),
                ign: tProjectRelease.channel.ignoreWhenAsNull(true),
            })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, channel as req, null as own, null as ign from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; req?: ReleaseChannel; own?: ReleaseChannel; ign?: ReleaseChannel }>>()
        expect(row).toEqual(expected)
    })
    test('modifier-trio-on-custom-comparable-version-leaf', async () => {
        // The same modifier trio on a `customComparable` (Semver) column.
        // `asRequiredInOptionalObject()` keeps the branded string; the two NULL-substitution
        // modifiers drop to absent. Release 1 version '1.2.0'.
        const expected = { id: 1, req: '1.2.0' }
        ctx.mockNext({ id: 1, req: '1.2.0' })
        const row = sync(ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                id:  tProjectRelease.id,
                req: tProjectRelease.version.asRequiredInOptionalObject(),
                own: tProjectRelease.version.onlyWhenOrNull(false),
                ign: tProjectRelease.version.ignoreWhenAsNull(true),
            })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, version as req, null as own, null as ign from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; req?: string; own?: string; ign?: string }>>()
        expect(row).toEqual(expected)
    })

    test('modifier-trio-on-custom-boolean-leaf', async () => {
        // The modifier trio on a REQUIRED customBoolean column (published,
        // 't'/'f' CustomBooleanTypeAdapter). `asRequiredInOptionalObject()` passes
        // the column through — the adapter remaps it to a boolean predicate, so `req`
        // keeps the boolean type (`req?: boolean`); the two NULL-substitution
        // modifiers replace the value source with a typed NULL, so `own` / `ign` are
        // absent under optional-as-undefined. Project 1 published 't' → true.
        const expected = { id: 1, req: true }
        ctx.mockNext({ id: 1, req: true })
        const row = sync(ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:  tProject.id,
                req: tProject.published.asRequiredInOptionalObject(),
                own: tProject.published.onlyWhenOrNull(false),
                ign: tProject.published.ignoreWhenAsNull(true),
            })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (published = 't') as req, null as own, null as ign from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; req?: boolean; own?: boolean; ign?: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('modifier-trio-on-plain-temporal-leaves', async () => {
        // The modifier trio on plain temporal columns: `workDate` (localDate),
        // `startedAt` (localTime). `asRequiredInOptionalObject()` passes the column
        // through (`*Req?: Date`); `onlyWhenOrNull(false)` / `ignoreWhenAsNull(true)`
        // replace the value source with a build-time typed NULL, so `*Own` / `*Ign` are
        // absent under optional-as-undefined. worklog 2: work_date 2024-03-05,
        // started_at 14:00:00.
        const expected = {
            id:   2,
            dReq: new Date(Date.UTC(2024, 2, 5, 10, 0, 0)),
            tReq: new Date(Date.UTC(1970, 0, 1, 14, 0, 0)),
        }
        ctx.mockNext(expected)
        const row = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(2))
            .select({
                id:   tIssueWorklog.id,
                dReq: tIssueWorklog.workDate.asRequiredInOptionalObject(),
                dOwn: tIssueWorklog.workDate.onlyWhenOrNull(false),
                dIgn: tIssueWorklog.workDate.ignoreWhenAsNull(true),
                tReq: tIssueWorklog.startedAt.asRequiredInOptionalObject(),
                tOwn: tIssueWorklog.startedAt.onlyWhenOrNull(false),
                tIgn: tIssueWorklog.startedAt.ignoreWhenAsNull(true),
            })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, work_date as dReq, null as dOwn, null as dIgn, started_at as tReq, null as tOwn, null as tIgn from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            id:    number
            dReq?: Date; dOwn?: Date; dIgn?: Date
            tReq?: Date; tOwn?: Date; tIgn?: Date
        }>>()
        expect(row).toEqual(expected)
    })

    test('modifier-trio-on-custom-temporal-leaves', async () => {
        // The modifier trio on custom temporal columns (branded Date types):
        // `releasedOn` (customLocalDate), `cutoffTime` (customLocalTime), `signedOffAt`
        // (customLocalDateTime). `asRequiredInOptionalObject()` keeps the mapped Date
        // type (`*Req?: Date`); `onlyWhenOrNull(false)` / `ignoreWhenAsNull(true)` drop
        // `*Own` / `*Ign` to absent. Release 1: released_on 2024-01-15,
        // cutoff_time 17:00:00, signed_off_at 2024-01-14 12:30:00.
        const expected = {
            id:    1,
            dReq:  new Date(Date.UTC(2024, 0, 15, 10, 0, 0)),
            tReq:  new Date(Date.UTC(1970, 0, 1, 17, 0, 0)),
            dtReq: new Date(Date.UTC(2024, 0, 14, 12, 30, 0)),
        }
        ctx.mockNext(expected)
        const row = sync(ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                id:    tProjectRelease.id,
                dReq:  tProjectRelease.releasedOn.asRequiredInOptionalObject(),
                dOwn:  tProjectRelease.releasedOn.onlyWhenOrNull(false),
                dIgn:  tProjectRelease.releasedOn.ignoreWhenAsNull(true),
                tReq:  tProjectRelease.cutoffTime.asRequiredInOptionalObject(),
                tOwn:  tProjectRelease.cutoffTime.onlyWhenOrNull(false),
                tIgn:  tProjectRelease.cutoffTime.ignoreWhenAsNull(true),
                dtReq: tProjectRelease.signedOffAt.asRequiredInOptionalObject(),
                dtOwn: tProjectRelease.signedOffAt.onlyWhenOrNull(false),
                dtIgn: tProjectRelease.signedOffAt.ignoreWhenAsNull(true),
            })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, released_on as dReq, null as dOwn, null as dIgn, cutoff_time as tReq, null as tOwn, null as tIgn, signed_off_at as dtReq, null as dtOwn, null as dtIgn from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:     number
            dReq?:  Date; dOwn?:  Date; dIgn?:  Date
            tReq?:  Date; tOwn?:  Date; tIgn?:  Date
            dtReq?: Date; dtOwn?: Date; dtIgn?: Date
        }>>()
        expect(row).toEqual(expected)
    })

    // Nullable-family modifiers: the modifier trio (asRequiredInOptionalObject /
    // onlyWhenOrNull / ignoreWhenAsNull) and the value-source / literal
    // valueWhenNull / nullIfValue overloads, per leaf.

    test('modifier-trio-on-plain-local-date-time-leaf', async () => {
        // The modifier trio on a plain localDateTime column (organization.created_at).
        // asRequiredInOptionalObject() passes the timestamp through (req?: Date); the two
        // NULL-substitution modifiers drop own / ign to absent. Org 1 created_at
        // 2023-06-15 08:00:00.
        const expected = { id: 1, req: new Date(Date.UTC(2023, 5, 15, 8, 0, 0)) }
        ctx.mockNext(expected)
        const row = sync(ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:  tOrganization.id,
                req: tOrganization.createdAt.asRequiredInOptionalObject(),
                own: tOrganization.createdAt.onlyWhenOrNull(false),
                ign: tOrganization.createdAt.ignoreWhenAsNull(true),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, created_at as req, null as own, null as ign from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; req?: Date; own?: Date; ign?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('modifier-trio-on-custom-int-and-double-leaves', async () => {
        // The modifier trio on custom numeric leaves: costCents (customInt 'Cents') and
        // billedAmount (customDouble 'Money'). asRequiredInOptionalObject() passes the
        // marshalled number through (*Req?: number); the two NULL-substitution modifiers
        // drop *Own / *Ign to absent. Worklog 1 cost_cents 100, billed_amount 200.
        const expected = { id: 1, cReq: 100, bReq: 200 }
        ctx.mockNext(expected)
        const row = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id:   tIssueWorklog.id,
                cReq: tIssueWorklog.costCents.asRequiredInOptionalObject(),
                cOwn: tIssueWorklog.costCents.onlyWhenOrNull(false),
                cIgn: tIssueWorklog.costCents.ignoreWhenAsNull(true),
                bReq: tIssueWorklog.billedAmount.asRequiredInOptionalObject(),
                bOwn: tIssueWorklog.billedAmount.onlyWhenOrNull(false),
                bIgn: tIssueWorklog.billedAmount.ignoreWhenAsNull(true),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cost_cents as cReq, null as cOwn, null as cIgn, billed_amount as bReq, null as bOwn, null as bIgn from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id: number
            cReq?: number; cOwn?: number; cIgn?: number
            bReq?: number; bOwn?: number; bIgn?: number
        }>>()
        expect(row).toEqual(expected)
    })

    test('temporal/local-date-null-if-value-source', async () => {
        // nullIfValue(valueSource) on a localDate column — the value-source arm.
        // work_date.nullIfValue(work_date) is always NULL (a column never differs from
        // itself), so the optional leaf is absent regardless of the seed.
        const expected = { id: 1 }
        ctx.mockNext(expected)
        const row = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, d: tIssueWorklog.workDate.nullIfValue(tIssueWorklog.workDate) })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(work_date, work_date) as "d" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; d?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('temporal/local-time-value-when-null-source', async () => {
        // valueWhenNull(valueSource) on a localTime column — the value-source arm.
        // started_at.valueWhenNull(started_at) yields the column value; both operands
        // optional so the leaf stays optional. Worklog 1 started_at 09:15:00.
        const expected = { id: 1, t: new Date(Date.UTC(1970, 0, 1, 9, 15, 0)) }
        ctx.mockNext(expected)
        const row = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, t: tIssueWorklog.startedAt.valueWhenNull(tIssueWorklog.startedAt) })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(started_at, started_at) as "t" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; t?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('temporal/custom-local-date-null-if-value-source', async () => {
        // nullIfValue(valueSource) on a customLocalDate column (releasedOn / 'ReleaseDay')
        // — the value-source arm. released_on.nullIfValue(released_on) is always NULL →
        // the optional leaf is absent.
        const expected = { id: 1 }
        ctx.mockNext(expected)
        const row = sync(ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, d: tProjectRelease.releasedOn.nullIfValue(tProjectRelease.releasedOn) })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(released_on, released_on) as "d" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; d?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('temporal/custom-local-time-value-when-null-literal', async () => {
        // valueWhenNull(literalTime) on a customLocalTime column (cutoffTime / 'CutoffClock')
        // — the literal arm (the value-source arm is covered above). Release 1 cutoff_time
        // 17:00:00 (not null) → the column value.
        const expected = { id: 1, x: new Date(Date.UTC(1970, 0, 1, 17, 0, 0)) }
        ctx.mockNext(expected)
        const row = sync(ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, x: tProjectRelease.cutoffTime.valueWhenNull(new Date(Date.UTC(1970, 0, 1, 8, 0, 0))) })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(cutoff_time, ?) as "x" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "08:00:00",
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; x: Date }>>()
        expect(row).toEqual(expected)
    })

    test('temporal/local-date-time-null-if-value-literal', async () => {
        // nullIfValue(literalDateTime) on a plain localDateTime column
        // (organization.created_at) — the literal arm. Org 1 created_at 2023-06-15 08:00:00
        // ≠ the probe (2000-01-01) → the value is kept (result optional).
        const expected = { id: 1, d: new Date(Date.UTC(2023, 5, 15, 8, 0, 0)) }
        ctx.mockNext(expected)
        const row = sync(ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ id: tOrganization.id, d: tOrganization.createdAt.nullIfValue(new Date(Date.UTC(2000, 0, 1, 0, 0, 0))) })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(created_at, ?) as "d" from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2000-01-01 00:00:00",
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; d?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('temporal/local-date-is-null-is-not-null', async () => {
        // isNull / isNotNull on an optional localDate column (project_review.review_date).
        // Review 1 has review_date 2024-05-20 (present) → n false, nn true.
        const expected = { id: 1, n: false, nn: true }
        ctx.mockNext(expected)
        const row = sync(ctx.conn.selectFrom(tProjectReview)
            .where(tProjectReview.id.equals(1))
            .select({
                id: tProjectReview.id,
                n:  tProjectReview.reviewDate.isNull(),
                nn: tProjectReview.reviewDate.isNotNull(),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, review_date is null as "n", review_date is not null as nn from project_review where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; n: boolean; nn: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('nullIfValue-numeric-value-source-overload', async () => {
        // The VALUE-SOURCE overload of `nullIfValue` on the base Number leaf:
        // `priority.nullIfValue(id)` → `nullif(priority, id)` (two columns, no
        // params). priority {2,1,3,2}, id {1,2,3,4}: nullif collapses issue 3
        // (3 == 3) to an absent key; the rest keep their priority.
        const expected = [
            { id: 1, p: 2 }, { id: 2, p: 1 }, { id: 3 }, { id: 4, p: 2 },
        ]
        ctx.mockNext([
            { id: 1, p: 2 }, { id: 2, p: 1 }, { id: 3, p: null }, { id: 4, p: 2 },
        ])
        const rows = sync(ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, p: tIssue.priority.nullIfValue(tIssue.id) })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(priority, id) as "p" from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; p?: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('asOptional-on-boolean-and-plain-temporal-leaves', async () => {
        // `asOptional()` on the boolean / localDate / localTime / localDateTime leaves
        // widens a required column's leaf to optional (`col as alias`, value unchanged).
        // Query 1 (worklog 2): billable
        // (boolean, FALSE), workDate (localDate), startedAt (localTime). Query 2
        // (organization 1): createdAt (localDateTime).
        const expected1 = {
            id: 2,
            b: false,
            d: new Date(Date.UTC(2024, 2, 5, 10, 0, 0)),
            t: new Date(Date.UTC(1970, 0, 1, 14, 0, 0)),
        }
        ctx.mockNext(expected1)
        const row1 = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(2))
            .select({
                id: tIssueWorklog.id,
                b: tIssueWorklog.billable.asOptional(),
                d: tIssueWorklog.workDate.asOptional(),
                t: tIssueWorklog.startedAt.asOptional(),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billable as "b", work_date as "d", started_at as "t" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row1, { id: number; b?: boolean; d?: Date; t?: Date }>>()
        expect(row1).toEqual(expected1)

        const expected2 = { id: 1, c: new Date(Date.UTC(2023, 5, 15, 8, 0, 0)) }
        ctx.mockNext(expected2)
        const row2 = sync(ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ id: tOrganization.id, c: tOrganization.createdAt.asOptional() })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, created_at as "c" from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row2, { id: number; c?: Date }>>()
        expect(row2).toEqual(expected2)
    })
    // ==== Custom-boolean receiver × Nullable family.
    // valueWhenNull / nullIfValue with a literal boolean arg on the REQUIRED
    // custom-boolean adapters (verified 'Y'/'N', published 't'/'f', invoiced 1/0),
    // and the modifier trio (asRequiredInOptionalObject / onlyWhenOrNull /
    // ignoreWhenAsNull) on the remaining adapters (verified / approved / invoiced).
    // The receiver remaps to its adapter predicate inside coalesce / nullif. Seed:
    // verified 1 'Y', 2 'N'; published 1 't', 2 'f', 3 't', 4 'f'; approved 1 'A',
    // 2 'R', 3 NULL; invoiced 1 -> 1, 2 -> 0, 3 -> 1. ====

    test('null-modifiers-on-verified-required-custom-boolean-string-adapter', async () => {
        // `verified.valueWhenNull(false)` → `coalesce((verified = 'Y'), $1)` (required
        // boolean; verified is never NULL so the coalesce always yields the remapped
        // value). `verified.nullIfValue(false)` → `nullif((verified = 'Y'), $2)`
        // (optional; org 2 'N' → false, nullif(false,false) is NULL → absent).
        ctx.mockNext([
            { id: 1, wn: true,  ni: true },
            { id: 2, wn: false, ni: null },
        ])
        const expected = [
            { id: 1, wn: true,  ni: true },
            { id: 2, wn: false },
        ]
        const rows = sync(ctx.conn.selectFrom(tOrganization)
            .select({
                id: tOrganization.id,
                wn: tOrganization.verified.valueWhenNull(false),
                ni: tOrganization.verified.nullIfValue(false),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull((verified = 'Y'), ?) as wn, nullif((verified = 'Y'), ?) as ni from organization order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            0,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; wn: boolean; ni?: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('null-modifiers-on-published-required-custom-boolean-string-adapter', async () => {
        // `published.valueWhenNull(false)` → `coalesce((published = 't'), $1)`;
        // `published.nullIfValue(false)` → `nullif((published = 't'), $2)`. Projects 1,
        // 3 ('t' → true) keep `ni`; projects 2, 4 ('f' → false) collapse `ni` to absent.
        ctx.mockNext([
            { id: 1, wn: true,  ni: true },
            { id: 2, wn: false, ni: null },
            { id: 3, wn: true,  ni: true },
            { id: 4, wn: false, ni: null },
        ])
        const expected = [
            { id: 1, wn: true,  ni: true },
            { id: 2, wn: false },
            { id: 3, wn: true,  ni: true },
            { id: 4, wn: false },
        ]
        const rows = sync(ctx.conn.selectFrom(tProject)
            .select({
                id: tProject.id,
                wn: tProject.published.valueWhenNull(false),
                ni: tProject.published.nullIfValue(false),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull((published = 't'), ?) as wn, nullif((published = 't'), ?) as ni from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            0,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; wn: boolean; ni?: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('null-modifiers-on-invoiced-required-numeric-custom-boolean-adapter', async () => {
        // The NUMERIC custom-boolean overload (1/0): `invoiced.valueWhenNull(false)` →
        // `coalesce((invoiced = 1), $1)`; `invoiced.nullIfValue(false)` →
        // `nullif((invoiced = 1), $2)`. Worklogs 1, 3 (invoiced 1 → true) keep `ni`;
        // worklog 2 (invoiced 0 → false) collapses `ni` to absent.
        ctx.mockNext([
            { id: 1, wn: true,  ni: true },
            { id: 2, wn: false, ni: null },
            { id: 3, wn: true,  ni: true },
        ])
        const expected = [
            { id: 1, wn: true,  ni: true },
            { id: 2, wn: false },
            { id: 3, wn: true,  ni: true },
        ]
        const rows = sync(ctx.conn.selectFrom(tIssueWorklog)
            .select({
                id: tIssueWorklog.id,
                wn: tIssueWorklog.invoiced.valueWhenNull(false),
                ni: tIssueWorklog.invoiced.nullIfValue(false),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull((invoiced = 1), ?) as wn, nullif((invoiced = 1), ?) as ni from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            0,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; wn: boolean; ni?: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('modifier-trio-on-verified-required-custom-boolean-leaf', async () => {
        // The modifier trio on the REQUIRED string custom-boolean `verified` ('Y'/'N').
        // `asRequiredInOptionalObject()` passes the column through — the adapter remaps
        // it, so `req` keeps the boolean type (`req?: boolean`); `onlyWhenOrNull(false)`
        // / `ignoreWhenAsNull(true)` replace the value source with a typed NULL, so
        // `own` / `ign` are absent under optional-as-undefined. Org 1 verified 'Y' → true.
        const expected = { id: 1, req: true }
        ctx.mockNext({ id: 1, req: true })
        const row = sync(ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:  tOrganization.id,
                req: tOrganization.verified.asRequiredInOptionalObject(),
                own: tOrganization.verified.onlyWhenOrNull(false),
                ign: tOrganization.verified.ignoreWhenAsNull(true),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (verified = 'Y') as req, null as own, null as ign from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; req?: boolean; own?: boolean; ign?: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('modifier-trio-on-approved-nullable-custom-boolean-leaf', async () => {
        // The modifier trio on the NULLABLE string custom-boolean `approved` ('A'/'R').
        // `asRequiredInOptionalObject()` keeps the remapped boolean (`req?: boolean`);
        // the two NULL-substitution modifiers drop `own` / `ign` to absent. Worklog 1
        // approved 'A' → true.
        const expected = { id: 1, req: true }
        ctx.mockNext({ id: 1, req: true })
        const row = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id:  tIssueWorklog.id,
                req: tIssueWorklog.approved.asRequiredInOptionalObject(),
                own: tIssueWorklog.approved.onlyWhenOrNull(false),
                ign: tIssueWorklog.approved.ignoreWhenAsNull(true),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (approved = 'A') as req, null as own, null as ign from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; req?: boolean; own?: boolean; ign?: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('modifier-trio-on-invoiced-required-numeric-custom-boolean-leaf', async () => {
        // The modifier trio on the REQUIRED numeric custom-boolean `invoiced` (1/0).
        // `asRequiredInOptionalObject()` keeps the remapped boolean (`req?: boolean`);
        // the two NULL-substitution modifiers drop `own` / `ign` to absent. Worklog 1
        // invoiced 1 → true.
        const expected = { id: 1, req: true }
        ctx.mockNext({ id: 1, req: true })
        const row = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id:  tIssueWorklog.id,
                req: tIssueWorklog.invoiced.asRequiredInOptionalObject(),
                own: tIssueWorklog.invoiced.onlyWhenOrNull(false),
                ign: tIssueWorklog.invoiced.ignoreWhenAsNull(true),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (invoiced = 1) as req, null as own, null as ign from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; req?: boolean; own?: boolean; ign?: boolean }>>()
        expect(row).toEqual(expected)
    })
    // The projection modifier trio on a PLAIN double receiver (`priority.asDouble()`).
    // `asRequiredInOptionalObject()` passes the double
    // through (`req?: number`); `onlyWhenOrNull(false)` / `ignoreWhenAsNull(true)`
    // replace the value source with a typed NULL, so `own` / `ign` are absent under
    // optional-as-undefined and the bake reveals the double NULL cast (`null::float8`
    // on postgres). priority(issue 1) = 2 -> 2.0.
    test('modifier-trio-on-plain-double-leaf', async () => {
        const expected = { id: 1, req: 2 }
        ctx.mockNext({ id: 1, req: 2 })
        const row = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                req: tIssue.priority.asDouble().asRequiredInOptionalObject(),
                own: tIssue.priority.asDouble().onlyWhenOrNull(false),
                ign: tIssue.priority.asDouble().ignoreWhenAsNull(true),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(priority as real) as req, null as own, null as ign from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; req?: number; own?: number; ign?: number }>>()
        expect(row).toEqual(expected)
    })
})
