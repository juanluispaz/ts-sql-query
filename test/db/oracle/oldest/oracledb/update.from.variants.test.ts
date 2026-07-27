// Extra coverage for `UPDATE ... FROM other-table` beyond the lone
// scenario pinned in the canonical update-from test. Each test
// exercises a builder code path the canonical test leaves alone:
//
//   1. The SET assigns a single bare column from the FROM table — the
//      simplest possible reference shape (no concat, no expression).
//   2. Two `.from(...)` calls chained — exercises the multi-source
//      USING-list path; the emitted form is pinned by the snapshot below.
//   3. The FROM target is a CTE (`.forUseInQueryAs(...)`), so the
//      builder must bubble the `WITH ...` up to the top level of the
//      UPDATE — distinct from a plain table reference.
//   4. RETURNING combined with FROM. Where the dialect has no UPDATE …
//      RETURNING the test is commented out for symmetry.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject, tProjectReview } from '../../domain/connection.js'
import { ctx } from './setup.js'

// Every test in this cell is commented out (see the blocks below); these
// sentinels satisfy noUnusedLocals while the imports stay for cross-cell symmetry.
void expect; void test; void assertType; void tIssue; void tOrganization; void tProject; void tProjectReview
export type { Exact }

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = "organization".name from "organization" where project.organization_id = "organization".id and "organization"."plan" = :0"`)
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
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set issue.status = :0 from project, "organization" where issue.project_id = project.id and project.organization_id = "organization".id and "organization".id = :1"`)
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
    */

    // NOT-APPLICABLE: Oracle rejects the `WITH cte AS (...) UPDATE … FROM cte …` form (ORA-00928); WITH is only a SELECT prefix on Oracle
    /*
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
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
    test('update-from-with-returning-one-row', async () => {
        // RETURNING combined with FROM; the emitted form is pinned by
        // the snapshot below. Where the dialect has no UPDATE …
        // RETURNING the test is commented out for symmetry. The
        // projection references only columns from the *target* table,
        // because not every dialect's RETURNING/OUTPUT can project
        // columns from the FROM table.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = "organization".name from "organization" where project.id = :0 and project.organization_id = "organization".id returning project.id, project.name, project.slug into :1, :2, :3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "newName",
                  "dir": 3003,
                },
                {
                  "as": "slug",
                  "dir": 3003,
                },
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
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
    test('update-from-shaped-set-with-returning-one-row', async () => {
        // The three-way cross: a SHAPED set (`shapedAs({...}).set({...})` on renamed
        // keys), a `.from(...)` joined table whose column feeds the shaped SET value,
        // AND a `.returning({...})`. Each pairwise cross exists elsewhere; this pins
        // the three together. `shapedAs` remains reachable after `from` because
        // `UpdateFromExpression` still carries it, and the SET value references a
        // FROM-table column (`tOrganization.name`). The RETURNING projection
        // references only *target*-table columns (not every dialect's RETURNING/OUTPUT
        // can project FROM-table columns). Where the dialect has no UPDATE …
        // RETURNING the test is commented out for symmetry. Acme Corp (org 1) owns
        // project 1.
        const expectedMock = { id: 1, newName: 'Acme Corp', slug: 'mktg-site' }
        ctx.mockNext(expectedMock)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tProject)
                .from(tOrganization)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: tOrganization.name })
                .where(tProject.id.equals(1))
                .and(tProject.organizationId.equals(tOrganization.id))
                .returning({
                    id:      tProject.id,
                    newName: tProject.name,
                    slug:    tProject.slug,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = "organization".name from "organization" where project.id = :0 and project.organization_id = "organization".id returning project.id, project.name, project.slug into :1, :2, :3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "newName",
                  "dir": 3003,
                },
                {
                  "as": "slug",
                  "dir": 3003,
                },
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
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
    test('update-from-returning-scaled-adapter-column', async () => {
        // An adapter column driven through UPDATE … FROM … RETURNING: the SET
        // writes `score` 90 through the scaledTenthAdapter (×10 → binds 900) and
        // the RETURNING reads it back through the same adapter (÷10 → 90). The FROM
        // joins project_review to its project (review 1 → project 1). Where the dialect
        // has no UPDATE … RETURNING the test is commented out for symmetry. Runs inside
        // withRollback (tProjectReview is a leaf).
        await ctx.withRollback(async () => {
            ctx.mockNext({ score: 900 })
            const row = await ctx.conn.update(tProjectReview)
                .from(tProject)
                .set({ score: 90 })
                .where(tProjectReview.projectId.equals(tProject.id))
                .and(tProjectReview.id.equals(1))
                .returning({ score: tProjectReview.score })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project_review set project_review.score = :0 from project where project_review.project_id = project.id and project_review.id = :1 returning project_review.score into :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                900,
                1,
                {
                  "as": "score",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, { score: number }>>()
            expect(row).toEqual({ score: 90 })
        })
    })
    */

    // NOT-APPLICABLE: Oracle accepts WITH only as a prefix to SELECT, so UPDATE … FROM <Values> (ORA-00928) is not emittable
    /*
    test('update-from-values-source', async () => {
        // The FROM target is a `Values` source (vs a table or a forUseInQueryAs CTE).
        // The Values `WITH orgNames(id, name) AS (VALUES ...)` must hoist to the top of
        // the UPDATE through the FROM clause. The where filters by an impossible id so no
        // seed rows are updated under real DB.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const orgs = Values.create(VOrgNameList, 'orgNames', [{ id: 1, name: 'Renamed via values' }])
            const affected = await ctx.conn.update(tProject)
                .from(orgs)
                .set({ name: orgs.name })
                .where(tProject.organizationId.equals(orgs.id))
                .and(tProject.id.equals(99999))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(0)
            else expect(typeof affected).toBe('number')
        })
    })
    */

    // NOT-APPLICABLE: Oracle's RETURNING … INTO returns columns of the updated (target) table only, not a FROM-joined table's columns.
    /*
    test('update-from-returning-one-column-from-table-column', async () => {
        // `returningOneColumn(organization.name)` returns a column of the FROM-joined table, not
        // the target — PostgreSQL's UPDATE … FROM … RETURNING can reference FROM-relation
        // columns. project 1 → org 1 (Acme Corp); the org name comes back.
        ctx.mockNext('Acme Corp')
        await ctx.withRollback(async () => {
            const orgName = await ctx.conn.update(tProject)
                .from(tOrganization)
                .set({ name: tOrganization.name })
                .where(tProject.id.equals(1))
                .and(tProject.organizationId.equals(tOrganization.id))
                .returningOneColumn(tOrganization.name)
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof orgName, string>>()
            expect(orgName).toBe('Acme Corp')
        })
    })
    */

})
