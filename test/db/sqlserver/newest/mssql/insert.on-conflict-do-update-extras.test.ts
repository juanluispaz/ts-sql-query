// Coverage of the on-conflict DO UPDATE shapes not exercised by
// `insert.on-conflict.test.ts` (which covers `onConflictDoNothing`,
// `onConflictDoUpdateSet`, `onConflictOn(cols).doUpdateSet`,
// value-source RHS and the excluded/values() reference):
//
//   1. `onConflictOn(cols).doUpdateSetIfValue({...})` — IfValue family
//      on the whole DO UPDATE block: a column whose value fails the gate
//      is dropped from the SET list.
//   2. `onConflictOn(cols).doUpdateSet({...}).setIfValue({...})` — the
//      chained `setIfValue` helper on the on-conflict UPDATE.
//   3. `onConflictOn(cols).doUpdateSet({...}).where(cond)` — the
//      WHERE-on-UPDATE branch (partial UPDATE on conflict).
//   4. `onConflictOn(cols).where(cond).doUpdateSet({...})` — partial
//      INDEX target.
//   5. `onConflictOn(cols).doNothing()` — explicit-target variant of
//      DO NOTHING (the bare `onConflictDoNothing` is already covered
//      by `insert.on-conflict.test.ts`).
//
// Every test uses `onConflictOn(cols)` explicit inference (required by
// PostgreSQL, accepted by the other dialects) so one body runs everywhere.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-do-update-set-if-value-fires-defined-fields', async () => {
        // `doUpdateSetIfValue` is the IfValue twin of `doUpdateSet`.
        // Each field is elided independently when its value fails the
        // value gate (undefined / null / empty string by default). Here
        // `name` is defined and `slug` is an empty string → the SET list
        // emits only `name = ?`.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const newName: string | undefined = 'Marketing site v2'
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSetIfValue({ name: newName, slug: '' as any })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Marketing site v2",
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
    test('on-conflict-do-update-set-then-set-if-value-chain', async () => {
        // Chain `setIfValue` after `doUpdateSet`. Both contribute to
        // the SET list; the IfValue side drops fields whose RHS fails the
        // value gate. Pins the `setIfValue` branch in the on-conflict
        // context (distinct from the non-conflict INSERT setIfValue chain
        // covered by `insert.conditional-sets`).
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site v3' })
                .setIfValue({ slug: '' as any })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Marketing site v3",
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
    test('on-conflict-do-update-set-with-where-clause', async () => {
        // Partial UPDATE on conflict: the SET clause only fires when
        // the WHERE condition holds. Seeded row id=1 has
        // `name='Marketing site'`; the WHERE `name <> 'Marketing site v4'`
        // is true, so the UPDATE applies.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site v4' })
                .where(tProject.name.notEquals('Marketing site v4'))
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ? where project.name <> ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Marketing site v4",
                "Marketing site v4",
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
    test('on-conflict-on-columns-with-where-do-update', async () => {
        // Partial INDEX target: `onConflictOn(cols).where(cond)` targets a
        // partial unique index. Seeded row id=1 (`mktg-site`,
        // organizationId=1) matches; the seed has `published='t'`, so
        // `.where(tProject.published.equals(true))` selects it.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .where(tProject.published.equals(true))
                .doUpdateSet({ name: 'Marketing site v5' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on conflict (organization_id, slug) where (published = 't') = ? do update set name = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                1,
                "Marketing site v5",
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
    test('on-conflict-on-columns-do-nothing-explicit', async () => {
        // `onConflictOn(cols).doNothing()` — the explicit-target
        // variant of DO NOTHING (the bare `onConflictDoNothing` form is
        // already covered by `insert.on-conflict.test.ts`).
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doNothing()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on conflict (organization_id, slug) do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            if (ctx.realDbEnabled) expect(typeof inserted).toBe('number')
            else expect(inserted).toBe(0)
        })
    })
    */
    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-on-columns-do-update-returning-last-inserted-id-is-non-null', async () => {
        // On the do-UPDATE conflict path `returningLastInsertedId()` is a
        // non-null `number` (a DO UPDATE always affects a row), unlike the
        // do-NOTHING path where it is `number | null`. Project
        // (organization_id=1, slug='mktg-site') already exists as id=1, so the
        // upsert conflicts, updates, and RETURNING gives back id=1.
        const expectedId = 1
        ctx.mockNext(expectedId)
        await ctx.withRollback(async () => {
            const id = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Marketing site v6' })
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4 returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Marketing site v6",
              ]
            `)
            assertType<Exact<typeof id, number>>()
            expect(id).toBe(expectedId)
        })
    })
    */

})
