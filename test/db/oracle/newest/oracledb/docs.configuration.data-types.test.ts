// Documentation snippets for the Data types page (docs/configuration/data-types.md), section Exact decimals.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { DecimalsType } from '../../../../../src/exports/v2/index.js'

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

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:data-types/exact-decimals', async () => {
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
            { id: 5, amount: '98765432109876543210.987654321', next: '98765432109876543210.9876543211' },
        ])
    })
})
