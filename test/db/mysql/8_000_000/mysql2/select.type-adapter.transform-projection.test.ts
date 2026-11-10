// The `transformProjection` of a type adapter writes the SQL of a value as it leaves the database, in a column of the
// result; its `transformValueFromDB` reads what arrives. `dayMonthYear` gives a release day as the text DD/MM/YYYY and
// reads it back as the day: the text orders otherwise than the day (01/03/2024 < 15/01/2024 < 20/02/2024 for
// 2024-03-01, 2024-01-15 and 2024-02-20), so an order by of the converted text would give the rows in another order.
// `monthYear` gives a day as the text MM/YYYY and reads it back as the first day of that month: two days of the same
// month give the same text, so a union of the converted texts would merge them.
// Their `projectionComparison` says it: DD/MM/YYYY is `'equality'` (equal days give equal texts, but the texts order
// otherwise) and MM/YYYY is `'none'`. `isoDay` gives the day as the text YYYY-MM-DD, which compares and orders as the
// day: it declares nothing, the default `'value'`, and the query only converts the column in place.
// `dayMonthYearOfColumn` writes DD/MM/YYYY too but declares `'columnEquality'`, as the text of a decimal whose scale
// depends on the column: a distinct compares one column and converts in place, a compound query is wrapped.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DefaultTypeAdapter, ProjectionComparison, ProjectionOutput, TypeAdapter, TypeCategory } from '../../../../../src/TypeAdapter.js'
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
            return "date_format(" + sql + ", '%d/%m/%Y')"
        }
        return next.transformProjection(sql, type, typeCategory, output)
    },
    projectionComparison(_type: string, _typeCategory: TypeCategory, _output: ProjectionOutput, _next: DefaultTypeAdapter): ProjectionComparison {
        return 'equality'
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
            return "date_format(" + sql + ", '%m/%Y')"
        }
        return next.transformProjection(sql, type, typeCategory, output)
    },
    projectionComparison(_type: string, _typeCategory: TypeCategory, _output: ProjectionOutput, _next: DefaultTypeAdapter): ProjectionComparison {
        return 'none'
    },
}

// The day as YYYY-MM-DD, which compares and orders as the day
const isoDay: TypeAdapter = {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, type, typeCategory)
    },
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, type, typeCategory)
    },
    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string {
        if (output === 'resultColumn') {
            return "date_format(" + sql + ", '%Y-%m-%d')"
        }
        return next.transformProjection(sql, type, typeCategory, output)
    },
}

