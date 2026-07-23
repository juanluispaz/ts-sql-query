// Chains `.and(...)` / `.or(...)` after `.where(...)` on the ON CONFLICT
// branches of an INSERT — exercises code paths
// that the existing `insert.on-conflict-do-update-extras.test.ts`
// leaves alone (it only uses `.where(c1)` with no follow-up chain).
//
// The `and()` / `or()` methods on the on-conflict builder are a
// SEPARATE dispatch from the regular `WHERE`'s `and()` / `or()`:
// they branch on whether `__onConflictUpdateSets` or
// `__onConflictOnColumns` is set, and they accumulate the predicate
// on `__onConflictUpdateWhere` or `__onConflictOnColumnsWhere`
// respectively. The two dispatch branches are not reachable via
// any other test in the matrix.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('do-update-set-where-then-and-or-builds-compound-update-predicate', async () => {
        // `onConflictOn(cols).doUpdateSet(...).where(c1).and(c2).or(c3)`
        // — pins `and()` and `or()` dispatch on
        // `__onConflictUpdateSets`.
        // The emitted predicate is `c1 AND c2 OR c3` with the
        // parenthesisation chosen by the builder.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site v6' })
                .where(tProject.name.notEquals('Marketing site v6'))
                    .and(tProject.archivedAt.isNull())
                    .or(tProject.published.equals(false))
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4 where (project.name <> $5 and project.archived_at is null) or (project.published = 't') = $6"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Marketing site v6",
                "Marketing site v6",
                false,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })

    test('on-columns-where-then-and-or-builds-compound-partial-index-predicate', async () => {
        // `onConflictOn(cols).where(c1).and(c2).or(c3).doUpdateSet(...)`
        // — pins `and()` and `or()` dispatch on
        // `__onConflictOnColumns`.
        // This is the PARTIAL-INDEX-TARGET predicate (between the
        // conflict-target columns and the DO UPDATE clause), distinct
        // from the partial-UPDATE predicate covered by test 1.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .where(tProject.published.equals(true))
                    .and(tProject.archivedAt.isNull())
                    .or(tProject.name.equals('Marketing site'))
                .doUpdateSet({ name: 'Marketing site v7' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) where ((published = 't') = $4 and archived_at is null) or name = $5 do update set name = $6"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                true,
                "Marketing site",
                "Marketing site v7",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })

    test('do-update-set-dynamic-where-matches-the-direct-where', async () => {
        // `dynamicWhere()` after `.doUpdateSet(...)` starts an empty DO UPDATE
        // predicate; the first `.and(...)` seeds it, so the chain builds the
        // same `c1 and c2 or c3` as the direct `.where(c1).and(c2).or(c3)` form,
        // which is built (not executed) and compared.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site v6' })
                .dynamicWhere()
                    .and(tProject.name.notEquals('Marketing site v6'))
                    .and(tProject.archivedAt.isNull())
                    .or(tProject.published.equals(false))
                .executeInsert()
            const dynamicSql = ctx.lastSql
            const dynamicParams = ctx.lastParams

            const viaWhere = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site v6' })
                .where(tProject.name.notEquals('Marketing site v6'))
                    .and(tProject.archivedAt.isNull())
                    .or(tProject.published.equals(false))
            expect(viaWhere.query()).toBe(dynamicSql)
            expect(viaWhere.params()).toEqual(dynamicParams)

            expect(dynamicSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4 where (project.name <> $5 and project.archived_at is null) or (project.published = 't') = $6"`)
            expect(dynamicParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Marketing site v6",
                "Marketing site v6",
                false,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })

    test('on-columns-dynamic-where-matches-the-direct-where', async () => {
        // `dynamicWhere()` placed before `.doUpdateSet(...)` builds the
        // conflict-target (partial-index) predicate rather than the DO UPDATE
        // predicate. It builds the same chain as the direct `.where(...)` form,
        // which is built (not executed) and compared.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .dynamicWhere()
                    .and(tProject.published.equals(true))
                    .and(tProject.archivedAt.isNull())
                    .or(tProject.name.equals('Marketing site'))
                .doUpdateSet({ name: 'Marketing site v7' })
                .executeInsert()
            const dynamicSql = ctx.lastSql
            const dynamicParams = ctx.lastParams

            const viaWhere = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .where(tProject.published.equals(true))
                    .and(tProject.archivedAt.isNull())
                    .or(tProject.name.equals('Marketing site'))
                .doUpdateSet({ name: 'Marketing site v7' })
            expect(viaWhere.query()).toBe(dynamicSql)
            expect(viaWhere.params()).toEqual(dynamicParams)

            expect(dynamicSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) where ((published = 't') = $4 and archived_at is null) or name = $5 do update set name = $6"`)
            expect(dynamicParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                true,
                "Marketing site",
                "Marketing site v7",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })
    test('do-update-set-where-continuation-carries-returning-one-column', async () => {
        // The DO UPDATE WHERE-continuation node still exposes the RETURNING
        // surface: `.where(cond).returningOneColumn(col)`. The WHERE can suppress
        // the update, so the result is None-or-One (`number | null`). tProject has
        // UNIQUE (organization_id, slug); (1, 'mktg-site') collides with the seed
        // and the WHERE (name differs from the new value) holds, so the row is
        // updated and its id comes back.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const id = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Upd where col' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Upd where col' })
                .where(tProject.name.notEquals('Upd where col'))
                .returningOneColumn(tProject.id)
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4 where project.name <> $5 returning id as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Upd where col",
                "Upd where col",
                "Upd where col",
              ]
            `)
            assertType<Exact<typeof id, number | null>>()
            expect(id).toBe(1)
        })
    })

    test('do-update-set-where-and-or-chain-then-returning-object', async () => {
        // The `.where(c1).and(c2).or(c3)` compound DO UPDATE predicate followed by
        // `.returning({obj})` — the and/or-chained WHERE node still carries the
        // full RETURNING surface. The update fires (name differs, not archived),
        // so {id, name} come back; None-or-One because the WHERE can suppress.
        const expected = { id: 1, name: 'Upd chain' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Upd chain' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Upd chain' })
                .where(tProject.name.notEquals('Upd chain'))
                    .and(tProject.archivedAt.isNull())
                    .or(tProject.published.equals(false))
                .returning({ id: tProject.id, name: tProject.name })
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4 where (project.name <> $5 and project.archived_at is null) or (project.published = 't') = $6 returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Upd chain",
                "Upd chain",
                "Upd chain",
                false,
              ]
            `)
            assertType<Exact<typeof row, { id: number, name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })

    test('multi-row-do-update-set-where-returning-object', async () => {
        // Multi-row VALUES + targeted on-conflict + a partial-update WHERE +
        // `returning({obj})` (executeInsertMany). `doUpdateSet` uses a
        // `valuesForInsert()` RHS so each conflicting row updates to its own
        // attempted name; the WHERE (archived_at is null) holds for both existing
        // projects 1 ('mktg-site') and 2 ('tools'), so DO UPDATE produces a row
        // for each and RETURNING yields their {id, name}.
        const expected = [
            { id: 1, name: 'Upd A' },
            { id: 2, name: 'Upd B' },
        ]
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const rows = await ctx.conn.insertInto(tProject)
                .values([
                    { organizationId: 1, slug: 'mktg-site', name: 'Upd A' },
                    { organizationId: 1, slug: 'tools', name: 'Upd B' },
                ])
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: tProject.valuesForInsert().name })
                .where(tProject.archivedAt.isNull())
                .returning({ id: tProject.id, name: tProject.name })
                .executeInsertMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3), ($4, $5, $6) on conflict (organization_id, slug) do update set name = excluded.name where project.archived_at is null returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Upd A",
                1,
                "tools",
                "Upd B",
              ]
            `)
            assertType<Exact<typeof rows, Array<{ id: number, name: string }>>>()
            expect([...rows].sort((a, b) => a.id - b.id)).toEqual(expected)
        })
    })

    test('on-columns-arbiter-where-then-do-update-set-where-lands-both-predicates', async () => {
        // Two independently-built WHERE clauses in one statement: the conflict-target
        // (partial-index) ARBITER predicate from `onConflictOn(cols).where(...)`, and the DO
        // UPDATE predicate from `doUpdateSet(...).where(...)`. They land as
        // `on conflict (cols) where <arbiter> do update set ... where <update>`. A plain
        // (non-partial) UNIQUE index satisfies any arbiter predicate, so both PostgreSQL and
        // SQLite accept it. (1, 'mktg-site') collides with the seed; the non-archived arbiter
        // matches and the update fires because the name differs from the new value.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .where(tProject.archivedAt.isNull())
                .doUpdateSet({ name: 'Marketing site v8' })
                .where(tProject.name.notEquals('Marketing site v8'))
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) where archived_at is null do update set name = $4 where project.name <> $5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Marketing site v8",
                "Marketing site v8",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })

    test('do-update-set-dynamic-where-first-or-seeds-the-predicate', async () => {
        // `doUpdateSet(...).dynamicWhere().or(c1).or(c2)` — the FIRST `.or(...)`
        // seeds an empty DO UPDATE predicate (the no-predicate-yet arm of `or()`),
        // which the `.and()`-first dynamic sibling never reaches. Built and compared
        // to the direct `.where(c1).or(c2)` form, then executed.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site v9' })
                .dynamicWhere()
                    .or(tProject.name.notEquals('Marketing site v9'))
                    .or(tProject.published.equals(false))
                .executeInsert()
            const dynSql = ctx.lastSql
            const dynParams = ctx.lastParams

            const viaWhere = ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site v9' })
                .where(tProject.name.notEquals('Marketing site v9'))
                    .or(tProject.published.equals(false))
            expect(viaWhere.query()).toBe(dynSql)
            expect(viaWhere.params()).toEqual(dynParams)

            expect(dynSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4 where project.name <> $5 or (project.published = 't') = $6"`)
            expect(dynParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Marketing site v9",
                "Marketing site v9",
                false,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('on-columns-dynamic-where-first-or-seeds-the-arbiter-predicate', async () => {
        // `onConflictOn(cols).dynamicWhere().or(c1).or(c2).doUpdateSet(...)` — the
        // FIRST `.or(...)` seeds the conflict-target (partial-index) predicate. A
        // plain UNIQUE index satisfies any arbiter predicate, so pg + sqlite accept
        // the OR form.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .dynamicWhere()
                    .or(tProject.published.equals(true))
                    .or(tProject.name.equals('Marketing site'))
                .doUpdateSet({ name: 'Marketing site v10' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) where (published = 't') = $4 or name = $5 do update set name = $6"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                true,
                "Marketing site",
                "Marketing site v10",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
})
