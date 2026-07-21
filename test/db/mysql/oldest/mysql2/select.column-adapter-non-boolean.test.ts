// Per-column TypeAdapter on non-boolean column kinds. `tProjectReview` carries a
// string `bracketAdapter` on `reviewerCode` (wraps the read value in `[...]`) and
// a fixed-point `scaledTenthAdapter` on the int `score` (the DB stores the value
// scaled x10; the app reads it /10 and writes it x10). The tests assert both the
// read transform and the write transform (the scaled bound param).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProjectReview } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('non-boolean-column-adapters-transform-read-values', async () => {
        // `reviewerCode` (string + bracketAdapter) reads bracketed; `score` (int
        // + scaledTenthAdapter) reads the DB's ×10 value unscaled. Review 1:
        // reviewer_code 'R-7A2' -> '[R-7A2]', score 850 -> 85. The mock is primed
        // with the RAW DB values, so the assertion proves the adapter ran.
        const expected = [{ id: 1, code: '[R-7A2]', score: 85 }]
        ctx.mockNext([{ id: 1, code: 'R-7A2', score: 850 }])
        const rows = await ctx.conn.selectFrom(tProjectReview)
            .where(tProjectReview.id.equals(1))
            .select({
                id:    tProjectReview.id,
                code:  tProjectReview.reviewerCode,
                score: tProjectReview.score,
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, reviewer_code as \`code\`, score as score from project_review where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; code: string; score: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('non-boolean-int-column-adapter-scales-the-bound-param-on-write', async () => {
        // The adapter-present WRITE path: filtering by `score.equals(85)` runs
        // the adapter's write transform on the operand, sending the scaled DB
        // value 850 as the bound param. Review 1 (score 850) matches.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectReview)
            .where(tProjectReview.score.equals(85))
            .select({ id: tProjectReview.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_review where score = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            850,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })
})
