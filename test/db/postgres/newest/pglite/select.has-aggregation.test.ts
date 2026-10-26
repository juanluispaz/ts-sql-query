// Aggregation introspection over a built SELECT: `queryHasAggregation(query)`
// answers "does this query contain an aggregate anywhere?" without rendering
// SQL, by walking the same clauses the SQL builder renders.
//
// The walker opens, in order: join `on` conditions, `where`, `having`,
// `group by`, `order by` terms that are value sources (plain string order-by
// names are output aliases and carry no expression to inspect), the projected
// columns — recursing into nested object projections — `limit` / `offset`,
// the `customizeQuery` fragment slots and, through an inline query value, the
// whole subquery behind it. A single aggregate anywhere short-circuits to
// `true`.
//
// This file covers the join `on`, `where`, `having`, `group by`, value-source
// `order by` and projection positions. `limit` / `offset`, the nine
// `customizeQuery` fragment slots and the compound-select (`union` /
// `intersect` / …) form of the walker are NOT covered here.
//
// Falsifiability is the organising principle of this file: every `true` is
// paired with a structurally similar `false`, so a walker that stopped
// inspecting one clause would flip exactly one pair and fail. Concretely:
//
//   - the first test drives the join `on`, `where`, `group by`, value-source
//     `order by` and projection positions at once with no aggregate in any of
//     them, so it is the control — a walker that reported `true`
//     unconditionally, or that mistook a plain column for an aggregate, fails
//     here and nowhere else;
//   - the `having` pair shares one query shape and differs only in whether the
//     `having` condition aggregates, with the projection kept aggregate-free in
//     both, so the verdict can only come from `having`;
//   - the `where` pair shares one query shape and one inline scalar subquery
//     position, differing only in whether that subquery aggregates, so the
//     verdict can only come from recursing THROUGH the inline subquery;
//   - the join-`on` and `order by` tests each place the only aggregate of the
//     query in that one clause.
//
// Every query here is ordinary SQL: an aggregate appears only in a projection,
// in `having`, in the `order by` of a grouped query, or inside a scalar
// subquery — never bare in `where`, in a join `on`, or in `group by`, where no
// engine accepts one.
//
// `queryHasAggregation` is the sanctioned introspection seam for the walker,
// which has no public API yet; see test/LIMITATIONS.md.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { queryHasAggregation } from '../../../../lib/queryIntrospection.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('has-aggregation/join-where-group-by-and-order-by-without-any-aggregate-reports-false', async () => {
        // The control for the whole file: a join with an `on`, a `where`, a
        // plain-column projection, a `group by` and a value-source `order by`
        // — every clause the walker opens is populated, and none of them holds
        // an aggregate. Organization 1 owns projects 1 ('Marketing site', with
        // issues 1 and 2) and 2 ('Internal tools', with issue 3), so grouping
        // the joined rows by project yields those two groups, ordered by
        // project id.
        const expected = [
            { projectId: 1, projectName: 'Marketing site' },
            { projectId: 2, projectName: 'Internal tools' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .innerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .where(tProject.organizationId.equals(1))
            .select({
                projectId:   tIssue.projectId,
                projectName: tProject.name,
            })
            .groupBy('projectId', 'projectName')
            .orderBy(tIssue.projectId)

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.project_id as "projectId", project.name as "projectName" from issue inner join project on project.id = issue.project_id where project.organization_id = $1 group by issue.project_id, project.name order by issue.project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; projectName: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/aggregate-in-projection-reports-aggregation', async () => {
        // The simplest positive: the aggregate IS a projected column. Grouping
        // the four issues by project gives project 1 two issues (1 and 2),
        // project 2 one (issue 3) and project 3 one (issue 4).
        const expected = [
            { projectId: 1, total: 2 },
            { projectId: 2, total: 1 },
            { projectId: 3, total: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                total:     connection.count(tIssue.id),
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId", count(id) as total from issue group by project_id order by "projectId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ projectId: number; total: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/aggregate-nested-inside-an-object-projection-reports-aggregation', async () => {
        // The aggregate is not a top-level projection key: it sits one level
        // down, inside the `stats` object. A column walk that only looked at
        // the top-level entries would report `false` here while the sibling
        // top-level test above still passed. The counts are the same per-project
        // issue counts (project 1 → 2, project 2 → 1, project 3 → 1); the nested
        // leaf is emitted as a dotted-alias scalar column.
        const expected = [
            { projectId: 1, stats: { total: 2 } },
            { projectId: 2, stats: { total: 1 } },
            { projectId: 3, stats: { total: 1 } },
        ]
        ctx.mockNext([
            { projectId: 1, 'stats.total': 2 },
            { projectId: 2, 'stats.total': 1 },
            { projectId: 3, 'stats.total': 1 },
        ])
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                stats: {
                    total: connection.countAll(),
                },
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId", count(*) as "stats.total" from issue group by project_id order by "projectId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            projectId: number
            stats: { total: number }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/nested-object-projection-without-aggregate-reports-false', async () => {
        // The negative twin of the nested-projection test above: the projection
        // has the same two-level shape, but its nested leaf is a plain column.
        // A walker that treated "the projection nests" as evidence of an
        // aggregate would report `true` here while the sibling still passed.
        // The four projects belong to organizations 1, 1, 2 and 2.
        const expected = [
            { id: 1, owner: { organizationId: 1 } },
            { id: 2, owner: { organizationId: 1 } },
            { id: 3, owner: { organizationId: 2 } },
            { id: 4, owner: { organizationId: 2 } },
        ]
        ctx.mockNext([
            { id: 1, 'owner.organizationId': 1 },
            { id: 2, 'owner.organizationId': 1 },
            { id: 3, 'owner.organizationId': 2 },
            { id: 4, 'owner.organizationId': 2 },
        ])
        const connection = ctx.conn

        const query = connection.selectFrom(tProject)
            .select({
                id: tProject.id,
                owner: {
                    organizationId: tProject.organizationId,
                },
            })
            .orderBy('id')

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, organization_id as "owner.organizationId" from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            id: number
            owner: { organizationId: number }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/aggregate-inside-a-comparison-in-the-projection-reports-aggregation', async () => {
        // The aggregate is an OPERAND of an operation, not the projected value
        // itself: the projected leaf is the boolean `count(id) > 1`. A walker
        // that only asked "is this projected value source an aggregate?"
        // without descending into the operation's operands would report `false`
        // here. Per-project issue counts are 2, 1 and 1, so only project 1 is
        // busy.
        const expected = [
            { projectId: 1, busy: true },
            { projectId: 2, busy: false },
            { projectId: 3, busy: false },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                busy:      connection.count(tIssue.id).greaterThan(1),
            })
            .groupBy('projectId')
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId", count(id) > $1 as busy from issue group by project_id order by "projectId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; busy: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/comparison-of-plain-columns-in-the-projection-reports-false', async () => {
        // The negative twin of the comparison test above: the projected leaf is
        // again a comparison rather than a bare column, but both operands are
        // plain columns. A walker that treated any operation node as
        // aggregating would report `true` here while the sibling still passed.
        // Issues 1 and 2 belong to project 1, issue 3 to project 2 and issue 4
        // to project 3.
        const expected = [
            { id: 1, sharedProject: false },
            { id: 2, sharedProject: false },
            { id: 3, sharedProject: true },
            { id: 4, sharedProject: true },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                id:            tIssue.id,
                sharedProject: tIssue.projectId.greaterThan(1),
            })
            .orderBy('id')

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, project_id > $1 as "sharedProject" from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; sharedProject: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/having-without-aggregate-reports-false', async () => {
        // A `having` clause is allowed to filter on the grouping expression
        // itself, with no aggregate involved. Nothing else in the query
        // aggregates either, so this is the negative half of the `having` pair:
        // a walker that reported `true` for any query that merely HAS a
        // `having` would fail here. Grouping the four issues by project yields
        // projects 1, 2 and 3; `project_id > 1` keeps 2 and 3.
        const expected = [
            { projectId: 2 },
            { projectId: 3 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({ projectId: tIssue.projectId })
            .groupBy('projectId')
            .having(tIssue.projectId.greaterThan(1))
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId" from issue group by project_id having project_id > $1 order by "projectId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/having-with-aggregate-reports-aggregation', async () => {
        // The positive half of the `having` pair: same shape as the sibling
        // above, same aggregate-free projection, and the `having` condition is
        // the only aggregating expression in the query — so the `true` can only
        // come from the walker opening `having`. Per-project issue counts are 2
        // (project 1), 1 (project 2) and 1 (project 3), so `count(id) > 1`
        // keeps project 1 alone.
        const expected = [
            { projectId: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({ projectId: tIssue.projectId })
            .groupBy('projectId')
            .having(connection.count(tIssue.id).greaterThan(1))
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId" from issue group by project_id having count(id) > $1 order by "projectId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/where-with-non-aggregating-inline-subquery-reports-false', async () => {
        // The negative half of the inline-subquery pair: the `where` compares
        // against a scalar subquery, and that subquery projects a plain column.
        // The walker has to descend into the subquery and come back empty — a
        // walker that reported `true` for any query merely CONTAINING an inline
        // subquery would fail here. Slug 'mktg-site' identifies project 1, whose
        // issues are 1 and 2.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const marketingProjectId = connection.selectFrom(tProject)
            .where(tProject.slug.equals('mktg-site'))
            .selectOneColumn(tProject.id)
            .forUseAsInlineQueryValue()

        const query = connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(marketingProjectId))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .orderBy('id')

        expect(queryHasAggregation(query)).toBe(false)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where project_id = (select id as result from project where slug = $1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "mktg-site",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; title: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/where-with-aggregating-inline-subquery-reports-aggregation', async () => {
        // The positive half of the inline-subquery pair: the outer query is
        // character-for-character the sibling above except that the scalar
        // subquery now projects `max(id)` instead of the bare column. The outer
        // query aggregates nowhere, so the `true` can only come from the walker
        // recursing THROUGH the inline query value into the subquery's own
        // projection. Slug 'mktg-site' identifies project 1, so the subquery
        // still evaluates to 1 and the outer query still returns project 1's
        // issues.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const marketingProjectId = connection.selectFrom(tProject)
            .where(tProject.slug.equals('mktg-site'))
            .selectOneColumn(connection.max(tProject.id))
            .forUseAsInlineQueryValue()

        const query = connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(marketingProjectId))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .orderBy('id')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where project_id = (select max(id) as result from project where slug = $1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "mktg-site",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; title: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/join-on-with-aggregating-inline-subquery-reports-aggregation', async () => {
        // The only aggregate of the query lives in the join `on` condition,
        // reached through a scalar subquery — the one legal way to put an
        // aggregate there, since a bare aggregate in `on` is rejected by every
        // engine. Nothing else in the query aggregates, so the `true` can only
        // come from the walker opening join conditions. The extra `on` term
        // narrows the join to the projects of the oldest organization: the
        // lowest organization id is 1, which owns projects 1 ('Marketing site')
        // and 2 ('Internal tools'), so issues 1, 2 and 3 survive and issue 4 —
        // whose project belongs to organization 2 — does not.
        const expected = [
            { issueId: 1, projectName: 'Marketing site' },
            { issueId: 2, projectName: 'Marketing site' },
            { issueId: 3, projectName: 'Internal tools' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const oldestOrganizationId = connection.selectFrom(tOrganization)
            .selectOneColumn(connection.min(tOrganization.id))
            .forUseAsInlineQueryValue()

        const query = connection.selectFrom(tIssue)
            .innerJoin(tProject).on(
                tProject.id.equals(tIssue.projectId)
                    .and(tProject.organizationId.equals(oldestOrganizationId)),
            )
            .select({
                issueId:     tIssue.id,
                projectName: tProject.name,
            })
            .orderBy('issueId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "issueId", project.name as "projectName" from issue inner join project on project.id = issue.project_id and project.organization_id = (select min(id) as result from organization) order by "issueId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ issueId: number; projectName: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('has-aggregation/order-by-an-aggregate-expression-reports-aggregation', async () => {
        // The only aggregate of the query is an `order by` term, reached through
        // the value-source `orderBy(...)` overload; the projection deliberately
        // does NOT carry it, so a walker that skipped `order by` would report
        // `false` while every other test in the file still passed. Per-project
        // issue counts are project 1 → 2, project 2 → 1, project 3 → 1;
        // ordering by that count ascending puts projects 2 and 3 first, and the
        // secondary `orderBy('projectId')` breaks their tie.
        const expected = [
            { projectId: 2 },
            { projectId: 3 },
            { projectId: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({ projectId: tIssue.projectId })
            .groupBy('projectId')
            .orderBy(connection.count(tIssue.id))
            .orderBy('projectId')

        expect(queryHasAggregation(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId" from issue group by project_id order by count(issue.id), "projectId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ projectId: number }>>>()
        expect(rows).toEqual(expected)
    })
})
