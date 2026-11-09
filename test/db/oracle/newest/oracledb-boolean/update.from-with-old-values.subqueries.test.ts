// `UPDATE … FROM` combined with `oldValues()` where a FROM-table column is read
// through an expression wrapper or a correlated `subSelectUsing(<from table>)`
// subquery, in SET or in RETURNING.
//
// Below compatibilityVersion 18_000_000 PostgreSQL has no native `old.` alias, so
// the pre-update row is synthesised as an `_old_` derived table that joins the
// FROM tables. Every FROM-table column the statement reads outside that derived
// table must be pre-projected into it as `<table>.<col> as <table>__<col>` and
// read back as `_old_.<table>__<col>`, including references that sit inside a
// subquery. A wrapper or subquery that fails to report its FROM-table column
// leaves a dangling `issue.<col>` reference outside the derived table, which the
// engine rejects.
//
// Data used throughout: issue 2 ('Redesign navbar', body 'Use new tokens',
// status 'in_progress', priority 1, assignee 2 = Grace Hopper, verified) belongs
// to project 1 ('Marketing site', org 1 Acme Corp) and has a single worklog
// (id 2, activity 'review').

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType } from '../../../../lib/assertType.js'
import { Values } from '../../../../../src/Values.js'
import {
    DBConnection,
    tAppUser,
    tIssue,
    tIssueWorklog,
    tOrganization,
    tProject,
    tWebhookEvent,
    vProjectOverview,
} from '../../domain/connection.js'
import { ctx } from './setup.js'

// Referenced by the commented-out tests below.
void assertType; void expect; void test

// Display labels for the issue status codes, joined in through a VALUES source.
class VStatusLabel extends Values<DBConnection, 'statusLabel'> {
    status = this.column('string')
    label  = this.column('string')
}

