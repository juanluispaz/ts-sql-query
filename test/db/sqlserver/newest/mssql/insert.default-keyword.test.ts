// Coverage of `connection.default()` — the typed reference to the SQL
// `DEFAULT` keyword that survives until the SqlBuilder dispatches it
// through `_default(params)` (see
// [src/expressions/Default.ts](../../../../../src/expressions/Default.ts)
// and `AbstractSqlBuilder._default`). It is only typed on columns
// declared with `columnWithDefaultValue` — the per-table optional vs
// `Default` branch in [src/expressions/insert.ts](../../../../../src/expressions/insert.ts)
// and `src/expressions/update.ts`.
//
// SQL Server does NOT support `INSERT … ON CONFLICT` syntax (uses
// `MERGE` instead) — the `on-conflict-do-update-with-default-keyword`
// test is commented out here for parity with the postgres/mariadb/
// mysql cells.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, [plan], created_at) values (@0, @1, default)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "DefaultCo",
                "free",
              ]
            `)
        })
    })

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set created_at = default where id = @0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

    /*
    test('on-conflict-do-update-with-default-keyword', async () => {
        // Not supported by SQL Server.
    })
    */

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, [plan], created_at) values (@0, @1, default), (@2, @3, @4)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "MultiA",
                "free",
                "MultiB",
                "pro",
                2024-01-01T00:00:00.000Z,
              ]
            `)
        })
    })
})
