// Coverage of multi-row insert shapes
// The single-row `.values({...})` path is already covered widely; this
// file walks the array-arg surface that drives the SqlBuilder's
// `_buildInsertMultiple` per-dialect branch:
//
//   - `.values([row1, row2])` with the same keys in both rows
//   - `.values([row1, row2, row3])` where some rows omit an optional
//     column (the SqlBuilder must still emit a value placeholder for
//     every column referenced by *any* row, padding with `null` /
//     `default` for the missing ones)
//   - `.dynamicValues([row1, row2])` — same array shape but routed
//     through the dynamic codepath
//   - `.dynamicValues({...})` — single-object form (degenerates into
//     `.values({...})`)
//
// Dialect-specific note: Oracle's `_buildInsertMultiple` wraps the
// rows in `begin ... end;` with a separate `insert` per row; every
// other supported dialect emits the standard `values (...), (...)`.
// The snapshot is what catches the difference.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('multi-row-values-with-uniform-shape', async () => {
        // Two rows, same keys. The SqlBuilder emits a single
        // `values (...), (...)` (or per-dialect equivalent) and a flat
        // bound-parameter list interleaving the two rows.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .values([
                    { name: 'RowA', plan: 'free' },
                    { name: 'RowB', plan: 'pro' },
                ])
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into \`organization\` (\`name\`, plan) values (?, ?), (?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "RowA",
                "free",
                "RowB",
                "pro",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('multi-row-values-with-some-rows-omitting-optional-column', async () => {
        // Three rows where only one supplies the optional `verified`
        // column. The SqlBuilder must include `verified` in the column
        // list (because at least one row references it) and emit the
        // appropriate placeholder for every row — even the ones that
        // omit it. The exact emission (NULL, DEFAULT, or omitted from
        // the column list) is dialect-specific; the snapshot pins it.
        ctx.mockNext(3)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tOrganization)
                .values([
                    { name: 'Mixed-A', plan: 'free' },
                    { name: 'Mixed-B', plan: 'pro', verified: true },
                    { name: 'Mixed-C', plan: 'free' },
                ])
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into \`organization\` (\`name\`, plan, verified) values (?, ?, case when ? then 'Y' else 'N' end), (?, ?, case when ? then 'Y' else 'N' end), (?, ?, case when ? then 'Y' else 'N' end)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mixed-A",
                "free",
                null,
                "Mixed-B",
                "pro",
                true,
                "Mixed-C",
                "free",
                null,
              ]
            `)
        })
    })

    test('dynamic-values-array-form-mirrors-values-array', async () => {
        // `.dynamicValues([...])` accepts the same array shape as
        // `.values([...])` but each row is typed as fully-optional
        // (the builder no longer enforces required columns at type
        // time). Runtime SQL should match the equivalent `.values`
        // call when the row data covers all required columns.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tOrganization)
                .dynamicValues([
                    { name: 'Dyn-A', plan: 'free' },
                    { name: 'Dyn-B', plan: 'pro' },
                ])
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into \`organization\` (\`name\`, plan) values (?, ?), (?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Dyn-A",
                "free",
                "Dyn-B",
                "pro",
              ]
            `)
        })
    })

    test('dynamic-values-single-object-degenerates-to-single-row-insert', async () => {
        // `.dynamicValues({...})` (single-object form) is the
        // non-array sibling — it still routes through the "single
        // row" SQL builder path, not the multi-row one.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const id = await ctx.conn.insertInto(tOrganization)
                .dynamicValues({ name: 'Solo', plan: 'free' })
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into \`organization\` (\`name\`, plan) values (?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Solo",
                "free",
              ]
            `)
            assertType<Exact<typeof id, number>>()
        })
    })
})
