// The decimal strategies of SqliteConnection other than the default 'decimal-functions' (covered by
// select.custom-decimal), and what every strategy does with the distinct values. exact_amount.price holds 1.50, -0.25,
// 0.00, no price and 1234.56 in rows 1 to 5, as text, and exact_amount.amount two values of 30 digits in rows 1 and 5;
// the tests add 1.5, 9, 10, -0.00 and -1 as rows 6 to 10.
//
//   - 'text': plain SQL. Equality compares the numbers by their normal form (1.5 and 1.50 are the same), a range,
//     min, max and an order by compare the numbers in SQL, and an arithmetic result would be a floating point number,
//     so the library rejects it.
//   - 'decimal-extension': only the functions of SQLite's decimal extension (registered for this connector in
//     test/db/sqlite/runners.ts): arithmetic, sum and every comparison with them; order by, min, max, group by and
//     distinct compare the numbers in SQL.
// In every strategy a group of numbers equal with different scales gives one of their texts.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Table } from '../../../../../src/Table.js'
import { TsSqlError, type TsSqlErrorReason } from '../../../../../src/TsSqlError.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

type Amount = string & { readonly __brand: 'Amount' }

const tExactAmount = new class TExactAmount extends Table<DBConnection, 'TExactAmount'> {
    id     = this.primaryKey('id', 'int')
    amount = this.optionalColumn<Amount, 'Amount'>('amount', 'customDecimal', 'Amount')
    price  = this.optionalColumn<Amount, 'Amount'>('price', 'customDecimal', 'Amount')
    constructor() { super('exact_amount') }
}()

