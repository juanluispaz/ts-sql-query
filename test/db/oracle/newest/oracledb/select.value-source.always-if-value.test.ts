// `connection.dynamicBooleanExpressionUsing(...)` returns an
// `AlwaysIfValueSource` — the neutral-boolean builder seed. That interface
// *redeclares* `negate` / literal `and` / literal `or` / `onlyWhen` /
// `ignoreWhen` / `trueWhenNoValue` / `falseWhenNoValue` / `valueWhenNoValue`
// so each returns an `AlwaysIfValueSource` again (keeping the chain
// composable). Each test applies one method to the seed and asserts the
// emitted SQL; the `let w` reassignment keeps the result typed as an
// `AlwaysIfValueSource`.
//
// Seed: 4 issues, priorities {2, 1, 3, 2} for ids {1, 2, 3, 4}. So
// `priority > 1` keeps ids 1, 3, 4 and `priority <= 1` keeps id 2.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tIssueWorklog, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('always-if/negate', async () => {
        // `negate()` on the always-if chain: `not (priority > 1)` keeps the
        // single priority <= 1 row (id 2).
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.and(tIssue.priority.greaterThan(1))
        w = w.negate()
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where not (priority > :0) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/and-literal-true-keeps-condition', async () => {
        // The literal `and(true)` overload — `true` is neutral in AND, so
        // the surviving condition is still `priority > 1`.
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.and(tIssue.priority.greaterThan(1))
        w = w.and(true)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where priority > :0 and (:1 = 1) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/or-literal-false-keeps-condition', async () => {
        // The literal `or(false)` overload — `false` is neutral in OR, so
        // the surviving condition is still `priority > 1`.
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.and(tIssue.priority.greaterThan(1))
        w = w.or(false)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where priority > :0 or (:1 = 1) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            0,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/only-when-true-keeps-condition', async () => {
        // `onlyWhen(true)` keeps the expression — `priority > 1`.
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.and(tIssue.priority.greaterThan(1))
        w = w.onlyWhen(true)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where priority > :0 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/only-when-false-drops-condition', async () => {
        // `onlyWhen(false)` collapses to the neutral boolean → no WHERE
        // clause at all → every row.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.and(tIssue.priority.greaterThan(1))
        w = w.onlyWhen(false)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/ignore-when-true-drops-condition', async () => {
        // `ignoreWhen(true)` is the inverse of `onlyWhen` — drops the
        // expression → no WHERE clause → every row.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.and(tIssue.priority.greaterThan(1))
        w = w.ignoreWhen(true)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/ignore-when-false-keeps-condition', async () => {
        // `ignoreWhen(false)` keeps the expression — `priority > 1`.
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.and(tIssue.priority.greaterThan(1))
        w = w.ignoreWhen(false)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where priority > :0 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/true-when-no-value-on-empty-emits-true-literal', async () => {
        // The seed builder has no condition added, so it carries no value.
        // `trueWhenNoValue()` substitutes the dialect's TRUE literal → the
        // WHERE is unconditionally true → every row.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.trueWhenNoValue()
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where (1=1) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/false-when-no-value-on-empty-emits-false-literal', async () => {
        // Twin of the above — `falseWhenNoValue()` substitutes the FALSE
        // literal → no row survives.
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.falseWhenNoValue()
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where (0=1) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/value-when-no-value-source-substitutes-on-empty', async () => {
        // `valueWhenNoValue(otherBooleanSource)` — with no value on the seed,
        // the fallback boolean source (`priority > 1`) is what ends up in the
        // WHERE clause → ids 1, 3, 4.
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.valueWhenNoValue(tIssue.priority.greaterThan(1))
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where priority > :0 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/value-when-no-value-literal-true-substitutes-on-empty', async () => {
        // With no value on the seed, `valueWhenNoValue(true)` substitutes the
        // literal `true` → the WHERE is unconditionally true → every row.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.valueWhenNoValue(true)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where (1=1) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/value-when-no-value-literal-false-substitutes-on-empty', async () => {
        // With no value on the seed, `valueWhenNoValue(false)` substitutes the
        // literal `false` → no row survives.
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.valueWhenNoValue(false)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where (0=1) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/value-when-no-value-keeps-seed-when-present', async () => {
        // The keeps-seed branch of `valueWhenNoValue(...)`: when the seed DOES
        // carry a value (a real condition was added), the fallback is IGNORED and
        // the existing condition is kept. Seed = `priority > 1`, fallback =
        // `priority < 2`; the WHERE keeps `priority > 1` → ids 1, 3, 4 (not the
        // fallback's id 2).
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.and(tIssue.priority.greaterThan(1))
        w = w.valueWhenNoValue(tIssue.priority.lessThan(2))
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where priority > :0 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/or-value-source-keeps-both-conditions', async () => {
        // The `.or(<value source>)` overload (non-literal): the value-source
        // operand is OR-joined with the seed condition — `priority > 1` OR
        // `priority < 2` covers every row.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.and(tIssue.priority.greaterThan(1))
        w = w.or(tIssue.priority.lessThan(2))
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where priority > :0 or priority < :1 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/two-table-source-union-matches-direct', async () => {
        // The arity-2 `dynamicBooleanExpressionUsing(t1, t2)` overload — the
        // variadic impl is a no-op, so the observable is the type-level correlated
        // SOURCE union: the seed accepts a condition referencing BOTH tables and
        // renders identically to the direct (non-dynamic) equivalent. Filters org 1
        // joined to its project with slug 'mktg-site' → project 1.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        let w = ctx.conn.dynamicBooleanExpressionUsing(tOrganization, tProject)
        w = w.and(tOrganization.id.equals(1))
        w = w.and(tProject.slug.equals('mktg-site'))
        const dyn = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .where(w)
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        const dynSql = ctx.lastSql
        const dynParams = ctx.lastParams

        ctx.mockNext(expected)
        const direct = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .where(tOrganization.id.equals(1).and(tProject.slug.equals('mktg-site')))
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()

        expect(dynSql).toBe(ctx.lastSql)
        expect(dynParams).toEqual(ctx.lastParams)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "id" from "organization" inner join project on project.organization_id = "organization".id where "organization".id = :0 and project.slug = :1 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "mktg-site",
          ]
        `)
        assertType<Exact<typeof dyn, Array<{ id: number }>>>()
        expect(dyn).toEqual(expected)
        expect(direct).toEqual(expected)
    })

    test('always-if/three-table-source-union-matches-direct', async () => {
        // Arity-3: the seed carries a three-table source union (organization +
        // project + issue) and renders identically to the direct equivalent. Adds
        // an issue-status predicate on top of the arity-2 filter → issue 1.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        let w = ctx.conn.dynamicBooleanExpressionUsing(tOrganization, tProject, tIssue)
        w = w.and(tOrganization.id.equals(1))
        w = w.and(tProject.slug.equals('mktg-site'))
        w = w.and(tIssue.status.equals('open'))
        const dyn = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        const dynSql = ctx.lastSql
        const dynParams = ctx.lastParams

        ctx.mockNext(expected)
        const direct = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(tOrganization.id.equals(1)
                .and(tProject.slug.equals('mktg-site'))
                .and(tIssue.status.equals('open')))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(dynSql).toBe(ctx.lastSql)
        expect(dynParams).toEqual(ctx.lastParams)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "id" from "organization" inner join project on project.organization_id = "organization".id inner join issue on issue.project_id = project.id where "organization".id = :0 and project.slug = :1 and issue.status = :2 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "mktg-site",
            "open",
          ]
        `)
        assertType<Exact<typeof dyn, Array<{ id: number }>>>()
        expect(dyn).toEqual(expected)
        expect(direct).toEqual(expected)
    })

    test('always-if/four-table-source-union-matches-direct', async () => {
        // Arity-4: a four-table source union (organization + project + issue +
        // app_user). Adds an assignee-name predicate → issue 1 is assigned to Ada.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        let w = ctx.conn.dynamicBooleanExpressionUsing(tOrganization, tProject, tIssue, tAppUser)
        w = w.and(tOrganization.id.equals(1))
        w = w.and(tProject.slug.equals('mktg-site'))
        w = w.and(tIssue.status.equals('open'))
        w = w.and(tAppUser.fullName.equals('Ada Lovelace'))
        const dyn = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId))
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        const dynSql = ctx.lastSql
        const dynParams = ctx.lastParams

        ctx.mockNext(expected)
        const direct = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId))
            .where(tOrganization.id.equals(1)
                .and(tProject.slug.equals('mktg-site'))
                .and(tIssue.status.equals('open'))
                .and(tAppUser.fullName.equals('Ada Lovelace')))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(dynSql).toBe(ctx.lastSql)
        expect(dynParams).toEqual(ctx.lastParams)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "id" from "organization" inner join project on project.organization_id = "organization".id inner join issue on issue.project_id = project.id inner join app_user on app_user.id = issue.assignee_id where "organization".id = :0 and project.slug = :1 and issue.status = :2 and app_user.full_name = :3 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "mktg-site",
            "open",
            "Ada Lovelace",
          ]
        `)
        assertType<Exact<typeof dyn, Array<{ id: number }>>>()
        expect(dyn).toEqual(expected)
        expect(direct).toEqual(expected)
    })

    test('always-if/five-table-source-union-matches-direct', async () => {
        // Arity-5: the full five-table source union (organization + project + issue
        // + app_user + issue_worklog) — the top rung of the overload ladder. Adds a
        // worklog-activity predicate → worklog 1 (issue 1's 'coding' worklog).
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        let w = ctx.conn.dynamicBooleanExpressionUsing(tOrganization, tProject, tIssue, tAppUser, tIssueWorklog)
        w = w.and(tOrganization.id.equals(1))
        w = w.and(tProject.slug.equals('mktg-site'))
        w = w.and(tIssue.status.equals('open'))
        w = w.and(tAppUser.fullName.equals('Ada Lovelace'))
        w = w.and(tIssueWorklog.activity.equals('coding'))
        const dyn = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId))
            .innerJoin(tIssueWorklog).on(tIssueWorklog.issueId.equals(tIssue.id))
            .where(w)
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        const dynSql = ctx.lastSql
        const dynParams = ctx.lastParams

        ctx.mockNext(expected)
        const direct = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId))
            .innerJoin(tIssueWorklog).on(tIssueWorklog.issueId.equals(tIssue.id))
            .where(tOrganization.id.equals(1)
                .and(tProject.slug.equals('mktg-site'))
                .and(tIssue.status.equals('open'))
                .and(tAppUser.fullName.equals('Ada Lovelace'))
                .and(tIssueWorklog.activity.equals('coding')))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()

        expect(dynSql).toBe(ctx.lastSql)
        expect(dynParams).toEqual(ctx.lastParams)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue_worklog.id as "id" from "organization" inner join project on project.organization_id = "organization".id inner join issue on issue.project_id = project.id inner join app_user on app_user.id = issue.assignee_id inner join issue_worklog on issue_worklog.issue_id = issue.id where "organization".id = :0 and project.slug = :1 and issue.status = :2 and app_user.full_name = :3 and issue_worklog.activity = :4 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "mktg-site",
            "open",
            "Ada Lovelace",
            "coding",
          ]
        `)
        assertType<Exact<typeof dyn, Array<{ id: number }>>>()
        expect(dyn).toEqual(expected)
        expect(direct).toEqual(expected)
    })
})
