// Operator/modifier composition: chaining and nesting expressions so the
// projected leaf type (and its optionality) is what the type system computes.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tIssueWorklog, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('aggregate-over-composed-expression', async () => {
        // `sum`/`max` over an expression re-impose their own optionality
        // (`optional` — an empty set aggregates to NULL); `count` re-imposes
        // `required`. Priorities {2,1,3,2}; +1 -> {3,2,4,3} -> sum 12, max 4.
        // `assignee_id` is {1,2,NULL,3}; coalesced to 0 it is never null, so
        // count is 4.
        ctx.mockNext({ s: 12, c: 4, m: 4 })
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                s: ctx.conn.sum(tIssue.priority.add(1)),
                c: ctx.conn.count(tIssue.assigneeId.valueWhenNull(0)),
                m: ctx.conn.max(tIssue.priority.add(1)),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(priority + :0) as "s", count(nvl(assignee_id, :1)) as "c", max(priority + :2) as "m" from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            0,
            1,
          ]
        `)
        assertType<Exact<typeof result, {
            s?: number
            c:  number
            m?: number
        }>>()
        expect(result).toEqual({ s: 12, c: 4, m: 4 })
    })

    test('merge-optional-originally-required-with-required-in-optional-object-through-operator', async () => {
        // `tOrgLeft.id` (a left-joined column) is `originallyRequired`;
        // `asRequiredInOptionalObject()` is `requiredInOptionalObject`. Merging
        // them via `.add(...)` yields `originallyRequired` (the less strict),
        // projected as a direct leaf `?: number` (present unless the join
        // missed). Project 1 -> organization 1, so the join hits: 1 + 1 = 2.
        const tOrgLeft = tOrganization.forUseInLeftJoin()
        const expected = { pid: 1, combined: 2 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProject)
            .leftJoin(tOrgLeft).on(tOrgLeft.id.equals(tProject.organizationId))
            .where(tProject.id.equals(1))
            .select({
                pid:      tProject.id,
                combined: tOrgLeft.id.add(tProject.organizationId.asRequiredInOptionalObject()),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "pid", "organization".id + project.organization_id as "combined" from project left join "organization" on "organization".id = project.organization_id where project.id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { pid: number; combined?: number }>>()
        expect(row).toEqual(expected)
    })

    test('two-modifiers-as-optional-then-as-required-in-optional-object', async () => {
        // Two nullable modifiers chained: the last one decides the leaf.
        // `asOptional()` alone gives `?: number | undefined`; the trailing
        // `asRequiredInOptionalObject()` overrides it, so the top-level leaf is
        // `?: number` (optional key, no explicit `| undefined`). Issue 1: priority 2.
        const expected = { id: 1, p: 2 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                p:  tIssue.priority.asOptional().asRequiredInOptionalObject(),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", priority as "p" from issue where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; p?: number }>>()
        expect(row).toEqual(expected)
    })

    test('two-modifiers-value-when-null-then-null-if-value', async () => {
        // `valueWhenNull(0)` makes the leaf `required`; the trailing
        // `nullIfValue(2)` overrides it back to `optional`. Issue 1 has priority
        // 2, so `nullif(coalesce(priority, 0), 2)` is NULL -> the leaf is absent.
        const expected = { id: 1 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                q:  tIssue.priority.valueWhenNull(0).nullIfValue(2),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", nullif(nvl(priority, :0), :1) as "q" from issue where id = :2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; q?: number }>>()
        expect(row).toEqual(expected)
    })

    test('operator-on-originally-required-left-join-column-projected-as-leaf', async () => {
        // An operator on an `originallyRequired` left-join column projected as
        // a direct leaf: `tOrgLeft.id.add(1)` stays `originallyRequired`,
        // rendered as `?: number` (absent iff the join missed). Project 1 ->
        // organization 1: 1 + 1 = 2.
        const tOrgLeft = tOrganization.forUseInLeftJoin()
        const expected = { pid: 1, orgPlus: 2 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProject)
            .leftJoin(tOrgLeft).on(tOrgLeft.id.equals(tProject.organizationId))
            .where(tProject.id.equals(1))
            .select({
                pid:     tProject.id,
                orgPlus: tOrgLeft.id.add(1),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "pid", "organization".id + :0 as "orgPlus" from project left join "organization" on "organization".id = project.organization_id where project.id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof row, { pid: number; orgPlus?: number }>>()
        expect(row).toEqual(expected)
    })

    test('if-value-and-boolean-collapses-to-projectable-boolean', async () => {
        // `IfValueSource.and(BooleanValueSource)` returns a `BooleanValueSource`,
        // not an `IfValueSource`; only a `BooleanValueSource` is projectable as a
        // boolean leaf, so this select compiles and yields a `boolean`. Issue 1:
        // priority 2 == 2 and the title contains 'hero' -> true.
        const expected = { id: 1, flag: true }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:   tIssue.id,
                flag: tIssue.priority.equalsIfValue(2).and(tIssue.title.contains('hero')),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", case when priority = :0 and title like ('%' || :1 || '%') escape '\\' then 1 else 0 end as "flag" from issue where id = :2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            "hero",
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; flag: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('boolean-and-merging-optional-operand-projected-as-optional', async () => {
        // A required boolean `.and(...)` an OPTIONAL boolean operand merges to
        // `optional`, so the leaf is `?: boolean`. `activity.equals(...)` is a
        // required boolean; `billable` is a nullable boolean column. Worklog 1:
        // activity 'coding' and billable TRUE -> true.
        const expected = { id: 1, flag: true }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id:   tIssueWorklog.id,
                flag: tIssueWorklog.activity.equals('coding').and(tIssueWorklog.billable),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", case when activity = :0 and (billable = 1) then 1 when not (activity = :1 and (billable = 1)) then 0 else null end as "flag" from issue_worklog where id = :2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "coding",
            "coding",
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; flag?: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('if-value-or-boolean-collapses-to-projectable-boolean', async () => {
        // `IfValueSource.or(BooleanValueSource)` collapses to a
        // `BooleanValueSource` (not an `IfValueSource`) — the `.or` twin of
        // the `.and` collapse above. Only a `BooleanValueSource` is
        // projectable as a boolean leaf, so this select compiles and yields a
        // `boolean`. Issue 1: priority 2 == 2, so the disjunction is true.
        const expected = { id: 1, flag: true }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:   tIssue.id,
                flag: tIssue.priority.equalsIfValue(2).or(tIssue.title.contains('hero')),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", case when priority = :0 or title like ('%' || :1 || '%') escape '\\' then 1 else 0 end as "flag" from issue where id = :2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            "hero",
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; flag: boolean }>>()
        expect(row).toEqual(expected)
    })
})
