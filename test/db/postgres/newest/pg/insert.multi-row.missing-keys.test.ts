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

    test('dynamic-values-keep-only-reopens-a-supplied-required-key-then-set-for-all-executes', async () => {
        // The ADDITIVE (reopening) arm of MISSING_KEYS: unlike the tests above where
        // `plan` was never supplied, here every row SUPPLIES the required `plan`, so
        // it starts CLEARED. `keepOnly('name')` prunes `plan` back out of the row set,
        // REOPENING it into the missing set (the builder type again demands it and
        // hides `executeInsert`), so a following `setForAll({ plan })` must re-supply
        // it before the insert executes. The per-row 'free'/'pro' are dropped; the
        // shared 'enterprise' from setForAll lands in the (name, plan) column list.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .dynamicValues([
                    { name: 'Mk-RA', plan: 'free' },
                    { name: 'Mk-RB', plan: 'pro' },
                ])
                .keepOnly('name')
                .setForAll({ plan: 'enterprise' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2), ($3, $4)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mk-RA",
                "enterprise",
                "Mk-RB",
                "enterprise",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('dynamic-values-ignore-if-set-reopens-a-supplied-required-key-then-set-for-all-executes', async () => {
        // The reopening arm via `ignoreIfSet`: every row SUPPLIES `plan` (so it starts
        // cleared), then `ignoreIfSet('plan')` drops it where set — REOPENING the
        // required `plan` into the missing set — and `setForAll({ plan })` re-supplies
        // it. The per-row values are dropped; the shared 'enterprise' is emitted.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .dynamicValues([
                    { name: 'Mk-RC', plan: 'free' },
                    { name: 'Mk-RD', plan: 'pro' },
                ])
                .ignoreIfSet('plan')
                .setForAll({ plan: 'enterprise' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2), ($3, $4)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mk-RC",
                "enterprise",
                "Mk-RD",
                "enterprise",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    // Shaped multi-row missing-keys: `shapedAs({...}).dynamicValues([partial rows])`
    // renames the row keys, so the missing set is tracked under the SHAPED key names.
    // Every partial row omits the shaped `orgPlan` key (→ real column `plan`), so the
    // missing set starts as `orgPlan`; each fold clears/narrows it via the shaped key.
    // The shape maps back to the real columns, so the emitted column list uses them.

    test('shaped-dynamic-values-set-for-all-clears-missing-key-then-executes', async () => {
        // Shaped `setForAll({ orgPlan })` supplies the missing shaped key for every
        // row, clearing it so the shaped multi-row insert becomes executable.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .shapedAs({ orgName: 'name', orgPlan: 'plan' })
                .dynamicValues([
                    { orgName: 'Mk-SA' },
                    { orgName: 'Mk-SB' },
                ])
                .setForAll({ orgPlan: 'free' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2), ($3, $4)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mk-SA",
                "free",
                "Mk-SB",
                "free",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-dynamic-values-disallow-if-no-value-narrows-missing-key-then-executes', async () => {
        // Shaped `setForAllIfValue({ orgPlan })` with an optional-typed value does not
        // narrow the shaped missing set; the unconditional shaped
        // `disallowIfNoValue(..., 'orgPlan')` narrows the shaped key out (sound —
        // throws eagerly when the column has no value) and here a value IS supplied.
        const plan: string | undefined = 'pro'
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .shapedAs({ orgName: 'name', orgPlan: 'plan' })
                .dynamicValues([
                    { orgName: 'Mk-SC' },
                    { orgName: 'Mk-SD' },
                ])
                .setForAllIfValue({ orgPlan: plan })
                .disallowIfNoValue('plan must have a value', 'orgPlan')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2), ($3, $4)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mk-SC",
                "pro",
                "Mk-SD",
                "pro",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-dynamic-values-keep-only-prunes-a-staged-optional-then-set-for-all-executes', async () => {
        // Shaped `keepOnly('orgName', 'orgPlan')` prunes the staged optional shaped
        // `orgVerified` (→ verified) from every row (`orgPlan` still missing); shaped
        // `setForAll({ orgPlan })` then supplies it. Emitted column list is (name, plan).
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .shapedAs({ orgName: 'name', orgPlan: 'plan', orgVerified: 'verified' })
                .dynamicValues([
                    { orgName: 'Mk-SE', orgVerified: true },
                    { orgName: 'Mk-SF', orgVerified: false },
                ])
                .keepOnly('orgName', 'orgPlan')
                .setForAll({ orgPlan: 'free' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2), ($3, $4)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mk-SE",
                "free",
                "Mk-SF",
                "free",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-dynamic-values-ignore-if-set-drops-a-staged-optional-then-set-for-all-executes', async () => {
        // Shaped `ignoreIfSet('orgVerified')` drops the staged optional shaped key from
        // every row where it is set (`orgPlan` still missing); shaped
        // `setForAll({ orgPlan })` supplies it. Emitted column list is (name, plan).
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .shapedAs({ orgName: 'name', orgPlan: 'plan', orgVerified: 'verified' })
                .dynamicValues([
                    { orgName: 'Mk-SG', orgVerified: true },
                    { orgName: 'Mk-SH', orgVerified: false },
                ])
                .ignoreIfSet('orgVerified')
                .setForAll({ orgPlan: 'free' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2), ($3, $4)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mk-SG",
                "free",
                "Mk-SH",
                "free",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })
})
