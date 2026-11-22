// A dnumDecimal column: a decimal number whose value is a dnum, the integer of its digits and the number of its
// decimals ([150n, 2] is 1.50), sent and read as its text so it keeps every digit and its decimals.
// The connection uses the default decimal strategy of SQLite, 'decimal-extension and tsq-functions with canonical text':
// every value is written and read in its canonical text (no zeros at the end of the fraction, so the decimals of a
// value are the ones it needs). Row 1 has an amount of 30 significant digits and the price 1.5, row 4 has neither.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Table } from '../../../../../src/Table.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import type { DynamicCondition, DynamicConditionForModel } from '../../../../../src/dynamic/condition.js'
import { withSqlDataType, type Dnum, type DnumDecimalType, type FilterOf, type OrderByForModel } from '../../../../../src/exports/v2/index.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'


const tExactAmount = new class TExactAmount extends Table<DBConnection, 'TExactAmount'> {
    id     = this.primaryKey('id', 'int')
    amount = this.optionalColumn('amount', 'dnumDecimal')
    price  = this.optionalColumn('price', 'dnumDecimal')
    constructor() { super('exact_amount') }
}()

// The same table, declaring the SQL data type of its columns with 2 decimals for amount and 3 for price
const tDeclaredExactAmount = new class TDeclaredExactAmount extends Table<DBConnection, 'TDeclaredExactAmount'> {
    id        = this.primaryKey('id', 'int')
    amount    = this.optionalColumn('amount', 'dnumDecimal', withSqlDataType({ family: 'exact numeric', precision: 38, scale: 2 }))
    price     = this.optionalColumn('price', 'dnumDecimal', withSqlDataType({ family: 'exact numeric', precision: 10, scale: 3 }))
    priceText = this.optionalColumn('price', 'stringDecimal', withSqlDataType({ family: 'exact numeric', precision: 10, scale: 3 }))
    constructor() { super('exact_amount') }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('dnum-decimal/reads-every-digit-and-the-decimals', async () => {
        ctx.mockNext([
            { id: 1, amount: '12345678901234567890.1234567891', price: '1.5' },
            { id: 2, amount: '-0.25', price: '-0.25' },
            { id: 3, amount: '0', price: '0' },
            { id: 4, amount: null, price: null },
            { id: 5, amount: '98765432109876543210.987654321', price: '1234.56' },
        ])
        const rows = sync(ctx.conn.selectFrom(tExactAmount)
            .select({
                id: tExactAmount.id,
                amount: tExactAmount.amount,
                price: tExactAmount.price,
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, amount as amount, price as price from exact_amount order by id"`)
        assertType<Exact<typeof rows, { id: number; amount?: Dnum; price?: Dnum }[]>>()
        expect(rows).toEqual([
            { id: 1, amount: [123456789012345678901234567891n, 10], price: [15n, 1] },
            { id: 2, amount: [-25n, 2], price: [-25n, 2] },
            { id: 3, amount: [0n, 0], price: [0n, 0] },
            { id: 4 },
            { id: 5, amount: [98765432109876543210987654321n, 9], price: [123456n, 2] },
        ])
    })

    test('dnum-decimal/compares-the-number-whatever-its-decimals', async () => {
        // [15n, 1] is 1.5, the price of row 1
        ctx.mockNext([1])
        ctx.mockNext([1])
        const ids = sync(ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.price.equals([15n, 1]))
            .selectOneColumn(tExactAmount.id)
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where price = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.5",
          ]
        `)
        expect(ids).toEqual([1])
        const exactIds = sync(ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.amount.equals([123456789012345678901234567891n, 10]))
            .selectOneColumn(tExactAmount.id)
            .executeSelectMany())
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "12345678901234567890.1234567891",
          ]
        `)
        expect(exactIds).toEqual([1])
    })

    test('dnum-decimal/an-in-list-and-a-between-compare-every-digit', async () => {
        // The amount of row 1 ends in 891: a value that ends in 890 is another value
        ctx.mockNext([])
        ctx.mockNext([2, 3])
        const inIds = sync(ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.amount.in([[123456789012345678901234567890n, 10], [1n, 0]]))
            .selectOneColumn(tExactAmount.id)
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where amount in (?1, ?2)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "12345678901234567890.123456789",
            "1",
          ]
        `)
        const betweenIds = sync(ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.price.between([-25n, 2], [0n, 0]))
            .selectOneColumn(tExactAmount.id)
            .orderBy('result')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where (decimal_cmp(price, ?1) >= 0 and decimal_cmp(price, ?2) <= 0) order by result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "-0.25",
            "0",
          ]
        `)
        expect(inIds).toEqual([])
        expect(betweenIds).toEqual([2, 3])
    })

    test('dnum-decimal/adds-multiplies-and-sums-exactly', async () => {
        ctx.mockNext({ next: '12345678901234567890.1234567892', double: '3' })
        ctx.mockNext({ total: '111111111011111111100.8611111101', prices: '1235.81' })
        const row = sync(ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.id.equals(1))
            .select({
                next: tExactAmount.amount.add([1n, 10]),
                double: tExactAmount.price.multiply([2n, 0]),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when amount is null then null else decimal_add(amount, ?1) end as tsq_v)) as next, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select decimal_mul(price, ?2) as tsq_v)) as double from exact_amount where id = ?3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0.0000000001",
            "2",
            1,
          ]
        `)
        assertType<Exact<typeof row, { next?: Dnum; double?: Dnum }>>()
        expect(row).toEqual({ next: [123456789012345678901234567892n, 10], double: [3n, 0] })
        const sums = sync(ctx.conn.selectFrom(tExactAmount)
            .select({
                total: ctx.conn.sum(tExactAmount.amount),
                prices: ctx.conn.sum(tExactAmount.price),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when count(amount) = 0 then null else decimal_sum(amount) end as tsq_v)) as total, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when count(price) = 0 then null else decimal_sum(price) end as tsq_v)) as prices from exact_amount"`)
        assertType<Exact<typeof sums, { total?: Dnum; prices?: Dnum }>>()
        expect(sums).toEqual({ total: [1111111110111111111008611111101n, 10], prices: [123581n, 2] })
    })

    test('dnum-decimal/an-array-aggregate-reads-the-dnums-from-the-json', async () => {
        ctx.mockNext([{ id: 1, amounts: '[12345678901234567890.1234567891]' }])
        const rows = sync(ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.id.equals(1))
            .select({
                id: tExactAmount.id,
                amounts: ctx.conn.aggregateAsArrayOfOneColumn(tExactAmount.amount),
            })
            .groupBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, json_group_array(amount) as amounts from exact_amount where id = ?1 group by id"`)
        assertType<Exact<typeof rows, { id: number; amounts: Dnum[] }[]>>()
        expect(rows).toEqual([{ id: 1, amounts: [[123456789012345678901234567891n, 10]] }])
    })

    test('dnum-decimal/an-insert-sends-the-text-and-reads-it-back', async () => {
        ctx.mockNext(1)
        ctx.mockNext({ amount: '-98765432109876543210.0000000001', price: '0.1' })
        await ctx.withRollback(async () => {
            const inserted = sync(ctx.conn.insertInto(tExactAmount)
                .set({ id: 6, amount: [-987654321098765432100000000001n, 10], price: [1n, 1] })
                .executeInsert())
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into exact_amount (id, amount, price) values (?1, ?2, ?3)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                6,
                "-98765432109876543210.0000000001",
                "0.1",
              ]
            `)
            expect(inserted).toBe(1)

            // The price was sent as 0.1 and is kept in its canonical text
            const row = sync(ctx.conn.selectFrom(tExactAmount)
                .where(tExactAmount.id.equals(6))
                .select({ amount: tExactAmount.amount, price: tExactAmount.price })
                .executeSelectOne())
            expect(row).toEqual({ amount: [-987654321098765432100000000001n, 10], price: [1n, 1] })
        })
    })

    test('dnum-decimal/the-decimals-of-the-sql-data-type-are-the-ones-of-the-value', async () => {
        // The SQL data type declared says 2 decimals for amount and 3 for price: the value has them, also as a
        // stringDecimal; the digits of the amount of row 1 beyond its 2 decimals aren't zeros, so they are kept
        ctx.mockNext([
            { id: 1, amount: '12345678901234567890.1234567891', price: '1.5', priceText: '1.5' },
            { id: 3, amount: '0', price: '0', priceText: '0' },
        ])
        const rows = sync(ctx.conn.selectFrom(tDeclaredExactAmount)
            .where(tDeclaredExactAmount.id.in([1, 3]))
            .select({
                id: tDeclaredExactAmount.id,
                amount: tDeclaredExactAmount.amount,
                price: tDeclaredExactAmount.price,
                priceText: tDeclaredExactAmount.priceText,
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, amount as amount, price as price, price as priceText from exact_amount where id in (?1, ?2) order by id"`)
        assertType<Exact<typeof rows, { id: number; amount?: Dnum; price?: Dnum; priceText?: string }[]>>()
        expect(rows).toEqual([
            { id: 1, amount: [123456789012345678901234567891n, 10], price: [1500n, 3], priceText: '1.500' },
            { id: 3, amount: [0n, 2], price: [0n, 3], priceText: '0.000' },
        ])
    })

    test('dnum-decimal/a-dynamic-condition-filters-with-a-dnum-filter', async () => {
        ctx.mockNext([1])
        ctx.mockNext([1])
        type Condition = DynamicCondition<{ price: 'dnumDecimal' }>
        assertType<Exact<NonNullable<Condition['price']>, FilterOf<DnumDecimalType>>>()
        // A dnum in a model is a value, filtered and ordered by
        type ModelCondition = DynamicConditionForModel<{ id: number, price: Dnum }>
        assertType<Exact<NonNullable<ModelCondition['price']>, FilterOf<DnumDecimalType>>>()
        assertType<Exact<'price desc' extends OrderByForModel<{ id: number, price: Dnum }> ? true : false, true>>()
        const filter: Condition = { price: { greaterOrEqual: [150n, 2], lessThan: [2n, 0] } }
        const dynamicIds = sync(ctx.conn.selectFrom(tExactAmount)
            .where(ctx.conn.dynamicConditionFor({ price: tExactAmount.price }).withValues(filter))
            .selectOneColumn(tExactAmount.id)
            .orderBy('result')
            .executeSelectMany())
        const dynamicSql = ctx.lastSql
        const dynamicParams = ctx.lastParams
        const ids = sync(ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.price.greaterOrEqual([150n, 2]).and(tExactAmount.price.lessThan([2n, 0])))
            .selectOneColumn(tExactAmount.id)
            .orderBy('result')
            .executeSelectMany())
        expect(dynamicSql).toBe(ctx.lastSql)
        expect(dynamicParams).toEqual(ctx.lastParams)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where decimal_cmp(price, ?1) >= 0 and decimal_cmp(price, ?2) < 0 order by result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.5",
            "2",
          ]
        `)
        expect(dynamicIds).toEqual([1])
        expect(ids).toEqual([1])
    })

    test('dnum-decimal/a-dnum-with-decimals-that-are-not-a-whole-number-is-rejected', async () => {
        let negative: unknown
        try {
            sync(ctx.conn.selectFrom(tExactAmount)
                .where(tExactAmount.price.equals([15n, -1]))
                .selectOneColumn(tExactAmount.id)
                .executeSelectMany())
        } catch (e) {
            negative = e
        }
        let fraction: unknown
        try {
            sync(ctx.conn.selectFrom(tExactAmount)
                .where(tExactAmount.price.equals([15n, 0.5]))
                .selectOneColumn(tExactAmount.id)
                .executeSelectMany())
        } catch (e) {
            fraction = e
        }
        expect(negative instanceof TsSqlError ? negative.errorReason : undefined).toEqual({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: [15n, -1], typeName: 'dnumDecimal', paramIndex: 0 })
        expect(fraction instanceof TsSqlError ? fraction.errorReason : undefined).toEqual({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: [15n, 0.5], typeName: 'dnumDecimal', paramIndex: 0 })
    })

    test('dnum-decimal/a-value-from-the-database-that-is-not-a-plain-decimal-is-rejected', async () => {
        // A text with an exponent, and a number the driver already rounded to a JavaScript number
        ctx.mockNext({ value: '1e3' })
        ctx.mockNext({ value: 1.5 })
        let withExponent: unknown
        try {
            sync(ctx.conn.selectFromNoTable()
                .select({ value: ctx.conn.fragmentWithType('dnumDecimal', 'required').sql`'1e3'` })
                .executeSelectOne())
        } catch (e) {
            withExponent = e
        }
        let aNumber: unknown
        try {
            sync(ctx.conn.selectFromNoTable()
                .select({ value: ctx.conn.fragmentWithType('dnumDecimal', 'required').sql`1.5e0` })
                .executeSelectOne())
        } catch (e) {
            aNumber = e
        }
        expect(withExponent instanceof TsSqlError ? withExponent.errorReason : undefined).toEqual({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value: '1e3', typeName: 'dnumDecimal', columnPath: 'value' })
        expect(aNumber instanceof TsSqlError ? aNumber.errorReason : undefined).toEqual({ reason: 'PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE', value: 1.5, typeName: 'dnumDecimal', columnPath: 'value' })
    })
})
