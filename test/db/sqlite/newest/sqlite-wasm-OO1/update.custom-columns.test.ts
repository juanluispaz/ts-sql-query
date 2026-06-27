// UPDATE / DELETE crossed with the custom and provided-primary-key columns: an
// `update(tProjectRelease).set({...})` with a VALUE-SOURCE right-hand side on a
// custom column (the `UpdateSets -> InputTypeOfColumnAllowing` branch), and a
// provided-primary-key `update(tCountry)` / `deleteFrom(tCountry)` keyed on the
// string PK `code`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tCountry, tProjectRelease } from '../../domain/connection.js'
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project_release set channel = ? where id = ? returning channel as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "beta",
                1,
              ]
            `)
            assertType<Exact<typeof channel, ReleaseChannel>>()
            expect(channel).toBe('beta')
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update country set name = ? where code = ?"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from country where code = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "JP",
              ]
            `)
            assertType<Exact<typeof deleted, number>>()
            expect(deleted).toBe(1)
        })
    })
})
