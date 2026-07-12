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
import { tIssueWorklog, tOrganization, tProject, tProjectRelease, vProjectOverview, vReleaseOverview } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // plain localDate — tIssueWorklog.workDate (required):
    //   worklog 1 -> 2024-03-04, 2 -> 2024-03-05, 3 -> 2024-03-06.

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

    // plain localTime — tIssueWorklog.startedAt (optional):
    //   worklog 1 -> 09:15:00, 2 -> 14:00:00, 3 -> 10:30:00 (all set in seed).

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

    // customLocalTime — tProjectRelease.cutoffTime ('CutoffClock', required):
    //   release 1 -> 17:00:00, 2 -> 18:30:00, 3 -> 16:00:00.

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

    // customLocalDateTime — tProjectRelease.signedOffAt ('SignOffStamp',
    // optional): release 1 -> 2024-01-14 12:30:00, 2 -> NULL,
    //   3 -> 2024-02-28 09:00:00.

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

    // customLocalDateTime — tProjectRelease.publishedAt ('PublishStamp',
    // REQUIRED-on-read): release 1 -> 2024-01-16 09:00:00. The direct-fluent
    // date/time getter surface on a REQUIRED custom-localDateTime receiver (the
    // required twin of the optional signedOffAt getters), so each getter is a
    // required `number` leaf (not `?: number`).

    test('customLocalDateTime-required-getters', async () => {
        // All 9 LocalDateTimeValueSource getters on the REQUIRED custom-localDateTime
        // column publishedAt — every getter is a required `number` leaf. Release 1:
        // published_at 2024-01-16 09:00:00 (a Tuesday) -> year 2024, month 0
        // (January, JS 0-indexed), date 16, day-of-week 2, hours 9, minutes 0,
        // seconds 0, milliseconds 0, and epoch millis for getTime().
        const epoch = Date.UTC(2024, 0, 16, 9, 0, 0)
        const expected = [{ y: 2024, mo: 0, d: 16, dow: 2, h: 9, m: 0, s: 0, ms: 0, t: epoch }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                y:   tProjectRelease.publishedAt.getFullYear(),
                mo:  tProjectRelease.publishedAt.getMonth(),
                d:   tProjectRelease.publishedAt.getDate(),
                dow: tProjectRelease.publishedAt.getDay(),
                h:   tProjectRelease.publishedAt.getHours(),
                m:   tProjectRelease.publishedAt.getMinutes(),
                s:   tProjectRelease.publishedAt.getSeconds(),
                ms:  tProjectRelease.publishedAt.getMilliseconds(),
                t:   tProjectRelease.publishedAt.getTime(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(year from published_at) as "y", extract(month from published_at) - 1 as mo, extract(day from published_at) as "d", extract(dow from published_at) as dow, extract(hour from published_at) as "h", extract(minute from published_at) as "m", extract(second from published_at)::integer as "s", extract(millisecond from published_at)::integer % 1000 as ms, round(extract(epoch from published_at) * 1000) as "t" from project_release where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ y: number; mo: number; d: number; dow: number; h: number; m: number; s: number; ms: number; t: number }>>>()
        expect(rows).toEqual(expected)
    })

    // View customLocalTime — vReleaseOverview.cutoffClock ('CutoffClock',
    // required): the release's cutoff_time surfaced through the view. Release 1
    // -> 17:00:00. The custom-localTime getter surface on a VIEW receiver.

    test('view-customLocalTime-getters', async () => {
        // The 4 LocalTimeValueSource getters on the REQUIRED View custom-localTime
        // column cutoffClock — each is a required `number` leaf. Release 1:
        // cutoff_clock 17:00:00 -> hours 17, minutes 0, seconds 0, milliseconds 0.
        const expected = [{ h: 17, m: 0, s: 0, ms: 0 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({
                h:  vReleaseOverview.cutoffClock.getHours(),
                m:  vReleaseOverview.cutoffClock.getMinutes(),
                s:  vReleaseOverview.cutoffClock.getSeconds(),
                ms: vReleaseOverview.cutoffClock.getMilliseconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(hour from cutoff_clock) as "h", extract(minute from cutoff_clock) as "m", extract(second from cutoff_clock)::integer as "s", extract(millisecond from cutoff_clock)::integer % 1000 as ms from release_overview where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ h: number; m: number; s: number; ms: number }>>>()
        expect(rows).toEqual(expected)
    })

    // custom-source `.asOptional()` getter — tProjectRelease.releasedOn
    // ('ReleaseDay', customLocalDate) demoted to optional via `.asOptional()`
    // then a getter. asOptional() propagates the optional marker to the getter's
    // number leaf (`?: number | undefined`).
    // Release 1 -> released_on 2024-01-15 -> year 2024.

    test('view-required-localDateTime-getters', async () => {
        // All 9 LocalDateTimeValueSource getters on the REQUIRED plain (non-custom)
        // View localDateTime column publishStampPlain — every getter is a required
        // `number` leaf (not `?: number`). Release 1: published_stamp_plain
        // 2024-01-16 09:00:00 (a Tuesday) -> year 2024, month 0 (January, JS
        // 0-indexed), date 16, day-of-week 2, hours 9, minutes 0, seconds 0,
        // milliseconds 0, and epoch millis for getTime().
        const epoch = Date.UTC(2024, 0, 16, 9, 0, 0)
        const expected = [{ y: 2024, mo: 0, d: 16, dow: 2, h: 9, m: 0, s: 0, ms: 0, t: epoch }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({
                y:   vReleaseOverview.publishStampPlain.getFullYear(),
                mo:  vReleaseOverview.publishStampPlain.getMonth(),
                d:   vReleaseOverview.publishStampPlain.getDate(),
                dow: vReleaseOverview.publishStampPlain.getDay(),
                h:   vReleaseOverview.publishStampPlain.getHours(),
                m:   vReleaseOverview.publishStampPlain.getMinutes(),
                s:   vReleaseOverview.publishStampPlain.getSeconds(),
                ms:  vReleaseOverview.publishStampPlain.getMilliseconds(),
                t:   vReleaseOverview.publishStampPlain.getTime(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(year from published_stamp_plain) as "y", extract(month from published_stamp_plain) - 1 as mo, extract(day from published_stamp_plain) as "d", extract(dow from published_stamp_plain) as dow, extract(hour from published_stamp_plain) as "h", extract(minute from published_stamp_plain) as "m", extract(second from published_stamp_plain)::integer as "s", extract(millisecond from published_stamp_plain)::integer % 1000 as ms, round(extract(epoch from published_stamp_plain) * 1000) as "t" from release_overview where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ y: number; mo: number; d: number; dow: number; h: number; m: number; s: number; ms: number; t: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('view-required-customLocalDateTime-getters', async () => {
        // All 9 LocalDateTimeValueSource getters on the REQUIRED custom View
        // localDateTime column publishStamp ('PublishStamp') — every getter is a
        // required `number` leaf. Release 1: published_stamp 2024-01-16 09:00:00
        // (a Tuesday) -> the same components as the plain twin above.
        const epoch = Date.UTC(2024, 0, 16, 9, 0, 0)
        const expected = [{ y: 2024, mo: 0, d: 16, dow: 2, h: 9, m: 0, s: 0, ms: 0, t: epoch }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({
                y:   vReleaseOverview.publishStamp.getFullYear(),
                mo:  vReleaseOverview.publishStamp.getMonth(),
                d:   vReleaseOverview.publishStamp.getDate(),
                dow: vReleaseOverview.publishStamp.getDay(),
                h:   vReleaseOverview.publishStamp.getHours(),
                m:   vReleaseOverview.publishStamp.getMinutes(),
                s:   vReleaseOverview.publishStamp.getSeconds(),
                ms:  vReleaseOverview.publishStamp.getMilliseconds(),
                t:   vReleaseOverview.publishStamp.getTime(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(year from published_stamp) as "y", extract(month from published_stamp) - 1 as mo, extract(day from published_stamp) as "d", extract(dow from published_stamp) as dow, extract(hour from published_stamp) as "h", extract(minute from published_stamp) as "m", extract(second from published_stamp)::integer as "s", extract(millisecond from published_stamp)::integer % 1000 as ms, round(extract(epoch from published_stamp) * 1000) as "t" from release_overview where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ y: number; mo: number; d: number; dow: number; h: number; m: number; s: number; ms: number; t: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('custom-source-asOptional-getter', async () => {
        // `.asOptional().getFullYear()` on the required custom-localDate column
        // releasedOn — asOptional() carries the optional marker through to the
        // getter leaf (`?: number | undefined`). Release 1: released_on 2024-01-15 -> year 2024.
        const expected = [{ y: 2024 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                y: tProjectRelease.releasedOn.asOptional().getFullYear(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(year from released_on) as "y" from project_release where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ y?: number | undefined }>>>()
        expect(rows).toEqual(expected)
    })

    // View plain optional localDateTime — vProjectOverview.archivedAt: the
    // project's archived_at surfaced through the view (a plain, non-custom
    // optional localDateTime View column). Each getter carries the optional
    // marker to a `number | undefined` leaf. The underlying project.archived_at
    // is set to a fixed timestamp in-rollback so the values are deterministic:
    // 2024-06-15 13:45:30 (a Saturday).

    test('view-plain-localDateTime-getters', async () => {
        // The 9 LocalDateTimeValueSource getters on the plain (non-custom) OPTIONAL
        // View localDateTime column archivedAt — each carries the optional marker to
        // a `number | undefined` leaf. project.archived_at is updated in-rollback to
        // 2024-06-15 13:45:30 (a Saturday) -> year 2024, month 5 (June, JS
        // 0-indexed), date 15, day-of-week 6, hours 13, minutes 45, seconds 30,
        // ms 0, and epoch millis for getTime().
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tProject)
                .set({ archivedAt: new Date(Date.UTC(2024, 5, 15, 13, 45, 30)) })
                .where(tProject.id.equals(1))
                .executeUpdate()

            const expected = [{
                y: 2024, mo: 5, d: 15, dow: 6, h: 13, m: 45, s: 30, ms: 0,
                t: Date.UTC(2024, 5, 15, 13, 45, 30),
            }]
            ctx.mockNext(expected)
            const rows = await ctx.conn.selectFrom(vProjectOverview)
                .where(vProjectOverview.id.equals(1))
                .select({
                    y:   vProjectOverview.archivedAt.getFullYear(),
                    mo:  vProjectOverview.archivedAt.getMonth(),
                    d:   vProjectOverview.archivedAt.getDate(),
                    dow: vProjectOverview.archivedAt.getDay(),
                    h:   vProjectOverview.archivedAt.getHours(),
                    m:   vProjectOverview.archivedAt.getMinutes(),
                    s:   vProjectOverview.archivedAt.getSeconds(),
                    ms:  vProjectOverview.archivedAt.getMilliseconds(),
                    t:   vProjectOverview.archivedAt.getTime(),
                })
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(year from archived_at) as "y", extract(month from archived_at) - 1 as mo, extract(day from archived_at) as "d", extract(dow from archived_at) as dow, extract(hour from archived_at) as "h", extract(minute from archived_at) as "m", extract(second from archived_at)::integer as "s", extract(millisecond from archived_at)::integer % 1000 as ms, round(extract(epoch from archived_at) * 1000) as "t" from project_overview where id = $1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof rows, Array<{
                y?: number | undefined; mo?: number | undefined; d?: number | undefined
                dow?: number | undefined; h?: number | undefined; m?: number | undefined
                s?: number | undefined; ms?: number | undefined; t?: number | undefined
            }>>>()
            expect(rows).toEqual(expected)
        })
    })

    // custom-source `.asOptional()` getters — tProjectRelease.releasedOn
    // ('ReleaseDay', customLocalDate) demoted to optional via `.asOptional()`
    // then fed the LocalDate getters. asOptional() carries the optional
    // marker to each getter's number leaf (`?: number | undefined`). Release 1
    // -> released_on 2024-01-15 (a Monday) -> month 0 (January, JS 0-indexed),
    // date 15, day-of-week 1.

    test('custom-localDate-asOptional-getters', async () => {
        // The `getMonth`/`getDate`/`getDay` LocalDateValueSource getters on the
        // custom-localDate column releasedOn demoted via `.asOptional()` — each carries the
        // optional marker to a `number | undefined` leaf. Release 1: released_on
        // 2024-01-15 (a Monday) -> month 0 (January, JS 0-indexed), date 15,
        // day-of-week 1.
        const expected = [{ mo: 0, d: 15, dow: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                mo:  tProjectRelease.releasedOn.asOptional().getMonth(),
                d:   tProjectRelease.releasedOn.asOptional().getDate(),
                dow: tProjectRelease.releasedOn.asOptional().getDay(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(month from released_on) - 1 as mo, extract(day from released_on) as "d", extract(dow from released_on) as dow from project_release where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ mo?: number | undefined; d?: number | undefined; dow?: number | undefined }>>>()
        expect(rows).toEqual(expected)
    })

    // custom-source `.asOptional()` getters — tProjectRelease.cutoffTime
    // ('CutoffClock', customLocalTime) demoted to optional via `.asOptional()`
    // then fed the LocalTime getters. asOptional() carries the optional marker
    // to each getter's number leaf (`?: number | undefined`). Release 1 ->
    // cutoff_time 17:00:00 -> hours 17, minutes 0, seconds 0, milliseconds 0.

    test('custom-localTime-asOptional-getters', async () => {
        // The 4 LocalTimeValueSource getters on the custom-localTime column
        // cutoffTime demoted via `.asOptional()` — each carries the optional
        // marker to a `number | undefined` leaf. Release 1: cutoff_time 17:00:00
        // -> hours 17, minutes 0, seconds 0, milliseconds 0.
        const expected = [{ h: 17, m: 0, s: 0, ms: 0 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                h:  tProjectRelease.cutoffTime.asOptional().getHours(),
                m:  tProjectRelease.cutoffTime.asOptional().getMinutes(),
                s:  tProjectRelease.cutoffTime.asOptional().getSeconds(),
                ms: tProjectRelease.cutoffTime.asOptional().getMilliseconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(hour from cutoff_time) as "h", extract(minute from cutoff_time) as "m", extract(second from cutoff_time)::integer as "s", extract(millisecond from cutoff_time)::integer % 1000 as ms from project_release where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ h?: number | undefined; m?: number | undefined; s?: number | undefined; ms?: number | undefined }>>>()
        expect(rows).toEqual(expected)
    })

    test('view-custom-localDate-asOptional-getters', async () => {
        // The 4 LocalDateValueSource getters on the View custom-localDate column
        // releasedOn demoted via `.asOptional()` — each carries the optional
        // marker to a `number | undefined` leaf. Release 1: released_on 2024-01-15
        // (a Monday) -> year 2024, month 0 (January, JS 0-indexed), date 15,
        // day-of-week 1.
        const expected = [{ y: 2024, mo: 0, d: 15, dow: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({
                y:   vReleaseOverview.releasedOn.asOptional().getFullYear(),
                mo:  vReleaseOverview.releasedOn.asOptional().getMonth(),
                d:   vReleaseOverview.releasedOn.asOptional().getDate(),
                dow: vReleaseOverview.releasedOn.asOptional().getDay(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(year from released_on) as "y", extract(month from released_on) - 1 as mo, extract(day from released_on) as "d", extract(dow from released_on) as dow from release_overview where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ y?: number | undefined; mo?: number | undefined; d?: number | undefined; dow?: number | undefined }>>>()
        expect(rows).toEqual(expected)
    })

    // View custom-source `.asOptional()` getters — vReleaseOverview.cutoffClock
    // ('CutoffClock', customLocalTime) surfaced through the view then demoted to
    // optional via `.asOptional()` before the LocalTime getters (the View read
    // path, distinct from the Table read path). asOptional() carries the optional
    // marker to each getter's number leaf (`?: number | undefined`). Release 1
    // through the view: cutoff_clock 17:00:00 -> hours 17, minutes 0, seconds 0,
    // milliseconds 0.

    test('view-custom-localTime-asOptional-getters', async () => {
        // The 4 LocalTimeValueSource getters on the View custom-localTime column
        // cutoffClock demoted via `.asOptional()` — each carries the optional
        // marker to a `number | undefined` leaf. Release 1: cutoff_clock 17:00:00
        // -> hours 17, minutes 0, seconds 0, milliseconds 0.
        const expected = [{ h: 17, m: 0, s: 0, ms: 0 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({
                h:  vReleaseOverview.cutoffClock.asOptional().getHours(),
                m:  vReleaseOverview.cutoffClock.asOptional().getMinutes(),
                s:  vReleaseOverview.cutoffClock.asOptional().getSeconds(),
                ms: vReleaseOverview.cutoffClock.asOptional().getMilliseconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(hour from cutoff_clock) as "h", extract(minute from cutoff_clock) as "m", extract(second from cutoff_clock)::integer as "s", extract(millisecond from cutoff_clock)::integer % 1000 as ms from release_overview where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ h?: number | undefined; m?: number | undefined; s?: number | undefined; ms?: number | undefined }>>>()
        expect(rows).toEqual(expected)
    })

    // View plain localDate — vReleaseOverview.releaseDayPlain: the release's
    // release_day_plain surfaced through the view (a plain, non-custom localDate
    // View column — a distinct read path from the custom View getters, a bare
    // DBColumnImpl). Release 1 -> release_day_plain 2024-01-15 (a Monday) -> year
    // 2024, month 0 (January, JS 0-indexed), date 15, day-of-week 1.

    test('view-plain-localDate-getters', async () => {
        // The 4 LocalDateValueSource getters on the plain (non-custom) REQUIRED
        // View localDate column releaseDayPlain — each is a required `number`
        // leaf. Release 1: release_day_plain 2024-01-15 (a Monday) -> year 2024,
        // month 0 (January, JS 0-indexed), date 15, day-of-week 1.
        const expected = [{ y: 2024, mo: 0, d: 15, dow: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({
                y:   vReleaseOverview.releaseDayPlain.getFullYear(),
                mo:  vReleaseOverview.releaseDayPlain.getMonth(),
                d:   vReleaseOverview.releaseDayPlain.getDate(),
                dow: vReleaseOverview.releaseDayPlain.getDay(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(year from release_day_plain) as "y", extract(month from release_day_plain) - 1 as mo, extract(day from release_day_plain) as "d", extract(dow from release_day_plain) as dow from release_overview where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ y: number; mo: number; d: number; dow: number }>>>()
        expect(rows).toEqual(expected)
    })

    // View plain localTime — vReleaseOverview.cutoffPlain: the release's
    // cutoff_plain surfaced through the view (a plain, non-custom localTime View
    // column — a distinct read path from the custom View getters, a bare
    // DBColumnImpl). Release 1 -> cutoff_plain 17:00:00 -> hours 17, minutes 0,
    // seconds 0, milliseconds 0.

    test('view-plain-localTime-getters', async () => {
        // The 4 LocalTimeValueSource getters on the plain (non-custom) REQUIRED
        // View localTime column cutoffPlain — each is a required `number` leaf.
        // Release 1: cutoff_plain 17:00:00 -> hours 17, minutes 0, seconds 0,
        // milliseconds 0.
        const expected = [{ h: 17, m: 0, s: 0, ms: 0 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({
                h:  vReleaseOverview.cutoffPlain.getHours(),
                m:  vReleaseOverview.cutoffPlain.getMinutes(),
                s:  vReleaseOverview.cutoffPlain.getSeconds(),
                ms: vReleaseOverview.cutoffPlain.getMilliseconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(hour from cutoff_plain) as "h", extract(minute from cutoff_plain) as "m", extract(second from cutoff_plain)::integer as "s", extract(millisecond from cutoff_plain)::integer % 1000 as ms from release_overview where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ h: number; m: number; s: number; ms: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('customLocalTime-is-is-not', async () => {
        // `.is` / `.isNot` (null-safe equality) on a required custom-localTime
        // column. `.is(17:00)` matches release 1; `.isNot(17:00)` matches
        // releases 2 and 3 (cutoff_time is non-null on every release).
        const t = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.is(t))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time is not distinct from $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "17:00:00",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedIsNot = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedIsNot)
        const isNot = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.isNot(t))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time is distinct from $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "17:00:00",
          ]
        `)
        expect(isNot).toEqual(expectedIsNot)
    })

    // ==================================================================
    // Single-bound ordered comparisons (greaterThan / lessOrEqual), membership
    // variadics (inN / notInN / notIn-array) and the *IfValue family on the
    // custom-temporal Comparable leaves:
    //   customLocalDate — tProjectRelease.releasedOn ('ReleaseDay'):
    //     release 1 -> 2024-01-15, 2 -> 2024-02-20, 3 -> 2024-03-01.
    //   customLocalTime — tProjectRelease.cutoffTime ('CutoffClock'):
    //     release 1 -> 17:00:00, 2 -> 18:30:00, 3 -> 16:00:00.
    // ==================================================================

    test('customLocalDate-single-bound-greater-than-less-or-equal', async () => {
        // `.greaterThan(2024-02-20)` matches release 3 (2024-03-01);
        // `.lessOrEqual(2024-02-20)` matches releases 1 and 2.
        const mid = new Date(Date.UTC(2024, 1, 20))
        const expectedGt = [{ id: 3 }]
        ctx.mockNext(expectedGt)
        const gt = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.greaterThan(mid))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on > $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-02-20T00:00:00.000Z",
          ]
        `)
        assertType<Exact<typeof gt, Array<{ id: number }>>>()
        expect(gt).toEqual(expectedGt)

        const expectedLe = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedLe)
        const le = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.lessOrEqual(mid))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on <= $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-02-20T00:00:00.000Z",
          ]
        `)
        expect(le).toEqual(expectedLe)
    })

    test('customLocalDate-in-array-in-n', async () => {
        // `.in([2024-01-15, 2024-03-01])` matches releases 1 and 3; `.inN(
        // 2024-02-20)` matches release 2.
        const d1 = new Date(Date.UTC(2024, 0, 15))
        const d3 = new Date(Date.UTC(2024, 2, 1))
        const d2 = new Date(Date.UTC(2024, 1, 20))
        const expectedIn = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.in([d1, d3]))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on in ($1, $2) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15T00:00:00.000Z",
            "2024-03-01T00:00:00.000Z",
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedInN = [{ id: 2 }]
        ctx.mockNext(expectedInN)
        const inNRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.inN(d2))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on in ($1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-02-20T00:00:00.000Z",
          ]
        `)
        expect(inNRows).toEqual(expectedInN)
    })

    test('customLocalDate-not-in-array-not-in-n', async () => {
        // `.notIn([2024-01-15])` and `.notInN(2024-01-15)` both match releases 2
        // and 3.
        const d1 = new Date(Date.UTC(2024, 0, 15))
        const expected = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const notInRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.notIn([d1]))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on not in ($1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15T00:00:00.000Z",
          ]
        `)
        assertType<Exact<typeof notInRows, Array<{ id: number }>>>()
        expect(notInRows).toEqual(expected)

        ctx.mockNext(expected)
        const notInNRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.notInN(d1))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on not in ($1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15T00:00:00.000Z",
          ]
        `)
        expect(notInNRows).toEqual(expected)
    })

    test('customLocalDate-if-value-family-fires-and-elides', async () => {
        // The *IfValue family on customLocalDate: each fires with the same SQL as
        // its direct sibling when given a value, and elides (drops the sole WHERE)
        // when given `undefined`.
        const d1 = new Date(Date.UTC(2024, 0, 15))
        const mid = new Date(Date.UTC(2024, 1, 20))
        const noDate: Date | undefined = undefined
        const noDates: Date[] | undefined = undefined
        const all = [{ id: 1 }, { id: 2 }, { id: 3 }]

        ctx.mockNext([{ id: 1 }])
        const eq = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.releasedOn.equalsIfValue(d1)).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on = $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15T00:00:00.000Z",
          ]
        `)
        assertType<Exact<typeof eq, Array<{ id: number }>>>()
        expect(eq).toEqual([{ id: 1 }])

        ctx.mockNext([{ id: 2 }, { id: 3 }])
        const ne = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.releasedOn.notEqualsIfValue(d1)).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on <> $1 order by id"`)
        expect(ne).toEqual([{ id: 2 }, { id: 3 }])

        ctx.mockNext([{ id: 1 }])
        const lt = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.releasedOn.lessThanIfValue(mid)).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on < $1 order by id"`)
        expect(lt).toEqual([{ id: 1 }])

        ctx.mockNext([{ id: 2 }, { id: 3 }])
        const ge = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.releasedOn.greaterOrEqualIfValue(mid)).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on >= $1 order by id"`)
        expect(ge).toEqual([{ id: 2 }, { id: 3 }])

        ctx.mockNext([{ id: 3 }])
        const gt = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.releasedOn.greaterThanIfValue(mid)).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on > $1 order by id"`)
        expect(gt).toEqual([{ id: 3 }])

        ctx.mockNext([{ id: 1 }, { id: 2 }])
        const le = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.releasedOn.lessOrEqualIfValue(mid)).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on <= $1 order by id"`)
        expect(le).toEqual([{ id: 1 }, { id: 2 }])

        ctx.mockNext([{ id: 1 }])
        const inif = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.releasedOn.inIfValue([d1])).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on in ($1) order by id"`)
        expect(inif).toEqual([{ id: 1 }])

        ctx.mockNext([{ id: 2 }, { id: 3 }])
        const ninif = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.releasedOn.notInIfValue([d1])).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on not in ($1) order by id"`)
        expect(ninif).toEqual([{ id: 2 }, { id: 3 }])

        // Elides: undefined value / array drop the sole WHERE.
        ctx.mockNext(all)
        const eqElide = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.releasedOn.equalsIfValue(noDate)).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release order by id"`)
        expect(eqElide).toEqual(all)

        ctx.mockNext(all)
        const ltElide = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.releasedOn.lessThanIfValue(noDate)).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release order by id"`)
        expect(ltElide).toEqual(all)

        ctx.mockNext(all)
        const inElide = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.releasedOn.inIfValue(noDates)).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release order by id"`)
        expect(inElide).toEqual(all)
    })

    test('customLocalTime-single-bound-greater-than-less-or-equal', async () => {
        // `.greaterThan(17:00)` matches release 2 (18:30); `.lessOrEqual(17:00)`
        // matches releases 1 (17:00) and 3 (16:00).
        const t = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        const expectedGt = [{ id: 2 }]
        ctx.mockNext(expectedGt)
        const gt = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.greaterThan(t))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time > $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "17:00:00",
          ]
        `)
        assertType<Exact<typeof gt, Array<{ id: number }>>>()
        expect(gt).toEqual(expectedGt)

        const expectedLe = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedLe)
        const le = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.lessOrEqual(t))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time <= $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "17:00:00",
          ]
        `)
        expect(le).toEqual(expectedLe)
    })

    test('customLocalTime-not-in-array-not-in-n', async () => {
        // `.notIn([17:00])` and `.notInN(17:00)` both match releases 2 and 3.
        const t = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        const expected = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const notInRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.notIn([t]))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time not in ($1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "17:00:00",
          ]
        `)
        assertType<Exact<typeof notInRows, Array<{ id: number }>>>()
        expect(notInRows).toEqual(expected)

        ctx.mockNext(expected)
        const notInNRows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.cutoffTime.notInN(t))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time not in ($1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "17:00:00",
          ]
        `)
        expect(notInNRows).toEqual(expected)
    })

    test('customLocalTime-if-value-family-fires-and-elides', async () => {
        // The *IfValue family on customLocalTime: each fires with the same SQL as
        // its direct sibling when given a value, and elides when given `undefined`.
        const t = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        const noTime: Date | undefined = undefined
        const noTimes: Date[] | undefined = undefined
        const all = [{ id: 1 }, { id: 2 }, { id: 3 }]

        ctx.mockNext([{ id: 1 }])
        const eq = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.cutoffTime.equalsIfValue(t)).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time = $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "17:00:00",
          ]
        `)
        assertType<Exact<typeof eq, Array<{ id: number }>>>()
        expect(eq).toEqual([{ id: 1 }])

        ctx.mockNext([{ id: 2 }, { id: 3 }])
        const ne = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.cutoffTime.notEqualsIfValue(t)).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time <> $1 order by id"`)
        expect(ne).toEqual([{ id: 2 }, { id: 3 }])

        ctx.mockNext([{ id: 3 }])
        const lt = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.cutoffTime.lessThanIfValue(t)).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time < $1 order by id"`)
        expect(lt).toEqual([{ id: 3 }])

        ctx.mockNext([{ id: 1 }, { id: 2 }])
        const ge = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.cutoffTime.greaterOrEqualIfValue(t)).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time >= $1 order by id"`)
        expect(ge).toEqual([{ id: 1 }, { id: 2 }])

        ctx.mockNext([{ id: 2 }])
        const gt = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.cutoffTime.greaterThanIfValue(t)).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time > $1 order by id"`)
        expect(gt).toEqual([{ id: 2 }])

        ctx.mockNext([{ id: 1 }, { id: 3 }])
        const le = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.cutoffTime.lessOrEqualIfValue(t)).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time <= $1 order by id"`)
        expect(le).toEqual([{ id: 1 }, { id: 3 }])

        ctx.mockNext([{ id: 1 }])
        const inif = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.cutoffTime.inIfValue([t])).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time in ($1) order by id"`)
        expect(inif).toEqual([{ id: 1 }])

        ctx.mockNext([{ id: 2 }, { id: 3 }])
        const ninif = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.cutoffTime.notInIfValue([t])).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where cutoff_time not in ($1) order by id"`)
        expect(ninif).toEqual([{ id: 2 }, { id: 3 }])

        // Elides.
        ctx.mockNext(all)
        const eqElide = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.cutoffTime.equalsIfValue(noTime)).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release order by id"`)
        expect(eqElide).toEqual(all)

        ctx.mockNext(all)
        const ltElide = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.cutoffTime.lessThanIfValue(noTime)).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release order by id"`)
        expect(ltElide).toEqual(all)

        ctx.mockNext(all)
        const inElide = await ctx.conn.selectFrom(tProjectRelease).where(tProjectRelease.cutoffTime.inIfValue(noTimes)).select({ id: tProjectRelease.id }).orderBy('id').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release order by id"`)
        expect(inElide).toEqual(all)
    })

    // ── modifier→getter leaf completeness: a null-modifier (valueWhenNull / nullIfValue)
    // wraps the temporal column, then a getter extracts from the wrapped expression. The
    // getter emission is identical to the plain-column getter; the modifier adds the
    // coalesce/nullif wrapper. Seed: release 1 released_on 2024-01-15 (a Monday),
    // cutoff_time 17:00:00; organization 1 created_at 2023-06-15 08:00:00. Tests run
    // under TZ=UTC.

    test('modifier-getter/customLocalDate-value-when-null-get-month-and-null-if-value-get-day', async () => {
        // `releasedOn.valueWhenNull(d).getMonth()` -> getMonth over coalesce(released_on, $1);
        // released_on is non-null so the coalesce yields it: month 0 (January, JS 0-indexed).
        // `releasedOn.nullIfValue(d2).getDay()` -> getDay over nullif(released_on, $2); the
        // probe differs from released_on so the value survives: dow 1 (Monday).
        const fallback = new Date(Date.UTC(2000, 0, 1))
        const probe = new Date(Date.UTC(1999, 5, 6))
        const expected = [{ mo: 0, dow: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                mo:  tProjectRelease.releasedOn.valueWhenNull(fallback).getMonth(),
                dow: tProjectRelease.releasedOn.nullIfValue(probe).getDay(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(month from coalesce(released_on, $1)) - 1 as mo, extract(dow from nullif(released_on, $2)) as dow from project_release where id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2000-01-01T00:00:00.000Z",
            "1999-06-06T00:00:00.000Z",
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ mo: number; dow?: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('modifier-getter/customLocalTime-value-when-null-get-hours-and-null-if-value-get-seconds', async () => {
        // `cutoffTime.valueWhenNull(t).getHours()` -> getHours over coalesce(cutoff_time, $1);
        // cutoff_time 17:00:00 is non-null so hours = 17.
        // `cutoffTime.nullIfValue(t2).getSeconds()` -> getSeconds over nullif(cutoff_time, $2);
        // the probe differs so the value survives: seconds = 0.
        const fallback = new Date(Date.UTC(1970, 0, 1, 0, 0, 0))
        const probe = new Date(Date.UTC(1970, 0, 1, 12, 0, 0))
        const expected = [{ h: 17, s: 0 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                h: tProjectRelease.cutoffTime.valueWhenNull(fallback).getHours(),
                s: tProjectRelease.cutoffTime.nullIfValue(probe).getSeconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(hour from coalesce(cutoff_time, $1)) as "h", extract(second from nullif(cutoff_time, $2))::integer as "s" from project_release where id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "00:00:00",
            "12:00:00",
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ h: number; s?: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('modifier-getter/localDateTime-value-when-null-get-full-year-and-null-if-value-get-hours', async () => {
        // `createdAt.valueWhenNull(dt).getFullYear()` -> getFullYear over coalesce(created_at, $1);
        // created_at 2023-06-15 08:00:00 non-null so year = 2023.
        // `createdAt.nullIfValue(dt2).getHours()` -> getHours over nullif(created_at, $2); the
        // probe differs so the value survives: hours = 8.
        const fallback = new Date(Date.UTC(1970, 0, 1, 0, 0, 0))
        const probe = new Date(Date.UTC(1999, 0, 1, 0, 0, 0))
        const expected = [{ y: 2023, h: 8 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                y: tOrganization.createdAt.valueWhenNull(fallback).getFullYear(),
                h: tOrganization.createdAt.nullIfValue(probe).getHours(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(year from coalesce(created_at, $1)) as "y", extract(hour from nullif(created_at, $2)) as "h" from organization where id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1970-01-01T00:00:00.000Z",
            "1999-01-01T00:00:00.000Z",
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ y: number; h?: number }>>>()
        expect(rows).toEqual(expected)
    })
})
