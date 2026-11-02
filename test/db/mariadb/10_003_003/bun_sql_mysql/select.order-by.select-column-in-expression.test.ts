// `orderBy('<column of the select>', mode)` with a mode that wraps the column in an
// expression: the insensitive `lower(...)` / `collate`, or the null check that emulates
// `nulls first` / `nulls last`. The column of the select is named like a different column
// of the table, so the ordering must use the value of the select, not that column. In the
// last tests no declared column of the table has its name; the table may still have one, so
// they are written the same way.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('order-by-insensitive-a-column-named-like-a-different-column', async () => {
        // The column named `title` is the status: closed (4), in_progress (2), open (1 and 3).
        // Ordered by the title of the issue, it would be 4, 3, 2, 1.
        const expected = [
            { id: 4, title: 'closed' },
            { id: 2, title: 'in_progress' },
            { id: 1, title: 'open' },
            { id: 3, title: 'open' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.status })
            .orderBy('title', 'insensitive')
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, status as title from issue order by lower(status), id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; title: string }>>>()
        expect(result).toEqual(expected)
    })

    test('order-by-asc-nulls-last-a-column-named-like-a-different-column', async () => {
        // The column named `title` is the body, which only issues 2 and 4 have; the title of
        // the issue is never null.
        const expected = [
            { id: 4, title: 'See ADR-014' },
            { id: 2, title: 'Use new tokens' },
            { id: 1 },
            { id: 3 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.body })
            .orderBy('title', 'asc nulls last')
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`body\` as title from issue order by \`body\` is null, title asc, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; title?: string }>>>()
        expect(result).toEqual(expected)
    })

    test('order-by-desc-nulls-first-insensitive-a-column-named-like-a-different-column', async () => {
        // The same body: the issues without one first, then the bodies descending.
        const expected = [
            { id: 1 },
            { id: 3 },
            { id: 2, title: 'Use new tokens' },
            { id: 4, title: 'See ADR-014' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.body })
            .orderBy('title', 'desc nulls first insensitive')
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`body\` as title from issue order by \`body\` is not null, lower(\`body\`) desc, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; title?: string }>>>()
        expect(result).toEqual(expected)
    })

    test('order-by-insensitive-a-grouped-column-with-a-parameter', async () => {
        // Grouped by the status followed by '!': closed (1 issue), in_progress (1), open (2).
        const expected = [
            { title: 'closed!', issues: 1 },
            { title: 'in_progress!', issues: 1 },
            { title: 'open!', issues: 2 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ title: tIssue.status.concat('!'), issues: ctx.conn.countAll() })
            .groupByNonAggregatedColumns()
            .orderBy('title', 'insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select concat(status, ?) as title, count(*) as issues from issue group by 1 order by lower(concat(status, ?))"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "!",
            "!",
          ]
        `)
        assertType<Exact<typeof result, Array<{ title: string; issues: number }>>>()
        expect(result).toEqual(expected)
    })

    test('order-by-asc-nulls-last-a-grouped-column-with-a-parameter', async () => {
        // Grouped by the first three letters of the body: 'See' (issue 4), 'Use' (issue 2) and
        // the two issues without a body.
        const expected = [
            { title: 'See', issues: 1 },
            { title: 'Use', issues: 1 },
            { issues: 2 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ title: tIssue.body.substr(0, 3), issues: ctx.conn.countAll() })
            .groupByNonAggregatedColumns()
            .orderBy('title', 'asc nulls last')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select substr(\`body\`, ?, ?) as title, count(*) as issues from issue group by 1 order by substr(\`body\`, ?, ?) is null, title asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
            1,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ title?: string; issues: number }>>>()
        expect(result).toEqual(expected)
    })

    test('order-by-insensitive-a-grouped-column-with-a-parameter-named-like-no-column', async () => {
        // Grouped by the status followed by '!': closed (1 issue), in_progress (1), open (2).
        const expected = [
            { heading: 'closed!', issues: 1 },
            { heading: 'in_progress!', issues: 1 },
            { heading: 'open!', issues: 2 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ heading: tIssue.status.concat('!'), issues: ctx.conn.countAll() })
            .groupByNonAggregatedColumns()
            .orderBy('heading', 'insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select concat(status, ?) as heading, count(*) as issues from issue group by 1 order by lower(concat(status, ?))"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "!",
            "!",
          ]
        `)
        assertType<Exact<typeof result, Array<{ heading: string; issues: number }>>>()
        expect(result).toEqual(expected)
    })

    test('order-by-asc-nulls-last-a-grouped-column-with-a-parameter-named-like-no-column', async () => {
        // Grouped by the first three letters of the body: 'See' (issue 4), 'Use' (issue 2) and
        // the two issues without a body.
        const expected = [
            { heading: 'See', issues: 1 },
            { heading: 'Use', issues: 1 },
            { issues: 2 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ heading: tIssue.body.substr(0, 3), issues: ctx.conn.countAll() })
            .groupByNonAggregatedColumns()
            .orderBy('heading', 'asc nulls last')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select substr(\`body\`, ?, ?) as heading, count(*) as issues from issue group by 1 order by substr(\`body\`, ?, ?) is null, heading asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
            1,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ heading?: string; issues: number }>>>()
        expect(result).toEqual(expected)
    })
})
