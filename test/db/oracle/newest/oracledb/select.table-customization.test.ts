// Coverage of `createTableOrViewCustomization` — the public surface
// that produces a wrapper TABLE / VIEW with a custom emission
// template. The template is built from `rawFragment` and may embed
// `${table}` (the wrapped table-or-view's name) and `${alias}` (the
// `AS <name>` suffix). Each of those reaches the SqlBuilder via
// `_rawFragmentTableName` and `_rawFragmentTableAlias`
// neither of which is otherwise exercised by the suite.
//
// The customization itself lives on `DBConnection.withSqlHint` in the
// shared domain — the realistic pattern documented in
// [docs/queries/sql-fragments.md](../../../../../docs/queries/sql-fragments.md#table-or-view-customization),
// where users define customizations as fields on their connection
// subclass at construction time. The template prepends a SQL comment
// (valid on every dialect) so the test runs end-to-end against the
// real DB.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('table-customization: unaliased wrapper emits table name + empty alias slot', async () => {
        const tOrgCustom = ctx.conn.withSqlHint(tOrganization, 'tOrgCustom')
        ctx.mockNext([])
        await ctx.conn.selectFrom(tOrgCustom)
            .select({ id: tOrgCustom.id })
            .executeSelectMany()
        // `${alias}` collapses to the empty string when the wrapped
        // table has no `.as(...)` — the SQL keeps the trailing space
        // that came from the template literal.
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from /*+ hint */ "organization" "`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('table-customization: aliased wrapper emits table name + "as <alias>"', async () => {
        const tOrgAliased = tOrganization.as('o')
        const tOrgCustom = ctx.conn.withSqlHint(tOrgAliased, 'tOrgCustomAliased')
        ctx.mockNext([])
        await ctx.conn.selectFrom(tOrgCustom)
            .select({ id: tOrgCustom.id })
            .executeSelectMany()
        // `${alias}` resolves to `as "o"` — the dialect-specific
        // alias emitter on `_rawFragmentTableAlias`.
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select "o".id as "id" from /*+ hint */ "organization" "o""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })
    test('table-customization: customized table joined with a plain table keeps the hint on the customized side only', async () => {
        // A customized table is joinable like any table/view. The hint comment is
        // rendered only on the customized (organization) side of the JOIN; the
        // plain joined `project` table stays unadorned.
        const tOrgCustom = ctx.conn.withSqlHint(tOrganization.as('o'), 'tOrgCustomJoin')
        ctx.mockNext([])
        await ctx.conn.selectFrom(tOrgCustom)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrgCustom.id))
            .select({ orgId: tOrgCustom.id, projectId: tProject.id })
            .orderBy('projectId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select "o".id as "orgId", project.id as "projectId" from /*+ hint */ "organization" "o" inner join project on project.organization_id = "o".id order by "projectId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

})
