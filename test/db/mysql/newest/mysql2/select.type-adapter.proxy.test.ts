// A column with a `CustomBooleanTypeAdapter` projected by a WITH view: the
// inner select already remaps the stored value (`'Y'`/`'N'`, `'t'`/`'f'`, …)
// to a real boolean, so the column of the view is a plain boolean, without
// the adapter, and the outer query doesn't remap it again.
//
// `organization.verified` is the custom-boolean column under test (the
// shared domain stores it via `CustomBooleanTypeAdapter`).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('custom-boolean/projected-through-a-with-view-is-a-plain-boolean', async () => {
        const connection = ctx.conn

        // The inner select remaps `verified` to a real boolean; the column of
        // the WITH view is a plain boolean, which the outer select reads as it
        // is (no second remap).
        const verifiedOrgs = connection.selectFrom(tOrganization)
            .select({
                id:       tOrganization.id,
                name:     tOrganization.name,
                verified: tOrganization.verified,
            })
            .forUseInQueryAs('verifiedOrgs')

        const expected = [
            { id: 1, name: 'Acme Corp', verified: true },
            { id: 2, name: 'Globex Ltd', verified: false },
        ]
        ctx.mockNext(expected)
        const rows = await connection.selectFrom(verifiedOrgs)
            .select({
                id:       verifiedOrgs.id,
                name:     verifiedOrgs.name,
                verified: verifiedOrgs.verified,
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with verifiedOrgs as (select id as id, name as name, (verified = 'Y') as verified from organization) select id as id, name as name, verified as verified from verifiedOrgs order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            id:       number
            name:     string
            verified: boolean
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('custom-boolean/filtering-the-with-view-column-skips-the-remap', async () => {
        const connection = ctx.conn

        // Filtering on the WITH view's `verified` must compare against a
        // real boolean (`verified = $1`), NOT re-emit the `'Y'`/`'N'`
        // remap the inner select already applied.
        const verifiedOrgs = connection.selectFrom(tOrganization)
            .select({
                id:       tOrganization.id,
                name:     tOrganization.name,
                verified: tOrganization.verified,
            })
            .forUseInQueryAs('verifiedOrgs')

        const expected = [{ id: 1, name: 'Acme Corp' }]
        ctx.mockNext(expected)
        const rows = await connection.selectFrom(verifiedOrgs)
            .where(verifiedOrgs.verified.equals(true))
            .select({
                id:   verifiedOrgs.id,
                name: verifiedOrgs.name,
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with verifiedOrgs as (select id as id, name as name, (verified = 'Y') as verified from organization) select id as id, name as name from verifiedOrgs where verified = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })
})
