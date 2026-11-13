// A customDecimal column: a decimal number of a type of its own, sent and read as its text so it keeps every digit.
// The connection uses the default decimal strategy of SQLite, 'decimal-extension and tsq-functions with canonical text':
// every value is written and read in its canonical text (no zeros at the end of the fraction, so the scale of a value
// isn't kept). Row 1 has an amount of 30 significant digits and the price 1.5, row 4 has neither.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { getQueryContext } from '../../../../../src/QueryContext.js'
import { Table } from '../../../../../src/Table.js'
import { TsSqlError, type TsSqlErrorReason } from '../../../../../src/TsSqlError.js'
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
            { id: 1, amount: '12345678901234567890.1234567891', price: '1.5' },
            { id: 2, amount: '-0.25', price: '-0.25' },
            { id: 3, amount: '0', price: '0' },
            { id: 4, amount: null, price: null },
            { id: 5, amount: '98765432109876543210.987654321', price: '1234.56' },
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
            { id: 1, amount: '12345678901234567890.1234567891', price: '1.5' },
            { id: 2, amount: '-0.25', price: '-0.25' },
            { id: 3, amount: '0', price: '0' },
            { id: 4 },
            { id: 5, amount: '98765432109876543210.987654321', price: '1234.56' },
        ])
    })

    test('custom-decimal/compares-and-orders-as-a-number', async () => {
        ctx.mockNext([2, 1, 5])
        const ids = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.amount.notEquals('12345678901234567890.1234567890' as Amount))
            .and(tExactAmount.price.greaterThan('-1' as Amount))
            .and(tExactAmount.price.notEquals('0' as Amount))
            .selectOneColumn(tExactAmount.id)
            .orderBy(tExactAmount.price)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where amount <> ?1 and decimal_cmp(price, ?2) > 0 and price <> ?3 order by (case when exact_amount.price is null then null when exact_amount.price = '0' then 0 when substr(exact_amount.price, 1, 1) = '-' then -1 else 1 end) asc, (case when (case when exact_amount.price is null then null when exact_amount.price = '0' then 0 when substr(exact_amount.price, 1, 1) = '-' then -1 else 1 end) = 1 then (case when substr(ltrim(exact_amount.price, '-'), 1, 2) = '0.' then length(ltrim(substr(ltrim(exact_amount.price, '-'), 3), '0')) - length(substr(ltrim(exact_amount.price, '-'), 3)) else instr(ltrim(exact_amount.price, '-') || '.', '.') - 1 end) end) asc, (case when (case when exact_amount.price is null then null when exact_amount.price = '0' then 0 when substr(exact_amount.price, 1, 1) = '-' then -1 else 1 end) = -1 then (case when substr(ltrim(exact_amount.price, '-'), 1, 2) = '0.' then length(ltrim(substr(ltrim(exact_amount.price, '-'), 3), '0')) - length(substr(ltrim(exact_amount.price, '-'), 3)) else instr(ltrim(exact_amount.price, '-') || '.', '.') - 1 end) end) desc, (case when (case when exact_amount.price is null then null when exact_amount.price = '0' then 0 when substr(exact_amount.price, 1, 1) = '-' then -1 else 1 end) = 1 then ltrim(replace(ltrim(exact_amount.price, '-'), '.', ''), '0') end) asc, (case when (case when exact_amount.price is null then null when exact_amount.price = '0' then 0 when substr(exact_amount.price, 1, 1) = '-' then -1 else 1 end) = -1 then ltrim(replace(ltrim(exact_amount.price, '-'), '.', ''), '0') end) desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "12345678901234567890.123456789",
            "-1",
            "0",
          ]
        `)
        const params = ctx.lastParams
        expect(params.map((_value, index) => [getQueryContext(ctx.lastSql, params).getParam(index)?.originalType, getQueryContext(ctx.lastSql, params).getParam(index)?.originalCustomType])).toEqual([
            ['Amount', 'customDecimal'],
            ['Amount', 'customDecimal'],
            ['Amount', 'customDecimal'],
        ])
        assertType<Exact<typeof ids, number[]>>()
        expect(ids).toEqual([2, 1, 5])
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
        ctx.mockNext({ next: '12345678901234567890.1234567892', double: '3', negated: '-1.5' })
        const row = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.id.equals(1))
            .select({
                next: tExactAmount.amount.add('0.0000000001' as Amount),
                double: tExactAmount.price.multiply('2' as Amount),
                negated: tExactAmount.price.subtract(tExactAmount.price).subtract(tExactAmount.price),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when amount is null then null else decimal_add(amount, ?1) end as tsq_v)) as next, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select decimal_mul(price, ?2) as tsq_v)) as double, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when case when price is null then null else decimal_sub(price, price) end is null or price is null then null else decimal_sub(case when price is null then null else decimal_sub(price, price) end, price) end as tsq_v)) as negated from exact_amount where id = ?3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0.0000000001",
            "2",
            1,
          ]
        `)
        assertType<Exact<typeof row, { next?: Amount; double?: Amount; negated?: Amount }>>()
        expect(row).toEqual({ next: '12345678901234567890.1234567892', double: '3', negated: '-1.5' })
    })

    test('custom-decimal/sums-exactly', async () => {
        ctx.mockNext({ total: '111111111011111111100.8611111101', prices: '1235.81' })
        const row = await ctx.conn.selectFrom(tExactAmount)
            .select({
                total: ctx.conn.sum(tExactAmount.amount),
                prices: ctx.conn.sum(tExactAmount.price),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when count(amount) = 0 then null else decimal_sum(amount) end as tsq_v)) as total, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when count(price) = 0 then null else decimal_sum(price) end as tsq_v)) as prices from exact_amount"`)
        assertType<Exact<typeof row, { total?: Amount; prices?: Amount }>>()
        expect(row).toEqual({ total: '111111111011111111100.8611111101', prices: '1235.81' })
    })

    test('custom-decimal/an-in-list-and-a-between-compare-every-digit', async () => {
        // The amount of row 1 ends in 891: a value that ends in 890 is another value
        ctx.mockNext([])
        ctx.mockNext([])
        const inIds = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.amount.in(['12345678901234567890.1234567890' as Amount, '1' as Amount]))
            .selectOneColumn(tExactAmount.id)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where amount in (?1, ?2)"`)
        const betweenIds = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.amount.between('12345678901234567890.1234567890' as Amount, '12345678901234567890.1234567890' as Amount))
            .selectOneColumn(tExactAmount.id)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where (decimal_cmp(amount, ?1) >= 0 and decimal_cmp(amount, ?2) <= 0)"`)
        expect(inIds).toEqual([])
        expect(betweenIds).toEqual([])
    })

    // price + 9 is 10.50, 8.75, 9.00 and 1243.56: as text it would order 10.50, 1243.56, 8.75, 9.00
    test('custom-decimal/orders-by-the-alias-as-a-number', async () => {
        ctx.mockNext([{ id: 2, shifted: '8.75' }, { id: 3, shifted: '9' }, { id: 1, shifted: '10.5' }, { id: 5, shifted: '1243.56' }])
        const rows = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.price.isNotNull())
            .select({ id: tExactAmount.id, shifted: tExactAmount.price.add('9' as Amount) })
            .orderBy('shifted')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) as shifted from exact_amount where price is not null order by (case when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) is null then null when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) = '0' then 0 when substr((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), 1, 1) = '-' then -1 else 1 end) asc, (case when (case when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) is null then null when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) = '0' then 0 when substr((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), 1, 1) = '-' then -1 else 1 end) = 1 then (case when substr(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-'), 1, 2) = '0.' then length(ltrim(substr(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-'), 3), '0')) - length(substr(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-'), 3)) else instr(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-') || '.', '.') - 1 end) end) asc, (case when (case when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) is null then null when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) = '0' then 0 when substr((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), 1, 1) = '-' then -1 else 1 end) = -1 then (case when substr(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-'), 1, 2) = '0.' then length(ltrim(substr(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-'), 3), '0')) - length(substr(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-'), 3)) else instr(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-') || '.', '.') - 1 end) end) desc, (case when (case when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) is null then null when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) = '0' then 0 when substr((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), 1, 1) = '-' then -1 else 1 end) = 1 then ltrim(replace(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-'), '.', ''), '0') end) asc, (case when (case when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) is null then null when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) = '0' then 0 when substr((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), 1, 1) = '-' then -1 else 1 end) = -1 then ltrim(replace(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-'), '.', ''), '0') end) desc"`)
        assertType<Exact<typeof rows, { id: number; shifted?: Amount }[]>>()
        expect(rows).toEqual([{ id: 2, shifted: '8.75' }, { id: 3, shifted: '9' }, { id: 1, shifted: '10.5' }, { id: 5, shifted: '1243.56' }])
    })

    test('custom-decimal/a-distinct-select-orders-by-the-alias-as-a-number', async () => {
        ctx.mockNext([{ shifted: '8.75' }, { shifted: '9' }, { shifted: '10.5' }, { shifted: '1243.56' }])
        const rows = await ctx.conn.selectDistinctFrom(tExactAmount)
            .where(tExactAmount.price.isNotNull())
            .select({ shifted: tExactAmount.price.add('9' as Amount) })
            .orderBy('shifted')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select distinct (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) as shifted from exact_amount where price is not null order by (case when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) is null then null when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) = '0' then 0 when substr((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), 1, 1) = '-' then -1 else 1 end) asc, (case when (case when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) is null then null when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) = '0' then 0 when substr((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), 1, 1) = '-' then -1 else 1 end) = 1 then (case when substr(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-'), 1, 2) = '0.' then length(ltrim(substr(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-'), 3), '0')) - length(substr(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-'), 3)) else instr(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-') || '.', '.') - 1 end) end) asc, (case when (case when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) is null then null when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) = '0' then 0 when substr((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), 1, 1) = '-' then -1 else 1 end) = -1 then (case when substr(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-'), 1, 2) = '0.' then length(ltrim(substr(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-'), 3), '0')) - length(substr(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-'), 3)) else instr(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-') || '.', '.') - 1 end) end) desc, (case when (case when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) is null then null when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) = '0' then 0 when substr((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), 1, 1) = '-' then -1 else 1 end) = 1 then ltrim(replace(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-'), '.', ''), '0') end) asc, (case when (case when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) is null then null when (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) = '0' then 0 when substr((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), 1, 1) = '-' then -1 else 1 end) = -1 then ltrim(replace(ltrim((select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)), '-'), '.', ''), '0') end) desc"`)
        assertType<Exact<typeof rows, { shifted?: Amount }[]>>()
        expect(rows).toEqual([{ shifted: '8.75' }, { shifted: '9' }, { shifted: '10.5' }, { shifted: '1243.56' }])
    })

    test('custom-decimal/a-compound-query-keeps-every-digit-and-orders-as-a-number', async () => {
        ctx.mockNext([{ id: 2, shifted: '8.75' }, { id: 3, shifted: '9' }, { id: 1, shifted: '10.5' }, { id: 5, shifted: '1243.56' }])
        const rows = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.id.in([1, 2]))
            .select({ id: tExactAmount.id, shifted: tExactAmount.price.add('9' as Amount) })
            .union(
                ctx.conn.selectFrom(tExactAmount)
                    .where(tExactAmount.id.in([3, 5]))
                    .select({ id: tExactAmount.id, shifted: tExactAmount.price.add('9' as Amount) })
            )
            .orderBy('shifted')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select * from (select id as id, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) as shifted from exact_amount where id in (?2, ?3) union select id as id, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?4) end as tsq_v)) as shifted from exact_amount where id in (?5, ?6)) as o_1_ order by (case when shifted is null then null when shifted = '0' then 0 when substr(shifted, 1, 1) = '-' then -1 else 1 end) asc, (case when (case when shifted is null then null when shifted = '0' then 0 when substr(shifted, 1, 1) = '-' then -1 else 1 end) = 1 then (case when substr(ltrim(shifted, '-'), 1, 2) = '0.' then length(ltrim(substr(ltrim(shifted, '-'), 3), '0')) - length(substr(ltrim(shifted, '-'), 3)) else instr(ltrim(shifted, '-') || '.', '.') - 1 end) end) asc, (case when (case when shifted is null then null when shifted = '0' then 0 when substr(shifted, 1, 1) = '-' then -1 else 1 end) = -1 then (case when substr(ltrim(shifted, '-'), 1, 2) = '0.' then length(ltrim(substr(ltrim(shifted, '-'), 3), '0')) - length(substr(ltrim(shifted, '-'), 3)) else instr(ltrim(shifted, '-') || '.', '.') - 1 end) end) desc, (case when (case when shifted is null then null when shifted = '0' then 0 when substr(shifted, 1, 1) = '-' then -1 else 1 end) = 1 then ltrim(replace(ltrim(shifted, '-'), '.', ''), '0') end) asc, (case when (case when shifted is null then null when shifted = '0' then 0 when substr(shifted, 1, 1) = '-' then -1 else 1 end) = -1 then ltrim(replace(ltrim(shifted, '-'), '.', ''), '0') end) desc"`)
        assertType<Exact<typeof rows, { id: number; shifted?: Amount }[]>>()
        expect(rows).toEqual([{ id: 2, shifted: '8.75' }, { id: 3, shifted: '9' }, { id: 1, shifted: '10.5' }, { id: 5, shifted: '1243.56' }])
    })

    test('custom-decimal/a-group-by-and-a-having-compare-as-a-number', async () => {
        ctx.mockNext([{ price: '1234.56', total: '98765432109876543210.987654321' }])
        const rows = await ctx.conn.selectFrom(tExactAmount)
            .select({ price: tExactAmount.price, total: ctx.conn.sum(tExactAmount.amount) })
            .groupBy('price')
            .having(ctx.conn.sum(tExactAmount.amount).greaterThan('99' as Amount))
            .orderBy('price', 'desc')
            .limit(1)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select price as price, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when count(amount) = 0 then null else decimal_sum(amount) end as tsq_v)) as total from exact_amount group by price having decimal_cmp(case when count(amount) = 0 then null else decimal_sum(amount) end, ?1) > 0 order by (case when price is null then null when price = '0' then 0 when substr(price, 1, 1) = '-' then -1 else 1 end) desc, (case when (case when price is null then null when price = '0' then 0 when substr(price, 1, 1) = '-' then -1 else 1 end) = 1 then (case when substr(ltrim(price, '-'), 1, 2) = '0.' then length(ltrim(substr(ltrim(price, '-'), 3), '0')) - length(substr(ltrim(price, '-'), 3)) else instr(ltrim(price, '-') || '.', '.') - 1 end) end) desc, (case when (case when price is null then null when price = '0' then 0 when substr(price, 1, 1) = '-' then -1 else 1 end) = -1 then (case when substr(ltrim(price, '-'), 1, 2) = '0.' then length(ltrim(substr(ltrim(price, '-'), 3), '0')) - length(substr(ltrim(price, '-'), 3)) else instr(ltrim(price, '-') || '.', '.') - 1 end) end) asc, (case when (case when price is null then null when price = '0' then 0 when substr(price, 1, 1) = '-' then -1 else 1 end) = 1 then ltrim(replace(ltrim(price, '-'), '.', ''), '0') end) desc, (case when (case when price is null then null when price = '0' then 0 when substr(price, 1, 1) = '-' then -1 else 1 end) = -1 then ltrim(replace(ltrim(price, '-'), '.', ''), '0') end) asc limit ?2"`)
        assertType<Exact<typeof rows, { price?: Amount; total?: Amount }[]>>()
        expect(rows).toEqual([{ price: '1234.56', total: '98765432109876543210.987654321' }])
    })

    test('custom-decimal/a-returning-clause-reads-every-digit', async () => {
        ctx.mockNext({ amount: '12345678901234567890.1234567892', price: '1.5' })
        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tExactAmount)
                .set({ amount: tExactAmount.amount.add('0.0000000001' as Amount) })
                .where(tExactAmount.id.equals(1))
                .returning({ amount: tExactAmount.amount, price: tExactAmount.price })
                .executeUpdateOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update exact_amount set amount = (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when amount is null then null else decimal_add(amount, ?1) end as tsq_v)) where id = ?2 returning amount as amount, price as price"`)
            assertType<Exact<typeof row, { amount?: Amount; price?: Amount }>>()
            expect(row).toEqual({ amount: '12345678901234567890.1234567892', price: '1.5' })
        })
    })

    // price + 9 is 10.50, 8.75, 9.00 and 1243.56: as text the smallest would be 10.50 and the largest 9.00
    test('custom-decimal/min-max-and-the-other-operations-compare-as-numbers', async () => {
        ctx.mockNext({ smallest: '8.75', largest: '1243.56', prices: '1235.81' })
        ctx.mockNext([{ id: 1, atLeast: '10.5', atMost: '9.5' }, { id: 2, atLeast: '9.5', atMost: '8.75' }, { id: 3, atLeast: '9.5', atMost: '9' }, { id: 5, atLeast: '1243.56', atMost: '9.5' }])
        ctx.mockNext([3, 4])
        const row = await ctx.conn.selectFrom(tExactAmount)
            .select({
                smallest: ctx.conn.min(tExactAmount.price.add('9' as Amount)),
                largest: ctx.conn.max(tExactAmount.price.add('9' as Amount)),
                prices: ctx.conn.sumDistinct(tExactAmount.price),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select coalesce(ltrim(ltrim(max(case when substr(case when price is null then null else decimal_add(price, ?1) end, 1, 1) = '-' and rtrim(ltrim(ltrim(substr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-'), 1, instr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-') || '.', '.') - 1), '0') || rtrim(substr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-'), instr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-') || '.', '.') + 1), '0'), '0'), '0') <> '' then printf('%010d', (case when ltrim(substr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-'), 1, instr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-') || '.', '.') - 1), '0') <> '' then length(ltrim(substr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-'), 1, instr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-') || '.', '.') - 1), '0')) else length(ltrim(rtrim(substr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-'), instr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-') || '.', '.') + 1), '0'), '0')) - length(rtrim(substr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-'), instr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-') || '.', '.') + 1), '0')) end) + 500000000) || rtrim(ltrim(ltrim(substr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-'), 1, instr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-') || '.', '.') - 1), '0') || rtrim(substr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-'), instr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-') || '.', '.') + 1), '0'), '0'), '0') || ' ' || case when price is null then null else decimal_add(price, ?1) end end), '0123456789'), ' '), ltrim(ltrim(min(case when not (substr(case when price is null then null else decimal_add(price, ?1) end, 1, 1) = '-' and rtrim(ltrim(ltrim(substr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-'), 1, instr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-') || '.', '.') - 1), '0') || rtrim(substr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-'), instr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-') || '.', '.') + 1), '0'), '0'), '0') <> '') then (case when rtrim(ltrim(ltrim(substr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-'), 1, instr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-') || '.', '.') - 1), '0') || rtrim(substr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-'), instr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-') || '.', '.') + 1), '0'), '0'), '0') = '' then '1 ' || case when price is null then null else decimal_add(price, ?1) end else '2' || printf('%010d', (case when ltrim(substr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-'), 1, instr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-') || '.', '.') - 1), '0') <> '' then length(ltrim(substr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-'), 1, instr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-') || '.', '.') - 1), '0')) else length(ltrim(rtrim(substr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-'), instr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-') || '.', '.') + 1), '0'), '0')) - length(rtrim(substr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-'), instr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-') || '.', '.') + 1), '0')) end) + 500000000) || rtrim(ltrim(ltrim(substr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-'), 1, instr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-') || '.', '.') - 1), '0') || rtrim(substr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-'), instr(ltrim(case when price is null then null else decimal_add(price, ?1) end, '-') || '.', '.') + 1), '0'), '0'), '0') || ' ' || case when price is null then null else decimal_add(price, ?1) end end) end), '0123456789'), ' ')) as tsq_v)) as smallest, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select coalesce(ltrim(ltrim(max(case when not (substr(case when price is null then null else decimal_add(price, ?2) end, 1, 1) = '-' and rtrim(ltrim(ltrim(substr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-'), 1, instr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-') || '.', '.') - 1), '0') || rtrim(substr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-'), instr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-') || '.', '.') + 1), '0'), '0'), '0') <> '') then (case when rtrim(ltrim(ltrim(substr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-'), 1, instr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-') || '.', '.') - 1), '0') || rtrim(substr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-'), instr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-') || '.', '.') + 1), '0'), '0'), '0') = '' then '1 ' || case when price is null then null else decimal_add(price, ?2) end else '2' || printf('%010d', (case when ltrim(substr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-'), 1, instr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-') || '.', '.') - 1), '0') <> '' then length(ltrim(substr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-'), 1, instr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-') || '.', '.') - 1), '0')) else length(ltrim(rtrim(substr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-'), instr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-') || '.', '.') + 1), '0'), '0')) - length(rtrim(substr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-'), instr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-') || '.', '.') + 1), '0')) end) + 500000000) || rtrim(ltrim(ltrim(substr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-'), 1, instr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-') || '.', '.') - 1), '0') || rtrim(substr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-'), instr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-') || '.', '.') + 1), '0'), '0'), '0') || ' ' || case when price is null then null else decimal_add(price, ?2) end end) end), '0123456789'), ' '), ltrim(ltrim(min(case when substr(case when price is null then null else decimal_add(price, ?2) end, 1, 1) = '-' and rtrim(ltrim(ltrim(substr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-'), 1, instr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-') || '.', '.') - 1), '0') || rtrim(substr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-'), instr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-') || '.', '.') + 1), '0'), '0'), '0') <> '' then printf('%010d', (case when ltrim(substr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-'), 1, instr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-') || '.', '.') - 1), '0') <> '' then length(ltrim(substr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-'), 1, instr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-') || '.', '.') - 1), '0')) else length(ltrim(rtrim(substr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-'), instr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-') || '.', '.') + 1), '0'), '0')) - length(rtrim(substr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-'), instr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-') || '.', '.') + 1), '0')) end) + 500000000) || rtrim(ltrim(ltrim(substr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-'), 1, instr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-') || '.', '.') - 1), '0') || rtrim(substr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-'), instr(ltrim(case when price is null then null else decimal_add(price, ?2) end, '-') || '.', '.') + 1), '0'), '0'), '0') || ' ' || case when price is null then null else decimal_add(price, ?2) end end), '0123456789'), ' ')) as tsq_v)) as largest, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when count(price) = 0 then null else decimal_sum(distinct price) end as tsq_v)) as prices from exact_amount"`)
        assertType<Exact<typeof row, { smallest?: Amount; largest?: Amount; prices?: Amount }>>()
        const rows = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.price.isNotNull())
            .select({
                id: tExactAmount.id,
                atLeast: tExactAmount.price.add('9' as Amount).minValue('9.5' as Amount),
                atMost: tExactAmount.price.add('9' as Amount).maxValue('9.5' as Amount),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when case when price is null then null else decimal_add(price, ?1) end is null then null when decimal_cmp(case when price is null then null else decimal_add(price, ?1) end, ?2) >= 0 then case when price is null then null else decimal_add(price, ?1) end else ?2 end as tsq_v)) as atLeast, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when case when price is null then null else decimal_add(price, ?3) end is null then null when decimal_cmp(case when price is null then null else decimal_add(price, ?3) end, ?4) <= 0 then case when price is null then null else decimal_add(price, ?3) end else ?4 end as tsq_v)) as atMost from exact_amount where price is not null order by id"`)
        const ids = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.price.notIn(['1.5' as Amount, '-0.25' as Amount]).or(tExactAmount.price.isNull()))
            .and(tExactAmount.price.notBetween('0.5' as Amount, '2000' as Amount).or(tExactAmount.price.isNull()))
            .selectOneColumn(tExactAmount.id)
            .orderBy('result')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where (price not in (?1, ?2) or price is null) and (not (decimal_cmp(price, ?3) >= 0 and decimal_cmp(price, ?4) <= 0) or price is null) order by result"`)
        expect(row).toEqual({ smallest: '8.75', largest: '1243.56', prices: '1235.81' })
        expect(rows).toEqual([{ id: 1, atLeast: '10.5', atMost: '9.5' }, { id: 2, atLeast: '9.5', atMost: '8.75' }, { id: 3, atLeast: '9.5', atMost: '9' }, { id: 5, atLeast: '1243.56', atMost: '9.5' }])
        expect(ids).toEqual([3, 4])
    })

    test('custom-decimal/equal-numbers-are-one-group-and-one-distinct-row', async () => {
        // 1.5 is the price of row 1, written with another scale
        ctx.mockNext(1)
        ctx.mockNext([{ price: '1.5', rows: 2 }])
        ctx.mockNext([{ price: '1.5' }])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tExactAmount).set({ id: 6, price: '1.5' as Amount }).executeInsert()
            const groups = await ctx.conn.selectFrom(tExactAmount)
                .where(tExactAmount.id.in([1, 6]))
                .select({ price: tExactAmount.price, rows: ctx.conn.countAll() })
                .groupBy('price')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select price as price, count(*) as rows from exact_amount where id in (?1, ?2) group by price"`)
            const distinct = await ctx.conn.selectDistinctFrom(tExactAmount)
                .where(tExactAmount.id.in([1, 6]))
                .select({ price: tExactAmount.price })
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select distinct price as price from exact_amount where id in (?1, ?2)"`)
            expect(groups.map(group => group.rows)).toEqual([2])
            expect(distinct.length).toBe(1)
            // The text shown is the one of one of the rows: SQLite keeps each text as it was written
            expect([groups[0]!.price, distinct[0]!.price]).toEqual(['1.5', '1.5'])
        })
    })

    test('custom-decimal/a-set-operation-and-is-compare-as-numbers', async () => {
        // 1.5 is the price of row 1, written with another scale; row 4 has no price
        ctx.mockNext(1)
        ctx.mockNext(['1.5'])
        ctx.mockNext(['1.5'])
        ctx.mockNext([])
        ctx.mockNext([1, 6])
        ctx.mockNext([4])
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tExactAmount).set({ id: 6, price: '1.5' as Amount }).executeInsert()
            const priceOf = (id: number) => ctx.conn.selectFrom(tExactAmount).where(tExactAmount.id.equals(id)).selectOneColumn(tExactAmount.price)
            const union = await priceOf(1).union(priceOf(6)).executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select price as result from exact_amount where id = ?1 union select price as result from exact_amount where id = ?2"`)
            const intersect = await priceOf(1).intersect(priceOf(6)).executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select price as result from exact_amount where id = ?1 intersect select price as result from exact_amount where id = ?2"`)
            const except = await priceOf(1).except(priceOf(6)).executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select price as result from exact_amount where id = ?1 except select price as result from exact_amount where id = ?2"`)
            const sameAs = await ctx.conn.selectFrom(tExactAmount)
                .where(tExactAmount.price.is('1.5' as Amount))
                .selectOneColumn(tExactAmount.id)
                .orderBy('result')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where price is ?1 order by result"`)
            const otherThan = await ctx.conn.selectFrom(tExactAmount)
                .where(tExactAmount.id.in([1, 4, 6]))
                .and(tExactAmount.price.isNot('1.5' as Amount))
                .selectOneColumn(tExactAmount.id)
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where id in (?1, ?2, ?3) and not price is ?4"`)
            assertType<Exact<typeof union, (Amount | null)[]>>()
            // The text shown is the one of one of the rows
            expect(union).toEqual(['1.5'])
            expect(intersect).toEqual(['1.5'])
            expect(except).toEqual([])
            expect(sameAs).toEqual([1, 6])
            expect(otherThan).toEqual([4])
        })
    })

    test('custom-decimal/a-column-added-by-a-customization-is-kept', async () => {
        // beforeColumns adds the column extra_id: the rows the database returns have it, next to the columns of the
        // select
        ctx.mockNext([{ price: '-0.25' }, { price: '1.5' }, { price: '1234.56' }])
        ctx.mockNext([{ price: '-0.25', extra_id: 2 }, { price: '1.5', extra_id: 1 }, { price: '1234.56', extra_id: 5 }])
        const rows = await ctx.conn.selectDistinctFrom(tExactAmount)
            .where(tExactAmount.id.in([1, 2, 5]))
            .select({ price: tExactAmount.price })
            .orderBy('price')
            .customizeQuery({ beforeColumns: ctx.conn.rawFragment`${tExactAmount.id} as extra_id, ` })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select distinct id as extra_id,  price as price from exact_amount where id in (?1, ?2, ?3) order by (case when price is null then null when price = '0' then 0 when substr(price, 1, 1) = '-' then -1 else 1 end) asc, (case when (case when price is null then null when price = '0' then 0 when substr(price, 1, 1) = '-' then -1 else 1 end) = 1 then (case when substr(ltrim(price, '-'), 1, 2) = '0.' then length(ltrim(substr(ltrim(price, '-'), 3), '0')) - length(substr(ltrim(price, '-'), 3)) else instr(ltrim(price, '-') || '.', '.') - 1 end) end) asc, (case when (case when price is null then null when price = '0' then 0 when substr(price, 1, 1) = '-' then -1 else 1 end) = -1 then (case when substr(ltrim(price, '-'), 1, 2) = '0.' then length(ltrim(substr(ltrim(price, '-'), 3), '0')) - length(substr(ltrim(price, '-'), 3)) else instr(ltrim(price, '-') || '.', '.') - 1 end) end) desc, (case when (case when price is null then null when price = '0' then 0 when substr(price, 1, 1) = '-' then -1 else 1 end) = 1 then ltrim(replace(ltrim(price, '-'), '.', ''), '0') end) asc, (case when (case when price is null then null when price = '0' then 0 when substr(price, 1, 1) = '-' then -1 else 1 end) = -1 then ltrim(replace(ltrim(price, '-'), '.', ''), '0') end) desc"`)
        assertType<Exact<typeof rows, { price?: Amount }[]>>()
        const databaseRows = await ctx.conn.queryRunner.executeSelectManyRows(ctx.lastSql, ctx.lastParams)
        const priceOf = (id: number) => ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.id.equals(id))
            .select({ price: tExactAmount.price })
            .customizeQuery({ beforeColumns: ctx.conn.rawFragment`${tExactAmount.id} as extra_id, ` })
        ctx.mockNext([{ price: '-0.25' }, { price: '1.5' }])
        ctx.mockNext([{ price: '-0.25', extra_id: 2 }, { price: '1.5', extra_id: 1 }])
        const compound = await priceOf(1).union(priceOf(2)).orderBy('price').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select * from (select id as extra_id,  price as price from exact_amount where id = ?1 union select id as extra_id,  price as price from exact_amount where id = ?2) as o_1_ order by (case when price is null then null when price = '0' then 0 when substr(price, 1, 1) = '-' then -1 else 1 end) asc, (case when (case when price is null then null when price = '0' then 0 when substr(price, 1, 1) = '-' then -1 else 1 end) = 1 then (case when substr(ltrim(price, '-'), 1, 2) = '0.' then length(ltrim(substr(ltrim(price, '-'), 3), '0')) - length(substr(ltrim(price, '-'), 3)) else instr(ltrim(price, '-') || '.', '.') - 1 end) end) asc, (case when (case when price is null then null when price = '0' then 0 when substr(price, 1, 1) = '-' then -1 else 1 end) = -1 then (case when substr(ltrim(price, '-'), 1, 2) = '0.' then length(ltrim(substr(ltrim(price, '-'), 3), '0')) - length(substr(ltrim(price, '-'), 3)) else instr(ltrim(price, '-') || '.', '.') - 1 end) end) desc, (case when (case when price is null then null when price = '0' then 0 when substr(price, 1, 1) = '-' then -1 else 1 end) = 1 then ltrim(replace(ltrim(price, '-'), '.', ''), '0') end) asc, (case when (case when price is null then null when price = '0' then 0 when substr(price, 1, 1) = '-' then -1 else 1 end) = -1 then ltrim(replace(ltrim(price, '-'), '.', ''), '0') end) desc"`)
        const compoundDatabaseRows = await ctx.conn.queryRunner.executeSelectManyRows(ctx.lastSql, ctx.lastParams)
        expect(rows).toEqual([{ price: '-0.25' }, { price: '1.5' }, { price: '1234.56' }])
        expect(databaseRows.map(row => [row.price, row.extra_id])).toEqual([['-0.25', 2], ['1.5', 1], ['1234.56', 5]])
        expect(compound).toEqual([{ price: '-0.25' }, { price: '1.5' }])
        expect(compoundDatabaseRows.map(row => [row.price, row.extra_id])).toEqual([['-0.25', 2], ['1.5', 1]])
    })

    test('custom-decimal/a-value-wider-than-the-decimals-of-the-database', async () => {
        // 65 digits before the point and one after, which the text and the functions of the decimal strategy keep
        const wide = '12345678901234567890123456789012345678901234567890123456789012345.5' as Amount
        ctx.mockNext(wide)
        ctx.mockNext('12345678901234567890123456789012345678901234567890123456789012346')
        ctx.mockNext(1)
        const outcomes: (Amount | number | TsSqlErrorReason | { reason: string, errorType: string | undefined } | undefined)[] = []
        await ctx.withRollback(async () => {
            for (const query of [
                () => ctx.conn.selectFromNoTable().selectOneColumn(ctx.conn.const(wide, 'customDecimal', 'Amount')).executeSelectOne(),
                () => ctx.conn.selectFromNoTable().selectOneColumn(ctx.conn.const(wide, 'customDecimal', 'Amount').add('0.5' as Amount)).executeSelectOne(),
                () => ctx.conn.insertInto(tExactAmount).set({ id: 6, amount: wide }).executeInsert(),
            ]) {
                try {
                    outcomes.push(await query())
                } catch (e) {
                    const reason = e instanceof TsSqlError ? e.errorReason : undefined
                    // An error of the database by its reason and its type
                    outcomes.push(reason && reason.reason.startsWith('SQL_') && 'errorType' in reason ? { reason: reason.reason, errorType: reason.errorType } : reason)
                }
            }
        })
        expect(outcomes).toEqual([wide, '12345678901234567890123456789012345678901234567890123456789012346', 1])
    })

    test('custom-decimal/abs-ceil-floor-round-and-modulo-keep-every-digit', async () => {
        ctx.mockNext([
            { id: 1, abs: '12345678901234567890.1234567891', ceil: '12345678901234567891', floor: '12345678901234567890', round: '12345678901234567890', roundn: '12345678901234567890.1235', modulo: '0.1234567891' },
            { id: 2, abs: '0.25', ceil: '0', floor: '-1', round: '0', roundn: '-0.25', modulo: '-0.25' },
        ])
        const rows = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.id.in([1, 2]))
            .select({
                id: tExactAmount.id,
                abs: tExactAmount.amount.abs(),
                ceil: tExactAmount.amount.ceil(),
                floor: tExactAmount.amount.floor(),
                round: tExactAmount.amount.round(),
                roundn: tExactAmount.amount.roundn(4),
                modulo: tExactAmount.amount.modulo('7.5' as Amount),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select (case when substr(amount, 1, 1) = '-' then substr(amount, 2) else amount end) as tsq_v)) as abs, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select tsq_decimal_ceil(amount) as tsq_v)) as ceil, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select tsq_decimal_floor(amount) as tsq_v)) as floor, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select tsq_decimal_round(amount, 0) as tsq_v)) as round, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select tsq_decimal_round(amount, ?1) as tsq_v)) as roundn, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select tsq_decimal_mod(amount, ?2) as tsq_v)) as modulo from exact_amount where id in (?3, ?4) order by id"`)
        assertType<Exact<typeof rows, { id: number; abs?: Amount; ceil?: Amount; floor?: Amount; round?: Amount; roundn?: Amount; modulo?: Amount }[]>>()
        expect(rows).toEqual([
            { id: 1, abs: '12345678901234567890.1234567891', ceil: '12345678901234567891', floor: '12345678901234567890', round: '12345678901234567890', roundn: '12345678901234567890.1235', modulo: '0.1234567891' },
            { id: 2, abs: '0.25', ceil: '0', floor: '-1', round: '0', roundn: '-0.25', modulo: '-0.25' },
        ])
    })

    test('custom-decimal/a-root-and-a-power-are-a-double', async () => {
        ctx.mockNext({ squared: 2.25, root: 1.224744871391589 })
        const row = await ctx.conn.selectFrom(tExactAmount)
            .where(tExactAmount.id.equals(1))
            .select({
                squared: tExactAmount.price.power(2),
                root: tExactAmount.price.sqrt(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select power(price, ?1) as squared, sqrt(price) as root from exact_amount where id = ?2"`)
        assertType<Exact<typeof row, { squared?: number; root?: number }>>()
        if (ctx.realDbEnabled) {
            expect(row.squared).toBeCloseTo(2.25, 12)
            expect(row.root).toBeCloseTo(1.224744871391589, 12)
        } else {
            expect(row).toEqual({ squared: 2.25, root: 1.224744871391589 })
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
            expect(row).toEqual({ amount: '-98765432109876543210.0000000001', price: '0.1' })
        })
    })

    test('custom-decimal/a-dynamic-condition-filters-with-a-custom-decimal-filter', async () => {
        ctx.mockNext([1])
        ctx.mockNext([1])
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where decimal_cmp(price, ?1) >= 0 and decimal_cmp(price, ?2) < 0 order by result"`)
        expect(dynamicIds).toEqual([1])
        expect(ids).toEqual([1])
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


    test('custom-decimal/a-value-from-the-database-that-is-not-a-plain-decimal-is-rejected', async () => {
        // A text with an exponent, and a number the driver already rounded to a JavaScript number
        ctx.mockNext({ value: '1e3' })
        ctx.mockNext({ value: 1.5 })
        let withExponent: unknown
        try {
            await ctx.conn.selectFromNoTable()
                .select({ value: ctx.conn.fragmentWithType<Amount, 'Amount'>('customDecimal', 'Amount', 'required').sql`'1e3'` })
                .executeSelectOne()
        } catch (e) {
            withExponent = e
        }
        let aNumber: unknown
        try {
            await ctx.conn.selectFromNoTable()
                .select({ value: ctx.conn.fragmentWithType<Amount, 'Amount'>('customDecimal', 'Amount', 'required').sql`1.5e0` })
                .executeSelectOne()
        } catch (e) {
            aNumber = e
        }
        expect(withExponent instanceof TsSqlError ? withExponent.errorReason : undefined).toEqual({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value: '1e3', typeName: 'Amount', columnPath: 'value' })
        expect(aNumber instanceof TsSqlError ? aNumber.errorReason : undefined).toEqual({ reason: 'PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE', value: 1.5, typeName: 'Amount', columnPath: 'value' })
    })
})
