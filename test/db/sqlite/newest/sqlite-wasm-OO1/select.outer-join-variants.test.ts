// Outer-join variants
// that the existing `select.join.test.ts` does not exercise:
//
//   - `.leftOuterJoin(...)`       — emits `LEFT OUTER JOIN` (the
//     SQL-standard spelling) instead of the abbreviated `LEFT JOIN`
// that `.leftJoin(...)` produces..
//   - `.optionalLeftJoin(...)`    — only renders the join when at
//     least one column from the joined source is referenced in the
// final SELECT / WHERE / ORDER BY..
//   - `.optionalLeftOuterJoin(...)` — same dependency-elimination
// logic with `LEFT OUTER JOIN` keyword..
//
// `.optionalInnerJoin(...)` is already covered by
// `docs.extreme-dynamic-queries.test.ts`.
//
// The "elided" snapshots (where the optional join produces no FROM
// fragment at all) are the main signal — they pin the eliminator
// path through `_buildSelectFromAndJoins` and confirm the join
// drops cleanly when nothing references it.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tIssueWorklog, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('left-outer-join-emits-left-outer-join-keyword', async () => {
        // `.leftOuterJoin(...)` should emit the verbose
        // `LEFT OUTER JOIN` spelling. Issue id=3 has assigneeId NULL
        // and stays in the result with the joined columns elided.
        const expected = [
            { id: 1, assigneeName: 'Ada Lovelace' },
            { id: 2, assigneeName: 'Grace Hopper' },
            { id: 3 },
            { id: 4, assigneeName: 'Alan Turing' },
        ]
        ctx.mockNext([
            { id: 1, assigneeName: 'Ada Lovelace' },
            { id: 2, assigneeName: 'Grace Hopper' },
            { id: 3, assigneeName: null },
            { id: 4, assigneeName: 'Alan Turing' },
        ])
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .leftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:           tIssue.id,
                assigneeName: assignee.fullName,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, app_user.full_name as assigneeName from issue left outer join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{
            id:            number
            assigneeName?: string
        }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-join-is-elided-when-unused', async () => {
        // No projection / where / orderBy references `assignee`, so
        // the eliminator drops the `LEFT JOIN` entirely. The emitted
        // SQL should be a plain `SELECT id FROM issue ORDER BY id`.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id: tIssue.id,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-join-is-emitted-when-referenced', async () => {
        // The same builder, but `assignee.fullName` is referenced in
        // the projection — the eliminator now keeps the join.
        const expected = [
            { id: 1, assigneeName: 'Ada Lovelace' },
            { id: 2, assigneeName: 'Grace Hopper' },
            { id: 3 },
            { id: 4, assigneeName: 'Alan Turing' },
        ]
        ctx.mockNext([
            { id: 1, assigneeName: 'Ada Lovelace' },
            { id: 2, assigneeName: 'Grace Hopper' },
            { id: 3, assigneeName: null },
            { id: 4, assigneeName: 'Alan Turing' },
        ])
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:           tIssue.id,
                assigneeName: assignee.fullName,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, app_user.full_name as assigneeName from issue left join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{
            id:            number
            assigneeName?: string
        }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-outer-join-emits-verbose-keyword-when-referenced', async () => {
        // `.optionalLeftOuterJoin(...)` keeps the verbose
        // `LEFT OUTER JOIN` spelling when the eliminator decides to
        // include it.
        const expected = [
            { id: 1, assigneeName: 'Ada Lovelace' },
            { id: 2, assigneeName: 'Grace Hopper' },
            { id: 3 },
            { id: 4, assigneeName: 'Alan Turing' },
        ]
        ctx.mockNext([
            { id: 1, assigneeName: 'Ada Lovelace' },
            { id: 2, assigneeName: 'Grace Hopper' },
            { id: 3, assigneeName: null },
            { id: 4, assigneeName: 'Alan Turing' },
        ])
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:           tIssue.id,
                assigneeName: assignee.fullName,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, app_user.full_name as assigneeName from issue left outer join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{
            id:            number
            assigneeName?: string
        }>>>()
        expect(result).toEqual(expected)
    })
    test('optional-left-outer-join-is-elided-when-unused', async () => {
        // The ELIDED branch of `.optionalLeftOuterJoin(...)`: no projection / where /
        // orderBy references `assignee`, so the eliminator drops the join entirely —
        // byte-identical to the `optionalLeftJoin` elided snapshot (the verbose keyword
        // only shows when the join is kept).
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id: tIssue.id,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-outer-join-kept-by-true-when-no-value-over-a-joined-column', async () => {
        const expected = [{ id: 1, isAda: true }, { id: 2, isAda: false }, { id: 3 }, { id: 4, isAda: false }]
        ctx.mockNext([{ id: 1, isAda: true }, { id: 2, isAda: false }, { id: 3, isAda: null }, { id: 4, isAda: false }])
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:    tIssue.id,
                isAda: assignee.fullName.equalsIfValue('Ada Lovelace').trueWhenNoValue(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, app_user.full_name = ?1 as isAda from issue left outer join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Ada Lovelace",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; isAda?: boolean }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-outer-join-kept-by-value-when-no-value-over-a-joined-column', async () => {
        // No title filter is given, so the condition falls back to the assignee's
        // email. Issue 3 has no assignee: the fallback is null there and the key
        // is absent.
        const expected = [{ id: 1, matches: true }, { id: 2, matches: false }, { id: 3 }, { id: 4, matches: false }]
        ctx.mockNext([{ id: 1, matches: true }, { id: 2, matches: false }, { id: 3, matches: null }, { id: 4, matches: false }])
        const assignee = tAppUser.forUseInLeftJoin()
        const titleFilter: string | null = null
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:      tIssue.id,
                matches: tIssue.title.equalsIfValue(titleFilter).valueWhenNoValue(assignee.email.equals('ada@acme.test')),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, app_user.email = ?1 as matches from issue left outer join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ada@acme.test",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; matches?: boolean }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-outer-join-kept-by-to-lower-case-over-a-joined-column', async () => {
        const expected = [
            { id: 1, assignee: 'ada lovelace' },
            { id: 2, assignee: 'grace hopper' },
            { id: 3 },
            { id: 4, assignee: 'alan turing' },
        ]
        ctx.mockNext([
            { id: 1, assignee: 'ada lovelace' },
            { id: 2, assignee: 'grace hopper' },
            { id: 3, assignee: null },
            { id: 4, assignee: 'alan turing' },
        ])
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:       tIssue.id,
                assignee: assignee.fullName.toLowerCase(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, lower(app_user.full_name) as assignee from issue left outer join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; assignee?: string }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-outer-join-kept-by-collate-over-a-joined-column', async () => {
        const expected = [
            { id: 1, assignee: 'Ada Lovelace' },
            { id: 2, assignee: 'Grace Hopper' },
            { id: 3 },
            { id: 4, assignee: 'Alan Turing' },
        ]
        ctx.mockNext([
            { id: 1, assignee: 'Ada Lovelace' },
            { id: 2, assignee: 'Grace Hopper' },
            { id: 3, assignee: null },
            { id: 4, assignee: 'Alan Turing' },
        ])
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:       tIssue.id,
                assignee: assignee.fullName.collate('BINARY'),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, app_user.full_name collate BINARY as assignee from issue left outer join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; assignee?: string }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-outer-join-kept-by-is-null-over-a-joined-column', async () => {
        // The left join misses on issue 3, so its assignee name reads as NULL.
        const expected = [
            { id: 1, unassigned: false },
            { id: 2, unassigned: false },
            { id: 3, unassigned: true },
            { id: 4, unassigned: false },
        ]
        ctx.mockNext(expected)
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:         tIssue.id,
                unassigned: assignee.fullName.isNull(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, app_user.full_name is null as unassigned from issue left outer join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; unassigned: boolean }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-outer-join-kept-by-value-when-null-with-a-joined-column-operand', async () => {
        // The body falls back to the assignee name: issues 1 and 3 have no body,
        // and issue 3 has no assignee either.
        const expected = [
            { id: 1, summary: 'Ada Lovelace' },
            { id: 2, summary: 'Use new tokens' },
            { id: 3 },
            { id: 4, summary: 'See ADR-014' },
        ]
        ctx.mockNext([
            { id: 1, summary: 'Ada Lovelace' },
            { id: 2, summary: 'Use new tokens' },
            { id: 3, summary: null },
            { id: 4, summary: 'See ADR-014' },
        ])
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:      tIssue.id,
                summary: tIssue.body.valueWhenNull(assignee.fullName),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, ifnull(issue.body, app_user.full_name) as summary from issue left outer join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; summary?: string }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-outer-join-kept-by-is-with-a-joined-column-operand', async () => {
        // `is` is null-safe: issue 3 (no assignee, join miss) compares NULL with NULL → true.
        const expected = [
            { id: 1, joined: true },
            { id: 2, joined: true },
            { id: 3, joined: true },
            { id: 4, joined: true },
        ]
        ctx.mockNext(expected)
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:     tIssue.id,
                joined: tIssue.assigneeId.is(assignee.id),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.assignee_id is app_user.id as joined from issue left outer join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; joined: boolean }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-outer-join-kept-by-in-if-value-over-a-joined-column', async () => {
        const expected = [{ id: 1, watched: true }, { id: 2, watched: false }, { id: 3 }, { id: 4, watched: true }]
        ctx.mockNext([{ id: 1, watched: true }, { id: 2, watched: false }, { id: 3, watched: null }, { id: 4, watched: true }])
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:      tIssue.id,
                watched: assignee.id.inIfValue([1, 3]).trueWhenNoValue(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, app_user.id in (?1, ?2) as watched from issue left outer join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; watched?: boolean }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-outer-join-kept-by-between-with-a-joined-column-bound', async () => {
        // issue id between the assignee id and 3: 1 ∈ [1,3], 2 ∈ [2,3], 4 ∉ [3,3].
        const expected = [{ id: 1, inRange: true }, { id: 2, inRange: true }, { id: 3 }, { id: 4, inRange: false }]
        ctx.mockNext([{ id: 1, inRange: true }, { id: 2, inRange: true }, { id: 3, inRange: null }, { id: 4, inRange: false }])
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:      tIssue.id,
                inRange: tIssue.id.between(assignee.id, 3),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.id between app_user.id and ?1 as inRange from issue left outer join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; inRange?: boolean }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-outer-join-kept-by-replace-all-if-value-over-a-joined-column', async () => {
        // The acme test domain is shortened in the assignee email; other domains stay.
        const expected = [
            { id: 1, login: 'ada@acme' },
            { id: 2, login: 'grace@acme' },
            { id: 3 },
            { id: 4, login: 'alan@globex.test' },
        ]
        ctx.mockNext([
            { id: 1, login: 'ada@acme' },
            { id: 2, login: 'grace@acme' },
            { id: 3, login: null },
            { id: 4, login: 'alan@globex.test' },
        ])
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:    tIssue.id,
                login: assignee.email.replaceAllIfValue('@acme.test', '@acme'),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, replace(app_user.email, ?1, ?2) as login from issue left outer join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "@acme.test",
            "@acme",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; login?: string }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-outer-join-kept-by-allow-when-over-a-joined-column', async () => {
        const expected = [
            { id: 1, assignee: 'Ada Lovelace' },
            { id: 2, assignee: 'Grace Hopper' },
            { id: 3 },
            { id: 4, assignee: 'Alan Turing' },
        ]
        ctx.mockNext([
            { id: 1, assignee: 'Ada Lovelace' },
            { id: 2, assignee: 'Grace Hopper' },
            { id: 3, assignee: null },
            { id: 4, assignee: 'Alan Turing' },
        ])
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:       tIssue.id,
                assignee: assignee.fullName.allowWhen(true, 'The assignee name is not visible'),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, app_user.full_name as assignee from issue left outer join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; assignee?: string }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-outer-join-kept-by-a-joined-column-in-a-subquery', async () => {
        // Whether the assignee also owns a closed issue: only issue 4 (Alan
        // Turing) is closed.
        const expected = [{ id: 1, ownsClosed: false }, { id: 2, ownsClosed: false }, { id: 3 }, { id: 4, ownsClosed: true }]
        ctx.mockNext([{ id: 1, ownsClosed: false }, { id: 2, ownsClosed: false }, { id: 3, ownsClosed: null }, { id: 4, ownsClosed: true }])
        const assignee = tAppUser.forUseInLeftJoin()
        const closedIssue = tIssue.as('closedIssue')
        const closedAssignees = ctx.conn.selectFrom(closedIssue)
            .where(closedIssue.status.equals('closed'))
            .selectOneColumn(closedIssue.assigneeId)
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:         tIssue.id,
                ownsClosed: assignee.id.in(closedAssignees),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, app_user.id in (select closedIssue.assignee_id as result from issue as closedIssue where closedIssue.status = ?1) as ownsClosed from issue left outer join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "closed",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; ownsClosed?: boolean }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-outer-join-kept-by-an-inline-subquery-using-the-joined-table', async () => {
        // Number of issues assigned to the same user; the unassigned issue 3 counts 0.
        const expected = [
            { id: 1, assigneeLoad: 1 },
            { id: 2, assigneeLoad: 1 },
            { id: 3, assigneeLoad: 0 },
            { id: 4, assigneeLoad: 1 },
        ]
        ctx.mockNext(expected)
        const assignee = tAppUser.forUseInLeftJoin()
        const assigned = tIssue.as('assigned')
        const assigneeLoad = ctx.conn.subSelectUsing(assignee).from(assigned)
            .where(assigned.assigneeId.equals(assignee.id))
            .selectCountAll()
            .forUseAsInlineQueryValue()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id: tIssue.id,
                assigneeLoad,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, (select count(*) as result from issue as assigned where assigned.assignee_id = app_user.id) as assigneeLoad from issue left outer join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; assigneeLoad: number }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-outer-join-kept-by-an-aggregate-over-a-joined-column', async () => {
        // Project 2's only issue is unassigned, so its string_agg is NULL;
        // project 3's only issue is assigned to Alan Turing.
        const expected = [{ projectId: 2 }, { projectId: 3, assignees: 'Alan Turing' }]
        ctx.mockNext([{ projectId: 2, assignees: null }, { projectId: 3, assignees: 'Alan Turing' }])
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .where(tIssue.projectId.in([2, 3]))
            .select({
                projectId: tIssue.projectId,
                assignees: ctx.conn.stringConcat(assignee.fullName, ', '),
            })
            .groupBy('projectId')
            .orderBy('projectId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.project_id as projectId, group_concat(app_user.full_name, ?1) as assignees from issue left outer join app_user on app_user.id = issue.assignee_id where issue.project_id in (?2, ?3) group by issue.project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            ", ",
            2,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ projectId: number; assignees?: string }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-outer-join-kept-by-a-virtual-column-of-the-joined-table', async () => {
        // Issue 1 has the coding and meeting worklogs, issue 2 the review one;
        // issues 3 and 4 have none.
        const expected = [
            { id: 1, activity: 'CODING' },
            { id: 1, activity: 'MEETING' },
            { id: 2, activity: 'REVIEW' },
            { id: 3 },
            { id: 4 },
        ]
        ctx.mockNext([
            { id: 1, activity: 'CODING' },
            { id: 1, activity: 'MEETING' },
            { id: 2, activity: 'REVIEW' },
            { id: 3, activity: null },
            { id: 4, activity: null },
        ])
        const worklog = tIssueWorklog.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(worklog).on(worklog.issueId.equals(tIssue.id))
            .select({
                id:       tIssue.id,
                activity: worklog.activityUpper,
            })
            .orderBy('id')
            .orderBy('activity')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, upper(issue_worklog.activity) as activity from issue left outer join issue_worklog on issue_worklog.issue_id = issue.id order by id, activity"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; activity?: string }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-outer-join-of-a-customized-table-kept-when-referenced', async () => {
        const expected = [
            { id: 1, assignee: 'Ada Lovelace' },
            { id: 2, assignee: 'Grace Hopper' },
            { id: 3 },
            { id: 4, assignee: 'Alan Turing' },
        ]
        ctx.mockNext([
            { id: 1, assignee: 'Ada Lovelace' },
            { id: 2, assignee: 'Grace Hopper' },
            { id: 3, assignee: null },
            { id: 4, assignee: 'Alan Turing' },
        ])
        const assignee = ctx.conn.withSqlHint(tAppUser, 'hintedAssignee').forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:       tIssue.id,
                assignee: assignee.fullName,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, app_user.full_name as assignee from issue left outer join /*+ hint */ app_user  on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; assignee?: string }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-join-kept-by-the-on-of-a-required-join-that-references-it', async () => {
        // Nothing projects the project, but the organization join reaches the
        // organization through it, so the project join stays. Issues 1-3 belong
        // to Acme Corp projects, issue 4 to a Globex Ltd one.
        const expected = [
            { id: 1, organization: 'Acme Corp' },
            { id: 2, organization: 'Acme Corp' },
            { id: 3, organization: 'Acme Corp' },
            { id: 4, organization: 'Globex Ltd' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .join(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .select({
                id:           tIssue.id,
                organization: tOrganization.name,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, organization.name as organization from issue join project on project.id = issue.project_id join organization on organization.id = project.organization_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; organization: string }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-join-is-not-kept-by-mutations-embedded-in-a-fragment', async () => {
        // The three statements embedded in the trailing comment all touch the
        // project table, but a mutation never makes the host query depend on a
        // table, so the unused project join is still dropped.
        // MOCK-ONLY: the embedded statements bind their placeholders inside an SQL
        // comment, invisible to the server, which then rejects the bind count.
        ctx.mockOnlyConnection()
        const expected = { id: 3 }
        ctx.mockNext(expected)
        const connection = ctx.conn
        const archiveProject = connection.update(tProject)
            .set({ published: false })
            .where(tProject.id.equals(2))
        const deleteProject = connection.deleteFrom(tProject)
            .where(tProject.id.equals(4))
        const createProject = connection.insertInto(tProject)
            .values({ organizationId: 2, name: 'Sandbox', slug: 'sandbox' })
        const row = await connection.selectFrom(tIssue)
            .optionalJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(3))
            .select({ id: tIssue.id })
            .customizeQuery({
                afterQuery: connection.rawFragment` /* ${archiveProject}; ${deleteProject}; ${createProject} */`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where id = ?1  /* update project set published = case when ?2 then 't' else 'f' end where id = ?3; delete from project where id = ?4; insert into project (organization_id, name, slug) values (?5, ?6, ?7) */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            0,
            2,
            4,
            2,
            "Sandbox",
            "sandbox",
          ]
        `)
        assertType<Exact<typeof row, { id: number }>>()
        expect(row).toEqual(expected)
    })
})
