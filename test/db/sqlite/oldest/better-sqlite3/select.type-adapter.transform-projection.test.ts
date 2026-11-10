// The `transformProjection` of a type adapter writes the SQL of a value as it leaves the database, in a column of the
// result; its `transformValueFromDB` reads what arrives. `dayMonthYear` gives a release day as the text DD/MM/YYYY and
// reads it back as the day: the text orders otherwise than the day (01/03/2024 < 15/01/2024 < 20/02/2024 for
// 2024-03-01, 2024-01-15 and 2024-02-20), so an order by of the converted text would give the rows in another order.
// `monthYear` gives a day as the text MM/YYYY and reads it back as the first day of that month: two days of the same
// month give the same text, so a union of the converted texts would merge them.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DefaultTypeAdapter, ProjectionOutput, TypeAdapter, TypeCategory } from '../../../../../src/TypeAdapter.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

type ReleaseDay = Date & { readonly __brand: 'ReleaseDay' }
type Amount = string & { readonly __brand: 'Amount' }

// A localDate is read as 10:00 UTC of its day
function dayOf(year: number, month: number, day: number): ReleaseDay {
    return new Date(Date.UTC(year, month - 1, day, 10)) as ReleaseDay
}

const dayMonthYear: TypeAdapter = {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        const parts = typeof value === 'string' ? /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(value) : null
        if (parts) {
            return next.transformValueFromDB(parts[3] + '-' + parts[2] + '-' + parts[1], type, typeCategory)
        }
        return next.transformValueFromDB(value, type, typeCategory)
    },
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, type, typeCategory)
    },
    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string {
        if (output === 'resultColumn') {
            return "strftime('%d/%m/%Y', " + sql + ")"
        }
        return next.transformProjection(sql, type, typeCategory, output)
    },
}

const monthYear: TypeAdapter = {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        const parts = typeof value === 'string' ? /^(\d\d)\/(\d{4})$/.exec(value) : null
        if (parts) {
            return next.transformValueFromDB(parts[2] + '-' + parts[1] + '-01', type, typeCategory)
        }
        return next.transformValueFromDB(value, type, typeCategory)
    },
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, type, typeCategory)
    },
    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string {
        if (output === 'resultColumn') {
            return "strftime('%m/%Y', " + sql + ")"
        }
        return next.transformProjection(sql, type, typeCategory, output)
    },
}

// Every transform delegates to the library
const delegating: TypeAdapter = {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, type, typeCategory)
    },
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, type, typeCategory)
    },
    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string {
        return next.transformProjection(sql, type, typeCategory, output)
    },
}

// The result of a function called, lowered
const lowered: TypeAdapter = {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, type, typeCategory)
    },
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, type, typeCategory)
    },
    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string {
        if (output === 'resultColumn') {
            return 'lower(' + sql + ')'
        }
        return next.transformProjection(sql, type, typeCategory, output)
    },
}

// project_release: 1 released on 2024-01-15, 2 on 2024-02-20, 3 on 2024-03-01
const tReleaseDay = new class TReleaseDay extends Table<DBConnection, 'TReleaseDay'> {
    id         = this.primaryKey('id', 'int')
    releasedOn = this.column<ReleaseDay, 'ReleaseDay'>('released_on', 'customLocalDate', 'ReleaseDay', dayMonthYear)
    constructor() { super('project_release') }
}()

const tReleaseDayDelegating = new class TReleaseDayDelegating extends Table<DBConnection, 'TReleaseDayDelegating'> {
    id         = this.primaryKey('id', 'int')
    releasedOn = this.column<ReleaseDay, 'ReleaseDay'>('released_on', 'customLocalDate', 'ReleaseDay', delegating)
    constructor() { super('project_release') }
}()

const tReleaseDayPlain = new class TReleaseDayPlain extends Table<DBConnection, 'TReleaseDayPlain'> {
    id         = this.primaryKey('id', 'int')
    releasedOn = this.column<ReleaseDay, 'ReleaseDay'>('released_on', 'customLocalDate', 'ReleaseDay')
    constructor() { super('project_release') }
}()

