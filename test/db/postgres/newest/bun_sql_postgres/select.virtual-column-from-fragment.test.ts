// Coverage of the per-class `optionalVirtualColumnFromFragment` overload on a
// Table and on a View, plus the trailing `TypeAdapter` argument on
// `virtualColumnFromFragment`. The required `virtualColumnFromFragment` form
// (no adapter) is already exercised by versionTag / versionUpper; this file
// adds:
//
//   - `tIssueWorklog.activityUpper`  — optionalVirtualColumnFromFragment on a
//     Table (projects as an optional `string` leaf).
//   - `tIssueWorklog.activityTagged` — virtualColumnFromFragment WITH a trailing
//     TypeAdapter (`bracketAdapter`, which wraps the read value in `[...]`), so
//     the adapter's effect is observable in the result value.
//   - `vReleaseOverview.versionUpperOptional` — optionalVirtualColumnFromFragment
//     on a View.
//
// Virtual columns carry no DB column — they are computed from other columns by
// the fragment at query time, so no schema/seed change is involved.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssueWorklog, vReleaseOverview } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('table-optional-virtual-column-and-adapter', async () => {
        // Worklog 1 has activity 'coding'. `activityUpper` (optional virtual)
        // → 'CODING'; `activityTagged` (virtual + bracketAdapter) → '[CODING]'.
        // The mock is primed with the RAW db values; the per-column adapter is
        // applied on the way out, so only `activityTagged` gets the brackets.
        ctx.mockNext({ id: 1, activityUpper: 'CODING', activityTagged: 'CODING' })
        const expected = { id: 1, activityUpper: 'CODING', activityTagged: '[CODING]' }
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id:            tIssueWorklog.id,
                activityUpper:  tIssueWorklog.activityUpper,
                activityTagged: tIssueWorklog.activityTagged,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, upper(activity) as "activityUpper", upper(activity) as "activityTagged" from issue_worklog where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; activityUpper?: string; activityTagged: string }>>()
        expect(row).toEqual(expected)
    })

    test('view-optional-virtual-column', async () => {
        // Release 2's version is '1.3.0-beta.1'; the optional virtual column on
        // the View upper-cases it → '1.3.0-BETA.1'.
        const expected = { id: 2, versionUpperOptional: '1.3.0-BETA.1' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(2))
            .select({
                id:                  vReleaseOverview.id,
                versionUpperOptional: vReleaseOverview.versionUpperOptional,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, upper(version) as "versionUpperOptional" from release_overview where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; versionUpperOptional?: string }>>()
        expect(row).toEqual(expected)
    })
})
