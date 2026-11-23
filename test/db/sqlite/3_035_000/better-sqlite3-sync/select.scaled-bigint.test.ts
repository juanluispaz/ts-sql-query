// A column of a scaled bigint: a decimal number whose value is a bigint with its scale in its type, ScaledBigInt<2>
// keeps cents (150n is 1.50), sent and read as the text of the decimal, so it keeps every digit.
// The connection uses the default decimal strategy of SQLite: every value is kept in its canonical text, which a
// scaled bigint reads at its scale. Row 1 has the price 1.5 and the hundreds 12300 (an integer, read at the scale 0), row 4 has none.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Table } from '../../../../../src/Table.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import type { DynamicCondition, DynamicConditionForModel } from '../../../../../src/dynamic/condition.js'
import { scaledBigInt, scaledBigIntsType, scaledBigIntType, type BigintType, type FilterOf, type ScaledBigInt, type ScaledBigIntsType, type ScaledBigIntType, type ScaleOf } from '../../../../../src/exports/v2/index.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

const tScaledAmount = new class TScaledAmount extends Table<DBConnection, 'TScaledAmount'> {
    id       = this.primaryKey('id', 'int')
    amount   = this.optionalColumn('amount', scaledBigIntType(10))
    price    = this.optionalColumn('price', scaledBigIntType(2))
    hundreds = this.optionalColumn('hundreds', scaledBigIntType(0))
    constructor() { super('exact_amount') }
}()

// A type of yours of the scale 2, made from the family of that scale
type Price = ScaledBigInt<2> & { readonly __brand: 'Price' }
const ScaledBigIntsOf2 = scaledBigIntsType(2)
abstract class PriceType extends ScaledBigIntsOf2<Price, 'Price'> {
    static override readonly type = 'Price'
}

const tPricedAmount = new class TPricedAmount extends Table<DBConnection, 'TPricedAmount'> {
    id    = this.primaryKey('id', 'int')
    price = this.optionalColumn('price', PriceType)
    // The same columns read at another scale than the one of their values
    amountInCents   = this.optionalColumn('amount', scaledBigIntType(2))
    priceInTenths   = this.optionalColumn('price', scaledBigIntType(4))
    constructor() { super('exact_amount') }
}()

