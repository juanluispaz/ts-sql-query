// The NULLABLE `CustomBooleanTypeAdapter` path: `tIssueWorklog.approved` is
// `optionalColumn('boolean', CustomBooleanTypeAdapter('A','R'))`, projecting as
// `boolean | undefined` with a NULL round-trip through the `case … end` remap.
// The seed stores worklog 1 -> 'A' (true), 2 -> 'R' (false), 3 -> NULL.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssueWorklog } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('select-nullable-custom-boolean-maps-and-null-round-trips', async () => {
        // The optional adapter column projects as `boolean | undefined`. The
        // read remap is `(approved = 'A')`; worklog 1 -> true, 2 -> false, and
        // 3 (stored NULL) -> absent.
        const expected = [
            { id: 1, approved: true },
            { id: 2, approved: false },
            { id: 3 },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                id:       tIssueWorklog.id,
                approved: tIssueWorklog.approved,
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (approved = 'A') as approved from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; approved?: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('insert-nullable-custom-boolean-true-emits-case-when-remap', async () => {
        // Writing `approved: true` goes through the optional adapter's null-aware
        // three-way write remap `case … when true then 'A' when false then 'R'
        // else null end`.
        await ctx.withRollback(async () => {
            ctx.mockNext(99)
            const inserted = await ctx.conn.insertInto(tIssueWorklog)
                .values({
                    issueId:  1,
                    workDate: new Date(Date.UTC(2024, 2, 12, 10, 0, 0)),
                    activity: 'coding',
                    approved: true,
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue_worklog (issue_id, work_date, activity, approved) values ($1, $2, $3, case $4::bool when true then 'A' when false then 'R' else null end)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                2024-03-12T10:00:00.000Z,
                "coding",
                true,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(typeof inserted).toBe('number')
        })
    })

    test('insert-nullable-custom-boolean-null-writes-null', async () => {
        // Writing `approved: null` rides the same remap, but the `null::bool`
        // param matches neither `when true` nor `when false`, so the `else null`
        // arm stores NULL (without it, null would wrongly map to 'R').
        await ctx.withRollback(async () => {
            ctx.mockNext(99)
            const inserted = await ctx.conn.insertInto(tIssueWorklog)
                .values({
                    issueId:  2,
                    workDate: new Date(Date.UTC(2024, 2, 13, 10, 0, 0)),
                    activity: 'review',
                    approved: null,
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue_worklog (issue_id, work_date, activity, approved) values ($1, $2, $3, case $4::bool when true then 'A' when false then 'R' else null end)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
                2024-03-13T10:00:00.000Z,
                "review",
                null,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(typeof inserted).toBe('number')
        })
    })
})
