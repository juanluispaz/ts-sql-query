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
import { tOrganization, tProject } from '../../domain/connection.js'
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) returning id"`)
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

    test('insert-project-returning-row', async () => {
        const expectedMock = { id: 100, name: 'Mobile app', slug: 'mobile' }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .values({
                    organizationId: 1,
                    name: 'Mobile app',
                    slug: 'mobile',
                })
                .returning({
                    id:   tProject.id,
                    name: tProject.name,
                    slug: tProject.slug,
                })
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) returning id as id, name as name, slug as slug"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Mobile app",
                "mobile",
              ]
            `)
            assertType<Exact<typeof inserted, {
                id: number
                name: string
                slug: string
            }>>()

            expect(inserted.name).toBe('Mobile app')
            expect(inserted.slug).toBe('mobile')
            expect(typeof inserted.id).toBe('number')
            if (!ctx.realDbEnabled) expect(inserted.id).toBe(100)
        })
    })

    test('insert-many-organizations', async () => {
        const expectedMock = [{ id: 100 }, { id: 101 }]
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const ids = await ctx.conn.insertInto(tOrganization)
                .values([
                    { name: 'Acme East', plan: 'free' },
                    { name: 'Acme West', plan: 'pro' },
                ])
                .returning({ id: tOrganization.id })
                .executeInsertMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2), ($3, $4) returning id as id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Acme East",
                "free",
                "Acme West",
                "pro",
              ]
            `)
            assertType<Exact<typeof ids, Array<{ id: number }>>>()

            expect(ids).toHaveLength(2)
            if (!ctx.realDbEnabled) expect(ids).toEqual(expectedMock)
        })
    })

    test('insert-returning-projecting-optional-values-as-nullable', async () => {
        // optional RETURNING columns become a present `| null` via
        // `projectingOptionalValuesAsNullable()` on a mutation builder — the
        // helper was only ever called on selects / aggregate-as-array before.
        // `archivedAt` is an optionalColumn left unset, so it returns null
        // (present), not absent.
        const expectedMock = { id: 100, archivedAt: null }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, name: 'Nullable demo', slug: 'nullable-demo' })
                .returning({ id: tProject.id, archivedAt: tProject.archivedAt })
                .projectingOptionalValuesAsNullable()
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) returning id as id, archived_at as "archivedAt""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Nullable demo",
                "nullable-demo",
              ]
            `)
            assertType<Exact<typeof inserted, { id: number; archivedAt: Date | null }>>()

            expect(inserted.archivedAt).toBeNull()
            expect(typeof inserted.id).toBe('number')
            if (!ctx.realDbEnabled) expect(inserted.id).toBe(100)
            else expect(inserted.id).toBeGreaterThan(4) // seed reserves project ids 1-4
        })
    })

    test('insert-returning-without-helper-keeps-optional', async () => {
        // contrast: the SAME returning WITHOUT the helper keeps the optional
        // column as `archivedAt?: Date` (default optionals-as-undefined), so a
        // null value surfaces as an absent key — proving the helper flips it.
        const expectedMock = { id: 101 }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, name: 'Optional demo', slug: 'optional-demo' })
                .returning({ id: tProject.id, archivedAt: tProject.archivedAt })
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) returning id as id, archived_at as "archivedAt""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Optional demo",
                "optional-demo",
              ]
            `)
            assertType<Exact<typeof inserted, { id: number; archivedAt?: Date }>>()

            expect(inserted.archivedAt).toBeUndefined()
            if (!ctx.realDbEnabled) expect(inserted.id).toBe(101)
            else expect(inserted.id).toBeGreaterThan(4)
        })
    })
    test('insert-returning-nested-object-projecting-optional-values-as-nullable', async () => {
        // A nested-object returning under projectingOptionalValuesAsNullable.
        // The `meta` group is all-optional, so the nullable projector makes the
        // whole group `{...} | null` — null when every leaf is null. archivedAt
        // is left unset on the inserted row.
        const expectedMock = { id: 100, meta: null }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, name: 'Nested nullable', slug: 'nested-nullable' })
                .returning({
                    id:   tProject.id,
                    meta: { archivedAt: tProject.archivedAt },
                })
                .projectingOptionalValuesAsNullable()
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) returning id as id, archived_at as "meta.archivedAt""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Nested nullable",
                "nested-nullable",
              ]
            `)
            assertType<Exact<typeof inserted, {
                id: number
                meta: { archivedAt: Date | null } | null
            }>>()

            expect(inserted.meta).toBeNull()
            expect(typeof inserted.id).toBe('number')
            if (!ctx.realDbEnabled) expect(inserted.id).toBe(100)
            else expect(inserted.id).toBeGreaterThan(4)
        })
    })
})
