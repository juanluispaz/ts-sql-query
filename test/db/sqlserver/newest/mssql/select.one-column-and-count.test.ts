// Coverage of `selectOneColumn(...)` and `selectCountAll()` —
// projection-builder shortcuts
// that pin the result to a single scalar column. Paired with the
// `executeSelectOneColumn*` runner family
// (`executeSelectOneColumnOneRow` / `executeSelectOneColumnManyRows`).
//
//   - `.selectOneColumn(expr).executeSelectOne()`        → returns the bare scalar
//   - `.selectOneColumn(expr).executeSelectNoneOrOne()`  → returns scalar | null
//   - `.selectOneColumn(expr).executeSelectMany()`       → returns scalar[]
//   - `.selectCountAll().executeSelectOne()`             → emits `count(*)`
//
// The branch that flips the projection to a single column lives in
// `__executeSelectOne` / `__executeSelectMany` / `__executeSelectNoneOrOne`
// (`this.__oneColumn === true`). Hitting both the `one-row` and
// `many-rows` runner overloads is what these tests aim for.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('select-one-column-execute-many-returns-scalar-array', async () => {
        // The runner path is `executeSelectOneColumnManyRows`, not the
        // generic row-shape one. The SQL still selects the column under
        // an alias (`result`) — the runner unwraps. `orderBy` on a
        // one-column projection routes through the projection's alias
        // (`result`) since there are no other named columns.
        // The 4 seeded issues have priorities {2, 1, 3, 2}; sorting
        // ascending yields {1, 2, 2, 3}.
        ctx.mockNext([1, 2, 2, 3])
        const result = await ctx.conn.selectFrom(tIssue)
            .selectOneColumn(tIssue.priority)
            .orderBy('result')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select priority as [result] from issue order by [result]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<number>>>()
        expect(result).toEqual([1, 2, 2, 3])
    })

    test('select-one-column-execute-one-returns-scalar', async () => {
        // `executeSelectOne` on a one-column query routes through
        // `executeSelectOneColumnOneRow` and unwraps to a bare value.
        ctx.mockNext('open')
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.status)
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as [result] from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, string>>()
        expect(result).toBe('open')
    })

    test('select-one-column-execute-none-or-one-can-return-null', async () => {
        // The `noneOrOne` variant widens the result to `T | null` when
        // the driver returns no row. The mock returns the sentinel
        // value the runner uses to signal "no row".
        ctx.mockNext(undefined)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(9999))
            .selectOneColumn(tIssue.status)
            .executeSelectNoneOrOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as [result] from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            9999,
          ]
        `)
        assertType<Exact<typeof result, string | null>>()
        expect(result).toBeNull()
    })

    test('select-one-column-optional-present-row-null-value', async () => {
        // A one-column OPTIONAL scalar whose row exists but whose value is NULL:
        // issue 3 exists but its `body` is NULL, so
        // `selectOneColumn(tIssue.body).executeSelectOne()` returns a present-row
        // null (`string | null`), not a thrown NO_RESULT.
        ctx.mockNext(null)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .selectOneColumn(tIssue.body)
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select body as [result] from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof result, string | null>>()
        expect(result).toBeNull()
    })

    test('select-count-all-emits-count-star', async () => {
        // `selectCountAll()` is a shorthand for an int-result query.
        // The SQL must be `count(*)` (or the dialect equivalent),
        // wrapped in the same scalar-result projection as
        // `selectOneColumn`.
        ctx.mockNext(4)
        const result = await ctx.conn.selectFrom(tIssue)
            .selectCountAll()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as [result] from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, number>>()
        expect(result).toBe(4)
    })

    test('select-count-all-with-where-narrows-the-count', async () => {
        // `selectCountAll()` composes with WHERE — the count is over
        // the filtered subset. The snapshot shows the WHERE landing
        // before the limit clause.
        ctx.mockNext(2)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .selectCountAll()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as [result] from issue where status = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof result, number>>()
        expect(result).toBe(2)
    })

    test('select-one-column-of-expression-still-routes-via-one-column', async () => {
        // The column can be an arbitrary expression, not just a bare
        // column. `priority + 10` projects as a single int column and
        // the runner unwraps the same way. Sort to keep the per-cell
        // result deterministic (mock vs real DB don't share row order).
        ctx.mockNext([12, 11, 13, 12])
        const result = await ctx.conn.selectFrom(tIssue)
            .selectOneColumn(tIssue.priority.add(10))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select priority + @0 as [result] from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            10,
          ]
        `)
        assertType<Exact<typeof result, Array<number>>>()
        expect(result.slice().sort()).toEqual([11, 12, 12, 13])
    })

    test('select-one-column-execute-one-empty-result-throws-no-result', async () => {
        // `executeSelectOne()` on a one-column query that matches no row
        // throws NO_RESULT. Filtering on a
        // non-existing id makes the real DB return no row too, so this
        // runs in both modes; the query is still emitted (captured
        // before the throw fires in the `.then`).
        ctx.mockNext(undefined)
        let caught: unknown
        try {
            await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(9999))
                .selectOneColumn(tIssue.status)
                .executeSelectOne()
        } catch (e) {
            caught = e
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as [result] from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            9999,
          ]
        `)
        expect(String(caught)).toMatch(/NO_RESULT|No result returned/)
        expect(caught instanceof TsSqlError ? caught.errorReason.reason : undefined).toBe('NO_RESULT')
    })

    test('select-multi-column-execute-one-empty-result-throws-no-result', async () => {
        // Same NO_RESULT guard on the multi-column row path
        // `executeSelectOneRow` returns no
        // row, so the row-shape branch throws instead of coercing.
        ctx.mockNext(undefined)
        let caught: unknown
        try {
            await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(9999))
                .select({ id: tIssue.id, status: tIssue.status })
                .executeSelectOne()
        } catch (e) {
            caught = e
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, status as status from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            9999,
          ]
        `)
        expect(String(caught)).toMatch(/NO_RESULT|No result returned/)
    })

    test('select-one-column-execute-one-multiple-rows-throws-more-than-one-row', async () => {
        // `executeSelectOne()` on a one-column query that matches MORE THAN ONE row
        // throws MORE_THAN_ONE_ROW. Project 1 has two issues (ids 1, 2), so
        // project_id = 1 returns two rows. The mock returns a single queued value
        // and cannot produce two rows, so the throw is asserted only on real-DB /
        // native-SQLite cells; on mock the single value returns without a throw. The
        // SQL is captured (before the throw fires) in both modes.
        ctx.mockNext('open')
        let caught: unknown
        let result: string | undefined
        try {
            result = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.projectId.equals(1))
                .selectOneColumn(tIssue.status)
                .executeSelectOne()
        } catch (e) {
            caught = e
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as [result] from issue where project_id = @0"`)
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
            expect(result).toBe('open')
        }
    })

    test('select-multi-column-execute-one-multiple-rows-throws-more-than-one-row', async () => {
        // MORE_THAN_ONE_ROW on the multi-column row path: `executeSelectOne()` over
        // a projection matching two rows (project 1 has issues 1 and 2) throws on a
        // real engine. The mock returns a single queued object, so mock returns it
        // without a throw.
        ctx.mockNext({ id: 1, status: 'open' })
        let caught: unknown
        let result: { id: number; status: string } | undefined
        try {
            result = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.projectId.equals(1))
                .select({ id: tIssue.id, status: tIssue.status })
                .executeSelectOne()
        } catch (e) {
            caught = e
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, status as status from issue where project_id = @0"`)
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
            expect(result).toEqual({ id: 1, status: 'open' })
        }
    })

    test('select-one-column-execute-none-or-one-multiple-rows-throws-more-than-one-row', async () => {
        // `executeSelectNoneOrOne()` widens the null (None) arm, but MORE-than-one
        // row is still a hard error: it routes through the same
        // `executeSelectOneColumnOneRow` runner method as `executeSelectOne`, which
        // rejects >1 rows with MORE_THAN_ONE_ROW. The null arm is covered by
        // `select-one-column-execute-none-or-one-can-return-null`; this pins the
        // too-many-rows inhabitant. Project 1 has two issues (ids 1, 2), so
        // project_id = 1 returns two rows. The mock returns a single queued value
        // and cannot produce two rows, so the throw is asserted only on real-DB /
        // native-SQLite cells; on mock the single value returns without a throw. The
        // SQL is captured (before the throw fires) in both modes.
        ctx.mockNext('open')
        let caught: unknown
        let result: string | null | undefined
        try {
            result = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.projectId.equals(1))
                .selectOneColumn(tIssue.status)
                .executeSelectNoneOrOne()
        } catch (e) {
            caught = e
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as [result] from issue where project_id = @0"`)
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
            expect(result).toBe('open')
        }
    })

    test('select-one-column-execute-page-returns-scalar-array-and-count', async () => {
        // `executeSelectPage` on a one-column `selectOneColumn(...)` query: `data` is
        // a bare scalar array (`number[]`, not `Array<{...}>`) alongside `count`. It
        // fires two queries — the LIMIT/OFFSET data page and the unpaginated count.
        // The 4 seeded issues have priorities {2,1,3,2}; ascending → {1,2,2,3}, so
        // the first page of 2 is [1, 2] with count 4.
        ctx.mockNext([1, 2])
        ctx.mockNext(4)
        const page = await ctx.conn.selectFrom(tIssue)
            .selectOneColumn(tIssue.priority)
            .orderBy('result')
            .limit(2)
            .offset(0)
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select priority as [result] from issue order by [result] offset @0 rows fetch next @1 rows only"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            0,
            2,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"select count(*) from issue"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof page, { data: number[]; count: number }>>()
        expect(page).toEqual({ data: [1, 2], count: 4 })
    })
})
