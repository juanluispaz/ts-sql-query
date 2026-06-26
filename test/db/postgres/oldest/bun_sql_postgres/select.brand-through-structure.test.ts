// Brand/customness surviving a structural remap: a left join, aggregateAsArray,
// compound (UNION), CTE and View left-join each preserve a branded column's
// value type while remapping optionality. The value type is the underlying TS
// type — `version` (customComparable) is `string`, `channel` (custom) is the
// `ReleaseChannel` union, `activity` (enum) is `WorklogActivity`; the
// distinctive assertion is that the literal union survives instead of widening
// to `string`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import {
    tIssue, tProject, tProjectRelease, tIssueWorklog, vReleaseOverview,
    type ReleaseChannel, type WorklogActivity,
} from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('table-left-join-preserves-custom-comparable-and-custom-brand', async () => {
        // `tProjectRelease.forUseInLeftJoin()` widens its required columns to
        // `originallyRequired` (projected `?: T`) while keeping their value
        // types: `version` stays `string`, `channel` stays the `ReleaseChannel`
        // union. Project 1 has the 'stable' release 1.2.0, so the join hits once.
        const tRelLeft = tProjectRelease.forUseInLeftJoin()
        const expected = { pid: 1, version: '1.2.0', channel: 'stable' as ReleaseChannel }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProject)
            .leftJoin(tRelLeft).on(tRelLeft.projectId.equals(tProject.id).and(tRelLeft.channel.equals('stable')))
            .where(tProject.id.equals(1))
            .select({
                pid:     tProject.id,
                version: tRelLeft.version,
                channel: tRelLeft.channel,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, project_release.version as version, project_release.channel as channel from project left join project_release on project_release.project_id = project.id and project_release.channel = $1 where project.id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "stable",
            1,
          ]
        `)
        assertType<Exact<typeof row, { pid: number; version?: string; channel?: ReleaseChannel }>>()
        expect(row).toEqual(expected)
    })

    test('table-left-join-preserves-enum-brand', async () => {
        // `tIssueWorklog.forUseInLeftJoin()` carries the `WorklogActivity` enum
        // through the widening, so the leaf is `activity?: WorklogActivity`.
        // Issue 2 has exactly one worklog (the 'review' entry).
        const tWlLeft = tIssueWorklog.forUseInLeftJoin()
        const expected = { iid: 2, activity: 'review' as WorklogActivity }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tWlLeft).on(tWlLeft.issueId.equals(tIssue.id))
            .where(tIssue.id.equals(2))
            .select({
                iid:      tIssue.id,
                activity: tWlLeft.activity,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue_worklog.activity as activity from issue left join issue_worklog on issue_worklog.issue_id = issue.id where issue.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, { iid: number; activity?: WorklogActivity }>>()
        expect(row).toEqual(expected)
    })

    test('aggregate-as-array-of-one-column-preserves-brand', async () => {
        // `aggregateAsArrayOfOneColumn(branded)` carries the element brand:
        // `version` -> `string[]`, `channel` -> `ReleaseChannel[]`. Project 1
        // has two releases (1.2.0/stable, 1.3.0-beta.1/beta). The JSON aggregate
        // has no guaranteed order, so the inner arrays are sorted before comparing.
        ctx.mockNext([{ projectId: 1, versions: ['1.2.0', '1.3.0-beta.1'], channels: ['stable', 'beta'] }])
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.projectId.equals(1))
            .select({
                projectId: tProjectRelease.projectId,
                versions:  ctx.conn.aggregateAsArrayOfOneColumn(tProjectRelease.version),
                channels:  ctx.conn.aggregateAsArrayOfOneColumn(tProjectRelease.channel),
            })
            .groupBy('projectId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId", json_agg(version) as versions, json_agg(channel) as channels from project_release where project_id = $1 group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            projectId: number
            versions:  string[]
            channels:  ReleaseChannel[]
        }>>>()
        const sorted = rows.map(r => ({
            ...r,
            versions: [...r.versions].sort(),
            channels: [...r.channels].sort(),
        }))
        expect(sorted).toEqual([{ projectId: 1, versions: ['1.2.0', '1.3.0-beta.1'], channels: ['beta', 'stable'] }])
    })

    test('aggregate-as-array-of-one-column-preserves-enum-brand', async () => {
        // `aggregateAsArrayOfOneColumn(activity)` -> `WorklogActivity[]` (the
        // union survives). Issue 1 has the 'coding' and 'meeting' worklogs.
        ctx.mockNext([{ issueId: 1, activities: ['coding', 'meeting'] }])
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.issueId.equals(1))
            .select({
                issueId:    tIssueWorklog.issueId,
                activities: ctx.conn.aggregateAsArrayOfOneColumn(tIssueWorklog.activity),
            })
            .groupBy('issueId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue_id as "issueId", json_agg(activity) as activities from issue_worklog where issue_id = $1 group by issue_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ issueId: number; activities: WorklogActivity[] }>>>()
        const sorted = rows.map(r => ({ ...r, activities: [...r.activities].sort() }))
        expect(sorted).toEqual([{ issueId: 1, activities: ['coding', 'meeting'] }])
    })

    test('compound-union-carries-the-seed-brand-onto-the-result', async () => {
        // The compound result carries the LEFT seed's branded value type: a
        // `channel` (custom `ReleaseChannel`) seed unioned with another channel
        // select keeps `channel: ReleaseChannel`. Project 1 -> {stable, beta};
        // project 2 -> {canary}; union -> 3 rows ordered by channel.
        const expected = [{ channel: 'beta' as ReleaseChannel }, { channel: 'canary' as ReleaseChannel }, { channel: 'stable' as ReleaseChannel }]
        ctx.mockNext(expected)
        const p1 = ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.projectId.equals(1))
            .select({ channel: tProjectRelease.channel })
        const p2 = ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.projectId.equals(2))
            .select({ channel: tProjectRelease.channel })
        const rows = await p1.union(p2).orderBy('channel').executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select channel as channel from project_release where project_id = $1 union select channel as channel from project_release where project_id = $2 order by channel"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ channel: ReleaseChannel }>>>()
        expect(rows).toEqual(expected)
    })

    test('cte-carries-the-brand-through-for-use-in-query-as', async () => {
        // A CTE (`forUseInQueryAs`) carrying a branded column:
        // `release_cte.channel` keeps `ReleaseChannel` when re-projected from
        // the outer query. All three releases, ordered by id.
        const expected = [
            { rid: 1, channel: 'stable' as ReleaseChannel },
            { rid: 2, channel: 'beta' as ReleaseChannel },
            { rid: 3, channel: 'canary' as ReleaseChannel },
        ]
        ctx.mockNext(expected)
        const releaseCte = ctx.conn.selectFrom(tProjectRelease)
            .select({ rid: tProjectRelease.id, channel: tProjectRelease.channel })
            .forUseInQueryAs('release_cte')
        const rows = await ctx.conn.selectFrom(releaseCte)
            .select({ rid: releaseCte.rid, channel: releaseCte.channel })
            .orderBy('rid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with release_cte as (select id as rid, channel as channel from project_release) select rid as rid, channel as channel from release_cte order by rid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ rid: number; channel: ReleaseChannel }>>>()
        expect(rows).toEqual(expected)
    })

    test('view-left-join-preserves-branded-column-and-virtual', async () => {
        // A View left-join (`vReleaseOverview.forUseInLeftJoin()`) carrying a
        // branded `version` (customComparable -> string) plus a
        // `virtualColumnFromFragment` (`versionUpper`), both widened to `?: T`.
        // Joined to project 1's '1.3.0-beta.1' release: versionUpper is its
        // upper-cased form.
        const vRelLeft = vReleaseOverview.forUseInLeftJoin()
        const expected = { pid: 1, version: '1.3.0-beta.1', versionUpper: '1.3.0-BETA.1' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProject)
            .leftJoin(vRelLeft).on(vRelLeft.projectId.equals(tProject.id).and(vRelLeft.version.equals('1.3.0-beta.1')))
            .where(tProject.id.equals(1))
            .select({
                pid:          tProject.id,
                version:      vRelLeft.version,
                versionUpper: vRelLeft.versionUpper,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, release_overview.version as version, upper(release_overview.version) as "versionUpper" from project left join release_overview on release_overview.project_id = project.id and release_overview.version = $1 where project.id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.3.0-beta.1",
            1,
          ]
        `)
        assertType<Exact<typeof row, { pid: number; version?: string; versionUpper?: string }>>()
        expect(row).toEqual(expected)
    })
})