// Referenced by the commented-out tests below.
void tAppUser; void tIssue; void tIssueWorklog; void tOrganization; void tProject; void tWebhookEvent; void vProjectOverview

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: Oracle has no RETURNING OLD values (`tTable.oldValues()` is typed `never`); RETURNING INTO returns post-update values only, so pre-update values need a separate SELECT
    /*
    test('subselect-using-from-table-in-set-reads-the-pre-update-row', async () => {
        // Tag the project with the name of the assignee of issue 2. The subquery
        // correlates on `issue.assignee_id`, which only exists inside `_old_`.
        const expected = { id: 1, oldName: 'Marketing site', newName: 'Marketing site / Grace Hopper' }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const assigneeName = ctx.conn.subSelectUsing(tIssue).from(tAppUser)
                .where(tAppUser.id.equals(tIssue.assigneeId))
                .selectOneColumn(tAppUser.fullName)
                .forUseAsInlineQueryValue()
            const row = await ctx.conn.update(tProject)
                .from(tIssue)
                .set({ name: tProject.name.concat(' / ').concat(assigneeName.valueWhenNull('unassigned')) })
                .where(tIssue.id.equals(2))
                .and(tProject.id.equals(tIssue.projectId))
                .returning({
                    id:      tProject.id,
                    oldName: oldProject.name,
                    newName: tProject.name,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project _new_ set project.name = case when nvl((select full_name as "result" from app_user where id = _old_.issue__assignee_id), :0) is null then null else _new_.name || :1 || nvl((select full_name as "result" from app_user where id = _old_.issue__assignee_id), :2) end from (select _old_.*, issue.assignee_id as issue__assignee_id from project _old_, issue where issue.id = :3 and _old_.id = issue.project_id for no key update of _old_) _old_ where _new_.id = _old_.id returning _new_.id, _old_.name, _new_.name into :4, :5, :6"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "unassigned",
                " / ",
                "unassigned",
                2,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "oldName",
                  "dir": 3003,
                },
                {
                  "as": "newName",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, { id: number, oldName: string, newName: string }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no RETURNING OLD values (`tTable.oldValues()` is typed `never`); RETURNING INTO returns post-update values only, so pre-update values need a separate SELECT
    /*
    test('subselect-using-from-table-in-returning-with-order-by-and-limit', async () => {
        // The latest activity logged on the issue, read in RETURNING. The order by
        // and limit of the subquery stay inside it; the correlation on `issue.id`
        // is rewritten to the pre-projected `_old_` column.
        const expected = { id: 1, oldName: 'Marketing site', lastActivity: 'review' as const }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const lastActivity = ctx.conn.subSelectUsing(tIssue).from(tIssueWorklog)
                .where(tIssueWorklog.issueId.equals(tIssue.id))
                .selectOneColumn(tIssueWorklog.activity)
                .orderBy(tIssueWorklog.workDate, 'desc')
                .limit(1)
                .forUseAsInlineQueryValue()
            const row = await ctx.conn.update(tProject)
                .from(tIssue)
                .set({ name: 'Marketing site v2' })
                .where(tIssue.id.equals(2))
                .and(tProject.id.equals(tIssue.projectId))
                .returning({
                    id:      tProject.id,
                    oldName: oldProject.name,
                    lastActivity,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project _new_ set project.name = :0 from (select _old_.*, issue.id as issue__id from project _old_, issue where issue.id = :1 and _old_.id = issue.project_id for no key update of _old_) _old_ where _new_.id = _old_.id returning _new_.id, _old_.name, (select activity as "result" from issue_worklog where issue_id = _old_.issue__id order by issue_worklog.work_date desc fetch next :2 rows only) into :3, :4, :5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                2,
                1,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "oldName",
                  "dir": 3003,
                },
                {
                  "as": "lastActivity",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, { id: number, oldName: string, lastActivity?: WorklogActivity }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no RETURNING OLD values (`tTable.oldValues()` is typed `never`); RETURNING INTO returns post-update values only, so pre-update values need a separate SELECT
    /*
    test('subselect-using-from-table-with-optional-left-join-inside-the-subquery', async () => {
        // Two subqueries share an optional left join to the issue's worklog,
        // correlated on `issue.id`. The first reads the joined table, so the join
        // is kept; the second reads only the assignee, so the join is dropped.
        const expected = { id: 1, oldName: 'Marketing site', assigneeActivity: 'review' as const, assigneeName: 'Grace Hopper' }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const worklog = tIssueWorklog.forUseInLeftJoin()
            const assigneeActivity = ctx.conn.subSelectUsing(tIssue).from(tAppUser)
                .optionalLeftJoin(worklog).on(worklog.issueId.equals(tIssue.id))
                .where(tAppUser.id.equals(tIssue.assigneeId))
                .selectOneColumn(worklog.activity)
                .forUseAsInlineQueryValue()
            const assigneeName = ctx.conn.subSelectUsing(tIssue).from(tAppUser)
                .optionalLeftJoin(worklog).on(worklog.issueId.equals(tIssue.id))
                .where(tAppUser.id.equals(tIssue.assigneeId))
                .selectOneColumn(tAppUser.fullName)
                .forUseAsInlineQueryValue()
            const row = await ctx.conn.update(tProject)
                .from(tIssue)
                .set({ name: 'Marketing site v2' })
                .where(tIssue.id.equals(2))
                .and(tProject.id.equals(tIssue.projectId))
                .returning({
                    id:      tProject.id,
                    oldName: oldProject.name,
                    assigneeActivity,
                    assigneeName,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project _new_ set project.name = :0 from (select _old_.*, issue.assignee_id as issue__assignee_id, issue.id as issue__id from project _old_, issue where issue.id = :1 and _old_.id = issue.project_id for no key update of _old_) _old_ where _new_.id = _old_.id returning _new_.id, _old_.name, (select issue_worklog.activity as "result" from app_user left join issue_worklog on issue_worklog.issue_id = _old_.issue__id where app_user.id = _old_.issue__assignee_id), (select full_name as "result" from app_user where id = _old_.issue__assignee_id) into :2, :3, :4, :5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                2,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "oldName",
                  "dir": 3003,
                },
                {
                  "as": "assigneeActivity",
                  "dir": 3003,
                },
                {
                  "as": "assigneeName",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, {
                id:                number
                oldName:           string
                assigneeActivity?: WorklogActivity
                assigneeName?:     string
            }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no RETURNING OLD values (`tTable.oldValues()` is typed `never`); RETURNING INTO returns post-update values only, so pre-update values need a separate SELECT
    /*
    test('compound-subselect-using-from-table-in-returning', async () => {
        // The notification contact of the assignee: the email for a verified
        // user, the full name otherwise. Both arms of the union correlate on
        // `issue.assignee_id`; exactly one of them yields a row. Grace Hopper is
        // verified, so the email wins.
        const expected = { id: 1, oldName: 'Marketing site', contact: 'grace@acme.test' }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const contact = ctx.conn.subSelectUsing(tIssue).from(tAppUser)
                .where(tAppUser.id.equals(tIssue.assigneeId))
                .and(tAppUser.verified.equals(true))
                .selectOneColumn(tAppUser.email)
                .union(
                    ctx.conn.subSelectUsing(tIssue).from(tAppUser)
                        .where(tAppUser.id.equals(tIssue.assigneeId))
                        .and(tAppUser.verified.equals(false))
                        .selectOneColumn(tAppUser.fullName),
                )
                .forUseAsInlineQueryValue()
            const row = await ctx.conn.update(tProject)
                .from(tIssue)
                .set({ name: 'Marketing site v2' })
                .where(tIssue.id.equals(2))
                .and(tProject.id.equals(tIssue.projectId))
                .returning({
                    id:      tProject.id,
                    oldName: oldProject.name,
                    contact,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project _new_ set project.name = :0 from (select _old_.*, issue.assignee_id as issue__assignee_id from project _old_, issue where issue.id = :1 and _old_.id = issue.project_id for no key update of _old_) _old_ where _new_.id = _old_.id returning _new_.id, _old_.name, (select email as "result" from app_user where id = _old_.issue__assignee_id and case when verified = 'Y' then 1 else 0 end = :2 union select full_name as "result" from app_user where id = _old_.issue__assignee_id and case when verified = 'Y' then 1 else 0 end = :3) into :4, :5, :6"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                2,
                1,
                0,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "oldName",
                  "dir": 3003,
                },
                {
                  "as": "contact",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, { id: number, oldName: string, contact?: string }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no RETURNING OLD values (`tTable.oldValues()` is typed `never`); RETURNING INTO returns post-update values only, so pre-update values need a separate SELECT
    /*
    test('inline-aggregated-array-subselect-using-from-table-in-returning', async () => {
        // The issue's worklog as inline aggregated arrays: flat, with a nested
        // object per entry, grouped per activity, and disabled with
        // `onlyWhenOrNull(false)` (rendered as a literal null, read back as the
        // empty array).
        const expected = {
            id:          1,
            oldName:     'Marketing site',
            worklogs:    [{ id: 2, activity: 'review' as const }],
            entries:     [{ id: 2, detail: { activity: 'review' as const } }],
            perActivity: [{ activity: 'review' as const, logged: 1 }],
            skipped:     [],
        }
        ctx.mockNext({
            ...expected,
            worklogs:    JSON.stringify(expected.worklogs),
            // The engine returns the nested leaf under its flattened key.
            entries:     JSON.stringify([{ id: 2, 'detail.activity': 'review' }]),
            perActivity: JSON.stringify(expected.perActivity),
            skipped:     null,
        })

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const worklogs = ctx.conn.subSelectUsing(tIssue).from(tIssueWorklog)
                .where(tIssueWorklog.issueId.equals(tIssue.id))
                .select({ id: tIssueWorklog.id, activity: tIssueWorklog.activity })
                .orderBy('id')
                .forUseAsInlineAggregatedArrayValue()
            const entries = ctx.conn.subSelectUsing(tIssue).from(tIssueWorklog)
                .where(tIssueWorklog.issueId.equals(tIssue.id))
                .select({ id: tIssueWorklog.id, detail: { activity: tIssueWorklog.activity } })
                .orderBy('id')
                .forUseAsInlineAggregatedArrayValue()
            const perActivity = ctx.conn.subSelectUsing(tIssue).from(tIssueWorklog)
                .where(tIssueWorklog.issueId.equals(tIssue.id))
                .select({ activity: tIssueWorklog.activity, logged: ctx.conn.count(tIssueWorklog.id) })
                .groupBy('activity')
                .forUseAsInlineAggregatedArrayValue()
            const skipped = ctx.conn.subSelectUsing(tIssue).from(tIssueWorklog)
                .where(tIssueWorklog.issueId.equals(tIssue.id))
                .select({ id: tIssueWorklog.id, activity: tIssueWorklog.activity })
                .forUseAsInlineAggregatedArrayValue()
                .onlyWhenOrNull(false)
                .useEmptyArrayForNoValue()
            const row = await ctx.conn.update(tProject)
                .from(tIssue)
                .set({ name: 'Marketing site v2' })
                .where(tIssue.id.equals(2))
                .and(tProject.id.equals(tIssue.projectId))
                .returning({
                    id:      tProject.id,
                    oldName: oldProject.name,
                    worklogs,
                    entries,
                    perActivity,
                    skipped,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project _new_ set project.name = :0 from (select _old_.*, issue.id as issue__id from project _old_, issue where issue.id = :1 and _old_.id = issue.project_id for no key update of _old_) _old_ where _new_.id = _old_.id returning _new_.id, _old_.name, (select json_arrayagg(json_object('id' value a_1_.id, 'activity' value a_1_.activity)) from (select id as id, activity as activity from issue_worklog where issue_id = _old_.issue__id order by id offset 0 rows) a_1_), (select json_arrayagg(json_object('id' value a_2_.id, 'detail.activity' value a_2_."detail.activity")) from (select id as id, activity as "detail.activity" from issue_worklog where issue_id = _old_.issue__id order by id offset 0 rows) a_2_), (select json_arrayagg(json_object('activity' value a_3_.activity, 'logged' value a_3_.logged)) from (select activity as activity, count(id) as logged from issue_worklog where issue_id = _old_.issue__id group by activity) a_3_), null into :2, :3, :4, :5, :6, :7"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                2,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "oldName",
                  "dir": 3003,
                },
                {
                  "as": "worklogs",
                  "dir": 3003,
                },
                {
                  "as": "entries",
                  "dir": 3003,
                },
                {
                  "as": "perActivity",
                  "dir": 3003,
                },
                {
                  "as": "skipped",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, {
                id:          number
                oldName:     string
                worklogs:    Array<{ id: number; activity: WorklogActivity }>
                entries:     Array<{ id: number; detail: { activity: WorklogActivity } }>
                perActivity: Array<{ activity: WorklogActivity; logged: number }>
                skipped:     Array<{ id: number; activity: WorklogActivity }>
            }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no RETURNING OLD values (`tTable.oldValues()` is typed `never`); RETURNING INTO returns post-update values only, so pre-update values need a separate SELECT
    /*
    test('aggregating-subselects-using-from-table-in-returning', async () => {
        // Aggregates inside correlated subqueries: the worklog count, the
        // assignee name list, the worklog as `aggregateAsArray` of an object and
        // of one column, and the object form disabled with `onlyWhenOrNull(false)`.
        // The project's issue count correlates on the UPDATED table instead, so it
        // reads the new row and pre-projects nothing. Project 1 has issues 1 and 2.
        const expected = {
            id:             1,
            oldName:        'Marketing site',
            issueCount:     2,
            worklogCount:   1,
            assigneeNames:  'Grace Hopper',
            worklogEntries: [{ id: 2, activity: 'review' as const }],
            activities:     ['review' as const],
        }
        ctx.mockNext({ ...expected, noEntries: null })

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const issueCount = ctx.conn.subSelectUsing(tProject).from(tIssue)
                .where(tIssue.projectId.equals(tProject.id))
                .selectOneColumn(ctx.conn.count(tIssue.id))
                .forUseAsInlineQueryValue()
            const worklogCount = ctx.conn.subSelectUsing(tIssue).from(tIssueWorklog)
                .where(tIssueWorklog.issueId.equals(tIssue.id))
                .selectOneColumn(ctx.conn.count(tIssueWorklog.id))
                .forUseAsInlineQueryValue()
            const assigneeNames = ctx.conn.subSelectUsing(tIssue).from(tAppUser)
                .where(tAppUser.id.equals(tIssue.assigneeId))
                .selectOneColumn(ctx.conn.stringConcat(tAppUser.fullName, ', '))
                .forUseAsInlineQueryValue()
            const worklogEntries = ctx.conn.subSelectUsing(tIssue).from(tIssueWorklog)
                .where(tIssueWorklog.issueId.equals(tIssue.id))
                .selectOneColumn(ctx.conn.aggregateAsArray({ id: tIssueWorklog.id, activity: tIssueWorklog.activity }))
                .forUseAsInlineQueryValue()
            const activities = ctx.conn.subSelectUsing(tIssue).from(tIssueWorklog)
                .where(tIssueWorklog.issueId.equals(tIssue.id))
                .selectOneColumn(ctx.conn.aggregateAsArrayOfOneColumn(tIssueWorklog.activity))
                .forUseAsInlineQueryValue()
            const noEntries = ctx.conn.subSelectUsing(tIssue).from(tIssueWorklog)
                .where(tIssueWorklog.issueId.equals(tIssue.id))
                .selectOneColumn(ctx.conn.aggregateAsArray({ id: tIssueWorklog.id }).onlyWhenOrNull(false))
                .forUseAsInlineQueryValue()
            const row = await ctx.conn.update(tProject)
                .from(tIssue)
                .set({ name: 'Marketing site v2' })
                .where(tIssue.id.equals(2))
                .and(tProject.id.equals(tIssue.projectId))
                .returning({
                    id:      tProject.id,
                    oldName: oldProject.name,
                    issueCount,
                    worklogCount,
                    assigneeNames,
                    worklogEntries,
                    activities,
                    noEntries,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project _new_ set project.name = :0 from (select _old_.*, issue.assignee_id as issue__assignee_id, issue.id as issue__id from project _old_, issue where issue.id = :1 and _old_.id = issue.project_id for no key update of _old_) _old_ where _new_.id = _old_.id returning _new_.id, _old_.name, (select count(id) as "result" from issue where project_id = _new_.id), (select count(id) as "result" from issue_worklog where issue_id = _old_.issue__id), (select listagg(full_name, :2) within group (order by full_name) as "result" from app_user where id = _old_.issue__assignee_id), (select json_arrayagg(json_object('id' value id, 'activity' value activity)) as "result" from issue_worklog where issue_id = _old_.issue__id), (select json_arrayagg(activity) as "result" from issue_worklog where issue_id = _old_.issue__id), (select null as "result" from issue_worklog where issue_id = _old_.issue__id) into :3, :4, :5, :6, :7, :8, :9, :10"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                2,
                ", ",
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "oldName",
                  "dir": 3003,
                },
                {
                  "as": "issueCount",
                  "dir": 3003,
                },
                {
                  "as": "worklogCount",
                  "dir": 3003,
                },
                {
                  "as": "assigneeNames",
                  "dir": 3003,
                },
                {
                  "as": "worklogEntries",
                  "dir": 3003,
                },
                {
                  "as": "activities",
                  "dir": 3003,
                },
                {
                  "as": "noEntries",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, {
                id:              number
                oldName:         string
                issueCount?:     number
                worklogCount?:   number
                assigneeNames?:  string
                worklogEntries?: Array<{ id: number; activity: WorklogActivity }>
                activities?:     Array<WorklogActivity>
                noEntries?:      Array<{ id: number }>
            }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no RETURNING OLD values (`tTable.oldValues()` is typed `never`); RETURNING INTO returns post-update values only, so pre-update values need a separate SELECT. Canonical body kept as line comments below — it contains `*/`, so a /* … */ wrap is impossible.

    //     test('subselects-using-from-table-over-a-view-values-cte-and-customized-table', async () => {
    //         // Correlated subqueries whose own FROM is a view, a VALUES source, a CTE
    //         // and a customized table (`withSqlHint`), plus one carrying a
    //         // `customizeQuery` fragment that interpolates a FROM-table column.
    //         const expected = {
    //             id:          1,
    //             oldName:     'Marketing site',
    //             orgName:     'Acme Corp',
    //             statusLabel: 'In progress',
    //             verifiedAssignee: 'Grace Hopper',
    //             hintedAssignee:   'grace@acme.test',
    //             taggedAssignee:   'Grace Hopper',
    //         }
    //         ctx.mockNext(expected)

    //         await ctx.withRollback(async () => {
    //             const oldProject = tProject.oldValues()
    //             const statusLabels = Values.create(VStatusLabel, 'statusLabel', [
    //                 { status: 'open',        label: 'Open' },
    //                 { status: 'in_progress', label: 'In progress' },
    //             ])
    //             const verifiedUsers = ctx.conn.selectFrom(tAppUser)
    //                 .where(tAppUser.verified.equals(true))
    //                 .select({ id: tAppUser.id, fullName: tAppUser.fullName })
    //                 .forUseInQueryAs('verifiedUser')
    //             const hintedUser = ctx.conn.withSqlHint(tAppUser, 'hintedUser')

    //             const orgName = ctx.conn.subSelectUsing(tIssue).from(vProjectOverview)
    //                 .where(vProjectOverview.id.equals(tIssue.projectId))
    //                 .selectOneColumn(vProjectOverview.organizationName)
    //                 .forUseAsInlineQueryValue()
    //             const statusLabel = ctx.conn.subSelectUsing(tIssue).from(statusLabels)
    //                 .where(statusLabels.status.equals(tIssue.status))
    //                 .selectOneColumn(statusLabels.label)
    //                 .forUseAsInlineQueryValue()
    //             const verifiedAssignee = ctx.conn.subSelectUsing(tIssue).from(verifiedUsers)
    //                 .where(verifiedUsers.id.equals(tIssue.assigneeId))
    //                 .selectOneColumn(verifiedUsers.fullName)
    //                 .forUseAsInlineQueryValue()
    //             const hintedAssignee = ctx.conn.subSelectUsing(tIssue).from(hintedUser)
    //                 .where(hintedUser.id.equals(tIssue.assigneeId))
    //                 .selectOneColumn(hintedUser.email)
    //                 .forUseAsInlineQueryValue()
    //             const taggedAssignee = ctx.conn.subSelectUsing(tIssue).from(tAppUser)
    //                 .where(tAppUser.id.equals(tIssue.assigneeId))
    //                 .selectOneColumn(tAppUser.fullName)
    //                 .customizeQuery({ afterQuery: ctx.conn.rawFragment` /* priority ${tIssue.priority} */` })
    //                 .forUseAsInlineQueryValue()

    //             const row = await ctx.conn.update(tProject)
    //                 .from(tIssue)
    //                 .set({ name: 'Marketing site v2' })
    //                 .where(tIssue.id.equals(2))
    //                 .and(tProject.id.equals(tIssue.projectId))
    //                 .returning({
    //                     id:      tProject.id,
    //                     oldName: oldProject.name,
    //                     orgName,
    //                     statusLabel,
    //                     verifiedAssignee,
    //                     hintedAssignee,
    //                     taggedAssignee,
    //                 })
    //                 .executeUpdateOne()

    //             expect(ctx.lastSql).toMatchInlineSnapshot(`"with statusLabel(status, "label") as (values (:0, :1), (:2, :3)), verifiedUser as (select id as id, full_name as fullName from app_user where case when verified = 'Y' then 1 else 0 end = :4) update project _new_ set project.name = :5 from (select _old_.*, issue.assignee_id as issue__assignee_id, issue.priority as issue__priority, issue.project_id as issue__project_id, issue.status as issue__status from project _old_, issue where issue.id = :6 and _old_.id = issue.project_id for no key update of _old_) _old_ where _new_.id = _old_.id returning _new_.id, _old_.name, (select organization_name as "result" from project_overview where id = _old_.issue__project_id), (select "label" as "result" from statusLabel where status = _old_.issue__status), (select fullName as "result" from verifiedUser where id = _old_.issue__assignee_id), (select email as "result" from /*+ hint */ app_user  where id = _old_.issue__assignee_id), (select full_name as "result" from app_user where id = _old_.issue__assignee_id  /* priority _old_.issue__priority */) into :7, :8, :9, :10, :11, :12, :13"`)
    //             expect(ctx.lastParams).toMatchInlineSnapshot(`
    //               [
    //                 "open",
    //                 "Open",
    //                 "in_progress",
    //                 "In progress",
    //                 1,
    //                 "Marketing site v2",
    //                 2,
    //                 {
    //                   "as": "id",
    //                   "dir": 3003,
    //                 },
    //                 {
    //                   "as": "oldName",
    //                   "dir": 3003,
    //                 },
    //                 {
    //                   "as": "orgName",
    //                   "dir": 3003,
    //                 },
    //                 {
    //                   "as": "statusLabel",
    //                   "dir": 3003,
    //                 },
    //                 {
    //                   "as": "verifiedAssignee",
    //                   "dir": 3003,
    //                 },
    //                 {
    //                   "as": "hintedAssignee",
    //                   "dir": 3003,
    //                 },
    //                 {
    //                   "as": "taggedAssignee",
    //                   "dir": 3003,
    //                 },
    //               ]
    //             `)
    //             assertType<Exact<typeof row, {
    //                 id:                number
    //                 oldName:           string
    //                 orgName?:          string
    //                 statusLabel?:      string
    //                 verifiedAssignee?: string
    //                 hintedAssignee?:   string
    //                 taggedAssignee?:   string
    //             }>>()
    //             expect(row).toEqual(expected)
    //         })
    //     })

    //     NOT-APPLICABLE: Oracle has no RETURNING OLD values (`tTable.oldValues()` is typed `never`); RETURNING INTO returns post-update values only, so pre-update values need a separate SELECT
    /*
    test('predicate-wrappers-over-from-table-columns-in-returning', async () => {
        // Boolean projections over issue 2 next to the pre-update project name.
        // The dynamic filters are the shapes a search form produces: one supplied,
        // the others absent so their fallback renders instead.
        const statusFilter: string | undefined = 'in_progress'
        const titleFilter: string | undefined = undefined
        const projectFilter: number | undefined = undefined
        const priorityFilter: number[] | null = null
        const expected = {
            id:                 1,
            oldName:            'Marketing site',
            statusMatches:      true,
            titleOrInProgress:  true,
            projectOrAny:       true,
            hasWorklog:         true,
            withoutBody:        false,
            isActive:           true,
            assignedToVerified: true,
            titleDiffers:       true,
            urgentPriority:     true,
            anyPriority:        true,
            inTriageRange:      true,
        }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .from(tIssue)
                .set({ name: 'Marketing site v2' })
                .where(tIssue.id.equals(2))
                .and(tProject.id.equals(tIssue.projectId))
                .returning({
                    id:                 tProject.id,
                    oldName:            oldProject.name,
                    statusMatches:      tIssue.status.equalsIfValue(statusFilter).trueWhenNoValue(),
                    titleOrInProgress:  tIssue.title.equalsIfValue(titleFilter).valueWhenNoValue(tIssue.status.equals('in_progress')),
                    projectOrAny:       tIssue.projectId.equalsIfValue(projectFilter).valueWhenNoValue(ctx.conn.true()),
                    hasWorklog:         ctx.conn.exists(
                        ctx.conn.subSelectUsing(tIssue).from(tIssueWorklog)
                            .where(tIssueWorklog.issueId.equals(tIssue.id))
                            .selectOneColumn(tIssueWorklog.id),
                    ),
                    withoutBody:        tIssue.body.isNull(),
                    isActive:           tIssue.status.in(['open', 'in_progress']),
                    assignedToVerified: tIssue.assigneeId.in(
                        ctx.conn.selectFrom(tAppUser).where(tAppUser.verified.equals(true)).selectOneColumn(tAppUser.id),
                    ),
                    titleDiffers:       tProject.name.isNot(tIssue.title),
                    urgentPriority:     tIssue.priority.inIfValue([1, 2]).trueWhenNoValue(),
                    anyPriority:        tIssue.priority.inIfValue(priorityFilter).trueWhenNoValue(),
                    inTriageRange:      tIssue.priority.between(1, tIssue.number),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project _new_ set project.name = :0 from (select _old_.*, issue.assignee_id as issue__assignee_id, issue."body" as issue__body, issue.id as issue__id, issue."number" as issue__number, issue.priority as issue__priority, issue.status as issue__status, issue.title as issue__title from project _old_, issue where issue.id = :1 and _old_.id = issue.project_id for no key update of _old_) _old_ where _new_.id = _old_.id returning _new_.id, _old_.name, case when _old_.issue__status = :2 then 1 else 0 end, case when _old_.issue__status = :3 then 1 else 0 end, case when (1=1) then 1 else 0 end, case when exists(select id as "result" from issue_worklog where issue_id = _old_.issue__id) then 1 else 0 end, case when _old_.issue__body is null then 1 else 0 end, case when _old_.issue__status in (:4, :5) then 1 else 0 end, case when _old_.issue__assignee_id in (select id as "result" from app_user where case when verified = 'Y' then 1 else 0 end = :6) then 1 when not _old_.issue__assignee_id in (select id as "result" from app_user where case when verified = 'Y' then 1 else 0 end = :7) then 0 else null end, case when decode(_new_.name, _old_.issue__title, 1, 0 ) = 0 then 1 else 0 end, case when _old_.issue__priority in (:8, :9) then 1 else 0 end, case when (1=1) then 1 else 0 end, case when _old_.issue__priority between :10 and _old_.issue__number then 1 else 0 end into :11, :12, :13, :14, :15, :16, :17, :18, :19, :20, :21, :22, :23"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                2,
                "in_progress",
                "in_progress",
                "open",
                "in_progress",
                1,
                1,
                1,
                2,
                1,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "oldName",
                  "dir": 3003,
                },
                {
                  "as": "statusMatches",
                  "dir": 3003,
                },
                {
                  "as": "titleOrInProgress",
                  "dir": 3003,
                },
                {
                  "as": "projectOrAny",
                  "dir": 3003,
                },
                {
                  "as": "hasWorklog",
                  "dir": 3003,
                },
                {
                  "as": "withoutBody",
                  "dir": 3003,
                },
                {
                  "as": "isActive",
                  "dir": 3003,
                },
                {
                  "as": "assignedToVerified",
                  "dir": 3003,
                },
                {
                  "as": "titleDiffers",
                  "dir": 3003,
                },
                {
                  "as": "urgentPriority",
                  "dir": 3003,
                },
                {
                  "as": "anyPriority",
                  "dir": 3003,
                },
                {
                  "as": "inTriageRange",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, {
                id:                  number
                oldName:             string
                statusMatches:       boolean
                titleOrInProgress:   boolean
                projectOrAny:        boolean
                hasWorklog:          boolean
                withoutBody:         boolean
                isActive:            boolean
                assignedToVerified?: boolean
                titleDiffers:        boolean
                urgentPriority:      boolean
                anyPriority:         boolean
                inTriageRange:       boolean
            }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no RETURNING OLD values (`tTable.oldValues()` is typed `never`); RETURNING INTO returns post-update values only, so pre-update values need a separate SELECT
    /*
    test('value-wrappers-over-from-table-columns-in-set-and-returning', async () => {
        // Text projections over issue 2, and a SET that copies a constant slug
        // plus the issue title through a wrapper.
        const suffix: string | undefined = ' (wip)'
        const expected = {
            id:          1,
            oldName:     'Marketing site',
            newSlug:     'navbar',
            newName:     'redesign navbar',
            sortTitle:   'Redesign navbar',
            summary:     'Use new tokens',
            label:       'Redesign navbar (wip)',
            shortTitle:  'Redesign nav bar',
            maybeTitle:  'Redesign navbar',
            status:      'in_progress',
        }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .from(tIssue)
                .set({
                    slug: ctx.conn.const('navbar', 'string'),
                    name: tIssue.title.toLowerCase(),
                })
                .where(tIssue.id.equals(2))
                .and(tProject.id.equals(tIssue.projectId))
                .returning({
                    id:         tProject.id,
                    oldName:    oldProject.name,
                    newSlug:    tProject.slug,
                    newName:    tProject.name,
                    sortTitle:  tIssue.title.collate('BINARY'),
                    summary:    tIssue.body.valueWhenNull(tIssue.title),
                    label:      tIssue.title.concatIfValue(suffix),
                    shortTitle: tIssue.title.replaceAllIfValue('navbar', 'nav bar'),
                    maybeTitle: tIssue.title.asOptional(),
                    status:     tIssue.status.allowWhen(true, 'status hidden'),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project _new_ set project.slug = :0, project.name = lower(_old_.issue__title) from (select _old_.*, issue."body" as issue__body, issue.status as issue__status, issue.title as issue__title from project _old_, issue where issue.id = :1 and _old_.id = issue.project_id for no key update of _old_) _old_ where _new_.id = _old_.id returning _new_.id, _old_.name, _new_.slug, _new_.name, _old_.issue__title collate BINARY, nvl(_old_.issue__body, _old_.issue__title), _old_.issue__title || :2, replace(_old_.issue__title collate BINARY, :3 collate BINARY, :4) collate USING_NLS_COMP, _old_.issue__title, _old_.issue__status into :5, :6, :7, :8, :9, :10, :11, :12, :13, :14"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "navbar",
                2,
                " (wip)",
                "navbar",
                "nav bar",
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "oldName",
                  "dir": 3003,
                },
                {
                  "as": "newSlug",
                  "dir": 3003,
                },
                {
                  "as": "newName",
                  "dir": 3003,
                },
                {
                  "as": "sortTitle",
                  "dir": 3003,
                },
                {
                  "as": "summary",
                  "dir": 3003,
                },
                {
                  "as": "label",
                  "dir": 3003,
                },
                {
                  "as": "shortTitle",
                  "dir": 3003,
                },
                {
                  "as": "maybeTitle",
                  "dir": 3003,
                },
                {
                  "as": "status",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, {
                id:          number
                oldName:     string
                newSlug:     string
                newName:     string
                sortTitle:   string
                summary:     string
                label:       string
                shortTitle:  string
                maybeTitle?: string
                status:      string
            }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no RETURNING OLD values (`tTable.oldValues()` is typed `never`); RETURNING INTO returns post-update values only, so pre-update values need a separate SELECT
    /*
    test('virtual-columns-of-the-from-table-in-set-and-returning', async () => {
        // A worklog-driven update of its issue: the virtual columns of the FROM
        // table are fragments over `issue_worklog.activity`, which has to be
        // pre-projected. Worklog 2 ('review') belongs to issue 2.
        const expected = {
            id:          2,
            oldTitle:    'Redesign navbar',
            newTitle:    'Redesign navbar - REVIEW',
            activityTag: 'REVIEW',
        }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldIssue = tIssue.oldValues()
            const row = await ctx.conn.update(tIssue)
                .from(tIssueWorklog)
                .set({ title: tIssue.title.concat(' - ').concat(tIssueWorklog.activityTagged) })
                .where(tIssueWorklog.id.equals(2))
                .and(tIssue.id.equals(tIssueWorklog.issueId))
                .returning({
                    id:          tIssue.id,
                    oldTitle:    oldIssue.title,
                    newTitle:    tIssue.title,
                    activityTag: tIssueWorklog.activityUpper,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue _new_ set issue.title = _new_.title || :0 || upper(_old_.issue_worklog__activity) from (select _old_.*, issue_worklog.activity as issue_worklog__activity from issue _old_, issue_worklog where issue_worklog.id = :1 and _old_.id = issue_worklog.issue_id for no key update of _old_) _old_ where _new_.id = _old_.id returning _new_.id, _old_.title, _new_.title, upper(_old_.issue_worklog__activity) into :2, :3, :4, :5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " - ",
                2,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "oldTitle",
                  "dir": 3003,
                },
                {
                  "as": "newTitle",
                  "dir": 3003,
                },
                {
                  "as": "activityTag",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, { id: number, oldTitle: string, newTitle: string, activityTag?: string }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no RETURNING OLD values (`tTable.oldValues()` is typed `never`); RETURNING INTO returns post-update values only, so pre-update values need a separate SELECT. Canonical body kept as line comments below — it contains `*/`, so a /* … */ wrap is impossible.

    //     test('subselect-using-from-table-embedding-mutations-in-a-fragment', async () => {
    //         // Each statement embedded in the fragment is still walked for the
    //         // FROM-table columns it reads. Project 1 ('mktg-site') is the project of
    //         // issue 2.
    //         // MOCK-ONLY: the embedded statements bind their placeholders inside an SQL
    //         // comment, invisible to the server, which then rejects the bind count.
    //         ctx.mockOnlyConnection()
    //         const expected = { id: 1, oldSlug: 'mktg-site' }
    //         ctx.mockNext(expected)

    //         await ctx.withRollback(async () => {
    //             const purge = ctx.conn.deleteFrom(tIssueWorklog).where(tIssueWorklog.issueId.equals(2))
    //             const reopen = ctx.conn.update(tIssue).set({ status: 'open' }).where(tIssue.id.equals(2))
    //             const notify = ctx.conn.insertInto(tWebhookEvent).set({ issueId: 2, eventType: 'updated' })
    //             const assigneeEmail = ctx.conn.subSelectUsing(tIssue).from(tAppUser)
    //                 .where(tAppUser.id.equals(tIssue.assigneeId))
    //                 .selectOneColumn(tAppUser.email)
    //                 .customizeQuery({ afterQuery: ctx.conn.rawFragment` /* ${purge} | ${reopen} | ${notify} */` })
    //                 .forUseAsInlineQueryValue()
    //             const row = await ctx.conn.update(tProject)
    //                 .from(tIssue)
    //                 .set({ slug: assigneeEmail.valueWhenNull('unassigned') })
    //                 .where(tIssue.id.equals(2))
    //                 .and(tProject.id.equals(tIssue.projectId))
    //                 .returning({ id: tProject.id, oldSlug: tProject.oldValues().slug })
    //                 .executeUpdateOne()

    //             expect(ctx.lastSql).toMatchInlineSnapshot(`"update project _new_ set project.slug = nvl((select email as "result" from app_user where id = _old_.issue__assignee_id  /* delete from issue_worklog where issue_id = :0 | update issue set status = :1 where id = :2 | insert into webhook_event (issue_id, event_type) values (:3, :4) */), :5) from (select _old_.*, issue.assignee_id as issue__assignee_id from project _old_, issue where issue.id = :6 and _old_.id = issue.project_id for no key update of _old_) _old_ where _new_.id = _old_.id returning _new_.id, _old_.slug into :7, :8"`)
    //             expect(ctx.lastParams).toMatchInlineSnapshot(`
    //               [
    //                 2,
    //                 "open",
    //                 2,
    //                 2,
    //                 "updated",
    //                 "unassigned",
    //                 2,
    //                 {
    //                   "as": "id",
    //                   "dir": 3003,
    //                 },
    //                 {
    //                   "as": "oldSlug",
    //                   "dir": 3003,
    //                 },
    //               ]
    //             `)
    //             assertType<Exact<typeof row, { id: number, oldSlug: string }>>()
    //             expect(row).toEqual(expected)
    //         })
    //     })

    //     NOT-APPLICABLE: Oracle has no RETURNING OLD values (`tTable.oldValues()` is typed `never`); RETURNING INTO returns post-update values only, so pre-update values need a separate SELECT
    /*
    test('subselect-using-two-from-tables-in-returning', async () => {
        // A FROM list of two tables: the subquery reads both, so a column of
        // each is pre-projected into `_old_`.
        const expected = { id: 1, oldName: 'Marketing site', assigneeOfOrg: 'Grace Hopper @ Acme Corp' }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const assigneeOfOrg = ctx.conn.subSelectUsing(tIssue, tOrganization).from(tAppUser)
                .where(tAppUser.id.equals(tIssue.assigneeId))
                .selectOneColumn(tAppUser.fullName.concat(' @ ').concat(tOrganization.name))
                .forUseAsInlineQueryValue()
            const row = await ctx.conn.update(tProject)
                .from(tIssue)
                .from(tOrganization)
                .set({ name: 'Marketing site v2' })
                .where(tIssue.id.equals(2))
                .and(tProject.id.equals(tIssue.projectId))
                .and(tOrganization.id.equals(tProject.organizationId))
                .returning({
                    id:      tProject.id,
                    oldName: oldProject.name,
                    assigneeOfOrg,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project _new_ set project.name = :0 from (select _old_.*, issue.assignee_id as issue__assignee_id, "organization".name as organization__name from project _old_, issue, "organization" where issue.id = :1 and _old_.id = issue.project_id and "organization".id = _old_.organization_id for no key update of _old_) _old_ where _new_.id = _old_.id returning _new_.id, _old_.name, (select full_name || :2 || _old_.organization__name as "result" from app_user where id = _old_.issue__assignee_id) into :3, :4, :5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                2,
                " @ ",
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "oldName",
                  "dir": 3003,
                },
                {
                  "as": "assigneeOfOrg",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, { id: number, oldName: string, assigneeOfOrg?: string }>>()
            expect(row).toEqual(expected)
        })
    })
    */
})

// Declared for the commented-out tests above; kept referenced so noUnusedLocals stays green.
void VStatusLabel
