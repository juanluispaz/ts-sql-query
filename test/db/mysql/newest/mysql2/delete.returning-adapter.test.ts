// DELETE … RETURNING reading an ADAPTER / virtual column through
// `returningOneColumn(...)`. The update side already covers this
// (update.custom-columns.test.ts: `returningOneColumn(activityTagged)` and the
// branded `channel`); the delete side did not. Each target carries a non-identity
// TypeAdapter, so reading it back through RETURNING applies `transformValueFromDB`:
// the mock is primed with the RAW db value and the adapter transforms it on the
// way out. `tProjectReview` is a leaf table (nothing FKs into it), so the DELETE is
// referential-integrity-safe; each mutation runs inside `ctx.withRollback(...)`.
//
// MySQL has no RETURNING on DELETE — the library refuses
// `.returningOneColumn(...).executeDeleteOne()` at compile time. The whole family
// is kept here commented for symmetry.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: MySQL has no RETURNING on DELETE.
    /*
    test('delete-project-review-returning-bracket-adapter-column', async () => {
        // `returningOneColumn(reviewerCode)` on a DELETE reads back the string
        // column through its bracketAdapter: the mock is primed with the RAW db
        // value 'R-7A2', the adapter brackets it to '[R-7A2]' on read. Review 1's
        // reviewer_code is 'R-7A2'.
        await ctx.withRollback(async () => {
            ctx.mockNext('R-7A2')
            const code = await ctx.conn.deleteFrom(tProjectReview)
                .where(tProjectReview.id.equals(1))
                .returningOneColumn(tProjectReview.reviewerCode)
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof code, string>>()
            expect(code).toBe('[R-7A2]')
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING on DELETE.
    /*
    test('delete-project-review-returning-scaled-adapter-column', async () => {
        // `returningOneColumn(score)` on a DELETE reads back the int column through
        // its scaledTenthAdapter: the mock is primed with the RAW db value 850, the
        // adapter divides by 10 to 85 on read. Review 1's score is 850.
        await ctx.withRollback(async () => {
            ctx.mockNext(850)
            const score = await ctx.conn.deleteFrom(tProjectReview)
                .where(tProjectReview.id.equals(1))
                .returningOneColumn(tProjectReview.score)
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof score, number>>()
            expect(score).toBe(85)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING on DELETE.
    /*
    test('delete-project-release-returning-virtual-fragment-column', async () => {
        // `returningOneColumn(versionTag)` on a DELETE reads back a
        // `virtualColumnFromFragment` (no DB column — computed inline as
        // `upper(channel)`). The fragment is emitted in the RETURNING clause and the
        // mock is primed with the computed db value 'STABLE'. Release 1's channel is
        // 'stable'; nothing FKs into project_release, so the delete is
        // referential-integrity-safe.
        await ctx.withRollback(async () => {
            ctx.mockNext('STABLE')
            const tag = await ctx.conn.deleteFrom(tProjectRelease)
                .where(tProjectRelease.id.equals(1))
                .returningOneColumn(tProjectRelease.versionTag)
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof tag, string>>()
            expect(tag).toBe('STABLE')
        })
    })
    */
})
