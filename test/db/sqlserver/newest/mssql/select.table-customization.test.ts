// Coverage of `createTableOrViewCustomization` — the public surface
// that produces a wrapper TABLE / VIEW with a custom emission
// template. The template is built from `rawFragment` and may embed
// `${table}` (the wrapped table-or-view's name) and `${alias}` (the
// `AS <name>` suffix). Each of those reaches the SqlBuilder via
// `_rawFragmentTableName` and `_rawFragmentTableAlias` on
// [AbstractSqlBuilder.ts:L2977-L2990](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L2977),
// neither of which is otherwise exercised by the suite.
//
// `ctx.withTableCustomization()` returns a `DBConnection` whose
// `applyCustomization(tableOrView, name)` method registers a fixed
// ``rawFragment`/*+ hint *\/ ${table} ${alias}` `` template. The
// connection shares `ctx.conn`'s underlying `CaptureInterceptor` and
// driver, so SQL emitted by the alt connection lands in `ctx.lastSql`
// and any real-DB execution reaches the same backing database. The
// template produces a well-formed SQL comment on every dialect, so
// `executeSelectMany` proceeds normally.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('table-customization: unaliased wrapper emits table name + empty alias slot', async () => {
        const conn = ctx.withTableCustomization()
        const tOrgCustom = conn.applyCustomization(tOrganization, 'tOrgCustom')
        ctx.mockNext([])
        await conn.selectFrom(tOrgCustom)
            .select({ id: tOrgCustom.id })
            .executeSelectMany()
        // `${alias}` collapses to the empty string when the wrapped
        // table has no `.as(...)` — the SQL keeps the trailing space
        // that came from the template literal.
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from /*+ hint */ organization "`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('table-customization: aliased wrapper emits table name + "as <alias>"', async () => {
        const conn = ctx.withTableCustomization()
        const tOrgAliased = tOrganization.as('o')
        const tOrgCustom = conn.applyCustomization(tOrgAliased, 'tOrgCustomAliased')
        ctx.mockNext([])
        await conn.selectFrom(tOrgCustom)
            .select({ id: tOrgCustom.id })
            .executeSelectMany()
        // `${alias}` resolves to `as "o"` — the dialect-specific
        // alias emitter on `_rawFragmentTableAlias`.
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select [o].id as id from /*+ hint */ organization as [o]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })
})
