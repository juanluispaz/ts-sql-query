// Coverage of `connection.default()` — the typed reference to the SQL
// `DEFAULT` keyword that survives until the SqlBuilder dispatches it
// through `_default(params)`
// and `AbstractSqlBuilder._default`). It is only typed on columns
// declared with `columnWithDefaultValue` — the per-table optional vs
// `Default` branch in
// and `src/expressions/update.ts`.
//
// `default-on-custom-boolean-column` covers the boolean-remap
// short-circuit: the SqlBuilder detects the `Default` sentinel inside
// `_appendCustomBooleanRemapForColumnIfRequired` and emits the bare
// `default` keyword instead of wrapping it in
// `case when default then 'Y' else 'N' end` (which every dialect
// rejects at execution time).
//
// SQLite is not exercised here — `SqliteConnection` does not expose
// `default()` (SQLite's grammar rejects DEFAULT as a value expression
// in INSERT VALUES / UPDATE SET / ON CONFLICT DO UPDATE SET). The
// compile-time negative lives at
// [test/db/sqlite/types.negative/insert.test.ts](../../../../sqlite/types.negative/insert.test.ts);
// the sqlite cells keep `insert.default-keyword.test.ts` for cross-cell
// symmetry per DESIGN §4 with every test commented out.

import { afterAll, beforeAll, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)

    // NOT-APPLICABLE: SqliteConnection does not expose default(); SQLite rejects
    // DEFAULT as a value expression in INSERT VALUES / UPDATE SET. Kept commented
    // for cross-cell symmetry (compile-time negative lives in types.negative/).
    /*
    import { assertType, type Exact } from '../../../../lib/assertType.js'
    import { tOrganization, tProject } from '../../domain/connection.js'
    import { test, expect } from '../../../../lib/testRunner.js'
    beforeEach(() => { ctx.reset() })

    test('insert-with-explicit-default-keyword', async () => {
        // `createdAt` is columnWithDefaultValue, so the type union
        // `T | Default` allows `connection.default()`. The resulting
        // SQL keeps the column in the column list with the literal
        // `default` value alongside the bound name/plan.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            await connection.insertInto(tOrganization)
                .values({
                    name: 'DefaultCo',
                    plan: 'free',
                    createdAt: connection.default(),
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
        })
    })
    */

    // NOT-APPLICABLE: SqliteConnection does not expose default(); SQLite rejects
    // DEFAULT as a value expression in INSERT VALUES / UPDATE SET. Kept commented
    // for cross-cell symmetry (compile-time negative lives in types.negative/).
    /*
    test('update-set-to-default-keyword', async () => {
        // `connection.default()` in `.set({...})` resets the column to
        // the DDL default at the dialect level (current_timestamp here).
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const affected = await connection.update(tProject)
                .set({
                    createdAt: connection.default(),
                })
                .where(tProject.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof affected, number>>()
        })
    })
    */

    // NOT-APPLICABLE: SqliteConnection does not expose default(); SQLite rejects
    // DEFAULT as a value expression in INSERT VALUES / UPDATE SET. Kept commented
    // for cross-cell symmetry (compile-time negative lives in types.negative/).
    /*
    test('on-conflict-do-update-with-default-keyword', async () => {
        // The `default()` literal also survives through the
        // ON CONFLICT … DO UPDATE SET arm. Same dispatch as plain
        // update set, just stitched after the conflict glue.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            await connection.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({
                    createdAt: connection.default(),
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
        })
    })
    */

    // NOT-APPLICABLE: SqliteConnection does not expose default(); SQLite rejects
    // DEFAULT as a value expression in INSERT VALUES / UPDATE SET. Kept commented
    // for cross-cell symmetry (compile-time negative lives in types.negative/).
    /*
    test('multi-row-insert-with-default-in-some-rows', async () => {
        // Multi-row insert where one row uses an explicit value for the
        // default column and the other uses `default()`. Every row in
        // the values list keeps the same column order, so the SQL has
        // `default` sitting next to the bound placeholder for the row
        // that supplies a value.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const explicit = new Date('2024-01-01T00:00:00Z')
            await connection.insertInto(tOrganization)
                .values([
                    { name: 'MultiA', plan: 'free', createdAt: connection.default() },
                    { name: 'MultiB', plan: 'pro',  createdAt: explicit },
                ])
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
        })
    })
    */

    // NOT-APPLICABLE: SqliteConnection does not expose default(); SQLite rejects
    // DEFAULT as a value expression in INSERT VALUES / UPDATE SET. Kept commented
    // for cross-cell symmetry (compile-time negative lives in types.negative/).
    /*
    test('default-on-custom-boolean-column', async () => {
        // Regression: `verified` carries a `CustomBooleanTypeAdapter`,
        // so `_appendCustomBooleanRemapForColumnIfRequired` used to
        // wrap `connection.default()` in
        // `case when default then 'Y' else 'N' end` — invalid SQL. The
        // builder now detects the `Default` sentinel and short-circuits
        // the remap, emitting the bare `default` keyword (the DDL
        // default `'N'` wins at runtime).
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            await connection.insertInto(tOrganization)
                .values({
                    name:     'CustomBoolDefault',
                    plan:     'free',
                    verified: connection.default(),
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan, verified) values (?, ?, default)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "CustomBoolDefault",
                "free",
              ]
            `)
        })
    })
    */
})
