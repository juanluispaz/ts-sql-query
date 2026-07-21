// Coverage of SELECT subquery shapes that the existing suite does
// not pin. The current coverage:
//
//   - `select.subqueries.test.ts` — scalar subquery in projection,
//     `in`/`exists`/`notExists` in WHERE.
//   - `select.in-subquery.test.ts` / `select.where.inline-subquery.test.ts`
//     — `in(select)` and inline subquery as WHERE condition.
//   - `select.cte.test.ts` / `cte.chained.test.ts` — `forUseInQueryAs`
//     bubble-up and chained CTEs.
//
// The shapes still uncovered are subqueries in positions that route
// through different `AbstractSqlBuilder` paths:
//
//   1. Scalar correlated subquery in `ORDER BY` — sort by a derived
//      per-row value (e.g. "order issues by their project's name").
//      Lands on `_appendOrderBy` with a non-column source.
//   2. Scalar correlated subquery in `GROUP BY` — group by a derived
//      key. Pins `_appendGroupBy` with a value-source key instead of
//      a plain column.
//   3. Scalar subquery comparison in `HAVING` — `HAVING <agg> >
//      <scalar-subquery>`. Pins `_appendHaving` with a subquery RHS.
//   4. Two correlated subqueries side-by-side in the projection —
//      `subSelectUsing(t).from(...)` for each per-row derived field.
//   5. Two CTEs in `WITH` where the second one selects FROM the first
//      AND from a base table, then the outer SELECT joins the second
//      CTE to another base table. Pins the multi-level CTE-bubble +
//      JOIN paths.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject, tOrganization, tIssueWorklog} from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('scalar-correlated-subquery-in-order-by', async () => {
        // Sort the 4 issues by the name of their parent project.
        // Project names: 1='Marketing site', 2='Internal tools',
        // 3='Public API', 4='Legacy app'. Issue→project:
        //   1→1 (Marketing site), 2→1 (Marketing site), 3→2 (Internal),
        //   4→3 (Public API).
        // Alphabetical order of project name: Internal, Marketing,
        // Marketing, Public — so issue ids 3, 1, 2, 4.
        const expected = [
            { id: 3 },
            { id: 1 },
            { id: 2 },
            { id: 4 },
        ]
        ctx.mockNext(expected)

        const rows = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy(
                ctx.conn.subSelectUsing(tIssue).from(tProject)
                    .where(tProject.id.equals(tIssue.projectId))
                    .selectOneColumn(tProject.name)
                    .forUseAsInlineQueryValue(),
            )
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by (select name as result from project where id = issue.project_id)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('scalar-correlated-subquery-in-group-by', async () => {
        // Group issues by their project's organization id (derived via
        // a correlated scalar subquery), aggregate count per group.
        // Seeded mapping:
        //   issue 1,2 → project 1 → org 1
        //   issue 3   → project 2 → org 1
        //   issue 4   → project 3 → org 2
        // Result: org 1 has 3 issues, org 2 has 1 issue.
        const expected = [
            { orgId: 1, total: 3 },
            { orgId: 2, total: 1 },
        ]
        ctx.mockNext(expected)

        const orgIdSub = ctx.conn.subSelectUsing(tIssue).from(tProject)
            .where(tProject.id.equals(tIssue.projectId))
            .selectOneColumn(tProject.organizationId)
            .forUseAsInlineQueryValue()

        const rows = await ctx.conn.selectFrom(tIssue)
            .groupBy(orgIdSub)
            .select({
                orgId: orgIdSub,
                total: ctx.conn.count(tIssue.id),
            })
            .orderBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select organization_id as result from project where id = issue.project_id) as orgId, count(id) as total from issue group by (select organization_id as result from project where id = issue.project_id) order by orgId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        // `orgId` is `number | undefined` at the type level because
        // the correlated subquery could return zero rows (the type
        // system can't see that the WHERE makes that impossible).
        assertType<Exact<typeof rows, Array<{ orgId?: number; total: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('scalar-subquery-in-having-clause', async () => {
        // HAVING with a scalar uncorrelated subquery on the RHS. Group
        // issues by status, keep groups whose count is strictly
        // greater than (SELECT count(*) FROM project WHERE
        // archived_at IS NOT NULL) = 1 (only 'Legacy app' is
        // archived). Status counts: open=2, in_progress=1, closed=1
        // — only `open` survives (2 > 1).
        const expected = [{ status: 'open', total: 2 }]
        ctx.mockNext(expected)

        const archivedCount = ctx.conn.selectFrom(tProject)
            .where(tProject.archivedAt.isNotNull())
            .selectOneColumn(ctx.conn.count(tProject.id))
            .forUseAsInlineQueryValue()

        const rows = await ctx.conn.selectFrom(tIssue)
            .groupBy(tIssue.status)
            .having(ctx.conn.count(tIssue.id).greaterThan(archivedCount))
            .select({
                status: tIssue.status,
                total:  ctx.conn.count(tIssue.id),
            })
            .orderBy('status')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status, count(id) as total from issue group by status having count(id) > (select count(id) as result from project where archived_at is not null) order by status"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ status: string; total: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('two-correlated-subqueries-side-by-side-in-projection', async () => {
        // Two `subSelectUsing` projections in one SELECT, both
        // correlated through `tIssue`. Pins the case where multiple
        // scalar subqueries share the outer source — each must walk
        // its own param list and emit independently. For each issue,
        // project the project's name AND the project's organization
        // id.
        const expected = [
            { id: 1, projName: 'Marketing site',  orgId: 1 },
            { id: 2, projName: 'Marketing site',  orgId: 1 },
            { id: 3, projName: 'Internal tools',  orgId: 1 },
            { id: 4, projName: 'Public API',      orgId: 2 },
        ]
        ctx.mockNext(expected)

        const rows = await ctx.conn.selectFrom(tIssue)
            .select({
                id:       tIssue.id,
                projName: ctx.conn.subSelectUsing(tIssue).from(tProject)
                    .where(tProject.id.equals(tIssue.projectId))
                    .selectOneColumn(tProject.name)
                    .forUseAsInlineQueryValue(),
                orgId:    ctx.conn.subSelectUsing(tIssue).from(tProject)
                    .where(tProject.id.equals(tIssue.projectId))
                    .selectOneColumn(tProject.organizationId)
                    .forUseAsInlineQueryValue(),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (select name as result from project where id = issue.project_id) as projName, (select organization_id as result from project where id = issue.project_id) as orgId from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        // `projName` and `orgId` are typed optional for the same
        // reason as the GROUP BY test: inline subqueries are
        // optional-typed even when the WHERE guarantees a row.
        assertType<Exact<typeof rows, Array<{ id: number; projName?: string; orgId?: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('multi-level-cte-bubble-up-with-join', async () => {
        // Two CTEs in the same outer query, where the second selects
        // FROM the first. The outer SELECT then JOINs the second CTE
        // to a base table. Pins the multi-level `__addWiths` bubble
        // (each CTE's WITHs propagate up through the join) plus the
        // CTE-as-FROM-source handling.
        //
        // CTE shape:
        //   active_projects = projects with archivedAt IS NULL
        //   issues_in_active = issues whose projectId is in active_projects
        // Outer: issues_in_active JOIN organization to expose org plan.
        // Seed: projects 1,2,3 are active (4 is archived).
        //   issues 1,2 → project 1 → org 1 (plan='pro')
        //   issue  3   → project 2 → org 1 (plan='pro')
        //   issue  4   → project 3 → org 2 (plan='free')
        const expected = [
            { issueId: 1, plan: 'pro' },
            { issueId: 2, plan: 'pro' },
            { issueId: 3, plan: 'pro' },
            { issueId: 4, plan: 'free' },
        ]
        ctx.mockNext(expected)

        const activeProjects = ctx.conn.selectFrom(tProject)
            .where(tProject.archivedAt.isNull())
            .select({
                id:             tProject.id,
                organizationId: tProject.organizationId,
            })
            .forUseInQueryAs('active_projects')

        const issuesInActive = ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.in(
                ctx.conn.selectFrom(activeProjects).selectOneColumn(activeProjects.id),
            ))
            .select({
                id:        tIssue.id,
                projectId: tIssue.projectId,
            })
            .forUseInQueryAs('issues_in_active')

        const rows = await ctx.conn.selectFrom(issuesInActive)
            .innerJoin(activeProjects)
                .on(activeProjects.id.equals(issuesInActive.projectId))
            .innerJoin(tOrganization)
                .on(tOrganization.id.equals(activeProjects.organizationId))
            .select({
                issueId: issuesInActive.id,
                plan:    tOrganization.plan,
            })
            .orderBy('issueId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with active_projects as (select id as id, organization_id as organizationId from project where archived_at is null), issues_in_active as (select id as id, project_id as projectId from issue where project_id in (select id as result from active_projects)) select issues_in_active.id as issueId, organization.plan as plan from issues_in_active inner join active_projects on active_projects.id = issues_in_active.projectId inner join organization on organization.id = active_projects.organizationId order by issueId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ issueId: number; plan: string }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('compound-as-inline-query-value', async () => {
        // A COMPOUND select fed to `forUseAsInlineQueryValue()`. The union of
        // two identical single-row counts dedups to one row, so it is
        // scalar-safe in the projection. There are 4 issues, so the inline
        // value is 4.
        const expected = [{ total: 4 }]
        ctx.mockNext(expected)
        const totalIssues = ctx.conn.selectFrom(tIssue).selectOneColumn(ctx.conn.count(tIssue.id))
            .union(ctx.conn.selectFrom(tIssue).selectOneColumn(ctx.conn.count(tIssue.id)))
            .forUseAsInlineQueryValue()
        const rows = await ctx.conn.selectFromNoTable()
            .select({ total: totalIssues })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select count(id) as result from issue union select count(id) as result from issue) as total"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ total?: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('compound-as-derived-table-via-for-use-in-query-as', async () => {
        // A COMPOUND select fed to `forUseInQueryAs(...)` — used as a derived
        // table / CTE the outer query selects from. The union of the open and
        // closed statuses yields {'closed', 'open'} after dedup.
        const expected = [{ s: 'closed' }, { s: 'open' }]
        ctx.mockNext(expected)
        const statuses = ctx.conn.selectFrom(tIssue).where(tIssue.status.equals('open')).select({ s: tIssue.status })
            .union(ctx.conn.selectFrom(tIssue).where(tIssue.status.equals('closed')).select({ s: tIssue.status }))
            .forUseInQueryAs('statuses')
        const rows = await ctx.conn.selectFrom(statuses)
            .select({ s: statuses.s })
            .orderBy('s')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with statuses as (select status as \`s\` from issue where status = ? union select status as \`s\` from issue where status = ?) select \`s\` as \`s\` from statuses order by \`s\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "closed",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ s: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('compound-order-by-as-derived-table-via-for-use-in-query-as', async () => {
        // A COMPOUND select carrying its OWN `.orderBy(...)` before
        // `forUseInQueryAs(...)`: the ordering renders INSIDE the derived-table /
        // CTE body (`with statuses as (... order by "s" desc)`), not on the outer
        // query. The outer select re-orders for a deterministic result. Same
        // {'closed', 'open'} dedup as the sibling above.
        const expected = [{ s: 'closed' }, { s: 'open' }]
        ctx.mockNext(expected)
        const statuses = ctx.conn.selectFrom(tIssue).where(tIssue.status.equals('open')).select({ s: tIssue.status })
            .union(ctx.conn.selectFrom(tIssue).where(tIssue.status.equals('closed')).select({ s: tIssue.status }))
            .orderBy('s', 'desc')
            .forUseInQueryAs('statuses')
        const rows = await ctx.conn.selectFrom(statuses)
            .select({ s: statuses.s })
            .orderBy('s')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with statuses as (select status as \`s\` from issue where status = ? union select status as \`s\` from issue where status = ? order by \`s\` desc) select \`s\` as \`s\` from statuses order by \`s\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "closed",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ s: string }>>>()
        expect(rows).toEqual(expected)
    })

    // TODO[LIMITATION]: see LIMITATIONS.md — json_arrayagg (aggregateAsArray / JSON array projection) requires MariaDB 10.5+; earlier releases have no json_arrayagg function.
    /*
    test('compound-as-inline-aggregated-array-value', async () => {
        // A union fed to `forUseAsInlineAggregatedArrayValue()`: the compound is
        // aggregated into a scalar array in the projection. The open and closed
        // one-column selects dedup to {'open', 'closed'}. json_agg order is
        // engine-defined, so the array is JS-sorted before the exact comparison.
        const expected = [{ statuses: ['closed', 'open'] }]
        ctx.mockNext([{ statuses: ['open', 'closed'] }])
        const statusArray = ctx.conn.selectFrom(tIssue).where(tIssue.status.equals('open')).selectOneColumn(tIssue.status)
            .union(ctx.conn.selectFrom(tIssue).where(tIssue.status.equals('closed')).selectOneColumn(tIssue.status))
            .forUseAsInlineAggregatedArrayValue()
        const rows = await ctx.conn.selectFromNoTable()
            .select({ statuses: statusArray })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast((select json_arrayagg(a_1_.result) from (select status as result from issue where status = ? union select status as result from issue where status = ?) as a_1_) as char) as statuses"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "closed",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ statuses: string[] }>>>()
        const sorted = rows.map((r) => ({ ...r, statuses: [...r.statuses].sort() }))
        expect(sorted).toEqual(expected)
    })
    */

    test('inline-query-value-null-inhabitant-default-projector', async () => {
        // A correlated scalar subquery consumed via `forUseAsInlineQueryValue()`
        // realizes its optional-leaf NULL inhabitant: the leaf is typed `m?: number`
        // (optional because a scalar subquery may return zero rows), and here the
        // empty-subquery rows realize that NULL. `m` = the minutes of the issue's
        // 'coding' worklog. Only issue 1 has a 'coding' worklog (worklog 1, minutes
        // 90); issues 2/3/4 have none, so the subquery returns zero rows → the leaf
        // is NULL. Under the DEFAULT projector a null optional leaf is DROPPED
        // (`'m' in row === false`), not surfaced as present-null.
        const raw = [
            { id: 1, m: 90 },
            { id: 2, m: null },
            { id: 3, m: null },
            { id: 4, m: null },
        ]
        const expected = [{ id: 1, m: 90 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(raw)
        const codingMinutes = ctx.conn.subSelectUsing(tIssue).from(tIssueWorklog)
            .where(tIssueWorklog.issueId.equals(tIssue.id)
                .and(tIssueWorklog.activity.equals('coding')))
            .selectOneColumn(tIssueWorklog.minutes)
            .forUseAsInlineQueryValue()
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, m: codingMinutes })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (select minutes as result from issue_worklog where issue_id = issue.id and activity = ?) as \`m\` from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "coding",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; m?: number }>>>()
        expect(rows).toEqual(expected)
        // The empty-subquery rows drop the leaf entirely under the default projector.
        expect('m' in rows[1]!).toBe(false)
        expect('m' in rows[0]!).toBe(true)
    })

    test('inline-query-value-null-inhabitant-projecting-optionals-as-nullable', async () => {
        // Same correlated inline-query-value scalar subquery, but the OUTER select
        // carries `.projectingOptionalValuesAsNullable()`. Now the optional leaf is
        // typed `m: number | null` and the empty-subquery NULL is surfaced as
        // PRESENT-null (`'m' in row === true`, `row.m === null`) rather than dropped.
        // The emitted SQL is identical to the default projector — the flag only
        // reshapes the TypeScript type and the null-handling at result time.
        const expected = [
            { id: 1, m: 90 },
            { id: 2, m: null },
            { id: 3, m: null },
            { id: 4, m: null },
        ]
        ctx.mockNext(expected)
        const codingMinutes = ctx.conn.subSelectUsing(tIssue).from(tIssueWorklog)
            .where(tIssueWorklog.issueId.equals(tIssue.id)
                .and(tIssueWorklog.activity.equals('coding')))
            .selectOneColumn(tIssueWorklog.minutes)
            .forUseAsInlineQueryValue()
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, m: codingMinutes })
            .projectingOptionalValuesAsNullable()
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (select minutes as result from issue_worklog where issue_id = issue.id and activity = ?) as \`m\` from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "coding",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; m: number | null }>>>()
        expect(rows).toEqual(expected)
        // The empty-subquery NULL is present-null under the nullable projector.
        expect('m' in rows[1]!).toBe(true)
        expect(rows[1]!.m).toBe(null)
    })
})
