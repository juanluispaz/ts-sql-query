// Direct-fluent Equalable + Comparable methods on the temporal leaf types — the
// plain `localDate` / `localTime` columns (`tIssueWorklog.workDate`,
// `tIssueWorklog.startedAt`) and the custom-temporal columns
// (`tProjectRelease.cutoffTime` customLocalTime, `tProjectRelease.signedOffAt`
// customLocalDateTime). The *dynamic* dispatcher already covers these per type;
// this pins the *direct* fluent surface (equality / is-isNot / between / single
// bounds / membership) with CONST operands.
//
// Every test filters in the WHERE clause and projects the int primary key, so
// the result type is `Array<{ id: number }>` regardless of the receiver's
// optionality — what is under test is the operator emission per temporal leaf
// type, pinned by the inline SQL snapshot (uniform across dialects up to
// identifier quoting / placeholder syntax) and the param encoding (date-only,
// time-only and date-time literals encode distinctly per dialect).
//
// Temporal const operands are built with `new Date(Date.UTC(...))`; the suite
// forces TZ=UTC so the encoded literal is deterministic. The projection is the
// id only, so no TZ-shifted temporal VALUE is ever read back.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssueWorklog, tProjectRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // ------------------------------------------------------------------
    // plain localDate — tIssueWorklog.workDate (required):
    //   worklog 1 -> 2024-03-04, 2 -> 2024-03-05, 3 -> 2024-03-06.
    // ------------------------------------------------------------------

    test('localDate-equals-not-equals', async () => {
        // `.equals(2024-03-05)` matches worklog 2; `.notEquals(2024-03-05)`
        // matches worklogs 1 and 3 (work_date is non-null on every worklog).
        const d = new Date(Date.UTC(2024, 2, 5, 0, 0, 0))
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.equals(d))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date = $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-03-05T00:00:00.000Z",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNe = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.notEquals(d))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date <> $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-03-05T00:00:00.000Z",
          ]
        `)
        expect(ne).toEqual(expectedNe)
    })

    test('localDate-is-is-not', async () => {
        // `.is` / `.isNot` (null-safe equality) on a required localDate column.
        // `.is(2024-03-05)` matches worklog 2; `.isNot(2024-03-05)` matches
        // worklogs 1 and 3.
        const d = new Date(Date.UTC(2024, 2, 5, 0, 0, 0))
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.is(d))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date is not distinct from $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-03-05T00:00:00.000Z",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedIsNot = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.isNot(d))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date is distinct from $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-03-05T00:00:00.000Z",
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    test('localDate-between-not-between', async () => {
        // `.between(2024-03-04, 2024-03-05)` matches worklogs 1 and 2; worklog 3
        // (03-06) is out of range. `.notBetween(...)` matches worklog 3.
        const lo = new Date(Date.UTC(2024, 2, 4, 0, 0, 0))
        const hi = new Date(Date.UTC(2024, 2, 5, 0, 0, 0))
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.between(lo, hi))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date between $1 and $2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-03-04T00:00:00.000Z",
            "2024-03-05T00:00:00.000Z",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNot = [{ id: 3 }]
        ctx.mockNext(expectedNot)
        const notRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.notBetween(lo, hi))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date not between $1 and $2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-03-04T00:00:00.000Z",
            "2024-03-05T00:00:00.000Z",
          ]
        `)
        expect(notRows).toEqual(expectedNot)
    })

    test('localDate-single-bound-comparisons', async () => {
        // The four single-bound ordered comparisons on a required localDate
        // column. `.lessThan(03-05)` -> worklog 1; `.greaterThan(03-05)` ->
        // worklog 3; `.lessOrEqual(03-05)` -> worklogs 1,2; `.greaterOrEqual(
        // 03-05)` -> worklogs 2,3.
        const d = new Date(Date.UTC(2024, 2, 5, 0, 0, 0))

        const expectedLt = [{ id: 1 }]
        ctx.mockNext(expectedLt)
        const lt = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.lessThan(d))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date < $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-03-05T00:00:00.000Z",
          ]
        `)
        assertType<Exact<typeof lt, Array<{ id: number }>>>()
        expect(lt).toEqual(expectedLt)

        const expectedGt = [{ id: 3 }]
        ctx.mockNext(expectedGt)
        const gt = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.greaterThan(d))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date > $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-03-05T00:00:00.000Z",
          ]
        `)
        expect(gt).toEqual(expectedGt)

        const expectedLe = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedLe)
        const le = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.lessOrEqual(d))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date <= $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-03-05T00:00:00.000Z",
          ]
        `)
        expect(le).toEqual(expectedLe)

        const expectedGe = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedGe)
        const ge = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.greaterOrEqual(d))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date >= $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-03-05T00:00:00.000Z",
          ]
        `)
        expect(ge).toEqual(expectedGe)
    })

    // ------------------------------------------------------------------
    // plain localTime — tIssueWorklog.startedAt (optional):
    //   worklog 1 -> 09:15:00, 2 -> 14:00:00, 3 -> 10:30:00 (all set in seed).
    // ------------------------------------------------------------------

    test('localTime-equals-not-equals', async () => {
        // `.equals(14:00)` matches worklog 2; `.notEquals(14:00)` matches
        // worklogs 1 and 3 (started_at is set on every seeded worklog).
        const t = new Date(Date.UTC(1970, 0, 1, 14, 0, 0))
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.equals(t))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at = $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "14:00:00",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNe = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.notEquals(t))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at <> $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "14:00:00",
          ]
        `)
        expect(ne).toEqual(expectedNe)
    })

    test('localTime-is-is-not', async () => {
        // `.is` / `.isNot` (null-safe equality) on an optional localTime column.
        // `.is(14:00)` matches worklog 2; `.isNot(14:00)` matches worklogs 1
        // and 3 (every seeded started_at is non-null).
        const t = new Date(Date.UTC(1970, 0, 1, 14, 0, 0))
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.is(t))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at is not distinct from $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "14:00:00",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedIsNot = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.isNot(t))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at is distinct from $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "14:00:00",
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    test('localTime-between-not-between', async () => {
        // `.between(09:00, 11:00)` matches worklogs 1 (09:15) and 3 (10:30);
        // worklog 2 (14:00) is out of range. `.notBetween(...)` matches worklog 2.
        const lo = new Date(Date.UTC(1970, 0, 1, 9, 0, 0))
        const hi = new Date(Date.UTC(1970, 0, 1, 11, 0, 0))
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.between(lo, hi))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at between $1 and $2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "09:00:00",
            "11:00:00",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNot = [{ id: 2 }]
        ctx.mockNext(expectedNot)
        const notRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.notBetween(lo, hi))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at not between $1 and $2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "09:00:00",
            "11:00:00",
          ]
        `)
        expect(notRows).toEqual(expectedNot)
    })

    test('localTime-single-bound-comparisons', async () => {
        // The four single-bound ordered comparisons on an optional localTime
        // column. `.lessThan(10:30)` -> worklog 1 (09:15); `.greaterThan(10:30)`
        // -> worklog 2 (14:00); `.lessOrEqual(10:30)` -> worklogs 1,3;
        // `.greaterOrEqual(10:30)` -> worklogs 2,3.
        const t = new Date(Date.UTC(1970, 0, 1, 10, 30, 0))

        const expectedLt = [{ id: 1 }]
        ctx.mockNext(expectedLt)
        const lt = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.lessThan(t))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at < $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "10:30:00",
          ]
        `)
        assertType<Exact<typeof lt, Array<{ id: number }>>>()
        expect(lt).toEqual(expectedLt)

        const expectedGt = [{ id: 2 }]
        ctx.mockNext(expectedGt)
        const gt = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.greaterThan(t))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at > $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "10:30:00",
          ]
        `)
        expect(gt).toEqual(expectedGt)

        const expectedLe = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedLe)
        const le = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.lessOrEqual(t))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at <= $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "10:30:00",
          ]
        `)
        expect(le).toEqual(expectedLe)

        const expectedGe = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedGe)
        const ge = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.startedAt.greaterOrEqual(t))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where started_at >= $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "10:30:00",
          ]
        `)
        expect(ge).toEqual(expectedGe)
    })

    // ------------------------------------------------------------------
    // customLocalTime — tProjectRelease.cutoffTime ('CutoffClock', required):
    //   release 1 -> 17:00:00, 2 -> 18:30:00, 3 -> 16:00:00.
    // ------------------------------------------------------------------

    test('customLocalTime-equals-not-equals', async () => {
        // `.equals(17:00)` matches release 1; `.notEquals(17:00)` matches
        // releases 2 and 3 (cutoff_time is non-null on every release).
        const t = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.equals(t))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time = $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "17:00:00",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNe = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.notEquals(t))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time <> $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "17:00:00",
          ]
        `)
        expect(ne).toEqual(expectedNe)
    })

    test('customLocalTime-in-array-in-n', async () => {
        // `.in([17:00, 16:00])` matches releases 1 and 3; `.inN(17:00)` matches
        // release 1 only.
        const t1 = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        const t3 = new Date(Date.UTC(1970, 0, 1, 16, 0, 0))
        const expectedIn = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.in([t1, t3]))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time in ($1, $2) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "17:00:00",
            "16:00:00",
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedInN = [{ id: 1 }]
        ctx.mockNext(expectedInN)
        const inNRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.inN(t1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time in ($1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "17:00:00",
          ]
        `)
        expect(inNRows).toEqual(expectedInN)
    })

    test('customLocalTime-between-not-between', async () => {
        // `.between(16:30, 18:00)` matches release 1 (17:00); releases 2 (18:30)
        // and 3 (16:00) are out of range. `.notBetween(...)` matches 2 and 3.
        const lo = new Date(Date.UTC(1970, 0, 1, 16, 30, 0))
        const hi = new Date(Date.UTC(1970, 0, 1, 18, 0, 0))
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.between(lo, hi))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time between $1 and $2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "16:30:00",
            "18:00:00",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNot = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedNot)
        const notRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.notBetween(lo, hi))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time not between $1 and $2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "16:30:00",
            "18:00:00",
          ]
        `)
        expect(notRows).toEqual(expectedNot)
    })

    // ------------------------------------------------------------------
    // customLocalDateTime — tProjectRelease.signedOffAt ('SignOffStamp',
    // optional): release 1 -> 2024-01-14 12:30:00, 2 -> NULL,
    //   3 -> 2024-02-28 09:00:00.
    // ------------------------------------------------------------------

    test('customLocalDateTime-equals-not-equals', async () => {
        // `.equals(2024-01-14 12:30)` matches release 1; `.notEquals(...)`
        // matches release 3 (release 2 is NULL -> excluded by NULL semantics).
        const dt = new Date(Date.UTC(2024, 0, 14, 12, 30, 0))
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.equals(dt))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signed_off_at = $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-14T12:30:00.000Z",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNe = [{ id: 3 }]
        ctx.mockNext(expectedNe)
        const ne = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.notEquals(dt))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signed_off_at <> $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-14T12:30:00.000Z",
          ]
        `)
        expect(ne).toEqual(expectedNe)
    })

    test('customLocalDateTime-in-array-in-n', async () => {
        // `.in([2024-01-14 12:30, 2024-02-28 09:00])` matches releases 1 and 3;
        // `.inN(2024-01-14 12:30)` matches release 1 only.
        const dt1 = new Date(Date.UTC(2024, 0, 14, 12, 30, 0))
        const dt3 = new Date(Date.UTC(2024, 1, 28, 9, 0, 0))
        const expectedIn = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.in([dt1, dt3]))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signed_off_at in ($1, $2) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-14T12:30:00.000Z",
            "2024-02-28T09:00:00.000Z",
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedInN = [{ id: 1 }]
        ctx.mockNext(expectedInN)
        const inNRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.inN(dt1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signed_off_at in ($1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-14T12:30:00.000Z",
          ]
        `)
        expect(inNRows).toEqual(expectedInN)
    })

    test('customLocalDateTime-between-not-between', async () => {
        // `.between(2024-01-01, 2024-02-01)` matches release 1 (2024-01-14);
        // release 3 (2024-02-28) is out of range and release 2 is NULL.
        // `.notBetween(...)` matches release 3 (NULL excluded by NULL semantics).
        const lo = new Date(Date.UTC(2024, 0, 1, 0, 0, 0))
        const hi = new Date(Date.UTC(2024, 1, 1, 0, 0, 0))
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.between(lo, hi))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signed_off_at between $1 and $2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-01T00:00:00.000Z",
            "2024-02-01T00:00:00.000Z",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedNot = [{ id: 3 }]
        ctx.mockNext(expectedNot)
        const notRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signedOffAt.notBetween(lo, hi))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signed_off_at not between $1 and $2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-01T00:00:00.000Z",
            "2024-02-01T00:00:00.000Z",
          ]
        `)
        expect(notRows).toEqual(expectedNot)
    })
})
