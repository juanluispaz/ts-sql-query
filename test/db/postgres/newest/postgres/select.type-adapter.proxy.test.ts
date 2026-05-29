// Coverage of `ProxyTypeAdapter` (src/internal/ProxyTypeAdapter.ts).
//
// When a column carrying a `CustomBooleanTypeAdapter` is re-projected by
// `createColumnsFrom` (building the columns of a WITH view / inline
// query), the adapter is wrapped in a `ProxyTypeAdapter` so the *outer*
// reference is NOT treated as a custom boolean again: the inner select
// already remapped the stored value (`'Y'`/`'N'`, `'t'`/`'f'`, …) to a
// real boolean, so re-applying the remap on the outer column would be
// wrong. These tests pin that "remap once, in the inner select only"
// contract and exercise the proxy's `transformValueFromDB` delegation.
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

    test('proxy-adapter/custom-boolean-projected-through-with-clause', async () => {
        const connection = ctx.conn

        // The inner select remaps `verified` to a real boolean; the WITH
        // view exposes it through a ProxyTypeAdapter so the outer select
        // reads the already-boolean column verbatim (no second remap).
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

    test('proxy-adapter/filtering-the-proxied-boolean-skips-the-remap', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with verifiedOrgs as (select id as id, name as name, (verified = 'Y') as verified from organization) select id as id, name as name from verifiedOrgs where verified = $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })
})
