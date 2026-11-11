// Behavioral coverage of `connection.anyValue(...)` (SQL:2023 `any_value`):
// any value of the group, for a column that is not grouped. It returns
// `optional` because an empty set aggregates to NULL.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('any-value-of-a-column-that-is-not-grouped', async () => {
        // Every issue of a project joins the same project row, so the name is
        // the same in the whole group.
        const expected = [
            { projectId: 1, projectName: 'Marketing site', issues: 2 },
            { projectId: 2, projectName: 'Internal tools', issues: 1 },
            { projectId: 3, projectName: 'Public API', issues: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const rows = await connection.selectFrom(tIssue)
            .innerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .select({
                projectId:   tIssue.projectId,
                projectName: connection.anyValue(tProject.name),
                issues:      connection.countAll(),
            })
            .groupBy('projectId')
            .orderBy('projectId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.project_id as projectId, any_value(project.name) as projectName, count(*) as issues from issue inner join project on project.id = issue.project_id group by issue.project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ projectId: number; projectName?: string; issues: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('any-value-of-an-expression-used-in-another-expression', async () => {
        // Priorities 1, 2 and 3, shifted by one and doubled.
        const expected = [
            { priority: 1, doubled: 4, issues: 1 },
            { priority: 2, doubled: 6, issues: 2 },
            { priority: 3, doubled: 8, issues: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const rows = await connection.selectFrom(tIssue)
            .select({
                priority: tIssue.priority,
                doubled:  connection.anyValue(tIssue.priority.add(1)).multiply(2),
                issues:   connection.countAll(),
            })
            .groupBy('priority')
            .orderBy('priority')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select priority as priority, any_value(priority + ?) * ? as doubled, count(*) as issues from issue group by priority order by priority"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ priority: number; doubled?: number; issues: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('any-value-of-a-constant', async () => {
        const expected = { total: 4, five: 5 }
        ctx.mockNext(expected)
        const connection = ctx.conn
        const row = await connection.selectFrom(tIssue)
            .select({
                total: connection.countAll(),
                five:  connection.anyValue(connection.const(5, 'int')),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as total, any_value(?) as five from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
          ]
        `)
        assertType<Exact<typeof row, { total: number; five?: number }>>()
        expect(row).toEqual(expected)
    })
})
