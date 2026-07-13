// `tTable.oldValues()` combined with an `UPDATE ... FROM other-table`
// clause. The shallow case (only the target table referenced in
// RETURNING) is covered by `update.with-old-values-in-returning.test.ts`;
// this file targets the shape where the RETURNING projection also
// references the joined-in table. On SQL Server the OUTPUT clause reads
// the pre-update row via `deleted.*` and the new row via `inserted.*`,
// while the FROM table is referenced directly.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Values } from '../../../../../src/Values.js'
import { DBConnection, tAppUser, tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

// A Values source used as the FROM target of an UPDATE … oldValues() … RETURNING.
class VOrgNameList extends Values<DBConnection, 'orgNames'> {
    id   = this.column('int')
    name = this.column('string')
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('returning-old-and-new-with-from-table-projects-required-columns-in-old-subquery', async () => {
        // Update tProject.name from organization.name; RETURNING the
        // PRE-update project.name (via `deleted.name`) AND the
        // organization.name pulled in via FROM. The OUTPUT clause
        // references both the deleted/inserted pseudo-tables and the
        // joined organization table.
        ctx.mockNext({
            id:      1,
            oldName: 'Marketing site',
            newName: 'Marketing site / Acme Corp',
            orgName: 'Acme Corp',
        })

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .from(tOrganization)
                .set({
                    name: tProject.name.concat(' / ').concat(tOrganization.name),
                })
                .where(tProject.id.equals(1))
                .and(tProject.organizationId.equals(tOrganization.id))
                .returning({
                    id:      tProject.id,
                    oldName: oldProject.name,
                    newName: tProject.name,
                    orgName: tOrganization.name,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = project.name + @0 + organization.name output inserted.id as id, deleted.name as oldName, inserted.name as newName, organization.name as orgName from organization where project.id = @1 and project.organization_id = organization.id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " / ",
                1,
              ]
            `)
            assertType<Exact<typeof row, {
                id:      number
                oldName: string
                newName: string
                orgName: string
            }>>()
            expect(row).toEqual({
                id:      1,
                oldName: 'Marketing site',
                newName: 'Marketing site / Acme Corp',
                orgName: 'Acme Corp',
            })
        })
    })

    test('returning-old-and-new-with-from-and-customize-query-three-way-stack', async () => {
        // UPDATE … FROM combined with `oldValues()` in RETURNING and `customizeQuery`
        // hooks: the `beforeQuery` / `afterUpdateKeyword` / `afterQuery` comment fragments
        // render around the statement while the synthetic `old.name` subquery and the FROM
        // registration both survive. project 1 → org 1 (Acme Corp).
        ctx.mockNext({
            id:      1,
            oldName: 'Marketing site',
            newName: 'Marketing site / Acme Corp',
            orgName: 'Acme Corp',
        })

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .from(tOrganization)
                .set({
                    name: tProject.name.concat(' / ').concat(tOrganization.name),
                })
                .where(tProject.id.equals(1))
                .and(tProject.organizationId.equals(tOrganization.id))
                .returning({
                    id:      tProject.id,
                    oldName: oldProject.name,
                    newName: tProject.name,
                    orgName: tOrganization.name,
                })
                .customizeQuery({
                    beforeQuery:        ctx.conn.rawFragment`/* head */ `,
                    afterUpdateKeyword: ctx.conn.rawFragment`/*+ hint */`,
                    afterQuery:         ctx.conn.rawFragment` /* tail */`,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  update /*+ hint */ project set name = project.name + @0 + organization.name output inserted.id as id, deleted.name as oldName, inserted.name as newName, organization.name as orgName from organization where project.id = @1 and project.organization_id = organization.id  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " / ",
                1,
              ]
            `)
            assertType<Exact<typeof row, {
                id:      number
                oldName: string
                newName: string
                orgName: string
            }>>()
            expect(row).toEqual({
                id:      1,
                oldName: 'Marketing site',
                newName: 'Marketing site / Acme Corp',
                orgName: 'Acme Corp',
            })
        })
    })

    // NOT-APPLICABLE: SQL Server cannot update an IDENTITY primary-key column, so the `updatePrimaryKey` -> `for update of` path is unreachable here.
    /*
    test('returning-old-values-with-primary-key-in-set-uses-for-update-of', async () => {
        // Including a PRIMARY KEY column in `.set()` flips the builder's
        // `updatePrimaryKey` flag, so the synthesised `_old_` subquery
        // locks the synthesised `_old_` subquery for update where the
        // dialect builds one (dialects with native pre-update row access
        // emit no lock clause). The PK (a SERIAL column) is set to its
        // current value, so the update is a no-op that violates no
        // foreign key referencing project(id).
        const expected = { id: 1, oldName: 'Marketing site', newName: 'Marketing site!' }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({
                    id:   1,
                    name: tProject.name.concat('!'),
                })
                .where(tProject.id.equals(1))
                .returning({
                    id:      tProject.id,
                    oldName: oldProject.name,
                    newName: tProject.name,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof row, {
                id:      number
                oldName: string
                newName: string
            }>>()
            if (!ctx.realDbEnabled) {
                expect(row).toEqual(expected)
            } else {
                expect(row.id).toBe(1)
                expect(row.oldName).toBe('Marketing site')
                expect(row.newName).toBe('Marketing site!')
            }
        })
    })
    */


    test('returning-old-new-and-from-column-folded-into-nested-audit-object', async () => {
        // `oldValues()` folded into a nested sub-object, combined with UPDATE … FROM:
        // the audit object folds the pre-update `old.name`, the post-update
        // `project.name`, AND the joined-in `organization.name` into ONE sub-object
        // (`old.name as "audit.old"`, `organization.name as "audit.org"`), so the FROM
        // registration must survive the nested projection. project 1 → org 1 (Acme
        // Corp).
        ctx.mockNext({ id: 1, 'audit.old': 'Marketing site', 'audit.new': 'Mktg nested from', 'audit.org': 'Acme Corp' })
        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .from(tOrganization)
                .set({ name: 'Mktg nested from' })
                .where(tProject.id.equals(1))
                .and(tProject.organizationId.equals(tOrganization.id))
                .returning({
                    id:    tProject.id,
                    audit: { old: oldProject.name, new: tProject.name, org: tOrganization.name },
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0 output inserted.id as id, deleted.name as [audit.old], inserted.name as [audit.new], organization.name as [audit.org] from organization where project.id = @1 and project.organization_id = organization.id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mktg nested from",
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number; audit: { old: string; new: string; org: string } }>>()
            expect(row).toEqual({ id: 1, audit: { old: 'Marketing site', new: 'Mktg nested from', org: 'Acme Corp' } })
        })
    })
    test('returning-one-column-old-value-with-from-table', async () => {
        // `returningOneColumn(oldProject.name)` on an UPDATE … FROM: the pre-update `name` (via
        // `old.*`) comes back as a bare `string` while the FROM join wires org → project.
        // project 1 → org 1 (Acme Corp).
        ctx.mockNext('Marketing site')
        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const oldName = await ctx.conn.update(tProject)
                .from(tOrganization)
                .set({ name: tProject.name.concat(' / ').concat(tOrganization.name) })
                .where(tProject.id.equals(1))
                .and(tProject.organizationId.equals(tOrganization.id))
                .returningOneColumn(oldProject.name)
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = project.name + @0 + organization.name output deleted.name as [result] from organization where project.id = @1 and project.organization_id = organization.id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " / ",
                1,
              ]
            `)
            assertType<Exact<typeof oldName, string>>()
            expect(oldName).toBe('Marketing site')
        })
    })

    test('returning-old-and-new-with-values-from-source', async () => {
        // UPDATE … FROM a `Values` source with `oldValues()` in RETURNING: the
        // `WITH orgNames(...) AS (VALUES ...)` hoists to the top of the UPDATE, and the
        // synthetic pre-update `old.name` surfaces beside the FROM-sourced new value.
        // org 1 → project 1.
        ctx.mockNext({ id: 1, oldName: 'Marketing site', newName: 'Marketing site / Renamed via values' })
        await ctx.withRollback(async () => {
            const orgs = Values.create(VOrgNameList, 'orgNames', [{ id: 1, name: 'Renamed via values' }])
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .from(orgs)
                .set({ name: tProject.name.concat(' / ').concat(orgs.name) })
                .where(tProject.id.equals(1))
                .and(tProject.organizationId.equals(orgs.id))
                .returning({
                    id:      tProject.id,
                    oldName: oldProject.name,
                    newName: tProject.name,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"with orgNames as (select * from (values (@0, @1)) as orgNames(id, name)) update project set name = project.name + @2 + orgNames.name output inserted.id as id, deleted.name as oldName, inserted.name as newName from orgNames where project.id = @3 and project.organization_id = orgNames.id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Renamed via values",
                " / ",
                1,
              ]
            `)
            assertType<Exact<typeof row, {
                id:      number
                oldName: string
                newName: string
            }>>()
            expect(row).toEqual({ id: 1, oldName: 'Marketing site', newName: 'Marketing site / Renamed via values' })
        })
    })


    test('returning-old-value-with-from-then-inner-join-projects-join-brought-in-column', async () => {
        // `oldValues()` combined with `.from(j1).innerJoin(j2).on(...)` (a JOIN after
        // `.from()`, not a second `.from()`): the RETURNING projection reads the
        // pre-update `old.name`, the post-update `project.name`, AND the
        // `app_user.full_name` brought in through the inner join. The synthetic
        // pre-update subquery has to survive the from-then-join source registration
        // while the live join supplies the assignee column. Update project 1's name
        // to its issue-1 assignee (Ada Lovelace via user 1); old name 'Marketing site'.
        ctx.mockNext({
            id:       1,
            oldName:  'Marketing site',
            newName:  'Ada Lovelace',
            assignee: 'Ada Lovelace',
        })
        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .from(tIssue)
                .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId))
                .set({ name: tAppUser.fullName })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(1))
                .returning({
                    id:       tProject.id,
                    oldName:  oldProject.name,
                    newName:  tProject.name,
                    assignee: tAppUser.fullName,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = app_user.full_name output inserted.id as id, deleted.name as oldName, inserted.name as newName, app_user.full_name as assignee from issue inner join app_user on app_user.id = issue.assignee_id where project.id = issue.project_id and issue.id = @0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, {
                id:       number
                oldName:  string
                newName:  string
                assignee: string
            }>>()
            expect(row).toEqual({
                id:       1,
                oldName:  'Marketing site',
                newName:  'Ada Lovelace',
                assignee: 'Ada Lovelace',
            })
        })
    })

    test('returning-old-optional-and-assignee-with-from-inner-join-projecting-nullable', async () => {
        // `oldValues()` in RETURNING combined with `UPDATE … FROM(join)` under
        // `projectingOptionalValuesAsNullable()`. The from-then-join wires
        // issue → app_user while the synthetic pre-update subquery survives, and
        // the RETURNING projection reads the pre-update OPTIONAL column
        // `archivedAt` beside the joined-in assignee name. Because `archivedAt`
        // is an optional column, under `projectingOptionalValuesAsNullable()` it
        // surfaces as `Date | null` (not `?: Date`); project 1's archived_at is
        // NULL, so `oldArchivedAt` comes back as `null`. Update project 1's name
        // to its issue-1 assignee (Ada Lovelace via user 1).
        ctx.mockNext({ oldArchivedAt: null, assignee: 'Ada Lovelace' })
        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .from(tIssue)
                .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId))
                .set({ name: tAppUser.fullName })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(1))
                .returning({
                    oldArchivedAt: oldProject.archivedAt,
                    assignee:      tAppUser.fullName,
                })
                .projectingOptionalValuesAsNullable()
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = app_user.full_name output deleted.archived_at as oldArchivedAt, app_user.full_name as assignee from issue inner join app_user on app_user.id = issue.assignee_id where project.id = issue.project_id and issue.id = @0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, {
                oldArchivedAt: Date | null
                assignee:      string
            }>>()
            expect(row).toEqual({ oldArchivedAt: null, assignee: 'Ada Lovelace' })
        })
    })
})