// The same columns by the name of their data type, as TypeScript writes it
const tNamedAmount = new class TNamedAmount extends Table<DBConnection, 'TNamedAmount'> {
    id    = this.primaryKey('id', 'int')
    price = this.optionalColumn('price', 'ScaledBigInt<2>')
    constructor() { super('exact_amount') }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('scaled-bigint/reads-the-digits-at-the-scale', async () => {
        ctx.mockNext([
            { id: 1, amount: '12345678901234567890.1234567891', price: '1.5', hundreds: '12300' },
            { id: 2, amount: '-0.25', price: '-0.25', hundreds: '-500' },
            { id: 3, amount: '0', price: '0', hundreds: '0' },
            { id: 4, amount: null, price: null, hundreds: null },
            { id: 5, amount: '98765432109876543210.987654321', price: '1234.56', hundreds: '999900' },
        ])
        const rows = sync(ctx.conn.selectFrom(tScaledAmount)
            .select({
                id: tScaledAmount.id,
                amount: tScaledAmount.amount,
                price: tScaledAmount.price,
                hundreds: tScaledAmount.hundreds,
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, amount as amount, price as price, hundreds as hundreds from exact_amount order by id"`)
        assertType<Exact<typeof rows, { id: number; amount?: ScaledBigInt<10>; price?: ScaledBigInt<2>; hundreds?: ScaledBigInt<0> }[]>>()
        expect(rows).toEqual([
            { id: 1, amount: 123456789012345678901234567891n, price: 150n, hundreds: 12300n },
            { id: 2, amount: -2500000000n, price: -25n, hundreds: -500n },
            { id: 3, amount: 0n, price: 0n, hundreds: 0n },
            { id: 4 },
            { id: 5, amount: 987654321098765432109876543210n, price: 123456n, hundreds: 999900n },
        ])
    })

    test('scaled-bigint/sends-the-text-of-the-decimal', async () => {
        ctx.mockNext([1])
        ctx.mockNext([1])
        ctx.mockNext([2, 3])
        const byPrice = sync(ctx.conn.selectFrom(tScaledAmount)
            .where(tScaledAmount.price.equals(scaledBigInt(150n, 2)))
            .selectOneColumn(tScaledAmount.id)
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where price = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.5",
          ]
        `)
        const byHundreds = sync(ctx.conn.selectFrom(tScaledAmount)
            .where(tScaledAmount.hundreds.in([scaledBigInt(12300n, 0), scaledBigInt(100n, 0)]))
            .selectOneColumn(tScaledAmount.id)
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where hundreds in (?1, ?2)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "12300",
            "100",
          ]
        `)
        const between = sync(ctx.conn.selectFrom(tScaledAmount)
            .where(tScaledAmount.price.between(scaledBigInt(-25n, 2), scaledBigInt(0n, 2)))
            .selectOneColumn(tScaledAmount.id)
            .orderBy('result')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where (decimal_cmp(price, ?1) >= 0 and decimal_cmp(price, ?2) <= 0) order by result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "-0.25",
            "0",
          ]
        `)
        expect(byPrice).toEqual([1])
        expect(byHundreds).toEqual([1])
        expect(between).toEqual([2, 3])
    })

    test('scaled-bigint/adds-subtracts-and-sums-at-the-scale', async () => {
        ctx.mockNext({ next: '1.51', less: '12200', abs: '0.25' })
        ctx.mockNext({ prices: '1235.81', hundreds: '1011700', average: 308.9525 })
        const row = sync(ctx.conn.selectFrom(tScaledAmount)
            .where(tScaledAmount.id.equals(1))
            .select({
                next: tScaledAmount.price.add(scaledBigInt(1n, 2)),
                less: tScaledAmount.hundreds.subtract(scaledBigInt(100n, 0)),
                abs: tScaledAmount.price.subtract(scaledBigInt(175n, 2)).abs(),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) as next, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when hundreds is null then null else decimal_sub(hundreds, ?2) end as tsq_v)) as less, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select (case when substr(case when price is null then null else decimal_sub(price, ?3) end, 1, 1) = '-' then substr(case when price is null then null else decimal_sub(price, ?3) end, 2) else case when price is null then null else decimal_sub(price, ?3) end end) as tsq_v)) as abs from exact_amount where id = ?4"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0.01",
            "100",
            "1.75",
            1,
          ]
        `)
        assertType<Exact<typeof row, { next?: ScaledBigInt<2>; less?: ScaledBigInt<0>; abs?: ScaledBigInt<2> }>>()
        expect(row).toEqual({ next: 151n, less: 12200n, abs: 25n })
        const sums = sync(ctx.conn.selectFrom(tScaledAmount)
            .select({
                prices: ctx.conn.sum(tScaledAmount.price),
                hundreds: ctx.conn.sum(tScaledAmount.hundreds),
                average: ctx.conn.average(tScaledAmount.price),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when count(price) = 0 then null else decimal_sum(price) end as tsq_v)) as prices, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when count(hundreds) = 0 then null else decimal_sum(hundreds) end as tsq_v)) as hundreds, avg(cast(price as real)) as average from exact_amount"`)
        assertType<Exact<typeof sums, { prices?: ScaledBigInt<2>; hundreds?: ScaledBigInt<0>; average?: number }>>()
        expect(sums.prices).toBe(123581n)
        expect(sums.hundreds).toBe(1011700n)
        if (ctx.realDbEnabled) {
            // The average is a double, computed by the database
            expect(sums.average).toBeCloseTo(308.9525, 6)
        } else {
            expect(sums.average).toBe(308.9525)
        }
    })

    test('scaled-bigint/reads-a-column-of-another-scale-without-losing-a-digit', async () => {
        // The price has 2 decimals, read with 4; the amount has 10 decimals, read with 2: a digit beyond them is lost,
        // and the value is rejected
        ctx.mockNext({ priceInTenths: '1.5' })
        ctx.mockNext({ amountInCents: '12345678901234567890.1234567891' })
        ctx.mockNext({ amountInCents: '0' })
        const wider = sync(ctx.conn.selectFrom(tPricedAmount)
            .where(tPricedAmount.id.equals(1))
            .select({ priceInTenths: tPricedAmount.priceInTenths })
            .executeSelectOne())
        expect(wider).toEqual({ priceInTenths: 15000n })
        let narrower: unknown
        try {
            sync(ctx.conn.selectFrom(tPricedAmount)
                .where(tPricedAmount.id.equals(1))
                .select({ amountInCents: tPricedAmount.amountInCents })
                .executeSelectOne())
        } catch (e) {
            narrower = e
        }
        // Zeros beyond the scale aren't a digit lost
        const zeros = sync(ctx.conn.selectFrom(tPricedAmount)
            .where(tPricedAmount.id.equals(3))
            .select({ amountInCents: tPricedAmount.amountInCents })
            .executeSelectOne())
        expect(narrower instanceof TsSqlError ? narrower.errorReason : undefined).toEqual({ reason: 'PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE', value: '12345678901234567890.1234567891', typeName: 'ScaledBigInt<2>', columnPath: 'amountInCents' })
        expect(zeros).toEqual({ amountInCents: 0n })
    })

    test('scaled-bigint/an-insert-sends-the-text-and-reads-it-back', async () => {
        ctx.mockNext(1)
        ctx.mockNext({ amount: '-98765432109876543210.0000000001', price: '0.1', hundreds: '-700' })
        await ctx.withRollback(async () => {
            const inserted = sync(ctx.conn.insertInto(tScaledAmount)
                .set({ id: 6, amount: scaledBigInt(-987654321098765432100000000001n, 10), price: scaledBigInt(10n, 2), hundreds: scaledBigInt(-700n, 0) })
                .executeInsert())
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into exact_amount (id, amount, price, hundreds) values (?1, ?2, ?3, ?4)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                6,
                "-98765432109876543210.0000000001",
                "0.1",
                "-700",
              ]
            `)
            expect(inserted).toBe(1)

            const row = sync(ctx.conn.selectFrom(tScaledAmount)
                .where(tScaledAmount.id.equals(6))
                .select({ amount: tScaledAmount.amount, price: tScaledAmount.price, hundreds: tScaledAmount.hundreds })
                .executeSelectOne())
            expect(row).toEqual({ amount: -987654321098765432100000000001n, price: 10n, hundreds: -700n })
        })
    })

    test('scaled-bigint/an-array-aggregate-reads-the-digits-from-the-json', async () => {
        ctx.mockNext([{ id: 1, prices: '[1.5]' }])
        const rows = sync(ctx.conn.selectFrom(tScaledAmount)
            .where(tScaledAmount.id.equals(1))
            .select({
                id: tScaledAmount.id,
                prices: ctx.conn.aggregateAsArrayOfOneColumn(tScaledAmount.price),
            })
            .groupBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, json_group_array(price) as prices from exact_amount where id = ?1 group by id"`)
        assertType<Exact<typeof rows, { id: number; prices: ScaledBigInt<2>[] }[]>>()
        expect(rows).toEqual([{ id: 1, prices: [150n] }])
    })

    test('scaled-bigint/a-type-of-yours-of-a-scale', async () => {
        ctx.mockNext({ price: '1.5' })
        const row = sync(ctx.conn.selectFrom(tPricedAmount)
            .where(tPricedAmount.id.equals(1))
            .select({ price: tPricedAmount.price })
            .executeSelectOne())
        assertType<Exact<typeof row, { price?: Price }>>()
        assertType<Exact<ScaleOf<Price>, 2>>()
        expect(row).toEqual({ price: 150n })
    })

    test('scaled-bigint/a-scale-by-the-name-of-its-data-type', async () => {
        // 'ScaledBigInt<2>' is the data type of scaledBigIntType(2), with no registration, wherever a type name goes
        ctx.mockNext([{ id: 1, price: '1.50', twice: '1.50' }])
        const rows = sync(ctx.conn.selectFrom(tNamedAmount)
            .where(tNamedAmount.price.equals(ctx.conn.const(scaledBigInt(150n, 2), 'ScaledBigInt<2>')))
            .select({
                id: tNamedAmount.id,
                price: tNamedAmount.price,
                twice: ctx.conn.fragmentWithType('ScaledBigInt<2>', 'optional').sql`${tNamedAmount.price}`,
            })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, price as price, (select case when typeof(tsq_v) = 'text' and tsq_v not glob '*[^0-9.-]*' then (case when tsq_v is null then null when rtrim(ltrim(ltrim(substr(ltrim(tsq_v, '-'), 1, instr(ltrim(tsq_v, '-') || '.', '.') - 1), '0') || rtrim(substr(ltrim(tsq_v, '-'), instr(ltrim(tsq_v, '-') || '.', '.') + 1), '0'), '0'), '0') = '' then '0' else (case when substr(tsq_v, 1, 1) = '-' then '-' else '' end) || (case when ltrim(substr(ltrim(tsq_v, '-'), 1, instr(ltrim(tsq_v, '-') || '.', '.') - 1), '0') = '' then '0' else ltrim(substr(ltrim(tsq_v, '-'), 1, instr(ltrim(tsq_v, '-') || '.', '.') - 1), '0') end) || (case when rtrim(substr(ltrim(tsq_v, '-'), instr(ltrim(tsq_v, '-') || '.', '.') + 1), '0') <> '' then '.' || rtrim(substr(ltrim(tsq_v, '-'), instr(ltrim(tsq_v, '-') || '.', '.') + 1), '0') else '' end) end) else tsq_v end from (select price as tsq_v)) as twice from exact_amount where price = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.5",
          ]
        `)
        assertType<Exact<typeof rows, { id: number; price?: ScaledBigInt<2>; twice?: ScaledBigInt<2> }[]>>()
        expect(rows).toEqual([{ id: 1, price: 150n, twice: 150n }])
        type Condition = DynamicCondition<{ price: 'ScaledBigInt<2>' }>
        assertType<Exact<NonNullable<Condition['price']>, FilterOf<ScaledBigIntType<2>>>>()
    })

    test('scaled-bigint/the-classes-of-a-scale', () => {
        // One class for each scale, with its type name and its SQL data type
        expect(scaledBigIntType(2)).toBe(scaledBigIntType(2))
        expect(scaledBigIntsType(4)).toBe(scaledBigIntsType(4))
        expect(scaledBigIntType(2).type).toBe('ScaledBigInt<2>')
        expect(scaledBigIntType(4).scale).toBe(4)
        expect(scaledBigIntType(2).sqlDataType).toEqual({ family: 'exact numeric', scale: 2 })
        assertType<Exact<InstanceType<ReturnType<typeof scaledBigIntType<2>>>, ScaledBigIntType<2>>>()
        let fraction: unknown
        try {
            scaledBigIntType(1.5)
        } catch (e) {
            fraction = e
        }
        // A scale is 0 or more: an integer of a column of a negative scale is of the scale 0
        const scaleOfAColumn: number = -2
        let negative: unknown
        try {
            scaledBigIntsType(scaleOfAColumn)
        } catch (e) {
            negative = e
        }
        expect(fraction instanceof TsSqlError ? fraction.errorReason : undefined).toEqual({ reason: 'INVALID_CONFIGURATION', name: 'scale', value: 1.5 })
        expect(negative instanceof TsSqlError ? negative.errorReason : undefined).toEqual({ reason: 'INVALID_CONFIGURATION', name: 'scale', value: -2 })
        // A name whose scale isn't an integer has no data type
        let unknownName: unknown
        try {
            ctx.conn.fragmentWithType('ScaledBigInt<1.5>', 'required')
        } catch (e) {
            unknownName = e
        }
        expect(unknownName instanceof TsSqlError ? unknownName.errorReason : undefined).toEqual({ reason: 'UNKNOWN_DATA_TYPE', typeName: 'ScaledBigInt<1.5>' })
    })

    test('scaled-bigint/a-dynamic-condition-and-a-model', async () => {
        ctx.mockNext([1])
        ctx.mockNext([1])
        type Condition = DynamicCondition<{ price: ScaledBigIntType<2> }>
        assertType<Exact<NonNullable<Condition['price']>, FilterOf<ScaledBigIntType<2>>>>()
        // A scaled bigint of a model is filtered with its data type; another branded bigint, as a bigint
        type Id = bigint & { readonly __brand: 'Id' }
        type ModelCondition = DynamicConditionForModel<{ id: Id, price: ScaledBigInt<2> }>
        assertType<Exact<NonNullable<ModelCondition['price']>, FilterOf<ScaledBigIntsType<ScaledBigInt<2>, string>>>>()
        assertType<Exact<NonNullable<ModelCondition['id']>, FilterOf<BigintType>>>()
        const filter: Condition = { price: { greaterOrEqual: scaledBigInt(150n, 2), lessThan: scaledBigInt(200n, 2) } }
        const dynamicIds = sync(ctx.conn.selectFrom(tScaledAmount)
            .where(ctx.conn.dynamicConditionFor({ price: tScaledAmount.price }).withValues(filter))
            .selectOneColumn(tScaledAmount.id)
            .orderBy('result')
            .executeSelectMany())
        const dynamicSql = ctx.lastSql
        const dynamicParams = ctx.lastParams
        const ids = sync(ctx.conn.selectFrom(tScaledAmount)
            .where(tScaledAmount.price.greaterOrEqual(scaledBigInt(150n, 2)).and(tScaledAmount.price.lessThan(scaledBigInt(200n, 2))))
            .selectOneColumn(tScaledAmount.id)
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

    test('scaled-bigint/a-value-from-the-database-that-is-not-a-plain-decimal-is-rejected', async () => {
        // A text with an exponent, and a number the driver already rounded to a JavaScript number
        ctx.mockNext({ value: '1e3' })
        ctx.mockNext({ value: 1.5 })
        let withExponent: unknown
        try {
            sync(ctx.conn.selectFromNoTable()
                .select({ value: ctx.conn.fragmentWithType(scaledBigIntType(2), 'required').sql`'1e3'` })
                .executeSelectOne())
        } catch (e) {
            withExponent = e
        }
        let aNumber: unknown
        try {
            sync(ctx.conn.selectFromNoTable()
                .select({ value: ctx.conn.fragmentWithType(scaledBigIntType(2), 'required').sql`1.5e0` })
                .executeSelectOne())
        } catch (e) {
            aNumber = e
        }
        expect(withExponent instanceof TsSqlError ? withExponent.errorReason : undefined).toEqual({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value: '1e3', typeName: 'ScaledBigInt<2>', columnPath: 'value' })
        expect(aNumber instanceof TsSqlError ? aNumber.errorReason : undefined).toEqual({ reason: 'PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE', value: 1.5, typeName: 'ScaledBigInt<2>', columnPath: 'value' })
    })
})
