// Coverage of the column-map propagation walk in the value-as-array
// aggregates that the other aggregate-as-array tests miss: a deeply-nested
// column map, a non-leaf expression operand, and the two factory paths
// into the NULL variant (onlyWhenOrNull(false) / ignoreWhenAsNull(true)).
//
// the array aggregate has no ORDER BY, so the array order is not deterministic on the
// real engine — value assertions sort the array before comparing.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('aggregate-as-array-with-deeply-nested-map-recurses-propagation', async () => {
        // `aggregateAsArray({ issue: { id, title } })` lands a two-level
        // nested column map, so the propagation walk recurses before
        // reaching the leaf columns.
        ctx.mockNext([{
            pid: 1,
            issues: [
                { issue: { id: 1, title: 'Update hero copy' } },
                { issue: { id: 2, title: 'Redesign navbar' } },
            ],
        }])

        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid: tProject.id,
                issues: ctx.conn.aggregateAsArray({
                    issue: { id: tIssueLeft.id, title: tIssueLeft.title },
                }),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "pid", json_arrayagg(json_object('issue.id' value issue.id, 'issue.title' value issue.title)) as "issues" from project left join issue on issue.project_id = project.id where project.id = :0 group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            issues: Array<{ issue?: { id: number; title: string } | null }>
            pid:    number
        }>>>()
        expect(rows.map(r => ({
            pid: r.pid,
            issues: [...r.issues].sort((a, b) => a.issue!.id - b.issue!.id),
        }))).toEqual([{
            pid: 1,
            issues: [
                { issue: { id: 1, title: 'Update hero copy' } },
                { issue: { id: 2, title: 'Redesign navbar' } },
            ],
        }])
    })

    test('aggregate-as-array-of-one-column-with-expression-fires-case-2', async () => {
        // `aggregateAsArrayOfOneColumn(tIssue.priority.add(1))` passes a
        // non-leaf value source (an expression) instead of a bare column.
        // project 1 issues: priority 2 and 1 → bumped 3 and 2.
        ctx.mockNext([{ pid: 1, bumped: [3, 2] }])

        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid:    tProject.id,
                bumped: ctx.conn.aggregateAsArrayOfOneColumn(tIssueLeft.priority.add(1)),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "pid", json_arrayagg(issue.priority + :0) as "bumped" from project left join issue on issue.project_id = project.id where project.id = :1 group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            bumped: Array<number>
        }>>>()
        expect(rows.map(r => ({ pid: r.pid, bumped: [...r.bumped].sort((a, b) => a - b) })))
            .toEqual([{ pid: 1, bumped: [2, 3] }])
    })

    test('aggregate-as-array-with-only-when-or-null-false-uses-null-variant', async () => {
        // `onlyWhenOrNull(false)` swaps in the NULL variant, so the
        // column emits literal `null` and the projected object is absent.
        ctx.mockNext([{ pid: 1, issues: null }])

        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid:    tProject.id,
                issues: ctx.conn.aggregateAsArray({
                    id:    tIssueLeft.id,
                    title: tIssueLeft.title,
                }).onlyWhenOrNull(false),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "pid", null as "issues" from project left join issue on issue.project_id = project.id where project.id = :0 group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues?: Array<{ id: number; title: string }>
        }>>>()
        expect(rows).toEqual([{ pid: 1 }])
    })

    test('aggregate-as-array-with-ignore-when-as-null-true-also-uses-null-variant', async () => {
        // `ignoreWhenAsNull(true)` is the sibling factory for the NULL
        // variant; same emitted `null as issues`.
        ctx.mockNext([{ pid: 1, issues: null }])

        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid:    tProject.id,
                issues: ctx.conn.aggregateAsArray({
                    id:    tIssueLeft.id,
                    title: tIssueLeft.title,
                }).ignoreWhenAsNull(true),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "pid", null as "issues" from project left join issue on issue.project_id = project.id where project.id = :0 group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues?: Array<{ id: number; title: string }>
        }>>>()
        expect(rows).toEqual([{ pid: 1 }])
    })
})
