// FROM-SELECT × ON CONFLICT DO UPDATE set-arms — the on-conflict update-set
// helpers reached off `insertInto(t).from(select)` (NON-shaped — the
// `ShapedInsertExpression` has no `from(select)`, so the shaped twin of this
// surface is intentionally unreachable; see `OnConflictDoInsertFromSelect` /
// `CustomizableExecutableInsertFromSelectOnConflict` in src/expressions/insert.ts).
//
// `insert.from-select.variants.test.ts` already pins the from-select
// `onConflictDoNothing()` / `onConflictOn(...).doNothing()` / returning arms.
// This file pins the from-select DO UPDATE arms specifically:
//
//   - `onConflictOn(cols).doUpdateSetIfValue({...})` — value-gated one-shot
//     update-set on the from-select upsert (drops `undefined` fields).
//   - `onConflictOn(cols).doUpdateDynamicSet({...})` + chained set helpers
//     (`setIfValue` / `ignoreIfHasNoValue`) — the dynamic update-set on the
//     from-select upsert, routing into `__onConflictUpdateSets`.
//
// The conflict source re-selects project 1's (organization_id, slug), which
// collides with the UNIQUE (organization_id, slug), so the targeted DO UPDATE
// refreshes `name`. Dialects without INSERT…ON CONFLICT (oracle, sqlServer)
// and dialects without a conflict target on the from-select upsert
// (mariadb/mysql use the bare form) comment the targeted arms out for symmetry.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

// Every test in this cell is NOT-APPLICABLE (see each block below); the imports are
// kept identical to the live cells for cross-cell symmetry, and these sentinels satisfy
// noUnusedLocals while the tests stay commented out.
void expect; void test; void assertType; void tProject
export type { Exact }

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('from-select-on-conflict-on-columns-do-update-set-if-value-drops-undefined', async () => {
        // `from(select).onConflictOn(cols).doUpdateSetIfValue({...})` — the
        // value-gated one-shot update-set on the from-select upsert: `name` is
        // defined and survives; `slug` is an empty string so it fails the value
        // gate and is dropped before the SET clause.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const newName: string | undefined = 'Reactivated via from-select'
            const source = ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({
                    organizationId: tProject.organizationId,
                    slug:           tProject.slug,
                    name:           tProject.name,
                })

            const affected = await ctx.conn.insertInto(tProject)
                .from(source)
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSetIfValue({ name: newName, slug: '' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) select organization_id as "organizationId", slug as slug, name as name from project where id = $1 on conflict (organization_id, slug) do update set name = $2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Reactivated via from-select",
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
    test('from-select-on-conflict-on-columns-do-update-dynamic-set-then-set-if-value', async () => {
        // `from(select).onConflictOn(cols).doUpdateDynamicSet({name})` opens the
        // conflict update-set, then a chained `.setIfValue({slug: undefined})` is
        // dropped via `_isValue` — the dynamic update-set routing
        // (`__onConflictUpdateSets`) on the from-select upsert.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const source = ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({
                    organizationId: tProject.organizationId,
                    slug:           tProject.slug,
                    name:           tProject.name,
                })

            const affected = await ctx.conn.insertInto(tProject)
                .from(source)
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated via dynamic from-select' })
                .setIfValue({ slug: undefined })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) select organization_id as "organizationId", slug as slug, name as name from project where id = $1 on conflict (organization_id, slug) do update set name = $2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Reactivated via dynamic from-select",
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
    test('from-select-on-conflict-on-columns-do-update-dynamic-set-ignore-if-has-no-value', async () => {
        // `from(select).onConflictOn(cols).doUpdateDynamicSet({name, archivedAt: null})`
        // followed by `ignoreIfHasNoValue('archivedAt')` — the staged
        // `archivedAt` is null so it is pruned; the real-valued `name` survives.
        // Pins the set-manipulation family on the from-select conflict update-set.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const source = ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({
                    organizationId: tProject.organizationId,
                    slug:           tProject.slug,
                    name:           tProject.name,
                })

            const affected = await ctx.conn.insertInto(tProject)
                .from(source)
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated from-select', archivedAt: null })
                .ignoreIfHasNoValue('archivedAt')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) select organization_id as "organizationId", slug as slug, name as name from project where id = $1 on conflict (organization_id, slug) do update set name = $2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Reactivated from-select",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })
    */

})
