// INSERT scenarios with RETURNING. Each mutating block runs inside
// `ctx.withRollback(...)` so any rows written to a real DB are reverted at
// the end of the test (no-op in mock mode).
//
// SQL and params use `toMatchInlineSnapshot(...)` so they can be refreshed
// with `bun test --update-snapshots` (or `bunx vitest run -u`).
//
// Auto-generated columns (PK ids) are mock-primed for predictable mock-mode
// equality. In real-DB mode the actual id is whatever sqlite assigns next;
// the test then asserts a structural invariant (`id > <max-seed-id>`).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
// tProject is only referenced inside commented-out tests above. Suppress
// the unused-import warning by importing what is still in active use.
import { tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('insert-organization-returning-id', async () => {
        ctx.mockNext(99)

        await ctx.withRollback(async () => {
            const id = await ctx.conn.insertInto(tOrganization)
                .values({
                    name: 'Initech',
                    plan: 'free',
                })
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into \`organization\` (\`name\`, plan) values (?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Initech",
                "free",
              ]
            `)
            assertType<Exact<typeof id, number>>()

            expect(typeof id).toBe('number')
            if (ctx.realDbEnabled) {
                expect(id).toBeGreaterThan(2) // seed reserves ids 1, 2
            } else {
                expect(id).toBe(99)
            }
        })
    })

    // mysql does not support the RETURNING clause; the library refuses
    // `.returning({...}).executeInsertOne()` at compile time. Kept here
    // commented for symmetry.
    // NOT-APPLICABLE: MySQL has no RETURNING
    /*
    test('insert-project-returning-row', async () => {
        const expectedMock = { id: 100, name: 'Mobile app', slug: 'mobile' }
        ctx.mockNext(expectedMock)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, name: 'Mobile app', slug: 'mobile' })
                .returning({ id: tProject.id, name: tProject.name, slug: tProject.slug })
                .executeInsertOne()
            // ... see other cells for the full body.
        })
    })
    */

    // mysql does not support the RETURNING clause; the library refuses
    // `.returning({...}).executeInsertMany()` at compile time. Kept here
    // commented for symmetry.
    // NOT-APPLICABLE: MySQL has no RETURNING
    /*
    test('insert-many-organizations', async () => {
        const expectedMock = [{ id: 100 }, { id: 101 }]
        ctx.mockNext(expectedMock)
        await ctx.withRollback(async () => {
            const ids = await ctx.conn.insertInto(tOrganization)
                .values([{ name: 'Acme East', plan: 'free' }, { name: 'Acme West', plan: 'pro' }])
                .returning({ id: tOrganization.id })
                .executeInsertMany()
            // ... see other cells for the full body.
        })
    })
    */
})
