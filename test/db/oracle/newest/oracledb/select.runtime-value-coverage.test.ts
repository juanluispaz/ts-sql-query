// Runtime-value coverage: scenarios that produce the null / undefined / absent /
// computed-string runtime value a result type promises (the miss / empty / null
// direction). All mock-side — the produced value runs in JS regardless of engine.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tOrganization, tProject, tProjectRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('projecting-optional-values-as-nullable-left-join-miss-yields-null', async () => {
        // `projectingOptionalValuesAsNullable()` projects a left-joined nested
        // object as `{...} | null`. Issue 3 has `assignee_id` NULL, so the join
        // misses and the object is produced as `null` at runtime.
        const tUserLeft = tAppUser.forUseInLeftJoin()
        const expected = { iid: 3, assignee: null }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tUserLeft).on(tUserLeft.id.equals(tIssue.assigneeId))
            .where(tIssue.id.equals(3))
            .select({
                iid:      tIssue.id,
                assignee: { id: tUserLeft.id, name: tUserLeft.fullName },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "iid", app_user.id as "assignee.id", app_user.full_name as "assignee.name" from issue left join app_user on app_user.id = issue.assignee_id where issue.id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:      number
            assignee: { id: number; name: string } | null
        }>>()
        expect(row.assignee).toBeNull()
        expect(row).toEqual(expected)
    })

    test('empty-set-scalar-aggregate-is-undefined', async () => {
        // A scalar aggregate over an EMPTY set is NULL -> the optional leaf
        // surfaces as `undefined` (absent). The WHERE matches no rows, so the
        // aggregate row is all-NULL.
        ctx.mockNext({ s: null, a: null, lo: null, hi: null })
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(-1))
            .select({
                s:  ctx.conn.sum(tIssue.priority),
                a:  ctx.conn.average(tIssue.priority),
                lo: ctx.conn.min(tIssue.priority),
                hi: ctx.conn.max(tIssue.priority),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(priority) as "s", avg(priority) as "a", min(priority) as "lo", max(priority) as "hi" from issue where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            -1,
          ]
        `)
        assertType<Exact<typeof result, {
            s?:  number | undefined
            a?:  number | undefined
            lo?: number | undefined
            hi?: number | undefined
        }>>()
        expect(result.s).toBeUndefined()
        expect(result.a).toBeUndefined()
        expect(result.lo).toBeUndefined()
        expect(result.hi).toBeUndefined()
    })

    test('optional-non-empty-array-over-empty-aggregate-is-absent', async () => {
        // `asOptionalNonEmptyArray()` over a GENUINELY empty inline aggregate ->
        // the key is absent: the subquery is filtered to match no rows
        // (json_agg -> NULL), so `projects` is absent at runtime.
        ctx.mockNext({ id: 1, name: 'Acme Corp', projects: null })
        const orgProjects = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
              .and(tProject.name.equals('__no-such-project__'))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .forUseAsInlineAggregatedArrayValue()
            .asOptionalNonEmptyArray()

        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:       tOrganization.id,
                name:     tOrganization.name,
                projects: orgProjects,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", name as "name", (select json_arrayagg(json_object('id' value a_1_.id, 'name' value a_1_.name)) from (select id as id, name as name from project where organization_id = "organization".id and name = :0 order by id offset 0 rows) a_1_) as "projects" from "organization" where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "__no-such-project__",
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:        number
            name:      string
            projects?: Array<{ id: number; name: string }>
        }>>()
        expect(row.projects).toBeUndefined()
        expect(row).toEqual({ id: 1, name: 'Acme Corp' })
    })

    test('table-computed-and-virtual-columns-read-the-value-back', async () => {
        // The Table-side `computedColumn` (`notes`, a DB-generated
        // `'release-' || version` column) and `virtualColumnFromFragment`
        // (`versionTag` = upper(channel)), projected and read back. Release 1 is
        // version 1.2.0 on the 'stable' channel, so `notes` is 'release-1.2.0'
        // and `versionTag` is 'STABLE'.
        const expected = { notes: 'release-1.2.0', versionTag: 'STABLE' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                notes:      tProjectRelease.notes,
                versionTag: tProjectRelease.versionTag,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select notes as "notes", upper(channel) as "versionTag" from project_release where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { notes: string; versionTag: string }>>()
        expect(row).toEqual(expected)
    })

    test('aggregate-as-array-left-join-miss-inner-object-is-absent', async () => {
        // `aggregateAsArray({ marker, issue: {...} })` over a left join: the
        // inner `issue` object groups left-joined columns, so it is optional
        // (`issue?: {...}`). Project 4 has no issues, so the join misses; the
        // element survives on its present `marker` sibling (the project slug)
        // while its `issue` object is produced ABSENT. (A fully-null element
        // with no surviving sibling is dropped entirely.)
        const expected = [{ pid: 4, issues: [{ marker: 'legacy' }] }]
        ctx.mockNext(expected)
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(4))
            .select({
                pid:    tProject.id,
                issues: ctx.conn.aggregateAsArray({
                    marker: tProject.slug,
                    issue:  { id: tIssueLeft.id, title: tIssueLeft.title },
                }),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "pid", json_arrayagg(json_object('marker' value project.slug, 'issue.id' value issue.id, 'issue.title' value issue.title)) as "issues" from project left join issue on issue.project_id = project.id where project.id = :0 group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ marker: string; issue?: { id: number; title: string } }>
        }>>>()
        expect(rows).toEqual(expected)
        expect(rows[0]!.issues[0]!.issue).toBeUndefined()
    })

    test('aggregate-as-array-null-projector-left-join-miss-inner-object-is-null', async () => {
        // `.projectingOptionalValuesAsNullable()` on the aggregate makes the
        // inner `issue` object PRESENT-as-`null` on a join miss instead of
        // absent (null vs undefined as a VALUE, inside an aggregate array).
        // Project 4 has no issues, so the join misses; the element survives on
        // its present `marker` sibling and its `issue` object is `null`.
        const expected = [{ pid: 4, issues: [{ marker: 'legacy', issue: null }] }]
        ctx.mockNext([{ pid: 4, issues: [{ marker: 'legacy', 'issue.id': null, 'issue.title': null }] }])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(4))
            .select({
                pid:    tProject.id,
                issues: ctx.conn.aggregateAsArray({
                    marker: tProject.slug,
                    issue:  { id: tIssueLeft.id, title: tIssueLeft.title },
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "pid", json_arrayagg(json_object('marker' value project.slug, 'issue.id' value issue.id, 'issue.title' value issue.title)) as "issues" from project left join issue on issue.project_id = project.id where project.id = :0 group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ marker: string; issue: { id: number; title: string } | null }>
        }>>>()
        expect(rows).toEqual(expected)
        expect(rows[0]!.issues[0]!.issue).toBeNull()
    })
})
