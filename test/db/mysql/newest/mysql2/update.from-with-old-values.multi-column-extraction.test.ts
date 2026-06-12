// `UPDATE … FROM …` combined with `oldValues()` and a RETURNING
// projection that references **multiple** columns of the joined-in
// table forces the sort comparator inside `_buildOldValuesForUpdate`
// to actually fire. That comparator at
// [src/sqlBuilders/AbstractSqlBuilder.ts:2205-2228](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L2205-L2228)
// orders the synthesised `_old_` subquery's additional column list by
// `(tableName, columnName)` so the emitted SQL is deterministic across
// runs — irrelevant when only one extra column is extracted, but
// load-bearing as soon as two or more land in the same subquery.
//
// The sibling `update.with-old-values-and-from.test.ts` only projects
// ONE additional column (`organization.name`) so the sort never runs.
// This file adds a second extracted column from the same joined-in
// table to exercise the `t1Name === t2Name` tiebreak branch
// (L2221-2226), plus a third column from a SECOND joined-in table to
// also exercise the `t1Name !== t2Name` table-comparison branch
// (L2215-2220).

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: MySQL has no RETURNING (oldValues() in a RETURNING projection needs it).
    /*
test('update-from-old-values-with-two-columns-from-same-from-table-sorts-by-column-name', async () => {
        // RETURNING references both `organization.name` and
        // `organization.plan`. Both come from the same FROM table, so
        // the `t1Name === t2Name` tiebreak branch (L2221-2226) of the
        // comparator fires. Lexicographic by column name puts `name`
        // before `plan` in the projection.
        ctx.mockNext({
            id:      1,
            oldName: 'Marketing site',
            newName: 'Marketing site / Acme',
            orgName: 'Acme Corp',
            orgPlan: 'enterprise',
        })

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = project.name || $1 from organization where project.id = $2 and project.organization_id = organization.id returning project.id as id, old.name as "oldName", project.name as "newName", organization.name as "orgName", organization.plan as "orgPlan""`)
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
            if (!ctx.realDbEnabled) {
                expect(row.orgName).toBe('Acme Corp')
                expect(row.orgPlan).toBe('enterprise')
            }
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING (oldValues() in a RETURNING projection needs it).
    /*
test('update-from-old-values-with-columns-from-two-from-tables-sorts-by-table-then-column', async () => {
        // RETURNING references columns from TWO joined-in tables —
        // `organization.name` and `app_user.full_name`. The comparator
        // must order by table name first (L2215-2220): `app_user`
        // sorts before `organization`. Within each table block, the
        // column-name tiebreak (L2221-2226) handles ordering.
        ctx.mockNext({
            id:        1,
            oldTitle:  'Update hero copy',
            newTitle:  'Hero copy / Ada @ Acme',
            assignee:  'Ada Lovelace',
            orgName:   'Acme Corp',
        })

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = issue.title || $1 from app_user, organization, project where issue.id = $2 and issue.assignee_id = app_user.id and issue.project_id = project.id and project.organization_id = organization.id returning issue.id as id, old.title as "oldTitle", issue.title as "newTitle", app_user.full_name as assignee, organization.name as "orgName""`)
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
            if (!ctx.realDbEnabled) {
                expect(row.assignee).toBe('Ada Lovelace')
                expect(row.orgName).toBe('Acme Corp')
            }
        })
    })
    */
})
