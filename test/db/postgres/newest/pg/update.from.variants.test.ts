// Extra coverage for `UPDATE ... FROM other-table` on top of the lone
// scenario already pinned in `update.from.test.ts`. Each test exercises
// a code path through `UpdateQueryBuilder.from(...)` /
// `AbstractSqlBuilder._buildUpdateFrom` that the canonical test leaves
// alone:
//
//   1. The SET assigns a single bare column from the FROM table — the
//      simplest possible reference shape (no concat, no expression),
//      which pins the bare-column branch of `_buildSetValueOf`.
//   2. Two `.from(...)` calls chained — exercises the multi-source
//      USING-list path (`update a, b, c` on mariadb/mysql,
//      `update a set ... from b, c` everywhere else).
//   3. The FROM target is a CTE (`.forUseInQueryAs(...)`), so the
//      builder must bubble the `WITH ...` up to the top level of the
//      UPDATE — distinct from a plain table reference.
//   4. RETURNING combined with FROM — distinct from
//      `update.returning.test.ts` (no FROM there). MySQL has no
//      RETURNING and keeps the test commented for symmetry.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('update-from-with-set-to-column-only', async () => {
        // The SET assigns a bare column reference from the FROM table
        // (no concat, no expression). Pins the simplest shape of
        // `_buildSetValueOf` when the RHS is a column from a joined
        // table.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .from(tOrganization)
                .set({ name: tOrganization.name })
                .where(tProject.organizationId.equals(tOrganization.id))
                .and(tOrganization.plan.equals('pro'))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = organization.name from organization where project.organization_id = organization.id and organization.plan = $1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "pro",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(2)
            else expect(typeof affected).toBe('number')
        })
    })

    test('update-from-multiple-source-tables', async () => {
        // Two `.from(...)` calls chained. The USING-list grows and the
        // emitted SQL must list both auxiliary tables. The WHERE clause
        // wires the join conditions for both.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssue)
                .from(tProject)
                .from(tOrganization)
                .set({ status: ctx.conn.const('archived', 'string') })
                .where(tIssue.projectId.equals(tProject.id))
                .and(tProject.organizationId.equals(tOrganization.id))
                .and(tOrganization.id.equals(99999))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = $1 from project, organization where issue.project_id = project.id and project.organization_id = organization.id and organization.id = $2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "archived",
                99999,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(0)
            else expect(typeof affected).toBe('number')
        })
    })

    test('update-from-cte-source', async () => {
        // FROM target is a `.forUseInQueryAs(...)` view (a CTE). The
        // emitted SQL must lead with `with verified_orgs as (...)`
        // bubbled up from the FROM clause through `__addWiths`.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const verifiedOrgs = ctx.conn.selectFrom(tOrganization)
                .where(tOrganization.verified.equals(true))
                .select({ id: tOrganization.id, name: tOrganization.name })
                .forUseInQueryAs('verified_orgs')

            const affected = await ctx.conn.update(tProject)
                .from(verifiedOrgs)
                .set({ name: verifiedOrgs.name })
                .where(tProject.organizationId.equals(verifiedOrgs.id))
                .and(tProject.id.equals(99999))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"with verified_orgs as (select id as id, name as name from organization where (verified = 'Y') = $1) update project set name = verified_orgs.name from verified_orgs where project.organization_id = verified_orgs.id and project.id = $2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                true,
                99999,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(0)
            else expect(typeof affected).toBe('number')
        })
    })

    test('update-from-with-returning-one-row', async () => {
        // RETURNING combined with FROM. Pins
        // `_buildUpdateReturning` (PG/SQLite/MariaDB), the SqlServer
        // `output inserted.*` branch and Oracle's `returning ... into`
        // override — all on top of a USING-list. MySQL has no RETURNING
        // and the cell comments this test out. The projection only
        // references columns from the *target* table: SQLite's
        // RETURNING clause cannot project columns from the FROM table,
        // and SqlServer's OUTPUT projects `inserted.*` rows, which
        // likewise mirror the target table.
        const expectedMock = { id: 1, newName: 'Acme Corp', slug: 'mktg-site' }
        ctx.mockNext(expectedMock)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tProject)
                .from(tOrganization)
                .set({ name: tOrganization.name })
                .where(tProject.id.equals(1))
                .and(tProject.organizationId.equals(tOrganization.id))
                .returning({
                    id:      tProject.id,
                    newName: tProject.name,
                    slug:    tProject.slug,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = organization.name from organization where project.id = $1 and project.organization_id = organization.id returning project.id as id, project.name as "newName", project.slug as slug"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, {
                id:      number
                newName: string
                slug:    string
            }>>()
            if (!ctx.realDbEnabled) expect(row).toEqual(expectedMock)
            else {
                expect(row.id).toBe(1)
                expect(row.slug).toBe('mktg-site')
                expect(row.newName).toBe('Acme Corp')
            }
        })
    })
})
