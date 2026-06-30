// tInvoice's caller-provided int primary key carries a trailing TypeAdapter
// (scaledTenthAdapter): invoice_no is stored x10 and read /10. This pins the
// PK-factory's trailing-adapter overload on both the write path (insert value /
// WHERE operand) and the read path. The seed stores invoice_no = 100, i.e.
// logical invoice 10, total 500.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tInvoice } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('select-by-adapter-scaled-provided-primary-key-round-trips', async () => {
        // The WHERE operand on the adapter PK scales (logical 10 -> stored 100),
        // and the read path unscales the value back (100 -> logical 10). total
        // has no adapter and passes through.
        const expected = { invoiceNo: 10, total: 500 }
        ctx.mockNext({ invoiceNo: 100, total: 500 })
        const row = await ctx.conn.selectFrom(tInvoice)
            .where(tInvoice.invoiceNo.equals(10))
            .select({ invoiceNo: tInvoice.invoiceNo, total: tInvoice.total })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select invoice_no as invoiceNo, total as total from invoice where invoice_no = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof row, { invoiceNo: number; total: number }>>()
        expect(row).toEqual(expected)
    })

    test('insert-scales-the-adapter-provided-primary-key', async () => {
        // The provided PK value marshals through the adapter on insert: logical
        // invoiceNo 30 binds the scaled param 300; total passes through.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const affected = await ctx.conn.insertInto(tInvoice)
                .values({ invoiceNo: 30, total: 750 })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into invoice (invoice_no, total) values (@0, @1)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                300,
                750,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) {
                expect(typeof affected).toBe('number')
                // The stored invoice_no is 300; reading it back through the
                // adapter resolves the row by logical invoiceNo 30.
                const back = await ctx.conn.selectFrom(tInvoice)
                    .where(tInvoice.invoiceNo.equals(30))
                    .selectOneColumn(tInvoice.total)
                    .executeSelectOne()
                expect(back).toBe(750)
            } else {
                expect(affected).toBe(1)
            }
        })
    })
})