// issue_worklog: 1 on 2024-03-04, 2 on 2024-03-05, 3 on 2024-03-06
const tWorkMonth = new class TWorkMonth extends Table<DBConnection, 'TWorkMonth'> {
    id       = this.primaryKey('id', 'int')
    workDate = this.column<ReleaseDay, 'ReleaseDay'>('work_date', 'customLocalDate', 'ReleaseDay', monthYear)
    constructor() { super('issue_worklog') }
}()

// exact_amount: 1 has the price 1.50
const tPriceDelegating = new class TPriceDelegating extends Table<DBConnection, 'TPriceDelegating'> {
    id    = this.primaryKey('id', 'int')
    price = this.optionalColumn<Amount, 'Amount'>('price', 'customDecimal', 'Amount', delegating)
    constructor() { super('exact_amount') }
}()

// Every ReleaseDay of the connection, without a type adapter, given as the text DD/MM/YYYY and read back as the day
class DayAsTextConnection extends DBConnection {
    protected override transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput): string {
        if (type === 'ReleaseDay' && output === 'resultColumn') {
            return "strftime('%d/%m/%Y', " + sql + ")"
        }
        return super.transformProjection(sql, type, typeCategory, output)
    }
    protected override transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory): unknown {
        const parts = type === 'ReleaseDay' && typeof value === 'string' ? /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(value) : null
        if (parts) {
            return super.transformValueFromDB(parts[3] + '-' + parts[2] + '-' + parts[1], type, typeCategory)
        }
        return super.transformValueFromDB(value, type, typeCategory)
    }
}

class FunctionCallConnection extends DBConnection {
    callUpperLowered(value: string) {
        return this.executeFunction('upper', [this.const(value, 'string')], 'string', 'required', lowered)
    }
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('transform-projection/converts-the-column-of-the-result', async () => {
        ctx.mockNext([
            { id: 1, day: '15/01/2024' },
            { id: 2, day: '20/02/2024' },
            { id: 3, day: '01/03/2024' },
        ])
        const rows = await ctx.conn.selectFrom(tReleaseDay)
            .select({ id: tReleaseDay.id, day: tReleaseDay.releasedOn })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, strftime('%d/%m/%Y', released_on) as day from project_release order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, { id: number; day: ReleaseDay }[]>>()
        expect(rows).toEqual([
            { id: 1, day: dayOf(2024, 1, 15) },
            { id: 2, day: dayOf(2024, 2, 20) },
            { id: 3, day: dayOf(2024, 3, 1) },
        ])
    })

    test('transform-projection/order-by-the-alias-orders-by-the-value', async () => {
        ctx.mockNext([
            { id: 1, day: '15/01/2024' },
            { id: 2, day: '20/02/2024' },
            { id: 3, day: '01/03/2024' },
        ])
        const rows = await ctx.conn.selectFrom(tReleaseDay)
            .select({ id: tReleaseDay.id, day: tReleaseDay.releasedOn })
            .orderBy('day')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, strftime('%d/%m/%Y', released_on) as day from project_release order by project_release.released_on"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, { id: number; day: ReleaseDay }[]>>()
        expect(rows).toEqual([
            { id: 1, day: dayOf(2024, 1, 15) },
            { id: 2, day: dayOf(2024, 2, 20) },
            { id: 3, day: dayOf(2024, 3, 1) },
        ])
    })

    test('transform-projection/distinct-order-by-the-alias-orders-by-the-value', async () => {
        ctx.mockNext(['01/03/2024', '20/02/2024', '15/01/2024'])
        const days = await ctx.conn.selectDistinctFrom(tReleaseDay)
            .selectOneColumn(tReleaseDay.releasedOn)
            .orderBy('result', 'desc')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%d/%m/%Y', o_1_.result) as result from (select distinct released_on as result from project_release) as o_1_ order by o_1_.result desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof days, ReleaseDay[]>>()
        expect(days).toEqual([dayOf(2024, 3, 1), dayOf(2024, 2, 20), dayOf(2024, 1, 15)])
    })

