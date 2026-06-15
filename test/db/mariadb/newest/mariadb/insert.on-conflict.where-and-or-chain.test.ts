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

    // NOT-APPLICABLE: MariaDB uses the bare onConflictDoUpdateSet form — `.onConflictOn(...)` is not typed on `MariaDBConnection` (MariaDB's `ON DUPLICATE KEY UPDATE` grammar takes no column list and no WHERE clause); see `test/db/mariadb/types.negative/insert.test.ts`.
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

    // NOT-APPLICABLE: MariaDB uses the bare onConflictDoUpdateSet form — `.onConflictOn(...)` is not typed on `MariaDBConnection` (MariaDB's `ON DUPLICATE KEY UPDATE` grammar takes no column list and no WHERE clause); see `test/db/mariadb/types.negative/insert.test.ts`.
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
})
