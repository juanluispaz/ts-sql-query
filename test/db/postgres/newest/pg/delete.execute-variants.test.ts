// Mirror of [update.execute-variants.test.ts](./update.execute-variants.test.ts)
// for the DELETE side. Lights up:
//
//   - `executeDelete(min, max)` — min-/max-row guards
//   - `executeDeleteNoneOrOne()` with `returningOneColumn(...)` — the
//     `__oneColumn` branch
//     plus its `value === undefined → null` coercion path.
//   - `executeDeleteMany(min, max)` — the same min/max guards on the
//     RETURNING-many path.
//
// Mock-only for the min/max throw cases; the rest run inside
// `withRollback` so real-DB cells stay clean.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('execute-delete-with-min-max-passes-when-count-in-range', async () => {
        // `executeDelete(2, 5)` accepts any count in [2, 5]. The
        // WHERE matches every seeded issue (4 rows) so the assertion
        // passes against the real DB too. Wrapped in `withRollback`
        // to leave the seed intact.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.priority.greaterOrEqual(1))
                .executeDelete(2, 5)

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where priority >= $1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(4)
        })
    })

    test('execute-delete-throws-when-fewer-rows-than-min', async () => {
        // `executeDelete(min)` with count < min raises
        // `MINIMUM_ROWS_NOT_REACHED`.
        ctx.mockNext(0)
        let caught: unknown
        try {
            await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.priority.equals(99))
                .executeDelete(1)
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't delete the minimum/)
    })

    test('execute-delete-throws-when-more-rows-than-max', async () => {
        // `executeDelete(min, max)` with count > max raises
        // `MAXIMUM_ROWS_EXCEEDED`. WHERE matches all 4 seeded issues
        // (priority >= 1), so count = 4 > max = 1 fires on real DB
        // without any mock-shaping.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.deleteFrom(tIssue)
                    .where(tIssue.priority.greaterOrEqual(1))
                    .executeDelete(0, 1)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MAXIMUM_ROWS_EXCEEDED|deleted more/)
        })
    })

    test('execute-delete-none-or-one-with-returning-one-column', async () => {
        // `executeDeleteNoneOrOne()` + `returningOneColumn(col)` returns
        // the single value or null. Deletes issue 1 (status='open').
        ctx.mockNext('open')
        await ctx.withRollback(async () => {
            const result = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.id.equals(1))
                .returningOneColumn(tIssue.status)
                .executeDeleteNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = $1 returning status as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            expect(result).toBe('open')
        })
    })

    test('execute-delete-none-or-one-with-returning-one-column-empty-result', async () => {
        // Same path but no row returned -> the `__oneColumn` branch
        // coerces missing to `null`
        // Filter on a non-existing id so real-DB also yields no row
        // from RETURNING.
        ctx.mockNext(undefined)
        await ctx.withRollback(async () => {
            const result = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.id.equals(9999))
                .returningOneColumn(tIssue.status)
                .executeDeleteNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = $1 returning status as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                9999,
              ]
            `)
            expect(result).toBeNull()
        })
    })

    test('execute-delete-many-with-min-throws-when-empty', async () => {
        // `executeDeleteMany(min, max)` checks `rows.length` after the
        // RETURNING result; filter on a non-existing priority so
        // real-DB returns 0 rows, then min = 2 raises
        // `MINIMUM_ROWS_NOT_REACHED`.
        ctx.mockNext([])
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.deleteFrom(tIssue)
                    .where(tIssue.priority.equals(99))
                    .returning({ id: tIssue.id, status: tIssue.status })
                    .executeDeleteMany(2)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't delete the minimum/)
        })
    })

    test('execute-delete-many-with-max-throws-when-over-limit', async () => {
        // Same guard but on the max side: WHERE matches all 4 seeded
        // issues (priority >= 1), max = 1 -> `MAXIMUM_ROWS_EXCEEDED`
        // on real DB without mock-shaping.
        ctx.mockNext([
            { id: 1, status: 'open' },
            { id: 2, status: 'in_progress' },
            { id: 3, status: 'open' },
            { id: 4, status: 'closed' },
        ])
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.deleteFrom(tIssue)
                    .where(tIssue.priority.greaterOrEqual(1))
                    .returning({ id: tIssue.id, status: tIssue.status })
                    .executeDeleteMany(0, 1)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MAXIMUM_ROWS_EXCEEDED|deleted more/)
        })
    })

    test('execute-delete-many-with-min-max-in-range-passes', async () => {
        // `executeDeleteMany(min, max)` with an in-range count and a
        // `.returning({...})` row-shape: WHERE matches project 1's two issues
        // (ids 1, 2), count 2 is in [1, 5], and the deleted rows come back via
        // RETURNING (their old values). Sorted by id for a deterministic
        // comparison in both modes.
        const expected = [
            { id: 1, status: 'open' },
            { id: 2, status: 'in_progress' },
        ]
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const rows = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.projectId.equals(1))
                .returning({ id: tIssue.id, status: tIssue.status })
                .executeDeleteMany(1, 5)

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where project_id = $1 returning id as id, status as status"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof rows, Array<{ id: number, status: string }>>>()
            const sorted = rows.slice().sort((a, b) => a.id - b.id)
            expect(sorted).toEqual(expected)
        })
    })

    test('execute-delete-none-or-one-with-returning-row-shape', async () => {
        // `executeDeleteNoneOrOne()` + `.returning({...})` row-shape with a WHERE
        // matching exactly one row (issue 1) returns the deleted row object
        // (present, not null).
        const expected = { id: 1, status: 'open' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const result = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.id.equals(1))
                .returning({ id: tIssue.id, status: tIssue.status })
                .executeDeleteNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = $1 returning id as id, status as status"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof result, { id: number, status: string } | null>>()
            expect(result).toEqual(expected)
        })
    })

    test('execute-delete-one-column-many-non-empty-result', async () => {
        // `returningOneColumn(col)` + `executeDeleteMany()` returns a NON-EMPTY
        // scalar array. WHERE matches project 1's two issues (ids 1, 2); their
        // statuses come back (sorted for a deterministic comparison).
        const expected = ['in_progress', 'open']
        ctx.mockNext(['open', 'in_progress'])
        await ctx.withRollback(async () => {
            const statuses = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.projectId.equals(1))
                .returningOneColumn(tIssue.status)
                .executeDeleteMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where project_id = $1 returning status as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof statuses, string[]>>()
            expect(statuses.slice().sort()).toEqual(expected)
        })
    })

    test('execute-delete-one-column-many-in-range-passes', async () => {
        // The one-column arity of the many-in-range PASS: `executeDeleteMany(min,
        // max)` with `returningOneColumn(col)`. WHERE matches project 1's two
        // issues (ids 1, 2), count 2 is in [1, 5], and their statuses come back
        // (sorted for a deterministic comparison).
        const expected = ['in_progress', 'open']
        ctx.mockNext(['open', 'in_progress'])
        await ctx.withRollback(async () => {
            const statuses = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.projectId.equals(1))
                .returningOneColumn(tIssue.status)
                .executeDeleteMany(1, 5)

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where project_id = $1 returning status as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof statuses, string[]>>()
            expect(statuses.slice().sort()).toEqual(expected)
        })
    })

    test('execute-delete-one-column-many-with-min-throws-when-empty', async () => {
        // The one-column arity of the many min-throw arm: `executeDeleteMany(min)`
        // with `returningOneColumn(col)`. Filter on a non-existing priority so the
        // one-column-many result is empty, then min = 2 throws
        // `MINIMUM_ROWS_NOT_REACHED` in both modes.
        ctx.mockNext([])
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.deleteFrom(tIssue)
                    .where(tIssue.priority.equals(99))
                    .returningOneColumn(tIssue.status)
                    .executeDeleteMany(2)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't delete the minimum/)
        })
    })

    test('execute-delete-returning-row-shape-execute-one-multiple-rows-throws-more-than-one-row', async () => {
        // `.returning({...}).executeDeleteOne()` over a WHERE matching MORE THAN
        // ONE row (project 1 has issues 1, 2) routes the RETURNING rows through
        // the `executeDeleteReturningOneRow` runner guard, which throws
        // MORE_THAN_ONE_ROW on a real engine. The mock returns a single queued
        // object and cannot produce two rows, so on mock it returns without a
        // throw. The SQL is captured (before the throw fires) in both modes.
        ctx.mockNext({ id: 1, status: 'open' })
        await ctx.withRollback(async () => {
            let caught: unknown
            let result: { id: number; status: string } | undefined
            try {
                result = await ctx.conn.deleteFrom(tIssue)
                    .where(tIssue.projectId.equals(1))
                    .returning({ id: tIssue.id, status: tIssue.status })
                    .executeDeleteOne()
            } catch (e) {
                caught = e
            }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where project_id = $1 returning id as id, status as status"`)
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
    })

    test('execute-delete-returning-row-shape-execute-none-or-one-multiple-rows-throws-more-than-one-row', async () => {
        // Same MORE_THAN_ONE_ROW guard on the none-or-one row-shape path:
        // `.returning({...}).executeDeleteNoneOrOne()` widens the None arm to
        // null, but >1 RETURNING rows is still a hard error through the same
        // `executeDeleteReturningOneRow` runner. The mock returns a single queued
        // object, so on mock it returns without a throw.
        ctx.mockNext({ id: 1, status: 'open' })
        await ctx.withRollback(async () => {
            let caught: unknown
            let result: { id: number; status: string } | null | undefined
            try {
                result = await ctx.conn.deleteFrom(tIssue)
                    .where(tIssue.projectId.equals(1))
                    .returning({ id: tIssue.id, status: tIssue.status })
                    .executeDeleteNoneOrOne()
            } catch (e) {
                caught = e
            }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where project_id = $1 returning id as id, status as status"`)
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
    })

    test('execute-delete-returning-one-column-execute-one-multiple-rows-throws-more-than-one-row', async () => {
        // The one-column arity of the MORE_THAN_ONE_ROW guard on delete:
        // `.returningOneColumn(col).executeDeleteOne()` over a WHERE matching two
        // rows (project 1) throws MORE_THAN_ONE_ROW on a real engine. The mock
        // returns a single queued value, so on mock it returns without a throw.
        ctx.mockNext('open')
        await ctx.withRollback(async () => {
            let caught: unknown
            let result: string | undefined
            try {
                result = await ctx.conn.deleteFrom(tIssue)
                    .where(tIssue.projectId.equals(1))
                    .returningOneColumn(tIssue.status)
                    .executeDeleteOne()
            } catch (e) {
                caught = e
            }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where project_id = $1 returning status as result"`)
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
    })

    test('execute-delete-returning-one-column-execute-none-or-one-multiple-rows-throws-more-than-one-row', async () => {
        // Same MORE_THAN_ONE_ROW guard on the one-column none-or-one path:
        // `.returningOneColumn(col).executeDeleteNoneOrOne()` widens None to null
        // but >1 RETURNING rows still throws. The mock returns a single queued
        // value, so on mock it returns without a throw.
        ctx.mockNext('open')
        await ctx.withRollback(async () => {
            let caught: unknown
            let result: string | null | undefined
            try {
                result = await ctx.conn.deleteFrom(tIssue)
                    .where(tIssue.projectId.equals(1))
                    .returningOneColumn(tIssue.status)
                    .executeDeleteNoneOrOne()
            } catch (e) {
                caught = e
            }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where project_id = $1 returning status as result"`)
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
    })

    test('execute-delete-one-column-many-with-max-throws-when-over-limit', async () => {
        // The one-column arity of the many max-throw arm: `executeDeleteMany(min,
        // max)` with `returningOneColumn(col)`. WHERE matches all 4 seeded issues
        // (priority >= 1), so the one-column-many result has 4 rows and max = 1
        // throws `MAXIMUM_ROWS_EXCEEDED` in both modes (the mock is primed with 4
        // statuses so the guard fires without shaping).
        ctx.mockNext(['open', 'in_progress', 'open', 'closed'])
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.deleteFrom(tIssue)
                    .where(tIssue.priority.greaterOrEqual(1))
                    .returningOneColumn(tIssue.status)
                    .executeDeleteMany(0, 1)
            } catch (e) { caught = e }
            expect(String(caught)).toMatch(/MAXIMUM_ROWS_EXCEEDED|deleted more/)
        })
    })


    test('delete-query-called-twice-returns-the-cached-sql-without-re-binding-params', () => {
        // The DELETE builder's `query()` / `params()` accessors are reached by no
        // other test in the matrix, so neither the cache nor the build-on-demand path
        // has ever run on this builder. `query()` must memoise: the builder appends
        // into ONE params array, so a lost cache would bind the two ids a second time
        // and renumber the placeholders of the second rendering.
        //
        // Nothing is executed — no row is deleted and no rollback is needed, which
        // is why seeded ids are safe to name here.
        const built = ctx.conn.deleteFrom(tIssue)
            .where(tIssue.id.in([1, 2]))

        const first = built.query()
        const second = built.query()
        expect(second).toBe(first)

        expect(first).toMatchInlineSnapshot(`"delete from issue where id in ($1, $2)"`)
        assertType<Exact<typeof first, string>>()
        expect(built.params()).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
    })

    test('delete-params-before-query-builds-on-demand', () => {
        // `params()` as the FIRST call on a delete builder: with nothing built yet it
        // triggers the build rather than handing back the empty array the builder
        // starts life with. A later `query()` finds the cache warm and renders the
        // statement those params belong to. Build-only, so the seed is untouched.
        const built = ctx.conn.deleteFrom(tIssue)
            .where(tIssue.id.equals(2))

        expect(built.params()).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)

        const sql = built.query()
        expect(sql).toMatchInlineSnapshot(`"delete from issue where id = $1"`)
        assertType<Exact<typeof sql, string>>()
    })
})
