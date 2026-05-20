// Coverage of `connection.default()` — the typed reference to the SQL
// `DEFAULT` keyword that survives until the SqlBuilder dispatches it
// through `_default(params)` (see
// [src/expressions/Default.ts](../../../../../src/expressions/Default.ts)
// and `AbstractSqlBuilder._default`). It is only typed on columns
// declared with `columnWithDefaultValue` — the per-table optional vs
// `Default` branch in [src/expressions/insert.ts](../../../../../src/expressions/insert.ts)
// and `src/expressions/update.ts`.
//
// Every case targets `createdAt` (`localDateTime`) so the assertions
// bypass `CustomBooleanTypeAdapter` remap on `verified` / `published` —
// see `test/BUGS.md` entry "Default keyword wrapped by
// CustomBooleanTypeAdapter remap" for why exercising `default()` on a
// custom-boolean column emits invalid SQL today.
//
// SQLite is not exercised here — the SQLite grammar rejects `DEFAULT`
// as a value expression. See `test/BUGS.md` entry "Default keyword not
// supported by SQLite"; the sqlite cells keep this file present (for
// symmetry per DESIGN §4) with every test commented out.

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan, created_at) values (?, ?, default)"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set created_at = default where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

    test('on-conflict-do-update-with-default-keyword', async () => {
        // The `default()` literal also survives through MariaDB's
        // `ON DUPLICATE KEY UPDATE` arm — same dispatch as a plain
        // update set, stitched after the conflict glue. MariaDB/MySQL
        // use the bare `.onConflictDoUpdateSet(...)` shorthand instead
        // of the `.onConflictOn(...).doUpdateSet(...)` chain that
        // PostgreSQL/SQLite use; the surface is narrowed at the
        // connection-type level.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            await connection.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site' })
                .onConflictDoUpdateSet({
                    createdAt: connection.default(),
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update created_at = default"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site",
              ]
            `)
        })
    })

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan, created_at) values (?, ?, default), (?, ?, ?)"`)
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
