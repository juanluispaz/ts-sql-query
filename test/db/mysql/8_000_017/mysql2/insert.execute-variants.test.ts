// Coverage of the INSERT executor variants the other INSERT tests
// don't exercise:
//
//   - `executeInsert(min, max)` — min-/max-row guards
//     Plain inserts (no RETURNING) compare `min`/`max` against the
//     engine's reported rowCount; the `.returningLastInsertedId()` path
//     compares against `result.length` (multi-row) or 0/1 based on the
//     id being null/non-null (single-row).
//   - `.values([...]).returningLastInsertedId().executeInsert()` — the
//     multi-row last-inserted-id path
//     that dispatches through
//     `_queryRunner.executeInsertReturningMultipleLastInsertedId`.
//   - `executeInsertNoneOrOne()` + `returningOneColumn(...)` — the
//     `__oneColumn` branch
//     plus its `value === undefined → null` coercion path.
//   - `executeInsertOne()` + `returningOneColumn(...)` — same shape, but
//     throws `NO_RESULT` when the engine returns nothing
//   - `executeInsertMany(min, max)` with `returningOneColumn(...)` and
//     with `returning({...})` — covers both `__oneColumn` and row-shape
//     branches of the many-returning path.
//
// The empty-result coercion is reached on the real engine via a 0-row
// INSERT ... SELECT (a never-matching source select returns no row), so it
// is validated in both modes — except on Oracle, whose RETURNING INTO has no
// INSERT ... SELECT form (the test is NOT-APPLICABLE there). The same 0-row
// INSERT ... SELECT drives the row-shape `executeInsertNoneOrOne()` `→ null`
// dispatch and the one-column `executeInsertOne()` NO_RESULT throw — the two
// remaining empty-RETURNING inhabitants — each real-validatable the same way
// (and NOT-APPLICABLE on Oracle/MySQL for the same reason).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
// TsSqlError is referenced only by the commented-out NOT-APPLICABLE tests below (this dialect has no RETURNING).
void TsSqlError
import { tCountry, tIssue, tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('execute-insert-with-min-max-passes-for-single-row', async () => {
        // Single-row plain insert: count = engine's reported rowCount
        // (1 here), in range for `executeInsert(1, 5)`.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Hooli', plan: 'free' })
                .executeInsert(1, 5)

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into \`organization\` (\`name\`, plan) values (?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Hooli",
                "free",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            if (!ctx.realDbEnabled) expect(inserted).toBe(1)
        })
    })

    test('execute-insert-throws-when-fewer-than-min-on-single-row', async () => {
        // Single-row plain insert with `executeInsert(2)`: real DB
        // reports rowCount = 1, 1 < min = 2 -> throws
        // `MINIMUM_ROWS_NOT_REACHED`.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.insertInto(tOrganization)
                    .values({ name: 'Pied Piper', plan: 'pro' })
                    .executeInsert(2)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't insert the minimum/)
        })
    })

    // NOT-APPLICABLE: MySQL has no RETURNING — the library narrows
    // multi-row + .returningLastInsertedId() to `never`. Kept here
    // commented for symmetry.
    /*
    test('execute-insert-multi-row-returning-last-inserted-id-passes', async () => {
        // `.values([...]).returningLastInsertedId().executeInsert()`
        // dispatches through `executeInsertReturningMultipleLastInsertedId`
        // and returns `number[]`. The min/max guards count
        // `result.length` (the `Array.isArray(result)` branch). Real
        // DB returns engine-assigned ids; the value assertion is
        // length-based to avoid pinning specific id values.
        ctx.mockNext([101, 102])
        await ctx.withRollback(async () => {
            const ids = await ctx.conn.insertInto(tOrganization)
                .values([
                    { name: 'Stark Industries', plan: 'pro' },
                    { name: 'Wayne Enterprises', plan: 'pro' },
                ])
                .returningLastInsertedId()
                .executeInsert(2, 5)

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof ids, number[]>>()
            expect(ids.length).toBe(2)
            if (!ctx.realDbEnabled) expect(ids).toEqual([101, 102])
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — multi-row .returningLastInsertedId() narrows to `never`.
    /*
    test('execute-insert-multi-row-throws-when-too-few-ids', async () => {
        // Same multi-row path; insert 3 rows but require min = 4 so
        // real DB returns 3 ids, 3 < 4 throws
        // `MINIMUM_ROWS_NOT_REACHED`.
        ctx.mockNext([101, 102, 103])
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.insertInto(tOrganization)
                    .values([
                        { name: 'Wonka Industries', plan: 'free' },
                        { name: 'Cyberdyne Systems', plan: 'pro' },
                        { name: 'Tyrell Corporation', plan: 'free' },
                    ])
                    .returningLastInsertedId()
                    .executeInsert(4)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't insert the minimum/)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — multi-row .returningLastInsertedId() narrows to `never`.
    /*
    test('execute-insert-multi-row-throws-when-too-many-ids', async () => {
        // Same multi-row path; insert 3 rows with max = 1 so real DB
        // returns 3 ids, 3 > 1 throws `MAXIMUM_ROWS_EXCEEDED`.
        ctx.mockNext([101, 102, 103])
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.insertInto(tOrganization)
                    .values([
                        { name: 'Vandelay Industries', plan: 'free' },
                        { name: 'Massive Dynamic', plan: 'pro' },
                        { name: 'Soylent Corp', plan: 'free' },
                    ])
                    .returningLastInsertedId()
                    .executeInsert(0, 1)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MAXIMUM_ROWS_EXCEEDED|insert more that the maximum/)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — .returningOneColumn(...) narrows to `never`. Kept commented
    // for symmetry.
    /*
    test('execute-insert-none-or-one-with-returning-one-column', async () => {
        // `executeInsertNoneOrOne()` + `returningOneColumn(col)` lands
        // on the `__oneColumn` branch and returns the single value.
        // The inserted row always exists, so the result is the
        // engine-assigned id (never null on the real DB).
        ctx.mockNext(500)
        await ctx.withRollback(async () => {
            const result = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Umbrella Corp', plan: 'pro' })
                .returningOneColumn(tOrganization.id)
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof result, number | null>>()
            if (ctx.realDbEnabled) expect(typeof result).toBe('number')
            else expect(result).toBe(500)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — .returningOneColumn(...) narrows to `never`.
    /*
    test('execute-insert-none-or-one-with-returning-one-column-empty-result', async () => {
        // A 0-row `INSERT ... SELECT` (the source select matches no row) inserts
        // nothing, so `RETURNING` yields no row and `executeInsertNoneOrOne()`'s
        // `__oneColumn` branch coerces the missing value to `null`. Driving it
        // through a never-matching select reaches that coercion on the REAL
        // engine, not only the mock.
        await ctx.withRollback(async () => {
            ctx.mockNext(undefined)
            // "Clone" the organizations matching a never-true filter: the source
            // select yields no row, so nothing is inserted and RETURNING is empty.
            const source = ctx.conn.selectFrom(tOrganization)
                .where(tOrganization.id.equals(-1))
                .select({ name: tOrganization.name, plan: tOrganization.plan })
            const result = await ctx.conn.insertInto(tOrganization)
                .from(source)
                .returningOneColumn(tOrganization.id)
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            expect(result).toBeNull()
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — .returning({...}) narrows to `never`.
    /*
    test('execute-insert-none-or-one-with-returning-row-shape-empty-result', async () => {
        // A 0-row `INSERT ... SELECT` inserts nothing, so RETURNING yields no
        // row and the row-shape branch of `executeInsertNoneOrOne()`
        // (`executeInsertReturningOneRow` → no row → `null`) resolves `null`.
        // Driving it through a never-matching select reaches the null dispatch
        // on the REAL engine, not only the mock.
        await ctx.withRollback(async () => {
            ctx.mockNext(undefined)
            const source = ctx.conn.selectFrom(tOrganization)
                .where(tOrganization.id.equals(-1))
                .select({ name: tOrganization.name, plan: tOrganization.plan })
            const result = await ctx.conn.insertInto(tOrganization)
                .from(source)
                .returning({ id: tOrganization.id })
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof result, { id: number } | null>>()
            expect(result).toBeNull()
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — .returningOneColumn(...) narrows to `never`.
    /*
    test('execute-insert-one-with-returning-one-column-empty-result-throws-no-result', async () => {
        // A 0-row `INSERT ... SELECT` inserts nothing, so RETURNING yields no
        // row and the `__oneColumn` branch of `executeInsertOne()` throws
        // NO_RESULT (where `executeInsertNoneOrOne()` coerces to `null`).
        // Driving it through a never-matching select reaches the throw on the
        // REAL engine, not only the mock; the SQL is captured before the throw
        // fires in the `.then`.
        await ctx.withRollback(async () => {
            ctx.mockNext(undefined)
            const source = ctx.conn.selectFrom(tOrganization)
                .where(tOrganization.id.equals(-1))
                .select({ name: tOrganization.name, plan: tOrganization.plan })
            let caught: unknown
            try {
                await ctx.conn.insertInto(tOrganization)
                    .from(source)
                    .returningOneColumn(tOrganization.id)
                    .executeInsertOne()
            } catch (e) {
                caught = e
            }
            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            expect(String(caught)).toMatch(/NO_RESULT|No result returned/)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — .returningOneColumn(...) narrows to `never`.
    /*
    test('execute-insert-one-with-returning-one-column', async () => {
        // `executeInsertOne()` + `returningOneColumn(col)` covers the
        // value branch of the `__oneColumn` shape. The inserted row
        // always exists, so the result is the engine-assigned id.
        ctx.mockNext(777)
        await ctx.withRollback(async () => {
            const result = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'LexCorp', plan: 'pro' })
                .returningOneColumn(tOrganization.id)
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof result, number>>()
            if (ctx.realDbEnabled) expect(typeof result).toBe('number')
            else expect(result).toBe(777)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — .returning({...}) narrows to `never`. Kept commented for
    // symmetry.
    /*
    test('execute-insert-one-throws-no-result-when-row-missing', async () => {
        // `executeInsertOne()` raises `NO_RESULT` when the engine
        // returns no row
        // Mock-only: real INSERT always returns the inserted row.
        if (ctx.realDbEnabled) return
        ctx.mockNext(undefined)
        let caught: unknown
        try {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, name: 'Customer portal', slug: 'customer-portal' })
                .returning({ id: tProject.id })
                .executeInsertOne()
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/NO_RESULT|No result returned/)
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — .returningOneColumn(...) narrows to `never`.
    /*
    test('execute-insert-many-with-returning-one-column', async () => {
        // `executeInsertMany()` + `returningOneColumn(col)` lands on
        // the `__oneColumn` branch of the many-returning path
        // and returns an array of the projected column. Real DB
        // returns engine-assigned ids; the value assertion is
        // length-based to avoid pinning specific id values.
        ctx.mockNext([201, 202])
        await ctx.withRollback(async () => {
            const ids = await ctx.conn.insertInto(tOrganization)
                .values([
                    { name: 'Initrode', plan: 'free' },
                    { name: 'Gringotts', plan: 'pro' },
                ])
                .returningOneColumn(tOrganization.id)
                .executeInsertMany()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof ids, number[]>>()
            expect(ids.length).toBe(2)
            if (!ctx.realDbEnabled) expect(ids).toEqual([201, 202])
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — .returning({...}) narrows to `never`.
    /*
    test('execute-insert-many-with-min-throws-when-empty', async () => {
        // `executeInsertMany(min, max)` checks `rows.length` after
        // the RETURNING result; insert 2 rows but require min = 3 so
        // real DB returns 2, 2 < 3 throws
        // `MINIMUM_ROWS_NOT_REACHED`.
        ctx.mockNext([{ id: 1 }, { id: 2 }])
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.insertInto(tOrganization)
                    .values([
                        { name: 'Aperture Science', plan: 'free' },
                        { name: 'Black Mesa', plan: 'pro' },
                    ])
                    .returning({ id: tOrganization.id })
                    .executeInsertMany(3)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't insert the minimum/)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — .returning({...}) narrows to `never`.
    /*
    test('execute-insert-many-with-max-throws-when-over-limit', async () => {
        // Same guard but on the max side: insert 3 rows with
        // max = 1, so real DB returns 3 rows, 3 > 1 throws
        // `MAXIMUM_ROWS_EXCEEDED`.
        ctx.mockNext([
            { id: 1 },
            { id: 2 },
            { id: 3 },
        ])
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.insertInto(tOrganization)
                    .values([
                        { name: 'Weyland-Yutani', plan: 'free' },
                        { name: 'Bluth Company', plan: 'pro' },
                        { name: 'Dunder Mifflin', plan: 'free' },
                    ])
                    .returning({ id: tOrganization.id })
                    .executeInsertMany(0, 1)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MAXIMUM_ROWS_EXCEEDED|insert more that the maximum/)
        })
    })
    */
    test('values-accepts-a-value-source-rhs', async () => {
        // `.values({...})` accepts a no-table value-source on the RHS of a
        // column, not only a literal. `title` is a typed fragment
        // (`upper('hello')`) and `priority` is a `const(...)`; the SET inlines
        // the expressions. The insert executes end to end (rowcount 1) inside a
        // rollback.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const count = await ctx.conn.insertInto(tIssue)
                .values({
                    projectId: 1,
                    number:    999,
                    title:     ctx.conn.fragmentWithType('string', 'required').sql`upper(${ctx.conn.const('hello', 'string')})`,
                    status:    'open',
                    priority:  ctx.conn.const(3, 'int'),
                })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, \`number\`, title, \`status\`, priority) values (?, ?, upper(?), ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                999,
                "hello",
                "open",
                3,
              ]
            `)
            assertType<Exact<typeof count, number>>()
            if (!ctx.realDbEnabled) expect(count).toBe(1)
        })
    })

    test('insert-provided-primary-key-carries-the-pk-value', async () => {
        // tCountry's PK `code` is provided (primaryKey, not autogenerated), so
        // it is required in `values` and the INSERT emits the `code` column with
        // its value. Inserting a fresh code inside a rollback.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const count = await ctx.conn.insertInto(tCountry)
                .values({ code: 'DE', name: 'Germany', region: 'Europe' })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into country (\`code\`, \`name\`, region) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "DE",
                "Germany",
                "Europe",
              ]
            `)
            assertType<Exact<typeof count, number>>()
            if (!ctx.realDbEnabled) expect(count).toBe(1)
        })
    })

    test('execute-insert-single-row-returning-last-inserted-id-with-min-max-passes', async () => {
        // Single-row `.returningLastInsertedId()`: the executeInsert min/max count
        // comes from the returned scalar id (1 when non-null), so it is in range for
        // `executeInsert(1, 1)` and the id resolves.
        ctx.mockNext(88)
        await ctx.withRollback(async () => {
            const id = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Cyberdyne', plan: 'pro' })
                .returningLastInsertedId()
                .executeInsert(1, 1)

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into \`organization\` (\`name\`, plan) values (?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Cyberdyne",
                "pro",
              ]
            `)
            assertType<Exact<typeof id, number>>()
            if (ctx.realDbEnabled) expect(typeof id).toBe('number')
            else expect(id).toBe(88)
        })
    })

    test('execute-insert-single-row-returning-last-inserted-id-throws-when-fewer-than-min', async () => {
        // Single-row `.returningLastInsertedId()` with `executeInsert(2)`: the id
        // gives count 1, below the min of 2, so it throws MINIMUM_ROWS_NOT_REACHED.
        ctx.mockNext(88)
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.insertInto(tOrganization)
                    .values({ name: 'Tyrell', plan: 'pro' })
                    .returningLastInsertedId()
                    .executeInsert(2)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't insert the minimum/)
        })
    })

    test('execute-insert-single-row-returning-last-inserted-id-throws-when-too-many', async () => {
        // Single-row `.returningLastInsertedId()` with `executeInsert(0, 0)`: the id
        // gives count 1, above the max of 0, so it throws MAXIMUM_ROWS_EXCEEDED.
        ctx.mockNext(88)
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.insertInto(tOrganization)
                    .values({ name: 'Soylent', plan: 'free' })
                    .returningLastInsertedId()
                    .executeInsert(0, 0)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MAXIMUM_ROWS_EXCEEDED|insert more that the maximum/)
        })
    })
    // NOT-APPLICABLE: MySQL has no RETURNING — the RETURNING clause narrows to never.
    /*
    test('execute-insert-many-with-returning-row-shape-in-range-passes', async () => {
        // `executeInsertMany(min, max)` with a `.returning({...})` row-shape and
        // an in-range count: insert 2 rows, count 2 is in [1, 5], and the
        // RETURNING row-shape array comes back. `id` is engine-assigned so its
        // value is pinned mock-only; the deterministic `name`/`plan` columns are
        // asserted unconditionally (sorted by name to be order-independent).
        ctx.mockNext([
            { id: 301, name: 'Initech', plan: 'free' },
            { id: 302, name: 'Hooli', plan: 'pro' },
        ])
        await ctx.withRollback(async () => {
            const rows = await ctx.conn.insertInto(tOrganization)
                .values([
                    { name: 'Initech', plan: 'free' },
                    { name: 'Hooli', plan: 'pro' },
                ])
                .returning({ id: tOrganization.id, name: tOrganization.name, plan: tOrganization.plan })
                .executeInsertMany(1, 5)

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into \`organization\` (\`name\`, plan) values (?, ?), (?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Initech",
                "free",
                "Hooli",
                "pro",
              ]
            `)
            assertType<Exact<typeof rows, Array<{ id: number, name: string, plan: string }>>>()
            expect(rows.length).toBe(2)
            const byName = rows.map(r => ({ name: r.name, plan: r.plan })).sort((a, b) => a.name.localeCompare(b.name))
            expect(byName).toEqual([{ name: 'Hooli', plan: 'pro' }, { name: 'Initech', plan: 'free' }])
            if (!ctx.realDbEnabled) expect(rows).toEqual([{ id: 301, name: 'Initech', plan: 'free' }, { id: 302, name: 'Hooli', plan: 'pro' }])
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — the RETURNING clause narrows to never.
    /*
    test('execute-insert-many-with-returning-one-column-in-range-passes', async () => {
        // The one-column arity of the many-in-range PASS: `executeInsertMany(min,
        // max)` with `returningOneColumn(col)`. Insert 2 rows, count 2 is in
        // [1, 5], and the projected id array comes back. Engine-assigned ids are
        // pinned mock-only; the length is asserted unconditionally.
        ctx.mockNext([211, 212])
        await ctx.withRollback(async () => {
            const ids = await ctx.conn.insertInto(tOrganization)
                .values([
                    { name: 'Umbrella', plan: 'free' },
                    { name: 'Tyrell', plan: 'pro' },
                ])
                .returningOneColumn(tOrganization.id)
                .executeInsertMany(1, 5)

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into \`organization\` (\`name\`, plan) values (?, ?), (?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Umbrella",
                "free",
                "Tyrell",
                "pro",
              ]
            `)
            assertType<Exact<typeof ids, number[]>>()
            expect(ids.length).toBe(2)
            if (!ctx.realDbEnabled) expect(ids).toEqual([211, 212])
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — the RETURNING clause narrows to never.
    /*
    test('execute-insert-none-or-one-with-returning-row-shape', async () => {
        // `.values({...})` + `.returning({...})` + `executeInsertNoneOrOne()`
        // inserts one row and returns the RETURNING row object (present, not
        // null). `id` is engine-assigned so pinned mock-only; the deterministic
        // `name`/`plan` are asserted unconditionally.
        ctx.mockNext({ id: 900, name: 'Wonka', plan: 'pro' })
        await ctx.withRollback(async () => {
            const result = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Wonka', plan: 'pro' })
                .returning({ id: tOrganization.id, name: tOrganization.name, plan: tOrganization.plan })
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into \`organization\` (\`name\`, plan) values (?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Wonka",
                "pro",
              ]
            `)
            assertType<Exact<typeof result, { id: number, name: string, plan: string } | null>>()
            expect(result).not.toBeNull()
            expect(result?.name).toBe('Wonka')
            expect(result?.plan).toBe('pro')
            if (!ctx.realDbEnabled) expect(result).toEqual({ id: 900, name: 'Wonka', plan: 'pro' })
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — the RETURNING clause narrows to never.
    /*
    test('execute-insert-many-one-column-with-min-throws-when-empty', async () => {
        // The one-column arity of the many min-throw arm: `executeInsertMany(min)`
        // with `returningOneColumn(col)`. Insert 2 rows but require min = 3, so
        // the one-column-many result has length 2 < 3 and throws
        // `MINIMUM_ROWS_NOT_REACHED` in both modes.
        ctx.mockNext([1, 2])
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.insertInto(tOrganization)
                    .values([
                        { name: 'Aperture Science', plan: 'free' },
                        { name: 'Black Mesa', plan: 'pro' },
                    ])
                    .returningOneColumn(tOrganization.id)
                    .executeInsertMany(3)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't insert the minimum/)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — the RETURNING clause narrows to never.
    /*
    test('execute-insert-from-multi-row-select-returning-row-shape-execute-one-throws-more-than-one-row', async () => {
        // `INSERT ... SELECT` whose source matches MORE THAN ONE row (both seeded
        // organizations) inserts 2 rows; `.returning({...}).executeInsertOne()`
        // routes the 2 RETURNING rows through the `executeInsertReturningOneRow`
        // runner guard, which throws MORE_THAN_ONE_ROW on a real engine. The mock
        // returns a single queued object and cannot produce two rows, so on mock
        // it returns without a throw. The SQL is captured (before the throw fires)
        // in both modes.
        ctx.mockNext({ id: 900 })
        await ctx.withRollback(async () => {
            const source = ctx.conn.selectFrom(tOrganization)
                .where(tOrganization.id.greaterOrEqual(1))
                .select({ name: tOrganization.name, plan: tOrganization.plan })
            let caught: unknown
            let result: { id: number } | undefined
            try {
                result = await ctx.conn.insertInto(tOrganization)
                    .from(source)
                    .returning({ id: tOrganization.id })
                    .executeInsertOne()
            } catch (e) {
                caught = e
            }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into \`organization\` (\`name\`, plan) select \`name\` as \`name\`, plan as plan from \`organization\` where id >= ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            if (ctx.realDbEnabled) {
                expect(String(caught)).toMatch(/MORE_THAN_ONE_ROW|Too many rows/)
                expect(caught instanceof TsSqlError ? caught.errorReason.reason : undefined).toBe('MORE_THAN_ONE_ROW')
            } else {
                expect(caught).toBeUndefined()
                expect(result).toEqual({ id: 900 })
            }
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — the RETURNING clause narrows to never.
    /*
    test('execute-insert-from-multi-row-select-returning-row-shape-execute-none-or-one-throws-more-than-one-row', async () => {
        // Same MORE_THAN_ONE_ROW guard on the none-or-one row-shape path:
        // `.returning({...}).executeInsertNoneOrOne()` widens the None arm to
        // null, but >1 RETURNING rows is still a hard error through the same
        // `executeInsertReturningOneRow` runner. The mock returns a single queued
        // object, so on mock it returns without a throw.
        ctx.mockNext({ id: 900 })
        await ctx.withRollback(async () => {
            const source = ctx.conn.selectFrom(tOrganization)
                .where(tOrganization.id.greaterOrEqual(1))
                .select({ name: tOrganization.name, plan: tOrganization.plan })
            let caught: unknown
            let result: { id: number } | null | undefined
            try {
                result = await ctx.conn.insertInto(tOrganization)
                    .from(source)
                    .returning({ id: tOrganization.id })
                    .executeInsertNoneOrOne()
            } catch (e) {
                caught = e
            }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into \`organization\` (\`name\`, plan) select \`name\` as \`name\`, plan as plan from \`organization\` where id >= ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            if (ctx.realDbEnabled) {
                expect(String(caught)).toMatch(/MORE_THAN_ONE_ROW|Too many rows/)
                expect(caught instanceof TsSqlError ? caught.errorReason.reason : undefined).toBe('MORE_THAN_ONE_ROW')
            } else {
                expect(caught).toBeUndefined()
                expect(result).toEqual({ id: 900 })
            }
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — the RETURNING clause narrows to never.
    /*
    test('execute-insert-from-multi-row-select-returning-one-column-execute-one-throws-more-than-one-row', async () => {
        // The one-column arity of the MORE_THAN_ONE_ROW guard on insert:
        // `.returningOneColumn(col).executeInsertOne()` over a 2-row
        // `INSERT ... SELECT` throws MORE_THAN_ONE_ROW on a real engine. The mock
        // returns a single queued value, so on mock it returns without a throw.
        ctx.mockNext(900)
        await ctx.withRollback(async () => {
            const source = ctx.conn.selectFrom(tOrganization)
                .where(tOrganization.id.greaterOrEqual(1))
                .select({ name: tOrganization.name, plan: tOrganization.plan })
            let caught: unknown
            let result: number | undefined
            try {
                result = await ctx.conn.insertInto(tOrganization)
                    .from(source)
                    .returningOneColumn(tOrganization.id)
                    .executeInsertOne()
            } catch (e) {
                caught = e
            }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into \`organization\` (\`name\`, plan) select \`name\` as \`name\`, plan as plan from \`organization\` where id >= ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            if (ctx.realDbEnabled) {
                expect(String(caught)).toMatch(/MORE_THAN_ONE_ROW|Too many rows/)
                expect(caught instanceof TsSqlError ? caught.errorReason.reason : undefined).toBe('MORE_THAN_ONE_ROW')
            } else {
                expect(caught).toBeUndefined()
                expect(result).toBe(900)
            }
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — the RETURNING clause narrows to never.
    /*
    test('execute-insert-from-multi-row-select-returning-one-column-execute-none-or-one-throws-more-than-one-row', async () => {
        // Same MORE_THAN_ONE_ROW guard on the one-column none-or-one path:
        // `.returningOneColumn(col).executeInsertNoneOrOne()` widens None to null
        // but >1 RETURNING rows still throws. The mock returns a single queued
        // value, so on mock it returns without a throw.
        ctx.mockNext(900)
        await ctx.withRollback(async () => {
            const source = ctx.conn.selectFrom(tOrganization)
                .where(tOrganization.id.greaterOrEqual(1))
                .select({ name: tOrganization.name, plan: tOrganization.plan })
            let caught: unknown
            let result: number | null | undefined
            try {
                result = await ctx.conn.insertInto(tOrganization)
                    .from(source)
                    .returningOneColumn(tOrganization.id)
                    .executeInsertNoneOrOne()
            } catch (e) {
                caught = e
            }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into \`organization\` (\`name\`, plan) select \`name\` as \`name\`, plan as plan from \`organization\` where id >= ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            if (ctx.realDbEnabled) {
                expect(String(caught)).toMatch(/MORE_THAN_ONE_ROW|Too many rows/)
                expect(caught instanceof TsSqlError ? caught.errorReason.reason : undefined).toBe('MORE_THAN_ONE_ROW')
            } else {
                expect(caught).toBeUndefined()
                expect(result).toBe(900)
            }
        })
    })
    */


    // The two result-value guards on the one-column (`returningOneColumn`) branch
    // of `executeInsertOne()` — the INSERT twins of the UPDATE/DELETE gates in
    // update.returning.execute-shapes / delete.returning.execute-shapes. Both are
    // mock-only BY CONSTRUCTION: a real driver never hands back the offending shape
    // for the projected column of a row it actually inserted, so the injection is
    // only possible through the mock and the body early-returns on the real DB.
    // NOT-APPLICABLE: MySQL has no RETURNING — .returningOneColumn(...) narrows to `never`.
    /*
    test('insert-returning-one-column-throws-invalid-value-on-wrong-typed-value', async () => {
        // The one-column value is PRESENT but of a shape the required-`int`
        // column (`priority`) can't accept (a non-integer `1.5`), so
        // `transformValueFromDB` rejects it with INVALID_VALUE_RECEIVED_FROM_DATABASE
        // (distinct from the NO_RESULT / MANDATORY_VALUE gates). The mock hands the
        // scalar back directly on the one-column path.
        if (ctx.realDbEnabled) return
        ctx.mockNext(1.5)
        let caught: unknown
        try {
            await ctx.conn.insertInto(tIssue)
                .values({ projectId: 1, number: 1, title: 'Gate probe', status: 'open', priority: 5 })
                .returningOneColumn(tIssue.priority)
                .executeInsertOne()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — .returningOneColumn(...) narrows to `never`.
    /*
    test('insert-returning-one-column-throws-mandatory-value-on-present-null', async () => {
        // The one-column value is PRESENT but null on a required column
        // (`status`). `transformValueFromDB` coerces null->null and the
        // required-column result-gate then rejects it with
        // MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE. A `null` scalar is
        // distinct from the `undefined` "no row" sentinel that fires NO_RESULT, so
        // the mock reaches the value-gate.
        if (ctx.realDbEnabled) return
        ctx.mockNext(null)
        let caught: unknown
        try {
            await ctx.conn.insertInto(tIssue)
                .values({ projectId: 1, number: 1, title: 'Gate probe', status: 'open', priority: 5 })
                .returningOneColumn(tIssue.status)
                .executeInsertOne()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE')
    })
    */
})
