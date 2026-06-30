// UPDATE / DELETE crossed with the custom and provided-primary-key columns: an
// `update(tProjectRelease).set({...})` with a VALUE-SOURCE right-hand side on a
// custom column (the `UpdateSets -> InputTypeOfColumnAllowing` branch), and a
// provided-primary-key `update(tCountry)` / `deleteFrom(tCountry)` keyed on the
// string PK `code`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tCountry, tIssueWorklog, tProjectRelease, tProjectReview } from '../../domain/connection.js'
import { ctx } from './setup.js'

// tIssueWorklog is referenced only by the commented-out test below.
void tIssueWorklog

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project_release set version = ? where id = ?"`)
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

    // NOT-APPLICABLE: MySQL has no RETURNING
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof channel, ReleaseChannel>>()
            expect(channel).toBe('beta')
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof tagged, string>>()
            expect(tagged).toBe('[CODING]')
        })
    })
    */

    test('update-country-keyed-on-string-provided-primary-key', async () => {
        // An UPDATE whose WHERE is the provided string primary key
        // `tCountry.code` (no autogeneration). Exactly one row matches.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const updated = await ctx.conn.update(tCountry)
                .set({ name: 'United States of America' })
                .where(tCountry.code.equals('US'))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update country set \`name\` = ? where \`code\` = ?"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from country where \`code\` = ?"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project_review set score = ?, reviewer_code = ? where id = ?"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue_worklog set invoiced = case when ? then 1 else 0 end, cost_cents = ?, billed_amount = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                true,
                999,
                42.5,
                2,
              ]
            `)
            assertType<Exact<typeof updated, number>>()
            expect(updated).toBe(1)
        })
    })

})
