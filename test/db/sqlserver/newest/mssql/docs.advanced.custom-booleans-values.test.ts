// Documentation snippets for the Custom booleans values page
// (docs/advanced/custom-booleans-values.md). Demonstrates
// `CustomBooleanTypeAdapter` — a column-level mapping between JS
// boolean and arbitrary DB values (here 'Y'/'N').
//
// Driven against the real `organization.verified` column, which the
// domain already declares with `CustomBooleanTypeAdapter('Y', 'N')`
// and the seed populates ('Acme Corp' → 'Y', 'Globex Ltd' → 'N'), so
// the Y/N <-> boolean mapping is validated against the real engine in
// both directions — no test-only table is needed.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:custom-booleans-values/insert-maps-true-false-to-Y-N', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext(99)

            // doc-start
            const id = await ctx.conn.insertInto(tOrganization).set({
                    name:     'Demo Corp',
                    plan:     'free',
                    verified: true,
                })
                .returningLastInsertedId()
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, [plan], verified) output inserted.id values (@0, @1, case when (@2 = 1) then 'Y' else 'N' end)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Demo Corp",
                "free",
                true,
              ]
            `)
            assertType<Exact<typeof id, number>>()
            // The engine assigns the id (non-deterministic); the mock pins it.
            if (!ctx.realDbEnabled) expect(id).toBe(99)
            else expect(typeof id).toBe('number')
        })
    })

    test('docs:custom-booleans-values/select-maps-Y-N-to-true-false', async () => {
        ctx.mockNext([{ id: 1, name: 'Acme Corp', verified: true }])

        // doc-start
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.verified)
            .select({
                id:       tOrganization.id,
                name:     tOrganization.name,
                verified: tOrganization.verified,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, cast(case when verified = 'Y' then 1 else 0 end as bit) as verified from organization where (verified = 'Y')"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; name: string; verified: boolean }>>>()
        // 'Acme Corp' is stored verified 'Y' → mapped to `true`; 'Globex Ltd'
        // ('N') is filtered out by `where(verified)`. Validated in both modes.
        expect(rows).toEqual([{ id: 1, name: 'Acme Corp', verified: true }])
    })
})
