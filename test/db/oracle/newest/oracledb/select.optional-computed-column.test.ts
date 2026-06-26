// Coverage of `optionalComputedColumn` (Table). `tProjectRelease.notes` is a
// REQUIRED `computedColumn`; this pins the OPTIONAL sibling on
// `tIssueWorklog.activityLabel` — a NULLABLE DB-computed column. It asserts:
//
//   - the OPTIONAL projection: a NULL value surfaces as an absent key.
//   - the WRITABLE-shape exclusion: it appears in ColumnKeys (a column) but
//     NOT in WritableColumnKeys (computed columns can't be written), against a
//     non-empty writable surface.
//
// The DB computes activity_label as `UPPER(activity)` when the worklog logged
// time (minutes set), NULL otherwise: worklog 1 (90 min) → 'CODING', worklog 2
// (NULL min) → NULL, worklog 3 (30 min) → 'MEETING'.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { ColumnKeys, WritableColumnKeys } from '../../../../../src/extras/types.js'
import { tIssueWorklog } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('optional-computed-column-projects-as-optional-and-is-non-writable', async () => {
        const expected = [
            { id: 1, label: 'CODING' },
            { id: 2 },
            { id: 3, label: 'MEETING' },
        ]
        ctx.mockNext([{ id: 1, label: 'CODING' }, { id: 2, label: null }, { id: 3, label: 'MEETING' }])
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .select({ id: tIssueWorklog.id, label: tIssueWorklog.activityLabel })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", activity_label as "label" from issue_worklog order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; label?: string }>>>()
        expect(rows).toEqual(expected)

        // activity_label appears in ColumnKeys (it is a column)…
        assertType<Exact<ColumnKeys<typeof tIssueWorklog>,
            'id' | 'issueId' | 'workDate' | 'startedAt' | 'minutes' | 'durationMs'
            | 'billable' | 'approved' | 'activity'
            | 'activityUpper' | 'activityTagged' | 'activityLabel'>>()
        // …but NOT in WritableColumnKeys (computed/virtual columns are excluded
        // from the writable surface, which is otherwise non-empty).
        assertType<Exact<WritableColumnKeys<typeof tIssueWorklog>,
            'id' | 'issueId' | 'workDate' | 'startedAt' | 'minutes' | 'durationMs'
            | 'billable' | 'approved' | 'activity'>>()
    })
})
