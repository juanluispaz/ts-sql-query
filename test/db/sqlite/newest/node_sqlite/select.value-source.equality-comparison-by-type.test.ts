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
import { tIssue, tIssueWorklog, tProjectRelease } from '../../domain/connection.js'
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
            5400000n,
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
            5400000n,
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
            5400000n,
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
            5400000n,
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
            1000000n,
            2000000n,
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
            1000000n,
            2000000n,
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
            5400000n,
            1800000n,
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
            5400000n,
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
            1,
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
            1,
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
            0,
          ]
        `)
        expect(inRows).toEqual(expectedFalse)
    })

})
