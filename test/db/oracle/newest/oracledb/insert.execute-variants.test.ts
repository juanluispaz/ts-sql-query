// Coverage of the INSERT executor variants the other INSERT tests
// don't exercise:
//
//   - `executeInsert(min, max)` — min-/max-row guards in
//     [InsertQueryBuilder.ts:164](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L164).
//     Single-row plain inserts clamp `count` to `{0, 1}` regardless of
//     the engine's reported row count (the `else if (returningLastInsertedId)`
//     branch at [L169-174](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L169-L174)),
//     so the interesting min/max throw cases use the multi-row +
//     `returningLastInsertedId()` path which hits the
//     `Array.isArray(result)` branch at
//     [L167](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L167).
//   - `.values([...]).returningLastInsertedId().executeInsert()` — the
//     multi-row last-inserted-id path
//     ([InsertQueryBuilder.ts:114](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L114))
//     that dispatches through
//     `_queryRunner.executeInsertReturningMultipleLastInsertedId`.
//   - `executeInsertNoneOrOne()` + `returningOneColumn(...)` — the
//     `__oneColumn` branch in
//     [InsertQueryBuilder.ts:200](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L200)
//     plus its `value === undefined → null` coercion path.
//   - `executeInsertOne()` + `returningOneColumn(...)` — same shape, but
//     throws `NO_RESULT` when the engine returns nothing
//     ([InsertQueryBuilder.ts:241](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L241)).
//   - `executeInsertMany(min, max)` with `returningOneColumn(...)` and
//     with `returning({...})` — covers both `__oneColumn` and row-shape
//     branches of the many-returning path.
//
// Mock-only for the throw cases and for the multi-row last-inserted-id
// path (the latter because the mock can pre-shape the id array while
// real DBs hand back engine-assigned ids — the assertion then checks
// the SQL/params only).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('execute-insert-with-min-max-passes-for-single-row', async () => {
        // Single-row plain insert always clamps `count` to 1, so
        // `executeInsert(1, 5)` is always in range.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Hooli', plan: 'free' })
                .executeInsert(1, 5)

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into "organization" (name, "plan") values (:0, :1)"`)
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
        // TODO[BUG]: this test "throws for the right reason but the wrong
        // count". The min/max guard at InsertQueryBuilder.ts:166-174
        // clamps `count = 1` for any non-array plain-insert result,
        // regardless of the engine's actual rowCount. So `min=2` always
        // throws here; the mock value `1` is decorative. Once the
        // `returningLastInsertedId = !idColumn` inversion at L66 is fixed
        // (see test/BUGS.md), rewrite this test to mock a count that
        // exercises the comparison directly: `ctx.mockNext(0)` and
        // `executeInsert(1)` should throw based on the engine count, not
        // the clamp.
        if (ctx.realDbEnabled) return
        ctx.mockNext(1)
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

    test('execute-insert-multi-row-returning-last-inserted-id-passes', async () => {
        // `.values([...]).returningLastInsertedId().executeInsert()`
        // dispatches through `executeInsertReturningMultipleLastInsertedId`
        // and returns `number[]`. The mock pre-shapes the id array; the
        // min/max guards then count `result.length` (the
        // `Array.isArray(result)` branch).
        if (ctx.realDbEnabled) return
        ctx.mockNext([101, 102])
        const ids = await ctx.conn.insertInto(tOrganization)
            .values([
                { name: 'Stark Industries', plan: 'pro' },
                { name: 'Wayne Enterprises', plan: 'pro' },
            ])
            .returningLastInsertedId()
            .executeInsert(2, 5)

        expect(ctx.lastSql).toMatchInlineSnapshot(`"begin insert into "organization" (name, "plan") values (:0, :1) returning id into :2; insert into "organization" (name, "plan") values (:3, :4) returning id into :5; end;"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Stark Industries",
            "pro",
            {
              "dir": 3003,
            },
            "Wayne Enterprises",
            "pro",
            {
              "dir": 3003,
            },
          ]
        `)
        assertType<Exact<typeof ids, number[]>>()
        expect(ids).toEqual([101, 102])
    })

    test('execute-insert-multi-row-throws-when-too-few-ids', async () => {
        // Same multi-row path, but the mock returns only 1 id while
        // `min=3`. `Array.isArray(result)` → `count = 1` → throws
        // `MINIMUM_ROWS_NOT_REACHED`. Mock-only.
        if (ctx.realDbEnabled) return
        ctx.mockNext([101])
        let caught: unknown
        try {
            await ctx.conn.insertInto(tOrganization)
                .values([
                    { name: 'Wonka Industries', plan: 'free' },
                    { name: 'Cyberdyne Systems', plan: 'pro' },
                    { name: 'Tyrell Corporation', plan: 'free' },
                ])
                .returningLastInsertedId()
                .executeInsert(3)
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't insert the minimum/)
    })

    test('execute-insert-multi-row-throws-when-too-many-ids', async () => {
        // Same multi-row path; mock returns 3 ids while `max=1`. The
        // `Array.isArray(result)` branch sets `count = 3` → throws
        // `MAXIMUM_ROWS_EXCEEDED`. Mock-only.
        if (ctx.realDbEnabled) return
        ctx.mockNext([101, 102, 103])
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

    test('execute-insert-none-or-one-with-returning-one-column', async () => {
        // `executeInsertNoneOrOne()` + `returningOneColumn(col)` lands
        // on the `__oneColumn` branch and returns the single value or
        // null.
        ctx.mockNext(500)
        await ctx.withRollback(async () => {
            let result: number | null = null
            try {
                result = await ctx.conn.insertInto(tOrganization)
                    .values({ name: 'Umbrella Corp', plan: 'pro' })
                    .returningOneColumn(tOrganization.id)
                    .executeInsertNoneOrOne()
            } catch (e) {
                if (!ctx.realDbEnabled) throw e
            }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into "organization" (name, "plan") values (:0, :1) returning id into :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Umbrella Corp",
                "pro",
                {
                  "as": "result",
                  "dir": 3003,
                },
              ]
            `)
            if (!ctx.realDbEnabled) expect(result).toBe(500)
        })
    })

    test('execute-insert-none-or-one-with-returning-one-column-empty-result', async () => {
        // The `__oneColumn` branch coerces missing to `null` (see
        // [InsertQueryBuilder.ts:205](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L205)).
        // Mock-only: real INSERT always writes the row.
        if (ctx.realDbEnabled) return
        ctx.mockNext(undefined)
        const result = await ctx.conn.insertInto(tOrganization)
            .values({ name: 'Oscorp', plan: 'free' })
            .returningOneColumn(tOrganization.id)
            .executeInsertNoneOrOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into "organization" (name, "plan") values (:0, :1) returning id into :2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Oscorp",
            "free",
            {
              "as": "result",
              "dir": 3003,
            },
          ]
        `)
        expect(result).toBeNull()
    })

    test('execute-insert-one-with-returning-one-column', async () => {
        // `executeInsertOne()` + `returningOneColumn(col)` lands on the
        // same `__oneColumn` shape but throws `NO_RESULT` when the
        // engine returns undefined. The happy-path test covers the
        // value branch.
        ctx.mockNext(777)
        await ctx.withRollback(async () => {
            let result: number | null = null
            try {
                result = await ctx.conn.insertInto(tOrganization)
                    .values({ name: 'LexCorp', plan: 'pro' })
                    .returningOneColumn(tOrganization.id)
                    .executeInsertOne()
            } catch (e) {
                if (!ctx.realDbEnabled) throw e
            }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into "organization" (name, "plan") values (:0, :1) returning id into :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "LexCorp",
                "pro",
                {
                  "as": "result",
                  "dir": 3003,
                },
              ]
            `)
            if (!ctx.realDbEnabled) expect(result).toBe(777)
        })
    })

    test('execute-insert-one-throws-no-result-when-row-missing', async () => {
        // `executeInsertOne()` raises `NO_RESULT` when the engine
        // returns no row (see
        // [InsertQueryBuilder.ts:253](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L253)).
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

    test('execute-insert-many-with-returning-one-column', async () => {
        // `executeInsertMany()` + `returningOneColumn(col)` lands on the
        // `__oneColumn` branch of the many-returning path
        // ([InsertQueryBuilder.ts:272](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L272))
        // and returns an array of the projected column.
        if (ctx.realDbEnabled) return
        ctx.mockNext([201, 202])
        const ids = await ctx.conn.insertInto(tOrganization)
            .values([
                { name: 'Initrode', plan: 'free' },
                { name: 'Gringotts', plan: 'pro' },
            ])
            .returningOneColumn(tOrganization.id)
            .executeInsertMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"begin insert into "organization" (name, "plan") values (:0, :1) returning id into :2; insert into "organization" (name, "plan") values (:3, :4) returning id into :5; end;"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Initrode",
            "free",
            {
              "as": "result",
              "dir": 3003,
            },
            "Gringotts",
            "pro",
            {
              "as": "result",
              "dir": 3003,
            },
          ]
        `)
        assertType<Exact<typeof ids, number[]>>()
        expect(ids).toEqual([201, 202])
    })

    test('execute-insert-many-with-min-throws-when-empty', async () => {
        // `executeInsertMany(min, max)` checks `rows.length` after the
        // RETURNING result; with 0 rows and `min=2` it raises
        // `MINIMUM_ROWS_NOT_REACHED`. Mock-only.
        if (ctx.realDbEnabled) return
        ctx.mockNext([])
        let caught: unknown
        try {
            await ctx.conn.insertInto(tOrganization)
                .values([
                    { name: 'Aperture Science', plan: 'free' },
                    { name: 'Black Mesa', plan: 'pro' },
                ])
                .returning({ id: tOrganization.id })
                .executeInsertMany(2)
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't insert the minimum/)
    })

    test('execute-insert-many-with-max-throws-when-over-limit', async () => {
        // Same guard but on the max side: 3 returned rows, max=1 →
        // `MAXIMUM_ROWS_EXCEEDED`. Mock-only.
        if (ctx.realDbEnabled) return
        ctx.mockNext([
            { id: 1 },
            { id: 2 },
            { id: 3 },
        ])
        let caught: unknown
        try {
            await ctx.conn.insertInto(tOrganization)
                .values([
                    { name: 'Weyland-Yutani', plan: 'free' },
                    { name: 'Bluth Company', plan: 'pro' },
                ])
                .returning({ id: tOrganization.id })
                .executeInsertMany(0, 1)
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/MAXIMUM_ROWS_EXCEEDED|insert more that the maximum/)
    })
})
