// `having(columns => …)` refers to the columns of the select: each one is
// written as the same expression the select list computes (with the same
// parameters, or its alias where the database requires it), so a grouped
// expression that carries a parameter can be filtered in the having.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('having-on-a-grouped-expression-with-a-parameter', async () => {
        // Priorities 2, 1, 3, 2 shifted by one: level 3 has two issues, level 4
        // one, level 2 is filtered out.
        const expected = [{ level: 3, issues: 2 }, { level: 4, issues: 1 }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const rows = await connection.selectFrom(tIssue)
            .select({
                level:  tIssue.priority.add(1),
                issues: connection.countAll(),
            })
            .groupBy('level')
            .having(columns => columns.level.greaterThan(2))
            .orderBy('level')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select priority + ? as \`level\`, count(*) as issues from issue group by 1 having (\`level\`) > ? order by \`level\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ level: number; issues: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('having-on-an-aggregate-of-the-select', async () => {
        const expected = [{ level: 3, issues: 2 }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const rows = await connection.selectFrom(tIssue)
            .select({
                level:  tIssue.priority.add(1),
                issues: connection.countAll(),
            })
            .groupBy('level')
            .having(columns => columns.issues.greaterThan(1))
            .orderBy('level')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select priority + ? as \`level\`, count(*) as issues from issue group by 1 having issues > ? order by \`level\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ level: number; issues: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('having-on-columns-of-a-nested-object', async () => {
        // Level 4 is the only one above 2 with a single issue.
        const expected = [{ group: { level: 4 }, issues: 1 }]
        ctx.mockNext([{ 'group.level': 4, issues: 1 }])
        const connection = ctx.conn
        const rows = await connection.selectFrom(tIssue)
            .select({
                group:  { level: tIssue.priority.add(1) },
                issues: connection.countAll(),
            })
            .groupByNonAggregatedColumns()
            .having(columns => columns.group.level.greaterThan(2).and(columns.issues.equals(1)))
            .orderBy('group.level')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select priority + ? as \`group.level\`, count(*) as issues from issue group by 1 having (\`group.level\`) > ? and issues = ? order by \`group.level\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ group: { level: number }; issues: number }>>>()
        expect(rows).toEqual(expected)
    })
})
