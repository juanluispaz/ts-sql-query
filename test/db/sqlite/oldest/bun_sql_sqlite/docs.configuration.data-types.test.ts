// Documentation snippets for the Data types page (docs/configuration/data-types.md), sections Types of the user and
// Exact decimals.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { DecimalsType, EqualableType, IntegersType } from '../../../../../src/exports/v2/index.js'

// The data types of the values of the user, each one a class of the family of its values
abstract class AmountType extends DecimalsType<string, 'Amount'> { static override readonly type = 'Amount' }
abstract class UnitsType extends IntegersType<Units, 'Units'> { static override readonly type = 'Units' }
abstract class TagType extends EqualableType<string, 'Tag'> { static override readonly type = 'Tag' }

type Units = number & { readonly __brand: 'Units' }

const tExactAmount = new class TExactAmount extends Table<DBConnection, 'TExactAmount'> {
    id = this.primaryKey('id', 'int')
    amount = this.optionalColumn('amount', AmountType)
    price = this.optionalColumn('price', AmountType)
    constructor() {
        super('exact_amount')
    }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:data-types/own-type-converted-as-its-category', async () => {
        // The SQL gives both values as text: the IntegersType is converted as an int, the custom arrives as it comes
        ctx.mockNext({ units: '42', tag: '42' })
        const row = await ctx.conn.selectFromNoTable()
            .select({
                units: ctx.conn.fragmentWithType(UnitsType, 'required').sql`'42'`,
                tag: ctx.conn.fragmentWithType(TagType, 'required').sql`'42'`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select '42' as units, '42' as tag"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { units: Units; tag: string }>>()
        expect(row).toEqual({ units: 42, tag: '42' })
    })

    test('docs:data-types/exact-decimals', async () => {
        // MOCK-ONLY: Bun SQL's SQLite can't register functions, and the decimal strategy 'decimal-functions' writes
        // decimal_add and decimal_cmp
        ctx.mockOnlyConnection()
        ctx.mockNext([
            { id: 1, amount: '12345678901234567890.1234567891', next: '12345678901234567890.1234567892' },
            { id: 5, amount: '98765432109876543210.987654321', next: '98765432109876543210.9876543211' },
        ])
        const connection = ctx.conn
        // doc-start
        const rows = await connection.selectFrom(tExactAmount)
            .where(tExactAmount.price.greaterThan('1'))
            .select({
                id: tExactAmount.id,
                amount: tExactAmount.amount,
                next: tExactAmount.amount.add('0.0000000001'),
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, amount as amount, (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when amount is null then null else decimal_add(amount, ?1) end as tsq_v)) as next from exact_amount where decimal_cmp(price, ?2) > 0 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0.0000000001",
            "1",
          ]
        `)
        assertType<Exact<typeof rows, { id: number; amount?: string; next?: string }[]>>()
        expect(rows).toEqual([
            { id: 1, amount: '12345678901234567890.1234567891', next: '12345678901234567890.1234567892' },
            { id: 5, amount: '98765432109876543210.987654321', next: '98765432109876543210.9876543211' },
        ])
    })
})
