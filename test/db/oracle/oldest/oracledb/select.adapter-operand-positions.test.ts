// `tProjectReview.score` carries a fixed-point TypeAdapter (scaledTenth: the DB
// stores the value ×10, the app reads it ÷10 and writes it ×10), and the
// `scaledThresholdFragment` valueArg carries the same ×10 adapter. Using either as
// a comparison operand runs the adapter's write transform, so the bound param is
// the scaled value: in a JOIN `.on(...)` and in a correlated `subSelectUsing` WHERE
// the score operand binds 850, and in a HAVING the fragment threshold 1 binds 10.
//
// Seed: project_review 1 (project 1, reviewer_code 'R-7A2' read bracketed as
// '[R-7A2]', score 850 read ÷10 as 85). Mocks are primed with the RAW DB values
// so the read adapters are exercised on the result.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject, tProjectReview } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('adapter-column-as-join-on-operand-scales-the-bound-param', async () => {
        // `score.equals(85)` in the JOIN ON condition runs the score write adapter,
        // so the ON param is the scaled 850 (not 85); reviewer_code reads bracketed.
        // Review 1 (project 1, score 850 -> 85) matches, so project 1 joins.
        const expected = [{ projectId: 1, reviewer: '[R-7A2]' }]
        ctx.mockNext([{ projectId: 1, reviewer: 'R-7A2' }])
        const rows = await ctx.conn.selectFrom(tProject)
            .innerJoin(tProjectReview).on(
                tProjectReview.projectId.equals(tProject.id)
                    .and(tProjectReview.score.equals(85)),
            )
            .where(tProject.id.equals(1))
            .select({
                projectId: tProject.id,
                reviewer:  tProjectReview.reviewerCode,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "projectId", project_review.reviewer_code as "reviewer" from project inner join project_review on project_review.project_id = project.id and project_review.score = :0 where project.id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            850,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; reviewer: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('adapter-column-in-correlated-subquery-where-scales-the-bound-param', async () => {
        // `score.equals(85)` in the WHERE of a correlated `subSelectUsing` binds the
        // scaled 850 inside the subquery. For project 1 the subquery finds review 1
        // and returns its bracketed reviewer_code; the scalar subquery value is
        // optional (could match no row).
        const expected = { id: 1, reviewer: '[R-7A2]' }
        ctx.mockNext({ id: 1, reviewer: 'R-7A2' })
        const reviewerSub = ctx.conn.subSelectUsing(tProject).from(tProjectReview)
            .where(tProjectReview.projectId.equals(tProject.id))
                .and(tProjectReview.score.equals(85))
            .selectOneColumn(tProjectReview.reviewerCode)
            .forUseAsInlineQueryValue()
        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, reviewer: reviewerSub })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", (select reviewer_code as "result" from project_review where project_id = project.id and score = :0) as "reviewer" from project where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            850,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; reviewer?: string }>>()
        expect(row).toEqual(expected)
    })

    test('adapter-carrying-fragment-in-having-scales-the-bound-param', async () => {
        // `scaledThresholdFragment`'s valueArg carries scaledTenthAdapter (×10 on the
        // write path). In a HAVING over a grouped aggregate the threshold 1 binds the
        // scaled 10, so the predicate is `count(id) > 10` rather than `> 1`. No
        // project group has more than ten issues, so the result is empty — and were
        // the adapter not applied (param 1), project 1 (two issues) would survive, so
        // the empty assertion is what catches that regression.
        const expected: Array<{ projectId: number }> = []
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({ projectId: tIssue.projectId })
            .groupBy('projectId')
            .having(ctx.conn.scaledThresholdFragment(ctx.conn.count(tIssue.id), 1))
            .orderBy('projectId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId" from issue group by project_id having count(id) > :0 order by "projectId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            10,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number }>>>()
        expect(rows).toEqual(expected)
    })
})
