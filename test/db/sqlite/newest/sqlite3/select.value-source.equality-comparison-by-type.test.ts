// The Equalable + Comparable base methods (equals, notEquals, is, isNot, between,
// notBetween, in([..]), inN(..), in(select)/notIn(select)) on the `bigint`, `double`,
// `customInt`, `customDouble` and `uuid` leaf types.
//
// Every test filters in the WHERE clause and projects the int primary key, so the
// result type is `Array<{ id: number }>` regardless of the receiver's optionality —
// what is under test is the operator emission per leaf type, pinned by the inline SQL
// snapshot (uniform across dialects up to identifier quoting / placeholder syntax).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tIssueWorklog, tOrganization, tProjectRelease, tProjectReview } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // ------------------------------------------------------------------
    // bigint — tIssueWorklog.durationMs (optional bigint):
    //   worklog 1 -> 5400000, 2 -> NULL, 3 -> 1800000.
    // ------------------------------------------------------------------

    test('bigint-equals-not-equals', async () => {
        // `.equals(5400000n)` matches worklog 1; `.notEquals(5400000n)` matches
        // worklog 3 (worklog 2 is NULL -> excluded by NULL semantics).
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.equals(5400000n))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5400000,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNe = [{ id: 3 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.notEquals(5400000n))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms <> ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5400000,
          ]
        `)
        expect(ne).toEqual(expectedNe)
    })

    test('bigint-is-is-not', async () => {
        // `.is` / `.isNot` — the null-safe equality arm. `.is(5400000n)` matches
        // worklog 1; `.isNot(5400000n)` matches worklog 2 (NULL) and 3.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.is(5400000n))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5400000,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedIsNot = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.isNot(5400000n))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5400000,
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    test('bigint-between-not-between', async () => {
        // `.between(1000000n, 2000000n)` matches worklog 3 (1800000); the rest
        // are out of range or NULL. `.notBetween(...)` matches worklog 1
        // (5400000); worklog 2 (NULL) is excluded by NULL semantics.
        const expected = [{ id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.between(1000000n, 2000000n))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms between ? and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1000000,
            2000000,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNot = [{ id: 1 }]
        ctx.mockNext(expectedNot)
        const notRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.notBetween(1000000n, 2000000n))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms not between ? and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1000000,
            2000000,
          ]
        `)
        expect(notRows).toEqual(expectedNot)
    })

    test('bigint-in-array-in-n', async () => {
        // `.in([5400000n, 1800000n])` matches worklogs 1 and 3; `.inN(5400000n)`
        // matches worklog 1 only.
        const expectedIn = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.in([5400000n, 1800000n]))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5400000,
            1800000,
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedInN = [{ id: 1 }]
        ctx.mockNext(expectedInN)
        const inNRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.inN(5400000n))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5400000,
          ]
        `)
        expect(inNRows).toEqual(expectedInN)
    })

    test('bigint-in-subquery-not-in-subquery', async () => {
        // The subquery overload of IN / NOT IN over a bigint column. The inner
        // query selects the duration_ms of worklog 1 (5400000); the outer query
        // keeps worklogs whose duration_ms is in / not in that set. NULL rows
        // never satisfy IN and are dropped by NULL semantics from NOT IN too.
        const durationsOfWorklog1 = ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(tIssueWorklog.durationMs)

        const expectedIn = [{ id: 1 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.in(durationsOfWorklog1))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms in (select duration_ms as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedNotIn = [{ id: 3 }]
        ctx.mockNext(expectedNotIn)
        const notInRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.notIn(durationsOfWorklog1))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms not in (select duration_ms as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(notInRows).toEqual(expectedNotIn)
    })

    // ------------------------------------------------------------------
    // double — tIssue.estimatedHours (optional double, NULL in the seed).
    // Each test populates a couple of rows inside a rollback transaction so
    // the comparison has deterministic operands, then runs the SELECT as the
    // last statement (ctx.lastSql / ctx.lastParams capture it).
    // ------------------------------------------------------------------

    test('double-equals-not-equals', async () => {
        // After setting estimated_hours: issue 1 -> 2.5, issue 2 -> 7.5 (the
        // rest stay NULL). `.equals(2.5)` matches issue 1; `.notEquals(2.5)`
        // matches issue 2 (the NULL rows are excluded by NULL semantics).
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 2.5 }).where(tIssue.id.equals(1)).executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 7.5 }).where(tIssue.id.equals(2)).executeUpdate()

            const expected = [{ id: 1 }]
            ctx.mockNext(expected)
            const rows = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.equals(2.5))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours = ? order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2.5,
              ]
            `)
            assertType<Exact<typeof rows, Array<{ id: number }>>>()
            expect(rows).toEqual(expected)

            const expectedNe = [{ id: 2 }]
            ctx.mockNext(expectedNe)
            const ne = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.notEquals(2.5))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours <> ? order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2.5,
              ]
            `)
            expect(ne).toEqual(expectedNe)
        })
    })

    test('double-is-is-not', async () => {
        // `.is` / `.isNot` — null-safe equality on a double column. issue 1 ->
        // 2.5, issue 2 -> 7.5, the rest NULL. `.is(2.5)` matches issue 1;
        // `.isNot(2.5)` matches issue 2, 3, 4 (NULL is distinct from 2.5).
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 2.5 }).where(tIssue.id.equals(1)).executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 7.5 }).where(tIssue.id.equals(2)).executeUpdate()

            const expected = [{ id: 1 }]
            ctx.mockNext(expected)
            const rows = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.is(2.5))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours is ? order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2.5,
              ]
            `)
            assertType<Exact<typeof rows, Array<{ id: number }>>>()
            expect(rows).toEqual(expected)

            const expectedIsNot = [{ id: 2 }, { id: 3 }, { id: 4 }]
            ctx.mockNext(expectedIsNot)
            const isNot = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.isNot(2.5))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours is not ? order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2.5,
              ]
            `)
            expect(isNot).toEqual(expectedIsNot)
        })
    })

    test('double-between-not-between', async () => {
        // issue 1 -> 2.5, issue 2 -> 7.5. `.between(2.0, 5.0)` matches issue 1;
        // `.notBetween(2.0, 5.0)` matches issue 2 (NULL rows excluded).
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 2.5 }).where(tIssue.id.equals(1)).executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 7.5 }).where(tIssue.id.equals(2)).executeUpdate()

            const expected = [{ id: 1 }]
            ctx.mockNext(expected)
            const rows = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.between(2.0, 5.0))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours between ? and ? order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
                5,
              ]
            `)
            assertType<Exact<typeof rows, Array<{ id: number }>>>()
            expect(rows).toEqual(expected)

            const expectedNot = [{ id: 2 }]
            ctx.mockNext(expectedNot)
            const notRows = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.notBetween(2.0, 5.0))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours not between ? and ? order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
                5,
              ]
            `)
            expect(notRows).toEqual(expectedNot)
        })
    })

    test('double-in-array-in-n', async () => {
        // issue 1 -> 2.5, issue 2 -> 7.5. `.in([2.5, 7.5])` matches issues 1
        // and 2; `.inN(2.5)` matches issue 1 only.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 2.5 }).where(tIssue.id.equals(1)).executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 7.5 }).where(tIssue.id.equals(2)).executeUpdate()

            const expectedIn = [{ id: 1 }, { id: 2 }]
            ctx.mockNext(expectedIn)
            const inRows = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.in([2.5, 7.5]))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours in (?, ?) order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2.5,
                7.5,
              ]
            `)
            assertType<Exact<typeof inRows, Array<{ id: number }>>>()
            expect(inRows).toEqual(expectedIn)

            const expectedInN = [{ id: 1 }]
            ctx.mockNext(expectedInN)
            const inNRows = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.inN(2.5))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours in (?) order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2.5,
              ]
            `)
            expect(inNRows).toEqual(expectedInN)
        })
    })

    test('double-in-subquery-not-in-subquery', async () => {
        // The subquery overload of IN / NOT IN over a double column. issue 1 ->
        // 2.5, issue 2 -> 7.5. The inner query selects issue 1's estimated_hours
        // (2.5); the outer keeps issues whose estimated_hours is in / not in
        // that set. NULL rows never satisfy IN and drop out of NOT IN too.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 2.5 }).where(tIssue.id.equals(1)).executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 7.5 }).where(tIssue.id.equals(2)).executeUpdate()

            const hoursOfIssue1 = ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .selectOneColumn(tIssue.estimatedHours)

            const expectedIn = [{ id: 1 }]
            ctx.mockNext(expectedIn)
            const inRows = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.in(hoursOfIssue1))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours in (select estimated_hours as result from issue where id = ?) order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof inRows, Array<{ id: number }>>>()
            expect(inRows).toEqual(expectedIn)

            const expectedNotIn = [{ id: 2 }]
            ctx.mockNext(expectedNotIn)
            const notInRows = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.notIn(hoursOfIssue1))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours not in (select estimated_hours as result from issue where id = ?) order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            expect(notInRows).toEqual(expectedNotIn)
        })
    })

    // ------------------------------------------------------------------
    // customInt — tIssueWorklog.costCents ('Cents', required, marshalled int):
    //   worklog 1 -> 100, 2 -> 100, 3 -> 400.
    // ------------------------------------------------------------------

    test('customInt-equals-not-equals', async () => {
        // `.equals(400)` matches worklog 3; `.notEquals(400)` matches worklogs
        // 1 and 2.
        const expected = [{ id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.equals(400))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            400,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNe = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.notEquals(400))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents <> ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            400,
          ]
        `)
        expect(ne).toEqual(expectedNe)
    })

    test('customInt-is-is-not', async () => {
        // `.is` / `.isNot` on a (required) customInt column. cost_cents is
        // non-null on every worklog, so `.is(400)` matches worklog 3 and
        // `.isNot(400)` matches worklogs 1 and 2.
        const expected = [{ id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.is(400))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            400,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedIsNot = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.isNot(400))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            400,
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    test('customInt-between-not-between', async () => {
        // `.between(50, 200)` matches worklogs 1 and 2 (cost 100); worklog 3
        // (400) is out of range. `.notBetween(50, 200)` matches worklog 3.
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.between(50, 200))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents between ? and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
            200,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNot = [{ id: 3 }]
        ctx.mockNext(expectedNot)
        const notRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.notBetween(50, 200))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents not between ? and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
            200,
          ]
        `)
        expect(notRows).toEqual(expectedNot)
    })

    test('customInt-in-array-in-n', async () => {
        // `.in([400])` matches worklog 3; `.inN(100)` matches worklogs 1 and 2.
        const expectedIn = [{ id: 3 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.in([400]))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            400,
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedInN = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedInN)
        const inNRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.inN(100))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        expect(inNRows).toEqual(expectedInN)
    })

    test('customInt-in-subquery-not-in-subquery', async () => {
        // The subquery overload of IN / NOT IN over a customInt ('Cents')
        // column. The inner query selects worklog 3's cost_cents (400); the
        // outer keeps worklogs whose cost_cents is in / not in that set.
        const costOfWorklog3 = ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(3))
            .selectOneColumn(tIssueWorklog.costCents)

        const expectedIn = [{ id: 3 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.in(costOfWorklog3))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents in (select cost_cents as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedNotIn = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedNotIn)
        const notInRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.notIn(costOfWorklog3))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents not in (select cost_cents as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        expect(notInRows).toEqual(expectedNotIn)
    })

    // ------------------------------------------------------------------
    // customDouble — tIssueWorklog.billedAmount ('Money', required,
    // marshalled double): worklog 1 -> 200, 2 -> 50, 3 -> 200.
    // ------------------------------------------------------------------

    test('customDouble-equals-not-equals', async () => {
        // `.equals(50)` matches worklog 2; `.notEquals(50)` matches worklogs 1
        // and 3.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.equals(50))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billed_amount = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNe = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.notEquals(50))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billed_amount <> ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
          ]
        `)
        expect(ne).toEqual(expectedNe)
    })

    test('customDouble-is-is-not', async () => {
        // `.is` / `.isNot` on a (required) customDouble column. billed_amount is
        // non-null on every worklog, so `.is(50)` matches worklog 2 and
        // `.isNot(50)` matches worklogs 1 and 3.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.is(50))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billed_amount is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedIsNot = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.isNot(50))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billed_amount is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    test('customDouble-between-not-between', async () => {
        // `.between(100, 300)` matches worklogs 1 and 3 (200); worklog 2 (50) is
        // out of range. `.notBetween(100, 300)` matches worklog 2.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.between(100, 300))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billed_amount between ? and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
            300,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNot = [{ id: 2 }]
        ctx.mockNext(expectedNot)
        const notRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.notBetween(100, 300))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billed_amount not between ? and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
            300,
          ]
        `)
        expect(notRows).toEqual(expectedNot)
    })

    test('customDouble-in-array-in-n', async () => {
        // `.in([50])` matches worklog 2; `.inN(200)` matches worklogs 1 and 3.
        const expectedIn = [{ id: 2 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.in([50]))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billed_amount in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedInN = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedInN)
        const inNRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.inN(200))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billed_amount in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            200,
          ]
        `)
        expect(inNRows).toEqual(expectedInN)
    })

    // ------------------------------------------------------------------
    // uuid — tIssue.externalRef (optional uuid):
    //   issue 1 -> 0a8f9c1e-1111-4222-8333-444455556666,
    //   issue 2 -> 7b3e9d20-2222-4c55-9b66-dddd00009999, issues 3,4 -> NULL.
    // ------------------------------------------------------------------

    test('uuid-equals-not-equals', async () => {
        // `.equals(<issue-1 uuid>)` matches issue 1; `.notEquals(...)` matches
        // issue 2 (issues 3,4 are NULL -> excluded by NULL semantics).
        const ref1 = '0a8f9c1e-1111-4222-8333-444455556666'
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.equals(ref1))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNe = [{ id: 2 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.notEquals(ref1))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref <> ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        expect(ne).toEqual(expectedNe)
    })

    test('uuid-is-is-not', async () => {
        // `.is` / `.isNot` — null-safe equality on a uuid column. `.is(<issue-1
        // uuid>)` matches issue 1; `.isNot(...)` matches issues 2, 3, 4 (the
        // NULL rows are distinct from the operand under IS DISTINCT FROM).
        const ref1 = '0a8f9c1e-1111-4222-8333-444455556666'
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.is(ref1))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedIsNot = [{ id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.isNot(ref1))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    test('uuid-between-not-between', async () => {
        // `.between(lo, hi)` on a uuid column. The seeded refs start with `0a`
        // (issue 1) and `7b` (issue 2); bounds 00000000…-50000000… bracket only
        // the `0a` ref, so `.between(...)` matches issue 1 on both uuid-typed
        // and text-typed engines (the bounds are separated by the first hex
        // nibble, where byte and lexical order agree). `.notBetween(...)`
        // matches issue 2 (NULL rows excluded by NULL semantics).
        const lo = '00000000-0000-0000-0000-000000000000'
        const hi = '50000000-0000-0000-0000-000000000000'
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.between(lo, hi))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref between ? and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "00000000-0000-0000-0000-000000000000",
            "50000000-0000-0000-0000-000000000000",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNot = [{ id: 2 }]
        ctx.mockNext(expectedNot)
        const notRows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.notBetween(lo, hi))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref not between ? and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "00000000-0000-0000-0000-000000000000",
            "50000000-0000-0000-0000-000000000000",
          ]
        `)
        expect(notRows).toEqual(expectedNot)
    })

    test('uuid-in-array-in-n', async () => {
        // `.in([<issue-1 uuid>, <issue-2 uuid>])` matches issues 1 and 2;
        // `.inN(<issue-1 uuid>)` matches issue 1 only.
        const ref1 = '0a8f9c1e-1111-4222-8333-444455556666'
        const ref2 = '7b3e9d20-2222-4c55-9b66-dddd00009999'
        const expectedIn = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.in([ref1, ref2]))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
            "7b3e9d20-2222-4c55-9b66-dddd00009999",
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedInN = [{ id: 1 }]
        ctx.mockNext(expectedInN)
        const inNRows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.inN(ref1))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        expect(inNRows).toEqual(expectedInN)
    })

    test('uuid-in-subquery-not-in-subquery', async () => {
        // The subquery overload of IN / NOT IN over a uuid column. The inner
        // query selects issue 1's external_ref; the outer keeps issues whose
        // external_ref is in / not in that set. NULL external_refs never satisfy
        // IN and drop out of NOT IN too.
        const refOfIssue1 = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.externalRef)

        const expectedIn = [{ id: 1 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.in(refOfIssue1))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref in (select external_ref as result from issue where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedNotIn = [{ id: 2 }]
        ctx.mockNext(expectedNotIn)
        const notInRows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.notIn(refOfIssue1))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref not in (select external_ref as result from issue where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(notInRows).toEqual(expectedNotIn)
    })
    test('customUuid-in-subquery-not-in-subquery', async () => {
        // The subquery overload of IN / NOT IN over a customUuid ('SigningKey')
        // column. Inner: signing_key of release 1; outer keeps releases whose
        // signing_key is in / not in that set (release 2 is NULL).
        const keyOfRelease1 = ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(tProjectRelease.signingKey)

        const expectedIn = [{ id: 1 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.in(keyOfRelease1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signing_key in (select signing_key as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedNotIn = [{ id: 3 }]
        ctx.mockNext(expectedNotIn)
        const notInRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.notIn(keyOfRelease1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signing_key not in (select signing_key as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(notInRows).toEqual(expectedNotIn)
    })

    test('customComparable-is-is-not', async () => {
        // `.is` / `.isNot` (null-safe equality) on a customComparable ('Semver')
        // column. `.is('1.2.0')` matches release 1; `.isNot('1.2.0')` matches
        // releases 2 and 3.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.is('1.2.0'))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where version is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.2.0",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedIsNot = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.isNot('1.2.0'))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where version is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.2.0",
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    test('customComparable-in-subquery-not-in-subquery', async () => {
        // The subquery overload of IN / NOT IN over a customComparable ('Semver')
        // column. Inner: version of release 1 ('1.2.0'); outer keeps releases
        // whose version is in / not in that set.
        const verOfRelease1 = ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(tProjectRelease.version)

        const expectedIn = [{ id: 1 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.in(verOfRelease1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where version in (select version as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedNotIn = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedNotIn)
        const notInRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.notIn(verOfRelease1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where version not in (select version as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(notInRows).toEqual(expectedNotIn)
    })

    test('custom-is-is-not', async () => {
        // `.is` / `.isNot` on the `custom` column channel ('ReleaseChannel').
        // `.is('stable')` matches release 1; `.isNot('stable')` matches releases
        // 2 and 3.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.is('stable'))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where channel is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "stable",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedIsNot = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.isNot('stable'))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where channel is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "stable",
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    test('numeric-custom-boolean-direct-filter-operand', async () => {
        // The numeric CustomBooleanTypeAdapter column `invoiced` as a DIRECT
        // fluent filter operand. invoiced: worklog 1 true, 2 false, 3 true.
        // equals(true)/is(true) match worklogs 1 and 3; in([false]) matches 2.
        const expectedTrue = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedTrue)
        const eqRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.equals(true))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (invoiced = 1) = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof eqRows, Array<{ id: number }>>>()
        expect(eqRows).toEqual(expectedTrue)

        ctx.mockNext(expectedTrue)
        const isRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.is(true))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (invoiced = 1) is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        expect(isRows).toEqual(expectedTrue)

        const expectedFalse = [{ id: 2 }]
        ctx.mockNext(expectedFalse)
        const inRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.in([false]))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (invoiced = 1) in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            false,
          ]
        `)
        expect(inRows).toEqual(expectedFalse)
    })


    // ==================================================================
    // Direct-fluent arms on existing leaves:
    // customUuid is/isNot + value-source operand, plain-string ordered
    // comparison + between, customComparable greaterOrEqual + notBetween,
    // uuid single-bound ordered comparison, customDouble in/notIn subquery.
    // ==================================================================

    test('customUuid-is-is-not-and-value-source-operand', async () => {
        // `.is` / `.isNot` (null-safe equality) on the OPTIONAL customUuid
        // ('SigningKey') column signingKey, plus the value-source-operand
        // overload of `.equals`. signing_key: release 1 -> 0a8f9c1e-…,
        // 2 -> NULL, 3 -> 7b3e9d20-…. `.is(<key1>)` matches release 1;
        // `.isNot(<key1>)` matches releases 2 (NULL, distinct under IS DISTINCT
        // FROM) and 3.
        const key1 = '0a8f9c1e-1111-4222-8333-444455556666'
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.is(key1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signing_key is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedIsNot = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.isNot(key1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signing_key is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)

        // The value-source-operand overload of `.equals`: compare each release's
        // signing_key against release 1's signing_key (a scalar subquery value
        // source). Matches release 1 only (release 3 has a different key,
        // release 2 is NULL).
        const keyOfRelease1 = ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(tProjectRelease.signingKey)
            .forUseAsInlineQueryValue()
        const expectedEq = [{ id: 1 }]
        ctx.mockNext(expectedEq)
        const eq = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.equals(keyOfRelease1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signing_key = (select signing_key as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(eq).toEqual(expectedEq)
    })

    test('string-ordered-comparison-and-between', async () => {
        // Ordered comparison on a plain `string` column with CONST operands.
        // tIssue.title: 1 'Update hero copy', 2 'Redesign navbar', 3 'Migrate to
        // ESM', 4 'Document /v2/users'. Lexical order: 4 < 3 < 2 < 1.
        // `.lessThan('Migrate to ESM')` -> issue 4; `.greaterThan(...)` ->
        // issues 1,2; `.lessOrEqual(...)` -> issues 3,4; `.greaterOrEqual(...)`
        // -> issues 1,2,3. `.between('Migrate to ESM','Redesign navbar')` ->
        // issues 2,3.
        const mid = 'Migrate to ESM'

        const expectedLt = [{ id: 4 }]
        ctx.mockNext(expectedLt)
        const lt = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.lessThan(mid))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title < ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Migrate to ESM",
          ]
        `)
        assertType<Exact<typeof lt, Array<{ id: number }>>>()
        expect(lt).toEqual(expectedLt)

        const expectedGt = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedGt)
        const gt = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.greaterThan(mid))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Migrate to ESM",
          ]
        `)
        expect(gt).toEqual(expectedGt)

        const expectedLe = [{ id: 3 }, { id: 4 }]
        ctx.mockNext(expectedLe)
        const le = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.lessOrEqual(mid))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title <= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Migrate to ESM",
          ]
        `)
        expect(le).toEqual(expectedLe)

        const expectedGe = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expectedGe)
        const ge = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.greaterOrEqual(mid))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title >= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Migrate to ESM",
          ]
        `)
        expect(ge).toEqual(expectedGe)

        const expectedBetween = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedBetween)
        const between = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.between(mid, 'Redesign navbar'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title between ? and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Migrate to ESM",
            "Redesign navbar",
          ]
        `)
        expect(between).toEqual(expectedBetween)
    })

    test('customComparable-greater-or-equal-and-not-between', async () => {
        // The two remaining Comparable arms on a customComparable ('Semver')
        // column. version (stored as text): 1 '1.2.0', 2 '1.3.0-beta.1',
        // 3 '0.9.0'. Lexical order: 3 < 1 < 2. `.greaterOrEqual('1.2.0')`
        // matches releases 1 and 2. `.notBetween('1.0.0','1.2.5')` matches
        // release 3 ('0.9.0', below) and release 2 ('1.3.0-beta.1', above);
        // release 1 ('1.2.0') is inside the range.
        const expectedGe = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedGe)
        const ge = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.greaterOrEqual('1.2.0'))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where version >= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.2.0",
          ]
        `)
        assertType<Exact<typeof ge, Array<{ id: number }>>>()
        expect(ge).toEqual(expectedGe)

        const expectedNot = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedNot)
        const notRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.notBetween('1.0.0', '1.2.5'))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where version not between ? and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.0.0",
            "1.2.5",
          ]
        `)
        expect(notRows).toEqual(expectedNot)
    })

    test('uuid-single-bound-comparisons', async () => {
        // The four single-bound ordered comparisons on a uuid column with a
        // CONST operand. external_ref: issue 1 -> 0a8f9c1e-…, issue 2 ->
        // 7b3e9d20-…, issues 3,4 -> NULL. The bound `50000000-…` separates the
        // two refs by the first hex nibble (byte and lexical order agree there),
        // so `.lessThan(50…)` / `.lessOrEqual(50…)` match issue 1 (0a) and
        // `.greaterThan(50…)` / `.greaterOrEqual(50…)` match issue 2 (7b); the
        // NULL rows are excluded by NULL semantics from every comparison.
        const mid = '50000000-0000-0000-0000-000000000000'

        const expectedLt = [{ id: 1 }]
        ctx.mockNext(expectedLt)
        const lt = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.lessThan(mid))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref < ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50000000-0000-0000-0000-000000000000",
          ]
        `)
        assertType<Exact<typeof lt, Array<{ id: number }>>>()
        expect(lt).toEqual(expectedLt)

        const expectedGt = [{ id: 2 }]
        ctx.mockNext(expectedGt)
        const gt = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.greaterThan(mid))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50000000-0000-0000-0000-000000000000",
          ]
        `)
        expect(gt).toEqual(expectedGt)

        const expectedLe = [{ id: 1 }]
        ctx.mockNext(expectedLe)
        const le = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.lessOrEqual(mid))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref <= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50000000-0000-0000-0000-000000000000",
          ]
        `)
        expect(le).toEqual(expectedLe)

        const expectedGe = [{ id: 2 }]
        ctx.mockNext(expectedGe)
        const ge = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.greaterOrEqual(mid))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref >= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50000000-0000-0000-0000-000000000000",
          ]
        `)
        expect(ge).toEqual(expectedGe)
    })

    test('customDouble-in-subquery-not-in-subquery', async () => {
        // The subquery overload of IN / NOT IN over a customDouble ('Money')
        // column. The inner query selects worklog 2's billed_amount (50); the
        // outer keeps worklogs whose billed_amount is in / not in that set.
        // billed_amount: worklog 1 -> 200, 2 -> 50, 3 -> 200.
        const amountOfWorklog2 = ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(2))
            .selectOneColumn(tIssueWorklog.billedAmount)

        const expectedIn = [{ id: 2 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.in(amountOfWorklog2))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billed_amount in (select billed_amount as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedNotIn = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedNotIn)
        const notInRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.notIn(amountOfWorklog2))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billed_amount not in (select billed_amount as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(notInRows).toEqual(expectedNotIn)
    })

    // Plain localDateTime — tOrganization.createdAt (required):
    //   org 1 -> 2023-06-15 08:00:00, org 2 -> 2023-09-20 14:30:00 (the seed sets
    //   these as explicit, distinct timestamps so equality / membership / range
    //   comparisons are deterministic). Each test projects only the int PK, so
    //   no TZ-shifted temporal VALUE is read back; the const operands are built
    //   with new Date(Date.UTC(...)) under the suite's forced TZ=UTC.
    // ------------------------------------------------------------------

    test('localDateTime-equals-not-equals', async () => {
        // `.equals(2023-06-15 08:00)` matches org 1; `.notEquals(...)` matches
        // org 2 (created_at is non-null on every org).
        const dt = new Date(Date.UTC(2023, 5, 15, 8, 0, 0))
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.createdAt.equals(dt))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where created_at = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2023-06-15 08:00:00",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNe = [{ id: 2 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.createdAt.notEquals(dt))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where created_at <> ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2023-06-15 08:00:00",
          ]
        `)
        expect(ne).toEqual(expectedNe)
    })

    test('localDateTime-is-is-not', async () => {
        // `.is` / `.isNot` (null-safe equality) on a required localDateTime
        // column. `.is(2023-06-15 08:00)` matches org 1; `.isNot(...)` matches
        // org 2.
        const dt = new Date(Date.UTC(2023, 5, 15, 8, 0, 0))
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.createdAt.is(dt))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where created_at is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2023-06-15 08:00:00",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedIsNot = [{ id: 2 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.createdAt.isNot(dt))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where created_at is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2023-06-15 08:00:00",
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    test('localDateTime-in-array-in-n', async () => {
        // `.in([2023-06-15 08:00, 2023-09-20 14:30])` matches orgs 1 and 2;
        // `.inN(2023-06-15 08:00)` matches org 1 only.
        const dt1 = new Date(Date.UTC(2023, 5, 15, 8, 0, 0))
        const dt2 = new Date(Date.UTC(2023, 8, 20, 14, 30, 0))
        const expectedIn = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.createdAt.in([dt1, dt2]))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where created_at in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2023-06-15 08:00:00",
            "2023-09-20 14:30:00",
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedInN = [{ id: 1 }]
        ctx.mockNext(expectedInN)
        const inNRows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.createdAt.inN(dt1))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where created_at in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2023-06-15 08:00:00",
          ]
        `)
        expect(inNRows).toEqual(expectedInN)
    })

    test('localDateTime-between-not-between', async () => {
        // `.between(2023-01-01, 2023-07-01)` matches org 1 (06-15); org 2
        // (09-20) is out of range. `.notBetween(...)` matches org 2.
        const lo = new Date(Date.UTC(2023, 0, 1, 0, 0, 0))
        const hi = new Date(Date.UTC(2023, 6, 1, 0, 0, 0))
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.createdAt.between(lo, hi))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where created_at between ? and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2023-01-01 00:00:00",
            "2023-07-01 00:00:00",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNot = [{ id: 2 }]
        ctx.mockNext(expectedNot)
        const notRows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.createdAt.notBetween(lo, hi))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where created_at not between ? and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2023-01-01 00:00:00",
            "2023-07-01 00:00:00",
          ]
        `)
        expect(notRows).toEqual(expectedNot)
    })

    // ==================================================================
    // The Equalable + Comparable surface on the REQUIRED
    // custom-temporal / localTime receivers publishedAt (customLocalDateTime
    // 'PublishStamp') and reviewTime (plain localTime). Each test
    // exercises equals / is / between / a single-bound ordered comparison / in
    // with CONST operands so the whole comparison surface per receiver is
    // pinned. Const operands are built with new Date(Date.UTC(...)) under the
    // suite's forced TZ=UTC; the projection is the int PK only, so no
    // TZ-shifted temporal VALUE is read back.
    // ==================================================================

    test('required-customLocalDateTime-equalable-comparable-surface', async () => {
        // publishedAt ('PublishStamp', required): release 1 -> 2024-01-16 09:00,
        // 2 -> 2024-02-21 10:00, 3 -> 2024-03-02 11:00. `.equals(rel1)` /
        // `.is(rel1)` match release 1; `.between(2024-02-01, 2024-03-01)` matches
        // release 2; `.greaterOrEqual(2024-02-21 10:00)` matches releases 2 and 3;
        // `.in([rel1, rel3])` matches releases 1 and 3.
        const dt1 = new Date(Date.UTC(2024, 0, 16, 9, 0, 0))
        const dt3 = new Date(Date.UTC(2024, 2, 2, 11, 0, 0))

        const expectedEq = [{ id: 1 }]
        ctx.mockNext(expectedEq)
        const eq = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.publishedAt.equals(dt1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where published_at = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-16 09:00:00",
          ]
        `)
        assertType<Exact<typeof eq, Array<{ id: number }>>>()
        expect(eq).toEqual(expectedEq)

        const expectedIs = [{ id: 1 }]
        ctx.mockNext(expectedIs)
        const is = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.publishedAt.is(dt1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where published_at is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-16 09:00:00",
          ]
        `)
        expect(is).toEqual(expectedIs)

        const lo = new Date(Date.UTC(2024, 1, 1, 0, 0, 0))
        const hi = new Date(Date.UTC(2024, 2, 1, 0, 0, 0))
        const expectedBetween = [{ id: 2 }]
        ctx.mockNext(expectedBetween)
        const between = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.publishedAt.between(lo, hi))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where published_at between ? and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-02-01 00:00:00",
            "2024-03-01 00:00:00",
          ]
        `)
        expect(between).toEqual(expectedBetween)

        const dt2 = new Date(Date.UTC(2024, 1, 21, 10, 0, 0))
        const expectedGe = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedGe)
        const ge = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.publishedAt.greaterOrEqual(dt2))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where published_at >= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-02-21 10:00:00",
          ]
        `)
        expect(ge).toEqual(expectedGe)

        const expectedIn = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.publishedAt.in([dt1, dt3]))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where published_at in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-16 09:00:00",
            "2024-03-02 11:00:00",
          ]
        `)
        expect(inRows).toEqual(expectedIn)
    })

    test('required-localTime-equalable-comparable-surface', async () => {
        // reviewTime (required localTime): review 1 -> 14:30:45 (the only seeded
        // review). `.equals(14:30:45)` / `.is(14:30:45)` match review 1;
        // `.between(14:00, 15:00)` matches review 1; `.greaterOrEqual(14:30:45)`
        // matches review 1 (equal bound is inclusive); `.in([14:30:45])` matches
        // review 1.
        const t = new Date(Date.UTC(1970, 0, 1, 14, 30, 45))

        const expectedEq = [{ id: 1 }]
        ctx.mockNext(expectedEq)
        const eq = await ctx.conn.selectFrom(tProjectReview)
            .where(tProjectReview.reviewTime.equals(t))
            .select({ id: tProjectReview.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_review where review_time = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "14:30:45",
          ]
        `)
        assertType<Exact<typeof eq, Array<{ id: number }>>>()
        expect(eq).toEqual(expectedEq)

        const expectedIs = [{ id: 1 }]
        ctx.mockNext(expectedIs)
        const is = await ctx.conn.selectFrom(tProjectReview)
            .where(tProjectReview.reviewTime.is(t))
            .select({ id: tProjectReview.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_review where review_time is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "14:30:45",
          ]
        `)
        expect(is).toEqual(expectedIs)

        const lo = new Date(Date.UTC(1970, 0, 1, 14, 0, 0))
        const hi = new Date(Date.UTC(1970, 0, 1, 15, 0, 0))
        const expectedBetween = [{ id: 1 }]
        ctx.mockNext(expectedBetween)
        const between = await ctx.conn.selectFrom(tProjectReview)
            .where(tProjectReview.reviewTime.between(lo, hi))
            .select({ id: tProjectReview.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_review where review_time between ? and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "14:00:00",
            "15:00:00",
          ]
        `)
        expect(between).toEqual(expectedBetween)

        const expectedGe = [{ id: 1 }]
        ctx.mockNext(expectedGe)
        const ge = await ctx.conn.selectFrom(tProjectReview)
            .where(tProjectReview.reviewTime.greaterOrEqual(t))
            .select({ id: tProjectReview.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_review where review_time >= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "14:30:45",
          ]
        `)
        expect(ge).toEqual(expectedGe)

        const expectedIn = [{ id: 1 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tProjectReview)
            .where(tProjectReview.reviewTime.in([t]))
            .select({ id: tProjectReview.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_review where review_time in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "14:30:45",
          ]
        `)
        expect(inRows).toEqual(expectedIn)
    })

    // ==================================================================
    // isNull / isNotNull on the six OPTIONAL non-int / non-string
    // leaves. Each pair is made value-validatable against the seed's mix of
    // NULL and non-NULL rows (or, for estimatedHours which is NULL on every
    // seeded row, populated inside a rollback transaction so the null / non-null
    // split is deterministic). The projection is the int PK, so the result type
    // is Array<{ id: number }> and the SQL is the `is null` / `is not null`
    // predicate per leaf.
    // ==================================================================

    test('optional-bigint-is-null-is-not-null', async () => {
        // duration_ms: worklog 1 -> 5400000, 2 -> NULL, 3 -> 1800000.
        // `.isNull()` matches worklog 2; `.isNotNull()` matches worklogs 1 and 3.
        const expectedNull = [{ id: 2 }]
        ctx.mockNext(expectedNull)
        const nullRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.isNull())
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms is null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof nullRows, Array<{ id: number }>>>()
        expect(nullRows).toEqual(expectedNull)

        const expectedNotNull = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedNotNull)
        const notNullRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.isNotNull())
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms is not null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(notNullRows).toEqual(expectedNotNull)
    })

    test('optional-localTime-is-null-is-not-null', async () => {
        // started_at is set on every seeded worklog, so `.isNull()` matches none
        // and `.isNotNull()` matches all three worklogs.
        const expectedNull: Array<{ id: number }> = []
        ctx.mockNext(expectedNull)
        const nullRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.isNull())
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at is null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof nullRows, Array<{ id: number }>>>()
        expect(nullRows).toEqual(expectedNull)

        const expectedNotNull = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expectedNotNull)
        const notNullRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.isNotNull())
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at is not null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(notNullRows).toEqual(expectedNotNull)
    })

    test('optional-double-is-null-is-not-null', async () => {
        // estimated_hours is NULL on every seeded issue. Inside a rollback
        // transaction set issue 1 -> 2.5 (the rest stay NULL). `.isNull()` then
        // matches issues 2,3,4; `.isNotNull()` matches issue 1.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 2.5 }).where(tIssue.id.equals(1)).executeUpdate()

            const expectedNull = [{ id: 2 }, { id: 3 }, { id: 4 }]
            ctx.mockNext(expectedNull)
            const nullRows = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.isNull())
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours is null order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof nullRows, Array<{ id: number }>>>()
            expect(nullRows).toEqual(expectedNull)

            const expectedNotNull = [{ id: 1 }]
            ctx.mockNext(expectedNotNull)
            const notNullRows = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.isNotNull())
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours is not null order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            expect(notNullRows).toEqual(expectedNotNull)
        })
    })

    test('optional-uuid-is-null-is-not-null', async () => {
        // external_ref: issue 1,2 set; issues 3,4 NULL. `.isNull()` matches
        // issues 3,4; `.isNotNull()` matches issues 1,2.
        const expectedNull = [{ id: 3 }, { id: 4 }]
        ctx.mockNext(expectedNull)
        const nullRows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.isNull())
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref is null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof nullRows, Array<{ id: number }>>>()
        expect(nullRows).toEqual(expectedNull)

        const expectedNotNull = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedNotNull)
        const notNullRows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.isNotNull())
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref is not null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(notNullRows).toEqual(expectedNotNull)
    })

    test('optional-customUuid-is-null-is-not-null', async () => {
        // signing_key ('SigningKey'): release 1,3 set; release 2 NULL.
        // `.isNull()` matches release 2; `.isNotNull()` matches releases 1,3.
        const expectedNull = [{ id: 2 }]
        ctx.mockNext(expectedNull)
        const nullRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.isNull())
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signing_key is null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof nullRows, Array<{ id: number }>>>()
        expect(nullRows).toEqual(expectedNull)

        const expectedNotNull = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedNotNull)
        const notNullRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.isNotNull())
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signing_key is not null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(notNullRows).toEqual(expectedNotNull)
    })

    test('optional-customLocalDateTime-is-null-is-not-null', async () => {
        // signed_off_at ('SignOffStamp'): release 1,3 set; release 2 NULL.
        // `.isNull()` matches release 2; `.isNotNull()` matches releases 1,3.
        const expectedNull = [{ id: 2 }]
        ctx.mockNext(expectedNull)
        const nullRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.isNull())
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signed_off_at is null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof nullRows, Array<{ id: number }>>>()
        expect(nullRows).toEqual(expectedNull)

        const expectedNotNull = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedNotNull)
        const notNullRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.isNotNull())
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signed_off_at is not null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(notNullRows).toEqual(expectedNotNull)
    })

    // ==================================================================
    // The three mixed `between` overloads (between(TYPE, VALUE),
    // between(VALUE, TYPE), between(VALUE, VALUE)) plus an ordered
    // value-source-COLUMN operand, on a Comparable leaf:
    // bigint duration_ms. The value-source bounds are scalar
    // subqueries selecting a worklog's duration_ms.
    // ==================================================================

    test('bigint-between-mixed-overloads-and-column-operand', async () => {
        // duration_ms: worklog 1 -> 5400000, 2 -> NULL, 3 -> 1800000.
        // loSub selects worklog 3's duration (1800000); hiSub selects worklog 1's
        // duration (5400000). Each `.between(...)` over [1800000, 5400000]
        // matches worklogs 1 and 3 (worklog 2 is NULL). The three overloads mix a
        // const bound with a value-source bound in every position.
        const loSub = ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(3))
            .selectOneColumn(tIssueWorklog.durationMs)
            .forUseAsInlineQueryValue()
        const hiSub = ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(tIssueWorklog.durationMs)
            .forUseAsInlineQueryValue()

        const expectedBoth = [{ id: 1 }, { id: 3 }]
        // between(TYPE, VALUE): const lower bound, value-source upper bound.
        ctx.mockNext(expectedBoth)
        const cv = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.between(1800000n, hiSub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms between ? and (select duration_ms as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1800000,
            1,
          ]
        `)
        assertType<Exact<typeof cv, Array<{ id: number }>>>()
        expect(cv).toEqual(expectedBoth)

        // between(VALUE, TYPE): value-source lower bound, const upper bound.
        ctx.mockNext(expectedBoth)
        const vc = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.between(loSub, 5400000n))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms between (select duration_ms as result from issue_worklog where id = ?) and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            5400000,
          ]
        `)
        expect(vc).toEqual(expectedBoth)

        // between(VALUE, VALUE): both bounds value-sources.
        ctx.mockNext(expectedBoth)
        const vv = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.between(loSub, hiSub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms between (select duration_ms as result from issue_worklog where id = ?) and (select duration_ms as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            1,
          ]
        `)
        expect(vv).toEqual(expectedBoth)

        // Ordered value-source-COLUMN operand: worklog rows whose duration_ms is
        // greater than worklog 3's duration (1800000) -> worklog 1 (5400000).
        const expectedGt = [{ id: 1 }]
        ctx.mockNext(expectedGt)
        const gt = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.greaterThan(loSub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms > (select duration_ms as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        expect(gt).toEqual(expectedGt)
    })

    // ==================================================================
    // The `*IfValue` twins on non-int / non-string leaves. Each
    // `*IfValue` operator is asserted in BOTH branches: the FIRES branch (a
    // present value emits the same predicate as its direct non-If twin — pinned
    // by the same snapshot) and the ELIDES branch (an `undefined` value makes
    // the operator a no-op, so the sole WHERE predicate is dropped and the SQL
    // reduces to the bare SELECT). `is` / `isNot` route through the null-safe
    // `is [not] distinct from` arm.
    // ==================================================================

    test('customLocalDateTime-is-if-value-is-not-if-value-fires-and-elides', async () => {
        // signed_off_at ('SignOffStamp'): release 1 -> 2024-01-14 12:30, 2 ->
        // NULL, 3 -> 2024-02-28 09:00. `.isIfValue(rel1)` fires and matches
        // release 1 — identical SQL to the direct `.is(rel1)`. `.isNotIfValue(
        // rel1)` fires and matches releases 2 (NULL, distinct) and 3 — identical
        // to direct `.isNot(rel1)`. Passing `undefined` elides each predicate.
        const dt1 = new Date(Date.UTC(2024, 0, 14, 12, 30, 0))
        const noDate: Date | undefined = undefined

        const expectedIs = [{ id: 1 }]
        ctx.mockNext(expectedIs)
        const isIf = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.isIfValue(dt1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signed_off_at is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-14 12:30:00",
          ]
        `)
        assertType<Exact<typeof isIf, Array<{ id: number }>>>()
        expect(isIf).toEqual(expectedIs)

        // Direct twin — same SQL + params as the IfValue-with-value above.
        ctx.mockNext(expectedIs)
        const isDirect = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.is(dt1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signed_off_at is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-14 12:30:00",
          ]
        `)
        expect(isDirect).toEqual(expectedIs)

        const expectedIsNot = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedIsNot)
        const isNotIf = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.isNotIfValue(dt1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signed_off_at is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-14 12:30:00",
          ]
        `)
        expect(isNotIf).toEqual(expectedIsNot)

        ctx.mockNext(expectedIsNot)
        const isNotDirect = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.isNot(dt1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signed_off_at is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-14 12:30:00",
          ]
        `)
        expect(isNotDirect).toEqual(expectedIsNot)

        // Elides branch: `undefined` -> the sole WHERE predicate is dropped, so
        // every release is returned.
        const expectedAll = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expectedAll)
        const isElide = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.isIfValue(noDate))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(isElide).toEqual(expectedAll)

        ctx.mockNext(expectedAll)
        const isNotElide = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.isNotIfValue(noDate))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(isNotElide).toEqual(expectedAll)
    })

    test('uuid-not-equals-if-value-not-in-if-value-fires-and-elides', async () => {
        // external_ref: issue 1 -> 0a8f…, 2 -> 7b3e…, issues 3,4 -> NULL.
        // `.notEqualsIfValue(ref1)` fires and matches issue 2 (NULL rows excluded
        // by NULL semantics) — identical SQL to direct `.notEquals(ref1)`.
        // `.notInIfValue([ref1])` fires and matches issue 2 — identical to direct
        // `.notIn([ref1])`. Passing `undefined` / `undefined` elides each.
        const ref1 = '0a8f9c1e-1111-4222-8333-444455556666'
        const noRef: string | undefined = undefined
        const noRefs: string[] | undefined = undefined

        const expectedNe = [{ id: 2 }]
        ctx.mockNext(expectedNe)
        const neIf = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.notEqualsIfValue(ref1))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref <> ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        assertType<Exact<typeof neIf, Array<{ id: number }>>>()
        expect(neIf).toEqual(expectedNe)

        ctx.mockNext(expectedNe)
        const neDirect = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.notEquals(ref1))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref <> ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        expect(neDirect).toEqual(expectedNe)

        ctx.mockNext(expectedNe)
        const notInIf = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.notInIfValue([ref1]))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref not in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        expect(notInIf).toEqual(expectedNe)

        ctx.mockNext(expectedNe)
        const notInDirect = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.notIn([ref1]))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref not in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        expect(notInDirect).toEqual(expectedNe)

        // Elides branch: `undefined` value / array -> the sole WHERE predicate is
        // dropped, so every issue is returned.
        const expectedAll = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expectedAll)
        const neElide = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.notEqualsIfValue(noRef))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(neElide).toEqual(expectedAll)

        ctx.mockNext(expectedAll)
        const notInElide = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.notInIfValue(noRefs))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(notInElide).toEqual(expectedAll)
    })

    test('bigint-ordered-if-value-twins-fires-and-elides', async () => {
        // duration_ms: worklog 1 -> 5400000, 2 -> NULL, 3 -> 1800000.
        // `.lessThanIfValue(5000000n)` fires and matches worklog 3 (1800000) —
        // identical SQL to direct `.lessThan(5000000n)`. `.greaterOrEqualIfValue(
        // 5000000n)` fires and matches worklog 1 (5400000) — identical to direct
        // `.greaterOrEqual(5000000n)`. Passing `undefined` elides each.
        const bound = 5000000n
        const noBound: bigint | undefined = undefined

        const expectedLt = [{ id: 3 }]
        ctx.mockNext(expectedLt)
        const ltIf = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.lessThanIfValue(bound))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms < ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5000000,
          ]
        `)
        assertType<Exact<typeof ltIf, Array<{ id: number }>>>()
        expect(ltIf).toEqual(expectedLt)

        ctx.mockNext(expectedLt)
        const ltDirect = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.lessThan(bound))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms < ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5000000,
          ]
        `)
        expect(ltDirect).toEqual(expectedLt)

        const expectedGe = [{ id: 1 }]
        ctx.mockNext(expectedGe)
        const geIf = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.greaterOrEqualIfValue(bound))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms >= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5000000,
          ]
        `)
        expect(geIf).toEqual(expectedGe)

        ctx.mockNext(expectedGe)
        const geDirect = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.greaterOrEqual(bound))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms >= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5000000,
          ]
        `)
        expect(geDirect).toEqual(expectedGe)

        // Elides branch: `undefined` -> the sole WHERE predicate is dropped, so
        // every worklog is returned.
        const expectedAll = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expectedAll)
        const ltElide = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.lessThanIfValue(noBound))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(ltElide).toEqual(expectedAll)

        ctx.mockNext(expectedAll)
        const geElide = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.greaterOrEqualIfValue(noBound))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(geElide).toEqual(expectedAll)
    })

    // ==================================================================
    // The mixed-variadic `inN(const, value-source)` overload (a const
    // spread with a value-source spread element). duration_ms: worklog 1 ->
    // 5400000, 2 -> NULL, 3 -> 1800000. The const 1800000n plus a scalar
    // subquery selecting worklog 1's duration (5400000) form the set; every
    // non-null worklog whose duration is in {1800000, 5400000} matches ->
    // worklogs 1 and 3 (worklog 2 is NULL).
    // ==================================================================

    test('bigint-in-n-mixed-const-and-value-source', async () => {
        const durOfWorklog1 = ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(tIssueWorklog.durationMs)
            .forUseAsInlineQueryValue()

        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.inN(1800000n, durOfWorklog1))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms in (?, (select duration_ms as result from issue_worklog where id = ?)) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1800000,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    // ==================================================================
    // bigint ordered-const single bounds and plain-string
    // is / isNot with const operands.
    // ==================================================================

    test('bigint-ordered-const-single-bounds', async () => {
        // duration_ms: worklog 1 -> 5400000, 2 -> NULL, 3 -> 1800000.
        // `.lessThan(5000000n)` matches worklog 3; `.greaterOrEqual(5000000n)`
        // matches worklog 1 (worklog 2 is NULL, excluded from both).
        const bound = 5000000n

        const expectedLt = [{ id: 3 }]
        ctx.mockNext(expectedLt)
        const lt = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.lessThan(bound))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms < ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5000000,
          ]
        `)
        assertType<Exact<typeof lt, Array<{ id: number }>>>()
        expect(lt).toEqual(expectedLt)

        const expectedGe = [{ id: 1 }]
        ctx.mockNext(expectedGe)
        const ge = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.greaterOrEqual(bound))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms >= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5000000,
          ]
        `)
        expect(ge).toEqual(expectedGe)
    })

    test('string-is-is-not-const', async () => {
        // title (plain string, non-null): 1 'Update hero copy', 2 'Redesign
        // navbar', 3 'Migrate to ESM', 4 'Document /v2/users'. `.is('Migrate to
        // ESM')` matches issue 3; `.isNot('Migrate to ESM')` matches issues 1,2,4.
        const title = 'Migrate to ESM'

        const expectedIs = [{ id: 3 }]
        ctx.mockNext(expectedIs)
        const is = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.is(title))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Migrate to ESM",
          ]
        `)
        assertType<Exact<typeof is, Array<{ id: number }>>>()
        expect(is).toEqual(expectedIs)

        const expectedIsNot = [{ id: 1 }, { id: 2 }, { id: 4 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.isNot(title))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Migrate to ESM",
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    // ==================================================================
    // The value-source-operand overloads of equals / notEquals on a
    // non-int / non-string leaf (customLocalDateTime signed_off_at). The operand
    // is a scalar subquery selecting release 1's signed_off_at; `.equals(sub)`
    // matches release 1, `.notEquals(sub)` matches release 3 (release 2 is NULL,
    // excluded by NULL semantics).
    // ==================================================================

    test('customLocalDateTime-equals-not-equals-value-source-operand', async () => {
        const signOffOfRelease1 = ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(tProjectRelease.signedOffAt)
            .forUseAsInlineQueryValue()

        const expectedEq = [{ id: 1 }]
        ctx.mockNext(expectedEq)
        const eq = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.equals(signOffOfRelease1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signed_off_at = (select signed_off_at as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof eq, Array<{ id: number }>>>()
        expect(eq).toEqual(expectedEq)

        const expectedNe = [{ id: 3 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.notEquals(signOffOfRelease1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signed_off_at <> (select signed_off_at as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(ne).toEqual(expectedNe)
    })

    // ==================================================================
    // The variadic `notInN` overload on a non-int leaf (uuid
    // external_ref). external_ref: issue 1 -> 0a8f…, 2 -> 7b3e…, 3,4 -> NULL.
    // `.notInN(ref1)` matches issue 2 (NULL rows are excluded by NULL semantics).
    // ==================================================================

    test('uuid-not-in-n', async () => {
        const ref1 = '0a8f9c1e-1111-4222-8333-444455556666'
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.notInN(ref1))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref not in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    // ==================================================================
    // The value-source-operand overload of `is` (null-safe equality)
    // on the enum / custom / customUuid leaves. The operand is the column itself
    // (a column-vs-column self-comparison): `activity.is(activity)` matches every
    // worklog (activity is required); `channel.is(channel)` matches every release
    // (channel is required); `signingKey.is(signingKey)` matches every release —
    // NULL is not distinct from NULL under `is`, so release 2 (NULL) matches too.
    // ==================================================================

    test('is-value-source-operand-enum-custom-customUuid', async () => {
        const expectedWorklogs = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expectedWorklogs)
        const enumRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.is(tIssueWorklog.activity))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where activity is activity order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof enumRows, Array<{ id: number }>>>()
        expect(enumRows).toEqual(expectedWorklogs)

        const expectedReleases = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expectedReleases)
        const customRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.is(tProjectRelease.channel))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where channel is channel order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(customRows).toEqual(expectedReleases)

        ctx.mockNext(expectedReleases)
        const customUuidRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.is(tProjectRelease.signingKey))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signing_key is signing_key order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(customUuidRows).toEqual(expectedReleases)
    })
    test('customInt-ordered-comparison-and-mixed-between-value-source-operand', async () => {
        // customInt cost_cents: worklog 1 -> 100, 2 -> 100, 3 -> 400. loSub
        // selects worklog 1's cost (100), hiSub worklog 3's cost (400). The
        // four ordered comparisons and the three mixed `between` overloads all
        // take a scalar-subquery value-source in at least one operand position.
        const loSub = ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(tIssueWorklog.costCents)
            .forUseAsInlineQueryValue()
        const hiSub = ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(3))
            .selectOneColumn(tIssueWorklog.costCents)
            .forUseAsInlineQueryValue()

        // greaterThan(loSub=100) -> worklog 3 (400).
        const expectedGt = [{ id: 3 }]
        ctx.mockNext(expectedGt)
        const gt = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.greaterThan(loSub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents > (select cost_cents as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof gt, Array<{ id: number }>>>()
        expect(gt).toEqual(expectedGt)

        // lessThan(hiSub=400) -> worklogs 1, 2 (100).
        const expectedLt = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedLt)
        const lt = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.lessThan(hiSub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents < (select cost_cents as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        expect(lt).toEqual(expectedLt)

        // lessOrEqual(loSub=100) -> worklogs 1, 2.
        const expectedLe = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedLe)
        const le = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.lessOrEqual(loSub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents <= (select cost_cents as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(le).toEqual(expectedLe)

        // greaterOrEqual(hiSub=400) -> worklog 3.
        const expectedGe = [{ id: 3 }]
        ctx.mockNext(expectedGe)
        const ge = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.greaterOrEqual(hiSub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents >= (select cost_cents as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        expect(ge).toEqual(expectedGe)

        // Mixed between over [100, 400] matches every worklog (1, 2, 3).
        const expectedBetween = [{ id: 1 }, { id: 2 }, { id: 3 }]
        // between(TYPE, VALUE): const lower, value-source upper.
        ctx.mockNext(expectedBetween)
        const cv = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.between(100, hiSub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents between ? and (select cost_cents as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
            3,
          ]
        `)
        expect(cv).toEqual(expectedBetween)

        // between(VALUE, TYPE): value-source lower, const upper.
        ctx.mockNext(expectedBetween)
        const vc = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.between(loSub, 400))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents between (select cost_cents as result from issue_worklog where id = ?) and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            400,
          ]
        `)
        expect(vc).toEqual(expectedBetween)

        // between(VALUE, VALUE): both bounds value-sources.
        ctx.mockNext(expectedBetween)
        const vv = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.between(loSub, hiSub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents between (select cost_cents as result from issue_worklog where id = ?) and (select cost_cents as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        expect(vv).toEqual(expectedBetween)
    })

    test('uuid-ordered-comparison-and-mixed-between-value-source-operand', async () => {
        // uuid external_ref: issue 1 -> 0a…, 2 -> 7b…, 3/4 -> NULL. loSub
        // selects issue 1's ref (0a…), hiSub issue 2's ref (7b…). The bounds
        // are separated by the first hex nibble, where byte and lexical order
        // agree, so this matches on both uuid-typed and text-typed engines.
        const loSub = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.externalRef)
            .forUseAsInlineQueryValue()
        const hiSub = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .selectOneColumn(tIssue.externalRef)
            .forUseAsInlineQueryValue()
        const lo = '0a8f9c1e-1111-4222-8333-444455556666'
        const hi = '7b3e9d20-2222-4c55-9b66-dddd00009999'

        // greaterThan(loSub=0a) -> issue 2 (7b).
        const expectedGt = [{ id: 2 }]
        ctx.mockNext(expectedGt)
        const gt = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.greaterThan(loSub))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref > (select external_ref as result from issue where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof gt, Array<{ id: number }>>>()
        expect(gt).toEqual(expectedGt)

        // lessThan(hiSub=7b) -> issue 1 (0a).
        const expectedLt = [{ id: 1 }]
        ctx.mockNext(expectedLt)
        const lt = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.lessThan(hiSub))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref < (select external_ref as result from issue where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(lt).toEqual(expectedLt)

        // Mixed between over [0a, 7b] matches issues 1 and 2 (3/4 are NULL).
        const expectedBetween = [{ id: 1 }, { id: 2 }]
        // between(TYPE, VALUE): const lower, value-source upper.
        ctx.mockNext(expectedBetween)
        const cv = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.between(lo, hiSub))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref between ? and (select external_ref as result from issue where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
            2,
          ]
        `)
        expect(cv).toEqual(expectedBetween)

        // between(VALUE, TYPE): value-source lower, const upper.
        ctx.mockNext(expectedBetween)
        const vc = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.between(loSub, hi))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref between (select external_ref as result from issue where id = ?) and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "7b3e9d20-2222-4c55-9b66-dddd00009999",
          ]
        `)
        expect(vc).toEqual(expectedBetween)

        // between(VALUE, VALUE): both bounds value-sources.
        ctx.mockNext(expectedBetween)
        const vv = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.between(loSub, hiSub))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref between (select external_ref as result from issue where id = ?) and (select external_ref as result from issue where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        expect(vv).toEqual(expectedBetween)
    })

    test('customComparable-ordered-comparison-value-source-operand', async () => {
        // customComparable version ('Semver'): release 1 -> 1.2.0, 2 ->
        // 1.3.0-beta.1, 3 -> 0.9.0. Lexical order 3 < 1 < 2. sub selects
        // release 1's version ('1.2.0').
        const sub = ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(tProjectRelease.version)
            .forUseAsInlineQueryValue()

        // greaterOrEqual(sub='1.2.0') -> releases 1 and 2.
        const expectedGe = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedGe)
        const ge = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.greaterOrEqual(sub))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where version >= (select version as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof ge, Array<{ id: number }>>>()
        expect(ge).toEqual(expectedGe)

        // lessThan(sub='1.2.0') -> release 3 ('0.9.0').
        const expectedLt = [{ id: 3 }]
        ctx.mockNext(expectedLt)
        const lt = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.lessThan(sub))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where version < (select version as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(lt).toEqual(expectedLt)
    })

    test('customLocalDateTime-ordered-comparison-value-source-operand', async () => {
        // customLocalDateTime published_at ('PublishStamp'): release 1 ->
        // 2024-01-16 09:00, 2 -> 2024-02-21 10:00, 3 -> 2024-03-02 11:00.
        // sub selects release 2's published_at.
        const sub = ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(2))
            .selectOneColumn(tProjectRelease.publishedAt)
            .forUseAsInlineQueryValue()

        // greaterThan(sub=release 2) -> release 3.
        const expectedGt = [{ id: 3 }]
        ctx.mockNext(expectedGt)
        const gt = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.publishedAt.greaterThan(sub))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where published_at > (select published_at as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof gt, Array<{ id: number }>>>()
        expect(gt).toEqual(expectedGt)

        // lessThan(sub=release 2) -> release 1.
        const expectedLt = [{ id: 1 }]
        ctx.mockNext(expectedLt)
        const lt = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.publishedAt.lessThan(sub))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where published_at < (select published_at as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(lt).toEqual(expectedLt)
    })

    test('double-ordered-comparison-value-source-operand', async () => {
        // double estimated_hours (NULL in the seed). Set issue 1 -> 2.5, issue
        // 2 -> 7.5 inside a rollback, then compare against a value-source
        // (issue 1's estimated_hours). The SELECT is the last statement so
        // ctx.lastSql captures it.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 2.5 }).where(tIssue.id.equals(1)).executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 7.5 }).where(tIssue.id.equals(2)).executeUpdate()

            const sub = ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .selectOneColumn(tIssue.estimatedHours)
                .forUseAsInlineQueryValue()

            // greaterThan(sub=2.5) -> issue 2 (7.5).
            const expectedGt = [{ id: 2 }]
            ctx.mockNext(expectedGt)
            const gt = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.greaterThan(sub))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours > (select estimated_hours as result from issue where id = ?) order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof gt, Array<{ id: number }>>>()
            expect(gt).toEqual(expectedGt)

            // lessOrEqual(sub=2.5) -> issue 1 (2.5).
            const expectedLe = [{ id: 1 }]
            ctx.mockNext(expectedLe)
            const le = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.lessOrEqual(sub))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours <= (select estimated_hours as result from issue where id = ?) order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            expect(le).toEqual(expectedLe)
        })
    })

    test('customInt-customDouble-if-value-fires-and-elides', async () => {
        // The `*IfValue` shape family has no customInt / customDouble coverage.
        // customInt cost_cents: worklog 3 -> 400. customDouble billed_amount:
        // worklog 2 -> 50. `.equalsIfValue(v)` with a present value emits the
        // same predicate as direct `.equals(v)` (pinned by the same snapshot);
        // `.equalsIfValue(undefined)` elides the predicate, reducing to the bare
        // SELECT.
        const noNum: number | undefined = undefined

        // customInt fires -> worklog 3, identical to direct .equals(400).
        const expectedCost = [{ id: 3 }]
        ctx.mockNext(expectedCost)
        const costIf = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.equalsIfValue(400))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            400,
          ]
        `)
        assertType<Exact<typeof costIf, Array<{ id: number }>>>()
        expect(costIf).toEqual(expectedCost)

        ctx.mockNext(expectedCost)
        const costDirect = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.equals(400))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            400,
          ]
        `)
        expect(costDirect).toEqual(expectedCost)

        // customInt elides -> every worklog.
        const expectedAll = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expectedAll)
        const costElide = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.equalsIfValue(noNum))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(costElide).toEqual(expectedAll)

        // customDouble fires -> worklog 2, identical to direct .equals(50).
        const expectedBilled = [{ id: 2 }]
        ctx.mockNext(expectedBilled)
        const billedIf = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.equalsIfValue(50))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billed_amount = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
          ]
        `)
        expect(billedIf).toEqual(expectedBilled)

        // customDouble elides -> every worklog.
        ctx.mockNext(expectedAll)
        const billedElide = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.equalsIfValue(noNum))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(billedElide).toEqual(expectedAll)
    })

    test('numeric-custom-equals-value-source-operand', async () => {
        // The `.equals(value-source)` overload on the numeric-custom leaves
        // (the const-operand `.equals` is covered above; the value-source
        // overload is covered elsewhere only on temporal / string leaves).
        // customInt cost_cents: worklog 3 -> 400; sub selects it, so
        // `.equals(sub)` matches worklog 3. customDouble billed_amount: worklog
        // 2 -> 50; sub selects it, so `.equals(sub)` matches worklog 2.
        const costSub = ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(3))
            .selectOneColumn(tIssueWorklog.costCents)
            .forUseAsInlineQueryValue()
        const expectedCost = [{ id: 3 }]
        ctx.mockNext(expectedCost)
        const costRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.equals(costSub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents = (select cost_cents as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof costRows, Array<{ id: number }>>>()
        expect(costRows).toEqual(expectedCost)

        const billedSub = ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(2))
            .selectOneColumn(tIssueWorklog.billedAmount)
            .forUseAsInlineQueryValue()
        const expectedBilled = [{ id: 2 }]
        ctx.mockNext(expectedBilled)
        const billedRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.equals(billedSub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billed_amount = (select billed_amount as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(billedRows).toEqual(expectedBilled)
    })

    // ------------------------------------------------------------------
    // customUuid ordered-Comparable arm — tProjectRelease.signingKey
    // (optional customUuid 'SigningKey'): release 1 -> 0a8f9c1e-…, 2 -> NULL,
    // 3 -> 7b3e9d20-…. between / notBetween / single ordered bounds on this
    // branded leaf. The operands are value-source SUBQUERIES over the same
    // customUuid column (release 1's key = loSub, release 3's key = hiSub) so both
    // sides marshal identically and the comparison rests only on release1 < release3
    // — true under every engine's uuid ordering (the leading nibble 0a<7b and the
    // SQL Server / Oracle byte-group order agree), unlike string-literal bounds,
    // whose lexical assumption diverges from the engine-native uuid ordering.
    // ------------------------------------------------------------------

    test('customUuid-ordered-comparison-value-source-operand', async () => {
        // loSub = release 1's signing_key (0a…), hiSub = release 3's (7b…).
        // greaterThan(loSub) -> release 3; lessThan(hiSub) -> release 1; between
        // [loSub, hiSub] -> releases 1 and 3 (inclusive); notBetween -> none
        // (release 2 is NULL); greaterOrEqual(loSub) / lessOrEqual(hiSub) ->
        // releases 1 and 3.
        const loSub = ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(tProjectRelease.signingKey)
            .forUseAsInlineQueryValue()
        const hiSub = ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(3))
            .selectOneColumn(tProjectRelease.signingKey)
            .forUseAsInlineQueryValue()

        const expectedGt = [{ id: 3 }]
        ctx.mockNext(expectedGt)
        const gt = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.greaterThan(loSub))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signing_key > (select signing_key as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof gt, Array<{ id: number }>>>()
        expect(gt).toEqual(expectedGt)

        const expectedLt = [{ id: 1 }]
        ctx.mockNext(expectedLt)
        const lt = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.lessThan(hiSub))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signing_key < (select signing_key as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        expect(lt).toEqual(expectedLt)

        const expectedBetween = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedBetween)
        const bt = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.between(loSub, hiSub))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signing_key between (select signing_key as result from project_release where id = ?) and (select signing_key as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        expect(bt).toEqual(expectedBetween)

        // notBetween over the same [loSub, hiSub] excludes both non-null keys
        // (each is in range) and NULL never satisfies it -> empty.
        const expectedNotBetween: Array<{ id: number }> = []
        ctx.mockNext(expectedNotBetween)
        const nb = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.notBetween(loSub, hiSub))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signing_key not between (select signing_key as result from project_release where id = ?) and (select signing_key as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        expect(nb).toEqual(expectedNotBetween)

        const expectedGe = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedGe)
        const ge = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.greaterOrEqual(loSub))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signing_key >= (select signing_key as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(ge).toEqual(expectedGe)

        const expectedLe = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedLe)
        const le = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.lessOrEqual(hiSub))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signing_key <= (select signing_key as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        expect(le).toEqual(expectedLe)
    })

    // ==================================================================
    // Direct-fluent membership (notInN, in/notIn(subquery)), value-source-operand
    // equality and the *IfValue twins on the Equalable-only branded leaves:
    //   enum   — tIssueWorklog.activity ('WorklogActivity'): 1 'coding', 2
    //            'review', 3 'meeting'.
    //   custom — tProjectRelease.channel ('ReleaseChannel'): 1 'stable', 2
    //            'beta', 3 'canary'.
    // ==================================================================

    test('enum-not-in-n', async () => {
        // `.notInN('coding')` — the variadic NOT IN on an enum column — matches
        // worklogs 2 ('review') and 3 ('meeting').
        const expected = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.notInN('coding'))
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

    test('equals-value-source-operand-enum-custom', async () => {
        // The value-source-operand overload of `.equals(...)` on the branded
        // Equalable leaves: comparing the column to itself is trivially true for
        // every row, and pins `activity = activity` / `channel = channel` emission.
        const allWorklogs = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(allWorklogs)
        const enumRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.equals(tIssueWorklog.activity))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where activity = activity order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof enumRows, Array<{ id: number }>>>()
        expect(enumRows).toEqual(allWorklogs)

        const allReleases = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(allReleases)
        const customRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.equals(tProjectRelease.channel))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where channel = channel order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(customRows).toEqual(allReleases)
    })

    test('enum-not-equals-if-value-not-in-if-value-fires-and-elides', async () => {
        // `.notEqualsIfValue('coding')` fires -> worklogs 2, 3; `.notInIfValue(
        // ['coding'])` fires -> worklogs 2, 3. Passing `undefined` elides each,
        // dropping the sole WHERE so every worklog is returned.
        const expected = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const neIf = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.notEqualsIfValue('coding'))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where activity <> ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "coding",
          ]
        `)
        assertType<Exact<typeof neIf, Array<{ id: number }>>>()
        expect(neIf).toEqual(expected)

        ctx.mockNext(expected)
        const notInIf = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.notInIfValue(['coding']))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where activity not in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "coding",
          ]
        `)
        expect(notInIf).toEqual(expected)

        const all = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(all)
        const neElide = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.notEqualsIfValue(undefined))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(neElide).toEqual(all)

        ctx.mockNext(all)
        const notInElide = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.notInIfValue(undefined))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(notInElide).toEqual(all)
    })

    test('custom-in-n-not-in-n', async () => {
        // `.inN('stable')` matches release 1; `.notInN('canary')` matches releases
        // 1 ('stable') and 2 ('beta').
        const expectedIn = [{ id: 1 }]
        ctx.mockNext(expectedIn)
        const inN = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.inN('stable'))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where channel in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "stable",
          ]
        `)
        assertType<Exact<typeof inN, Array<{ id: number }>>>()
        expect(inN).toEqual(expectedIn)

        const expectedNotIn = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedNotIn)
        const notInN = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.notInN('canary'))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where channel not in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "canary",
          ]
        `)
        expect(notInN).toEqual(expectedNotIn)
    })

    test('custom-in-subquery-not-in-subquery', async () => {
        // The subquery IN / NOT IN overload on a `custom` (ReleaseChannel) column.
        // The inner query selects the channel of release 1 ('stable'); the outer
        // keeps releases whose channel is in / not in that set.
        const channelOfRelease1 = ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(tProjectRelease.channel)

        const expectedIn = [{ id: 1 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.in(channelOfRelease1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where channel in (select channel as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedNotIn = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedNotIn)
        const notInRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.notIn(channelOfRelease1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where channel not in (select channel as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(notInRows).toEqual(expectedNotIn)
    })

    test('custom-equals-if-value-not-in-if-value-fires-and-elides', async () => {
        // `.equalsIfValue('stable')` fires -> release 1; `.notInIfValue(['canary'])`
        // fires -> releases 1, 2. Passing `undefined` elides each.
        const expectedEq = [{ id: 1 }]
        ctx.mockNext(expectedEq)
        const eqIf = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.equalsIfValue('stable'))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where channel = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "stable",
          ]
        `)
        assertType<Exact<typeof eqIf, Array<{ id: number }>>>()
        expect(eqIf).toEqual(expectedEq)

        const expectedNotIn = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedNotIn)
        const notInIf = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.notInIfValue(['canary']))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where channel not in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "canary",
          ]
        `)
        expect(notInIf).toEqual(expectedNotIn)

        const all = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(all)
        const eqElide = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.equalsIfValue(undefined))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(eqElide).toEqual(all)

        ctx.mockNext(all)
        const notInElide = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.notInIfValue(undefined))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release order by id"`)
        expect(notInElide).toEqual(all)
    })

    // ------------------------------------------------------------------
    // plain boolean — tIssueWorklog.billable (optional boolean):
    //   worklog 1 -> TRUE, 2 -> FALSE, 3 -> NULL.
    // ------------------------------------------------------------------

    test('plain-boolean-is-not-and-is-not-null', async () => {
        // `.isNot(true)` is the null-safe negation: it matches FALSE *and* NULL
        // (worklogs 2, 3) — unlike `notEquals(true)`, which NULL semantics would
        // exclude. `.isNotNull()` matches every non-null row (worklogs 1, 2).
        const expectedIsNot = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.isNot(true))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billable is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof isNot, Array<{ id: number }>>>()
        expect(isNot).toEqual(expectedIsNot)

        const expectedNotNull = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedNotNull)
        const notNull = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.isNotNull())
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billable is not null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof notNull, Array<{ id: number }>>>()
        expect(notNull).toEqual(expectedNotNull)
    })
    test('boolean-not-in-array-in-n-not-in-n', async () => {
        // The boolean in-family (`notIn` / `inN` / `notInN`).
        // billable (plain boolean): worklog 1 -> true, 2 -> false, 3 -> null.
        // `.notIn([false])` keeps the true rows (the false and null rows drop);
        // `.inN(false)` keeps the false rows; `.notInN(true)` keeps the non-true,
        // non-null rows.
        const expectedNotIn = [{ id: 1 }]
        ctx.mockNext(expectedNotIn)
        const notInRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.notIn([false]))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billable not in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            false,
          ]
        `)
        assertType<Exact<typeof notInRows, Array<{ id: number }>>>()
        expect(notInRows).toEqual(expectedNotIn)

        const expectedInN = [{ id: 2 }]
        ctx.mockNext(expectedInN)
        const inNRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.inN(false))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billable in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            false,
          ]
        `)
        expect(inNRows).toEqual(expectedInN)

        const expectedNotInN = [{ id: 2 }]
        ctx.mockNext(expectedNotInN)
        const notInNRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.notInN(true))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billable not in (?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        expect(notInNRows).toEqual(expectedNotInN)
    })

    test('localDate-in-subquery-not-in-subquery', async () => {
        // The subquery overload of IN / NOT IN over a plain localDate column
        // (work_date). The inner query selects worklog 2's work_date; the outer keeps
        // worklogs whose work_date is in / not in that set. work_dates are distinct
        // (1 -> 2024-03-04, 2 -> 2024-03-05, 3 -> 2024-03-06).
        const workDateOfWorklog2 = ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(2))
            .selectOneColumn(tIssueWorklog.workDate)

        const expectedIn = [{ id: 2 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.in(workDateOfWorklog2))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date in (select work_date as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedNotIn = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedNotIn)
        const notInRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.notIn(workDateOfWorklog2))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date not in (select work_date as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(notInRows).toEqual(expectedNotIn)
    })

    test('localTime-in-subquery-not-in-subquery', async () => {
        // The subquery overload of IN / NOT IN over a plain localTime column
        // (started_at). The inner query selects worklog 2's started_at; the outer
        // keeps worklogs whose started_at is in / not in that set. started_at is
        // distinct and non-null (1 -> 09:15, 2 -> 14:00, 3 -> 10:30).
        const startedAtOfWorklog2 = ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(2))
            .selectOneColumn(tIssueWorklog.startedAt)

        const expectedIn = [{ id: 2 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.in(startedAtOfWorklog2))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at in (select started_at as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedNotIn = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedNotIn)
        const notInRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.notIn(startedAtOfWorklog2))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at not in (select started_at as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(notInRows).toEqual(expectedNotIn)
    })

    test('localDateTime-in-subquery-not-in-subquery', async () => {
        // The subquery overload of IN / NOT IN over a plain localDateTime column
        // (created_at). The inner query selects org 1's created_at; the outer keeps
        // orgs whose created_at is in / not in that set. created_at is distinct
        // (org 1 -> 2023-06-15 08:00, org 2 -> 2023-09-20 14:30).
        const createdAtOfOrg1 = ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .selectOneColumn(tOrganization.createdAt)

        const expectedIn = [{ id: 1 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.createdAt.in(createdAtOfOrg1))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where created_at in (select created_at as result from organization where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedNotIn = [{ id: 2 }]
        ctx.mockNext(expectedNotIn)
        const notInRows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.createdAt.notIn(createdAtOfOrg1))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where created_at not in (select created_at as result from organization where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(notInRows).toEqual(expectedNotIn)
    })

    test('customLocalDate-in-subquery-not-in-subquery', async () => {
        // The subquery overload of IN / NOT IN over a customLocalDate ('ReleaseDay')
        // column (released_on). The inner query selects release 1's released_on; the
        // outer keeps releases whose released_on is in / not in that set. released_on
        // is distinct (1 -> 2024-01-15, 2 -> 2024-02-20, 3 -> 2024-03-01).
        const releasedOnOfRelease1 = ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(tProjectRelease.releasedOn)

        const expectedIn = [{ id: 1 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.in(releasedOnOfRelease1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on in (select released_on as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedNotIn = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedNotIn)
        const notInRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.notIn(releasedOnOfRelease1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on not in (select released_on as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(notInRows).toEqual(expectedNotIn)
    })

    test('customLocalTime-in-subquery-not-in-subquery', async () => {
        // The subquery overload of IN / NOT IN over a customLocalTime ('CutoffClock')
        // column (cutoff_time). The inner query selects release 1's cutoff_time; the
        // outer keeps releases whose cutoff_time is in / not in that set. cutoff_time
        // is distinct (1 -> 17:00, 2 -> 18:30, 3 -> 16:00).
        const cutoffOfRelease1 = ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(tProjectRelease.cutoffTime)

        const expectedIn = [{ id: 1 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.in(cutoffOfRelease1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time in (select cutoff_time as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedNotIn = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedNotIn)
        const notInRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.notIn(cutoffOfRelease1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time not in (select cutoff_time as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(notInRows).toEqual(expectedNotIn)
    })

    test('customLocalDateTime-in-subquery-not-in-subquery', async () => {
        // The subquery overload of IN / NOT IN over a customLocalDateTime
        // ('PublishStamp') column (published_at). The inner query selects release 1's
        // published_at; the outer keeps releases whose published_at is in / not in
        // that set. published_at is distinct and non-null (1 -> 2024-01-16 09:00,
        // 2 -> 2024-02-21 10:00, 3 -> 2024-03-02 11:00).
        const publishedOfRelease1 = ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(tProjectRelease.publishedAt)

        const expectedIn = [{ id: 1 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.publishedAt.in(publishedOfRelease1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where published_at in (select published_at as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedNotIn = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedNotIn)
        const notInRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.publishedAt.notIn(publishedOfRelease1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where published_at not in (select published_at as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(notInRows).toEqual(expectedNotIn)
    })


    test('bigint-equals-not-equals-is-is-not-value-source-operand', async () => {
        // duration_ms: worklog 1 -> 5400000, 2 -> NULL, 3 -> 1800000. sub selects
        // worklog 1's duration (5400000). `.equals(sub)` / `.is(sub)` match worklog
        // 1; `.notEquals(sub)` matches worklog 3 (worklog 2 NULL, excluded by NULL
        // semantics); `.isNot(sub)` matches worklogs 2 (NULL, distinct) and 3.
        const sub = ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(tIssueWorklog.durationMs)
            .forUseAsInlineQueryValue()

        const expectedEq = [{ id: 1 }]
        ctx.mockNext(expectedEq)
        const eq = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.equals(sub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms = (select duration_ms as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof eq, Array<{ id: number }>>>()
        expect(eq).toEqual(expectedEq)

        const expectedNe = [{ id: 3 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.notEquals(sub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms <> (select duration_ms as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(ne).toEqual(expectedNe)

        const expectedIs = [{ id: 1 }]
        ctx.mockNext(expectedIs)
        const is = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.is(sub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms is (select duration_ms as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(is).toEqual(expectedIs)

        const expectedIsNot = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.isNot(sub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms is not (select duration_ms as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    test('string-equals-not-equals-is-is-not-value-source-operand', async () => {
        // title (plain string, non-null): 1 'Update hero copy', 2 'Redesign
        // navbar', 3 'Migrate to ESM', 4 'Document /v2/users'. sub selects issue
        // 3's title. `.equals(sub)` / `.is(sub)` match issue 3; `.notEquals(sub)` /
        // `.isNot(sub)` match issues 1, 2, 4 (no NULLs).
        const sub = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .selectOneColumn(tIssue.title)
            .forUseAsInlineQueryValue()

        const expectedEq = [{ id: 3 }]
        ctx.mockNext(expectedEq)
        const eq = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.equals(sub))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title = (select title as result from issue where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof eq, Array<{ id: number }>>>()
        expect(eq).toEqual(expectedEq)

        const expectedNe = [{ id: 1 }, { id: 2 }, { id: 4 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.notEquals(sub))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title <> (select title as result from issue where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        expect(ne).toEqual(expectedNe)

        const expectedIs = [{ id: 3 }]
        ctx.mockNext(expectedIs)
        const is = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.is(sub))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title is (select title as result from issue where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        expect(is).toEqual(expectedIs)

        const expectedIsNot = [{ id: 1 }, { id: 2 }, { id: 4 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.isNot(sub))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title is not (select title as result from issue where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    test('double-equals-not-equals-is-is-not-value-source-operand', async () => {
        // double estimated_hours (NULL in the seed). Set issue 1 -> 2.5, issue 2
        // -> 7.5 inside a rollback (issues 3, 4 stay NULL), then compare against a
        // value-source (issue 1's estimated_hours = 2.5). `.equals(sub)` /
        // `.is(sub)` match issue 1; `.notEquals(sub)` matches issue 2 (3, 4 NULL,
        // excluded by NULL semantics); `.isNot(sub)` matches issues 2, 3, 4 (the
        // NULLs are distinct from 2.5). The SELECT is the last statement so
        // ctx.lastSql captures it.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 2.5 }).where(tIssue.id.equals(1)).executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 7.5 }).where(tIssue.id.equals(2)).executeUpdate()

            const sub = ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .selectOneColumn(tIssue.estimatedHours)
                .forUseAsInlineQueryValue()

            const expectedEq = [{ id: 1 }]
            ctx.mockNext(expectedEq)
            const eq = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.equals(sub))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours = (select estimated_hours as result from issue where id = ?) order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof eq, Array<{ id: number }>>>()
            expect(eq).toEqual(expectedEq)

            const expectedNe = [{ id: 2 }]
            ctx.mockNext(expectedNe)
            const ne = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.notEquals(sub))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours <> (select estimated_hours as result from issue where id = ?) order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            expect(ne).toEqual(expectedNe)

            const expectedIs = [{ id: 1 }]
            ctx.mockNext(expectedIs)
            const is = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.is(sub))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours is (select estimated_hours as result from issue where id = ?) order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            expect(is).toEqual(expectedIs)

            const expectedIsNot = [{ id: 2 }, { id: 3 }, { id: 4 }]
            ctx.mockNext(expectedIsNot)
            const isNot = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.isNot(sub))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours is not (select estimated_hours as result from issue where id = ?) order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            expect(isNot).toEqual(expectedIsNot)
        })
    })

    test('localDate-equals-not-equals-is-is-not-value-source-operand', async () => {
        // plain localDate work_date (distinct, non-null): worklog 1 -> 2024-03-04,
        // 2 -> 2024-03-05, 3 -> 2024-03-06. sub selects worklog 2's work_date.
        // `.equals(sub)` / `.is(sub)` match worklog 2; `.notEquals(sub)` /
        // `.isNot(sub)` match worklogs 1, 3.
        const sub = ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(2))
            .selectOneColumn(tIssueWorklog.workDate)
            .forUseAsInlineQueryValue()

        const expectedEq = [{ id: 2 }]
        ctx.mockNext(expectedEq)
        const eq = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.equals(sub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date = (select work_date as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof eq, Array<{ id: number }>>>()
        expect(eq).toEqual(expectedEq)

        const expectedNe = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.notEquals(sub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date <> (select work_date as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(ne).toEqual(expectedNe)

        const expectedIs = [{ id: 2 }]
        ctx.mockNext(expectedIs)
        const is = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.is(sub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date is (select work_date as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(is).toEqual(expectedIs)

        const expectedIsNot = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.isNot(sub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date is not (select work_date as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    test('localTime-equals-not-equals-is-is-not-value-source-operand', async () => {
        // plain localTime started_at (distinct, non-null): worklog 1 -> 09:15,
        // 2 -> 14:00, 3 -> 10:30. sub selects worklog 2's started_at.
        // `.equals(sub)` / `.is(sub)` match worklog 2; `.notEquals(sub)` /
        // `.isNot(sub)` match worklogs 1, 3.
        const sub = ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(2))
            .selectOneColumn(tIssueWorklog.startedAt)
            .forUseAsInlineQueryValue()

        const expectedEq = [{ id: 2 }]
        ctx.mockNext(expectedEq)
        const eq = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.equals(sub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at = (select started_at as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof eq, Array<{ id: number }>>>()
        expect(eq).toEqual(expectedEq)

        const expectedNe = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.notEquals(sub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at <> (select started_at as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(ne).toEqual(expectedNe)

        const expectedIs = [{ id: 2 }]
        ctx.mockNext(expectedIs)
        const is = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.is(sub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at is (select started_at as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(is).toEqual(expectedIs)

        const expectedIsNot = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.isNot(sub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at is not (select started_at as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    test('localDateTime-equals-not-equals-is-is-not-value-source-operand', async () => {
        // plain localDateTime created_at (distinct, non-null): org 1 -> 2023-06-15
        // 08:00, org 2 -> 2023-09-20 14:30. sub selects org 1's created_at.
        // `.equals(sub)` / `.is(sub)` match org 1; `.notEquals(sub)` /
        // `.isNot(sub)` match org 2.
        const sub = ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .selectOneColumn(tOrganization.createdAt)
            .forUseAsInlineQueryValue()

        const expectedEq = [{ id: 1 }]
        ctx.mockNext(expectedEq)
        const eq = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.createdAt.equals(sub))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where created_at = (select created_at as result from organization where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof eq, Array<{ id: number }>>>()
        expect(eq).toEqual(expectedEq)

        const expectedNe = [{ id: 2 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.createdAt.notEquals(sub))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where created_at <> (select created_at as result from organization where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(ne).toEqual(expectedNe)

        const expectedIs = [{ id: 1 }]
        ctx.mockNext(expectedIs)
        const is = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.createdAt.is(sub))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where created_at is (select created_at as result from organization where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(is).toEqual(expectedIs)

        const expectedIsNot = [{ id: 2 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.createdAt.isNot(sub))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where created_at is not (select created_at as result from organization where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    test('customInt-not-equals-is-is-not-value-source-operand', async () => {
        // customInt cost_cents (non-null): worklog 1 -> 100, 2 -> 100, 3 -> 400.
        // sub selects worklog 3's cost (400). `.notEquals(sub)` / `.isNot(sub)`
        // match worklogs 1, 2 (both 100); `.is(sub)` matches worklog 3.
        const sub = ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(3))
            .selectOneColumn(tIssueWorklog.costCents)
            .forUseAsInlineQueryValue()

        const expectedNe = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.notEquals(sub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents <> (select cost_cents as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof ne, Array<{ id: number }>>>()
        expect(ne).toEqual(expectedNe)

        const expectedIs = [{ id: 3 }]
        ctx.mockNext(expectedIs)
        const is = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.is(sub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents is (select cost_cents as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        expect(is).toEqual(expectedIs)

        const expectedIsNot = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.isNot(sub))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents is not (select cost_cents as result from issue_worklog where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    test('customLocalTime-equals-not-equals-is-is-not-value-source-operand', async () => {
        // customLocalTime cutoff_time ('CutoffClock', distinct, non-null): release 1
        // -> 17:00, 2 -> 18:30, 3 -> 16:00. sub selects release 1's cutoff_time.
        // `.equals(sub)` / `.is(sub)` match release 1; `.notEquals(sub)` /
        // `.isNot(sub)` match releases 2, 3.
        const sub = ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(tProjectRelease.cutoffTime)
            .forUseAsInlineQueryValue()

        const expectedEq = [{ id: 1 }]
        ctx.mockNext(expectedEq)
        const eq = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.equals(sub))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time = (select cutoff_time as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof eq, Array<{ id: number }>>>()
        expect(eq).toEqual(expectedEq)

        const expectedNe = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.notEquals(sub))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time <> (select cutoff_time as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(ne).toEqual(expectedNe)

        const expectedIs = [{ id: 1 }]
        ctx.mockNext(expectedIs)
        const is = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.is(sub))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time is (select cutoff_time as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(is).toEqual(expectedIs)

        const expectedIsNot = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.isNot(sub))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time is not (select cutoff_time as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    test('customComparable-equals-not-equals-value-source-operand', async () => {
        // customComparable version ('Semver', distinct, non-null): release 1 ->
        // '1.2.0', 2 -> '1.3.0-beta.1', 3 -> '0.9.0'. sub selects release 1's
        // version. (The is/isNot arms are covered with const operands by
        // customComparable-is-is-not; the ordered arms by
        // customComparable-ordered-comparison-value-source-operand.) `.equals(sub)`
        // matches release 1; `.notEquals(sub)` matches releases 2, 3.
        const sub = ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(tProjectRelease.version)
            .forUseAsInlineQueryValue()

        const expectedEq = [{ id: 1 }]
        ctx.mockNext(expectedEq)
        const eq = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.equals(sub))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where version = (select version as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof eq, Array<{ id: number }>>>()
        expect(eq).toEqual(expectedEq)

        const expectedNe = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.notEquals(sub))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where version <> (select version as result from project_release where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(ne).toEqual(expectedNe)
    })

    // ==================================================================
    // The remaining ordered `*IfValue` twins (present-value FIRES + `undefined`
    // ELIDES). Each `*IfValue`-with-value emits the same predicate as its direct
    // twin (pinned by the same snapshot); an `undefined` value drops the sole
    // WHERE predicate, reducing to the bare SELECT.
    // ==================================================================

    test('bigint-ordered-if-value-le-gt-twins-fires-and-elides', async () => {
        // duration_ms: worklog 1 -> 5400000, 2 -> NULL, 3 -> 1800000.
        // `.lessOrEqualIfValue(5000000n)` fires and matches worklog 3 (1800000);
        // `.greaterThanIfValue(5000000n)` fires and matches worklog 1 (5400000)
        // (worklog 2 NULL, excluded from both). `undefined` elides each.
        const bound = 5000000n
        const noBound: bigint | undefined = undefined

        const expectedLe = [{ id: 3 }]
        ctx.mockNext(expectedLe)
        const leIf = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.lessOrEqualIfValue(bound))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms <= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5000000,
          ]
        `)
        assertType<Exact<typeof leIf, Array<{ id: number }>>>()
        expect(leIf).toEqual(expectedLe)

        ctx.mockNext(expectedLe)
        const leDirect = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.lessOrEqual(bound))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms <= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5000000,
          ]
        `)
        expect(leDirect).toEqual(expectedLe)

        const expectedGt = [{ id: 1 }]
        ctx.mockNext(expectedGt)
        const gtIf = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.greaterThanIfValue(bound))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5000000,
          ]
        `)
        expect(gtIf).toEqual(expectedGt)

        ctx.mockNext(expectedGt)
        const gtDirect = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.greaterThan(bound))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5000000,
          ]
        `)
        expect(gtDirect).toEqual(expectedGt)

        const expectedAll = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expectedAll)
        const leElide = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.lessOrEqualIfValue(noBound))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(leElide).toEqual(expectedAll)

        ctx.mockNext(expectedAll)
        const gtElide = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.greaterThanIfValue(noBound))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(gtElide).toEqual(expectedAll)
    })

    test('string-ordered-if-value-twins-fires-and-elides', async () => {
        // title (plain string, non-null): 1 'Update hero copy', 2 'Redesign
        // navbar', 3 'Migrate to ESM', 4 'Document /v2/users'. Lexical order
        // 4 < 3 < 2 < 1. With mid 'Migrate to ESM': lessThan -> 4, greaterThan ->
        // 1,2, lessOrEqual -> 3,4, greaterOrEqual -> 1,2,3. Each `*IfValue` fires
        // identically to its direct twin; `undefined` elides each.
        const mid = 'Migrate to ESM'
        const noStr: string | undefined = undefined

        const expectedLt = [{ id: 4 }]
        ctx.mockNext(expectedLt)
        const ltIf = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.lessThanIfValue(mid))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title < ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Migrate to ESM",
          ]
        `)
        assertType<Exact<typeof ltIf, Array<{ id: number }>>>()
        expect(ltIf).toEqual(expectedLt)

        ctx.mockNext(expectedLt)
        const ltDirect = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.lessThan(mid))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title < ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Migrate to ESM",
          ]
        `)
        expect(ltDirect).toEqual(expectedLt)

        const expectedGt = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedGt)
        const gtIf = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.greaterThanIfValue(mid))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Migrate to ESM",
          ]
        `)
        expect(gtIf).toEqual(expectedGt)

        ctx.mockNext(expectedGt)
        const gtDirect = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.greaterThan(mid))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Migrate to ESM",
          ]
        `)
        expect(gtDirect).toEqual(expectedGt)

        const expectedLe = [{ id: 3 }, { id: 4 }]
        ctx.mockNext(expectedLe)
        const leIf = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.lessOrEqualIfValue(mid))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title <= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Migrate to ESM",
          ]
        `)
        expect(leIf).toEqual(expectedLe)

        ctx.mockNext(expectedLe)
        const leDirect = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.lessOrEqual(mid))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title <= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Migrate to ESM",
          ]
        `)
        expect(leDirect).toEqual(expectedLe)

        const expectedGe = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expectedGe)
        const geIf = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.greaterOrEqualIfValue(mid))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title >= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Migrate to ESM",
          ]
        `)
        expect(geIf).toEqual(expectedGe)

        ctx.mockNext(expectedGe)
        const geDirect = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.greaterOrEqual(mid))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where title >= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Migrate to ESM",
          ]
        `)
        expect(geDirect).toEqual(expectedGe)

        // Elides branch: `undefined` -> the sole WHERE predicate drops, so every
        // issue is returned. Emission is identical across the four operators.
        const expectedAll = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expectedAll)
        const ltElide = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.lessThanIfValue(noStr))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(ltElide).toEqual(expectedAll)

        ctx.mockNext(expectedAll)
        const gtElide = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.greaterThanIfValue(noStr))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(gtElide).toEqual(expectedAll)

        ctx.mockNext(expectedAll)
        const leElide = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.lessOrEqualIfValue(noStr))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(leElide).toEqual(expectedAll)

        ctx.mockNext(expectedAll)
        const geElide = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.greaterOrEqualIfValue(noStr))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(geElide).toEqual(expectedAll)
    })

    test('double-ordered-if-value-twins-fires-and-elides', async () => {
        // double estimated_hours (NULL in the seed). Set issue 1 -> 2.0, 2 -> 4.0,
        // 3 -> 6.0 inside a rollback (issue 4 stays NULL). With bound 4.0:
        // lessThan -> 1, greaterThan -> 3, lessOrEqual -> 1,2, greaterOrEqual ->
        // 2,3. Each `*IfValue` fires identically to its direct twin; `undefined`
        // elides each, returning every issue.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 2.0 }).where(tIssue.id.equals(1)).executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 4.0 }).where(tIssue.id.equals(2)).executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 6.0 }).where(tIssue.id.equals(3)).executeUpdate()

            const bound = 4.0
            const noNum: number | undefined = undefined

            const expectedLt = [{ id: 1 }]
            ctx.mockNext(expectedLt)
            const ltIf = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.lessThanIfValue(bound))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours < ? order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            assertType<Exact<typeof ltIf, Array<{ id: number }>>>()
            expect(ltIf).toEqual(expectedLt)

            ctx.mockNext(expectedLt)
            const ltDirect = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.lessThan(bound))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours < ? order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            expect(ltDirect).toEqual(expectedLt)

            const expectedGt = [{ id: 3 }]
            ctx.mockNext(expectedGt)
            const gtIf = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.greaterThanIfValue(bound))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours > ? order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            expect(gtIf).toEqual(expectedGt)

            ctx.mockNext(expectedGt)
            const gtDirect = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.greaterThan(bound))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours > ? order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            expect(gtDirect).toEqual(expectedGt)

            const expectedLe = [{ id: 1 }, { id: 2 }]
            ctx.mockNext(expectedLe)
            const leIf = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.lessOrEqualIfValue(bound))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours <= ? order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            expect(leIf).toEqual(expectedLe)

            ctx.mockNext(expectedLe)
            const leDirect = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.lessOrEqual(bound))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours <= ? order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            expect(leDirect).toEqual(expectedLe)

            const expectedGe = [{ id: 2 }, { id: 3 }]
            ctx.mockNext(expectedGe)
            const geIf = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.greaterOrEqualIfValue(bound))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours >= ? order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            expect(geIf).toEqual(expectedGe)

            ctx.mockNext(expectedGe)
            const geDirect = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.greaterOrEqual(bound))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where estimated_hours >= ? order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            expect(geDirect).toEqual(expectedGe)

            // Elides branch: `undefined` -> the sole WHERE predicate drops, so
            // every issue is returned. Emission is identical across the four
            // operators.
            const expectedAll = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
            ctx.mockNext(expectedAll)
            const ltElide = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.lessThanIfValue(noNum))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            expect(ltElide).toEqual(expectedAll)

            ctx.mockNext(expectedAll)
            const gtElide = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.greaterThanIfValue(noNum))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            expect(gtElide).toEqual(expectedAll)

            ctx.mockNext(expectedAll)
            const leElide = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.lessOrEqualIfValue(noNum))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            expect(leElide).toEqual(expectedAll)

            ctx.mockNext(expectedAll)
            const geElide = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.estimatedHours.greaterOrEqualIfValue(noNum))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            expect(geElide).toEqual(expectedAll)
        })
    })

})
