// Seam: an outer select carrying an `aggregateAsArray({...})` column AND a
// `.customizeQuery({...})` hook in the same query. Each is exhaustively covered
// alone, but never composed — this pins that the aggregate's column-forwarding
// (the `json_agg(json_build_object(...))` projection) coexists with the
// customize hook attachment (here a `beforeColumns` optimiser-hint fragment that
// splices in right after the SELECT keyword).
//
// Project 1 has issues 1 ('Update hero copy') and 2 ('Redesign navbar'); JSON
// aggregate order is engine-defined, so the array is sorted by id before
// comparing. Mocks are primed with the RAW aggregated rows.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('aggregate-as-array-with-customize-query-before-columns-hint', async () => {
        const connection = ctx.conn
        ctx.mockNext([{ pid: 1, issues: [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
        ] }])
        const rows = await connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:    tIssue.projectId,
                issues: connection.aggregateAsArray({ id: tIssue.id, title: tIssue.title }),
            })
            .groupBy('pid')
            .customizeQuery({
                beforeColumns: connection.rawFragment`/*+ tag(agg) */ `,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select /*+ tag(agg) */  project_id as pid, json_arrayagg(json_object('id', id, 'title', title)) as issues from issue where project_id = ? group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ id: number; title: string }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.id - b.id) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
        ] }])
    })
})
