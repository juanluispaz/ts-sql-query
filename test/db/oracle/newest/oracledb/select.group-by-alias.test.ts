// `groupBy('<alias>')` groups by a selected column without writing its
// expression again. When the expression carries a parameter (`priority + 1`),
// the grouping must still be the same expression the select list computes.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('group-by-alias-of-an-expression-with-a-parameter', async () => {
        // Priorities 2, 1, 3, 2 shifted by one: level 2 has one issue, level 3
        // two, level 4 one.
        const expected = [{ level: 2, issues: 1 }, { level: 3, issues: 2 }, { level: 4, issues: 1 }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const rows = await connection.selectFrom(tIssue)
            .select({
                level:  tIssue.priority.add(1),
                issues: connection.countAll(),
            })
            .groupBy('level')
            .orderBy('level')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select priority + :0 as "level", count(*) as "issues" from issue group by priority + :0 order by "level""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ level: number; issues: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('group-by-alias-of-an-expression-with-a-parameter-and-a-plain-column', async () => {
        // Per project, the issues of each shifted priority: project 1 has
        // priorities 2 and 1, project 2 has 3, project 3 has 2.
        const expected = [
            { projectId: 1, level: 2, issues: 1 },
            { projectId: 1, level: 3, issues: 1 },
            { projectId: 2, level: 4, issues: 1 },
            { projectId: 3, level: 3, issues: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const rows = await connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                level:     tIssue.priority.add(1),
                issues:    connection.countAll(),
            })
            .groupBy('projectId', 'level')
            .orderBy('projectId')
            .orderBy('level')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId", priority + :0 as "level", count(*) as "issues" from issue group by project_id, priority + :0 order by "projectId", "level""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; level: number; issues: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('group-by-alias-named-like-a-column-groups-by-the-expression', async () => {
        // The alias is also the name of a column of the table (`priority`): the
        // grouping is still the selected expression, priority modulo 2 —
        // priorities 2 and 2 give 0, priorities 1 and 3 give 1.
        const expected = [{ priority: 0, issues: 2 }, { priority: 1, issues: 2 }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const rows = await connection.selectFrom(tIssue)
            .select({
                priority: tIssue.priority.modulo(2),
                issues:   connection.countAll(),
            })
            .groupBy('priority')
            .orderBy('priority')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select mod(priority, :0) as "priority", count(*) as "issues" from issue group by mod(priority, :0) order by "priority""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ priority: number; issues: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('group-by-alias-of-an-expression-with-a-parameter-and-a-where-parameter', async () => {
        // The where carries its own parameter between the select list and the group
        // by. Issues 2, 3 and 4 have priorities 1, 3 and 2: shifted by ten, one issue
        // per level.
        const expected = [{ level: 11, issues: 1 }, { level: 12, issues: 1 }, { level: 13, issues: 1 }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const rows = await connection.selectFrom(tIssue)
            .where(tIssue.id.greaterThan(1))
            .select({
                level:  tIssue.priority.add(10),
                issues: connection.countAll(),
            })
            .groupBy('level')
            .orderBy('level')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select priority + :0 as "level", count(*) as "issues" from issue where id > :1 group by priority + :0 order by "level""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            10,
            1,
            10,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ level: number; issues: number }>>>()
        expect(rows).toEqual(expected)
    })
})
