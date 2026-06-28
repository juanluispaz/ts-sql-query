// Operator/modifier composition: chaining and nesting expressions so the
// projected leaf type (and its optionality) is what the type system computes.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tIssueWorklog, tOrganization, tProject } from '../../domain/connection.js'
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(priority + ?) as \`s\`, count(ifnull(assignee_id, ?)) as \`c\`, max(priority + ?) as \`m\` from issue"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, organization.id + project.organization_id as combined from project left join organization on organization.id = project.organization_id where project.id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as \`p\` from issue where id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(ifnull(priority, ?), ?) as \`q\` from issue where id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, organization.id + ? as orgPlus from project left join organization on organization.id = project.organization_id where project.id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority = ? and title like concat('%', ?, '%') as flag from issue where id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, activity = ? and billable as flag from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority = ? or title like concat('%', ?, '%') as flag from issue where id = ?"`)
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

    test('boolean-and-if-value-present-collapses-to-projectable-boolean', async () => {
        // `BooleanValueSource.and(IfValueSource)` returns a `BooleanValueSource`
        // (not an IfValueSource) whose optionality is the merge of both
        // operands; `status` is a required column so the merged leaf is a plain
        // `boolean`. With the IfValue argument carrying a value both predicates
        // are emitted. Issue 1: priority 2 == 2 and status == 'closed' is false.
        const expected = { id: 1, flag: false }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:   tIssue.id,
                flag: tIssue.priority.equals(2).and(tIssue.status.equalsIfValue('closed')),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority = ? and status = ? as flag from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            "closed",
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; flag: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('boolean-and-if-value-no-value-elides-to-just-the-boolean', async () => {
        // The runtime fork: when the IfValue argument carries no value it
        // elides and `BooleanValueSource.and(<no value>)` reduces to just the
        // receiver — only `priority = $1` is emitted. The compile-time leaf
        // is still `boolean` (the merged optionality is computed statically,
        // independent of the runtime elision). Issue 1: priority 2 == 2 -> true.
        const expected = { id: 1, flag: true }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:   tIssue.id,
                flag: tIssue.priority.equals(2).and(tIssue.status.equalsIfValue(undefined)),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority = ? as flag from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; flag: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('boolean-or-if-value-present-collapses-to-projectable-boolean', async () => {
        // `BooleanValueSource.or(IfValueSource)` returns a `BooleanValueSource`
        // (`boolean`); with a value present both predicates are emitted.
        // Issue 1: priority 2 != 99 but status == 'open', so the disjunction
        // is true.
        const expected = { id: 1, flag: true }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:   tIssue.id,
                flag: tIssue.priority.equals(99).or(tIssue.status.equalsIfValue('open')),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority = ? or status = ? as flag from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            99,
            "open",
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; flag: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('boolean-or-if-value-no-value-elides-to-just-the-boolean', async () => {
        // The `.or` runtime fork: when the IfValue argument carries no value
        // it elides and the OR reduces to just the receiver — only
        // `priority = $1` is emitted. The leaf is still `boolean`. Issue 1:
        // priority 2 != 99 -> false.
        const expected = { id: 1, flag: false }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:   tIssue.id,
                flag: tIssue.priority.equals(99).or(tIssue.status.equalsIfValue(undefined)),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority = ? as flag from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            99,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; flag: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('boolean-or-merging-optional-operand-projected-as-optional', async () => {
        // A required boolean `.or(...)` an OPTIONAL boolean operand merges to
        // `optional`, so the leaf is `?: boolean`. `activity.equals(...)` is a
        // required boolean; `billable` is a nullable boolean column. Worklog 1:
        // activity 'coding' or billable TRUE -> true.
        const expected = { id: 1, flag: true }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id:   tIssueWorklog.id,
                flag: tIssueWorklog.activity.equals('coding').or(tIssueWorklog.billable),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, activity = ? or billable as flag from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "coding",
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; flag?: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('operator-on-originally-required-left-join-column-projected-as-nullable-leaf-on-miss', async () => {
        // The `projectingOptionalValuesAsNullable()` twin of
        // `operator-on-originally-required-left-join-column-projected-as-leaf`
        // above. There the join HITS and the `originallyRequired` direct leaf
        // is `orgPlus?: number`; here `projectingOptionalValuesAsNullable()`
        // renders the same `originallyRequired` leaf as `number | null`, and
        // the join MISSES at runtime so the value is actually `null`. Issue 3
        // has no assignee (assignee_id NULL), so the left join to app_user
        // finds no row and `app_user.id + 1` is NULL.
        const tAssigneeLeft = tAppUser.forUseInLeftJoin()
        const expected = { iid: 3, assigneePlus: null }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tAssigneeLeft).on(tAssigneeLeft.id.equals(tIssue.assigneeId))
            .where(tIssue.id.equals(3))
            .select({
                iid:          tIssue.id,
                assigneePlus: tAssigneeLeft.id.add(1),
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, app_user.id + ? as assigneePlus from issue left join app_user on app_user.id = issue.assignee_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof row, { iid: number; assigneePlus: number | null }>>()
        expect(row).toEqual(expected)
    })

})
