// `tTable.oldValues()` combined with an `UPDATE ... FROM other-table`
// clause. The shallow case (only the target table referenced in
// RETURNING) is covered by `update.with-old-values-in-returning.test.ts`;
// this file targets the shape where the RETURNING projection also
// references the joined-in table. On SQL Server the OUTPUT clause reads
// the pre-update row via `deleted.*` and the new row via `inserted.*`,
// while the FROM table is referenced directly.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

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

    // NOT-APPLICABLE: SQL Server cannot update an IDENTITY primary-key column, so the `updatePrimaryKey` -> `for update of` path is unreachable here.
    /*
    test('returning-old-values-with-primary-key-in-set-uses-for-update-of', async () => {
        // Including a PRIMARY KEY column in `.set()` flips the builder's
        // `updatePrimaryKey` flag, so the synthesised `_old_` subquery
        // locks with `for update of _old_` instead of the default
        // `for no key update of _old_` (PG < 18; PG >= 18 uses native
        // `OLD.col` with no lock clause). The PK (a SERIAL column) is set
        // to its current value, so the update is a no-op that violates no
        // foreign key referencing project(id). Commented out on sqlserver
        // (cannot update an IDENTITY column), mariadb (limitation:
        // OLD_VALUE needs 13.0.1+) and mysql/oracle/sqlite (oldValues
        // typed `never`).
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

})
