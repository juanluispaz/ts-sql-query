// `.substring(start, end)` follows `String.prototype.substring`'s index rules:
// every index is clamped to 0, and when the two are known at build time and
// start > end they SWAP. SQL string positions are 1-based and the second
// argument of the emitted function is a LENGTH, not an end index, so the
// library has to translate the JS bounds before emitting. These tests pin the
// three CLAMP/SWAP decisions that translation makes: a negative start clamping
// to zero, a non-zero start shifting the position and shortening the length, and
// a negative end clamping to zero.
//
// Two of the emitted shapes are not new — `select.string-ops.test.ts` already
// bakes the same SQL from already-clamped arguments. What is new here is which
// INPUT produced them: that a negative bound is normalised rather than passed
// through or rejected. Read each test's comment for the specific fact it adds.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('substring-bounds/a-negative-start-is-clamped-to-the-first-character', async () => {
        // A negative start means "from the first character" — 'abcdef'.substring(-3, 4)
        // is 'abcd', not an error and not a count from the end. The emitted shape is
        // the same one a start of 0 produces (and `select.string-ops.test.ts` already
        // bakes that); the fact added here is that a NEGATIVE start is normalised to
        // it rather than passed through, which would emit a nonsense position.
        // Issue 4: title 'Document /v2/users', id 4 → substring(-3, 4) = 'Docu'.
        const expected = [{ id: 4, sub: 'Docu' }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(4))
            .select({
                id:  tIssue.id,
                sub: tIssue.title.substring(-3, tIssue.id),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", substr(title, 1, id) as "sub" from issue where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; sub: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('substring-bounds/a-positive-start-shifts-the-position-and-shortens-the-length', async () => {
        // A positive start moves the 0-based JS index onto the 1-based SQL position AND
        // shortens the length by that same start, because the column argument is an END
        // index while SQL wants a character count. Issue 4: title 'Document /v2/users',
        // id 4 → substring(1, 4) = 'ocu' (three characters, not four).
        const expected = [{ id: 4, sub: 'ocu' }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(4))
            .select({
                id:  tIssue.id,
                sub: tIssue.title.substring(1, tIssue.id),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", substr(title, :0, id - :1) as "sub" from issue where id = :2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; sub: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('substring-bounds/a-negative-end-is-clamped-to-zero-and-the-bounds-swap', async () => {
        // The clamp and the swap cannot be pinned separately: any input that clamps
        // the end WITHOUT triggering a swap (a negative end with a start of 0 or less)
        // yields a zero-length substring, and Oracle returns NULL rather than '' for
        // `substr(x, 1, 0)`. So this test deliberately covers both decisions at once.
        // A negative END clamps to 0, which then leaves start > end, so the two bounds
        // swap: 'abcdef'.substring(3, -2) is 'abc'. Emitting the arguments as written
        // would ask the engine for a negative length, which PostgreSQL rejects outright.
        // Issue 1: title 'Update hero copy' → substring(3, -2) = substring(0, 3) = 'Upd'.
        const expected = [{ id: 1, sub: 'Upd' }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                sub: tIssue.title.substring(3, -2),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", substr(title, :0, :1) as "sub" from issue where id = :2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; sub: string }>>>()
        expect(rows).toEqual(expected)
    })
})
