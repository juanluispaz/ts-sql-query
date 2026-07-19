// A VALUE-TRANSFORMING adapter column read through a compound (union) and through
// an inline aggregated-array value: the adapter read (score ÷10, reviewer_code
// bracketed) fires on the composed result.
//
// Seed: project_review 1 has DB score 850 (read ÷10 -> 85) and reviewer_code
// 'R-7A2' (read bracketed -> '[R-7A2]'); it is the only review row.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject, tProjectReview } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('adapter-columns-projected-through-a-compound-union', async () => {
        // The adapter columns projected through a UNION compound: the compound
        // result reads `score` ÷10 and `reviewerCode` bracketed. Both branches
        // select the single review row, so the dedup leaves one row.
        const connection = ctx.conn
        const expected = [{ pid: 1, score: 85, reviewerCode: '[R-7A2]' }]
        ctx.mockNext([{ pid: 1, score: 850, reviewerCode: 'R-7A2' }])

        const first = connection.selectFrom(tProjectReview)
            .select({ pid: tProjectReview.projectId, score: tProjectReview.score, reviewerCode: tProjectReview.reviewerCode })
        const second = connection.selectFrom(tProjectReview)
            .where(tProjectReview.id.equals(1))
            .select({ pid: tProjectReview.projectId, score: tProjectReview.score, reviewerCode: tProjectReview.reviewerCode })

        const rows = await first.union(second)
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, score as score, reviewer_code as "reviewerCode" from project_review union select project_id as pid, score as score, reviewer_code as "reviewerCode" from project_review where id = $1 order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ pid: number, score: number, reviewerCode: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('adapter-column-through-inline-aggregated-array-value-per-element', async () => {
        // A scaled-tenth adapter column read as an inline aggregated-array value:
        // `selectOneColumn(score).forUseAsInlineAggregatedArrayValue()` aggregates
        // the DB values [850] and the outer projection reads each element ÷10 ->
        // [85]. The per-element read remap must fire on the aggregated array.
        const connection = ctx.conn
        const scores = connection.subSelectUsing(tProject).from(tProjectReview)
            .where(tProjectReview.projectId.equals(tProject.id))
            .selectOneColumn(tProjectReview.score)
            .forUseAsInlineAggregatedArrayValue()

        const expected = { id: 1, scores: [85] }
        ctx.mockNext({ id: 1, scores: JSON.stringify([850]) })

        const row = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, scores })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ((select json_agg(score) from project_review where project_id = project.id))::text as scores from project where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number, scores: number[] }>>()
        expect(row).toEqual(expected)
    })
})
