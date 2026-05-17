// Behavioral coverage of joins: innerJoin (already in select.basic but
// repeated for depth), leftJoin, multiple-table join, and join-with-alias.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('inner-join-with-where', async () => {
        const expected = [
            { id: 1, projectName: 'Marketing site' },
            { id: 2, projectName: 'Marketing site' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .innerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .where(tProject.organizationId.equals(1))
              .and(tIssue.projectId.equals(1))
            .select({
                id:          tIssue.id,
                projectName: tProject.name,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, project.name as "projectName" from issue inner join project on project.id = issue.project_id where project.organization_id = $1 and issue.project_id = $2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:          number
            projectName: string
        }>>>()
        expect(result).toEqual(expected)
    })

    test('left-join-may-be-null', async () => {
        // Issue 3 (Migrate to ESM) has assignee_id = NULL. The library
        // strips null-valued optional columns from the result object, so
        // the row comes back as `{ id: 3 }` (no `assigneeName` key) rather
        // than `{ id: 3, assigneeName: null }`.
        const expected = [{ id: 3 }]
        ctx.mockNext([{ id: 3, assigneeName: null }])
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .leftJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .where(tIssue.assigneeId.isNull())
            .select({
                id:           tIssue.id,
                assigneeName: assignee.fullName,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, app_user.full_name as "assigneeName" from issue left join app_user on app_user.id = issue.assignee_id where issue.assignee_id is null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{
            id:            number
            assigneeName?: string
        }>>>()
        expect(result).toEqual(expected)
    })

    test('three-table-join', async () => {
        const expected = [
            { issueId: 1, projectName: 'Marketing site', orgName: 'Acme Corp' },
            { issueId: 2, projectName: 'Marketing site', orgName: 'Acme Corp' },
            { issueId: 3, projectName: 'Internal tools', orgName: 'Acme Corp' },
            { issueId: 4, projectName: 'Public API',     orgName: 'Globex Ltd' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .innerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .select({
                issueId:     tIssue.id,
                projectName: tProject.name,
                orgName:     tOrganization.name,
            })
            .orderBy('issueId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "issueId", project.name as "projectName", organization.name as "orgName" from issue inner join project on project.id = issue.project_id inner join organization on organization.id = project.organization_id order by "issueId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{
            issueId:     number
            projectName: string
            orgName:     string
        }>>>()
        expect(result).toEqual(expected)
    })

    test('join-with-alias', async () => {
        const expected = [
            { id: 1, child: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const parent = tIssue.as('parent')
        const child  = tIssue.as('child')
        const result = await ctx.conn.selectFrom(parent)
            .innerJoin(child).on(child.parentId.equals(parent.id))
            .select({
                id:    parent.id,
                child: child.title,
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select parent.id as id, child.title as child from issue as parent inner join issue as child on child.parent_id = parent.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{
            id:    number
            child: string
        }>>>()
        if (!ctx.realDbEnabled) expect(result).toEqual(expected)
    })
})
