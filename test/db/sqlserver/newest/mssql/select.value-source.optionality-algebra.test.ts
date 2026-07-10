// Optionality-algebra NULL inhabitants that no existing test realizes. The
// result-type optionality of merge-optional operators is pinned everywhere, but
// the actual NULL/absent RUNTIME inhabitant is only ever realized through the
// fragment / nullIfValue / aggregate / left-join paths — never through a plain
// `col.add(optionalCol)` or a merged-optional boolean. These use the existing
// NULL seed values (worklog 2 has NULL `minutes`; worklog 3 has NULL `billable`
// with activity 'meeting'), so no UPDATE is needed and every row is
// real-DB-validatable.
//
// Seed facts (issue_worklog):
//   worklog 1 — issue 1, minutes 90, activity 'coding',  billable TRUE
//   worklog 2 — issue 2, minutes NULL, activity 'review', billable FALSE
//   worklog 3 — issue 1, minutes 30, activity 'meeting', billable NULL

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssueWorklog } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('optional-plus-optional-stays-optional-and-realizes-both-inhabitants', async () => {
        // T3-6: the `optional x optional -> optional` cell. `minutes.add(minutes)`
        // has two OPTIONAL operands (the same optional int column), so the result
        // is optional. worklog 1 (minutes 90) realizes the present value 180;
        // worklog 2 (minutes NULL) realizes the NULL inhabitant -> the leaf is
        // absent under the default projector.
        const expected = [{ id: 1, sum: 180 }, { id: 2 }]
        ctx.mockNext([{ id: 1, sum: 180 }, { id: 2, sum: null }])
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.in([1, 2]))
            .select({
                id:  tIssueWorklog.id,
                sum: tIssueWorklog.minutes.add(tIssueWorklog.minutes),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, minutes + minutes as [sum] from issue_worklog where id in (@0, @1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; sum?: number }>>>()
        expect(rows).toEqual(expected)
        // The NULL-operand row drops the key entirely (absent, not present-undefined).
        expect('sum' in rows[1]!).toBe(false)
    })

    test('required-plus-optional-realizes-the-null-inhabitant', async () => {
        // T3-8: a plain `col.add(optionalCol)` merge-optional binary op. issueId
        // (required int) + minutes (optional int) -> optional int. worklog 1:
        // 1 + 90 = 91 (present); worklog 2: 2 + NULL = NULL -> absent. This NULL
        // inhabitant is realized elsewhere only through fragment / nullIfValue /
        // aggregate / left-join paths, never a plain required.add(optional).
        const expected = [{ id: 1, total: 91 }, { id: 2 }]
        ctx.mockNext([{ id: 1, total: 91 }, { id: 2, total: null }])
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.in([1, 2]))
            .select({
                id:    tIssueWorklog.id,
                total: tIssueWorklog.issueId.add(tIssueWorklog.minutes),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, issue_id + minutes as total from issue_worklog where id in (@0, @1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; total?: number }>>>()
        expect(rows).toEqual(expected)
        expect('total' in rows[1]!).toBe(false)
    })

    test('merged-optional-boolean-three-valued-null-default-drops-key', async () => {
        // T3-7 (default projector): a merged-optional 3-valued boolean.
        // `activity.equals('meeting')` (required, TRUE for worklog 3) `.and(billable)`
        // (optional, NULL for worklog 3) -> `TRUE AND NULL = NULL` (SQL 3-valued
        // logic). The merged leaf is optional and the NULL result drops the key.
        const expected = [{ id: 3 }]
        ctx.mockNext([{ id: 3, flag: null }])
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(3))
            .select({
                id:   tIssueWorklog.id,
                flag: tIssueWorklog.activity.equals('meeting').and(tIssueWorklog.billable),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(case when activity = @0 and (billable = 1) then 1 when not (activity = @1 and (billable = 1)) then 0 else null end as bit) as flag from issue_worklog where id = @2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "meeting",
            "meeting",
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; flag?: boolean }>>>()
        expect(rows).toEqual(expected)
        expect('flag' in rows[0]!).toBe(false)
    })

    test('merged-optional-boolean-three-valued-null-as-nullable-surfaces-null', async () => {
        // T3-7 (projectingOptionalValuesAsNullable): the same `TRUE AND NULL = NULL`
        // merged boolean, but under the as-nullable projector the NULL surfaces as
        // a present `null` leaf instead of being dropped.
        const expected = [{ id: 3, flag: null }]
        ctx.mockNext([{ id: 3, flag: null }])
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(3))
            .select({
                id:   tIssueWorklog.id,
                flag: tIssueWorklog.activity.equals('meeting').and(tIssueWorklog.billable),
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(case when activity = @0 and (billable = 1) then 1 when not (activity = @1 and (billable = 1)) then 0 else null end as bit) as flag from issue_worklog where id = @2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "meeting",
            "meeting",
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; flag: boolean | null }>>>()
        expect(rows).toEqual(expected)
        expect(rows[0]!.flag).toBeNull()
    })
})
