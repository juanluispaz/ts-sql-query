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

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // TODO[LIMITATION]: see LIMITATIONS.md — `oldValues()` emits `OLD_VALUE(col)`, only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Snapshot pre-baked for when mariadb:latest catches up to 13.0.1+; uncomment the body then.
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
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
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — `oldValues()` emits `OLD_VALUE(col)`, only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Snapshot pre-baked for when mariadb:latest catches up to 13.0.1+; uncomment the body then.
    /*
    test('returning-old-values-with-primary-key-in-set-uses-for-update-of', async () => {
        // Including a PRIMARY KEY column in `.set()` flips the builder's
        // `updatePrimaryKey` flag, so the synthesised `_old_` subquery
        // locks with `for update of _old_` instead of the default
        // `for no key update of _old_` (PG < 18; PG >= 18 uses native
        // `OLD.col` with no lock clause). The PK (a SERIAL column) is set
        // to its current value, so the update is a no-op that violates no
        // foreign key referencing project(id). Commented out on sqlserver
        // (cannot update an IDENTITY column), mariadb (TODO[LIMITATION]:
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
