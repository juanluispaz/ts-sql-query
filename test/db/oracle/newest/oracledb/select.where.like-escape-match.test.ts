// Behavioural coverage of `_escapeLikeWildcard`: when an affix predicate's
// needle contains a LIKE metacharacter (`_` / `%`) it must be escaped so the
// engine matches it LITERALLY, not as a wildcard. The `like-escape*` tests pin
// the emitted param STRING; a mock never runs the LIKE, so only inserting a
// row and asserting WHICH rows come back proves the escape actually works on
// the engine. The matched set is dialect-independent — the per-dialect escaped
// param is asserted in `like-escape-literal` — so these assertions are the
// same in every cell.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tAppUser } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('starts-with-treats-underscore-literally', async () => {
        // `a_a@probe.test` holds a LITERAL underscore. The seeded
        // `ada@acme.test` and `alan@globex.test` both start with a-<any>-a, so
        // they WOULD leak in if `_` reached the engine as a single-char
        // wildcard; correct escaping matches only the literal-underscore row.
        ctx.mockNext(1)
        ctx.mockNext(['a_a@probe.test'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'a_a@probe.test', fullName: 'underscore probe' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.startsWith('a_a'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['a_a@probe.test'])
        })
    })

    test('contains-treats-percent-literally', async () => {
        // `wa%ew@probe.test` holds a LITERAL percent. `contains('a%e')` with
        // `%` leaking as a wildcard would match every seeded address (each has
        // an `a` before an `e`); correct escaping matches only the literal-
        // percent row.
        ctx.mockNext(1)
        ctx.mockNext(['wa%ew@probe.test'])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tAppUser)
                .values({ email: 'wa%ew@probe.test', fullName: 'percent probe' })
                .executeInsert()
            const emails = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.email.contains('a%e'))
                .selectOneColumn(tAppUser.email)
                .orderBy('result')
                .executeSelectMany()
            expect(emails).toEqual(['wa%ew@probe.test'])
        })
    })
})
