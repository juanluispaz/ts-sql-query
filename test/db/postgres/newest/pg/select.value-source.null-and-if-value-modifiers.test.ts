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
import { tIssue, tIssueWorklog, tProjectRelease, tReleaseDraft, type ReleaseChannel, type ReleaseStage, type WorklogActivity } from '../../domain/connection.js'
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

        const rows = await ctx.conn.selectFrom(tIssue)
            .select({
                id:           tIssue.id,
                statusOrNull: tIssue.status.nullIfValue('closed'),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(status, $1) as "statusOrNull" from issue order by id"`)
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
            2024-03-04T00:00:00.000Z,
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
            2024-01-15T00:00:00.000Z,
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
            2099-01-01T00:00:00.000Z,
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
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                id:  tIssueWorklog.id,
                bwn: tIssueWorklog.billable.valueWhenNull(true),
                bni: tIssueWorklog.billable.nullIfValue(false),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce(billable, $1) as bwn, nullif(billable, $2) as bni from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
            false,
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
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                id:  tIssueWorklog.id,
                awn: tIssueWorklog.approved.valueWhenNull(true),
                ani: tIssueWorklog.approved.nullIfValue(false),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce((approved = 'A'), $1) as awn, nullif((approved = 'A'), $2) as ani from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
            false,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; awn: boolean; ani?: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('boolean/value-when-null-and-null-if-value-with-value-source-double-remap', async () => {
        // The `valueWhenNull<VALUE>` / `nullIfValue<VALUE>` VALUE-SOURCE overloads on
        // a BOOLEAN receiver (values.ts:340/342): the fallback/probe is ANOTHER
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
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                id:  tIssueWorklog.id,
                awn: tIssueWorklog.approved.valueWhenNull(tIssueWorklog.invoiced),
                ani: tIssueWorklog.approved.nullIfValue(tIssueWorklog.invoiced),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce((approved = 'A'), (invoiced = 1)) as awn, nullif((approved = 'A'), (invoiced = 1)) as ani from issue_worklog order by id"`)
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
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 4]))
            .select({
                id:      tIssue.id,
                andFlag: tIssue.status.equalsIfValue(statusFilter).and(tIssue.priority.greaterThan(1)),
                orFlag:  tIssue.status.equalsIfValue(statusFilter).or(tIssue.priority.greaterThan(1)),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, status = $1 and priority > $2 as "andFlag", status = $3 or priority > $4 as "orFlag" from issue where id in ($5, $6, $7) order by id"`)
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
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.isNotNull())
            .select({
                id:   tProjectRelease.id,
                v:    tProjectRelease.version.valueWhenNull('0.0.0'),
                vni:  tProjectRelease.version.nullIfValue('0.9.0'),
                vopt: tProjectRelease.version.asOptional(),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce(version, $1) as "v", nullif(version, $2) as vni, version as vopt from project_release where version is not null order by id"`)
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
        // the Equalable redeclarations (values.ts:274-281). The value type is the
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
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.isNotNull())
            .select({
                id:   tProjectRelease.id,
                c:    tProjectRelease.channel.valueWhenNull('stable'),
                cni:  tProjectRelease.channel.nullIfValue('canary'),
                copt: tProjectRelease.channel.asOptional(),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce(channel, $1) as "c", nullif(channel, $2) as cni, channel as copt from project_release where channel is not null order by id"`)
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
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.isNotNull())
            .select({
                id:   tIssueWorklog.id,
                a:    tIssueWorklog.activity.valueWhenNull('coding'),
                ani:  tIssueWorklog.activity.nullIfValue('meeting'),
                aopt: tIssueWorklog.activity.asOptional(),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce(activity, $1) as "a", nullif(activity, $2) as ani, activity as aopt from issue_worklog where activity is not null order by id"`)
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
        // §B-1: `stage` is an OPTIONAL enum on tReleaseDraft, so the Nullable family
        // reaches the REAL NULL branch that the required-column A-3 test cannot.
        // Draft 1 sets stage 'candidate'; draft 2 leaves it NULL. valueWhenNull
        // substitutes 'draft' on the NULL row (the headline value proof),
        // nullIfValue keeps the present value and drops the null, asOptional drops
        // the null. A second query proves isNull selects the NULL row (draft 2) —
        // A-3 only exercised isNotNull.
        const expected = [
            { id: 1, coalesced: 'candidate', nulled: 'candidate', opt: 'candidate' },
            { id: 2, coalesced: 'draft' },
        ]
        ctx.mockNext([
            { id: 1, coalesced: 'candidate', nulled: 'candidate', opt: 'candidate' },
            { id: 2, coalesced: 'draft', nulled: null, opt: null },
        ])
        const rows = await ctx.conn.selectFrom(tReleaseDraft)
            .select({
                id:        tReleaseDraft.id,
                coalesced: tReleaseDraft.stage.valueWhenNull('draft'),
                nulled:    tReleaseDraft.stage.nullIfValue('final'),
                opt:       tReleaseDraft.stage.asOptional(),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce(stage, $1) as coalesced, nullif(stage, $2) as nulled, stage as opt from release_draft order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "draft",
            "final",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; coalesced: ReleaseStage; nulled?: ReleaseStage; opt?: ReleaseStage }>>>()
        expect(rows).toEqual(expected)

        ctx.mockNext([2])
        const nullIds = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.stage.isNull())
            .selectOneColumn(tReleaseDraft.id)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from release_draft where stage is null"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof nullIds, number[]>>()
        expect(nullIds).toEqual([2])
    })

    test('null-modifiers-on-optional-custom-hits-real-null-branch', async () => {
        // §B-1 for the `custom` kind: `channel` is an OPTIONAL custom column
        // (ReleaseChannel) on tReleaseDraft. Draft 1 sets 'beta'; draft 2 leaves it
        // NULL. valueWhenNull('stable') substitutes on the NULL row, nullIfValue
        // keeps the present value, asOptional drops the null, isNull selects draft 2.
        const expected = [
            { id: 1, coalesced: 'beta', nulled: 'beta', opt: 'beta' },
            { id: 2, coalesced: 'stable' },
        ]
        ctx.mockNext([
            { id: 1, coalesced: 'beta', nulled: 'beta', opt: 'beta' },
            { id: 2, coalesced: 'stable', nulled: null, opt: null },
        ])
        const rows = await ctx.conn.selectFrom(tReleaseDraft)
            .select({
                id:        tReleaseDraft.id,
                coalesced: tReleaseDraft.channel.valueWhenNull('stable'),
                nulled:    tReleaseDraft.channel.nullIfValue('canary'),
                opt:       tReleaseDraft.channel.asOptional(),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce(channel, $1) as coalesced, nullif(channel, $2) as nulled, channel as opt from release_draft order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "stable",
            "canary",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; coalesced: ReleaseChannel; nulled?: ReleaseChannel; opt?: ReleaseChannel }>>>()
        expect(rows).toEqual(expected)

        ctx.mockNext([2])
        const nullIds = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.channel.isNull())
            .selectOneColumn(tReleaseDraft.id)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from release_draft where channel is null"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof nullIds, number[]>>()
        expect(nullIds).toEqual([2])
    })

    test('null-modifiers-on-optional-custom-comparable-hits-real-null-branch', async () => {
        // §B-1 for the `customComparable` kind: `minVersion` is an OPTIONAL
        // customComparable column (Semver typeName) on tReleaseDraft. Draft 1 sets
        // '1.0.0'; draft 2 leaves it NULL. valueWhenNull('0.0.0') substitutes on the
        // NULL row, nullIfValue keeps the present value, asOptional drops the null,
        // isNull selects draft 2.
        const expected = [
            { id: 1, coalesced: '1.0.0', nulled: '1.0.0', opt: '1.0.0' },
            { id: 2, coalesced: '0.0.0' },
        ]
        ctx.mockNext([
            { id: 1, coalesced: '1.0.0', nulled: '1.0.0', opt: '1.0.0' },
            { id: 2, coalesced: '0.0.0', nulled: null, opt: null },
        ])
        const rows = await ctx.conn.selectFrom(tReleaseDraft)
            .select({
                id:        tReleaseDraft.id,
                coalesced: tReleaseDraft.minVersion.valueWhenNull('0.0.0'),
                nulled:    tReleaseDraft.minVersion.nullIfValue('9.9.9'),
                opt:       tReleaseDraft.minVersion.asOptional(),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce(min_version, $1) as coalesced, nullif(min_version, $2) as nulled, min_version as opt from release_draft order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0.0.0",
            "9.9.9",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; coalesced: string; nulled?: string; opt?: string }>>>()
        expect(rows).toEqual(expected)

        ctx.mockNext([2])
        const nullIds = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.minVersion.isNull())
            .selectOneColumn(tReleaseDraft.id)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from release_draft where min_version is null"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof nullIds, number[]>>()
        expect(nullIds).toEqual([2])
    })
})
