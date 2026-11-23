// Documentation snippets for the Data types page (docs/configuration/data-types.md), section Exact decimals.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { DecimalsType, type Dnum, scaledBigInt, type ScaledBigInt } from '../../../../../src/exports/v2/index.js'

// An exact decimal of the user
abstract class AmountType extends DecimalsType<string, 'Amount'> { static override readonly type = 'Amount' }

const tExactAmount = new class TExactAmount extends Table<DBConnection, 'TExactAmount'> {
    id = this.primaryKey('id', 'int')
    amount = this.optionalColumn('amount', AmountType)
    price = this.optionalColumn('price', AmountType)
    constructor() {
        super('exact_amount')
    }
}()

const tDnumAmount = new class TDnumAmount extends Table<DBConnection, 'TDnumAmount'> {
    id = this.primaryKey('id', 'int')
    amount = this.optionalColumn('amount', 'dnumDecimal')
    price = this.optionalColumn('price', 'dnumDecimal')
    constructor() {
        super('exact_amount')
    }
}()

const tScaledAmount = new class TScaledAmount extends Table<DBConnection, 'TScaledAmount'> {
    id = this.primaryKey('id', 'int')
    price = this.optionalColumn('price', 'ScaledBigInt<2>')
    constructor() {
        super('exact_amount')
    }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:data-types/exact-decimals', async () => {
        ctx.mockNext([
            { id: 1, amount: '12345678901234567890.1234567891', next: '12345678901234567890.1234567892' },
            { id: 5, amount: '98765432109876543210.9876543210', next: '98765432109876543210.9876543211' },
        ])
        const connection = ctx.conn
        // doc-start
        const rows = await connection.selectFrom(tExactAmount)
            .where(tExactAmount.price.greaterThan('1'))
            .select({
                id: tExactAmount.id,
                amount: tExactAmount.amount,
                next: tExactAmount.amount.add('0.0000000001') })
            .orderBy('id')
            .executeSelectMany()
        // doc-end
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", amount as "amount", amount + :0 as "next" from exact_amount where price > :1 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0.0000000001",
            "1",
          ]
        `)
        assertType<Exact<typeof rows, { id: number; amount?: string; next?: string }[]>>()
        expect(rows).toEqual([
            { id: 1, amount: '12345678901234567890.1234567891', next: '12345678901234567890.1234567892' },
            { id: 5, amount: '98765432109876543210.9876543210', next: '98765432109876543210.9876543211' },
        ])
    })

    test('docs:data-types/the-decimals-of-a-value-read', async () => {
        ctx.mockNext([
            { id: 1, price: '1.50', twice: '3' },
            { id: 5, price: '1234.56', twice: '2469.12' },
        ])
        const connection = ctx.conn
        // doc-start
        const rows = await connection.selectFrom(tDnumAmount)
            .where(tDnumAmount.price.greaterOrEqual([15n, 1]))
            .select({
                id: tDnumAmount.id,
                price: tDnumAmount.price,
                twice: tDnumAmount.price.multiply([2n, 0]) })
            .orderBy('id')
            .executeSelectMany()
        // doc-end
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", price as "price", price * :0 as "twice" from exact_amount where price >= :1 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2",
            "1.5",
          ]
        `)
        assertType<Exact<typeof rows, { id: number; price?: Dnum; twice?: Dnum }[]>>()
        expect(rows).toEqual([
            // Oracle doesn't keep the scale of a computed number: it has the decimals it needs
            { id: 1, price: [150n, 2], twice: [3n, 0] },
            { id: 5, price: [123456n, 2], twice: [246912n, 2] },
        ])
    })

    test('docs:data-types/scaled-bigints', async () => {
        ctx.mockNext([
            { id: 1, price: '1.50', next: '1.51' },
            { id: 5, price: '1234.56', next: '1234.57' },
        ])
        const connection = ctx.conn
        // doc-start
        const rows = await connection.selectFrom(tScaledAmount)
            .where(tScaledAmount.price.greaterOrEqual(scaledBigInt(150n, 2)))
            .select({
                id: tScaledAmount.id,
                price: tScaledAmount.price,
                next: tScaledAmount.price.add(scaledBigInt(1n, 2)) })
            .orderBy('id')
            .executeSelectMany()
        // doc-end
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", price as "price", price + :0 as "next" from exact_amount where price >= :1 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0.01",
            "1.50",
          ]
        `)
        assertType<Exact<typeof rows, { id: number; price?: ScaledBigInt<2>; next?: ScaledBigInt<2> }[]>>()
        expect(rows).toEqual([
            { id: 1, price: 150n, next: 151n },
            { id: 5, price: 123456n, next: 123457n },
        ])
    })
})
