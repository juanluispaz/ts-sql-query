// UPDATE / DELETE crossed with the custom and provided-primary-key columns: an
// `update(tProjectRelease).set({...})` with a VALUE-SOURCE right-hand side on a
// custom column (the `UpdateSets -> InputTypeOfColumnAllowing` branch), and a
// provided-primary-key `update(tCountry)` / `deleteFrom(tCountry)` keyed on the
// string PK `code`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tCountry, tIssueWorklog, tProjectRelease, tProjectReview, tReleaseDraft } from '../../domain/connection.js'
import type { ReleaseChannel } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('update-project-release-custom-column-with-value-source-rhs', async () => {
        // The RHS is a VALUE SOURCE (`const(...)`), not a plain value, so the
        // assignment routes through the `InputTypeOfColumnAllowing` branch of
        // `UpdateSets` for the customComparable `version` column. Release 1's
        // version is set to '1.2.1'.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const updated = await ctx.conn.update(tProjectRelease)
                .set({ version: ctx.conn.const('1.2.1', 'customComparable', 'Semver') })
                .where(tProjectRelease.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project_release set version = :0 where id = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "1.2.1",
                1,
              ]
            `)
            assertType<Exact<typeof updated, number>>()
            expect(updated).toBe(1)
        })
    })


    test('update-release-draft-optional-custom-column-with-value-source-rhs', async () => {
        // SET an optional column (`minVersion`, an optional customComparable) from a
        // value source rather than a plain value. Draft 1's min_version is set from
        // itself, so `set min_version = min_version` is a valid no-op that touches one row.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const updated = await ctx.conn.update(tReleaseDraft)
                .set({ minVersion: tReleaseDraft.minVersion })
                .where(tReleaseDraft.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update release_draft set min_version = min_version where id = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof updated, number>>()
            expect(updated).toBe(1)
        })
    })

    test('update-project-release-returning-branded-custom-column', async () => {
        // `returningOneColumn(...)` preserves the column's branded value type,
        // so reading `channel` back through RETURNING yields `ReleaseChannel`,
        // not a widened `string`. `channel` is used rather than `version`
        // because `Semver` collapses to `string` structurally.
        await ctx.withRollback(async () => {
            ctx.mockNext('beta')
            const channel = await ctx.conn.update(tProjectRelease)
                .set({ channel: 'beta' })
                .where(tProjectRelease.id.equals(1))
                .returningOneColumn(tProjectRelease.channel)
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project_release set channel = :0 where id = :1 returning channel into :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "beta",
                1,
                {
                  "as": "result",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof channel, ReleaseChannel>>()
            expect(channel).toBe('beta')
        })
    })

    test('update-worklog-returning-adapter-virtual-column', async () => {
        // `.returning(...)` of an adapter column: `activityTagged` is a virtual
        // column carrying a non-identity TypeAdapter that brackets the read
        // value, so reading it back through RETURNING applies
        // `transformValueFromDB` through the adapter. The mock is primed with
        // the RAW db value; the adapter brackets it on the way out. Worklog 1:
        // upper(activity) = 'CODING' -> '[CODING]'.
        await ctx.withRollback(async () => {
            ctx.mockNext('CODING')
            const tagged = await ctx.conn.update(tIssueWorklog)
                .set({ minutes: 95 })
                .where(tIssueWorklog.id.equals(1))
                .returningOneColumn(tIssueWorklog.activityTagged)
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue_worklog set minutes = :0 where id = :1 returning upper(activity) into :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                95,
                1,
                {
                  "as": "result",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof tagged, string>>()
            expect(tagged).toBe('[CODING]')
        })
    })

    test('update-country-keyed-on-string-provided-primary-key', async () => {
        // An UPDATE whose WHERE is the provided string primary key
        // `tCountry.code` (no autogeneration). Exactly one row matches.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const updated = await ctx.conn.update(tCountry)
                .set({ name: 'United States of America' })
                .where(tCountry.code.equals('US'))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update country set name = :0 where code = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "United States of America",
                "US",
              ]
            `)
            assertType<Exact<typeof updated, number>>()
            expect(updated).toBe(1)
        })
    })

    test('delete-country-keyed-on-string-provided-primary-key', async () => {
        // A DELETE whose WHERE is the provided string primary key
        // `tCountry.code`. Exactly one row matches.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const deleted = await ctx.conn.deleteFrom(tCountry)
                .where(tCountry.code.equals('JP'))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from country where code = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "JP",
              ]
            `)
            assertType<Exact<typeof deleted, number>>()
            expect(deleted).toBe(1)
        })
    })
    test('update-project-review-scales-non-boolean-adapter-column', async () => {
        // The non-boolean scaledTenthAdapter on `score` marshals on the UPDATE
        // write path: set({ score: 9.2 }) binds the scaled param 92, and
        // reviewerCode's bracketAdapter passes through unchanged on write.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const updated = await ctx.conn.update(tProjectReview)
                .set({ score: 9.2, reviewerCode: 'R-X' })
                .where(tProjectReview.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project_review set score = :0, reviewer_code = :1 where id = :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                92,
                "R-X",
                1,
              ]
            `)
            assertType<Exact<typeof updated, number>>()
            expect(updated).toBe(1)
        })
    })

    test('update-worklog-invoiced-literal-binds-numeric-boolean', async () => {
        // A plain-literal write to the numeric CustomBooleanTypeAdapter column:
        // set({ invoiced: true }) binds the boolean param inside
        // `case when ... then 1 else 0 end`. costCents (Cents -> int) and
        // billedAmount (Money -> double) literals marshal through baseTypeForCustom.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const updated = await ctx.conn.update(tIssueWorklog)
                .set({ invoiced: true, costCents: 999, billedAmount: 42.5 })
                .where(tIssueWorklog.id.equals(2))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue_worklog set invoiced = case when (:0 = 1) then 1 else 0 end, cost_cents = :1, billed_amount = :2 where id = :3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                999,
                42.5,
                2,
              ]
            `)
            assertType<Exact<typeof updated, number>>()
            expect(updated).toBe(1)
        })
    })


    test('write-through value-transforming adapters shift the bound param and round-trip on read', async () => {
        // shiftedStamp (customLocalDateTime + shiftHourAdapter, write -1h) and
        // shiftedCount (bigint + plusThousandBigintAdapter, write -1000n): an UPDATE
        // routes each value through the adapter's write transform, binding
        // `value - offset`; reading the column back applies the
        // read transform (`+ offset`), round-tripping to the original value.
        await ctx.withRollback(async () => {
            const stamp = new Date(Date.UTC(2025, 0, 15, 12, 0, 0))
            const count = 8000n
            ctx.mockNext(1)
            const affected = await ctx.conn.update(tReleaseDraft)
                .set({ shiftedStamp: stamp, shiftedCount: count })
                .where(tReleaseDraft.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update release_draft set shifted_stamp = :0, shifted_count = :1 where id = :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2025-01-15T11:00:00.000Z,
                7000n,
                1,
              ]
            `)
            if (!ctx.realDbEnabled) expect(affected).toBe(1)

            ctx.mockNext({ stamp: new Date(Date.UTC(2025, 0, 15, 11, 0, 0)), count: 7000n })
            const row = await ctx.conn.selectFrom(tReleaseDraft)
                .where(tReleaseDraft.id.equals(1))
                .select({ stamp: tReleaseDraft.shiftedStamp, count: tReleaseDraft.shiftedCount })
                .executeSelectOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select shifted_stamp as "stamp", shifted_count as "count" from release_draft where id = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, { stamp: Date; count: bigint }>>()
            // The read adapters undo the write shift: stamp back to +1h, count +1000n.
            expect(row.stamp).toEqual(stamp)
            expect(row.count).toBe(count)
        })
    })

    test('write-through custom-kind-then-adapter columns scale/shift the bound param and round-trip on read', async () => {
        // scaledCost (customInt 'Cents' + scaledTenthAdapter, write x10) and
        // shiftedAmount (customDouble 'Money' + plusOffsetAdapter, write -1000):
        // an UPDATE marshals the value through the custom kind and then the
        // adapter's WRITE transform, so `set({ scaledCost: 1, shiftedAmount: 5 })`
        // binds `10` and `-995`. Every other adapter-write test pins the adapter
        // on a PLAIN int/double column; this is the one custom-kind-marshal-THEN-
        // adapter write. Reading back applies the read transforms (/10, +1000),
        // round-tripping to the original 1 and 5.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const affected = await ctx.conn.update(tReleaseDraft)
                .set({ scaledCost: 1, shiftedAmount: 5 })
                .where(tReleaseDraft.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update release_draft set scaled_cost = :0, shifted_amount = :1 where id = :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                10,
                -995,
                1,
              ]
            `)
            if (!ctx.realDbEnabled) expect(affected).toBe(1)

            ctx.mockNext({ cost: 10, amount: -995 })
            const row = await ctx.conn.selectFrom(tReleaseDraft)
                .where(tReleaseDraft.id.equals(1))
                .select({ cost: tReleaseDraft.scaledCost, amount: tReleaseDraft.shiftedAmount })
                .executeSelectOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select scaled_cost as "cost", shifted_amount as "amount" from release_draft where id = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, { cost: number; amount: number }>>()
            // The read adapters undo the write transforms: cost /10, amount +1000.
            expect(row.cost).toBe(1)
            expect(row.amount).toBe(5)
        })
    })
})
