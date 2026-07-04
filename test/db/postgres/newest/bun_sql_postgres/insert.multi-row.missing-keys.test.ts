// Multi-row MISSING_KEYS folding: `dynamicValues([partial rows])` opens the
// insert with a required column absent from the row objects, so it is tracked
// as missing until a fold supplies / narrows it:
//   - `setForAll({...})` supplies the missing column for every row → clears it.
//   - `disallowIfNoValue(msg, col)` narrows the column out of the missing set
//     (sound because it throws eagerly when the column has no value; here the
//     value IS staged, so no throw fires).
//   - `keepOnly(...)` / `ignoreIfSet(...)` prune writable columns but never
//     clear a required one, so a following `setForAll` supplies the still-missing
//     column before the insert executes.
//
// tOrganization requires (name, plan); every partial row below omits `plan`, so
// the missing set starts as `'plan'`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('dynamic-values-set-for-all-clears-missing-key-then-executes', async () => {
        // `setForAll({ plan })` supplies the missing `plan` for every row, clearing
        // it from the missing set so the multi-row insert becomes executable. Both
        // rows insert with the shared plan value.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .dynamicValues([
                    { name: 'Mk-A' },
                    { name: 'Mk-B' },
                ])
                .setForAll({ plan: 'free' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2), ($3, $4)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mk-A",
                "free",
                "Mk-B",
                "free",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('dynamic-values-disallow-if-no-value-narrows-missing-key-then-executes', async () => {
        // `plan` is staged for every row through `setForAllIfValue({ plan })` with
        // an optional-typed value, which does NOT narrow the missing set (the value
        // could be undefined at the type level). The unconditional
        // `disallowIfNoValue(..., 'plan')` narrows `plan` out of the missing set —
        // sound because it throws eagerly when the column has no value — and here a
        // value ('pro') IS supplied, so no throw fires and the insert executes.
        const plan: string | undefined = 'pro'
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .dynamicValues([
                    { name: 'Mk-C' },
                    { name: 'Mk-D' },
                ])
                .setForAllIfValue({ plan })
                .disallowIfNoValue('plan must have a value', 'plan')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2), ($3, $4)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mk-C",
                "pro",
                "Mk-D",
                "pro",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('dynamic-values-keep-only-prunes-a-staged-optional-then-set-for-all-executes', async () => {
        // `keepOnly('name', 'plan')` prunes the staged optional `verified` from every
        // row (`plan` is still missing), and `setForAll({ plan })` then supplies `plan`
        // so the insert executes. The emitted column list is (name, plan) — `verified`
        // was pruned away.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .dynamicValues([
                    { name: 'Mk-E', verified: true },
                    { name: 'Mk-F', verified: false },
                ])
                .keepOnly('name', 'plan')
                .setForAll({ plan: 'free' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2), ($3, $4)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mk-E",
                "free",
                "Mk-F",
                "free",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('dynamic-values-ignore-if-set-drops-a-staged-optional-then-set-for-all-executes', async () => {
        // `ignoreIfSet('verified')` drops the staged optional `verified` from every row
        // where it is set (`plan` is still missing — `verified` is not required), and
        // `setForAll({ plan })` then supplies `plan` so the insert executes. The emitted
        // column list is (name, plan).
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .dynamicValues([
                    { name: 'Mk-G', verified: true },
                    { name: 'Mk-H', verified: false },
                ])
                .ignoreIfSet('verified')
                .setForAll({ plan: 'free' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2), ($3, $4)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mk-G",
                "free",
                "Mk-H",
                "free",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })
})
