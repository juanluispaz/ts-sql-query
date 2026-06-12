// Chains `.and(...)` / `.or(...)` after `.where(...)` on the ON CONFLICT
// branches of an INSERT — exercises code paths in
// [InsertQueryBuilder.ts:1866-1910](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L1866-L1910)
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
//
// Active in postgres and sqlite cells (the only dialects that type
// `.onConflictOn(...)` and accept a WHERE clause on ON CONFLICT).
// MariaDB/MySQL (`ON DUPLICATE KEY UPDATE` — no target spec, no
// WHERE) and Oracle/SQL Server (no ON CONFLICT syntax — they use
// `MERGE`) comment the file body out for symmetry.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('do-update-set-where-then-and-or-builds-compound-update-predicate', async () => {
        // `onConflictOn(cols).doUpdateSet(...).where(c1).and(c2).or(c3)`
        // — pins `and()` and `or()` dispatch on
        // `__onConflictUpdateSets` ([L1866-1876](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L1866-L1876)
        // and [L1889-1899](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L1889-L1899)).
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

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-columns-where-then-and-or-builds-compound-partial-index-predicate', async () => {
        // `onConflictOn(cols).where(c1).and(c2).or(c3).doUpdateSet(...)`
        // — pins `and()` and `or()` dispatch on
        // `__onConflictOnColumns` ([L1877-1887](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L1877-L1887)
        // and [L1900-1910](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L1900-L1910)).
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
