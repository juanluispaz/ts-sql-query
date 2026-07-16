// Coverage of the CONST-receiver arm of the temporal date-part getters.
// `AbstractSqlBuilder._appendSqlForDatePartArgument` has two arms: a
// `isConstValue()` -> `forceTypeCast = true` arm that wraps the placeholder in
// a `::date`/`::time`/`::timestamp` cast inside `extract(...)`, and a plain
// column arm with no cast (the const-cast arm exists so an untyped `$1` inside
// `extract(...)` resolves on PostgreSQL). Here the receiver is a
// `const(new Date(...), 'localDate'|...)`, so it takes the const-cast arm; each
// dialect's cast form is pinned by the snapshot.
//
// The const values are fixed and TZ-independent under the suite's forced UTC,
// so every getter's realized value is deterministic and real-DB-validatable.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssueWorklog, tProjectRelease, tProjectReview } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('const-localdate-getters', async () => {
        // getFullYear/getMonth/getDate/getDay on a `const(..., 'localDate')`.
        // 2024-01-15 is a Monday -> year 2024, month 0 (JS 0-indexed),
        // date 15, day-of-week 1. Each `extract(... from $N::date)` carries the
        // const cast.
        const d = ctx.conn.const(new Date(Date.UTC(2024, 0, 15)), 'localDate')
        const expected = [{ y: 2024, mo: 0, d: 15, dow: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFromNoTable()
            .select({
                y:   d.getFullYear(),
                mo:  d.getMonth(),
                d:   d.getDate(),
                dow: d.getDay(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datepart(year, @0) as [y], datepart(month, @1) - 1 as mo, datepart(day, @2) as [d], (datepart(weekday, @3) + @@datefirst - 1) % 7 as dow"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-15T00:00:00.000Z,
            2024-01-15T00:00:00.000Z,
            2024-01-15T00:00:00.000Z,
            2024-01-15T00:00:00.000Z,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ y: number; mo: number; d: number; dow: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('const-localtime-getters', async () => {
        // getHours/getMinutes/getSeconds on a `const(..., 'localTime')`.
        // 12:34:56 -> hours 12, minutes 34, seconds 56. Each
        // `extract(... from $N::time)` carries the const cast.
        const t = ctx.conn.const(new Date('1970-01-01T12:34:56Z'), 'localTime')
        const expected = [{ h: 12, m: 34, s: 56 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFromNoTable()
            .select({
                h: t.getHours(),
                m: t.getMinutes(),
                s: t.getSeconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datepart(hour, @0) as [h], datepart(minute, @1) as [m], datepart(second, @2) as [s]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1970-01-01T12:34:56.000Z,
            1970-01-01T12:34:56.000Z,
            1970-01-01T12:34:56.000Z,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ h: number; m: number; s: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('const-localdatetime-getters', async () => {
        // getFullYear/getMonth/getHours/getTime on a `const(..., 'localDateTime')`.
        // 2024-01-15 12:34:56 UTC -> year 2024, month 0, hours 12, epoch millis.
        // Each `extract(... from $N::timestamp)` carries the const cast.
        const ts = ctx.conn.const(new Date('2024-01-15T12:34:56Z'), 'localDateTime')
        const expected = [{ y: 2024, mo: 0, h: 12, t: Date.UTC(2024, 0, 15, 12, 34, 56) }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFromNoTable()
            .select({
                y:  ts.getFullYear(),
                mo: ts.getMonth(),
                h:  ts.getHours(),
                t:  ts.getTime(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datepart(year, @0) as [y], datepart(month, @1) - 1 as mo, datepart(hour, @2) as [h], datediff_big(millisecond, '1970-01-01 00:00:00', @3) as [t]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-15T12:34:56.000Z,
            2024-01-15T12:34:56.000Z,
            2024-01-15T12:34:56.000Z,
            2024-01-15T12:34:56.000Z,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ y: number; mo: number; h: number; t: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('const-localtime-milliseconds', async () => {
        // getMilliseconds on a `const(..., 'localTime')` — the sub-second arm of
        // the const-cast surface. 12:34:56 has a zero millisecond component, so
        // `extract(millisecond from $N::time)::integer % 1000` -> 0. The const
        // cast on the placeholder is pinned by the snapshot.
        const t = ctx.conn.const(new Date('1970-01-01T12:34:56Z'), 'localTime')
        const expected = [{ ms: 0 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFromNoTable()
            .select({
                ms: t.getMilliseconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datepart(millisecond, @0) as ms"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1970-01-01T12:34:56.000Z,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ ms: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('const-localdatetime-more-getters', async () => {
        // getDate/getDay/getMinutes/getSeconds/getMilliseconds on a
        // `const(..., 'localDateTime')` — the remaining component getters of the
        // const-cast surface. 2024-01-15 12:34:56 UTC is a Monday -> date 15,
        // day-of-week 1, minutes 34, seconds 56, milliseconds 0. Each
        // `extract(... from $N::timestamp)` carries the const cast.
        const ts = ctx.conn.const(new Date('2024-01-15T12:34:56Z'), 'localDateTime')
        const expected = [{ d: 15, dow: 1, m: 34, s: 56, ms: 0 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFromNoTable()
            .select({
                d:   ts.getDate(),
                dow: ts.getDay(),
                m:   ts.getMinutes(),
                s:   ts.getSeconds(),
                ms:  ts.getMilliseconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datepart(day, @0) as [d], (datepart(weekday, @1) + @@datefirst - 1) % 7 as dow, datepart(minute, @2) as [m], datepart(second, @3) as [s], datepart(millisecond, @4) as ms"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-15T12:34:56.000Z,
            2024-01-15T12:34:56.000Z,
            2024-01-15T12:34:56.000Z,
            2024-01-15T12:34:56.000Z,
            2024-01-15T12:34:56.000Z,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ d: number; dow: number; m: number; s: number; ms: number }>>>()
        expect(rows).toEqual(expected)
    })

    // Chained getter after a projection modifier — each modifier returns the
    // temporal leaf unchanged (up to its optional marker), so the following
    // date-part getter still fires on a COLUMN receiver. The column arm carries
    // no const cast; the modifier shapes the extracted expression (coalesce /
    // nullif / plain) and the projected optional marker of the number leaf.

    test('chained-valuewhennull-localdate-getmonth', async () => {
        // `workDate.valueWhenNull(fallback).getMonth()` — valueWhenNull re-imposes
        // the `required` marker, so the getMonth leaf is a required `number`.
        // work_date is non-null on worklog 1 (2024-03-04), so coalesce yields
        // 2024-03-04 -> month 2 (March, JS 0-indexed).
        const fallback = new Date(Date.UTC(2000, 0, 1))
        const expected = [{ mo: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                mo: tIssueWorklog.workDate.valueWhenNull(fallback).getMonth(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datepart(month, isnull(work_date, @0)) - 1 as mo from issue_worklog where id = @1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2000-01-01T00:00:00.000Z,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ mo: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('chained-nullifvalue-localdate-getmonth', async () => {
        // `workDate.nullIfValue(other).getMonth()` — nullIfValue widens the leaf
        // to optional (nullif could yield NULL), so the getMonth leaf is
        // `?: number`. `other` (2000-01-01) differs from work_date, so
        // nullif yields 2024-03-04 -> month 2 (March, JS 0-indexed).
        const other = new Date(Date.UTC(2000, 0, 1))
        const expected = [{ mo: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                mo: tIssueWorklog.workDate.nullIfValue(other).getMonth(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datepart(month, nullif(work_date, @0)) - 1 as mo from issue_worklog where id = @1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2000-01-01T00:00:00.000Z,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ mo?: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('chained-asrequiredinoptionalobject-localdate-getmonth', async () => {
        // `reviewDate.asRequiredInOptionalObject().getMonth()` — the optional
        // review_date column re-marked `requiredInOptionalObject`. As the sole
        // projected field (no required sibling) the object is treated as optional,
        // so the getMonth leaf carries the undefined arm (`?: number`).
        // review 1: review_date 2024-05-20 -> month 4 (May, JS 0-indexed).
        const expected = [{ mo: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectReview)
            .where(tProjectReview.id.equals(1))
            .select({
                mo: tProjectReview.reviewDate.asRequiredInOptionalObject().getMonth(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datepart(month, review_date) - 1 as mo from project_review where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ mo?: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('chained-onlywhenornull-localtime-gethours', async () => {
        // `startedAt.onlyWhenOrNull(true).getHours()` — onlyWhenOrNull(true) keeps
        // the value source unchanged; the getHours leaf stays optional
        // (`?: number`). worklog 1: started_at 09:15:00 -> hours 9.
        const expected = [{ h: 9 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                h: tIssueWorklog.startedAt.onlyWhenOrNull(true).getHours(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datepart(hour, started_at) as [h] from issue_worklog where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ h?: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('chained-ignorewhenasnull-localtime-gethours', async () => {
        // `startedAt.ignoreWhenAsNull(false).getHours()` — ignoreWhenAsNull(false)
        // is the pass-through branch (the value flows unchanged); the getHours leaf
        // stays optional (`?: number`). worklog 1: started_at 09:15:00
        // -> hours 9.
        const expected = [{ h: 9 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                h: tIssueWorklog.startedAt.ignoreWhenAsNull(false).getHours(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datepart(hour, started_at) as [h] from issue_worklog where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ h?: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('chained-modifiers-customlocaldatetime-getfullyear', async () => {
        // The five projection modifiers on the customLocalDateTime column
        // signedOffAt, each followed by getFullYear — proving the modifier returns
        // the custom-temporal leaf so the getter still fires, and pinning each
        // modifier's SQL shape + projected optional marker:
        //   valueWhenNull            -> coalesce(...), required `number` leaf
        //   nullIfValue              -> nullif(...),   optional leaf
        //   asRequiredInOptionalObject -> plain,       requiredInOptionalObject leaf
        //   onlyWhenOrNull(true)     -> plain (kept),  optional leaf
        //   ignoreWhenAsNull(false)  -> plain (kept),  optional leaf
        // vwn is required, so it anchors the object and the other four leaves
        // project as `?: number` (no undefined arm). release 1: signed_off_at
        // 2024-01-14 12:30:00 -> year 2024 for every arm (coalesce/nullif fall
        // through to the non-null column value).
        const fallback = new Date(Date.UTC(2000, 0, 1, 0, 0, 0))
        const other = new Date(Date.UTC(1999, 0, 1, 0, 0, 0))
        const expected = [{ vwn: 2024, nif: 2024, rio: 2024, own: 2024, ign: 2024 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                vwn: tProjectRelease.signedOffAt.valueWhenNull(fallback).getFullYear(),
                nif: tProjectRelease.signedOffAt.nullIfValue(other).getFullYear(),
                rio: tProjectRelease.signedOffAt.asRequiredInOptionalObject().getFullYear(),
                own: tProjectRelease.signedOffAt.onlyWhenOrNull(true).getFullYear(),
                ign: tProjectRelease.signedOffAt.ignoreWhenAsNull(false).getFullYear(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datepart(year, isnull(signed_off_at, @0)) as vwn, datepart(year, nullif(signed_off_at, @1)) as nif, datepart(year, signed_off_at) as rio, datepart(year, signed_off_at) as own, datepart(year, signed_off_at) as ign from project_release where id = @2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2000-01-01T00:00:00.000Z,
            1999-01-01T00:00:00.000Z,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ vwn: number; nif?: number; rio?: number; own?: number; ign?: number }>>>()
        expect(rows).toEqual(expected)
    })
    // The optionalConst receiver arm of the same const-cast getter surface.
    // `optionalConst(..., kind)` is still a const value, so `isConstValue()` is
    // true and each getter takes the same `forceTypeCast` arm (identical SQL to
    // the required-const twin above). The only difference is the projected leaf:
    // an optional temporal receiver yields an optional number leaf
    // (`?: number`). The const values are non-null, so every getter
    // realizes a concrete part and the value assertion stays deterministic.

    test('optional-const-localdate-getters', async () => {
        // getFullYear/getMonth/getDate/getDay on an `optionalConst(..., 'localDate')`.
        // Same 2024-01-15 (Monday) const as const-localdate-getters -> year 2024,
        // month 0, date 15, day-of-week 1; every leaf projects as `?: number`.
        const d = ctx.conn.optionalConst(new Date(Date.UTC(2024, 0, 15)), 'localDate')
        const expected = [{ y: 2024, mo: 0, d: 15, dow: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFromNoTable()
            .select({
                y:   d.getFullYear(),
                mo:  d.getMonth(),
                d:   d.getDate(),
                dow: d.getDay(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datepart(year, @0) as [y], datepart(month, @1) - 1 as mo, datepart(day, @2) as [d], (datepart(weekday, @3) + @@datefirst - 1) % 7 as dow"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-15T00:00:00.000Z,
            2024-01-15T00:00:00.000Z,
            2024-01-15T00:00:00.000Z,
            2024-01-15T00:00:00.000Z,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ y?: number; mo?: number; d?: number; dow?: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('optional-const-localtime-getters', async () => {
        // getHours/getMinutes/getSeconds/getMilliseconds on an
        // `optionalConst(..., 'localTime')`. Same 12:34:56 const as
        // const-localtime-getters -> hours 12, minutes 34, seconds 56,
        // milliseconds 0; every leaf projects as `?: number`.
        const t = ctx.conn.optionalConst(new Date('1970-01-01T12:34:56Z'), 'localTime')
        const expected = [{ h: 12, m: 34, s: 56, ms: 0 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFromNoTable()
            .select({
                h:  t.getHours(),
                m:  t.getMinutes(),
                s:  t.getSeconds(),
                ms: t.getMilliseconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datepart(hour, @0) as [h], datepart(minute, @1) as [m], datepart(second, @2) as [s], datepart(millisecond, @3) as ms"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1970-01-01T12:34:56.000Z,
            1970-01-01T12:34:56.000Z,
            1970-01-01T12:34:56.000Z,
            1970-01-01T12:34:56.000Z,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ h?: number; m?: number; s?: number; ms?: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('optional-const-localdatetime-getters', async () => {
        // The full nine-getter set on an `optionalConst(..., 'localDateTime')`:
        // getFullYear/getMonth/getDate/getDay/getHours/getMinutes/getSeconds/
        // getMilliseconds/getTime. Same 2024-01-15 12:34:56 UTC const as the
        // required twin -> year 2024, month 0, date 15, day-of-week 1, hours 12,
        // minutes 34, seconds 56, milliseconds 0, epoch millis; every leaf
        // projects as `?: number`.
        const ts = ctx.conn.optionalConst(new Date('2024-01-15T12:34:56Z'), 'localDateTime')
        const expected = [{
            y: 2024, mo: 0, d: 15, dow: 1, h: 12, m: 34, s: 56, ms: 0,
            t: Date.UTC(2024, 0, 15, 12, 34, 56),
        }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFromNoTable()
            .select({
                y:   ts.getFullYear(),
                mo:  ts.getMonth(),
                d:   ts.getDate(),
                dow: ts.getDay(),
                h:   ts.getHours(),
                m:   ts.getMinutes(),
                s:   ts.getSeconds(),
                ms:  ts.getMilliseconds(),
                t:   ts.getTime(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datepart(year, @0) as [y], datepart(month, @1) - 1 as mo, datepart(day, @2) as [d], (datepart(weekday, @3) + @@datefirst - 1) % 7 as dow, datepart(hour, @4) as [h], datepart(minute, @5) as [m], datepart(second, @6) as [s], datepart(millisecond, @7) as ms, datediff_big(millisecond, '1970-01-01 00:00:00', @8) as [t]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-15T12:34:56.000Z,
            2024-01-15T12:34:56.000Z,
            2024-01-15T12:34:56.000Z,
            2024-01-15T12:34:56.000Z,
            2024-01-15T12:34:56.000Z,
            2024-01-15T12:34:56.000Z,
            2024-01-15T12:34:56.000Z,
            2024-01-15T12:34:56.000Z,
            2024-01-15T12:34:56.000Z,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            y?: number; mo?: number; d?: number; dow?: number; h?: number
            m?: number; s?: number; ms?: number; t?: number
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('custom-localdatetime-asoptional-projected', async () => {
        // `tProjectRelease.publishedAt.asOptional()` projected directly — the
        // required customLocalDateTime column re-marked optional by `asOptional()`,
        // the required->optional overload projected on its own (no other modifier
        // shapes it). published_at is non-null on release 1, so the leaf realizes a
        // concrete Date and projects as `?: Date`.
        const expected = [{ p: new Date('2024-01-16T09:00:00Z') }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                p: tProjectRelease.publishedAt.asOptional(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select published_at as [p] from project_release where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ p?: Date }>>>()
        expect(rows).toEqual(expected)
    })

    test('const-localdatetime-subsecond-getters-truncate', async () => {
        // The sub-second contract of the date-part getters, which mirror JavaScript's
        // `Date` accessors: `getSeconds()` is 0-59 and `getMilliseconds()` 0-999, and the
        // part below each is TRUNCATED, never rounded. A dialect extracting the seconds
        // as a fractional number and rounding it reports a 60th second for :59.999, and
        // one whose millisecond field goes through an approximate value loses the 1 of
        // :01.001. Both instants carry plain millisecond precision, so a JS `Date`
        // expresses them exactly and every dialect can store them.
        const endOfMinute = ctx.conn.const(new Date('2024-01-15T12:30:59.999Z'), 'localDateTime')
        const firstMilli = ctx.conn.const(new Date('2024-01-15T12:30:01.001Z'), 'localDateTime')
        const expected = [{ s1: 59, ms1: 999, s2: 1, ms2: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFromNoTable()
            .select({
                s1:  endOfMinute.getSeconds(),
                ms1: endOfMinute.getMilliseconds(),
                s2:  firstMilli.getSeconds(),
                ms2: firstMilli.getMilliseconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datepart(second, @0) as s1, datepart(millisecond, @1) as ms1, datepart(second, @2) as s2, datepart(millisecond, @3) as ms2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-15T12:30:59.999Z,
            2024-01-15T12:30:59.999Z,
            2024-01-15T12:30:01.001Z,
            2024-01-15T12:30:01.001Z,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ s1: number; ms1: number; s2: number; ms2: number }>>>()
        expect(rows).toEqual(expected)
    })

})
