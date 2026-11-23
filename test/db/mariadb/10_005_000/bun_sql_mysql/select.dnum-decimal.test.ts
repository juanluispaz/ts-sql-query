// A dnumDecimal column: a decimal number whose value is a dnum, the integer of its digits and the number of its
// decimals ([150n, 2] is 1.50), sent and read as its text so it keeps every digit and its decimals.
// exact_amount.amount has 10 decimals and room for 38 digits, exact_amount.price 2 decimals; row 1 has an amount of
// 30 significant digits and the price 1.50, row 4 has neither.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Table } from '../../../../../src/Table.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import type { DynamicCondition, DynamicConditionForModel } from '../../../../../src/dynamic/condition.js'
import { withSqlDataType, type Dnum, type DnumDecimalType, type FilterOf, type OrderByForModel } from '../../../../../src/exports/v2/index.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'
import * as dn from 'dnum'


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
        assertType<Exact<typeof rows, { id: number; amount?: Dnum; price?: Dnum }[]>>()
        expect(rows).toEqual([
            { id: 1, amount: [123456789012345678901234567891n, 10], price: [150n, 2] },
            { id: 2, amount: [-2500000000n, 10], price: [-25n, 2] },
            { id: 3, amount: [0n, 10], price: [0n, 2] },
            { id: 4 },
            { id: 5, amount: [987654321098765432109876543210n, 10], price: [123456n, 2] },
        ])
    })

    test('dnum-decimal/the-values-go-to-dnum-and-come-from-it', async () => {
        // The type Dnum is the one of dnum: a value of dnum goes to a query, and a value read goes to its functions
        assertType<Exact<Dnum, dn.Dnum>>()
        ctx.mockNext([1])
        ctx.mockNext({ amount: '12345678901234567890.1234567891', price: '1.50' })
        const ids = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.price.equals(dn.from('1.5')))
            .selectOneColumn(tExactAmount.id)
            .executeSelectMany()
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.5",
          ]
        `)
        expect(ids).toEqual([1])
        const row = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.id.equals(1))
            .select({ amount: tExactAmount.amount, price: tExactAmount.price })
            .executeSelectOne()
        assertType<Exact<typeof row, { amount?: Dnum; price?: Dnum }>>()
        const amount = row.amount ?? [0n, 0]
        const price = row.price ?? [0n, 0]
        expect(dn.equal(dn.multiply(price, 3), [45n, 1])).toBe(true)
        expect(dn.equal(dn.add(amount, [9n, 10]), [1234567890123456789012345679n, 8])).toBe(true)
    })

    test('dnum-decimal/compares-the-number-whatever-its-decimals', async () => {
        // [15n, 1] is 1.5, the price of row 1, kept as 1.50
        ctx.mockNext([1])
        ctx.mockNext([1])
        const ids = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.price.equals([15n, 1]))
            .selectOneColumn(tExactAmount.id)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where price = cast(? as decimal(2, 1))"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.5",
          ]
        `)
        expect(ids).toEqual([1])
        const exactIds = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.amount.equals([123456789012345678901234567891n, 10]))
            .selectOneColumn(tExactAmount.id)
            .executeSelectMany()
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
        const inIds = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.amount.in([[123456789012345678901234567890n, 10], [1n, 0]]))
            .selectOneColumn(tExactAmount.id)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where amount in (cast(? as decimal(30, 10)), cast(? as decimal(1, 0)))"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "12345678901234567890.1234567890",
            "1",
          ]
        `)
        const betweenIds = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.price.between([-25n, 2], [0n, 0]))
            .selectOneColumn(tExactAmount.id)
            .orderBy('result')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where price between cast(? as decimal(3, 2)) and cast(? as decimal(1, 0)) order by result"`)
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
        ctx.mockNext({ next: '12345678901234567890.1234567892', double: '3.00' })
        ctx.mockNext({ total: '111111111011111111100.8611111101', prices: '1235.81' })
        const row = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.id.equals(1))
            .select({
                next: tExactAmount.amount.add([1n, 10]),
                double: tExactAmount.price.multiply([2n, 0]),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select amount + cast(? as decimal(11, 10)) as next, price * cast(? as decimal(1, 0)) as \`double\` from exact_amount where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0.0000000001",
            "2",
            1,
          ]
        `)
        assertType<Exact<typeof row, { next?: Dnum; double?: Dnum }>>()
        expect(row).toEqual({ next: [123456789012345678901234567892n, 10], double: [300n, 2] })
        const sums = await ctx.conn.selectFrom(tExactAmount)
            .select({
                total: ctx.conn.sum(tExactAmount.amount),
                prices: ctx.conn.sum(tExactAmount.price),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(amount) as total, sum(price) as prices from exact_amount"`)
        assertType<Exact<typeof sums, { total?: Dnum; prices?: Dnum }>>()
        expect(sums).toEqual({ total: [1111111110111111111008611111101n, 10], prices: [123581n, 2] })
    })

    test('dnum-decimal/an-array-aggregate-reads-the-dnums-from-the-json', async () => {
        ctx.mockNext([{ id: 1, amounts: '[12345678901234567890.1234567891]' }])
        const rows = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.id.equals(1))
            .select({
                id: tExactAmount.id,
                amounts: ctx.conn.aggregateAsArrayOfOneColumn(tExactAmount.amount),
            })
            .groupBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(json_arrayagg(amount) as char) as amounts from exact_amount where id = ? group by id"`)
        assertType<Exact<typeof rows, { id: number; amounts: Dnum[] }[]>>()
        expect(rows).toEqual([{ id: 1, amounts: [[123456789012345678901234567891n, 10]] }])
    })

    test('dnum-decimal/an-insert-sends-the-text-and-reads-it-back', async () => {
        ctx.mockNext(1)
        ctx.mockNext({ amount: '-98765432109876543210.0000000001', price: '0.10' })
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tExactAmount)
                .set({ id: 6, amount: [-987654321098765432100000000001n, 10], price: [1n, 1] })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into exact_amount (id, amount, price) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                6,
                "-98765432109876543210.0000000001",
                "0.1",
              ]
            `)
            expect(inserted).toBe(1)

            // The price was sent as 0.1 and the column keeps it with its 2 decimals
            const row = await ctx.conn.selectFrom(tExactAmount)
                .where(tExactAmount.id.equals(6))
                .select({ amount: tExactAmount.amount, price: tExactAmount.price })
                .executeSelectOne()
            expect(row).toEqual({ amount: [-987654321098765432100000000001n, 10], price: [10n, 2] })
        })
    })

    test('dnum-decimal/the-sql-data-type-gives-the-decimals-the-database-does-not-give', async () => {
        // The SQL data type declared says 2 decimals for amount and 3 for price, but the database gives the decimals of
        // the columns, 10 and 2, which are the ones of the value, also as a stringDecimal
        ctx.mockNext([
            { id: 1, amount: '12345678901234567890.1234567891', price: '1.50', priceText: '1.50' },
            { id: 3, amount: '0.0000000000', price: '0.00', priceText: '0.00' },
        ])
        const rows = await ctx.conn.selectFrom(tDeclaredExactAmount)
            .where(tDeclaredExactAmount.id.in([1, 3]))
            .select({
                id: tDeclaredExactAmount.id,
                amount: tDeclaredExactAmount.amount,
                price: tDeclaredExactAmount.price,
                priceText: tDeclaredExactAmount.priceText,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, amount as amount, price as price, price as priceText from exact_amount where id in (?, ?) order by id"`)
        assertType<Exact<typeof rows, { id: number; amount?: Dnum; price?: Dnum; priceText?: string }[]>>()
        expect(rows).toEqual([
            { id: 1, amount: [123456789012345678901234567891n, 10], price: [150n, 2], priceText: '1.50' },
            { id: 3, amount: [0n, 10], price: [0n, 2], priceText: '0.00' },
        ])
    })

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092), newer than this tier's engine.
    /*
    test('dnum-decimal/a-returning-clause-has-the-decimals-of-the-database-or-of-the-sql-data-type', async () => {
        // The price is sent as 1.7 and kept by the column with its 2 decimals, which the database gives
        ctx.mockNext({ price: '1.70', priceText: '1.70' })
        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tDeclaredExactAmount)
                .set({ price: [17n, 1] })
                .where(tDeclaredExactAmount.id.equals(1))
                .returning({ price: tDeclaredExactAmount.price, priceText: tDeclaredExactAmount.priceText })
                .executeUpdateOne()
            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof row, { price?: Dnum; priceText?: string }>>()
            expect(row).toEqual({ price: [170n, 2], priceText: '1.70' })
        })
    })
    */

    test('dnum-decimal/an-array-aggregate-has-the-decimals-of-the-database-or-of-the-sql-data-type', async () => {
        // The JSON has the price with the 2 decimals of its column
        ctx.mockNext([{ id: 1, prices: '[1.50]' }])
        const rows = await ctx.conn.selectFrom(tDeclaredExactAmount)
            .where(tDeclaredExactAmount.id.equals(1))
            .select({
                id: tDeclaredExactAmount.id,
                prices: ctx.conn.aggregateAsArrayOfOneColumn(tDeclaredExactAmount.price),
            })
            .groupBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(json_arrayagg(price) as char) as prices from exact_amount where id = ? group by id"`)
        assertType<Exact<typeof rows, { id: number; prices: Dnum[] }[]>>()
        expect(rows).toEqual([{ id: 1, prices: [[150n, 2]] }])
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
        const dynamicIds = await ctx.conn.selectFrom(tExactAmount)
            .where(ctx.conn.dynamicConditionFor({ price: tExactAmount.price }).withValues(filter))
            .selectOneColumn(tExactAmount.id)
            .orderBy('result')
            .executeSelectMany()
        const dynamicSql = ctx.lastSql
        const dynamicParams = ctx.lastParams
        const ids = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.price.greaterOrEqual([150n, 2]).and(tExactAmount.price.lessThan([2n, 0])))
            .selectOneColumn(tExactAmount.id)
            .orderBy('result')
            .executeSelectMany()
        expect(dynamicSql).toBe(ctx.lastSql)
        expect(dynamicParams).toEqual(ctx.lastParams)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where price >= cast(? as decimal(3, 2)) and price < cast(? as decimal(1, 0)) order by result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.50",
            "2",
          ]
        `)
        expect(dynamicIds).toEqual([1])
        expect(ids).toEqual([1])
    })

    test('dnum-decimal/a-dnum-with-decimals-that-are-not-a-whole-number-is-rejected', async () => {
        let negative: unknown
        try {
            await ctx.conn.selectFrom(tExactAmount)
                .where(tExactAmount.price.equals([15n, -1]))
                .selectOneColumn(tExactAmount.id)
                .executeSelectMany()
        } catch (e) {
            negative = e
        }
        let fraction: unknown
        try {
            await ctx.conn.selectFrom(tExactAmount)
                .where(tExactAmount.price.equals([15n, 0.5]))
                .selectOneColumn(tExactAmount.id)
                .executeSelectMany()
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
            await ctx.conn.selectFromNoTable()
                .select({ value: ctx.conn.fragmentWithType('dnumDecimal', 'required').sql`'1e3'` })
                .executeSelectOne()
        } catch (e) {
            withExponent = e
        }
        let aNumber: unknown
        try {
            await ctx.conn.selectFromNoTable()
                .select({ value: ctx.conn.fragmentWithType('dnumDecimal', 'required').sql`1.5e0` })
                .executeSelectOne()
        } catch (e) {
            aNumber = e
        }
        expect(withExponent instanceof TsSqlError ? withExponent.errorReason : undefined).toEqual({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value: '1e3', typeName: 'dnumDecimal', columnPath: 'value' })
        expect(aNumber instanceof TsSqlError ? aNumber.errorReason : undefined).toEqual({ reason: 'PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE', value: 1.5, typeName: 'dnumDecimal', columnPath: 'value' })
    })
})
