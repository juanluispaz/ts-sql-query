// Direct fluent equality on an `enum` leaf type. Enum value sources are
// EqualableValueSource (not Comparable), so the typed surface is equals / notEquals /
// is / isNot / in([..]) / inN(..) and the in(select) / notIn(select) overloads —
// there is no between / lessThan / greaterThan on an enum.
//
// Receiver tIssueWorklog.activity ('WorklogActivity'): worklog 1 -> 'coding',
// 2 -> 'review', 3 -> 'meeting'. Each test filters in WHERE and projects the int
// primary key, so the result type is `Array<{ id: number }>`; per-dialect operator
// emission is pinned by the inline SQL snapshot.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssueWorklog, type WorklogActivity } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('enum-equals-not-equals', async () => {
        // `.equals('coding')` matches worklog 1; `.notEquals('coding')` matches
        // worklogs 2 ('review') and 3 ('meeting').
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.equals('coding'))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where activity = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "coding",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNe = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.notEquals('coding'))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where activity <> ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "coding",
          ]
        `)
        expect(ne).toEqual(expectedNe)
    })

    test('enum-is-is-not', async () => {
        // `.is` / `.isNot` — the null-safe equality arm on an enum column.
        // activity is non-null on every worklog, so `.is('review')` matches
        // worklog 2 and `.isNot('review')` matches worklogs 1 and 3.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.is('review'))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where activity is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "review",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedIsNot = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.isNot('review'))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where activity is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "review",
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    test('enum-in-array-in-n', async () => {
        // `.in(['coding', 'meeting'])` matches worklogs 1 and 3; `.inN('review')`
        // matches worklog 2 only. The array elements are typed as the enum
        // union, so a non-member string would not compile.
        const codingOrMeeting: WorklogActivity[] = ['coding', 'meeting']
        const expectedIn = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.in(codingOrMeeting))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where activity in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "coding",
            "meeting",
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedInN = [{ id: 2 }]
        ctx.mockNext(expectedInN)
        const inNRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.inN('review'))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where activity in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "review",
          ]
        `)
        expect(inNRows).toEqual(expectedInN)
    })

    test('enum-not-in-array', async () => {
        // `.notIn(['coding'])` matches worklogs 2 ('review') and 3 ('meeting').
        const justCoding: WorklogActivity[] = ['coding']
        const expected = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.notIn(justCoding))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where activity not in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "coding",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('enum-in-subquery-not-in-subquery', async () => {
        // The subquery overload of IN / NOT IN over an enum column. The inner
        // query selects the activity of worklog 1 ('coding'); the outer keeps
        // worklogs whose activity is in / not in that set. The subquery's
        // selected column carries the SAME enum typeName ('WorklogActivity'),
        // so the overload resolves.
        const activityOfWorklog1 = ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(tIssueWorklog.activity)

        const expectedIn = [{ id: 1 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.in(activityOfWorklog1))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where activity in (select activity as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedNotIn = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedNotIn)
        const notInRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.notIn(activityOfWorklog1))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where activity not in (select activity as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(notInRows).toEqual(expectedNotIn)
    })
})
