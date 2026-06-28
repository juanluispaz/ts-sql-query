// Per-connection coverage of AbstractConnection's `allowEmptyString` flag.
//
// The flag defaults to `false`, in which arm an empty string is treated as
// "no value" by three guards: `transformValueToDB` collapses `'' -> null`
// while building a param, `transformValueFromDB` collapses `'' -> null`
// while reading a column, and the SqlBuilder's `_isValue` guard (behind
// `setIfValue`) treats `''` as absent so the entry is dropped. This file
// covers the `true` arm, where all three guards step aside and `''` is sent,
// stored and read back verbatim.
//
// A subclass of `DBConnection` flips the protected flag while sharing
// `ctx.conn`'s underlying CaptureInterceptor, so the emitted SQL is
// captured in `ctx.lastSql` and runs against the real engine.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { DBConnection, tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

class EmptyStringConnection extends DBConnection {
    protected override allowEmptyString = true
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('allow-empty-string: setIfValue keeps an empty string and round-trips it verbatim', async () => {
        // With the flag on, `setIfValue({ plan: '' })` is NOT dropped: `''`
        // counts as a value, so `plan` is emitted in the INSERT with the
        // empty string sent verbatim as a param (not collapsed to null).
        // Reading the column back returns `''` rather than null.
        const conn = new EmptyStringConnection(ctx.conn.queryRunner)
        await ctx.withRollback(async () => {
            ctx.mockNext(42)
            const id = await conn.insertInto(tOrganization)
                .set({ name: 'Initech', plan: 'free' })
                .setIfValue({ plan: '' })
                .returningLastInsertedId()
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Initech",
                "",
              ]
            `)
            assertType<Exact<typeof id, number>>()

            ctx.mockNext({ plan: '' })
            const row = await conn.selectFrom(tOrganization)
                .where(tOrganization.id.equals(id))
                .select({ plan: tOrganization.plan })
                .executeSelectOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select plan as plan from organization where id = $1"`)
            assertType<Exact<typeof row, { plan: string }>>()
            expect(row).toEqual({ plan: '' })
        })
    })

    test('allow-empty-string: default connection drops the empty string (contrast)', async () => {
        // Same INSERT through the default `ctx.conn` (flag `false`):
        // `setIfValue({ plan: '' })` is treated as no value, so the override
        // is dropped and the original `plan: 'free'` survives.
        await ctx.withRollback(async () => {
            ctx.mockNext(42)
            const id = await ctx.conn.insertInto(tOrganization)
                .set({ name: 'Initech', plan: 'free' })
                .setIfValue({ plan: '' })
                .returningLastInsertedId()
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Initech",
                "free",
              ]
            `)
            assertType<Exact<typeof id, number>>()
        })
    })
})
