// The NULLABLE `CustomBooleanTypeAdapter` path: `tIssueWorklog.approved` is
// `optionalColumn('boolean', CustomBooleanTypeAdapter('A','R'))`, projecting as
// `boolean | undefined` with a NULL round-trip through the `case … end` remap.
// The seed stores worklog 1 -> 'A' (true), 2 -> 'R' (false), 3 -> NULL.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssueWorklog } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

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
        const rows = sync(ctx.conn.selectFrom(tIssueWorklog)
            .select({
                id:       tIssueWorklog.id,
                approved: tIssueWorklog.approved,
            })
            .orderBy('id')
            .executeSelectMany())

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
            const inserted = sync(ctx.conn.insertInto(tIssueWorklog)
                .values({
                    issueId:  1,
                    workDate: new Date(Date.UTC(2024, 2, 12, 10, 0, 0)),
                    activity: 'coding',
                    approved: true,
                })
                .executeInsert())

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue_worklog (issue_id, work_date, activity, approved) values (?, ?, ?, case ? when 1 then 'A' when 0 then 'R' else null end)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "2024-03-12",
                "coding",
                1,
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
            const inserted = sync(ctx.conn.insertInto(tIssueWorklog)
                .values({
                    issueId:  2,
                    workDate: new Date(Date.UTC(2024, 2, 13, 10, 0, 0)),
                    activity: 'review',
                    approved: null,
                })
                .executeInsert())

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue_worklog (issue_id, work_date, activity, approved) values (?, ?, ?, case ? when 1 then 'A' when 0 then 'R' else null end)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
                "2024-03-13",
                "review",
                null,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(typeof inserted).toBe('number')
        })
    })

    test('is-null-on-custom-boolean-string-adapter-matches-stored-null-row', async () => {
        // `isNull()` on a nullable custom-boolean receiver (approved, adapter 'A'/'R').
        // Worklog 3 stores NULL for approved, so only it matches.
        const expected = [{ id: 3 }]
        ctx.mockNext(expected)
        const rows = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.isNull())
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (approved = 'A') is null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('is-not-null-on-custom-boolean-string-adapter-matches-non-null-rows', async () => {
        // `isNotNull()` on a nullable custom-boolean receiver (approved, adapter 'A'/'R').
        // Worklogs 1 ('A') and 2 ('R') carry a value; worklog 3 (NULL) is excluded.
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const rows = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.approved.isNotNull())
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (approved = 'A') is not null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('is-null-on-custom-boolean-numeric-adapter-emits-numeric-remap', async () => {
        // `isNull()` on a required numeric custom-boolean receiver (invoiced, adapter 1/0).
        // invoiced is required and never NULL in the seed, so no row matches.
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)
        const rows = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.isNull())
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (invoiced = 1) is null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('is-not-null-on-custom-boolean-numeric-adapter-matches-all-rows', async () => {
        // `isNotNull()` on a required numeric custom-boolean receiver (invoiced, adapter 1/0).
        // Every worklog carries a value, so all three rows match.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.isNotNull())
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (invoiced = 1) is not null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })
})
