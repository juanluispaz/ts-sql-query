// `aggregateAsArray({ …, header: { … } })` where one element property is ITSELF
// a nested object. The aggregate-element projector descends into the inner
// object the same way the top-level result projector does; existing aggregate
// coverage only uses flat element properties, so the element → inner-object arm
// is the distinct path here.
//
// - own-table leaves in the inner object → `header` is required.
// - a left-joined inner object → `header` becomes optional (absent when the
//   join misses), with a `projectingOptionalValuesAsNullable()` twin.
//
// JSON aggregate order is not guaranteed, so the array is sorted by `id` before
// comparing. Mocks are primed with the RAW aggregated rows.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('aggregate-element-with-required-nested-object', async () => {
        // The aggregate element carries an inner `header` object of two own-table
        // required columns. The element projector descends into `header`, which
        // stays required on every element. Project 1 has issues 1 and 2.
        ctx.mockNext([{ pid: 1, issues: [
            { id: 1, header: { num: 1, title: 'Update hero copy' } },
            { id: 2, header: { num: 2, title: 'Redesign navbar' } },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:    tIssue.projectId,
                issues: ctx.conn.aggregateAsArray({
                    id:     tIssue.id,
                    header: { num: tIssue.number, title: tIssue.title },
                }),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "pid", json_arrayagg(json_object('id' value id, 'header.num' value "number", 'header.title' value title)) as "issues" from issue where project_id = :0 group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ id: number; header: { num: number; title: string } }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.id - b.id) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { id: 1, header: { num: 1, title: 'Update hero copy' } },
            { id: 2, header: { num: 2, title: 'Redesign navbar' } },
        ] }])
    })

    test('aggregate-element-with-left-joined-nested-object-makes-it-optional', async () => {
        // The inner `header` object is built from a LEFT-JOINED issue, so the
        // element projector makes the whole `header` optional (absent when the
        // join misses). Project 1 has issues 1 and 2, so the join hits for both
        // aggregated elements and `header` is present.
        ctx.mockNext([{ pid: 1, issues: [
            { id: 1, header: { num: 1, title: 'Update hero copy' } },
            { id: 2, header: { num: 2, title: 'Redesign navbar' } },
        ] }])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid:    tProject.id,
                issues: ctx.conn.aggregateAsArray({
                    id:     tIssueLeft.id,
                    header: { num: tIssueLeft.number, title: tIssueLeft.title },
                }),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "pid", json_arrayagg(json_object('id' value issue.id, 'header.num' value issue."number", 'header.title' value issue.title)) as "issues" from project left join issue on issue.project_id = project.id where project.id = :0 group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ id: number; header?: { num: number; title: string } }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.id - b.id) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { id: 1, header: { num: 1, title: 'Update hero copy' } },
            { id: 2, header: { num: 2, title: 'Redesign navbar' } },
        ] }])
    })
})
