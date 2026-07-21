// `UPDATE … FROM …` combined with `oldValues()` and a RETURNING
// projection that references **multiple** columns of the joined-in
// table forces the synthesised `old.` subquery to order its extra
// column list by `(tableName, columnName)` so the emitted SQL is
// deterministic. With only one extra column the ordering never matters;
// this file extracts two columns from the same FROM table (exercising
// the column-name tiebreak) and one from a second FROM table
// (exercising the table-name comparison).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('update-from-old-values-with-two-columns-from-same-from-table-sorts-by-column-name', async () => {
        // RETURNING references both `organization.name` and
        // `organization.plan` from the same FROM table; the synthesised
        // `old.` subquery orders extra columns by column name, so `name`
        // precedes `plan` in the emitted SQL.
        // project 1 → org 1 (Acme Corp, plan='pro' per seed).
        const expectedRow = {
            id:      1,
            oldName: 'Marketing site',
            newName: 'Marketing site / Acme',
            orgName: 'Acme Corp',
            orgPlan: 'pro',
        }
        ctx.mockNext(expectedRow)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .from(tOrganization)
                .set({
                    name: tProject.name.concat(' / Acme'),
                })
                .where(tProject.id.equals(1))
                .and(tProject.organizationId.equals(tOrganization.id))
                .returning({
                    id:      tProject.id,
                    oldName: oldProject.name,
                    newName: tProject.name,
                    orgName: tOrganization.name,
                    orgPlan: tOrganization.plan,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = project.name + @0 output inserted.id as id, deleted.name as oldName, inserted.name as newName, organization.name as orgName, organization.[plan] as orgPlan from organization where project.id = @1 and project.organization_id = organization.id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " / Acme",
                1,
              ]
            `)
            assertType<Exact<typeof row, {
                id:      number
                oldName: string
                newName: string
                orgName: string
                orgPlan: string
            }>>()
            expect(row).toEqual(expectedRow)
        })
    })

    test('update-from-old-values-with-columns-from-two-from-tables-sorts-by-table-then-column', async () => {
        // RETURNING references columns from TWO joined-in tables —
        // `organization.name` and `app_user.full_name`. Extra columns
        // are ordered by table name first (`app_user` before
        // `organization`), then by column name within each table.
        // issue 1: title='Update hero copy', assignee 1 (Ada Lovelace),
        // project 1 → org 1 (Acme Corp).
        const expectedRow = {
            id:        1,
            oldTitle:  'Update hero copy',
            newTitle:  'Update hero copy / Ada @ Acme',
            assignee:  'Ada Lovelace',
            orgName:   'Acme Corp',
        }
        ctx.mockNext(expectedRow)

        await ctx.withRollback(async () => {
            const oldIssue = tIssue.oldValues()
            const row = await ctx.conn.update(tIssue)
                .from(tAppUser)
                .from(tOrganization)
                .from(tProject)
                .set({
                    title: tIssue.title.concat(' / Ada @ Acme'),
                })
                .where(tIssue.id.equals(1))
                .and(tIssue.assigneeId.equals(tAppUser.id))
                .and(tIssue.projectId.equals(tProject.id))
                .and(tProject.organizationId.equals(tOrganization.id))
                .returning({
                    id:       tIssue.id,
                    oldTitle: oldIssue.title,
                    newTitle: tIssue.title,
                    assignee: tAppUser.fullName,
                    orgName:  tOrganization.name,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = issue.title + @0 output inserted.id as id, deleted.title as oldTitle, inserted.title as newTitle, app_user.full_name as assignee, organization.name as orgName from app_user, organization, project where issue.id = @1 and issue.assignee_id = app_user.id and issue.project_id = project.id and project.organization_id = organization.id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " / Ada @ Acme",
                1,
              ]
            `)
            assertType<Exact<typeof row, {
                id:       number
                oldTitle: string
                newTitle: string
                assignee: string
                orgName:  string
            }>>()
            expect(row).toEqual(expectedRow)
        })
    })
})
