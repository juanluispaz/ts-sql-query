// Per-connection coverage of SqliteConnection's `usePlatformDependentRound` flag.
// With the flag, the scale of `roundn` is sent and written as it is, and the
// database decides what a fractional one means: this database truncates it. Without it the
// library rounds the scale first, so `roundn(1.6)` is 2 decimals everywhere.
//
// A subclass of `DBConnection` flips the protected flag while sharing
// `ctx.conn`'s CaptureInterceptor, so the emitted SQL is captured in
// `ctx.lastSql` and runs against the real engine.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

class PlatformRoundConnection extends DBConnection {
    protected override usePlatformDependentRound = true
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('platform-round: roundn sends a fractional number scale as it is', async () => {
        // The scale 1.6 reaches the database as it is: the database truncates it to 1 decimal, so 2.345 gives 2.3.
        const conn = ctx.withConnection(PlatformRoundConnection)
        ctx.mockNext({ r: 2.3 })
        const row = await conn.selectFromNoTable()
            .select({ r: conn.const(2.345, 'double').roundn(1.6) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select round(?1, ?2) as r"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2.345,
            1.6,
          ]
        `)
        assertType<Exact<typeof row, { r: number }>>()
        expect(row.r).toBe(2.3)
    })

    test('platform-round: roundn writes a fractional expression scale as it is', async () => {
        // The scale 3.2 / 2 = 1.6 is written without rounding it: the database truncates it to 1 decimal, so
        // 2.345 gives 2.3.
        const conn = ctx.withConnection(PlatformRoundConnection)
        ctx.mockNext({ r: 2.3 })
        const row = await conn.selectFromNoTable()
            .select({ r: conn.const(2.345, 'double').roundn(conn.const(3.2, 'double').divide(2)) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select round(?1, ?2 / ?3) as r"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2.345,
            3.2,
            2,
          ]
        `)
        assertType<Exact<typeof row, { r: number }>>()
        expect(row.r).toBe(2.3)
    })
})
