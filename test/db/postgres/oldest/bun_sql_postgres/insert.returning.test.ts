// INSERT scenarios with RETURNING. Each mutating block runs inside
// `ctx.withRollback(...)` so any rows written to a real DB are reverted at
// the end of the test (no-op in mock mode).
//
// Auto-generated columns (PK ids) are mock-primed for predictable mock-mode
// equality. In real-DB mode the actual id is whatever sqlite assigns next;
// the test then asserts a structural invariant (`id > <max-seed-id>`).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization, tProject, tProjectRelease, tProjectReview } from '../../domain/connection.js'
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

    test('insert-returning-object-computed-expression', async () => {
        // Object-form RETURNING projecting a COMPUTED expression (`name || ' [new]'`)
        // alongside a plain column. RETURNING sees the just-inserted name 'Mobile app'
        // → 'Mobile app [new]'.
        const expectedMock = { id: 100, tag: 'Mobile app [new]' }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, name: 'Mobile app', slug: 'mobile' })
                .returning({
                    id:  tProject.id,
                    tag: tProject.name.concat(' [new]'),
                })
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) returning id as id, name || $4 as tag"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Mobile app",
                "mobile",
                " [new]",
              ]
            `)
            assertType<Exact<typeof inserted, { id: number; tag: string }>>()

            expect(inserted.tag).toBe('Mobile app [new]')
            expect(typeof inserted.id).toBe('number')
            if (!ctx.realDbEnabled) expect(inserted.id).toBe(100)
            else expect(inserted.id).toBeGreaterThan(4) // seed reserves project ids 1-4
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

    test('insert-on-conflict-do-nothing-returning-projecting-optional-values-as-nullable', async () => {
        // `projectingOptionalValuesAsNullable()` on the ON CONFLICT DO NOTHING
        // optional-returning path. The helper is covered on plain
        // insert/update/delete returning above; this pins it on the on-conflict
        // returning builder. `archivedAt` is an optionalColumn left unset, so it
        // returns a present `null`. No key actually collides, so the insert
        // succeeds and a row comes back; the suppressed-insert `| null` arm is
        // the type promise `executeInsertNoneOrOne` keeps.
        const expectedMock = { id: 100, archivedAt: null }
        ctx.mockNext(expectedMock)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, name: 'On-conflict nullable demo', slug: 'on-conflict-nullable-demo' })
                .onConflictDoNothing()
                .returning({ id: tProject.id, archivedAt: tProject.archivedAt })
                .projectingOptionalValuesAsNullable()
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict do nothing returning id as id, archived_at as "archivedAt""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "On-conflict nullable demo",
                "on-conflict-nullable-demo",
              ]
            `)
            assertType<Exact<typeof inserted, { id: number; archivedAt: Date | null } | null>>()
            expect(inserted).not.toBeNull()
            expect(inserted!.archivedAt).toBeNull()
            if (!ctx.realDbEnabled) expect(inserted!.id).toBe(100)
            else expect(inserted!.id).toBeGreaterThan(4) // seed reserves project ids 1-4
        })
    })

    test('insert-on-conflict-do-nothing-returning-object-execute-insert-many', async () => {
        // The multi-row execute arm of the ON CONFLICT DO NOTHING
        // object-returning builder (ExecutableInsertReturningOptional.
        // executeInsertMany). Every other do-nothing object-returning test
        // exits through executeInsertNoneOrOne; this pins the array-returning
        // branch. Neither (name, plan) pair collides with a unique key, so both
        // rows insert and both come back.
        const expectedMock = [
            { id: 100, name: 'Conflict many A' },
            { id: 101, name: 'Conflict many B' },
        ]
        ctx.mockNext(expectedMock)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .values([
                    { name: 'Conflict many A', plan: 'free' },
                    { name: 'Conflict many B', plan: 'pro' },
                ])
                .onConflictDoNothing()
                .returning({ id: tOrganization.id, name: tOrganization.name })
                .executeInsertMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2), ($3, $4) on conflict do nothing returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Conflict many A",
                "free",
                "Conflict many B",
                "pro",
              ]
            `)
            assertType<Exact<typeof inserted, Array<{ id: number; name: string }>>>()
            expect(inserted).toHaveLength(2)
            // Names are deterministic; the auto-assigned ids are not.
            expect(inserted.map((r) => r.name).sort()).toEqual(['Conflict many A', 'Conflict many B'])
            if (!ctx.realDbEnabled) expect(inserted).toEqual(expectedMock)
        })
    })

    test('insert-on-conflict-do-nothing-returning-one-column-execute-insert-many', async () => {
        // The one-column arity twin of the object-returning sibling above: the
        // ON CONFLICT DO NOTHING builder reached through `returningOneColumn(col)`
        // instead of `returning({ ... })`, so the result is a plain `string[]`
        // rather than an array of row objects. Neither (name, plan) pair collides
        // with a unique key, so both rows insert and both names come back; a
        // suppressed row would simply shrink the array (no `| null` arm).
        const expectedMock = ['Conflict one-column A', 'Conflict one-column B']
        ctx.mockNext(expectedMock)
        await ctx.withRollback(async () => {
            const names = await ctx.conn.insertInto(tOrganization)
                .values([
                    { name: 'Conflict one-column A', plan: 'free' },
                    { name: 'Conflict one-column B', plan: 'pro' },
                ])
                .onConflictDoNothing()
                .returningOneColumn(tOrganization.name)
                .executeInsertMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2), ($3, $4) on conflict do nothing returning name as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Conflict one-column A",
                "free",
                "Conflict one-column B",
                "pro",
              ]
            `)
            assertType<Exact<typeof names, string[]>>()
            expect(names.slice().sort()).toEqual(['Conflict one-column A', 'Conflict one-column B'])
        })
    })

    test('insert-returning-one-column-nullable', async () => {
        // `returningOneColumn(<nullable column>)` — the scalar single-column
        // RETURNING shortcut over an OPTIONAL column, so the result carries the
        // column-intrinsic `| null` (every other returningOneColumn call in the
        // suite uses a required column). `archivedAt` is left unset on the inserted
        // row, so the scalar comes back null.
        ctx.mockNext(null)
        await ctx.withRollback(async () => {
            const archivedAt = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, name: 'Scalar nullable', slug: 'scalar-nullable' })
                .returningOneColumn(tProject.archivedAt)
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) returning archived_at as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Scalar nullable",
                "scalar-nullable",
              ]
            `)
            assertType<Exact<typeof archivedAt, Date | null>>()
            expect(archivedAt).toBeNull()
        })
    })

    test('insert-returning-rule1-gate-null-drops-object-default', async () => {
        // Object-form RETURNING with a RULE-1 gate on INSERT: `meta.gate` is
        // `tProject.archivedAt.asRequiredInOptionalObject()` and `meta.sibling` a
        // value-bearing `tProject.slug`. `archivedAt` is left unset on the inserted
        // row, so the gate is NULL and the whole `meta` object DROPS (rule-1) even
        // though the sibling has a value — the INSERT-returning entry applies rule-1.
        // Under the default projector `meta` is absent.
        ctx.mockNext({ id: 100, 'meta.sibling': 'rule1-insert-default', 'meta.gate': null })
        await ctx.withRollback(async () => {
            const row = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, name: 'Rule1 insert default', slug: 'rule1-insert-default' })
                .returning({
                    id:   tProject.id,
                    meta: { sibling: tProject.slug, gate: tProject.archivedAt.asRequiredInOptionalObject() },
                })
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) returning id as id, slug as "meta.sibling", archived_at as "meta.gate""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Rule1 insert default",
                "rule1-insert-default",
              ]
            `)
            assertType<Exact<typeof row, { id: number; meta?: { sibling: string; gate: Date } }>>()
            expect('meta' in row).toBe(false)
            if (!ctx.realDbEnabled) expect(row.id).toBe(100)
            else expect(row.id).toBeGreaterThan(4)
        })
    })

    test('insert-returning-rule1-gate-null-drops-object-as-nullable', async () => {
        // The same INSERT rule-1 gate under `projectingOptionalValuesAsNullable()`: the
        // `meta` object becomes `{...} | null` and the null gate surfaces it as
        // `meta: null`. `archivedAt` is left unset, so `meta` comes back present-null.
        ctx.mockNext({ id: 100, 'meta.sibling': 'rule1-insert-nullable', 'meta.gate': null })
        await ctx.withRollback(async () => {
            const row = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, name: 'Rule1 insert nullable', slug: 'rule1-insert-nullable' })
                .returning({
                    id:   tProject.id,
                    meta: { sibling: tProject.slug, gate: tProject.archivedAt.asRequiredInOptionalObject() },
                })
                .projectingOptionalValuesAsNullable()
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) returning id as id, slug as "meta.sibling", archived_at as "meta.gate""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Rule1 insert nullable",
                "rule1-insert-nullable",
              ]
            `)
            assertType<Exact<typeof row, { id: number; meta: { sibling: string; gate: Date } | null }>>()
            expect('meta' in row).toBe(true)
            expect(row.meta).toBe(null)
            if (!ctx.realDbEnabled) expect(row.id).toBe(100)
            else expect(row.id).toBeGreaterThan(4)
        })
    })
    test('insert-returning-nested-object-optional-leaf-default', async () => {
        // Object-form RETURNING whose nested `meta` group holds a SINGLE OPTIONAL leaf
        // (`archivedAt`, an optionalColumn) under the DEFAULT projector. Because every leaf
        // in the group is optional, the group itself is optional AND its leaf is optional:
        // `meta?: { archivedAt?: Date }`. Two boundary rows: an insert WITH archivedAt set → `meta`
        // present + `archivedAt` present; an insert leaving it unset → `meta` absent.
        await ctx.withRollback(async () => {
            const archivedAt = new Date(Date.UTC(2024, 5, 15, 8, 30, 0))
            ctx.mockNext({ id: 100, 'meta.archivedAt': archivedAt })
            const present = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, name: 'Archived demo', slug: 'archived-demo', archivedAt })
                .returning({
                    id:   tProject.id,
                    meta: { archivedAt: tProject.archivedAt },
                })
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, archived_at) values ($1, $2, $3, $4) returning id as id, archived_at as "meta.archivedAt""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Archived demo",
                "archived-demo",
                "2024-06-15T08:30:00.000Z",
              ]
            `)
            assertType<Exact<typeof present, { id: number; meta?: { archivedAt?: Date } }>>()
            expect('meta' in present).toBe(true)
            expect(present.meta && 'archivedAt' in present.meta).toBe(true)
            expect(present.meta!.archivedAt).toBeInstanceOf(Date)

            ctx.mockNext({ id: 101, 'meta.archivedAt': null })
            const absent = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, name: 'Unarchived demo', slug: 'unarchived-demo' })
                .returning({
                    id:   tProject.id,
                    meta: { archivedAt: tProject.archivedAt },
                })
                .executeInsertOne()
            assertType<Exact<typeof absent, { id: number; meta?: { archivedAt?: Date } }>>()
            expect('meta' in absent).toBe(false)
        })
    })
    test('insert-on-conflict-do-nothing-returning-nested-object-optional-leaf-default', async () => {
        // the same optional-leaf-inside-optional-object shape on the ON CONFLICT DO
        // NOTHING optional-returning path → `({ id: number; meta?: { archivedAt?: Date } } |
        // null)` (the suppressed-insert `| null` arm from `executeInsertNoneOrOne`). No key
        // collides, so a row comes back; archivedAt is left unset → `meta` absent.
        ctx.mockNext({ id: 100, 'meta.archivedAt': null })
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, name: 'On-conflict optional-leaf', slug: 'on-conflict-optional-leaf' })
                .onConflictDoNothing()
                .returning({
                    id:   tProject.id,
                    meta: { archivedAt: tProject.archivedAt },
                })
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict do nothing returning id as id, archived_at as "meta.archivedAt""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "On-conflict optional-leaf",
                "on-conflict-optional-leaf",
              ]
            `)
            assertType<Exact<typeof inserted, { id: number; meta?: { archivedAt?: Date } } | null>>()
            expect(inserted).not.toBeNull()
            expect('meta' in inserted!).toBe(false)
            if (!ctx.realDbEnabled) expect(inserted!.id).toBe(100)
            else expect(inserted!.id).toBeGreaterThan(4)
        })
    })

    test('insert-returning-temporal-plain-kinds-round-trip', async () => {
        // RETURNING the plain temporal kinds — localDate (reviewDate, optional) and
        // localTime (reviewTime, required) — on INSERT, then reading the same row back
        // with SELECT. The exact instant a date-only value reads back at is engine /
        // session-tz dependent, so the fix contract is pinned as RETURNING == SELECT
        // (the RETURNING value marshals identically to a plain read) rather than against
        // the inserted literal.
        await ctx.withRollback(async () => {
            const reviewDate = new Date(Date.UTC(2024, 5, 15))
            const reviewTime = new Date(Date.UTC(1970, 0, 1, 9, 30, 0))
            ctx.mockNext({ id: 900, reviewDate, reviewTime })
            const ret = await ctx.conn.insertInto(tProjectReview)
                .values({ projectId: 1, reviewerCode: 'R-Z9', score: 90, reviewDate, reviewTime })
                .returning({ id: tProjectReview.id, reviewDate: tProjectReview.reviewDate, reviewTime: tProjectReview.reviewTime })
                .executeInsertOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project_review (project_id, reviewer_code, score, review_date, review_time) values ($1, $2, $3, $4, $5) returning id as id, review_date as "reviewDate", review_time as "reviewTime""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "R-Z9",
                900,
                "2024-06-15T00:00:00.000Z",
                "09:30:00",
              ]
            `)
            assertType<Exact<typeof ret, { id: number; reviewDate?: Date; reviewTime: Date }>>()
            expect(ret.reviewTime).toBeInstanceOf(Date)
            expect(ret.reviewDate).toBeInstanceOf(Date)

            ctx.mockNext({ reviewDate, reviewTime })
            const sel = await ctx.conn.selectFrom(tProjectReview)
                .where(tProjectReview.id.equals(ret.id))
                .select({ reviewDate: tProjectReview.reviewDate, reviewTime: tProjectReview.reviewTime })
                .executeSelectOne()
            expect(ret.reviewDate).toEqual(sel.reviewDate)
            expect(ret.reviewTime).toEqual(sel.reviewTime)
        })
    })

    test('insert-returning-temporal-custom-kinds-round-trip', async () => {
        // RETURNING the branded custom temporal kinds on INSERT — customLocalDate
        // (releasedOn), customLocalTime (cutoffTime), customLocalDateTime (publishedAt)
        // — then reading the same row back. Same RETURNING == SELECT contract; the
        // custom kinds erase to plain `Date` on read.
        await ctx.withRollback(async () => {
            const releasedOn = new Date(Date.UTC(2025, 2, 10))
            const cutoffTime = new Date(Date.UTC(1970, 0, 1, 18, 45, 0))
            const publishedAt = new Date(Date.UTC(2025, 2, 11, 8, 15, 0))
            ctx.mockNext({ id: 910, releasedOn, cutoffTime, publishedAt })
            const ret = await ctx.conn.insertInto(tProjectRelease)
                .values({ projectId: 1, version: '9.9.9-ret', channel: 'beta', releasedOn, cutoffTime, publishedAt })
                .returning({
                    id:          tProjectRelease.id,
                    releasedOn:  tProjectRelease.releasedOn,
                    cutoffTime:  tProjectRelease.cutoffTime,
                    publishedAt: tProjectRelease.publishedAt,
                })
                .executeInsertOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project_release (project_id, version, channel, released_on, cutoff_time, published_at) values ($1, $2, $3, $4, $5, $6) returning id as id, released_on as "releasedOn", cutoff_time as "cutoffTime", published_at as "publishedAt""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "9.9.9-ret",
                "beta",
                "2025-03-10T00:00:00.000Z",
                "18:45:00",
                "2025-03-11T08:15:00.000Z",
              ]
            `)
            assertType<Exact<typeof ret, { id: number; releasedOn: Date; cutoffTime: Date; publishedAt: Date }>>()
            expect(ret.releasedOn).toBeInstanceOf(Date)
            expect(ret.cutoffTime).toBeInstanceOf(Date)
            expect(ret.publishedAt).toBeInstanceOf(Date)

            ctx.mockNext({ releasedOn, cutoffTime, publishedAt })
            const sel = await ctx.conn.selectFrom(tProjectRelease)
                .where(tProjectRelease.id.equals(ret.id))
                .select({
                    releasedOn:  tProjectRelease.releasedOn,
                    cutoffTime:  tProjectRelease.cutoffTime,
                    publishedAt: tProjectRelease.publishedAt,
                })
                .executeSelectOne()
            expect(ret.releasedOn).toEqual(sel.releasedOn)
            expect(ret.cutoffTime).toEqual(sel.cutoffTime)
            expect(ret.publishedAt).toEqual(sel.publishedAt)
        })
    })

    test('insert-returning-one-column-temporal-real-value', async () => {
        // `returningOneColumn(<localTime>)` on INSERT returns a REAL (non-null) Date —
        // the scalar temporal RETURNING branch (the existing scalar returning test uses
        // a nullable column that marshals regardless of the fix).
        await ctx.withRollback(async () => {
            const reviewTime = new Date(Date.UTC(1970, 0, 1, 11, 15, 0))
            ctx.mockNext(reviewTime)
            const v = await ctx.conn.insertInto(tProjectReview)
                .values({ projectId: 1, reviewerCode: 'R-Z8', score: 70, reviewTime })
                .returningOneColumn(tProjectReview.reviewTime)
                .executeInsertOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project_review (project_id, reviewer_code, score, review_time) values ($1, $2, $3, $4) returning review_time as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "R-Z8",
                700,
                "11:15:00",
              ]
            `)
            assertType<Exact<typeof v, Date>>()
            expect(v).toBeInstanceOf(Date)
        })
    })
})
