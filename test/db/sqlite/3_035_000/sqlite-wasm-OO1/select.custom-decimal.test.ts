// A customDecimal column: a decimal number of a type of its own, sent and read as its text so it keeps every digit.
// exact_amount.amount has 10 decimals and room for 38 digits, exact_amount.price 2 decimals; row 1 has an amount of
// 30 significant digits and the price 1.50, row 4 has neither.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { getQueryParamType, getQueryParamTypeCategory } from '../../../../../src/queryRunners/QueryRunner.js'
import { Table } from '../../../../../src/Table.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import type { CustomDecimalFilter, DynamicCondition } from '../../../../../src/dynamic/condition.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

type Amount = string & { readonly __brand: 'Amount' }

const tExactAmount = new class TExactAmount extends Table<DBConnection, 'TExactAmount'> {
    id     = this.primaryKey('id', 'int')
    amount = this.optionalColumn<Amount, 'Amount'>('amount', 'customDecimal', 'Amount')
    price  = this.optionalColumn<Amount, 'Amount'>('price', 'customDecimal', 'Amount')
    constructor() { super('exact_amount') }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('custom-decimal/reads-every-digit-and-the-scale', async () => {
        ctx.mockNext([
            { id: 1, amount: '12345678901234567890.1234567891', price: '1.50' },
            { id: 2, amount: '-0.2500000000', price: '-0.25' },
            { id: 3, amount: '0.0000000000', price: '0.00' },
            { id: 4, amount: null, price: null },
            { id: 5, amount: '98765432109876543210.9876543210', price: '1234.56' },
        ])
        const rows = await ctx.conn.selectFrom(tExactAmount)
            .select({
                id: tExactAmount.id,
                amount: tExactAmount.amount,
                price: tExactAmount.price,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, amount as amount, price as price from exact_amount order by id"`)
        assertType<Exact<typeof rows, { id: number; amount?: Amount; price?: Amount }[]>>()
        expect(rows).toEqual([
            { id: 1, amount: '12345678901234567890.1234567891', price: '1.50' },
            { id: 2, amount: '-0.2500000000', price: '-0.25' },
            { id: 3, amount: '0.0000000000', price: '0.00' },
            { id: 4 },
            { id: 5, amount: '98765432109876543210.9876543210', price: '1234.56' },
        ])
    })

    test('custom-decimal/compares-and-orders-as-a-number', async () => {
        ctx.mockNext([3, 1, 5])
        const ids = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.amount.notEquals('12345678901234567890.1234567890' as Amount))
            .and(tExactAmount.price.greaterThan('-1' as Amount))
            .and(tExactAmount.price.notEquals('0' as Amount))
            .selectOneColumn(tExactAmount.id)
            .orderBy(tExactAmount.price)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where amount <> ?1 and price > ?2 and price <> ?3 order by exact_amount.price"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "12345678901234567890.1234567890",
            "-1",
            "0",
          ]
        `)
        const params = ctx.lastParams
        expect(params.map((_value, index) => [getQueryParamType(ctx.lastSql, params, index), getQueryParamTypeCategory(ctx.lastSql, params, index)])).toEqual([
            ['Amount', 'customDecimal'],
            ['Amount', 'customDecimal'],
            ['Amount', 'customDecimal'],
        ])
        assertType<Exact<typeof ids, number[]>>()
        // TODO[DECIMAL]: not exact. SQLite has no exact decimal type: a TEXT column keeps the text, and the database compares and orders it as text, and computes with it in double precision: '-0.25' > '-1' is false, '0.00' <> '0' is true and 1234.56 sorts
        // after 1.50 as text
        expect(ids).toEqual([3, 1, 5])
    })

    test('custom-decimal/equals-an-exact-value', async () => {
        ctx.mockNext([1])
        const ids = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.amount.equals('12345678901234567890.1234567891' as Amount))
            .selectOneColumn(tExactAmount.id)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where amount = ?1"`)
        expect(ids).toEqual([1])
    })

    test('custom-decimal/adds-and-multiplies-exactly', async () => {
        ctx.mockNext({ next: 12345678901234567000, double: 3, negated: -1.5 })
        const row = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.id.equals(1))
            .select({
                next: tExactAmount.amount.add('0.0000000001' as Amount),
                double: tExactAmount.price.multiply('2' as Amount),
                negated: tExactAmount.price.subtract(tExactAmount.price).subtract(tExactAmount.price),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select amount + ?1 as next, price * ?2 as double, price - price - price as negated from exact_amount where id = ?3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0.0000000001",
            "2",
            1,
          ]
        `)
        assertType<Exact<typeof row, { next?: Amount; double?: Amount; negated?: Amount }>>()
        // TODO[DECIMAL]: not exact. SQLite has no exact decimal type: a TEXT column keeps the text, and the database compares and orders it as text, and computes with it in double precision
        expect(row).toEqual({ next: '12345678901234567000', double: '3', negated: '-1.5' })
    })

    test('custom-decimal/sums-exactly', async () => {
        ctx.mockNext({ total: 111111111011111110000, prices: 1235.81 })
        const row = await ctx.conn.selectFrom(tExactAmount)
            .select({
                total: ctx.conn.sum(tExactAmount.amount),
                prices: ctx.conn.sum(tExactAmount.price),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(amount) as total, sum(price) as prices from exact_amount"`)
        assertType<Exact<typeof row, { total?: Amount; prices?: Amount }>>()
        // TODO[DECIMAL]: not exact. SQLite has no exact decimal type: a TEXT column keeps the text, and the database compares and orders it as text, and computes with it in double precision
        expect(row).toEqual({ total: '111111111011111110000', prices: '1235.81' })
    })

    test('custom-decimal/a-root-a-power-and-a-division-are-a-double', async () => {
        ctx.mockNext({ squared: 2.25, half: 0.75, root: 1.224744871391589 })
        const row = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.id.equals(1))
            .select({
                squared: tExactAmount.price.power(2),
                half: tExactAmount.price.divide('2' as Amount),
                root: tExactAmount.price.sqrt(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select power(price, ?1) as squared, cast(price as real) / ?2 as half, sqrt(price) as root from exact_amount where id = ?3"`)
        assertType<Exact<typeof row, { squared?: number; half?: number; root?: number }>>()
        if (ctx.realDbEnabled) {
            expect(row.squared).toBeCloseTo(2.25, 12)
            expect(row.half).toBeCloseTo(0.75, 12)
            expect(row.root).toBeCloseTo(1.224744871391589, 12)
        } else {
            expect(row).toEqual({ squared: 2.25, half: 0.75, root: 1.224744871391589 })
        }
    })

    test('custom-decimal/an-array-aggregate-reads-the-text-from-the-json', async () => {
        ctx.mockNext([{ id: 1, amounts: '[12345678901234567890.1234567891]' }])
        const rows = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.id.equals(1))
            .select({
                id: tExactAmount.id,
                amounts: ctx.conn.aggregateAsArrayOfOneColumn(tExactAmount.amount),
            })
            .groupBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, json_group_array(amount) as amounts from exact_amount where id = ?1 group by id"`)
        assertType<Exact<typeof rows, { id: number; amounts: Amount[] }[]>>()
        expect(rows).toEqual([{ id: 1, amounts: ['12345678901234567890.1234567891'] }])
    })

    test('custom-decimal/an-insert-sends-the-text-and-reads-it-back', async () => {
        ctx.mockNext(1)
        ctx.mockNext([6])
        ctx.mockNext({ amount: '-98765432109876543210.0000000001', price: '0.1' })
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tExactAmount)
                .set({ id: 6, amount: '-98765432109876543210.0000000001' as Amount, price: '0.1' as Amount })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into exact_amount (id, amount, price) values (?1, ?2, ?3)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                6,
                "-98765432109876543210.0000000001",
                "0.1",
              ]
            `)
            expect(inserted).toBe(1)

            // The value arrives with every digit: the row matches it exactly
            const matching = await ctx.conn.selectFrom(tExactAmount)
                .where(tExactAmount.amount.equals('-98765432109876543210.0000000001' as Amount))
                .selectOneColumn(tExactAmount.id)
                .executeSelectMany()
            expect(matching).toEqual([6])

            const row = await ctx.conn.selectFrom(tExactAmount)
                .where(tExactAmount.id.equals(6))
                .select({ amount: tExactAmount.amount, price: tExactAmount.price })
                .executeSelectOne()
            // A TEXT column keeps the text as it was sent
            expect(row).toEqual({ amount: '-98765432109876543210.0000000001', price: '0.1' })
        })
    })

    test('custom-decimal/a-dynamic-condition-filters-with-a-custom-decimal-filter', async () => {
        ctx.mockNext([1, 5])
        ctx.mockNext([1, 5])
        type Condition = DynamicCondition<{ price: ['customDecimal', Amount] }>
        assertType<Exact<NonNullable<Condition['price']>, CustomDecimalFilter<Amount>>>()
        const filter: Condition = { price: { greaterOrEqual: '1.50' as Amount, lessThan: '2' as Amount } }
        const dynamicIds = await ctx.conn.selectFrom(tExactAmount)
            .where(ctx.conn.dynamicConditionFor({ price: tExactAmount.price }).withValues(filter))
            .selectOneColumn(tExactAmount.id)
            .orderBy('result')
            .executeSelectMany()
        const dynamicSql = ctx.lastSql
        const dynamicParams = ctx.lastParams
        const ids = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.price.greaterOrEqual('1.50' as Amount).and(tExactAmount.price.lessThan('2' as Amount)))
            .selectOneColumn(tExactAmount.id)
            .orderBy('result')
            .executeSelectMany()
        expect(dynamicSql).toBe(ctx.lastSql)
        expect(dynamicParams).toEqual(ctx.lastParams)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where price >= ?1 and price < ?2 order by result"`)
        // TODO[DECIMAL]: not exact. SQLite has no exact decimal type: a TEXT column is compared as text, and '1234.56'
        // is between '1.50' and '2' as text
        expect(dynamicIds).toEqual([1, 5])
        expect(ids).toEqual([1, 5])
    })

    test('custom-decimal/a-text-that-is-not-a-plain-decimal-is-rejected', async () => {
        let error: unknown
        try {
            await ctx.conn.selectFrom(tExactAmount)
                .where(tExactAmount.price.equals('1,50' as Amount))
                .selectOneColumn(tExactAmount.id)
                .executeSelectMany()
        } catch (e) {
            error = e
        }
        expect(error instanceof TsSqlError ? error.errorReason : undefined).toEqual({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: '1,50', typeName: 'Amount', paramIndex: 0 })
    })
})
