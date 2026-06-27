// Return-type keyword fan-out for the public `fragmentWithType(...)` and
// `aggregateFragmentWithType(...)` builders: the date/time, enum, double,
// boolean and custom-* return families, plus a set of `'optional'` arms. Each
// fragment routes through the dialect's fragment/aggregate path; the snapshot
// is the authoritative emitted SQL.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tIssueWorklog, tProjectRelease, type ReleaseChannel, type WorklogActivity } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('fragment-with-type-date-time-and-enum-arms', async () => {
        // The `localDate` / `localTime` / `localDateTime` / `enum` return arms
        // of `fragmentWithType`. Worklog 1: work_date 2024-03-04, started_at
        // 09:15, activity 'coding'; the localDateTime arm reads release 1's
        // signed_off_at 2024-01-14 12:30 (a deterministic timestamp).
        const expected = {
            wd:  new Date(Date.UTC(2024, 2, 4, 10, 0, 0)),
            st:  new Date(Date.UTC(1970, 0, 1, 9, 15, 0)),
            act: 'coding' as WorklogActivity,
        }
        ctx.mockNext([expected])
        const c = ctx.conn
        const rows = await c.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                wd:  c.fragmentWithType('localDate', 'required').sql`${tIssueWorklog.workDate}`,
                st:  c.fragmentWithType('localTime', 'required').sql`${tIssueWorklog.startedAt}`,
                act: c.fragmentWithType<WorklogActivity, 'WorklogActivity'>('enum', 'WorklogActivity', 'required').sql`${tIssueWorklog.activity}`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select work_date as wd, started_at as st, activity as act from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ wd: Date; st: Date; act: WorklogActivity }>>>()
        expect(rows).toEqual([expected])
    })

    test('fragment-with-type-double-custom-and-custom-local-arms', async () => {
        // The `double` / `custom` / `customUuid` / `customLocalDate` /
        // `customLocalTime` / `customLocalDateTime` return arms over release 1
        // (version 1.2.0, channel stable, released 2024-01-15, cutoff 17:00,
        // signed off 2024-01-14 12:30, signing key the seeded uuid).
        const REF1 = '0a8f9c1e-1111-4222-8333-444455556666'
        const expected = {
            avg:  1.5,
            ch:   'stable' as ReleaseChannel,
            key:  REF1,
            rOn:  new Date(Date.UTC(2024, 0, 15, 10, 0, 0)),
            cut:  new Date(Date.UTC(1970, 0, 1, 17, 0, 0)),
            soff: new Date(Date.UTC(2024, 0, 14, 12, 30, 0)),
        }
        ctx.mockNext([expected])
        const c = ctx.conn
        const rows = await c.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                avg:  c.fragmentWithType('double', 'required').sql`1.5`,
                ch:   c.fragmentWithType<ReleaseChannel, 'ReleaseChannel'>('custom', 'ReleaseChannel', 'required').sql`${tProjectRelease.channel}`,
                key:  c.fragmentWithType<string, 'SigningKey'>('customUuid', 'SigningKey', 'required').sql`${tProjectRelease.signingKey}`,
                rOn:  c.fragmentWithType<Date, 'ReleaseDay'>('customLocalDate', 'ReleaseDay', 'required').sql`${tProjectRelease.releasedOn}`,
                cut:  c.fragmentWithType<Date, 'CutoffClock'>('customLocalTime', 'CutoffClock', 'required').sql`${tProjectRelease.cutoffTime}`,
                soff: c.fragmentWithType<Date, 'SignOffStamp'>('customLocalDateTime', 'SignOffStamp', 'required').sql`${tProjectRelease.signedOffAt}`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select 1.5 as \`avg\`, \`channel\` as ch, bin_to_uuid(signing_key) as \`key\`, released_on as rOn, cutoff_time as cut, signed_off_at as soff from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            avg: number; ch: ReleaseChannel; key: string; rOn: Date; cut: Date; soff: Date
        }>>>()
        expect(rows).toEqual([expected])
    })

    test('fragment-with-type-optional-arms-widen-the-leaf', async () => {
        // A set of `'optional'` arms (the SQL is identical to the required form;
        // only the leaf widens). The non-int/bigint families surface as
        // `?: T | undefined`. string / double / uuid / custom over release 1.
        const REF1 = '0a8f9c1e-1111-4222-8333-444455556666'
        const expected = {
            v:   '1.2.0',
            avg: 1.5,
            key: REF1,
            ch:  'stable' as ReleaseChannel,
        }
        ctx.mockNext([expected])
        const c = ctx.conn
        const rows = await c.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                v:   c.fragmentWithType('string', 'optional').sql`${tProjectRelease.version}`,
                avg: c.fragmentWithType('double', 'optional').sql`1.5`,
                key: c.fragmentWithType('uuid', 'optional').sql`${tProjectRelease.signingKey}`,
                ch:  c.fragmentWithType<ReleaseChannel, 'ReleaseChannel'>('custom', 'ReleaseChannel', 'optional').sql`${tProjectRelease.channel}`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as \`v\`, 1.5 as \`avg\`, bin_to_uuid(signing_key) as \`key\`, \`channel\` as ch from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            v?: string | undefined; avg?: number | undefined; key?: string | undefined; ch?: ReleaseChannel | undefined
        }>>>()
        expect(rows).toEqual([expected])
    })

    test('aggregate-fragment-with-type-scalar-arms', async () => {
        // `aggregateFragmentWithType` `string` (max title), `double` (avg
        // priority), `boolean` (`count(*) > 0`) and the `bigint` OPTIONAL arm
        // (max view_count). One row, no group by. Priorities {2,1,3,2} -> avg
        // 2.0; max title is the lexicographically-greatest; an issue exists -> true.
        const expected = {
            maxTitle: 'Update hero copy',
            avgPrio:  2,
            any:      true,
            maxView:  0n,
        }
        ctx.mockNext(expected)
        const c = ctx.conn
        const result = await c.selectFrom(tIssue)
            .select({
                maxTitle: c.aggregateFragmentWithType('string', 'required').sql`max(${tIssue.title})`,
                avgPrio:  c.aggregateFragmentWithType('double', 'required').sql`avg(${tIssue.priority})`,
                any:      c.aggregateFragmentWithType('boolean', 'required').sql`count(*) > 0`,
                maxView:  c.aggregateFragmentWithType('bigint', 'optional').sql`max(${tIssue.viewCount})`,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(title) as maxTitle, avg(priority) as avgPrio, count(*) > 0 as \`any\`, max(view_count) as maxView from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, {
            maxTitle: string; avgPrio: number; any: boolean; maxView?: bigint
        }>>()
        expect(result).toEqual(expected)
    })

    test('aggregate-fragment-with-type-enum-and-custom-arms', async () => {
        // `aggregateFragmentWithType` carrying the branded leaf: `enum`
        // (max activity over issue 1's worklogs) and `custom` (max channel over
        // the releases). Issue 1 worklogs: 'coding','meeting' -> max 'meeting';
        // release channels {stable,beta,canary} -> max 'stable'.
        const expectedAct = { maxActivity: 'meeting' as WorklogActivity }
        ctx.mockNext(expectedAct)
        const c = ctx.conn
        const actRow = await c.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.issueId.equals(1))
            .select({
                maxActivity: c.aggregateFragmentWithType<WorklogActivity, 'WorklogActivity'>('enum', 'WorklogActivity', 'required').sql`max(${tIssueWorklog.activity})`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(activity) as maxActivity from issue_worklog where issue_id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof actRow, { maxActivity: WorklogActivity }>>()
        expect(actRow).toEqual(expectedAct)

        const expectedCh = { maxChannel: 'stable' as ReleaseChannel }
        ctx.mockNext(expectedCh)
        const chRow = await c.selectFrom(tProjectRelease)
            .select({
                maxChannel: c.aggregateFragmentWithType<ReleaseChannel, 'ReleaseChannel'>('custom', 'ReleaseChannel', 'required').sql`max(${tProjectRelease.channel})`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(\`channel\`) as maxChannel from project_release"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof chRow, { maxChannel: ReleaseChannel }>>()
        expect(chRow).toEqual(expectedCh)
    })
})
