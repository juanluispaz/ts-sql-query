// Coverage of column-factory overloads the original four domain tables
// don't exercise, declared on the real `issue_worklog` / `project_release`
// fixtures:
//   - date-only (`localDate`) / time-only (`localTime`) columns
//   - a nullable plain boolean with NO adapter
//   - a nullable bigint
//   - a plain `enum` column (not virtual)
//   - an `optionalColumnWithDefaultValue` (omittable + nullable)
//   - branded `customLocalDate/Time/DateTime` columns
//   - a `custom` (equality-only) column
//   - a `customComparable` column (confers `<` / between / orderBy)
//
// Each round-trips: the projected TYPE (`assertType`), the emitted SQL
// (snapshot) and — where the value is driver-stable — the runtime value.
// Date/time values use the structural `ctx.realDbEnabled` guard because
// each driver normalises them differently (the exhaustive value matrix
// lives in config.datetime-roundtrip.test.ts). TZ=UTC is forced by the
// suite (test/lib/setupTimezone.ts).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssueWorklog, tProjectRelease } from '../../domain/connection.js'
import type { ReleaseChannel, WorklogActivity } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('local-date-and-local-time-columns-project-as-date', async () => {
        // `column(name, 'localDate')` and `column(name, 'localTime')`
        // project as a JS Date. Worklog 1: work_date 2024-03-04,
        // started_at 09:15:00.
        // sqlite normalises a date-only value to 10:00 UTC and a time-only
        // value onto 1970-01-01 (see config.datetime-roundtrip.test.ts); the
        // primed mock value is that same normalised Date, so one deep-equality
        // assertion holds in both mock and real modes. `workDate` is a required
        // localDate column; `startedAt` is an optional localTime column (a
        // worklog whose start clock-time wasn't recorded), so it projects as
        // `Date | undefined`. Worklog 1 has both set.
        const expected = [{ id: 1, workDate: new Date(Date.UTC(2024, 2, 4, 10, 0, 0)), startedAt: new Date(Date.UTC(1970, 0, 1, 9, 15, 0)) }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id:        tIssueWorklog.id,
                workDate:  tIssueWorklog.workDate,
                startedAt: tIssueWorklog.startedAt,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", work_date as "workDate", started_at as "startedAt" from issue_worklog where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; workDate: Date; startedAt?: Date }>>>()
        expect(rows).toEqual(expected)
    })

    test('optional-plain-boolean-column-projects-as-optional-boolean', async () => {
        // `optionalColumn(name, 'boolean')` with NO adapter →
        // `boolean | undefined`, marshalled from the native 0/1 storage
        // (distinct from the Y/N CustomBooleanTypeAdapter columns). Worklog
        // 1 billable=true, 2 false, 3 NULL (absent).
        ctx.mockNext([
            { id: 1, billable: true },
            { id: 2, billable: false },
            { id: 3, billable: undefined },
        ])
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .select({ id: tIssueWorklog.id, billable: tIssueWorklog.billable })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", billable as "billable" from issue_worklog order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; billable?: boolean }>>>()
        expect(rows).toEqual([
            { id: 1, billable: true },
            { id: 2, billable: false },
            { id: 3 },
        ])
    })

    test('optional-bigint-column-projects-as-optional-bigint', async () => {
        // `optionalColumn(name, 'bigint')` → `bigint | undefined`.
        // Worklog 1 duration_ms 5400000, worklog 2 NULL (absent).
        ctx.mockNext([
            { id: 1, durationMs: 5400000n },
            { id: 2, durationMs: undefined },
        ])
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.in([1, 2]))
            .select({ id: tIssueWorklog.id, durationMs: tIssueWorklog.durationMs })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", duration_ms as "durationMs" from issue_worklog where id in (:0, :1) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; durationMs?: bigint }>>>()
        expect(rows).toEqual([
            { id: 1, durationMs: 5400000n },
            { id: 2 },
        ])
    })

    test('plain-enum-column-projects-as-the-enum-union', async () => {
        // `column(name, 'enum', 'WorklogActivity')` — a plain (non-virtual)
        // enum column. Projects as the enum value union.
        ctx.mockNext([
            { id: 1, activity: 'coding' },
            { id: 2, activity: 'review' },
            { id: 3, activity: 'meeting' },
        ])
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .select({ id: tIssueWorklog.id, activity: tIssueWorklog.activity })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", activity as "activity" from issue_worklog order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; activity: WorklogActivity }>>>()
        expect(rows).toEqual([
            { id: 1, activity: 'coding' },
            { id: 2, activity: 'review' },
            { id: 3, activity: 'meeting' },
        ])
    })

    test('optional-column-with-default-value-projects-optional-and-is-omittable-on-insert', async () => {
        // `optionalColumnWithDefaultValue(name, 'int')` →
        // `'optional' & ColumnWithDefaultValue`: projects as `number |
        // undefined`, AND is omittable on insert (the DB DEFAULT applies).
        // Worklog 2 left minutes running → NULL (absent).
        ctx.mockNext([
            { id: 1, minutes: 90 },
            { id: 2, minutes: undefined },
        ])
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.in([1, 2]))
            .select({ id: tIssueWorklog.id, minutes: tIssueWorklog.minutes })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", minutes as "minutes" from issue_worklog where id in (:0, :1) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; minutes?: number }>>>()
        expect(rows).toEqual([
            { id: 1, minutes: 90 },
            { id: 2 },
        ])

        // Omittable on insert: a values object without `minutes` typechecks
        // (the column has a DB default). `startedAt` is also omitted — it is an
        // optional column, so leaving it out of the insert is valid.
        await ctx.withRollback(async () => {
            ctx.mockNext(99)
            const inserted = await ctx.conn.insertInto(tIssueWorklog)
                .values({ issueId: 1, workDate: new Date(Date.UTC(2024, 2, 7, 10, 0, 0)), activity: 'coding' })
                .executeInsert()
            assertType<Exact<typeof inserted, number>>()
            expect(typeof inserted).toBe('number')
            // On a real engine the row was genuinely added (3 seeded + 1) —
            // the proof the column is omittable, not that the call just
            // type-checks.
            if (ctx.realDbEnabled) {
                const ids = await ctx.conn.selectFrom(tIssueWorklog)
                    .selectOneColumn(tIssueWorklog.id)
                    .executeSelectMany()
                expect(ids).toHaveLength(4)
            }
        })
    })

    test('custom-local-date-time-columns-project-as-date', async () => {
        // branded `customLocalDate` / `customLocalTime` /
        // `customLocalDateTime` columns project as JS Date (the optional one
        // as `Date | undefined`). Release 1: released_on 2024-01-15,
        // cutoff_time 17:00:00, signed_off_at 2024-01-14 12:30:00.
        // Same normalisation as the plain localDate/localTime columns above
        // (the branded customLocal* types marshal through their native base
        // localDate / localTime / localDateTime); one deep-equality assertion
        // holds in both modes.
        const expected = [{
            id: 1,
            releasedOn:  new Date(Date.UTC(2024, 0, 15, 10, 0, 0)),
            cutoffTime:  new Date(Date.UTC(1970, 0, 1, 17, 0, 0)),
            signedOffAt: new Date(Date.UTC(2024, 0, 14, 12, 30, 0)),
        }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                id:          tProjectRelease.id,
                releasedOn:  tProjectRelease.releasedOn,
                cutoffTime:  tProjectRelease.cutoffTime,
                signedOffAt: tProjectRelease.signedOffAt,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", released_on as "releasedOn", cutoff_time as "cutoffTime", signed_off_at as "signedOffAt" from project_release where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; releasedOn: Date; cutoffTime: Date; signedOffAt?: Date }>>>()
        expect(rows).toEqual(expected)
    })

    test('custom-equality-only-column-projects-as-its-branded-type', async () => {
        // `column(name, 'custom', 'ReleaseChannel')` → a TypeAdapter
        // backed EqualableValueSource carrying the branded `ReleaseChannel`
        // type; equality is the available operator. Release 1 channel
        // 'stable'.
        ctx.mockNext([{ id: 1, channel: 'stable' }])
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.equals('stable'))
            .select({ id: tProjectRelease.id, channel: tProjectRelease.channel })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", channel as "channel" from project_release where channel = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "stable",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; channel: ReleaseChannel }>>>()
        expect(rows).toEqual([{ id: 1, channel: 'stable' }])
    })

    test('custom-comparable-column-confers-ordering-operators', async () => {
        // `column(name, 'customComparable', 'Semver')` → a
        // ComparableValueSource: `lessThan` / `between` / `orderBy` are all
        // available at the column site (an `EqualableValueSource` could not
        // express them). Versions below 1.3.0: release 1 (1.2.0) and 3
        // (0.9.0); ordered descending.
        ctx.mockNext([
            { id: 1, version: '1.2.0' },
            { id: 3, version: '0.9.0' },
        ])
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.lessThan('1.3.0'))
            .select({ id: tProjectRelease.id, version: tProjectRelease.version })
            .orderBy('version', 'desc')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", version as "version" from project_release where version < :0 order by "version" desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.3.0",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; version: string }>>>()
        expect(rows).toEqual([
            { id: 1, version: '1.2.0' },
            { id: 3, version: '0.9.0' },
        ])
    })
    test('custom-comparable-comparison-surface', async () => {
        // lessOrEqual / between / in / notEquals on a `customComparable` column
        // all yield a plain boolean (the brand does not survive a predicate),
        // projected as boolean columns. Release 1 version '1.2.0' satisfies all
        // four.
        ctx.mockNext([{ id: 1, le: true, bt: true, isin: true, ne: true }])
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                id:   tProjectRelease.id,
                le:   tProjectRelease.version.lessOrEqual('1.3.0'),
                bt:   tProjectRelease.version.between('0.9.0', '1.3.0'),
                isin: tProjectRelease.version.in(['1.2.0', '0.9.0']),
                ne:   tProjectRelease.version.notEquals('0.9.0'),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", case when version <= :0 then 1 else 0 end as "le", case when version between :1 and :2 then 1 else 0 end as "bt", case when version in (:3, :4) then 1 else 0 end as "isin", case when version <> :5 then 1 else 0 end as "ne" from project_release where id = :6"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.3.0",
            "0.9.0",
            "1.3.0",
            "1.2.0",
            "0.9.0",
            "0.9.0",
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; le: boolean; bt: boolean; isin: boolean; ne: boolean }>>>()
        expect(rows).toEqual([{ id: 1, le: true, bt: true, isin: true, ne: true }])
    })

    test('custom-equality-only-non-equals-surface', async () => {
        // in / notIn / notEquals on an equality-only `custom` column all yield
        // a plain boolean. Release 1 channel 'stable' is in {stable,beta}, not
        // in {canary}, and != 'canary'.
        ctx.mockNext([{ id: 1, isin: true, notin: true, ne: true }])
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                id:    tProjectRelease.id,
                isin:  tProjectRelease.channel.in(['stable', 'beta']),
                notin: tProjectRelease.channel.notIn(['canary']),
                ne:    tProjectRelease.channel.notEquals('canary'),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", case when channel in (:0, :1) then 1 else 0 end as "isin", case when channel not in (:2) then 1 else 0 end as "notin", case when channel <> :3 then 1 else 0 end as "ne" from project_release where id = :4"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "stable",
            "beta",
            "canary",
            "canary",
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; isin: boolean; notin: boolean; ne: boolean }>>>()
        expect(rows).toEqual([{ id: 1, isin: true, notin: true, ne: true }])
    })

    test('custom-brand-survives-nullable-and-optionality-modifiers', async () => {
        // valueWhenNull / asOptional return the same branded value source,
        // flipping only optionality. valueWhenNull on the optional customUuid
        // `signingKey` makes it required (leaf `string`); asOptional on the
        // required customLocalDate `releasedOn` makes it optional (leaf `Date`,
        // projected `ro?: Date`). Release 2 has a NULL signing_key (so the
        // fallback wins) and released_on 2024-02-20 (normalised to 10:00 UTC).
        const NIL_UUID = '00000000-0000-0000-0000-000000000000'
        const ro = new Date(Date.UTC(2024, 1, 20, 10, 0, 0))
        ctx.mockNext([{ id: 2, key: NIL_UUID, ro }])
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(2))
            .select({
                id:  tProjectRelease.id,
                key: tProjectRelease.signingKey.valueWhenNull(NIL_UUID),
                ro:  tProjectRelease.releasedOn.asOptional(),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", raw_to_uuid(nvl(signing_key, uuid_to_raw(:0))) as "key", released_on as "ro" from project_release where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "00000000-0000-0000-0000-000000000000",
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; key: string; ro?: Date }>>>()
        expect(rows).toEqual([{ id: 2, key: NIL_UUID, ro }])
    })
    test('const-sourced-custom-comparable-operator', async () => {
        // An operator on a const-sourced custom value: a `customComparable`
        // const is the receiver, compared to the typed `version` column to keep
        // the SQL resolvable on every engine ('0.5.0' < version). Release 1
        // version 1.2.0 -> true.
        ctx.mockNext([{ id: 1, lt: true }])
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                id: tProjectRelease.id,
                lt: ctx.conn.const<string, 'Semver'>('0.5.0', 'customComparable', 'Semver')
                    .lessThan(tProjectRelease.version),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", case when :0 < version then 1 else 0 end as "lt" from project_release where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0.5.0",
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; lt: boolean }>>>()
        expect(rows).toEqual([{ id: 1, lt: true }])
    })
})
