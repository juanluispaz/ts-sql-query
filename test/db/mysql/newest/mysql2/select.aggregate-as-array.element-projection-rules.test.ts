// `aggregateAsArray({ title, body })` over tIssue (no join) builds an array whose
// element objects have a required `title` leaf and an optional `body` leaf. By
// default a null optional leaf is dropped from the element (`body?: string`);
// `projectingOptionalValuesAsNullable()` keeps it as `body: string | null`
// (present-null).
//
// Project 1 has issue 1 (body NULL) and issue 2 (body 'Use new tokens'). JSON
// aggregate order is not guaranteed, so the array is sorted by title before
// comparing. Mocks are primed with the RAW aggregated rows.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('element-top-rule-3-own-table-optional-leaf-default-drops-null', async () => {
        // Default projector: a null optional `body` leaf is dropped from the element.
        // Issue 1's body is NULL → absent; issue 2's 'Use new tokens' survives.
        ctx.mockNext([{ pid: 1, issues: [
            { title: 'Update hero copy', body: null },
            { title: 'Redesign navbar',  body: 'Use new tokens' },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:    tIssue.projectId,
                issues: ctx.conn.aggregateAsArray({ title: tIssue.title, body: tIssue.body }),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, json_arrayagg(json_object('title', title, 'body', body)) as issues from issue where project_id = ? group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ title: string; body?: string }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.title.localeCompare(b.title)) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { title: 'Redesign navbar', body: 'Use new tokens' },
            { title: 'Update hero copy' },
        ] }])
        // Issue 1's null body is ABSENT under the default projector.
        const issue1 = rows[0]!.issues.find(i => i.title === 'Update hero copy')!
        expect('body' in issue1).toBe(false)
    })

    test('element-top-rule-3-own-table-optional-leaf-as-nullable-surfaces-null', async () => {
        // `projectingOptionalValuesAsNullable()` on the aggregate makes the optional
        // `body` leaf surface as `string | null` (present-null) instead of absent.
        // Issue 1's null body is present as null.
        ctx.mockNext([{ pid: 1, issues: [
            { title: 'Update hero copy', body: null },
            { title: 'Redesign navbar',  body: 'Use new tokens' },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:    tIssue.projectId,
                issues: ctx.conn.aggregateAsArray({ title: tIssue.title, body: tIssue.body })
                    .projectingOptionalValuesAsNullable(),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, json_arrayagg(json_object('title', title, 'body', body)) as issues from issue where project_id = ? group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ title: string; body: string | null }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.title.localeCompare(b.title)) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { title: 'Redesign navbar', body: 'Use new tokens' },
            { title: 'Update hero copy', body: null },
        ] }])
        // Issue 1's null body is PRESENT-NULL under the nullable projector.
        const issue1 = rows[0]!.issues.find(i => i.title === 'Update hero copy')!
        expect('body' in issue1).toBe(true)
    })
})
