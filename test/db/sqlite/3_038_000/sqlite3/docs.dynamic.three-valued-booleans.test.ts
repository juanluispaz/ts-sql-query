// Documentation snippets for the Booleans and three-valued logic page (docs/dynamic/three-valued-booleans.md).
//
// tIssueWorklog.billable is an optional boolean column: worklog 1 is true, worklog 2 is false and worklog 3 is null.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssueWorklog } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:three-valued-booleans/is-null-safe', async () => {
        const expected = [{ id: 3, activity: 'meeting' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const maybeBillable: boolean | null | undefined = null

        const worklogs = await connection.selectFrom(tIssueWorklog)
            // null-safe, JavaScript-like equality: `null` matches `null`, and the result is always a real boolean
            .where(tIssueWorklog.billable.is(maybeBillable))
            .select({ id: tIssueWorklog.id, activity: tIssueWorklog.activity })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, activity as activity from issue_worklog where billable is ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
          ]
        `)
        assertType<Exact<typeof worklogs, Array<{ id: number; activity: 'coding' | 'review' | 'meeting' }>>>()
        expect(worklogs).toEqual(expected)
    })

    test('docs-extra:three-valued-booleans/is-not', async () => {
        // Null-safe too: the null row differs from false, and false differs from null.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)

        const worklogs = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.isNot(false))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billable is not ?1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            false,
          ]
        `)
        assertType<Exact<typeof worklogs, Array<{ id: number }>>>()
        expect(worklogs).toEqual(expected)
    })

    test('docs-extra:three-valued-booleans/equals-result-optional-type', async () => {
        // equals and notEquals are null on the null row.
        const expected = [
            { id: 1, isBillable: true, isNotBillable: false },
            { id: 2, isBillable: false, isNotBillable: true },
            { id: 3 },
        ]
        ctx.mockNext(expected)

        const worklogs = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                id:            tIssueWorklog.id,
                isBillable:    tIssueWorklog.billable.equals(true),
                isNotBillable: tIssueWorklog.billable.notEquals(true),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billable = ?1 as isBillable, billable <> ?2 as isNotBillable from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
            true,
          ]
        `)
        assertType<Exact<typeof worklogs, Array<{ id: number; isBillable?: boolean; isNotBillable?: boolean }>>>()
        expect(worklogs).toEqual(expected)
    })

    test('docs-extra:three-valued-booleans/is-result-definite-type', async () => {
        // is and isNot are a definite boolean on every row, the null row included.
        const expected = [
            { id: 1, isBillable: true, isNotBillable: false, hasNoValue: false, hasValue: true },
            { id: 2, isBillable: false, isNotBillable: true, hasNoValue: false, hasValue: true },
            { id: 3, isBillable: false, isNotBillable: true, hasNoValue: true, hasValue: false },
        ]
        ctx.mockNext(expected)

        const worklogs = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                id:            tIssueWorklog.id,
                isBillable:    tIssueWorklog.billable.is(true),
                isNotBillable: tIssueWorklog.billable.isNot(true),
                hasNoValue:    tIssueWorklog.billable.is(null),
                hasValue:      tIssueWorklog.billable.isNot(undefined),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billable is ?1 as isBillable, billable is not ?2 as isNotBillable, billable is ?3 as hasNoValue, billable is not ?4 as hasValue from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
            true,
            null,
            null,
          ]
        `)
        assertType<Exact<typeof worklogs, Array<{
            id:            number
            isBillable:    boolean
            isNotBillable: boolean
            hasNoValue:    boolean
            hasValue:      boolean
        }>>>()
        expect(worklogs).toEqual(expected)
    })

    test('docs:three-valued-booleans/equals-present', async () => {
        const expected = [{ id: 1, activity: 'coding' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const present: boolean = true

        const worklogs = await connection.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.equals(present)) // requires a real boolean, never null/undefined
            .select({ id: tIssueWorklog.id, activity: tIssueWorklog.activity })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, activity as activity from issue_worklog where billable = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof worklogs, Array<{ id: number; activity: 'coding' | 'review' | 'meeting' }>>>()
        expect(worklogs).toEqual(expected)
    })

    test('docs:three-valued-booleans/equals-if-value-omitted', async () => {
        const expected = [
            { id: 1, activity: 'coding' },
            { id: 2, activity: 'review' },
            { id: 3, activity: 'meeting' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        // `billable` comes from the request and may be absent; absent means "don't filter by it"
        const billable: boolean | null | undefined = undefined

        const worklogs = await connection.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.equalsIfValue(billable)) // omitted entirely when billable is null/undefined
            .select({ id: tIssueWorklog.id, activity: tIssueWorklog.activity })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, activity as activity from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof worklogs, Array<{ id: number; activity: 'coding' | 'review' | 'meeting' }>>>()
        expect(worklogs.toSorted((a, b) => a.id - b.id)).toEqual(expected)
    })

    test('docs:three-valued-booleans/false-when-no-value', async () => {
        const expected: Array<{ id: number; activity: string }> = []
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const billable: boolean | null | undefined = undefined

        const worklogs = await connection.selectFrom(tIssueWorklog)
            // absent value applies the condition as `false` instead of omitting it
            .where(tIssueWorklog.billable.equalsIfValue(billable).falseWhenNoValue())
            .select({ id: tIssueWorklog.id, activity: tIssueWorklog.activity })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, activity as activity from issue_worklog where 0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof worklogs, Array<{ id: number; activity: 'coding' | 'review' | 'meeting' }>>>()
        expect(worklogs).toEqual(expected)
    })

    test('docs-extra:three-valued-booleans/optional-column-type', async () => {
        const expected = [
            { id: 1, billable: true },
            { id: 2, billable: false },
            { id: 3 },
        ]
        ctx.mockNext(expected)

        const worklogs = await ctx.conn.selectFrom(tIssueWorklog)
            .select({ id: tIssueWorklog.id, billable: tIssueWorklog.billable })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billable as billable from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof worklogs, Array<{ id: number; billable?: boolean }>>>()
        expect(worklogs).toEqual(expected)
    })
})
