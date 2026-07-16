// Return-type keyword fan-out for the public `fragmentWithType(...)` and
// `aggregateFragmentWithType(...)` builders: the date/time, enum, double,
// boolean and custom-* return families, plus a set of `'optional'` arms. Each
// fragment routes through the dialect's fragment/aggregate path; the snapshot
// is the authoritative emitted SQL.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { TypeAdapter } from '../../../../../src/TypeAdapter.js'
import { tIssue, tIssueWorklog, tProjectRelease, tOrganization, type ReleaseChannel, type WorklogActivity } from '../../domain/connection.js'
import { ctx } from './setup.js'

// A non-identity TypeAdapter: brackets any string read from the DB so the
// adapter's effect is observable in the result value. Used to prove the
// trailing `adapter?` argument of `fragmentWithType(...)` is threaded into
// the value transform on read.
const bracketAdapter: TypeAdapter = {
    transformValueFromDB(value, type, next) {
        const v = next.transformValueFromDB(value, type)
        return typeof v === 'string' ? '[' + v + ']' : v
    },
    transformValueToDB(value, type, next) {
        return next.transformValueToDB(value, type)
    },
}

// A non-identity temporal TypeAdapter: shifts a read Date +1 hour so the
// adapter's effect is observable in a temporal aggregate result. Used to prove
// the trailing `adapter?` argument of `aggregateFragmentWithType(...)` is
// threaded on the temporal return arms below.
const shiftHourAdapter: TypeAdapter = {
    transformValueFromDB(value, type, next) {
        const v = next.transformValueFromDB(value, type)
        return v instanceof Date ? new Date(v.getTime() + 3600000) : v
    },
    transformValueToDB(value, type, next) {
        return next.transformValueToDB(value, type)
    },
}

