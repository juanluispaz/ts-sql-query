// Behavioral coverage of `_appendCustomBooleanRemapForColumnIfRequired`
// for the column-to-column case: comparing two `CustomBooleanTypeAdapter`
// columns whose true/false values agree (no remap needed) and whose
// values disagree (remap with case). The existing
// `docs.advanced.custom-booleans-values.test.ts` covers only the
// column-vs-literal path, so the column-vs-column branches are otherwise
// unreached.
//
// The seed schema includes two custom-boolean columns that share a
// mapping (`organization.verified` and `app_user.verified`, both Y/N)
// and one with a deliberately different mapping (`project.published`,
// stored as t/f). This file exercises the comparisons across that pair.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tAppUser, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('where: custom boolean column equals column with same adapter', async () => {
        // organization.verified and app_user.verified both store Y/N.
        // The right-hand side needs no case-based remap; the SQL builder
        // emits the raw column name.
        //
        // Acme Corp (id=1) has verified=Y; the verified users are Ada
        // (id=1, Y) and Grace (id=2, Y), so the join yields two rows.
        const expected = [{ orgId: 1, userId: 1 }, { orgId: 1, userId: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tAppUser).on(tAppUser.verified.equals(tOrganization.verified))
            .where(tOrganization.id.equals(1))
            .select({
                orgId:  tOrganization.id,
                userId: tAppUser.id,
            })
            .orderBy('userId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as orgId, app_user.id as userId from organization inner join app_user on app_user.verified = organization.verified where organization.id = @0 order by userId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('where: custom boolean column equals column with different adapter', async () => {
        // organization.verified is Y/N; project.published is t/f.
        // The SQL builder must remap the right-hand side with a case
        // expression so the comparison reads `<org.verified-mapped-bool>
        // = <project.published-mapped-bool>`.
        //
        // Matches per the seed: Acme (Y/true) + Marketing (t/true) →
        // projectId 1; Globex (N/false) + Legacy (f/false) → projectId 4.
        const expected = [
            { orgId: 1, projectId: 1 },
            { orgId: 2, projectId: 4 },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .where(tOrganization.verified.equals(tProject.published))
            .select({
                orgId:     tOrganization.id,
                projectId: tProject.id,
            })
            .orderBy('projectId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as orgId, project.id as projectId from organization inner join project on project.organization_id = organization.id where cast(case when organization.verified = 'Y' then 1 else 0 end as bit) = cast(case when project.published = 't' then 1 else 0 end as bit) order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('where: custom boolean column equals a boolean value source', async () => {
        // RHS is a derived BooleanValueSource (id > 0), not a column.
        // The builder hits the `isValueSource(value)` branch and emits a
        // case expression matching the adapter-stored values.
        //
        // (id > 0) is true for every row, so the predicate reduces to
        // verified=true; only Acme (id=1) qualifies.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified.equals(tOrganization.id.greaterThan(0)))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where cast(case when verified = 'Y' then 1 else 0 end as bit) = (cast(case when id > @0 then 1 else 0 end as bit)) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        expect(rows).toEqual(expected)
    })
})
