// `having(columns => …)` refers to the columns of the select: each one is
// written as the same expression the select list computes (with the same
// parameters, or its alias where the database requires it), so a grouped
// expression that carries a parameter can be filtered in the having.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select priority + ? as \`level\`, count(*) as issues from issue group by 1 having \`level\` > ? order by \`level\`"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select priority + ? as \`group.level\`, count(*) as issues from issue group by 1 having \`group.level\` > ? and issues = ? order by \`group.level\`"`)
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

    test('having-on-a-grouped-column-referred-to-by-its-own-name', async () => {
        // Priorities 2, 1, 3, 2: the groups above 1.
        const expected = [{ priority: 2, issues: 2 }, { priority: 3, issues: 1 }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const rows = await connection.selectFrom(tIssue)
            .select({
                priority: tIssue.priority,
                issues:   connection.countAll(),
            })
            .groupBy('priority')
            .having(columns => columns.priority.greaterThan(1))
            .orderBy('priority')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select priority as priority, count(*) as issues from issue group by priority having priority > ? order by priority"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ priority: number; issues: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('having-on-a-column-named-like-a-different-column-of-the-group-by', async () => {
        // Grouped by the priority; the column of the select named `priority` is the priority
        // modulo 2. In the having, MySQL takes the name `priority` as the column of the group by,
        // not as the column of the select, and would silently filter by the priority, so it is
        // refused before anything is sent.
        const connection = ctx.conn
        let caught: unknown
        try {
            await connection.selectFrom(tIssue)
                .select({
                    priority: tIssue.priority.modulo(2),
                    issues:   connection.countAll(),
                })
                .groupBy(tIssue.priority)
                .having(columns => columns.priority.equals(0))
                .executeSelectMany()
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(TsSqlError)
        expect((caught as TsSqlError).errorReason).toEqual({ reason: 'HAVING_COLUMN_SHADOWED_BY_GROUP_BY_COLUMN', column: 'priority' })
        expect(ctx.history).toEqual([])
    })
})