// A non-identity boolean TypeAdapter: negates the read boolean so the adapter's
// effect is observable in the result value. Used to prove the trailing
// `adapter?` argument of `fragmentWithType('boolean', …)` is threaded on read.
const negateBoolAdapter: TypeAdapter = {
    transformValueFromDB(value, type, next) {
        const v = next.transformValueFromDB(value, type)
        return typeof v === 'boolean' ? !v : v
    },
    transformValueToDB(value, type, next) {
        return next.transformValueToDB(value, type)
    },
}

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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select 1.5 as avg, channel as ch, signing_key as \`key\`, released_on as rOn, cutoff_time as cut, signed_off_at as soff from project_release where id = ?"`)
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
        // `?: T`. string / double / uuid / custom over release 1.
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as \`v\`, 1.5 as avg, signing_key as \`key\`, channel as ch from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            v?: string; avg?: number; key?: string; ch?: ReleaseChannel
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(title) as maxTitle, avg(priority) as avgPrio, count(*) > 0 as any, max(view_count) as maxView from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, {
            maxTitle: string; avgPrio: number; any: boolean; maxView?: bigint
        }>>()
        expect(result).toEqual(expected)
    })

    test('aggregate-fragment-with-type-optional-scalar-arms', async () => {
        // The `'optional'` arm of aggregateFragmentWithType for the scalar kinds
        // int / double / string / boolean. A no-match WHERE makes each aggregate
        // resolve over an EMPTY group, so `max(...)` / `avg(...)` / the boolean
        // comparison are NULL — the optional leaf's `undefined` inhabitant. The
        // boolean arm uses `max(priority) > 5` (portable, NULL over an empty group)
        // rather than max on a boolean column.
        const expected = {}
        ctx.mockNext({ mi: null, md: null, ms: null, mb: null })
        const c = ctx.conn
        const result = await c.selectFrom(tIssue)
            .where(tIssue.id.equals(-1))
            .select({
                mi: c.aggregateFragmentWithType('int', 'optional').sql`max(${tIssue.priority})`,
                md: c.aggregateFragmentWithType('double', 'optional').sql`avg(${tIssue.priority})`,
                ms: c.aggregateFragmentWithType('string', 'optional').sql`max(${tIssue.title})`,
                mb: c.aggregateFragmentWithType('boolean', 'optional').sql`max(${tIssue.priority}) > 5`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(priority) as mi, avg(priority) as md, max(title) as ms, max(priority) > 5 as mb from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            -1,
          ]
        `)
        assertType<Exact<typeof result, { mi?: number; md?: number; ms?: string; mb?: boolean }>>()
        expect(result).toEqual(expected)
    })

    test('aggregate-fragment-with-type-optional-temporal-arms', async () => {
        // The `'optional'` arm of aggregateFragmentWithType for the temporal kinds
        // (plain localDate/localTime/localDateTime and their custom twins). Each
        // aggregate resolves over an EMPTY group (no-match WHERE), so `max(...)` is
        // NULL — the optional Date leaf's absent inhabitant.
        const c = ctx.conn
        ctx.mockNext({ mld: null, mlt: null })
        const plain = await c.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(-1))
            .select({
                mld: c.aggregateFragmentWithType('localDate', 'optional').sql`max(${tIssueWorklog.workDate})`,
                mlt: c.aggregateFragmentWithType('localTime', 'optional').sql`max(${tIssueWorklog.startedAt})`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(work_date) as mld, max(started_at) as mlt from issue_worklog where id = ?"`)
        assertType<Exact<typeof plain, { mld?: Date; mlt?: Date }>>()
        expect(plain).toEqual({})

        ctx.mockNext({ mldt: null })
        const dt = await c.selectFrom(tIssue)
            .where(tIssue.id.equals(-1))
            .select({ mldt: c.aggregateFragmentWithType('localDateTime', 'optional').sql`max(${tIssue.createdAt})` })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(created_at) as mldt from issue where id = ?"`)
        assertType<Exact<typeof dt, { mldt?: Date }>>()
        expect(dt).toEqual({})

        ctx.mockNext({ mcld: null, mclt: null, mcldt: null })
        const custom = await c.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(-1))
            .select({
                mcld:  c.aggregateFragmentWithType<Date, 'ReleaseDay'>('customLocalDate', 'ReleaseDay', 'optional').sql`max(${tProjectRelease.releasedOn})`,
                mclt:  c.aggregateFragmentWithType<Date, 'CutoffClock'>('customLocalTime', 'CutoffClock', 'optional').sql`max(${tProjectRelease.cutoffTime})`,
                mcldt: c.aggregateFragmentWithType<Date, 'SignOffStamp'>('customLocalDateTime', 'SignOffStamp', 'optional').sql`max(${tProjectRelease.signedOffAt})`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(released_on) as mcld, max(cutoff_time) as mclt, max(signed_off_at) as mcldt from project_release where id = ?"`)
        assertType<Exact<typeof custom, { mcld?: Date; mclt?: Date; mcldt?: Date }>>()
        expect(custom).toEqual({})
    })

    test('aggregate-fragment-with-type-optional-custom-scalar-arms', async () => {
        // The `'optional'` arm of aggregateFragmentWithType for the branded scalar
        // kinds customInt / customDouble / enum (over worklogs) and customComparable
        // / custom (over releases). A no-match WHERE resolves each aggregate over an
        // EMPTY group -> NULL -> the optional branded leaf's absent inhabitant.
        const c = ctx.conn
        ctx.mockNext({ mci: null, mcd: null, men: null })
        const wl = await c.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(-1))
            .select({
                mci: c.aggregateFragmentWithType<number, 'Cents'>('customInt', 'Cents', 'optional').sql`max(${tIssueWorklog.costCents})`,
                mcd: c.aggregateFragmentWithType<number, 'Money'>('customDouble', 'Money', 'optional').sql`max(${tIssueWorklog.billedAmount})`,
                men: c.aggregateFragmentWithType<WorklogActivity, 'WorklogActivity'>('enum', 'WorklogActivity', 'optional').sql`max(${tIssueWorklog.activity})`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(cost_cents) as mci, max(billed_amount) as mcd, max(activity) as men from issue_worklog where id = ?"`)
        assertType<Exact<typeof wl, { mci?: number; mcd?: number; men?: WorklogActivity }>>()
        expect(wl).toEqual({})

        ctx.mockNext({ mcc: null, mc: null })
        const rel = await c.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(-1))
            .select({
                mcc: c.aggregateFragmentWithType<string, 'Semver'>('customComparable', 'Semver', 'optional').sql`max(${tProjectRelease.version})`,
                mc:  c.aggregateFragmentWithType<ReleaseChannel, 'ReleaseChannel'>('custom', 'ReleaseChannel', 'optional').sql`max(${tProjectRelease.channel})`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(version) as mcc, max(channel) as mc from project_release where id = ?"`)
        assertType<Exact<typeof rel, { mcc?: string; mc?: ReleaseChannel }>>()
        expect(rel).toEqual({})
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(channel) as maxChannel from project_release"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof chRow, { maxChannel: ReleaseChannel }>>()
        expect(chRow).toEqual(expectedCh)
    })

    test('fragment-with-type-custom-double-and-local-date-time-arms', async () => {
        // `fragmentWithType('customDouble', ...)` builds a CustomDoubleFragmentExpression
        // carrying the 'Money' typeName (marshalled to double), and
        // `fragmentWithType('localDateTime', 'required')` reads a full timestamp
        // back. Worklog 1's billed_amount is 200; release 1's signed_off_at is
        // 2024-01-14 12:30.
        const c = ctx.conn
        const expectedAmt = { amt: 200 }
        ctx.mockNext(expectedAmt)
        const amtRow = await c.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                amt: c.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required').sql`${tIssueWorklog.billedAmount}`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select billed_amount as amt from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof amtRow, { amt: number }>>()
        expect(amtRow).toEqual(expectedAmt)

        const expectedSoff = { soff: new Date(Date.UTC(2024, 0, 14, 12, 30, 0)) }
        ctx.mockNext(expectedSoff)
        const soffRow = await c.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                soff: c.fragmentWithType('localDateTime', 'required').sql`${tProjectRelease.signedOffAt}`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select signed_off_at as soff from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof soffRow, { soff: Date }>>()
        expect(soffRow).toEqual(expectedSoff)
    })

    test('fragment-with-type-threads-a-trailing-type-adapter', async () => {
        // The trailing `adapter?` argument of `fragmentWithType(...)`: a
        // non-identity adapter brackets the read value, so reading the string
        // fragment back applies `transformValueFromDB` through the adapter. The
        // mock is primed with the RAW db value; the adapter brackets it on the
        // way out. Worklog 1: upper(activity) = 'CODING' -> '[CODING]'.
        ctx.mockNext({ tagged: 'CODING' })
        const expected = { tagged: '[CODING]' }
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                tagged: ctx.conn.fragmentWithType('string', 'required', bracketAdapter).sql`upper(${tIssueWorklog.activity})`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select upper(activity) as tagged from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { tagged: string }>>()
        expect(row).toEqual(expected)
    })

    test('aggregate-fragment-with-type-threads-a-trailing-type-adapter', async () => {
        // `aggregateFragmentWithType(...)` with a trailing adapter: the
        // non-identity `bracketAdapter` brackets the value read back. The mock
        // is primed with the RAW value; the adapter brackets it on the way out.
        // Issue 1's worklogs {coding, meeting} ->
        // max(upper(activity)) = 'MEETING' -> '[MEETING]'.
        ctx.mockNext({ tagged: 'MEETING' })
        const expected = { tagged: '[MEETING]' }
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.issueId.equals(1))
            .select({
                tagged: ctx.conn.aggregateFragmentWithType('string', 'required', bracketAdapter).sql`max(upper(${tIssueWorklog.activity}))`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(upper(activity)) as tagged from issue_worklog where issue_id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { tagged: string }>>()
        expect(row).toEqual(expected)
    })
    test('fragment-with-type-custom-kind-threads-a-trailing-type-adapter', async () => {
        // The custom-kind `fragmentWithType(type, typeName, required, adapter)`
        // overload threads the trailing adapter into the read: bracketAdapter
        // brackets release 1's version ('1.2.0'), read back through the
        // customComparable 'Semver' fragment. The mock is primed with the RAW
        // value; the adapter brackets it on the way out.
        ctx.mockNext({ v: '1.2.0' })
        const expected = { v: '[1.2.0]' }
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                v: ctx.conn.fragmentWithType<string, 'Semver'>('customComparable', 'Semver', 'required', bracketAdapter).sql`${tProjectRelease.version}`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as \`v\` from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { v: string }>>()
        expect(row).toEqual(expected)
    })

    test('aggregate-fragment-with-type-custom-kind-threads-a-trailing-type-adapter', async () => {
        // The custom-kind `aggregateFragmentWithType(type, typeName, required, adapter)`
        // overload threads the trailing adapter into the read. bracketAdapter brackets
        // max(version) over the releases, read through the customComparable 'Semver'
        // aggregate fragment. Versions {1.2.0, 1.3.0-beta.1, 0.9.0} -> max
        // '1.3.0-beta.1' -> '[1.3.0-beta.1]'.
        ctx.mockNext({ v: '1.3.0-beta.1' })
        const expected = { v: '[1.3.0-beta.1]' }
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .select({
                v: ctx.conn.aggregateFragmentWithType<string, 'Semver'>('customComparable', 'Semver', 'required', bracketAdapter).sql`max(${tProjectRelease.version})`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(version) as \`v\` from project_release"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { v: string }>>()
        expect(row).toEqual(expected)
    })


    test('aggregate-fragment-with-type-local-time-threads-a-trailing-type-adapter', async () => {
        // The TEMPORAL `localTime` return arm of `aggregateFragmentWithType(...)`
        // with a trailing adapter: `shiftHourAdapter` shifts the read value +1h. The
        // mock is primed with the RAW aggregated value; the adapter shifts it on the
        // way out. Issue 1's worklogs {09:15, 10:30} -> max(started_at) = 10:30 ->
        // +1h -> 11:30.
        ctx.mockNext({ mlt: new Date(Date.UTC(1970, 0, 1, 10, 30, 0)) })
        const expected = { mlt: new Date(Date.UTC(1970, 0, 1, 11, 30, 0)) }
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.issueId.equals(1))
            .select({
                mlt: ctx.conn.aggregateFragmentWithType('localTime', 'required', shiftHourAdapter).sql`max(${tIssueWorklog.startedAt})`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(started_at) as mlt from issue_worklog where issue_id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { mlt: Date }>>()
        expect(row).toEqual(expected)
    })

    test('aggregate-fragment-with-type-local-date-time-threads-a-trailing-type-adapter', async () => {
        // The TEMPORAL `localDateTime` return arm of `aggregateFragmentWithType(...)`
        // with a trailing adapter. Releases' signed_off_at {2024-01-14 12:30, NULL,
        // 2024-02-28 09:00} -> max = 2024-02-28 09:00 -> +1h -> 10:00.
        ctx.mockNext({ mldt: new Date(Date.UTC(2024, 1, 28, 9, 0, 0)) })
        const expected = { mldt: new Date(Date.UTC(2024, 1, 28, 10, 0, 0)) }
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .select({
                mldt: ctx.conn.aggregateFragmentWithType('localDateTime', 'required', shiftHourAdapter).sql`max(${tProjectRelease.signedOffAt})`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(signed_off_at) as mldt from project_release"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { mldt: Date }>>()
        expect(row).toEqual(expected)
    })

    test('aggregate-fragment-with-type-custom-local-time-threads-a-trailing-type-adapter', async () => {
        // The CUSTOM-kind `customLocalTime` ('CutoffClock') return arm with a
        // trailing adapter. Releases'
        // cutoff_time {17:00, 18:30, 16:00} -> max = 18:30 -> +1h -> 19:30.
        ctx.mockNext({ mct: new Date(Date.UTC(1970, 0, 1, 18, 30, 0)) })
        const expected = { mct: new Date(Date.UTC(1970, 0, 1, 19, 30, 0)) }
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .select({
                mct: ctx.conn.aggregateFragmentWithType<Date, 'CutoffClock'>('customLocalTime', 'CutoffClock', 'required', shiftHourAdapter).sql`max(${tProjectRelease.cutoffTime})`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(cutoff_time) as mct from project_release"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { mct: Date }>>()
        expect(row).toEqual(expected)
    })

    test('aggregate-fragment-with-type-custom-local-date-time-threads-a-trailing-type-adapter', async () => {
        // The CUSTOM-kind `customLocalDateTime` ('SignOffStamp') return arm with a
        // trailing adapter. max(signed_off_at) = 2024-02-28
        // 09:00 -> +1h -> 10:00.
        ctx.mockNext({ mcdt: new Date(Date.UTC(2024, 1, 28, 9, 0, 0)) })
        const expected = { mcdt: new Date(Date.UTC(2024, 1, 28, 10, 0, 0)) }
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .select({
                mcdt: ctx.conn.aggregateFragmentWithType<Date, 'SignOffStamp'>('customLocalDateTime', 'SignOffStamp', 'required', shiftHourAdapter).sql`max(${tProjectRelease.signedOffAt})`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(signed_off_at) as mcdt from project_release"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { mcdt: Date }>>()
        expect(row).toEqual(expected)
    })

    test('aggregate-fragment-with-type-local-date-threads-a-trailing-type-adapter', async () => {
        // The TEMPORAL `localDate` return arm with a trailing adapter. The localDate
        // marshaller rejects a real date-only echo through the shifting adapter, so
        // the value is asserted MOCK-ONLY (real-DB asserts structurally). max(work_date)
        // over the worklogs {2024-03-04, 2024-03-05, 2024-03-06} = 2024-03-06 -> +1h.
        // The mock localDate marshaller reads the date back at 10:00 UTC (the same
        // date-only echo the existing localDate arms show), so the +1h adapter lands
        // it at 11:00.
        ctx.mockNext({ mld: new Date(Date.UTC(2024, 2, 6, 0, 0, 0)) })
        const expected = { mld: new Date(Date.UTC(2024, 2, 6, 11, 0, 0)) }
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                mld: ctx.conn.aggregateFragmentWithType('localDate', 'required', shiftHourAdapter).sql`max(${tIssueWorklog.workDate})`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(work_date) as mld from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { mld: Date }>>()
        if (ctx.realDbEnabled) {
            expect(row.mld instanceof Date).toBe(true)
        } else {
            expect(row).toEqual(expected)
        }
    })

    test('aggregate-fragment-with-type-custom-local-date-threads-a-trailing-type-adapter', async () => {
        // The CUSTOM-kind `customLocalDate` ('ReleaseDay') return arm with a trailing
        // adapter. Same localDate marshaller boundary, so the
        // value is asserted MOCK-ONLY. max(released_on) over {2024-01-15, 2024-02-20,
        // 2024-03-01} = 2024-03-01 -> +1h.
        // The mock localDate marshaller reads the date back at 10:00 UTC, so the
        // +1h adapter lands it at 11:00.
        ctx.mockNext({ mcd: new Date(Date.UTC(2024, 2, 1, 0, 0, 0)) })
        const expected = { mcd: new Date(Date.UTC(2024, 2, 1, 11, 0, 0)) }
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .select({
                mcd: ctx.conn.aggregateFragmentWithType<Date, 'ReleaseDay'>('customLocalDate', 'ReleaseDay', 'required', shiftHourAdapter).sql`max(${tProjectRelease.releasedOn})`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(released_on) as mcd from project_release"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { mcd: Date }>>()
        if (ctx.realDbEnabled) {
            expect(row.mcd instanceof Date).toBe(true)
        } else {
            expect(row).toEqual(expected)
        }
    })

    test('fragment-with-type-optional-arms-over-worklog', async () => {
        // The `'optional'` arms of the boolean / localDate / localTime /
        // customInt / customDouble / enum return families. The SQL is identical
        // to the required form; only the leaf widens to `?: T`.
        // Worklog 1: billable TRUE, work_date 2024-03-04, started_at 09:15,
        // cost_cents 100 (Cents -> number), billed_amount 200 (Money -> number),
        // activity 'coding'. Every column is present, so each value round-trips.
        const expected = {
            bill: true,
            wd:   new Date(Date.UTC(2024, 2, 4, 10, 0, 0)),
            st:   new Date(Date.UTC(1970, 0, 1, 9, 15, 0)),
            cost: 100,
            amt:  200,
            act:  'coding' as WorklogActivity,
        }
        ctx.mockNext([expected])
        const c = ctx.conn
        const rows = await c.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                bill: c.fragmentWithType('boolean', 'optional').sql`${tIssueWorklog.billable}`,
                wd:   c.fragmentWithType('localDate', 'optional').sql`${tIssueWorklog.workDate}`,
                st:   c.fragmentWithType('localTime', 'optional').sql`${tIssueWorklog.startedAt}`,
                cost: c.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'optional').sql`${tIssueWorklog.costCents}`,
                amt:  c.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'optional').sql`${tIssueWorklog.billedAmount}`,
                act:  c.fragmentWithType<WorklogActivity, 'WorklogActivity'>('enum', 'WorklogActivity', 'optional').sql`${tIssueWorklog.activity}`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select billable as bill, work_date as wd, started_at as st, cost_cents as cost, billed_amount as amt, activity as act from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            bill?: boolean; wd?: Date; st?: Date;
            cost?: number; amt?: number; act?: WorklogActivity
        }>>>()
        expect(rows).toEqual([expected])
    })

    test('fragment-with-type-optional-arms-over-release', async () => {
        // The `'optional'` arms of the customUuid / customLocalDate /
        // customLocalTime / customLocalDateTime / customComparable return
        // families. The SQL is identical to the required form; only the leaf
        // widens to `?: T`. Release 1: signing key the seeded uuid,
        // released 2024-01-15, cutoff 17:00, signed off 2024-01-14 12:30,
        // version 1.2.0. Every column is present, so each value round-trips.
        const REF1 = '0a8f9c1e-1111-4222-8333-444455556666'
        const expected = {
            key:  REF1,
            rOn:  new Date(Date.UTC(2024, 0, 15, 10, 0, 0)),
            cut:  new Date(Date.UTC(1970, 0, 1, 17, 0, 0)),
            soff: new Date(Date.UTC(2024, 0, 14, 12, 30, 0)),
            v:    '1.2.0',
        }
        ctx.mockNext([expected])
        const c = ctx.conn
        const rows = await c.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                key:  c.fragmentWithType<string, 'SigningKey'>('customUuid', 'SigningKey', 'optional').sql`${tProjectRelease.signingKey}`,
                rOn:  c.fragmentWithType<Date, 'ReleaseDay'>('customLocalDate', 'ReleaseDay', 'optional').sql`${tProjectRelease.releasedOn}`,
                cut:  c.fragmentWithType<Date, 'CutoffClock'>('customLocalTime', 'CutoffClock', 'optional').sql`${tProjectRelease.cutoffTime}`,
                soff: c.fragmentWithType<Date, 'SignOffStamp'>('customLocalDateTime', 'SignOffStamp', 'optional').sql`${tProjectRelease.signedOffAt}`,
                v:    c.fragmentWithType<string, 'Semver'>('customComparable', 'Semver', 'optional').sql`${tProjectRelease.version}`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select signing_key as \`key\`, released_on as rOn, cutoff_time as cut, signed_off_at as soff, version as \`v\` from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            key?: string; rOn?: Date; cut?: Date;
            soff?: Date; v?: string
        }>>>()
        expect(rows).toEqual([expected])
    })

    test('fragment-with-type-optional-arm-plain-local-date-time', async () => {
        // The `'optional'` arm of the plain `localDateTime` return family, over a
        // genuinely plain localDateTime column (the release date/time columns are
        // custom-branded). Organization 1's created_at carries an explicit,
        // deterministic 2023-06-15 08:00 (not the CURRENT_TIMESTAMP default), so
        // the present value round-trips; the leaf widens to `?: Date`.
        const expected = {
            ca: new Date(Date.UTC(2023, 5, 15, 8, 0, 0)),
        }
        ctx.mockNext([expected])
        const c = ctx.conn
        const rows = await c.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                ca: c.fragmentWithType('localDateTime', 'optional').sql`${tOrganization.createdAt}`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select created_at as ca from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ ca?: Date }>>>()
        expect(rows).toEqual([expected])
    })
    test('fragment-with-type-boolean-threads-a-trailing-type-adapter', async () => {
        // The `boolean` return arm of `fragmentWithType(...)` with a trailing
        // adapter. `negateBoolAdapter` flips the read boolean; the mock is primed
        // with the RAW db value. Worklog 1's
        // billable is TRUE, read back through the adapter -> false. Both the
        // `'required'` and `'optional'` arms thread the adapter identically (the
        // SQL is the same; only the optional leaf widens).
        ctx.mockNext({ req: true, opt: true })
        const expected = { req: false, opt: false }
        const c = ctx.conn
        const row = await c.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                req: c.fragmentWithType('boolean', 'required', negateBoolAdapter).sql`${tIssueWorklog.billable}`,
                opt: c.fragmentWithType('boolean', 'optional', negateBoolAdapter).sql`${tIssueWorklog.billable}`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select billable as req, billable as opt from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { req: boolean; opt?: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('fragment-with-type-local-date-threads-a-trailing-type-adapter', async () => {
        // The TEMPORAL `localDate` return arm of `fragmentWithType(...)` with a
        // trailing adapter over a plain column read. `shiftHourAdapter` shifts the
        // read value +1h. Worklog 1's work_date 2024-03-04 reads back at 10:00 UTC
        // (the date-only echo) -> +1h -> 11:00 UTC.
        ctx.mockNext({ wd: new Date(Date.UTC(2024, 2, 4, 10, 0, 0)) })
        const expected = { wd: new Date(Date.UTC(2024, 2, 4, 11, 0, 0)) }
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                wd: ctx.conn.fragmentWithType('localDate', 'required', shiftHourAdapter).sql`${tIssueWorklog.workDate}`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select work_date as wd from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { wd: Date }>>()
        expect(row).toEqual(expected)
    })

    test('fragment-with-type-custom-local-date-threads-a-trailing-type-adapter', async () => {
        // The CUSTOM-kind `customLocalDate` ('ReleaseDay') return arm of
        // `fragmentWithType(type, typeName, required, adapter)` over a plain column
        // read. `shiftHourAdapter` shifts the read value +1h. Release 1's
        // released_on 2024-01-15 reads back at 10:00 UTC -> +1h -> 11:00 UTC.
        ctx.mockNext({ rOn: new Date(Date.UTC(2024, 0, 15, 10, 0, 0)) })
        const expected = { rOn: new Date(Date.UTC(2024, 0, 15, 11, 0, 0)) }
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                rOn: ctx.conn.fragmentWithType<Date, 'ReleaseDay'>('customLocalDate', 'ReleaseDay', 'required', shiftHourAdapter).sql`${tProjectRelease.releasedOn}`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select released_on as rOn from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { rOn: Date }>>()
        expect(row).toEqual(expected)
    })

})
