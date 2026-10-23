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
import { tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

// tProject is referenced only by the commented-out `multi-row-on-conflict-returning-last-id`
// test below; the cells where that test is uncommented use it for real.
void tProject

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

    // NOT-APPLICABLE: MySQL has no multi-row `returningLastInsertedId()`; the array `values([...])` form types the returned id as multiple, which MySQL's connection narrows to `never`.
    /*
    test('single-element-values-array-returning-last-id-wraps-in-array', async () => {
        // A single-element array `.values([oneRow])` emits a plain single-row
        // `insert … returning id` (not a multi-row VALUES), but the array form returns
        // the id wrapped in an array (`number[]`, `[id]`), not the bare `number` the
        // single-object form returns.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const ids = await ctx.conn.insertInto(tOrganization)
                .values([{ name: 'Wrapped', plan: 'free' }])
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Wrapped",
                "free",
              ]
            `)
            assertType<Exact<typeof ids, number[]>>()
            // The id is autogenerated, so the assertion is a shape check that holds in
            // both mock and real modes: exactly one id, and it is a number.
            expect(Array.isArray(ids)).toBe(true)
            expect(ids.length).toBe(1)
            expect(typeof ids[0]).toBe('number')
        })
    })
    */
    // NOT-APPLICABLE: MySQL has no RETURNING on a multi-row on-conflict insert.
    /*
    test('multi-row-on-conflict-returning-last-id', async () => {
        // Multi-row VALUES + on-conflict + returningLastInsertedId(). Two project
        // rows that collide on (org, slug); DO NOTHING inserts nothing, so the
        // returned id array is empty. Commented where on-conflict is absent.
        await ctx.withRollback(async () => {
            ctx.mockNext([])
            const ids = await ctx.conn.insertInto(tProject)
                .values([
                    { organizationId: 1, slug: 'mktg-site', name: 'dup A' },
                    { organizationId: 1, slug: 'tools', name: 'dup B' },
                ])
                .onConflictDoNothing()
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert ignore into project (organization_id, slug, \`name\`) values (?, ?, ?), (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "dup A",
                1,
                "tools",
                "dup B",
              ]
            `)
            assertType<Exact<typeof ids, number[]>>()
            expect(ids).toEqual([])
        })
    })
    */


    // TARGETED multi-row on-conflict (`onConflictOn(cols).doNothing()/.doUpdateSet()`)
    // reaches the `OnConflictDoMultipleInsert` /
    // `CustomizableExecutableMultipleInsertOnConflict` interfaces — distinct from
    // the bare `onConflictDoNothing()` the test above uses. Live only where a
    // column-targeted conflict clause is supported (PostgreSQL / SQLite);
    // commented NOT-APPLICABLE on the dialects whose connection narrows
    // `onConflictOn` away (MySQL/MariaDB ON DUPLICATE KEY, Oracle/SqlServer MERGE).

    // NOT-APPLICABLE: MySQL has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('multi-row-on-conflict-on-columns-do-nothing-returning-last-id', async () => {
        // `.values([r1, r2]).onConflictOn(org, slug).doNothing().returningLastInsertedId()`.
        // Both rows collide on the seeded UNIQUE (organization_id, slug), so DO
        // NOTHING suppresses both inserts and the returned id array is empty.
        await ctx.withRollback(async () => {
            ctx.mockNext([])
            const ids = await ctx.conn.insertInto(tProject)
                .values([
                    { organizationId: 1, slug: 'mktg-site', name: 'dup A' },
                    { organizationId: 1, slug: 'tools', name: 'dup B' },
                ])
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doNothing()
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3), ($4, $5, $6) on conflict (organization_id, slug) do nothing returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "dup A",
                1,
                "tools",
                "dup B",
              ]
            `)
            assertType<Exact<typeof ids, number[]>>()
            expect(ids).toEqual([])
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no column-targeted INSERT…ON CONFLICT clause (uses the bare ON DUPLICATE KEY form); `onConflictOn` is narrowed away.
    /*
    test('multi-row-on-conflict-on-columns-do-update-returning-last-ids', async () => {
        // `.values([r1, r2]).onConflictOn(org, slug).doUpdateSet({...})` with a
        // `valuesForInsert()` RHS so each conflicting row updates to its own
        // attempted name. Both rows collide on the existing projects 1 ('mktg-site')
        // and 2 ('tools'), so DO UPDATE produces a row for each and RETURNING id
        // yields their existing ids [1, 2].
        await ctx.withRollback(async () => {
            ctx.mockNext([1, 2])
            const ids = await ctx.conn.insertInto(tProject)
                .values([
                    { organizationId: 1, slug: 'mktg-site', name: 'Upd A' },
                    { organizationId: 1, slug: 'tools', name: 'Upd B' },
                ])
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: tProject.valuesForInsert().name })
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3), ($4, $5, $6) on conflict (organization_id, slug) do update set name = excluded.name returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Upd A",
                1,
                "tools",
                "Upd B",
              ]
            `)
            assertType<Exact<typeof ids, number[]>>()
            expect([...ids].sort((a, b) => a - b)).toEqual([1, 2])
        })
    })
    */

    test('single-element-values-array-emits-single-row-returns-multiple-type', async () => {
        // `.values([oneRow])` — a single-element array. The builder routes through
        // the multi-row node (`_buildInsertMultiple`) but emits a single VALUES
        // tuple (one placeholder group). executeInsert returns the affected-row
        // count. The array form yields the MULTIPLE set node — `setForAll(...)`
        // (present only on the multi-row builder) is callable on it and overrides
        // `plan` for every row.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .values([
                    { name: 'SoloArray', plan: 'free' },
                ])
                .setForAll({ plan: 'pro' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into \`organization\` (\`name\`, plan) values (?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "SoloArray",
                "pro",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('multi-row-bare-on-conflict-do-update-set-with-inserted-row-ref', async () => {
        // Multi-row VALUES chained to a BARE (no-target) `onConflictDoUpdateSet` — the
        // no-target upsert on the `CustomizableExecutableMultipleInsert` receiver
        // (SQLite `ON CONFLICT DO UPDATE` without a conflict target; MySQL/MariaDB
        // `ON DUPLICATE KEY UPDATE`). Each conflicting row updates `name` to its own
        // attempted value via `valuesForInsert()`. Both rows collide with the seeded
        // projects 1 ('mktg-site') and 2 ('tools'), so DO UPDATE fires for each.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values([
                    { organizationId: 1, slug: 'mktg-site', name: 'Bare A' },
                    { organizationId: 1, slug: 'tools', name: 'Bare B' },
                ])
                .onConflictDoUpdateSet({ name: tProject.valuesForInsert().name })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, \`name\`) values (?, ?, ?), (?, ?, ?) on duplicate key update \`name\` = values(\`name\`)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Bare A",
                1,
                "tools",
                "Bare B",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) {
                expect(typeof affected).toBe('number')
                // Each conflicting row updated to its own attempted name.
                const updated = await ctx.conn.selectFrom(tProject)
                    .where(tProject.id.in([1, 2]))
                    .select({ id: tProject.id, name: tProject.name })
                    .orderBy('id')
                    .executeSelectMany()
                expect(updated).toEqual([{ id: 1, name: 'Bare A' }, { id: 2, name: 'Bare B' }])
            } else {
                expect(affected).toBe(2)
            }
        })
    })

    test('single-element-values-array-second-set-for-all-reuses-the-copied-sets', async () => {
        // `.values([oneRow])` degenerates to the single-row set node while still
        // exposing the MULTIPLE builder surface. The FIRST `setForAll*` copies the
        // staged object into a one-element working batch; a SECOND `setForAll*`
        // must reuse that copy rather than rebuild it — the path a single
        // `setForAll` never reaches.
        //
        // `plan` is overridden twice on purpose: the final param is what proves the
        // second call actually saw the row. Had the reuse handed back an empty
        // batch, `setForAllIfValue` would have iterated nothing and `plan` would
        // still read 'pro'.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .values([
                    { name: 'SoloArrayTwice', plan: 'free' },
                ])
                .setForAll({ plan: 'pro' })
                .setForAllIfValue({ plan: 'enterprise' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into \`organization\` (\`name\`, plan) values (?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "SoloArrayTwice",
                "enterprise",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })
})
