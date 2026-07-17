// Behavioral coverage of the remaining ORDER BY modes. The existing
// select.order-by-limit-offset.test.ts exercises only `desc` and
// `asc nulls last`; this file covers the other 10 modes accepted by the
// public OrderByMode union, each dialect rendering them differently.
//
// Insensitive variants depend on the runtime collation, so the result
// order is not asserted — the focus is the emitted SQL.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })


    test('order-by-asc', async () => {
        // The `'asc'` mode — the 13th and last OrderByMode, reached elsewhere only
        // implicitly (a bare `orderBy(col)` defaults to ascending). Passing 'asc'
        // through the mode-arg overload emits the explicit `asc` keyword. Ordered
        // by the non-null id so the result order is deterministic on every dialect.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy('id', 'asc')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('order-by-asc-nulls-first', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, assigneeId: tIssue.assigneeId })
            .orderBy('assigneeId', 'asc nulls first')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, assignee_id as assigneeId from issue order by assigneeId asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-desc-nulls-first', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, assigneeId: tIssue.assigneeId })
            .orderBy('assigneeId', 'desc nulls first')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, assignee_id as assigneeId from issue order by assigneeId is not null, assigneeId desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-desc-nulls-last', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, assigneeId: tIssue.assigneeId })
            .orderBy('assigneeId', 'desc nulls last')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, assignee_id as assigneeId from issue order by assigneeId desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy('title', 'insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by lower(title)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-asc-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy('title', 'asc insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by lower(title) asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-desc-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy('title', 'desc insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by lower(title) desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-asc-nulls-first-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy('title', 'asc nulls first insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by lower(title) asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-asc-nulls-last-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy('title', 'asc nulls last insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by title is null, lower(title) asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-desc-nulls-first-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy('title', 'desc nulls first insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by title is not null, lower(title) desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-desc-nulls-last-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy('title', 'desc nulls last insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by lower(title) desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-raw-fragment', async () => {
        // The `orderBy(rawFragment)` overload — a typed ORDER BY entry point
        // that takes an arbitrary `IRawFragment` rather than a column name or
        // ValueSource. The raw fragment embeds the ordering keyword inline
        // (`<id> desc`), so the builder splices it verbatim into the ORDER BY
        // list. Ordered by id
        // descending: 4, 3, 2, 1.
        const expected = [{ id: 4 }, { id: 3 }, { id: 2 }, { id: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy(ctx.conn.rawFragment`${tIssue.id} desc`)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by issue.id desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('order-by-aggregate-value-source', async () => {
        // `orderBy(<aggregate value source>)` on a grouped query (`order by count(id) desc`).
        // Statuses grouped: open {1,3} → 2, closed {4} → 1, in_progress {2} → 1. Ordered by the
        // count descending, with a `status` secondary key to break the 1-count tie.
        const expected = [
            { status: 'open', cnt: 2 },
            { status: 'closed', cnt: 1 },
            { status: 'in_progress', cnt: 1 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ status: tIssue.status, cnt: ctx.conn.count(tIssue.id) })
            .groupBy('status')
            .orderBy(ctx.conn.count(tIssue.id), 'desc')
            .orderBy('status')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`status\` as \`status\`, count(id) as cnt from issue group by \`status\` order by count(issue.id) desc, \`status\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ status: string; cnt: number }>>>()
        expect(result).toEqual(expected)
    })

    test('order-by-value-source-column-desc', async () => {
        // `orderBy(<value source>, mode)` with a plain COLUMN value source
        // rather than a projected property name — the builder renders the
        // column's full expression (`issue.priority`), not the result alias
        // (`priority`). Priorities: issue 1 -> 2, issue 2 -> 1, issue 3 -> 3,
        // issue 4 -> 2. Ordered by priority desc, then id asc as the tiebreaker.
        const expected = [
            { id: 3, priority: 3 },
            { id: 1, priority: 2 },
            { id: 4, priority: 2 },
            { id: 2, priority: 1 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                id:       tIssue.id,
                priority: tIssue.priority,
            })
            .orderBy(tIssue.priority, 'desc')
            .orderBy(tIssue.id, 'asc')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as priority from issue order by issue.priority desc, issue.id asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; priority: number }>>>()
        expect(result).toEqual(expected)
    })

    test('order-by-value-source-column-asc-nulls-last', async () => {
        // `orderBy(<value source>, 'asc nulls last')` — the value-source overload
        // carrying a nulls-placement mode. assignee_id: issue 1 -> 1, issue 2 -> 2,
        // issue 3 -> NULL, issue 4 -> 3. Nulls sort last, id asc breaks ties.
        // Issue 3's null assignee_id is stripped from the result row.
        const expected = [
            { id: 1, assigneeId: 1 },
            { id: 2, assigneeId: 2 },
            { id: 4, assigneeId: 3 },
            { id: 3, assigneeId: undefined },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                id:         tIssue.id,
                assigneeId: tIssue.assigneeId,
            })
            .orderBy(tIssue.assigneeId, 'asc nulls last')
            .orderBy(tIssue.id, 'asc')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, assignee_id as assigneeId from issue order by issue.assignee_id is null, issue.assignee_id asc, issue.id asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; assigneeId?: number }>>>()
        expect(result).toEqual(expected)
    })

    test('order-by-value-source-column-asc-nulls-first', async () => {
        // `orderBy(<value source>, 'asc nulls first')` — nulls sort first, then
        // ascending. assignee_id: issue 1 -> 1, issue 2 -> 2, issue 3 -> NULL,
        // issue 4 -> 3. Issue 3's null assignee_id is stripped from the row.
        const expected = [
            { id: 3, assigneeId: undefined },
            { id: 1, assigneeId: 1 },
            { id: 2, assigneeId: 2 },
            { id: 4, assigneeId: 3 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, assigneeId: tIssue.assigneeId })
            .orderBy(tIssue.assigneeId, 'asc nulls first')
            .orderBy(tIssue.id, 'asc')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, assignee_id as assigneeId from issue order by issue.assignee_id asc, issue.id asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; assigneeId?: number }>>>()
        expect(result).toEqual(expected)
    })

    test('order-by-value-source-column-desc-nulls-first', async () => {
        // `orderBy(<value source>, 'desc nulls first')` — nulls sort first, then
        // descending. Nulls (issue 3) lead, then 3, 2, 1.
        const expected = [
            { id: 3, assigneeId: undefined },
            { id: 4, assigneeId: 3 },
            { id: 2, assigneeId: 2 },
            { id: 1, assigneeId: 1 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, assigneeId: tIssue.assigneeId })
            .orderBy(tIssue.assigneeId, 'desc nulls first')
            .orderBy(tIssue.id, 'asc')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, assignee_id as assigneeId from issue order by issue.assignee_id is not null, issue.assignee_id desc, issue.id asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; assigneeId?: number }>>>()
        expect(result).toEqual(expected)
    })

    test('order-by-value-source-column-desc-nulls-last', async () => {
        // `orderBy(<value source>, 'desc nulls last')` — descending, nulls last.
        // 3, 2, 1, then the null assignee_id (issue 3) trails.
        const expected = [
            { id: 4, assigneeId: 3 },
            { id: 2, assigneeId: 2 },
            { id: 1, assigneeId: 1 },
            { id: 3, assigneeId: undefined },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, assigneeId: tIssue.assigneeId })
            .orderBy(tIssue.assigneeId, 'desc nulls last')
            .orderBy(tIssue.id, 'asc')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, assignee_id as assigneeId from issue order by issue.assignee_id desc, issue.id asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; assigneeId?: number }>>>()
        expect(result).toEqual(expected)
    })

    test('order-by-value-source-column-insensitive', async () => {
        // `orderBy(<value source>, 'insensitive')` — the value-source overload
        // renders the full column expression, wrapped by the dialect's
        // case-insensitive ordering. Collation-dependent, so only the SQL is
        // asserted.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy(tIssue.title, 'insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by lower(issue.title)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-value-source-column-asc-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy(tIssue.title, 'asc insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by lower(issue.title) asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-value-source-column-desc-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy(tIssue.title, 'desc insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by lower(issue.title) desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-value-source-column-asc-nulls-first-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy(tIssue.title, 'asc nulls first insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by lower(issue.title) asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-value-source-column-asc-nulls-last-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy(tIssue.title, 'asc nulls last insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by issue.title is null, lower(issue.title) asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-value-source-column-desc-nulls-first-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy(tIssue.title, 'desc nulls first insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by issue.title is not null, lower(issue.title) desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-value-source-column-desc-nulls-last-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy(tIssue.title, 'desc nulls last insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by lower(issue.title) desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-raw-fragment-plain-desc-mode', async () => {
        // The `orderBy(rawFragment, mode)` overload on the PLAIN select builder — the
        // direction is passed as the `mode` argument, not embedded in the fragment.
        // priorities: 1->2,
        // 2->1, 3->3, 4->2. Ordered by priority desc with id asc as the tiebreaker.
        const expected = [{ id: 3 }, { id: 1 }, { id: 4 }, { id: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy(ctx.conn.rawFragment`${tIssue.priority}`, 'desc')
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by issue.priority desc, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('order-by-raw-fragment-insensitive-mode', async () => {
        // The `orderBy(rawFragment, mode)` overload carrying an INSENSITIVE mode. The
        // builder only wraps the entry in `lower(...)` / `collate` when it can identify
        // it as a string column; a raw fragment is opaque, so the insensitive term
        // renders nothing extra and the bare fragment is emitted with just the
        // direction. Titles: 1 'Update hero copy', 2 'Redesign navbar', 3 'Migrate to
        // ESM', 4 'Document /v2/users'. Ordered ascending: Document (4), Migrate (3),
        // Redesign (2), Update (1).
        const expected = [{ id: 4 }, { id: 3 }, { id: 2 }, { id: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy(ctx.conn.rawFragment`${tIssue.title}`, 'asc insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by issue.title asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('order-by-raw-fragment-nulls-mode', async () => {
        // The `orderBy(rawFragment, mode)` overload carrying a NULLS-placement mode:
        // pins how the builder renders nulls-last over a raw fragment. assignee_id: 1
        // -> 1, 2 -> 2, 3 -> NULL, 4 -> 3. Ordered ascending with nulls last, id asc
        // as the tiebreaker: issue 1, 2, 4, then issue 3 (null) last.
        const expected = [{ id: 1 }, { id: 2 }, { id: 4 }, { id: 3 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy(ctx.conn.rawFragment`${tIssue.assigneeId}`, 'asc nulls last')
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by issue.assignee_id is null, issue.assignee_id asc, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })
})
