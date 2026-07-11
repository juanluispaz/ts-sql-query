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
import { tIssueWorklog, tProjectRelease, vProjectOverview, vReleaseOverview, type ReleaseChannel, type WorklogActivity} from '../../domain/connection.js'
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, upper(activity) as activityUpper, upper(activity) as activityTagged from issue_worklog where id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, upper(version) as versionUpperOptional from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; versionUpperOptional?: string }>>()
        expect(row).toEqual(expected)
    })

    test('aliased-view-virtual-column-re-qualifies-sibling-reference-under-alias', async () => {
        // `nameUpper` is a `virtualColumnFromFragment` whose fragment references
        // a SIBLING column of the same view (`upper(this.name)`). When the view
        // is rendered through a user-supplied alias (`vProjectOverview.as('po')`),
        // that sibling reference must RE-QUALIFY under the alias: the emitted SQL
        // is `upper(po.name)` and the source is `from project_overview as po`.
        // Locking this guards that the alias re-qualification reaches inside the
        // virtual column's fragment — the sibling is not left qualified by the
        // bare table name. Project 1's name is 'Marketing site', so the required
        // `string` virtual column resolves to 'MARKETING SITE'.
        const vpo = vProjectOverview.as('po')
        const expected = { nameUpper: 'MARKETING SITE' }
        ctx.mockNext(expected)

        const row = await ctx.conn.selectFrom(vpo)
            .where(vpo.id.equals(1))
            .select({ nameUpper: vpo.nameUpper })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select upper(po.name) as nameUpper from project_overview as po where po.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { nameUpper: string }>>()
        expect(row).toEqual(expected)
    })

    test('table-custom-int-virtual-column-required', async () => {
        // `centsFromId` is a REQUIRED custom-kind virtual column: a branded
        // customInt ('Cents') computed as `id * 100`. Worklog 1 → 100. The
        // fragment renders as a real expression (no bound param), and a required
        // branded customInt projects as a plain `number`.
        const expected = { id: 1, cents: 100 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id:    tIssueWorklog.id,
                cents: tIssueWorklog.centsFromId,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, id * 100 as cents from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; cents: number }>>()
        expect(row).toEqual(expected)
        expect(row.cents).toBe(100)
    })

    test('table-custom-int-virtual-column-optional', async () => {
        // `centsFromIdOptional` is the OPTIONAL sibling of the branded customInt
        // custom-kind virtual column (`id * 100`). Worklog 1 → 100 present. An
        // optional branded customInt projects as `cents?: number`.
        const expected = { id: 1, cents: 100 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id:    tIssueWorklog.id,
                cents: tIssueWorklog.centsFromIdOptional,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, id * 100 as cents from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; cents?: number }>>()
        expect(row).toEqual(expected)
        expect(row.cents).toBe(100)
    })

    test('table-custom-enum-virtual-column-required', async () => {
        // `activityCustomKind` is a string-backed custom-kind virtual column (enum
        // 'WorklogActivity') computed as `lower(activity)`. Worklog 1's activity is
        // 'coding', so `lower('coding')` = 'coding'. The column projects as the
        // string-literal union `WorklogActivity`.
        const expected = { id: 1, act: 'coding' as WorklogActivity }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id:  tIssueWorklog.id,
                act: tIssueWorklog.activityCustomKind,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, lower(activity) as act from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; act: WorklogActivity }>>()
        expect(row).toEqual(expected)
    })

    test('table-custom-int-virtual-column-with-adapter', async () => {
        // `centsFromIdTagged` is the branded customInt custom-kind virtual column
        // (`id * 100`) carrying a trailing TypeAdapter (`plusOffsetAdapter`, read
        // +1000). The DB yields the RAW value id*100 = 100; the adapter shifts it
        // on the way out → 1100. The emitted SQL is identical to the no-adapter
        // form — the adapter only transforms the value on read.
        ctx.mockNext({ id: 1, cents: 100 })
        const expected = { id: 1, cents: 1100 }
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id:    tIssueWorklog.id,
                cents: tIssueWorklog.centsFromIdTagged,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, id * 100 as cents from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; cents: number }>>()
        expect(row).toEqual(expected)
        expect(row.cents).toBe(1100)
    })

    test('view-custom-int-virtual-column-required', async () => {
        // The same branded customInt custom-kind arm on a View: `centsFromId` is a
        // REQUIRED virtual column computed as `id * 10`. Release 2 → 20. Projects
        // as a plain `number`.
        const expected = { id: 2, cents: 20 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(2))
            .select({
                id:    vReleaseOverview.id,
                cents: vReleaseOverview.centsFromId,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, id * 10 as cents from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; cents: number }>>()
        expect(row).toEqual(expected)
        expect(row.cents).toBe(20)
    })

    test('view-custom-int-virtual-column-optional', async () => {
        // `centsFromIdOptional` is the OPTIONAL sibling of the View's branded
        // customInt custom-kind virtual column (`id * 10`). Release 2 → 20 present.
        // Projects as `cents?: number`.
        const expected = { id: 2, cents: 20 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(2))
            .select({
                id:    vReleaseOverview.id,
                cents: vReleaseOverview.centsFromIdOptional,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, id * 10 as cents from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; cents?: number }>>()
        expect(row).toEqual(expected)
        expect(row.cents).toBe(20)
    })

    test('table-custom-int-virtual-column-optional-with-adapter', async () => {
        // `centsFromIdOptionalTagged` is the OPTIONAL branded customInt custom-kind
        // virtual column (`id * 100`) carrying a trailing TypeAdapter
        // (`plusOffsetAdapter`, read +1000). The DB yields the RAW value id*100 = 100;
        // the adapter shifts it on read → 1100. An optional branded customInt projects
        // as `cents?: number`.
        ctx.mockNext({ id: 1, cents: 100 })
        const expected = { id: 1, cents: 1100 }
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id:    tIssueWorklog.id,
                cents: tIssueWorklog.centsFromIdOptionalTagged,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, id * 100 as cents from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; cents?: number }>>()
        expect(row).toEqual(expected)
        expect(row.cents).toBe(1100)
    })
    // ---- COL §B: per-kind virtualColumnFromFragment fan-out (required + optional)
    // on a Table (tIssueWorklog plain+customDouble, tProjectRelease custom+plain
    // uuid/localDateTime) and on a View (vReleaseOverview). Each test observes the
    // DISTINCT read-path leaf type of one kind for one factory (required
    // `virtualColumnFromFragment` / optional `optionalVirtualColumnFromFragment`).
    // The fragment references an existing same-source typed column, so the emitted
    // SQL is a portable column ref (or a portable arithmetic expression) and the
    // seed value flows through that kind's read marshaller. Worklog 1 / release 1
    // are fully-populated rows, so every optional leaf resolves to a present value.

    test('worklog-boolean-virtual-required', async () => {
        const expected = { id: 1, v: true }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, v: tIssueWorklog.booleanVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billable as "v" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('worklog-boolean-virtual-optional', async () => {
        const expected = { id: 1, v: true }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, v: tIssueWorklog.booleanVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billable as "v" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('worklog-bigint-virtual-required', async () => {
        const expected = { id: 1, v: 1n }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, v: tIssueWorklog.bigintVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, id as "v" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: bigint }>>()
        expect(row).toEqual(expected)
    })

    test('worklog-bigint-virtual-optional', async () => {
        const expected = { id: 1, v: 5400000n }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, v: tIssueWorklog.bigintVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, duration_ms as "v" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: bigint }>>()
        expect(row).toEqual(expected)
    })

    test('worklog-double-virtual-required', async () => {
        const expected = { id: 1, v: 200 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, v: tIssueWorklog.doubleVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billed_amount as "v" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: number }>>()
        expect(row).toEqual(expected)
    })

    test('worklog-double-virtual-optional', async () => {
        const expected = { id: 1, v: 5400000 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, v: tIssueWorklog.doubleVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, duration_ms as "v" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: number }>>()
        expect(row).toEqual(expected)
    })

    test('worklog-local-date-virtual-required', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(2024, 2, 4, 10, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, v: tIssueWorklog.localDateVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, work_date as "v" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('worklog-local-date-virtual-optional', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(2024, 2, 4, 10, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, v: tIssueWorklog.localDateVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, work_date as "v" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('worklog-local-time-virtual-required', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(1970, 0, 1, 9, 15, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, v: tIssueWorklog.localTimeVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, started_at as "v" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('worklog-local-time-virtual-optional', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(1970, 0, 1, 9, 15, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, v: tIssueWorklog.localTimeVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, started_at as "v" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('worklog-int-virtual-required', async () => {
        const expected = { id: 1, v: 2 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, v: tIssueWorklog.intVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, id + 1 as "v" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: number }>>()
        expect(row).toEqual(expected)
    })

    test('worklog-int-virtual-optional', async () => {
        const expected = { id: 1, v: 90 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, v: tIssueWorklog.intVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, minutes as "v" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: number }>>()
        expect(row).toEqual(expected)
    })

    test('worklog-custom-double-virtual-required', async () => {
        const expected = { id: 1, v: 200 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, v: tIssueWorklog.customDoubleVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billed_amount as "v" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: number }>>()
        expect(row).toEqual(expected)
    })

    test('worklog-custom-double-virtual-optional', async () => {
        const expected = { id: 1, v: 200 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, v: tIssueWorklog.customDoubleVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billed_amount as "v" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: number }>>()
        expect(row).toEqual(expected)
    })

    test('release-custom-comparable-virtual-required', async () => {
        const expected = { id: 1, v: '1.2.0' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, v: tProjectRelease.customComparableVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, version as "v" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: string }>>()
        expect(row).toEqual(expected)
    })

    test('release-custom-comparable-virtual-optional', async () => {
        const expected = { id: 1, v: '1.2.0' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, v: tProjectRelease.customComparableVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, version as "v" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: string }>>()
        expect(row).toEqual(expected)
    })

    test('release-custom-virtual-required', async () => {
        const expected = { id: 1, v: 'stable' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, v: tProjectRelease.customVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, channel as "v" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: ReleaseChannel }>>()
        expect(row).toEqual(expected)
    })

    test('release-custom-virtual-optional', async () => {
        const expected = { id: 1, v: 'stable' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, v: tProjectRelease.customVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, channel as "v" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: ReleaseChannel }>>()
        expect(row).toEqual(expected)
    })

    test('release-custom-uuid-virtual-required', async () => {
        const expected = { id: 1, v: '0a8f9c1e-1111-4222-8333-444455556666' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, v: tProjectRelease.customUuidVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, signing_key as "v" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: string }>>()
        expect(row).toEqual(expected)
    })

    test('release-custom-uuid-virtual-optional', async () => {
        const expected = { id: 1, v: '0a8f9c1e-1111-4222-8333-444455556666' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, v: tProjectRelease.customUuidVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, signing_key as "v" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: string }>>()
        expect(row).toEqual(expected)
    })

    test('release-custom-local-date-virtual-required', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(2024, 0, 15, 10, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, v: tProjectRelease.customLocalDateVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, released_on as "v" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('release-custom-local-date-virtual-optional', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(2024, 0, 15, 10, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, v: tProjectRelease.customLocalDateVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, released_on as "v" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('release-custom-local-time-virtual-required', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(1970, 0, 1, 17, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, v: tProjectRelease.customLocalTimeVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cutoff_time as "v" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('release-custom-local-time-virtual-optional', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(1970, 0, 1, 17, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, v: tProjectRelease.customLocalTimeVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cutoff_time as "v" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('release-custom-local-date-time-virtual-required', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(2024, 0, 16, 9, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, v: tProjectRelease.customLocalDateTimeVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, published_at as "v" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('release-custom-local-date-time-virtual-optional', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(2024, 0, 14, 12, 30, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, v: tProjectRelease.customLocalDateTimeVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, signed_off_at as "v" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('release-uuid-virtual-required', async () => {
        const expected = { id: 1, v: '0a8f9c1e-1111-4222-8333-444455556666' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, v: tProjectRelease.uuidVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, signing_key as "v" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: string }>>()
        expect(row).toEqual(expected)
    })

    test('release-uuid-virtual-optional', async () => {
        const expected = { id: 1, v: '0a8f9c1e-1111-4222-8333-444455556666' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, v: tProjectRelease.uuidVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, signing_key as "v" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: string }>>()
        expect(row).toEqual(expected)
    })

    test('release-local-date-time-virtual-required', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(2024, 0, 16, 9, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, v: tProjectRelease.localDateTimeVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, published_at as "v" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('release-local-date-time-virtual-optional', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(2024, 0, 14, 12, 30, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, v: tProjectRelease.localDateTimeVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, signed_off_at as "v" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('view-boolean-virtual-required', async () => {
        const expected = { id: 1, v: true }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.booleanVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, is_signed as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('view-boolean-virtual-optional', async () => {
        const expected = { id: 1, v: true }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.booleanVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, is_signed as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('view-bigint-virtual-required', async () => {
        const expected = { id: 1, v: 1n }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.bigintVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, id as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: bigint }>>()
        expect(row).toEqual(expected)
    })

    test('view-bigint-virtual-optional', async () => {
        const expected = { id: 1, v: 4200000042n }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.bigintVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, download_count as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: bigint }>>()
        expect(row).toEqual(expected)
    })

    test('view-double-virtual-required', async () => {
        const expected = { id: 1, v: 4.5 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.doubleVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, avg_rating as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: number }>>()
        expect(row).toEqual(expected)
    })

    test('view-double-virtual-optional', async () => {
        const expected = { id: 1, v: 4.5 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.doubleVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, avg_rating as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: number }>>()
        expect(row).toEqual(expected)
    })

    test('view-uuid-virtual-required', async () => {
        const expected = { id: 1, v: '0a8f9c1e-1111-4222-8333-444455556666' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.uuidVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, signing_uuid as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: string }>>()
        expect(row).toEqual(expected)
    })

    test('view-uuid-virtual-optional', async () => {
        const expected = { id: 1, v: '0a8f9c1e-1111-4222-8333-444455556666' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.uuidVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, signing_uuid as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: string }>>()
        expect(row).toEqual(expected)
    })

    test('view-local-date-virtual-required', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(2024, 0, 15, 10, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.localDateVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, release_day_plain as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('view-local-date-virtual-optional', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(2024, 0, 15, 10, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.localDateVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, release_day_plain as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('view-local-time-virtual-required', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(1970, 0, 1, 17, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.localTimeVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cutoff_plain as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('view-local-time-virtual-optional', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(1970, 0, 1, 17, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.localTimeVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cutoff_plain as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('view-local-date-time-virtual-required', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(2024, 0, 16, 9, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.localDateTimeVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, published_stamp_plain as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('view-local-date-time-virtual-optional', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(2024, 0, 14, 12, 30, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.localDateTimeVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, signed_off_at as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('view-int-virtual-required', async () => {
        const expected = { id: 1, v: 2 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.intVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, id + 1 as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: number }>>()
        expect(row).toEqual(expected)
    })

    test('view-int-virtual-optional', async () => {
        const expected = { id: 1, v: 1 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.intVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, id as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: number }>>()
        expect(row).toEqual(expected)
    })

    test('view-custom-comparable-virtual-required', async () => {
        const expected = { id: 1, v: '1.2.0' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.customComparableVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, version as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: string }>>()
        expect(row).toEqual(expected)
    })

    test('view-custom-comparable-virtual-optional', async () => {
        const expected = { id: 1, v: '1.2.0' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.customComparableVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, version as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: string }>>()
        expect(row).toEqual(expected)
    })

    test('view-custom-uuid-virtual-required', async () => {
        const expected = { id: 1, v: '0a8f9c1e-1111-4222-8333-444455556666' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.customUuidVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, signing_uuid as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: string }>>()
        expect(row).toEqual(expected)
    })

    test('view-custom-uuid-virtual-optional', async () => {
        const expected = { id: 1, v: '0a8f9c1e-1111-4222-8333-444455556666' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.customUuidVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, signing_uuid as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: string }>>()
        expect(row).toEqual(expected)
    })

    test('view-custom-local-date-virtual-required', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(2024, 0, 15, 10, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.customLocalDateVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, release_day_plain as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('view-custom-local-date-virtual-optional', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(2024, 0, 15, 10, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.customLocalDateVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, release_day_plain as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('view-custom-local-time-virtual-required', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(1970, 0, 1, 17, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.customLocalTimeVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cutoff_plain as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('view-custom-local-time-virtual-optional', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(1970, 0, 1, 17, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.customLocalTimeVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cutoff_plain as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('view-custom-local-date-time-virtual-required', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(2024, 0, 16, 9, 0, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.customLocalDateTimeVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, published_stamp_plain as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('view-custom-local-date-time-virtual-optional', async () => {
        const expected = { id: 1, v: new Date(Date.UTC(2024, 0, 14, 12, 30, 0)) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.customLocalDateTimeVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, signed_off_at as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('view-custom-double-virtual-required', async () => {
        const expected = { id: 1, v: 4.5 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.customDoubleVirtual })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, avg_rating as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: number }>>()
        expect(row).toEqual(expected)
    })

    test('view-custom-double-virtual-optional', async () => {
        const expected = { id: 1, v: 4.5 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, v: vReleaseOverview.customDoubleVirtualOptional })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, avg_rating as "v" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: number }>>()
        expect(row).toEqual(expected)
    })

})
