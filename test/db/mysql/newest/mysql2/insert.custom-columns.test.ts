// Write-side coverage for the custom / computed / virtual column kinds on the
// branded `tProjectRelease` / `tIssueWorklog` tables: a full insert marshalling
// the customComparable / custom / customUuid / customLocal* columns (the
// computed `notes` and virtual `versionTag` are excluded from the emitted
// INSERT), `tIssueWorklog` insert variants (minutes / billable set or null, the
// required `activity` enum), and `insertFrom(select)` of branded customs.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProjectRelease, tIssueWorklog } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('insert-into-project-release-marshals-custom-columns', async () => {
        // A full insert over the branded release columns: the customComparable
        // `version`, custom `channel`, optional customUuid `signingKey`, and the
        // customLocalDate/Time/DateTime columns each marshal through their native
        // base type on the write path. The emitted INSERT column list excludes
        // the computed `notes` and virtual `versionTag` columns.
        await ctx.withRollback(async () => {
            ctx.mockNext(99)
            const inserted = await ctx.conn.insertInto(tProjectRelease)
                .values({
                    projectId:   1,
                    version:     '2.0.0',
                    channel:     'stable',
                    signingKey:  '11111111-2222-4333-8444-555566667777',
                    releasedOn:  new Date(Date.UTC(2024, 5, 1, 10, 0, 0)),
                    cutoffTime:  new Date(Date.UTC(1970, 0, 1, 18, 0, 0)),
                    signedOffAt: new Date(Date.UTC(2024, 5, 1, 9, 0, 0)),
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project_release (project_id, version, \`channel\`, signing_key, released_on, cutoff_time, signed_off_at) values (?, ?, ?, uuid_to_bin(?), ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "2.0.0",
                "stable",
                "11111111-2222-4333-8444-555566667777",
                2024-06-01T10:00:00.000Z,
                "18:00:00",
                2024-06-01T09:00:00.000Z,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(typeof inserted).toBe('number')
            // On a real engine the row was genuinely added (3 seeded + 1).
            if (ctx.realDbEnabled) {
                const ids = await ctx.conn.selectFrom(tProjectRelease)
                    .selectOneColumn(tProjectRelease.id)
                    .executeSelectMany()
                expect(ids).toHaveLength(4)
            }
        })
    })

    test('insert-worklog-with-minutes-and-nullable-columns-set', async () => {
        // A worklog insert setting every optional column to a value: `minutes`,
        // `billable`, `startedAt`, `durationMs`, plus the required `activity` enum.
        await ctx.withRollback(async () => {
            ctx.mockNext(99)
            const inserted = await ctx.conn.insertInto(tIssueWorklog)
                .values({
                    issueId:    1,
                    workDate:   new Date(Date.UTC(2024, 2, 10, 10, 0, 0)),
                    startedAt:  new Date(Date.UTC(1970, 0, 1, 8, 30, 0)),
                    minutes:    120,
                    durationMs: 7200000n,
                    billable:   true,
                    activity:   'review',
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue_worklog (issue_id, work_date, started_at, minutes, duration_ms, billable, activity) values (?, ?, ?, ?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                2024-03-10T10:00:00.000Z,
                "08:30:00",
                120,
                7200000n,
                true,
                "review",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(typeof inserted).toBe('number')
            if (ctx.realDbEnabled) {
                const ids = await ctx.conn.selectFrom(tIssueWorklog)
                    .selectOneColumn(tIssueWorklog.id)
                    .executeSelectMany()
                expect(ids).toHaveLength(4)
            }
        })
    })

    test('insert-worklog-with-minutes-and-billable-set-to-null', async () => {
        // The nullable columns set EXPLICITLY to null (distinct from omitting
        // them): `minutes` and `billable` emit NULL placeholders.
        await ctx.withRollback(async () => {
            ctx.mockNext(99)
            const inserted = await ctx.conn.insertInto(tIssueWorklog)
                .values({
                    issueId:  2,
                    workDate: new Date(Date.UTC(2024, 2, 11, 10, 0, 0)),
                    minutes:  null,
                    billable: null,
                    activity: 'meeting',
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue_worklog (issue_id, work_date, minutes, billable, activity) values (?, ?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
                2024-03-11T10:00:00.000Z,
                null,
                null,
                "meeting",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(typeof inserted).toBe('number')
        })
    })

    test('insert-from-select-projects-branded-customs-into-project-release', async () => {
        // `insertFrom(select)` projecting the branded custom columns into
        // `tProjectRelease`: a select cloning release 1's custom columns (with a
        // new `version` so it does not collide) flows the customComparable /
        // custom / customLocal* values straight into the INSERT.
        await ctx.withRollback(async () => {
            ctx.mockNext(99)
            const inserted = await ctx.conn.insertInto(tProjectRelease)
                .from(
                    ctx.conn.selectFrom(tProjectRelease)
                        .where(tProjectRelease.id.equals(1))
                        .select({
                            projectId:   tProjectRelease.projectId,
                            version:     ctx.conn.const('9.9.9', 'customComparable', 'Semver'),
                            channel:     tProjectRelease.channel,
                            signingKey:  tProjectRelease.signingKey,
                            releasedOn:  tProjectRelease.releasedOn,
                            cutoffTime:  tProjectRelease.cutoffTime,
                            signedOffAt: tProjectRelease.signedOffAt,
                        }),
                )
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project_release (project_id, version, \`channel\`, signing_key, released_on, cutoff_time, signed_off_at) select project_id as projectId, ? as version, \`channel\` as \`channel\`, signing_key as signingKey, released_on as releasedOn, cutoff_time as cutoffTime, signed_off_at as signedOffAt from project_release where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "9.9.9",
                1,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(typeof inserted).toBe('number')
            if (ctx.realDbEnabled) {
                const ids = await ctx.conn.selectFrom(tProjectRelease)
                    .selectOneColumn(tProjectRelease.id)
                    .executeSelectMany()
                expect(ids).toHaveLength(4)
            }
        })
    })

    // NOT-APPLICABLE: MySQL has no RETURNING
    /*
    test('insert-project-release-returning-branded-custom-column', async () => {
        // INSERT … RETURNING of a branded custom column:
        // `returningOneColumn(channel)` reads the value back as the branded
        // `ReleaseChannel`, not a widened `string`. `channel` is used rather
        // than `version` because `Semver` collapses to `string` structurally.
        await ctx.withRollback(async () => {
            ctx.mockNext('canary')
            const channel = await ctx.conn.insertInto(tProjectRelease)
                .values({
                    projectId:  1,
                    version:    '3.0.0',
                    channel:    'canary',
                    releasedOn: new Date(Date.UTC(2024, 6, 1, 10, 0, 0)),
                    cutoffTime: new Date(Date.UTC(1970, 0, 1, 12, 0, 0)),
                })
                .returningOneColumn(tProjectRelease.channel)
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project_release (project_id, version, channel, released_on, cutoff_time) values ($1, $2, $3, $4, $5) returning channel as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "3.0.0",
                "canary",
                2024-07-01T10:00:00.000Z,
                "12:00:00",
              ]
            `)
            assertType<Exact<typeof channel, ReleaseChannel>>()
            expect(channel).toBe('canary')
        })
    })
    */
})
