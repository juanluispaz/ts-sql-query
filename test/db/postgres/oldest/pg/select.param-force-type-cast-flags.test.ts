// Some databases can't work out the type of a parameter in some positions: a
// constant selected alone, a row of a Values list, the argument of a function,
// `extract(... from <param>)`. For those positions the library marks the
// parameter with forceTypeCast, which any query runner can read with
// getQueryParamForceTypeCast (public API) to send the parameter with its type,
// either as a cast in the placeholder or as a type of the driver. Which
// positions get the flag depends on the database: each cell snapshots the flags
// its connection sets. A parameter compared with a column gets its type from the
// column, and goes untyped. The rows show the type reached the engine: a
// constant comes back with its own type, and a null in the first row of a
// Values list doesn't turn the column into text.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { getQueryParamForceTypeCast } from '../../../../../src/exports/v2/index.js'
import { Values } from '../../../../../src/Values.js'
import { DBConnection, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

class VAmount extends Values<DBConnection, 'vAmount'> {
    id     = this.column('int')
    amount = this.optionalColumn('int')
}

function forceTypeCasts(): Array<boolean | undefined> {
    const params = ctx.lastParams
    return params.map((_value, index) => getQueryParamForceTypeCast(ctx.lastSql, params, index))
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('typed-params/constants-selected-alone', async () => {
        const expected = { i: 7, b: 9999999999n, t: 'abc', f: true, d: 1.5 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFromNoTable()
            .select({
                i:   ctx.conn.const(7, 'int'),
                b:   ctx.conn.const(9999999999n, 'bigint'),
                t:   ctx.conn.const('abc', 'string'),
                f:   ctx.conn.const(true, 'boolean'),
                d:   ctx.conn.const(1.5, 'double'),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int4 as i, $2::int8 as b, $3::text as t, $4::bool as f, $5::float8 as d"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            9999999999n,
            "abc",
            true,
            1.5,
          ]
        `)
        expect(forceTypeCasts()).toMatchInlineSnapshot(`
          [
            true,
            true,
            true,
            true,
            true,
          ]
        `)
        assertType<Exact<typeof row, { i: number; b: bigint; t: string; f: boolean; d: number }>>()
        expect(row).toEqual(expected)
    })

    test('typed-params/a-values-row-with-a-null', async () => {
        // The first row's amount is null. A database that types a column of the
        // Values list from its rows needs that null typed as int; otherwise the
        // column could be text, and 5 would come back as '5'.
        ctx.mockNext([{ id: 1, amount: null }, { id: 2, amount: 5 }])
        const amounts = Values.create(VAmount, 'vAmount', [
            { id: 1, amount: null },
            { id: 2, amount: 5 },
        ])
        const rows = await ctx.conn.selectFrom(amounts)
            .select({ id: amounts.id, amount: amounts.amount })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with vAmount(id, amount) as (values ($1::int4, $2::int4), ($3::int4, $4::int4)) select id as id, amount as amount from vAmount order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            null,
            2,
            5,
          ]
        `)
        expect(forceTypeCasts()).toMatchInlineSnapshot(`
          [
            true,
            true,
            true,
            true,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; amount?: number }>>>()
        expect(rows).toEqual([{ id: 1 }, { id: 2, amount: 5 }])
    })

    test('typed-params/a-function-argument', async () => {
        // count_open_issues(1) counts the open issues of project 1: issue 1.
        ctx.mockNext(1)
        const count = await ctx.conn.callCountOpenIssues(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count_open_issues($1::int4)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(forceTypeCasts()).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof count, number>>()
        expect(count).toBe(1)
    })

    test('typed-params/extract-of-a-date-constant', async () => {
        // 2024-01-15 is a Monday
        const day = ctx.conn.const(new Date(Date.UTC(2024, 0, 15)), 'localDate')
        const expected = { year: 2024, dayOfWeek: 1 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFromNoTable()
            .select({ year: day.getFullYear(), dayOfWeek: day.getDay() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(year from $1::date) as year, extract(dow from $2::date) as "dayOfWeek""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-15T00:00:00.000Z,
            2024-01-15T00:00:00.000Z,
          ]
        `)
        expect(forceTypeCasts()).toMatchInlineSnapshot(`
          [
            true,
            true,
          ]
        `)
        assertType<Exact<typeof row, { year: number; dayOfWeek: number }>>()
        expect(row).toEqual(expected)
    })

    test('typed-params/a-null-of-a-known-type', async () => {
        // onlyWhenOrNull(false) renders a null for an int: a null parameter that
        // carries its type, or a null literal where the database needs no type
        ctx.mockNext([{ id: 1, none: null }])
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, none: tProject.id.onlyWhenOrNull(false) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, $1::int4 as none from project where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
            1,
          ]
        `)
        expect(forceTypeCasts()).toMatchInlineSnapshot(`
          [
            true,
            false,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; none?: number }>>>()
        expect(rows).toEqual([{ id: 1 }])
    })

    test('typed-params/a-value-compared-with-a-column-goes-untyped', async () => {
        // project 1 is 'Marketing site'
        ctx.mockNext('Marketing site')
        const name = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .selectOneColumn(tProject.name)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select name as result from project where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(forceTypeCasts()).toMatchInlineSnapshot(`
          [
            false,
          ]
        `)
        assertType<Exact<typeof name, string>>()
        expect(name).toBe('Marketing site')
    })
})
