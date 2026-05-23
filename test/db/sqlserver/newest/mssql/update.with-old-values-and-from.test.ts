// `tTable.oldValues()` combined with an `UPDATE ... FROM other-table`
// or `... JOIN other-table` clause stresses the dialect-specific
// "extract additional required columns" path in
// [AbstractSqlBuilder.ts:2118-2244](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L2118-L2244)
// (`_extractAdditionalRequiredColumnsForUpdate` + the `requiredColumns`
// branch of `_buildUpdateFrom`). The shallow case (only the target
// table referenced in RETURNING) is covered by
// `update.with-old-values-in-returning.test.ts`; this file targets the
// shape where the RETURNING projection also references a joined-in
// table and so the synthetic `_old_` subquery has to pre-project those
// extra columns aliased as `<table>__<column>`.
//
// PostgreSQL ≥ 18 (`newest`) uses native `OLD.col` qualifiers and no
// longer emits the FROM-subquery; PG < 18 (`oldest`), SQL Server, and
// MariaDB ≥ 13.0.1 all emit the FROM-subquery / OUTPUT-deleted variant.
// Active in postgres + sqlserver + mariadb cells (mariadb wraps the
// body in TODO[LIMITATION] until the docker image upgrades past 12.x);
// commented out in sqlite/mysql/oracle (oldValues typed `never`).

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
        // PRE-update project.name AND the organization.name pulled in
        // via FROM. On PG ≥ 18 the FROM-subquery is replaced by native
        // `OLD.col`; on PG < 18 (and sqlserver / mariadb) the
        // `_extractAdditionalRequiredColumnsForUpdate` branch fires and
        // the synthesised `_old_` subquery must pre-project the
        // organization column as `organization__name` so it's
        // reachable in the RETURNING clause.
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
            if (!ctx.realDbEnabled) {
                expect(row).toEqual({
                    id:      1,
                    oldName: 'Marketing site',
                    newName: 'Marketing site / Acme Corp',
                    orgName: 'Acme Corp',
                })
            } else {
                expect(row.id).toBe(1)
                expect(row.orgName).toBe('Acme Corp')
                expect(row.oldName).toBe('Marketing site')
                expect(row.newName).toContain('Acme Corp')
            }
        })
    })
})
