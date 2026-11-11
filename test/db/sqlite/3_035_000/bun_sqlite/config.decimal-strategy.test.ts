// The decimal strategies of SqliteConnection, each with the same data: exact_amount.price holds 1.5, -0.25, 0, no
// price and 1234.56 in rows 1 to 5, and exact_amount.amount two values of 30 digits in rows 1 and 5; the tests add
// 1.50, 9, 10.0, -0.00 and -1 as rows 6 to 10 (written as they are, or in their canonical text by the canonical text
// variants).
//
//   - 'text' and 'canonical text': plain SQL, without functions; an arithmetic result would be a floating point number,
//     so the library rejects it.
//   - 'decimal-extension and tsq-functions' and its canonical text variant: the functions of SQLite's decimal extension
//     for the arithmetic and the comparisons of order, plain SQL for the order by, min and max, and the functions of the
//     library for the roundings and the modulo.
//   - 'decimal-functions' and its canonical text variant: the functions of the decimal extension and the ones of the
//     library for the order by, the grouping, min and max.
// The functions are registered for this connector in test/db/sqlite/runners.ts. In the canonical text variants the
// library writes every value in its canonical text, and the equalities, the groupings and the duplicates compare the
// text; in the others a group of numbers equal with different scales gives one of their texts.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Table } from '../../../../../src/Table.js'
import { TsSqlError, type TsSqlErrorReason } from '../../../../../src/TsSqlError.js'
import type { SqliteDecimalStrategy } from '../../../../../src/connections/SqliteConfiguration.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

type Amount = string & { readonly __brand: 'Amount' }

const tExactAmount = new class TExactAmount extends Table<DBConnection, 'TExactAmount'> {
    id     = this.primaryKey('id', 'int')
    amount = this.optionalColumn<Amount, 'Amount'>('amount', 'customDecimal', 'Amount')
    price  = this.optionalColumn<Amount, 'Amount'>('price', 'customDecimal', 'Amount')
    constructor() { super('exact_amount') }
}()

