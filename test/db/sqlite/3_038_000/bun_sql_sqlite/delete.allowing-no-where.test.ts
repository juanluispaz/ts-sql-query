// Coverage of `connection.deleteAllowingNoWhereFrom(...)`
// the explicit opt-in that lets a DELETE reach the driver without a
// WHERE clause. The regular `connection.deleteFrom(...)` throws when the
// sentence ends without a WHERE (the safety guard documented in
// docs/queries/delete.md); `deleteAllowingNoWhereFrom` relaxes that guard.
//
// Both tests mutate, so they run inside `ctx.withRollback(...)`. The
// no-WHERE DELETE removes every seeded issue; the worklog and webhook
// rows that reference `issue` are declared `ON DELETE CASCADE`, so
// removing all issues cascades to them and trips no FK constraint.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('delete-allowing-no-where-removes-all-rows', async () => {
        // No WHERE at all: the sentence would be rejected by the regular
        // `deleteFrom(...)` path; `deleteAllowingNoWhereFrom` lets it
        // through and every seeded issue is removed.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteAllowingNoWhereFrom(tIssue)
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(4)
        })
    })

    test('delete-allowing-no-where-still-honors-a-supplied-where', async () => {
        // The "allowing" variant only relaxes the guard — supplying a
        // WHERE is still valid and emits the predicate as usual.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteAllowingNoWhereFrom(tIssue)
                .where(tIssue.priority.greaterOrEqual(1))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where priority >= $1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(4)
        })
    })
    test('delete-allowing-no-where-returning-removes-all-rows', async () => {
        // With no WHERE the DELETE removes every seeded issue and RETURNING reads
        // each removed row back. The returned order is not guaranteed, so rows are
        // sorted by id before comparing.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        await ctx.withRollback(async () => {
            ctx.mockNext(expected)
            const rows = await ctx.conn.deleteAllowingNoWhereFrom(tIssue)
                .returning({ id: tIssue.id })
                .executeDeleteMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue returning id as id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof rows, Array<{ id: number }>>>()
            const sorted = [...rows].sort((a, b) => a.id - b.id)
            expect(sorted).toEqual(expected)
        })
    })

})
