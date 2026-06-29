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

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
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
    */

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
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
    */

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
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
    */

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
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
    */
})