// The day as DD/MM/YYYY, declared as comparing only among the values of one column
const dayMonthYearOfColumn: TypeAdapter = {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return dayMonthYear.transformValueFromDB(value, type, typeCategory, next)
    },
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, type, typeCategory)
    },
    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string {
        return dayMonthYear.transformProjection!(sql, type, typeCategory, output, next)
    },
    projectionComparison(_type: string, _typeCategory: TypeCategory, _output: ProjectionOutput, _next: DefaultTypeAdapter): ProjectionComparison {
        return 'columnEquality'
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

const tReleaseIsoDay = new class TReleaseIsoDay extends Table<DBConnection, 'TReleaseIsoDay'> {
    id         = this.primaryKey('id', 'int')
    releasedOn = this.column<ReleaseDay, 'ReleaseDay'>('released_on', 'customLocalDate', 'ReleaseDay', isoDay)
    constructor() { super('project_release') }
}()

const tReleaseDayOfColumn = new class TReleaseDayOfColumn extends Table<DBConnection, 'TReleaseDayOfColumn'> {
    id         = this.primaryKey('id', 'int')
    releasedOn = this.column<ReleaseDay, 'ReleaseDay'>('released_on', 'customLocalDate', 'ReleaseDay', dayMonthYearOfColumn)
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
            return "date_format(" + sql + ", '%d/%m/%Y')"
        }
        return super.transformProjection(sql, type, typeCategory, output)
    }
    protected override projectionComparison(type: string, typeCategory: TypeCategory, output: ProjectionOutput): ProjectionComparison {
        if (type === 'ReleaseDay' && output === 'resultColumn') {
            return 'equality'
        }
        return super.projectionComparison(type, typeCategory, output)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, date_format(released_on, '%d/%m/%Y') as \`day\` from project_release order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, date_format(released_on, '%d/%m/%Y') as \`day\` from project_release order by project_release.released_on"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date_format(o_1_.result, '%d/%m/%Y') as result from (select distinct released_on as result from project_release) as o_1_ order by o_1_.result desc"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select o_1_.id as id, date_format(o_1_.\`day\`, '%d/%m/%Y') as \`day\` from (select id as id, released_on as \`day\` from project_release where id = ? union select id as id, released_on as \`day\` from project_release where id in (?, ?)) as o_1_ order by o_1_.\`day\`"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date_format(o_1_.result, '%m/%Y') as result from (select work_date as result from issue_worklog where id = ? union select work_date as result from issue_worklog where id = ?) as o_1_"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date_format(released_on, '%d/%m/%Y') as \`day\`, count(*) as releases from project_release group by released_on having project_release.released_on > ? order by project_release.released_on"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-02-01T10:00:00.000Z,
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with releaseDays as (select id as id, released_on as \`day\` from project_release) select id as id, date_format(\`day\`, '%d/%m/%Y') as \`day\` from releaseDays where \`day\` in (select released_on as result from project_release where id <> ?) and \`day\` > ? order by releaseDays.\`day\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2024-02-01T10:00:00.000Z,
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, released_on as \`day\` from project_release where id = ? order by \`day\`"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, date_format(released_on, '%d/%m/%Y') as \`day\` from project_release order by project_release.released_on"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, { id: number; day: ReleaseDay }[]>>()
        expect(rows).toEqual([
            { id: 1, day: dayOf(2024, 1, 15) },
            { id: 2, day: dayOf(2024, 2, 20) },
            { id: 3, day: dayOf(2024, 3, 1) },
        ])
    })

    test('transform-projection/next-keeps-the-conversion-of-the-library', async () => {
        ctx.mockNext([{ id: 1, price: '1.50' }])
        const rows = await ctx.conn.selectFrom(tPriceDelegating)
            .where(tPriceDelegating.id.equals(1))
            .select({ id: tPriceDelegating.id, price: tPriceDelegating.price })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, price as price from exact_amount where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, { id: number; price?: Amount }[]>>()
        expect(rows).toEqual([{ id: 1, price: '1.50' }])
    })

    test('transform-projection/converts-the-result-of-a-function', async () => {
        const connection = ctx.withConnection(FunctionCallConnection)
        ctx.mockNext('mixed case')
        const result = await connection.callUpperLowered('Mixed Case')
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select lower(upper(?))"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Mixed Case",
          ]
        `)
        assertType<Exact<typeof result, string>>()
        expect(result).toBe('mixed case')
    })

    test('transform-projection/a-value-conversion-orders-by-the-alias', async () => {
        // YYYY-MM-DD orders as the day: the order by is the alias of the converted column
        ctx.mockNext([
            { id: 1, day: '2024-01-15' },
            { id: 2, day: '2024-02-20' },
            { id: 3, day: '2024-03-01' },
        ])
        const rows = await ctx.conn.selectFrom(tReleaseIsoDay)
            .select({ id: tReleaseIsoDay.id, day: tReleaseIsoDay.releasedOn })
            .orderBy('day')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, date_format(released_on, '%Y-%m-%d') as \`day\` from project_release order by \`day\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, { id: number; day: ReleaseDay }[]>>()
        expect(rows).toEqual([
            { id: 1, day: dayOf(2024, 1, 15) },
            { id: 2, day: dayOf(2024, 2, 20) },
            { id: 3, day: dayOf(2024, 3, 1) },
        ])
    })

    test('transform-projection/a-value-conversion-distinct-order-by-is-not-wrapped', async () => {
        ctx.mockNext(['2024-03-01', '2024-02-20', '2024-01-15'])
        const days = await ctx.conn.selectDistinctFrom(tReleaseIsoDay)
            .selectOneColumn(tReleaseIsoDay.releasedOn)
            .orderBy('result', 'desc')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select distinct date_format(released_on, '%Y-%m-%d') as result from project_release order by result desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof days, ReleaseDay[]>>()
        expect(days).toEqual([dayOf(2024, 3, 1), dayOf(2024, 2, 20), dayOf(2024, 1, 15)])
    })

    test('transform-projection/a-value-conversion-compound-is-not-wrapped', async () => {
        // The arms convert the column, and the union and the order by use the texts, which compare and order as the days
        ctx.mockNext([
            { id: 1, day: '2024-01-15' },
            { id: 2, day: '2024-02-20' },
            { id: 3, day: '2024-03-01' },
        ])
        const rows = await ctx.conn.selectFrom(tReleaseIsoDay)
            .where(tReleaseIsoDay.id.equals(3))
            .select({ id: tReleaseIsoDay.id, day: tReleaseIsoDay.releasedOn })
            .union(
                ctx.conn.selectFrom(tReleaseIsoDay)
                    .where(tReleaseIsoDay.id.in([1, 2]))
                    .select({ id: tReleaseIsoDay.id, day: tReleaseIsoDay.releasedOn })
            )
            .orderBy('day')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, date_format(released_on, '%Y-%m-%d') as \`day\` from project_release where id = ? union select id as id, date_format(released_on, '%Y-%m-%d') as \`day\` from project_release where id in (?, ?) order by \`day\`"`)
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

    test('transform-projection/an-equality-conversion-compound-without-order-by-is-not-wrapped', async () => {
        // DD/MM/YYYY gives equal texts for equal days and different texts for different days: the union of the texts
        // keeps the rows the union of the days keeps
        ctx.mockNext([
            { id: 3, day: '01/03/2024' },
            { id: 1, day: '15/01/2024' },
            { id: 2, day: '20/02/2024' },
        ])
        const rows = await ctx.conn.selectFrom(tReleaseDay)
            .where(tReleaseDay.id.equals(3))
            .select({ id: tReleaseDay.id, day: tReleaseDay.releasedOn })
            .union(
                ctx.conn.selectFrom(tReleaseDay)
                    .where(tReleaseDay.id.in([1, 2]))
                    .select({ id: tReleaseDay.id, day: tReleaseDay.releasedOn })
            )
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, date_format(released_on, '%d/%m/%Y') as \`day\` from project_release where id = ? union select id as id, date_format(released_on, '%d/%m/%Y') as \`day\` from project_release where id in (?, ?)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, { id: number; day: ReleaseDay }[]>>()
        expect([...rows].sort((a, b) => a.id - b.id)).toEqual([
            { id: 1, day: dayOf(2024, 1, 15) },
            { id: 2, day: dayOf(2024, 2, 20) },
            { id: 3, day: dayOf(2024, 3, 1) },
        ])
    })

    test('transform-projection/an-equality-conversion-distinct-is-not-wrapped', async () => {
        ctx.mockNext(['15/01/2024', '20/02/2024', '01/03/2024'])
        const days = await ctx.conn.selectDistinctFrom(tReleaseDay)
            .selectOneColumn(tReleaseDay.releasedOn)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select distinct date_format(released_on, '%d/%m/%Y') as result from project_release"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof days, ReleaseDay[]>>()
        expect([...days].sort((a, b) => a.getTime() - b.getTime())).toEqual([dayOf(2024, 1, 15), dayOf(2024, 2, 20), dayOf(2024, 3, 1)])
    })

    test('transform-projection/distinct-compares-the-values', async () => {
        // 2024-03-04, 2024-03-05 and 2024-03-06 are three values with the same text 03/2024: the distinct keeps them
        ctx.mockNext(['03/2024', '03/2024', '03/2024'])
        const months = await ctx.conn.selectDistinctFrom(tWorkMonth)
            .selectOneColumn(tWorkMonth.workDate)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date_format(o_1_.result, '%m/%Y') as result from (select distinct work_date as result from issue_worklog) as o_1_"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof months, ReleaseDay[]>>()
        expect(months).toEqual([dayOf(2024, 3, 1), dayOf(2024, 3, 1), dayOf(2024, 3, 1)])
    })

    test('transform-projection/a-column-equality-conversion-distinct-is-not-wrapped', async () => {
        ctx.mockNext(['15/01/2024', '20/02/2024', '01/03/2024'])
        const days = await ctx.conn.selectDistinctFrom(tReleaseDayOfColumn)
            .selectOneColumn(tReleaseDayOfColumn.releasedOn)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select distinct date_format(released_on, '%d/%m/%Y') as result from project_release"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof days, ReleaseDay[]>>()
        expect([...days].sort((a, b) => a.getTime() - b.getTime())).toEqual([dayOf(2024, 1, 15), dayOf(2024, 2, 20), dayOf(2024, 3, 1)])
    })

    test('transform-projection/a-column-equality-conversion-compound-is-wrapped', async () => {
        // The arms compare values of two selects: the union compares the days and the wrapper converts them
        ctx.mockNext([
            { id: 3, day: '01/03/2024' },
            { id: 1, day: '15/01/2024' },
            { id: 2, day: '20/02/2024' },
        ])
        const rows = await ctx.conn.selectFrom(tReleaseDayOfColumn)
            .where(tReleaseDayOfColumn.id.equals(3))
            .select({ id: tReleaseDayOfColumn.id, day: tReleaseDayOfColumn.releasedOn })
            .union(
                ctx.conn.selectFrom(tReleaseDayOfColumn)
                    .where(tReleaseDayOfColumn.id.in([1, 2]))
                    .select({ id: tReleaseDayOfColumn.id, day: tReleaseDayOfColumn.releasedOn })
            )
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select o_1_.id as id, date_format(o_1_.\`day\`, '%d/%m/%Y') as \`day\` from (select id as id, released_on as \`day\` from project_release where id = ? union select id as id, released_on as \`day\` from project_release where id in (?, ?)) as o_1_"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, { id: number; day: ReleaseDay }[]>>()
        expect([...rows].sort((a, b) => a.id - b.id)).toEqual([
            { id: 1, day: dayOf(2024, 1, 15) },
            { id: 2, day: dayOf(2024, 2, 20) },
            { id: 3, day: dayOf(2024, 3, 1) },
        ])
    })

    test('transform-projection/a-column-equality-conversion-orders-by-the-value', async () => {
        ctx.mockNext([
            { id: 1, day: '15/01/2024' },
            { id: 2, day: '20/02/2024' },
            { id: 3, day: '01/03/2024' },
        ])
        const rows = await ctx.conn.selectFrom(tReleaseDayOfColumn)
            .select({ id: tReleaseDayOfColumn.id, day: tReleaseDayOfColumn.releasedOn })
            .orderBy('day')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, date_format(released_on, '%d/%m/%Y') as \`day\` from project_release order by project_release.released_on"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, { id: number; day: ReleaseDay }[]>>()
        expect(rows).toEqual([
            { id: 1, day: dayOf(2024, 1, 15) },
            { id: 2, day: dayOf(2024, 2, 20) },
            { id: 3, day: dayOf(2024, 3, 1) },
        ])
    })
})