// The number of a text, to compare a value whose scale is the one of any row of its group
function asNumber(value: string | null | undefined): number | null {
    return value === null || value === undefined ? null : Number(value)
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    async function addRows(conn: DBConnection) {
        await conn.insertInto(tExactAmount).values([
            { id: 6, price: '1.5' as Amount },
            { id: 7, price: '9' as Amount },
            { id: 8, price: '10' as Amount },
            { id: 9, price: '-0.00' as Amount },
            { id: 10, price: '-1' as Amount },
        ]).executeInsert()
    }

    for (const strategy of ['text', 'decimal-extension'] as const) {
        test('decimal-strategy: ' + strategy + ' compares the numbers', async () => {
            const conn = ctx.withDecimalStrategy(strategy)
            ctx.mockNext(5)
            ctx.mockNext([1, 6])
            ctx.mockNext([3, 8, 9])
            ctx.mockNext([5, 8])
            ctx.mockNext([1, 2, 3, 6, 9, 10])
            ctx.mockNext([1, 6])
            ctx.mockNext([1, 2, 3])
            ctx.mockNext([1, 5])
            ctx.mockNext([1, 6])
            ctx.mockNext([2, 3, 5, 7, 8, 9, 10])
            await ctx.withRollback(async () => {
                await addRows(conn)
                const equal = await conn.selectFrom(tExactAmount).where(tExactAmount.price.equals('1.5' as Amount)).selectOneColumn(tExactAmount.id).orderBy(tExactAmount.id).executeSelectMany()
                const inList = await conn.selectFrom(tExactAmount).where(tExactAmount.price.in(['10.0' as Amount, '-0' as Amount])).selectOneColumn(tExactAmount.id).orderBy(tExactAmount.id).executeSelectMany()
                const greater = await conn.selectFrom(tExactAmount).where(tExactAmount.price.greaterThan('9.5' as Amount)).selectOneColumn(tExactAmount.id).orderBy(tExactAmount.id).executeSelectMany()
                const between = await conn.selectFrom(tExactAmount).where(tExactAmount.price.between('-1' as Amount, '1.5' as Amount)).selectOneColumn(tExactAmount.id).orderBy(tExactAmount.id).executeSelectMany()
                const is = await conn.selectFrom(tExactAmount).where(tExactAmount.price.is('1.50' as Amount)).selectOneColumn(tExactAmount.id).orderBy(tExactAmount.id).executeSelectMany()
                // 30 digits: they differ beyond the 15 that a floating point number keeps
                const lessWide = await conn.selectFrom(tExactAmount).where(tExactAmount.amount.lessThan('12345678901234567890.1234567892' as Amount)).selectOneColumn(tExactAmount.id).orderBy(tExactAmount.id).executeSelectMany()
                const greaterWide = await conn.selectFrom(tExactAmount).where(tExactAmount.amount.greaterThan('12345678901234567890.1234567890' as Amount)).selectOneColumn(tExactAmount.id).orderBy(tExactAmount.id).executeSelectMany()
                const inQuery = await conn.selectFrom(tExactAmount)
                    .where(tExactAmount.price.in(conn.subSelectUsing(tExactAmount).from(tExactAmount).where(tExactAmount.id.equals(6)).selectOneColumn(tExactAmount.price)))
                    .selectOneColumn(tExactAmount.id).orderBy(tExactAmount.id).executeSelectMany()
                const notInQuery = await conn.selectFrom(tExactAmount)
                    .where(tExactAmount.price.notIn(conn.subSelectUsing(tExactAmount).from(tExactAmount).where(tExactAmount.id.equals(6)).selectOneColumn(tExactAmount.price)))
                    .selectOneColumn(tExactAmount.id).orderBy(tExactAmount.id).executeSelectMany()
                assertType<Exact<typeof equal, number[]>>()
                expect(equal).toEqual([1, 6])
                expect(inList).toEqual([3, 8, 9])
                expect(greater).toEqual([5, 8])
                expect(between).toEqual([1, 2, 3, 6, 9, 10])
                expect(is).toEqual([1, 6])
                expect(lessWide).toEqual([1, 2, 3])
                expect(greaterWide).toEqual([1, 5])
                expect(inQuery).toEqual([1, 6])
                expect(notInQuery).toEqual([2, 3, 5, 7, 8, 9, 10])
            })
        })

        test('decimal-strategy: ' + strategy + ' orders, groups and removes duplicates as numbers', async () => {
            const conn = ctx.withDecimalStrategy(strategy)
            ctx.mockNext(5)
            ctx.mockNext([4, 10, 2, 3, 9, 1, 6, 7, 8, 5])
            ctx.mockNext([5, 8, 7, 1, 6, 3, 9, 2, 10, 4])
            ctx.mockNext([{ price: null, rows: 1 }, { price: '-1', rows: 1 }, { price: '-0.25', rows: 1 }, { price: '0.00', rows: 2 }, { price: '1.50', rows: 2 }, { price: '9', rows: 1 }, { price: '10', rows: 1 }, { price: '1234.56', rows: 1 }])
            ctx.mockNext([null, '-1', '-0.25', '0.00', '1.50', '9', '10', '1234.56'])
            ctx.mockNext({ smallest: '-1', largest: '1234.56', distinctPrices: 7 })
            ctx.mockNext(['0.00', '1.50'])
            await ctx.withRollback(async () => {
                await addRows(conn)
                const ascending = await conn.selectFrom(tExactAmount).selectOneColumn(tExactAmount.id).orderBy(tExactAmount.price).orderBy(tExactAmount.id).executeSelectMany()
                const descending = await conn.selectFrom(tExactAmount).selectOneColumn(tExactAmount.id).orderBy(tExactAmount.price, 'desc').orderBy(tExactAmount.id).executeSelectMany()
                const groups = await conn.selectFrom(tExactAmount)
                    .select({ price: tExactAmount.price, rows: conn.countAll() })
                    .groupBy('price')
                    .orderBy('price')
                    .executeSelectMany()
                const distinct = await conn.selectDistinctFrom(tExactAmount).selectOneColumn(tExactAmount.price).orderBy('result').executeSelectMany()
                const extremes = await conn.selectFrom(tExactAmount)
                    .select({ smallest: conn.min(tExactAmount.price), largest: conn.max(tExactAmount.price), distinctPrices: conn.countDistinct(tExactAmount.price) })
                    .executeSelectOne()
                const union = await conn.selectFrom(tExactAmount).where(tExactAmount.id.in([1, 3])).selectOneColumn(tExactAmount.price)
                    .union(conn.selectFrom(tExactAmount).where(tExactAmount.id.in([6, 9])).selectOneColumn(tExactAmount.price))
                    .orderBy('result')
                    .executeSelectMany()
                expect(ascending).toEqual([4, 10, 2, 3, 9, 1, 6, 7, 8, 5])
                expect(descending).toEqual([5, 8, 7, 1, 6, 3, 9, 2, 10, 4])
                expect(groups.map(group => ({ price: asNumber(group.price), rows: group.rows }))).toEqual([
                    { price: null, rows: 1 }, { price: -1, rows: 1 }, { price: -0.25, rows: 1 }, { price: 0, rows: 2 }, { price: 1.5, rows: 2 }, { price: 9, rows: 1 }, { price: 10, rows: 1 }, { price: 1234.56, rows: 1 },
                ])
                expect(distinct.map(asNumber)).toEqual([null, -1, -0.25, 0, 1.5, 9, 10, 1234.56])
                expect(extremes).toEqual({ smallest: '-1', largest: '1234.56', distinctPrices: 7 })
                expect(union.map(asNumber)).toEqual([0, 1.5])
            })
        })
    }

    test('decimal-strategy: text rejects the arithmetic of a customDecimal before sending the query', async () => {
        const conn = ctx.withDecimalStrategy('text')
        const reasons: (TsSqlErrorReason | string | number)[] = []
        for (const query of [
            () => conn.selectFrom(tExactAmount).where(tExactAmount.id.equals(1)).select({ next: tExactAmount.amount.add('0.0000000001' as Amount) }).executeSelectOne(),
            () => conn.selectFrom(tExactAmount).selectOneColumn(conn.sum(tExactAmount.price)).executeSelectOne(),
            () => conn.selectFrom(tExactAmount).selectOneColumn(tExactAmount.price.roundn(1)).executeSelectMany(),
            () => conn.update(tExactAmount).set({ price: tExactAmount.price.multiply('2' as Amount) }).where(tExactAmount.id.equals(1)).executeUpdate(),
        ]) {
            const sent = ctx.history.length
            try {
                await query()
                reasons.push('sent')
            } catch (e) {
                reasons.push(e instanceof TsSqlError ? e.errorReason : String(e))
            }
            // Nothing was sent to the database
            reasons.push(ctx.history.length - sent)
        }
        expect(reasons).toEqual([{ reason: 'UNSUPPORTED_QUERY' }, 0, { reason: 'UNSUPPORTED_QUERY' }, 0, { reason: 'UNSUPPORTED_QUERY' }, 0, { reason: 'UNSUPPORTED_QUERY' }, 0])
        // A column alone is read as it is, and its absolute value is its text without the minus sign
        ctx.mockNext({ price: '0.25', positive: '0.25' })
        const row = await conn.selectFrom(tExactAmount).where(tExactAmount.id.equals(2)).select({ price: tExactAmount.price.abs().abs(), positive: tExactAmount.price.abs() }).executeSelectOne()
        expect(row).toEqual({ price: '0.25', positive: '0.25' })
    })

    test('decimal-strategy: decimal-extension computes and compares with the extension functions', async () => {
        const conn = ctx.withDecimalStrategy('decimal-extension')
        ctx.mockNext({ next: '12345678901234567890.1234567892', total: '1235.81' })
        ctx.mockNext([1])
        const row = await conn.selectFrom(tExactAmount)
            .where(tExactAmount.id.equals(1))
            .select({
                next: tExactAmount.amount.add('0.0000000001' as Amount),
                total: conn.subSelectUsing(tExactAmount).from(tExactAmount).selectOneColumn(conn.sum(tExactAmount.price)).forUseAsInlineQueryValue(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when amount is null then null else decimal_add(amount, ?1) end as next, (select case when count(price) = 0 then null else decimal_sum(price) end as result from exact_amount) as total from exact_amount where id = ?2"`)
        const ids = await conn.selectFrom(tExactAmount)
            .where(tExactAmount.price.equals('1.5' as Amount))
            .selectOneColumn(tExactAmount.id)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where decimal_cmp(price, ?1) = 0"`)
        expect(row).toEqual({ next: '12345678901234567890.1234567892', total: '1235.81' })
        expect(ids).toEqual([1])
    })

    test('decimal-strategy: every strategy rejects a distinct select of groups with a customDecimal', async () => {
        const reasons: (TsSqlErrorReason | string)[] = []
        for (const strategy of ['text', 'decimal-extension', 'decimal-functions'] as const) {
            const conn = ctx.withDecimalStrategy(strategy)
            try {
                await conn.selectDistinctFrom(tExactAmount).select({ price: tExactAmount.price, rows: conn.countAll() }).groupBy('price').executeSelectMany()
                reasons.push('sent')
            } catch (e) {
                reasons.push(e instanceof TsSqlError ? e.errorReason : String(e))
            }
        }
        expect(reasons).toEqual([{ reason: 'UNSUPPORTED_QUERY' }, { reason: 'UNSUPPORTED_QUERY' }, { reason: 'UNSUPPORTED_QUERY' }])
    })

    test('decimal-strategy: the distinct aggregates count every number once', async () => {
        const conn = ctx.withDecimalStrategy('decimal-functions')
        ctx.mockNext(5)
        ctx.mockNext({ distinctPrices: 7, prices: '1253.81', mean: 179.115714285714, list: '["-1","-0.25","0","1.5","9","10","1234.56"]' })
        await ctx.withRollback(async () => {
            await addRows(conn)
            const row = await conn.selectFrom(tExactAmount)
                .select({
                    distinctPrices: conn.countDistinct(tExactAmount.price),
                    prices: conn.sumDistinct(tExactAmount.price),
                    mean: conn.averageDistinct(tExactAmount.price),
                    list: conn.aggregateAsArrayOfOneColumnDistinct(tExactAmount.price),
                })
                .executeSelectOne()
            expect({
                distinctPrices: row.distinctPrices,
                prices: asNumber(row.prices),
                mean: row.mean === undefined ? undefined : Math.round(row.mean * 1e6) / 1e6,
                list: row.list.map(asNumber).sort((a, b) => (a ?? 0) - (b ?? 0)),
            }).toEqual({ distinctPrices: 7, prices: 1253.81, mean: 179.115714, list: [-1, -0.25, 0, 1.5, 9, 10, 1234.56] })
        })
    })
})
