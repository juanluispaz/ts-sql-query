// Coverage of the CONST-receiver arm of the temporal date-part getters.
// `AbstractSqlBuilder._appendSqlForDatePartArgument` has two arms: a
// `isConstValue()` -> `forceTypeCast = true` arm that wraps the placeholder in
// a `::date`/`::time`/`::timestamp` cast inside `extract(...)`, and a plain
// column arm with no cast. Every existing getter test in `select.date-ops.test.ts`
// uses a COLUMN receiver, so the const-cast arm — the one that exists precisely
// so an untyped `$1` inside `extract(...)` resolves on PostgreSQL — is never
// observed. Here the receiver is a `const(new Date(...), 'localDate'|...)`, so
// each dialect's cast form is pinned by the snapshot.
//
// The const values are fixed and TZ-independent under the suite's forced UTC,
// so every getter's realized value is deterministic and real-DB-validatable.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select year(?) as \`y\`, month(?) - 1 as mo, dayofmonth(?) as \`d\`, dayofweek(?) - 1 as dow"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select hour(?) as \`h\`, minute(?) as \`m\`, second(?) as \`s\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "12:34:56",
            "12:34:56",
            "12:34:56",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select year(?) as \`y\`, month(?) - 1 as mo, hour(?) as \`h\`, round(unix_timestamp(?) * 1000) as \`t\`"`)
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
})