const allStrategies: SqliteDecimalStrategy[] = [
    'text', 'canonical text',
    'decimal-extension and tsq-functions', 'decimal-extension and tsq-functions with canonical text',
    'decimal-functions', 'decimal-functions with canonical text',
]
const strategiesWithFunctions: SqliteDecimalStrategy[] = allStrategies.filter(strategy => strategy !== 'text' && strategy !== 'canonical text')
const canonicalStrategies: SqliteDecimalStrategy[] = allStrategies.filter(strategy => strategy === 'canonical text' || strategy.endsWith(' with canonical text'))
const notCanonicalStrategies: SqliteDecimalStrategy[] = allStrategies.filter(strategy => !canonicalStrategies.includes(strategy))

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
            { id: 6, price: '1.50' as Amount },
            { id: 7, price: '9' as Amount },
            { id: 8, price: '10.0' as Amount },
            { id: 9, price: '-0.00' as Amount },
            { id: 10, price: '-1' as Amount },
        ]).executeInsert()
    }

    for (const strategy of allStrategies) {
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
            ctx.mockNext([{ price: null, rows: 1 }, { price: '-1', rows: 1 }, { price: '-0.25', rows: 1 }, { price: '0', rows: 2 }, { price: '1.5', rows: 2 }, { price: '9', rows: 1 }, { price: '10', rows: 1 }, { price: '1234.56', rows: 1 }])
            ctx.mockNext([null, '-1', '-0.25', '0', '1.5', '9', '10', '1234.56'])
            ctx.mockNext({ smallest: '-1', largest: '1234.56', distinctPrices: 7 })
            ctx.mockNext(['0', '1.5'])
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

    for (const strategy of canonicalStrategies) {
        test('decimal-strategy: ' + strategy + ' writes the canonical text and compares it', async () => {
            const conn = ctx.withDecimalStrategy(strategy)
            ctx.mockNext(5)
            ctx.mockNext([{ price: '1.5' }, { price: '9' }, { price: '10' }, { price: '0' }, { price: '-1' }])
            ctx.mockNext([1, 6])
            ctx.mockNext([{ price: '1.5', rows: 2 }])
            await ctx.withRollback(async () => {
                await addRows(conn)
                const written = await conn.selectFrom(tExactAmount).where(tExactAmount.id.greaterOrEqual(6)).select({ price: tExactAmount.price }).orderBy(tExactAmount.id).executeSelectMany()
                const equal = await conn.selectFrom(tExactAmount).where(tExactAmount.price.equals('01.500' as Amount)).selectOneColumn(tExactAmount.id).orderBy(tExactAmount.id).executeSelectMany()
                expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where price = ?1 order by exact_amount.id"`)
                expect(ctx.lastParams).toEqual(['1.5'])
                // A distinct select of groups: the canonical texts of the rows are compared
                const groups = await conn.selectDistinctFrom(tExactAmount).where(tExactAmount.price.equals('1.5' as Amount)).select({ price: tExactAmount.price, rows: conn.countAll() }).groupBy('price').executeSelectMany()
                expect(ctx.lastSql).toMatchInlineSnapshot(`"select distinct price as price, count(*) as rows from exact_amount where price = ?1 group by price"`)
                expect(written).toEqual([{ price: '1.5' }, { price: '9' }, { price: '10' }, { price: '0' }, { price: '-1' }])
                expect(equal).toEqual([1, 6])
                expect(groups).toEqual([{ price: '1.5', rows: 2 }])
            })
        })
    }

    for (const strategy of canonicalStrategies.filter(strategy => strategiesWithFunctions.includes(strategy))) {
        test('decimal-strategy: ' + strategy + ' stores and reads a computed value in its canonical text', async () => {
            const conn = ctx.withDecimalStrategy(strategy)
            ctx.mockNext(1)
            ctx.mockNext({ price: '2', doubled: '4', grouped: 1 })
            await ctx.withRollback(async () => {
                // 1.5 + 0.50 is 2.00 for the decimal extension
                await conn.update(tExactAmount).set({ price: tExactAmount.price.add('0.50' as Amount) }).where(tExactAmount.id.equals(1)).executeUpdate()
                const row = await conn.selectFrom(tExactAmount)
                    .where(tExactAmount.id.equals(1))
                    .select({
                        price: tExactAmount.price,
                        doubled: tExactAmount.price.multiply('2.0' as Amount),
                        grouped: conn.subSelectUsing(tExactAmount).from(tExactAmount).where(tExactAmount.price.equals('2' as Amount)).selectOneColumn(conn.countAll()).forUseAsInlineQueryValue(),
                    })
                    .executeSelectOne()
                expect(row).toEqual({ price: '2', doubled: '4', grouped: 1 })
            })
        })
    }

    for (const strategy of notCanonicalStrategies) {
        test('decimal-strategy: ' + strategy + ' rejects a distinct select of groups with a customDecimal', async () => {
            const conn = ctx.withDecimalStrategy(strategy)
            let reason: TsSqlErrorReason | string = 'sent'
            try {
                await conn.selectDistinctFrom(tExactAmount).select({ price: tExactAmount.price, rows: conn.countAll() }).groupBy('price').executeSelectMany()
            } catch (e) {
                reason = e instanceof TsSqlError ? e.errorReason : String(e)
            }
            expect(reason).toEqual({ reason: 'UNSUPPORTED_QUERY' })
        })
    }

    for (const strategy of ['text', 'canonical text'] as const) {
        test('decimal-strategy: ' + strategy + ' rejects the arithmetic of a customDecimal before sending the query', async () => {
            const conn = ctx.withDecimalStrategy(strategy)
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
    }

    test('decimal-strategy: decimal-extension and tsq-functions computes with the extension and rounds with the library', async () => {
        const conn = ctx.withDecimalStrategy('decimal-extension and tsq-functions')
        ctx.mockNext({ next: '12345678901234567890.1234567892', total: '1235.81', rounded: '1.5', rest: '0.3' })
        ctx.mockNext([1])
        const row = await conn.selectFrom(tExactAmount)
            .where(tExactAmount.id.equals(1))
            .select({
                next: tExactAmount.amount.add('0.0000000001' as Amount),
                total: conn.subSelectUsing(tExactAmount).from(tExactAmount).selectOneColumn(conn.sum(tExactAmount.price)).forUseAsInlineQueryValue(),
                rounded: tExactAmount.price.roundn(1),
                rest: tExactAmount.price.modulo('0.4' as Amount),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when amount is null then null else decimal_add(amount, ?1) end as next, (select case when count(price) = 0 then null else decimal_sum(price) end as result from exact_amount) as total, tsq_decimal_round(price, ?2) as rounded, tsq_decimal_mod(price, ?3) as rest from exact_amount where id = ?4"`)
        const ids = await conn.selectFrom(tExactAmount)
            .where(tExactAmount.price.equals('1.5' as Amount))
            .selectOneColumn(tExactAmount.id)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where decimal_cmp(price, ?1) = 0"`)
        expect(row).toEqual({ next: '12345678901234567890.1234567892', total: '1235.81', rounded: '1.5', rest: '0.3' })
        expect(ids).toEqual([1])
    })

    for (const strategy of strategiesWithFunctions) {
        test('decimal-strategy: ' + strategy + ' counts, sums and lists every number once in the distinct aggregates', async () => {
            const conn = ctx.withDecimalStrategy(strategy)
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
    }

    test('decimal-strategy: the normalization statement turns the stored values into their canonical text', async () => {
        // A strategy that writes the values as they are, so the rows have the texts an application may have stored
        const conn = ctx.withDecimalStrategy('text')
        ctx.mockNext(6)
        ctx.mockNext(10)
        ctx.mockNext([{ price: '7.5' }, { price: '0' }, { price: '0.5' }, { price: '1.5' }, { price: '100' }, { price: '0' }])
        await ctx.withRollback(async () => {
            await conn.insertInto(tExactAmount).values([
                { id: 11, price: '007.50' as Amount },
                { id: 12, price: '-0.00' as Amount },
                { id: 13, price: '.5' as Amount },
                { id: 14, price: '1.500' as Amount },
                { id: 15, price: '100' as Amount },
                { id: 16, price: '0.0' as Amount },
            ]).executeInsert()
            const normalized = await conn.queryRunner.executeUpdate(`
                update exact_amount set price = (
                    select case when i = '' and f = '' then '0'
                                else s || (case when i = '' then '0' else i end) || (case when f <> '' then '.' || f else '' end) end
                    from (select case when substr(price, 1, 1) = '-' then '-' else '' end as s,
                                 ltrim(substr(ltrim(price, '-'), 1, instr(ltrim(price, '-') || '.', '.') - 1), '0') as i,
                                 rtrim(substr(ltrim(price, '-'), instr(ltrim(price, '-') || '.', '.') + 1), '0') as f)
                ) where price is not null`)
            const rows = await conn.selectFrom(tExactAmount).where(tExactAmount.id.greaterOrEqual(11)).select({ price: tExactAmount.price }).orderBy(tExactAmount.id).executeSelectMany()
            expect(normalized).toBe(10)
            expect(rows).toEqual([{ price: '7.5' }, { price: '0' }, { price: '0.5' }, { price: '1.5' }, { price: '100' }, { price: '0' }])
        })
    })

    test('decimal-strategy: decimal-functions compares by the key of each value, which an index on the key serves', async () => {
        const conn = ctx.withDecimalStrategy('decimal-functions')
        ctx.mockNext(5)
        ctx.mockNext([6, 8])
        ctx.mockNext([7, 8])
        ctx.mockNext([6])
        ctx.mockNext([6, 7, 8])
        await ctx.withRollback(async () => {
            await addRows(conn)
            const inList = await conn.selectFrom(tExactAmount).where(tExactAmount.id.greaterOrEqual(6)).and(tExactAmount.price.in(['1.5' as Amount, '10' as Amount])).selectOneColumn(tExactAmount.id).orderBy(tExactAmount.id).executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where id >= ?1 and tsq_decimal_key(price) in (tsq_decimal_key(?2), tsq_decimal_key(?3)) order by exact_amount.id"`)
            const between = await conn.selectFrom(tExactAmount).where(tExactAmount.id.greaterOrEqual(6)).and(tExactAmount.price.between('2' as Amount, '10.00' as Amount)).selectOneColumn(tExactAmount.id).orderBy(tExactAmount.id).executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where id >= ?1 and tsq_decimal_key(price) between tsq_decimal_key(?2) and tsq_decimal_key(?3) order by exact_amount.id"`)
            const equal = await conn.selectFrom(tExactAmount).where(tExactAmount.id.greaterOrEqual(6)).and(tExactAmount.price.equals('1.5' as Amount)).selectOneColumn(tExactAmount.id).orderBy(tExactAmount.id).executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where id >= ?1 and tsq_decimal_key(price) = tsq_decimal_key(?2) order by exact_amount.id"`)
            const greater = await conn.selectFrom(tExactAmount).where(tExactAmount.id.greaterOrEqual(6)).and(tExactAmount.price.greaterThan('0' as Amount)).selectOneColumn(tExactAmount.id).orderBy(tExactAmount.id).executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where id >= ?1 and tsq_decimal_key(price) > tsq_decimal_key(?2) order by exact_amount.id"`)
            expect(inList).toEqual([6, 8])
            expect(between).toEqual([7, 8])
            expect(equal).toEqual([6])
            expect(greater).toEqual([6, 7, 8])
        })
    })
})
