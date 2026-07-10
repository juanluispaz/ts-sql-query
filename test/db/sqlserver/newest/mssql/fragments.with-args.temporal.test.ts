// arg / valueArg keyword-arm coverage for the temporal and custom-fractional
// argument types — localDate / localTime / localDateTime / customDouble. The
// int / string / uuid / double / customComparable / custom / enum / customUuid /
// boolean arms are covered by `fragments.with-args.test.ts`; these four were
// unexercised across the whole matrix. Each `<Kind>Eq` fragment field emits
// `<col> = $1` in a column context; the load-bearing detail is the distinct
// bound value each kind's `valueArg` marshals (a Date through
// `valueArg('localTime')` binds 'HH:MM:SS', through `valueArg('localDate')`
// binds the Date, a number through `valueArg('customDouble')` binds the number).
//
// The custom-temporal `valueArg` kinds (customLocalDate / customLocalTime /
// customLocalDateTime) are intentionally NOT covered here: their `valueArg`
// binds the raw Date rather than routing through the connection's
// `baseTypeForCustom` marshalling the way the const/column paths do, so the
// bound value does not round-trip on the real engines (it is only accepted by
// the mock). Covering them would require a src-side marshalling change.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tIssueWorklog } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('arg-keyword-local-date', async () => {
        // work_date is a plain localDate column; worklog 1 = 2024-03-04.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.localDateEq(tIssueWorklog.workDate, new Date(Date.UTC(2024, 2, 4))))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date = @0 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-03-04T00:00:00.000Z,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('arg-keyword-local-time', async () => {
        // started_at is an optional localTime column; worklog 1 = 09:15:00. The
        // valueArg marshals the Date to the 'HH:MM:SS' bound param.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.localTimeEq(tIssueWorklog.startedAt, new Date('1970-01-01T09:15:00Z')))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at = @0 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1970-01-01T09:15:00.000Z,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('arg-keyword-local-date-time', async () => {
        // created_at is CURRENT_TIMESTAMP (dynamic), so a fixed past timestamp
        // matches no row — the assertion of interest is the marshalled bound
        // Date, not the (empty) result.
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.localDateTimeEq(tIssue.createdAt, new Date('2020-01-01T00:00:00Z')))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where created_at = @0 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2020-01-01T00:00:00.000Z,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('arg-keyword-custom-double', async () => {
        // billed_amount is a customDouble 'Money' column; worklog 2 = 50.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(ctx.conn.customDoubleEq(tIssueWorklog.billedAmount, 50))
            .select({ id: tIssueWorklog.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billed_amount = @0 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })
})
