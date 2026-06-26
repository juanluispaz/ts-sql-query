// Behavioral coverage of subqueries: scalar subquery in projection,
// IN (subquery), EXISTS, and NOT EXISTS.
//
// Correlated subqueries (the inner query referencing a column from the
// outer table) require `subSelectUsing(outerTable)` so the inner builder
// knows the outer columns are in scope.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('scalar-subquery-as-projection', async () => {
        const expected = [
            { id: 1, name: 'Marketing site', issueCount: 2 },
            { id: 2, name: 'Internal tools', issueCount: 1 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .where(tProject.organizationId.equals(1))
            .select({
                id:         tProject.id,
                name:       tProject.name,
                issueCount: ctx.conn.subSelectUsing(tProject)
                    .from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .selectOneColumn(ctx.conn.countAll())
                    .forUseAsInlineQueryValue(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", name as "name", (select count(*) as "result" from issue where project_id = project.id) as "issueCount" from project where organization_id = :0 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        // forUseAsInlineQueryValue widens to optional because the scalar
        // subquery is allowed to return no rows.
        assertType<Exact<typeof result, Array<{
            id:          number
            name:        string
            issueCount?: number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('in-subquery', async () => {
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.in(
                ctx.conn.selectFrom(tIssue)
                    .selectOneColumn(tIssue.projectId)
            ))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", name as "name" from project where id in (select project_id as "result" from issue) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{
            id:   number
            name: string
        }>>>()
        expect(result).toEqual(expected)
    })

    test('exists', async () => {
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .where(ctx.conn.exists(
                ctx.conn.subSelectUsing(tProject)
                    .from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .selectOneColumn(tIssue.id)
            ))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", name as "name" from project where exists(select id as "result" from issue where project_id = project.id) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{
            id:   number
            name: string
        }>>>()
        expect(result).toEqual(expected)
    })

    test('not-exists', async () => {
        const expected = [{ id: 4, name: 'Legacy app' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .where(ctx.conn.notExists(
                ctx.conn.subSelectUsing(tProject)
                    .from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .selectOneColumn(tIssue.id)
            ))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", name as "name" from project where not exists(select id as "result" from issue where project_id = project.id) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{
            id:   number
            name: string
        }>>>()
        expect(result).toEqual(expected)
    })

    test('sub-select-using-two-correlated-tables', async () => {
        // subSelectUsing with TWO correlated outer tables (tOrganization +
        // tProject): the subquery counts issues in the joined project, gated by
        // the org↔project link, so it references both correlated tables.
        const expected = [
            { projectId: 1, issueCount: 2 },
            { projectId: 2, issueCount: 1 },
            { projectId: 3, issueCount: 1 },
            { projectId: 4, issueCount: 0 },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .select({
                projectId:  tProject.id,
                issueCount: ctx.conn.subSelectUsing(tOrganization, tProject).from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id)
                        .and(tProject.organizationId.equals(tOrganization.id)))
                    .selectCountAll()
                    .forUseAsInlineQueryValue(),
            })
            .orderBy('projectId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "projectId", (select count(*) as "result" from issue where project_id = project.id and project.organization_id = "organization".id) as "issueCount" from "organization" inner join project on project.organization_id = "organization".id order by "projectId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ projectId: number; issueCount: number }>>>()
        expect(rows).toEqual(expected)
    })
})
