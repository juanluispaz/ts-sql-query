// Documentation snippets for the Insert on conflict page (docs/queries/insert-on-conflict.md).

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('docs:insert-on-conflict/on-conflict-do-nothing', async () => {
        // Section "Insert on conflict do nothing" — `.onConflictDoNothing()`
        // with RETURNING + executeInsertNoneOrOne
        // the result is `T | null` (the row is null when the conflict
        // suppressed the insert).
        ctx.mockNext({ id: 1, name: 'Acme Corp', plan: 'pro' })

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const maybeInserted = await connection.insertInto(tOrganization)
                .set({
                    name: 'Acme Corp',
                    plan: 'pro',
                })
                .onConflictDoNothing()
                .returning({
                    id:   tOrganization.id,
                    name: tOrganization.name,
                    plan: tOrganization.plan,
                })
                .executeInsertNoneOrOne()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) on conflict do nothing returning id as id, name as name, "plan" as "plan""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Acme Corp",
                "pro",
              ]
            `)
            assertType<Exact<typeof maybeInserted, { id: number; name: string; plan: string } | null>>()
        })
    })
    */

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('docs:insert-on-conflict/on-conflict-do-update', async () => {
        // Section "Insert on conflict do update" — the targeted
        // `.onConflictOn(col).doUpdateSet({...})` form. The bare
        // `.onConflictDoUpdateSet({...})` form lives below as docs-extra.
        ctx.mockNext({ id: 1, name: 'Acme Corp', plan: 'enterprise' })

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const upserted = await connection.insertInto(tOrganization)
                .set({
                    name: 'Acme Corp',
                    plan: 'pro',
                })
                .onConflictOn(tOrganization.id)
                .doUpdateSet({
                    plan: 'enterprise',
                })
                .returning({
                    id:   tOrganization.id,
                    name: tOrganization.name,
                    plan: tOrganization.plan,
                })
                .executeInsertOne()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) on conflict (id) do update set "plan" = ? returning id as id, name as name, "plan" as "plan""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Acme Corp",
                "pro",
                "enterprise",
              ]
            `)
            assertType<Exact<typeof upserted, { id: number; name: string; plan: string }>>()
        })
    })
    */

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('docs-extra:insert-on-conflict/on-conflict-do-update-bare', async () => {
        // The bare upsert variant — `.onConflictDoUpdateSet({...})`
        // without a target column. Any unique-key violation triggers the
        // UPDATE.
        ctx.mockNext({ id: 1, name: 'Acme Corp', plan: 'pro' })

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const upserted = await connection.insertInto(tOrganization)
                .set({
                    name: 'Acme Corp',
                    plan: 'pro',
                })
                .onConflictDoUpdateSet({
                    plan: 'enterprise',
                })
                .returning({
                    id:   tOrganization.id,
                    name: tOrganization.name,
                    plan: tOrganization.plan,
                })
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) on conflict do update set "plan" = ? returning id as id, name as name, "plan" as "plan""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Acme Corp",
                "pro",
                "enterprise",
              ]
            `)
            assertType<Exact<typeof upserted, { id: number; name: string; plan: string }>>()
        })
    })
    */

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('docs-extra:insert-on-conflict/values-for-insert-in-update', async () => {
        // Section trailing block: `valuesForInsert()` gives access to the
        // incoming-row representation so the update body can reference
        // both the existing row's columns and the new values.
        ctx.mockNext({ id: 1, name: 'Acme Corp / Acme Corp', plan: 'pro' })

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const tOrgForInsert = tOrganization.valuesForInsert()
            const upserted = await connection.insertInto(tOrganization)
                .set({
                    name: 'Acme Corp',
                    plan: 'pro',
                })
                .onConflictOn(tOrganization.id)
                .doUpdateSet({
                    name: tOrganization.name.concat(' / ').concat(tOrgForInsert.name),
                })
                .returning({
                    id:   tOrganization.id,
                    name: tOrganization.name,
                    plan: tOrganization.plan,
                })
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) on conflict (id) do update set name = organization.name || ? || excluded.name returning id as id, name as name, "plan" as "plan""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Acme Corp",
                "pro",
                " / ",
              ]
            `)
            assertType<Exact<typeof upserted, { id: number; name: string; plan: string }>>()
        })
    })
    */
})
