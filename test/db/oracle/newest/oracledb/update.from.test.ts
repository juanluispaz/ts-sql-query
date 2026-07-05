// Coverage of `UPDATE … FROM other-table`: the SET clause references a
// column of the joined-in table.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('update-from-other-table', async () => {
        // Acme Corp is the only `pro` org; its projects are 1 and 2.
        const updatedProjects = [
            { id: 1, name: 'Marketing site / Acme Corp' },
            { id: 2, name: 'Internal tools / Acme Corp' },
        ]
        ctx.mockNext(2)               // affected rows from the UPDATE
        ctx.mockNext(updatedProjects) // rows from the verification SELECT

        await ctx.withRollback(async () => {
            // Append the organization name to each project's name where
            // the organization's plan = 'pro'.
            const affected = await ctx.conn.update(tProject)
                .from(tOrganization)
                .set({
                    name: tProject.name.concat(' / ').concat(tOrganization.name),
                })
                .where(tProject.organizationId.equals(tOrganization.id))
                .and(tOrganization.plan.equals('pro'))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = project.name || :0 || "organization".name from "organization" where project.organization_id = "organization".id and "organization"."plan" = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " / ",
                "pro",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            // oracledb's affected-row count for the emulated UPDATE … FROM is
            // not reliably 2, so under a real DB only assert it is numeric.
            if (ctx.realDbEnabled) {
                expect(typeof affected).toBe('number')
            } else {
                expect(affected).toBe(2)
            }
            const projects = await ctx.conn.selectFrom(tProject)
                .where(tProject.organizationId.equals(1))
                .select({ id: tProject.id, name: tProject.name })
                .orderBy('id')
                .executeSelectMany()
            expect(projects).toEqual(updatedProjects)
        })
    })

    test('update-from-returning-a-from-table-column-nested', async () => {
        // A plain `update(t).from(j)` (no JOIN) whose RETURNING folds a column of the
        // FROM-joined table (`organization.name` / `organization.plan`) into a nested
        // `audit` sub-object — the `_buildUpdateReturning` from-table-qualification
        // path (distinct from returning the target's own columns). Rename project 1
        // by appending its organization's name, and read the org columns back.
        const expected = { id: 1, audit: { org: 'Acme Corp', plan: 'pro' } }
        ctx.mockNext({ id: 1, 'audit.org': 'Acme Corp', 'audit.plan': 'pro' })
        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tProject)
                .from(tOrganization)
                .set({ name: tProject.name.concat(' / ').concat(tOrganization.name) })
                .where(tProject.organizationId.equals(tOrganization.id))
                    .and(tProject.id.equals(1))
                .returning({
                    id:    tProject.id,
                    audit: { org: tOrganization.name, plan: tOrganization.plan },
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = project.name || :0 || "organization".name from "organization" where project.organization_id = "organization".id and project.id = :1 returning project.id, "organization".name, "organization"."plan" into :2, :3, :4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " / ",
                1,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "audit.org",
                  "dir": 3003,
                },
                {
                  "as": "audit.plan",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, {
                id:    number
                audit: { org: string; plan: string }
            }>>()
            expect(row).toEqual(expected)
        })
    })

})