    test('transform-projection/compound-order-by-the-alias-orders-by-the-value', async () => {
        ctx.mockNext([
            { id: 1, day: '15/01/2024' },
            { id: 2, day: '20/02/2024' },
            { id: 3, day: '01/03/2024' },
        ])
        const rows = await ctx.conn.selectFrom(tReleaseDay)
            .where(tReleaseDay.id.equals(3))
            .select({ id: tReleaseDay.id, day: tReleaseDay.releasedOn })
            .union(
                ctx.conn.selectFrom(tReleaseDay)
                    .where(tReleaseDay.id.in([1, 2]))
                    .select({ id: tReleaseDay.id, day: tReleaseDay.releasedOn })
            )
            .orderBy('day')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select o_1_.id as id, strftime('%d/%m/%Y', o_1_.day) as day from (select id as id, released_on as day from project_release where id = ?1 union select id as id, released_on as day from project_release where id in (?2, ?3)) as o_1_ order by o_1_.day"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, { id: number; day: ReleaseDay }[]>>()
        expect(rows).toEqual([
            { id: 1, day: dayOf(2024, 1, 15) },
            { id: 2, day: dayOf(2024, 2, 20) },
            { id: 3, day: dayOf(2024, 3, 1) },
        ])
    })

    test('transform-projection/union-compares-the-values', async () => {
        // 2024-03-04 and 2024-03-05 are two values with the same text 03/2024: the union keeps both
        ctx.mockNext(['03/2024', '03/2024'])
        const months = await ctx.conn.selectFrom(tWorkMonth)
            .where(tWorkMonth.id.equals(1))
            .selectOneColumn(tWorkMonth.workDate)
            .union(
                ctx.conn.selectFrom(tWorkMonth)
                    .where(tWorkMonth.id.equals(2))
                    .selectOneColumn(tWorkMonth.workDate)
            )
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%m/%Y', o_1_.result) as result from (select work_date as result from issue_worklog where id = ?1 union select work_date as result from issue_worklog where id = ?2) as o_1_"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof months, ReleaseDay[]>>()
        expect(months).toEqual([dayOf(2024, 3, 1), dayOf(2024, 3, 1)])
    })

