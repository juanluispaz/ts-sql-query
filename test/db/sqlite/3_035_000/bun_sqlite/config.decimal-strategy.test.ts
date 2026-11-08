// The decimal strategies of SqliteConnection other than the default 'decimal-functions' (covered by
// select.custom-decimal). exact_amount.price holds 1.50, -0.25, 0.00, no price and 1234.56 in rows 1 to 5, as text.
//
//   - 'text': plain SQL. Equality compares the texts, a range and an order by compare the numbers the texts are in
//     floating point, and an arithmetic result is a floating point number, which the library rejects.
//   - 'decimal-extension': only the functions of SQLite's decimal extension (registered for this connector in
//     test/db/sqlite/runners.ts): arithmetic, sum and every comparison are exact; order by, min, max, group by and
//     distinct compare the texts.

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

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('decimal-strategy: text compares a range and orders as floating point numbers', async () => {
        const conn = ctx.withDecimalStrategy('text')
        ctx.mockNext([2, 3, 1, 5])
        const ids = await conn.selectFrom(tExactAmount)
            .where(tExactAmount.price.greaterThan('-1' as Amount))
            .selectOneColumn(tExactAmount.id)
            .orderBy(tExactAmount.price)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where cast(price as real) > cast(?1 as real) order by cast(exact_amount.price as real)"`)
        assertType<Exact<typeof ids, number[]>>()
        expect(ids).toEqual([2, 3, 1, 5])
    })

    test('decimal-strategy: text equality compares the texts', async () => {
        const conn = ctx.withDecimalStrategy('text')
        ctx.mockNext([])
        ctx.mockNext([1])
        // The price of row 1 is the text 1.50
        const otherScale = await conn.selectFrom(tExactAmount)
            .where(tExactAmount.price.equals('1.5' as Amount))
            .selectOneColumn(tExactAmount.id)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where price = ?1"`)
        const sameText = await conn.selectFrom(tExactAmount)
            .where(tExactAmount.price.equals('1.50' as Amount))
            .selectOneColumn(tExactAmount.id)
            .executeSelectMany()
        expect(otherScale).toEqual([])
        expect(sameText).toEqual([1])
    })

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
        // A column alone is read as it is
        ctx.mockNext('1.50')
        const price = await conn.selectFrom(tExactAmount).where(tExactAmount.id.equals(1)).selectOneColumn(tExactAmount.price).executeSelectOne()
        expect(price).toBe('1.50')
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

    test('decimal-strategy: decimal-extension orders and groups by the texts', async () => {
        const conn = ctx.withDecimalStrategy('decimal-extension')
        ctx.mockNext(1)
        ctx.mockNext([2, 3, 6, 1, 5])
        ctx.mockNext([{ price: '1.50', rows: 1 }, { price: '1.5', rows: 1 }])
        await ctx.withRollback(async () => {
            await conn.insertInto(tExactAmount).set({ id: 6, price: '1.5' as Amount }).executeInsert()
            const ids = await conn.selectFrom(tExactAmount)
                .where(tExactAmount.price.isNotNull())
                .selectOneColumn(tExactAmount.id)
                .orderBy(tExactAmount.price)
                .orderBy(tExactAmount.id)
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from exact_amount where price is not null order by exact_amount.price, exact_amount.id"`)
            const groups = await conn.selectFrom(tExactAmount)
                .where(tExactAmount.id.in([1, 6]))
                .select({ price: tExactAmount.price, rows: conn.countAll() })
                .groupBy('price')
                .orderBy('price', 'desc')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select price as price, count(*) as "rows" from exact_amount where id in (?1, ?2) group by price order by price desc"`)
            // The texts in byte order: 1.5 is before 1.50, and 1.50 before 1234.56, as numbers too
            expect(ids).toEqual([2, 3, 6, 1, 5])
            // 1.50 and 1.5 are two groups: they are different texts
            expect(groups).toEqual([{ price: '1.50', rows: 1 }, { price: '1.5', rows: 1 }])
        })
    })
})
