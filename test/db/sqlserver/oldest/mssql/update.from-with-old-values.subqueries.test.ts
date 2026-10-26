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
import { assertType, type Exact } from '../../../../lib/assertType.js'
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
    type WorklogActivity,
} from '../../domain/connection.js'
import { ctx } from './setup.js'

// tOrganization, vProjectOverview and WorklogActivity are referenced only by the commented-out tests below.
void tOrganization; void vProjectOverview
export type { WorklogActivity }

// Display labels for the issue status codes, joined in through a VALUES source.
class VStatusLabel extends Values<DBConnection, 'statusLabel'> {
    status = this.column('string')
    label  = this.column('string')
}
// Referenced only by a commented-out test below.
void VStatusLabel

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = project.name + @0 + coalesce((select full_name as [result] from app_user where id = issue.assignee_id), @1) output inserted.id as id, deleted.name as oldName, inserted.name as newName from issue where issue.id = @2 and project.id = issue.project_id"`)
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

    // NOT-SUPPORTED: SQL Server rejects a subquery in the OUTPUT clause (error 10705: 'Subqueries are not allowed in the OUTPUT clause'), so a RETURNING projection that carries a subquery is not executable.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0 output inserted.id as id, deleted.name as oldName, (select activity as [result] from issue_worklog where issue_id = issue.id order by issue_worklog.work_date desc offset 0 rows fetch next @1 rows only) as lastActivity from issue where issue.id = @2 and project.id = issue.project_id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                1,
                2,
              ]
            `)
            assertType<Exact<typeof row, { id: number, oldName: string, lastActivity?: WorklogActivity }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-SUPPORTED: SQL Server rejects a subquery in the OUTPUT clause (error 10705: 'Subqueries are not allowed in the OUTPUT clause'), so a RETURNING projection that carries a subquery is not executable.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0 output inserted.id as id, deleted.name as oldName, (select issue_worklog.activity as [result] from app_user left join issue_worklog on issue_worklog.issue_id = issue.id where app_user.id = issue.assignee_id) as assigneeActivity, (select full_name as [result] from app_user where id = issue.assignee_id) as assigneeName from issue where issue.id = @1 and project.id = issue.project_id"`)
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

    // NOT-SUPPORTED: SQL Server rejects a subquery in the OUTPUT clause (error 10705: 'Subqueries are not allowed in the OUTPUT clause'), so a RETURNING projection that carries a subquery is not executable.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0 output inserted.id as id, deleted.name as oldName, (select email as [result] from app_user where id = issue.assignee_id and cast(case when verified = 'Y' then 1 else 0 end as bit) = @1 union select full_name as [result] from app_user where id = issue.assignee_id and cast(case when verified = 'Y' then 1 else 0 end as bit) = @2) as contact from issue where issue.id = @3 and project.id = issue.project_id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                true,
                false,
                2,
              ]
            `)
            assertType<Exact<typeof row, { id: number, oldName: string, contact?: string }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-SUPPORTED: SQL Server rejects a subquery in the OUTPUT clause (error 10705: 'Subqueries are not allowed in the OUTPUT clause'), so a RETURNING projection that carries a subquery is not executable.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0 output inserted.id as id, deleted.name as oldName, (select id as id, activity as activity from issue_worklog where issue_id = issue.id order by id offset 0 rows for json path) as worklogs, (select id as id, activity as [detail.activity] from issue_worklog where issue_id = issue.id order by id offset 0 rows for json path) as entries, (select activity as activity, count(id) as logged from issue_worklog where issue_id = issue.id group by activity for json path) as perActivity, null as skipped from issue where issue.id = @1 and project.id = issue.project_id"`)
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

    // NOT-SUPPORTED: SQL Server rejects a subquery in the OUTPUT clause (error 10705: 'Subqueries are not allowed in the OUTPUT clause'), so a RETURNING projection that carries a subquery is not executable.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0 output inserted.id as id, deleted.name as oldName, (select count(id) as [result] from issue where project_id = inserted.id) as issueCount, (select count(id) as [result] from issue_worklog where issue_id = issue.id) as worklogCount, (select string_agg(full_name, ', ') as [result] from app_user where id = issue.assignee_id) as assigneeNames, (select concat('[', string_agg(concat('{', '"id": ', convert(nvarchar, id), ', "activity": ', '"' + string_escape(convert(nvarchar(max), activity), 'json') + '"', '}'), ','), ']') as [result] from issue_worklog where issue_id = issue.id) as worklogEntries, (select concat('[', string_agg('"' + string_escape(convert(nvarchar(max), activity), 'json') + '"', ','), ']') as [result] from issue_worklog where issue_id = issue.id) as activities, (select null as [result] from issue_worklog where issue_id = issue.id) as noEntries from issue where issue.id = @1 and project.id = issue.project_id"`)
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

    // NOT-SUPPORTED: SQL Server rejects a subquery in the OUTPUT clause (error 10705: 'Subqueries are not allowed in the OUTPUT clause'), so a RETURNING projection that carries a subquery is not executable. Canonical body kept as line comments below — it contains `*/`, so a /* … */ wrap is impossible.

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
    //
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
    //
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
    //
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
    //
    //             expect(ctx.lastSql).toMatchInlineSnapshot(`"with statusLabel as (select * from (values (@0, @1), (@2, @3)) as statusLabel(status, [label])), verifiedUser as (select id as id, full_name as fullName from app_user where cast(case when verified = 'Y' then 1 else 0 end as bit) = @4) update project set name = @5 output inserted.id as id, deleted.name as oldName, (select organization_name as [result] from project_overview where id = issue.project_id) as orgName, (select [label] as [result] from statusLabel where status = issue.status) as statusLabel, (select fullName as [result] from verifiedUser where id = issue.assignee_id) as verifiedAssignee, (select email as [result] from /*+ hint */ app_user  where id = issue.assignee_id) as hintedAssignee, (select full_name as [result] from app_user where id = issue.assignee_id  /* priority issue.priority */) as taggedAssignee from issue where issue.id = @6 and project.id = issue.project_id"`)
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

    // NOT-SUPPORTED: SQL Server rejects a subquery in the OUTPUT clause (error 10705: 'Subqueries are not allowed in the OUTPUT clause'), so a RETURNING projection that carries a subquery is not executable.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0 output inserted.id as id, deleted.name as oldName, cast(case when issue.status = @1 then 1 else 0 end as bit) as statusMatches, cast(case when issue.status = @2 then 1 else 0 end as bit) as titleOrInProgress, cast(case when (1=1) then 1 else 0 end as bit) as projectOrAny, cast(case when exists(select id as [result] from issue_worklog where issue_id = issue.id) then 1 else 0 end as bit) as hasWorklog, cast(case when issue.body is null then 1 else 0 end as bit) as withoutBody, cast(case when issue.status in (@3, @4) then 1 else 0 end as bit) as isActive, cast(case when issue.assignee_id in (select id as [result] from app_user where cast(case when verified = 'Y' then 1 else 0 end as bit) = @5) then 1 when not issue.assignee_id in (select id as [result] from app_user where cast(case when verified = 'Y' then 1 else 0 end as bit) = @6) then 0 else null end as bit) as assignedToVerified, cast(case when inserted.name <> issue.title then 1 else 0 end as bit) as titleDiffers, cast(case when issue.priority in (@7, @8) then 1 else 0 end as bit) as urgentPriority, cast(case when (1=1) then 1 else 0 end as bit) as anyPriority, cast(case when issue.priority between @9 and issue.number then 1 else 0 end as bit) as inTriageRange from issue where issue.id = @10 and project.id = issue.project_id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                "in_progress",
                "in_progress",
                "open",
                "in_progress",
                true,
                true,
                1,
                2,
                1,
                2,
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
                    sortTitle:  tIssue.title.collate('Latin1_General_BIN2'),
                    summary:    tIssue.body.valueWhenNull(tIssue.title),
                    label:      tIssue.title.concatIfValue(suffix),
                    shortTitle: tIssue.title.replaceAllIfValue('navbar', 'nav bar'),
                    maybeTitle: tIssue.title.asOptional(),
                    status:     tIssue.status.allowWhen(true, 'status hidden'),
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set slug = @0, name = lower(issue.title) output inserted.id as id, deleted.name as oldName, inserted.slug as newSlug, inserted.name as newName, issue.title collate Latin1_General_BIN2 as sortTitle, coalesce(issue.body, issue.title) as summary, issue.title + @1 as [label], replace(issue.title collate Latin1_General_BIN2, @2 collate Latin1_General_BIN2, @3) collate DATABASE_DEFAULT as shortTitle, issue.title as maybeTitle, issue.status as status from issue where issue.id = @4 and project.id = issue.project_id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "navbar",
                " (wip)",
                "navbar",
                "nav bar",
                2,
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = issue.title + @0 + upper(issue_worklog.activity) output inserted.id as id, deleted.title as oldTitle, inserted.title as newTitle, upper(issue_worklog.activity) as activityTag from issue_worklog where issue_worklog.id = @1 and issue.id = issue_worklog.issue_id"`)
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

    test('subselect-using-from-table-embedding-mutations-in-a-fragment', async () => {
        // Each statement embedded in the fragment is still walked for the
        // FROM-table columns it reads. Project 1 ('mktg-site') is the project of
        // issue 2.
        // MOCK-ONLY: the embedded statements bind their placeholders inside an SQL
        // comment, invisible to the server, which then rejects the bind count.
        ctx.mockOnlyConnection()
        const expected = { id: 1, oldSlug: 'mktg-site' }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const purge = ctx.conn.deleteFrom(tIssueWorklog).where(tIssueWorklog.issueId.equals(2))
            const reopen = ctx.conn.update(tIssue).set({ status: 'open' }).where(tIssue.id.equals(2))
            const notify = ctx.conn.insertInto(tWebhookEvent).set({ issueId: 2, eventType: 'updated' })
            const assigneeEmail = ctx.conn.subSelectUsing(tIssue).from(tAppUser)
                .where(tAppUser.id.equals(tIssue.assigneeId))
                .selectOneColumn(tAppUser.email)
                .customizeQuery({ afterQuery: ctx.conn.rawFragment` /* ${purge} | ${reopen} | ${notify} */` })
                .forUseAsInlineQueryValue()
            const row = await ctx.conn.update(tProject)
                .from(tIssue)
                .set({ slug: assigneeEmail.valueWhenNull('unassigned') })
                .where(tIssue.id.equals(2))
                .and(tProject.id.equals(tIssue.projectId))
                .returning({ id: tProject.id, oldSlug: tProject.oldValues().slug })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set slug = coalesce((select email as [result] from app_user where id = issue.assignee_id  /* delete from issue_worklog where issue_id = @0 | update issue set status = @1 where id = @2 | insert into webhook_event (issue_id, event_type) values (@3, @4) */), @5) output inserted.id as id, deleted.slug as oldSlug from issue where issue.id = @6 and project.id = issue.project_id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
                "open",
                2,
                2,
                "updated",
                "unassigned",
                2,
              ]
            `)
            assertType<Exact<typeof row, { id: number, oldSlug: string }>>()
            expect(row).toEqual(expected)
        })
    })

    // NOT-SUPPORTED: SQL Server rejects a subquery in the OUTPUT clause (error 10705: 'Subqueries are not allowed in the OUTPUT clause'), so a RETURNING projection that carries a subquery is not executable.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0 output inserted.id as id, deleted.name as oldName, (select full_name + @1 + organization.name as [result] from app_user where id = issue.assignee_id) as assigneeOfOrg from issue, organization where issue.id = @2 and project.id = issue.project_id and organization.id = project.organization_id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v2",
                " @ ",
                2,
              ]
            `)
            assertType<Exact<typeof row, { id: number, oldName: string, assigneeOfOrg?: string }>>()
            expect(row).toEqual(expected)
        })
    })
    */
})