    test('transform-projection/group-by-and-having-use-the-value', async () => {
        ctx.mockNext([
            { day: '20/02/2024', releases: 1 },
            { day: '01/03/2024', releases: 1 },
        ])
        const rows = await ctx.conn.selectFrom(tReleaseDay)
            .select({ day: tReleaseDay.releasedOn, releases: ctx.conn.countAll() })
            .groupBy('day')
            .having(tReleaseDay.releasedOn.greaterThan(dayOf(2024, 2, 1)))
            .orderBy('day')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%d/%m/%Y', released_on) as day, count(*) as releases from project_release group by released_on having released_on > ?1 order by project_release.released_on"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-02-01",
          ]
        `)
        assertType<Exact<typeof rows, { day: ReleaseDay; releases: number }[]>>()
        expect(rows).toEqual([
            { day: dayOf(2024, 2, 20), releases: 1 },
            { day: dayOf(2024, 3, 1), releases: 1 },
        ])
    })

    test('transform-projection/with-and-subquery-use-the-value', async () => {
        const releaseDays = ctx.conn.selectFrom(tReleaseDay)
            .select({ id: tReleaseDay.id, day: tReleaseDay.releasedOn })
            .forUseInQueryAs('releaseDays')
        const later = ctx.conn.selectFrom(tReleaseDay)
            .where(tReleaseDay.id.notEquals(1))
            .selectOneColumn(tReleaseDay.releasedOn)
        ctx.mockNext([
            { id: 2, day: '20/02/2024' },
            { id: 3, day: '01/03/2024' },
        ])
        const rows = await ctx.conn.selectFrom(releaseDays)
            .where(releaseDays.day.in(later))
            .and(releaseDays.day.greaterThan(dayOf(2024, 2, 1)))
            .select({ id: releaseDays.id, day: releaseDays.day })
            .orderBy('day')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with releaseDays as (select id as id, released_on as day from project_release) select id as id, strftime('%d/%m/%Y', day) as day from releaseDays where day in (select released_on as result from project_release where id <> ?1) and day > ?2 order by releaseDays.day"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "2024-02-01",
          ]
        `)
        assertType<Exact<typeof rows, { id: number; day: ReleaseDay }[]>>()
        expect(rows).toEqual([
            { id: 2, day: dayOf(2024, 2, 20) },
            { id: 3, day: dayOf(2024, 3, 1) },
        ])
    })

    test('transform-projection/an-adapter-that-delegates-changes-nothing', async () => {
        ctx.mockNext([{ id: 1, day: '2024-01-15' }])
        const plain = await ctx.conn.selectFrom(tReleaseDayPlain)
            .where(tReleaseDayPlain.id.equals(1))
            .select({ id: tReleaseDayPlain.id, day: tReleaseDayPlain.releasedOn })
            .orderBy('day')
            .executeSelectMany()
        const plainSql = ctx.lastSql
        ctx.mockNext([{ id: 1, day: '2024-01-15' }])
        const rows = await ctx.conn.selectFrom(tReleaseDayDelegating)
            .where(tReleaseDayDelegating.id.equals(1))
            .select({ id: tReleaseDayDelegating.id, day: tReleaseDayDelegating.releasedOn })
            .orderBy('day')
            .executeSelectMany()
        expect(ctx.lastSql).toBe(plainSql)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, released_on as day from project_release where id = ?1 order by day"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, { id: number; day: ReleaseDay }[]>>()
        expect(plain).toEqual([{ id: 1, day: dayOf(2024, 1, 15) }])
        expect(rows).toEqual([{ id: 1, day: dayOf(2024, 1, 15) }])
    })

    test('transform-projection/a-connection-converts-every-column-of-a-type', async () => {
        const connection = ctx.withConnection(DayAsTextConnection)
        ctx.mockNext([
            { id: 1, day: '15/01/2024' },
            { id: 2, day: '20/02/2024' },
            { id: 3, day: '01/03/2024' },
        ])
        const rows = await connection.selectFrom(tReleaseDayPlain)
            .select({ id: tReleaseDayPlain.id, day: tReleaseDayPlain.releasedOn })
            .orderBy('day')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, strftime('%d/%m/%Y', released_on) as day from project_release order by project_release.released_on"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, { id: number; day: ReleaseDay }[]>>()
        expect(rows).toEqual([
            { id: 1, day: dayOf(2024, 1, 15) },
            { id: 2, day: dayOf(2024, 2, 20) },
            { id: 3, day: dayOf(2024, 3, 1) },
        ])
    })

    test('transform-projection/next-keeps-the-conversion-of-the-library', async () => {
        ctx.mockNext([{ id: 1, price: '1.5' }])
        const rows = await ctx.conn.selectFrom(tPriceDelegating)
            .where(tPriceDelegating.id.equals(1))
            .select({ id: tPriceDelegating.id, price: tPriceDelegating.price })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, price as price from exact_amount where id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, { id: number; price?: Amount }[]>>()
        expect(rows).toEqual([{ id: 1, price: '1.5' }])
    })

    test('transform-projection/converts-the-result-of-a-function', async () => {
        const connection = ctx.withConnection(FunctionCallConnection)
        ctx.mockNext('mixed case')
        const result = await connection.callUpperLowered('Mixed Case')
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select lower(upper(?1))"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Mixed Case",
          ]
        `)
        assertType<Exact<typeof result, string>>()
        expect(result).toBe('mixed case')
    })
})
