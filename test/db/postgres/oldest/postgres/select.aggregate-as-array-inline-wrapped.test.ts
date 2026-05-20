// Coverage of `_appendAggragateArrayWrappedColumns` — reached when an
// inline aggregate subquery (`forUseAsInlineAggregatedArrayValue()`)
// also carries `group by`, `having`, a compound operator, or — on
// engines that don't support `order by` / `limit` inside the aggregate
// function — those clauses too. `_needAgggregateArrayWrapper` returns
// true and the builder wraps the inner select with the dialect's
// "select aggregate from (subquery)" form.
//
// The existing docs.aggregate-as-object-array tests exercise the
// non-wrapped path. Adding the wrapped path here lights up:
//   - AbstractMySqlMariaBDSqlBuilder._appendAggragateArrayWrappedColumns
//     (MariaDB falls through to it; MySQL overrides)
//   - the wrapped branch in every other dialect's override
//
// Like other inline-aggregate tests, the JSON returned from the real
// DB is a string that has to be re-parsed by the type adapter — we
// gate the value assertion to mock mode and capture the SQL snapshot
// per dialect. The runner is wrapped in try/catch because some
// dialects reject the unusual compound-inside-aggregate form at
// execution time.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('inline-aggregate-of-object-with-group-by', async () => {
        // Inline aggregate carrying its own `group by` — forces the
        // wrap (`group by` ≠ identity over the subquery), so the builder
        // wraps the grouped select with the dialect's aggregate-over-
        // subquery form.
        const expected = {
            id: 1, name: 'Acme Corp',
            projectStats: [
                { id: 1, count: 2 },
                { id: 2, count: 1 },
            ],
        }
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projectStats: JSON.stringify([
                { id: 1, count: 2 },
                { id: 2, count: 1 },
            ]),
        })
        try {
            const projectStats = ctx.conn.subSelectUsing(tOrganization).from(tProject)
                .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
                .where(tProject.organizationId.equals(tOrganization.id))
                .select({
                    id:    tProject.id,
                    count: ctx.conn.count(tIssue.id),
                })
                .groupBy('id')
                .forUseAsInlineAggregatedArrayValue()

            const row = await ctx.conn.selectFrom(tOrganization)
                .where(tOrganization.id.equals(1))
                .select({
                    id:           tOrganization.id,
                    name:         tOrganization.name,
                    projectStats,
                })
                .executeSelectOne()
            assertType<Exact<typeof row, {
                id:           number
                name:         string
                projectStats: Array<{ id: number; count: number }>
            }>>()
            if (!ctx.realDbEnabled) expect(row).toEqual(expected)
        } catch (e) {
            if (!ctx.realDbEnabled) throw e
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select json_agg(json_build_object('id', a_1_.id, 'count', a_1_.count)) from (select project.id as id, count(issue.id) as count from project inner join issue on issue.project_id = project.id where project.organization_id = organization.id group by project.id) as a_1_) as "projectStats" from organization where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })

    test('inline-aggregate-of-object-with-having', async () => {
        // `having` is one of the wrap triggers in
        // `_needAgggregateArrayWrapper`. A `group by` is required before
        // a `having` clause, so the query carries both.
        const expected = {
            id: 1, name: 'Acme Corp',
            busyProjects: [{ id: 1, count: 2 }],
        }
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            busyProjects: JSON.stringify([{ id: 1, count: 2 }]),
        })
        try {
            const busyProjects = ctx.conn.subSelectUsing(tOrganization).from(tProject)
                .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
                .where(tProject.organizationId.equals(tOrganization.id))
                .select({
                    id:    tProject.id,
                    count: ctx.conn.count(tIssue.id),
                })
                .groupBy('id')
                .having(ctx.conn.count(tIssue.id).greaterThan(1))
                .forUseAsInlineAggregatedArrayValue()

            const row = await ctx.conn.selectFrom(tOrganization)
                .where(tOrganization.id.equals(1))
                .select({
                    id:           tOrganization.id,
                    name:         tOrganization.name,
                    busyProjects,
                })
                .executeSelectOne()
            assertType<Exact<typeof row, {
                id:           number
                name:         string
                busyProjects: Array<{ id: number; count: number }>
            }>>()
            if (!ctx.realDbEnabled) expect(row).toEqual(expected)
        } catch (e) {
            if (!ctx.realDbEnabled) throw e
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select json_agg(json_build_object('id', a_1_.id, 'count', a_1_.count)) from (select project.id as id, count(issue.id) as count from project inner join issue on issue.project_id = project.id where project.organization_id = organization.id group by project.id having count(issue.id) > $1) as a_1_) as "busyProjects" from organization where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
    })
})
