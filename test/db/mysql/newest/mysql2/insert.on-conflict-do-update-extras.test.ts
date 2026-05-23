// Coverage of the on-conflict DO UPDATE shapes not exercised by
// `insert.on-conflict.test.ts`. The existing file covers
// `onConflictDoNothing`, `onConflictDoUpdateSet`,
// `onConflictOn(cols).doUpdateSet`, value-source RHS and the
// `valuesForInsert()` (excluded/values()) reference. What is NOT
// covered today and lives in distinct branches of
// `InsertQueryBuilder._buildInsertOnConflictBeforeReturning`:
//
//   1. `onConflictOn(cols).doUpdateSetIfValue({...})` — IfValue family
//      on the whole DO UPDATE block: a column with `undefined` is
//      dropped from the SET list.
//   2. `onConflictOn(cols).doUpdateSet({...}).setIfValue({...})` — the
//      chained `setIfValue` helper on the on-conflict UPDATE.
//   3. `onConflictOn(cols).doUpdateSet({...}).where(cond)` — the
//      WHERE-on-UPDATE branch (partial UPDATE on conflict). PostgreSQL
//      and SQLite accept it; MariaDB/MySQL don't (their
//      `ON DUPLICATE KEY UPDATE` has no WHERE — commented out per
//      cell).
//   4. `onConflictOn(cols).where(cond).doUpdateSet({...})` — partial
//      INDEX target. PG/SQLite only — same reason as (3).
//   5. `onConflictOn(cols).doNothing()` — explicit-target variant of
//      DO NOTHING (the bare `onConflictDoNothing` is already covered
//      by `insert.on-conflict.test.ts`). Pins
//      `__onConflictOnColumns` + `__onConflictDoNothing` together.
//
// Every test uses `onConflictOn(cols)` explicit inference — PostgreSQL
// rejects bare `ON CONFLICT DO UPDATE` without it
// ("ON CONFLICT DO UPDATE requires inference specification"). MariaDB
// and MySQL don't type `onConflictOn(...)` at all (their
// `ON DUPLICATE KEY UPDATE` grammar takes no column list); all five
// tests are commented out on those cells, same as the existing
// `on-conflict-on-columns-do-update` in `insert.on-conflict.test.ts`.
// Oracle and SQL Server have no `ON CONFLICT` syntax (they use
// `MERGE`); the corresponding cells also comment out the entire file
// body.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // Not applicable on MySQL: `onConflictOn(...)` is not typed on MySqlConnection (the `ON DUPLICATE KEY UPDATE` grammar takes no column list); see `test/db/mysql/types.negative/insert.test.ts` for the compile-time negative.
    /*
    test('on-conflict-do-update-set-if-value-fires-defined-fields', async () => {
        // `doUpdateSetIfValue` is the IfValue twin of `doUpdateSet`.
        // Each field is elided independently when the runtime check
        // `_isValue(value)` returns false (undefined / null / empty
        // string by default). Here `name` is defined and `slug` is
        // an empty string → the SET list emits only `name = ?`. The
        // empty-string-as-elide pattern matches the existing
        // `insert.conditional-sets.test.ts` usage (`exactOptionalPropertyTypes`
        // forbids assigning `undefined` to a non-`| undefined`
        // optional field, so the `as any` cast preserves the runtime
        // semantics while satisfying the typer).
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

    // Not applicable on MySQL: `onConflictOn(...)` is not typed on MySqlConnection (the `ON DUPLICATE KEY UPDATE` grammar takes no column list); see `test/db/mysql/types.negative/insert.test.ts` for the compile-time negative.
    /*
    test('on-conflict-do-update-set-then-set-if-value-chain', async () => {
        // Chain `setIfValue` after `doUpdateSet`. Both contribute to
        // the SET list; the IfValue side drops fields whose RHS is
        // not a value (per `_isValue`). Pins the `setIfValue` branch
        // in the on-conflict context (distinct from the non-conflict
        // INSERT setIfValue chain covered by
        // `insert.conditional-sets`). The empty-string-as-elide cast
        // is the same pattern as test 1.
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

    // Not applicable on MySQL: `onConflictOn(...)` is not typed on MySqlConnection (the `ON DUPLICATE KEY UPDATE` grammar takes no column list); see `test/db/mysql/types.negative/insert.test.ts` for the compile-time negative.
    /*
    test('on-conflict-do-update-set-with-where-clause', async () => {
        // Partial UPDATE on conflict: the SET clause only fires when
        // the WHERE condition holds. Seeded row id=1 has
        // `name='Marketing site'`; the WHERE
        // `name <> 'Marketing site v4'` is true, so the UPDATE
        // applies. Pins
        // `_buildInsertOnConflictBeforeReturning`'s `__onConflictUpdateWhere`
        // branch.
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

    // Not applicable on MySQL: `onConflictOn(...)` is not typed on MySqlConnection (the `ON DUPLICATE KEY UPDATE` grammar takes no column list); see `test/db/mysql/types.negative/insert.test.ts` for the compile-time negative.
    /*
    test('on-conflict-on-columns-with-where-do-update', async () => {
        // Partial INDEX target: `onConflictOn(cols).where(cond)` is
        // PostgreSQL/SQLite's way to target a partial unique index.
        // Pins the `__onConflictOnColumnsWhere` branch. Seeded row
        // id=1 (`mktg-site`, organizationId=1) matches; the seed has
        // `published='t'`, so `.where(tProject.published.equals(true))`
        // selects it.
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

    // Not applicable on MySQL: `onConflictOn(...)` is not typed on MySqlConnection (the `ON DUPLICATE KEY UPDATE` grammar takes no column list); see `test/db/mysql/types.negative/insert.test.ts` for the compile-time negative.
    /*
    test('on-conflict-on-columns-do-nothing-explicit', async () => {
        // `onConflictOn(cols).doNothing()` — the explicit-target
        // variant of DO NOTHING (the bare `onConflictDoNothing` form
        // is already covered by `insert.on-conflict.test.ts`). Pins
        // `__onConflictOnColumns` + `__onConflictDoNothing` together,
        // which is a distinct branch in
        // `_buildInsertOnConflictBeforeReturning` from the bare
        // do-nothing path.
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
})
