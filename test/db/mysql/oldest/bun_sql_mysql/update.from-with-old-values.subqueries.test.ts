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

    // NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project, issue set project.\`name\` = concat(project.\`name\`, ?, ifnull((select full_name as result from app_user where id = issue.assignee_id), ?)) where issue.id = ? and project.id = issue.project_id returning project.id as id, _old_.\`name\` as oldName, project.\`name\` as newName"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " / ",
                "unassigned",
                2,
              ]
            `)
            assertType<Exact<typeof row, { id: number, oldName: string, newName: string }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project, issue set project.\`name\` = ? where issue.id = ? and project.id = issue.project_id returning project.id as id, _old_.\`name\` as oldName, (select activity as result from issue_worklog where issue_id = issue.id order by issue_worklog.work_date desc limit ?) as lastActivity"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                2,
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number, oldName: string, lastActivity?: WorklogActivity }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project, issue set project.\`name\` = ? where issue.id = ? and project.id = issue.project_id returning project.id as id, _old_.\`name\` as oldName, (select issue_worklog.activity as result from app_user left join issue_worklog on issue_worklog.issue_id = issue.id where app_user.id = issue.assignee_id) as assigneeActivity, (select full_name as result from app_user where id = issue.assignee_id) as assigneeName"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                2,
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

    // NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project, issue set project.\`name\` = ? where issue.id = ? and project.id = issue.project_id returning project.id as id, _old_.\`name\` as oldName, (select email as result from app_user where id = issue.assignee_id and (verified = 'Y') = ? union select full_name as result from app_user where id = issue.assignee_id and (verified = 'Y') = ?) as contact"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                2,
                true,
                false,
              ]
            `)
            assertType<Exact<typeof row, { id: number, oldName: string, contact?: string }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project, issue set project.\`name\` = ? where issue.id = ? and project.id = issue.project_id returning project.id as id, _old_.\`name\` as oldName, cast((select json_arrayagg(json_object('id', a_1_.id, 'activity', a_1_.activity)) from (select id as id, activity as activity from issue_worklog where issue_id = issue.id order by id limit 2147483647) as a_1_) as char) as worklogs, cast((select json_arrayagg(json_object('id', a_2_.id, 'detail.activity', a_2_.\`detail.activity\`)) from (select id as id, activity as \`detail.activity\` from issue_worklog where issue_id = issue.id order by id limit 2147483647) as a_2_) as char) as entries, cast((select json_arrayagg(json_object('activity', a_3_.activity, 'logged', a_3_.logged)) from (select activity as activity, count(id) as logged from issue_worklog where issue_id = issue.id group by activity) as a_3_) as char) as perActivity, cast(null as char) as skipped"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                2,
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

    // NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project, issue set project.\`name\` = ? where issue.id = ? and project.id = issue.project_id returning project.id as id, _old_.\`name\` as oldName, (select count(id) as result from issue where project_id = project.id) as issueCount, (select count(id) as result from issue_worklog where issue_id = issue.id) as worklogCount, (select group_concat(full_name separator ', ') as result from app_user where id = issue.assignee_id) as assigneeNames, cast((select json_arrayagg(json_object('id', id, 'activity', activity)) as result from issue_worklog where issue_id = issue.id) as char) as worklogEntries, cast((select json_arrayagg(activity) as result from issue_worklog where issue_id = issue.id) as char) as activities, cast((select null as result from issue_worklog where issue_id = issue.id) as char) as noEntries"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                2,
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

    // NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE. Canonical body kept as line comments below — it contains `*/`, so a /* … */ wrap is impossible.

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

    //             expect(ctx.lastSql).toMatchInlineSnapshot(`"with statusLabel(status, label) as (values ($1::text, $2::text), ($3::text, $4::text)), verifiedUser as (select id as id, full_name as fullName from app_user where (verified = 'Y') = $5) update project as _new_ set name = $6 from (select _old_.*, issue.assignee_id as issue__assignee_id, issue.priority as issue__priority, issue.project_id as issue__project_id, issue.status as issue__status from project as _old_, issue where issue.id = $7 and _old_.id = issue.project_id for no key update of _old_) as _old_ where _new_.id = _old_.id returning _new_.id as id, _old_.name as "oldName", (select organization_name as result from project_overview where id = _old_.issue__project_id) as "orgName", (select label as result from statusLabel where status = _old_.issue__status) as "statusLabel", (select fullName as result from verifiedUser where id = _old_.issue__assignee_id) as "verifiedAssignee", (select email as result from /*+ hint */ app_user  where id = _old_.issue__assignee_id) as "hintedAssignee", (select full_name as result from app_user where id = _old_.issue__assignee_id  /* priority _old_.issue__priority */) as "taggedAssignee""`)
    //             expect(ctx.lastParams).toMatchInlineSnapshot(`
    //               [
    //                 "open",
    //                 "Open",
    //                 "in_progress",
    //                 "In progress",
    //                 true,
    //                 "Marketing site v2",
    //                 2,
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

    //     NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project, issue set project.\`name\` = ? where issue.id = ? and project.id = issue.project_id returning project.id as id, _old_.\`name\` as oldName, issue.\`status\` = ? as statusMatches, issue.\`status\` = ? as titleOrInProgress, true as projectOrAny, exists(select id as result from issue_worklog where issue_id = issue.id) as hasWorklog, issue.body is null as withoutBody, issue.\`status\` in (?, ?) as isActive, issue.assignee_id in (select id as result from app_user where (verified = 'Y') = ?) as assignedToVerified, not (project.\`name\` <=> issue.title) as titleDiffers, issue.priority in (?, ?) as urgentPriority, true as anyPriority, issue.priority between ? and issue.\`number\` as inTriageRange"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                2,
                "in_progress",
                "in_progress",
                "open",
                "in_progress",
                true,
                1,
                2,
                1,
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

    // NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE.
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
                    sortTitle:  tIssue.title.collate('utf8mb4_bin'),
                    summary:    tIssue.body.valueWhenNull(tIssue.title),
                    label:      tIssue.title.concatIfValue(suffix),
                    shortTitle: tIssue.title.replaceAllIfValue('navbar', 'nav bar'),
                    maybeTitle: tIssue.title.asOptional(),
                    status:     tIssue.status.allowWhen(true, 'status hidden'),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project, issue set project.slug = ?, project.\`name\` = lower(issue.title) where issue.id = ? and project.id = issue.project_id returning project.id as id, _old_.\`name\` as oldName, project.slug as newSlug, project.\`name\` as newName, issue.title collate utf8mb4_bin as sortTitle, ifnull(issue.body, issue.title) as summary, concat(issue.title, ?) as label, replace(issue.title, ?, ?) as shortTitle, issue.title as maybeTitle, issue.\`status\` as \`status\`"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "navbar",
                2,
                " (wip)",
                "navbar",
                "nav bar",
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

    // NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue, issue_worklog set issue.title = concat(issue.title, ?, upper(issue_worklog.activity)) where issue_worklog.id = ? and issue.id = issue_worklog.issue_id returning issue.id as id, _old_.title as oldTitle, issue.title as newTitle, upper(issue_worklog.activity) as activityTag"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " - ",
                2,
              ]
            `)
            assertType<Exact<typeof row, { id: number, oldTitle: string, newTitle: string, activityTag?: string }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE. Canonical body kept as line comments below — it contains `*/`, so a /* … */ wrap is impossible.

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

    //             expect(ctx.lastSql).toMatchInlineSnapshot(`"update project, issue set project.slug = ifnull((select email as result from app_user where id = issue.assignee_id  /* delete from issue_worklog where issue_id = ? | update issue set \`status\` = ? where id = ? | insert into webhook_event (issue_id, event_type) values (?, ?) */), ?) where issue.id = ? and project.id = issue.project_id returning project.id as id, _old_.slug as oldSlug"`)
    //             expect(ctx.lastParams).toMatchInlineSnapshot(`
    //               [
    //                 2,
    //                 "open",
    //                 2,
    //                 2,
    //                 "updated",
    //                 "unassigned",
    //                 2,
    //               ]
    //             `)
    //             assertType<Exact<typeof row, { id: number, oldSlug: string }>>()
    //             expect(row).toEqual(expected)
    //         })
    //     })

    //     NOT-APPLICABLE: MySQL has no RETURNING (and no OUTPUT equivalent), so `tTable.oldValues()` is typed `never` on `MySqlConnection`; audit-style pre/post reads need an explicit SELECT before the UPDATE.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project, issue, \`organization\` set project.\`name\` = ? where issue.id = ? and project.id = issue.project_id and \`organization\`.id = project.organization_id returning project.id as id, _old_.\`name\` as oldName, (select concat(full_name, ?, \`organization\`.\`name\`) as result from app_user where id = issue.assignee_id) as assigneeOfOrg"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                2,
                " @ ",
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
