// `groupByNonAggregatedColumns()` groups by every column of the select that
// is not an aggregate and refers to a table: constants and aggregates are
// left out, and each grouped column is referred to as a column of the select,
// like `groupBy('<name>')`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('group-by-non-aggregated-columns-skips-constants-and-aggregates', async () => {
        // Project 1 has priorities 2 and 1, project 2 has 3, project 3 has 2;
        // shifted by one.
        const expected = [
            { projectId: 1, level: 2, label: 'issues', issues: 1 },
            { projectId: 1, level: 3, label: 'issues', issues: 1 },
            { projectId: 2, level: 4, label: 'issues', issues: 1 },
            { projectId: 3, level: 3, label: 'issues', issues: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const rows = await connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                level:     tIssue.priority.add(1),
                label:     connection.const('issues', 'string'),
                issues:    connection.countAll(),
            })
            .groupByNonAggregatedColumns()
            .orderBy('projectId')
            .orderBy('level')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId", priority + $1 as level, $2 as label, count(*) as issues from issue group by project_id, priority + $1 order by "projectId", level"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "issues",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; level: number; label: string; issues: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('group-by-non-aggregated-columns-of-a-nested-object', async () => {
        const expected = [
            { project: { id: 1, name: 'Marketing site' }, issues: 2 },
            { project: { id: 2, name: 'Internal tools' }, issues: 1 },
            { project: { id: 3, name: 'Public API' }, issues: 1 },
        ]
        ctx.mockNext([
            { 'project.id': 1, 'project.name': 'Marketing site', issues: 2 },
            { 'project.id': 2, 'project.name': 'Internal tools', issues: 1 },
            { 'project.id': 3, 'project.name': 'Public API', issues: 1 },
        ])
        const connection = ctx.conn
        const rows = await connection.selectFrom(tIssue)
            .innerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .select({
                project: {
                    id:   tProject.id,
                    name: tProject.name,
                },
                issues: connection.countAll(),
            })
            .groupByNonAggregatedColumns()
            .orderBy('project.id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "project.id", project.name as "project.name", count(*) as issues from issue inner join project on project.id = issue.project_id group by project.id, project.name order by "project.id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ project: { id: number; name: string }; issues: number }>>>()
        expect(rows).toEqual(expected)
    })
})
