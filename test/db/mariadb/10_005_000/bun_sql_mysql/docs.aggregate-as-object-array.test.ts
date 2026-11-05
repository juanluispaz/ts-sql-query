// Documentation snippets for the Aggregate-as-object-array page
// (docs/queries/aggregate-as-object-array.md). Covers
// `aggregateAsArray`, `aggregateAsArrayOfOneColumn`, the distinct variant
// of the latter, and the `forUseAsInlineAggregatedArrayValue` inline form.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:aggregate-as-object-array/aggregate-as-array', async () => {
        const expected = {
            id: 1, name: 'Acme Corp',
            projects: [
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ],
        }
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projects: JSON.stringify([
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ]),
        })
        const connection = ctx.conn

        // doc-start
        const tProjectLeftJoin = tProject.forUseInLeftJoin()
        const row = await connection.selectFrom(tOrganization)
            .leftJoin(tProjectLeftJoin).on(tProjectLeftJoin.organizationId.equals(tOrganization.id))
            .where(tOrganization.id.equals(1))
            .select({
                id:   tOrganization.id,
                name: tOrganization.name,
                projects: connection.aggregateAsArray({
                    id:   tProjectLeftJoin.id,
                    name: tProjectLeftJoin.name,
                }).asOptionalNonEmptyArray(),
            })
            .groupBy('id', 'name')
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as id, organization.name as name, cast(json_arrayagg(json_object('id', project.id, 'name', project.name)) as char) as projects from organization left join project on project.organization_id = organization.id where organization.id = ? group by organization.id, organization.name"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:   number
            name: string
            projects?: Array<{ id: number; name: string }>
        }>>()
        expect(row).toEqual(expected)
    })

    test('docs:aggregate-as-object-array/aggregate-as-array-of-one-column', async () => {
        const expected = {
            id: 1, name: 'Acme Corp',
            projectNames: ['Marketing site mktg-site', 'Internal tools tools'],
        }
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projectNames: JSON.stringify(['Marketing site mktg-site', 'Internal tools tools']),
        })
        const connection = ctx.conn

        // doc-start
        const tProjectLeftJoin = tProject.forUseInLeftJoin()
        const row = await connection.selectFrom(tOrganization)
            .leftJoin(tProjectLeftJoin).on(tProjectLeftJoin.organizationId.equals(tOrganization.id))
            .where(tOrganization.id.equals(1))
            .select({
                id:           tOrganization.id,
                name:         tOrganization.name,
                projectNames: connection.aggregateAsArrayOfOneColumn(tProjectLeftJoin.name.concat(' ').concat(tProjectLeftJoin.slug)),
            })
            .groupBy('id', 'name')
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as id, organization.name as name, cast(json_arrayagg(concat(project.name, ?, project.slug)) as char) as projectNames from organization left join project on project.organization_id = organization.id where organization.id = ? group by organization.id, organization.name"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            " ",
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:           number
            name:         string
            projectNames: string[]
        }>>()
        expect(row).toEqual(expected)
    })

    test('docs:aggregate-as-object-array/inline-aggregated-array', async () => {
        const expected = {
            id: 1, name: 'Acme Corp',
            projects: [
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ],
        }
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projects: JSON.stringify([
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ]),
        })
        const connection = ctx.conn

        // doc-start
        const orgProjects = connection.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .forUseAsInlineAggregatedArrayValue()

        const row = await connection.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:       tOrganization.id,
                name:     tOrganization.name,
                projects: orgProjects,
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, cast((select json_arrayagg(json_object('id', id, 'name', name) order by id) from project where organization_id = organization.id) as char) as projects from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:       number
            name:     string
            projects: Array<{ id: number; name: string }>
        }>>()
        expect(row).toEqual(expected)
    })

    test('docs:aggregate-as-object-array/inline-aggregated-of-one-column', async () => {
        // orderBy('result') → real DB returns the names alphabetically.
        const expected = {
            id: 1, name: 'Acme Corp',
            projectNames: ['Internal tools tools', 'Marketing site mktg-site'],
        }
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projectNames: JSON.stringify(['Internal tools tools', 'Marketing site mktg-site']),
        })
        const connection = ctx.conn

        // doc-start
        const orgProjectNames = connection.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .selectOneColumn(tProject.name.concat(' ').concat(tProject.slug))
            .orderBy('result')
            .forUseAsInlineAggregatedArrayValue()

        const row = await connection.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:           tOrganization.id,
                name:         tOrganization.name,
                projectNames: orgProjectNames,
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, cast((select json_arrayagg(concat(name, ?, slug) order by concat(name, ?, slug)) from project where organization_id = organization.id) as char) as projectNames from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            " ",
            " ",
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:           number
            name:         string
            projectNames: string[]
        }>>()
        expect(row).toEqual(expected)
    })

    test('docs-extra:aggregate-as-object-array/aggregate-as-array-of-one-column-distinct', async () => {
        // Per-issue counts of priorities, distinct list.
        ctx.mockNext({
            id: 1, name: 'Marketing site',
            priorities: JSON.stringify([1, 2]),
        })
        const connection = ctx.conn

        // doc-start
        const tIssueLeftJoin = tIssue.forUseInLeftJoin()
        const row = await connection.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                id:         tProject.id,
                name:       tProject.name,
                priorities: connection.aggregateAsArrayOfOneColumnDistinct(tIssueLeftJoin.priority),
            })
            .groupBy('id', 'name')
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, cast(json_arrayagg(distinct issue.priority) as char) as priorities from project left join issue on issue.project_id = project.id where project.id = ? group by project.id, project.name"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:         number
            name:       string
            priorities: number[]
        }>>()
        // project 1's issues have priorities 1 and 2; distinct, order not guaranteed.
        expect(row?.id).toBe(1)
        expect(row?.name).toBe('Marketing site')
        expect(row?.priorities.slice().sort((a, b) => a - b)).toEqual([1, 2])
    })
    // NOT-APPLICABLE: MariaDB does not allow outer references inside a recursive subquery, so forUseAsInlineAggregatedArrayValue is typed never on a recursive inline aggregate
    /*
    test('docs:aggregate-as-object-array/recursive-query-as-inline-array', async () => {
        // A recursive query used as an inline aggregated array: walk an issue's
        // ancestor chain (its parent, then the parent's parent, …) via the
        // self-referential parent_id, and project the chain as a nested array on
        // the issue row. Issue 1 has no parent, so the array is empty. Not
        // supported on dialects that reject outer references in a recursive
        // subquery.
        const expected = { id: 1, title: 'Update hero copy', ancestors: [] }
        ctx.mockNext({ id: 1, title: 'Update hero copy', parentId: null, ancestors: null })
        const connection = ctx.conn

        // doc-start
        const parentIssue = tIssue.as('parentIssue')
        const ancestors = connection.subSelectUsing(tIssue)
            .from(parentIssue)
            .select({
                id:       parentIssue.id,
                title:    parentIssue.title,
                parentId: parentIssue.parentId,
            })
            .where(parentIssue.id.equals(tIssue.parentId))
            .recursiveUnionAllOn((child) => child.parentId.equals(parentIssue.id))
            .forUseAsInlineAggregatedArrayValue()

        const row = await connection.selectFrom(tIssue)
            .select({
                id:        tIssue.id,
                title:     tIssue.title,
                parentId:  tIssue.parentId,
                ancestors,
            })
            .where(tIssue.id.equals(1))
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, parent_id as parentId, (with recursive recursive_select_1 as (select parentIssue.id as id, parentIssue.title as title, parentIssue.parent_id as parentId from issue as parentIssue where parentIssue.id = issue.parent_id union all select parentIssue.id as id, parentIssue.title as title, parentIssue.parent_id as parentId from issue as parentIssue join recursive_select_1 on recursive_select_1.parentId = parentIssue.id) select json_group_array(json_object('id', id, 'title', title, 'parentId', parentId)) from recursive_select_1) as ancestors from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:        number
            title:     string
            parentId?: number
            ancestors: Array<{ id: number; title: string; parentId?: number }>
        }>>()
        expect(row).toEqual(expected)
    })
    */

    test('docs:aggregate-as-object-array/ordering-and-limiting-the-array', async () => {
        // Section "Ordering and limiting the array": only the inline form takes an order
        // by and a limit, and they apply to the array of each row. Project 1 has issues 1
        // and 2, so the last one is issue 2.
        const expected = {
            id: 1, name: 'Marketing site',
            lastIssues: [{ id: 2, title: 'Redesign navbar' }],
        }
        ctx.mockNext({
            id: 1, name: 'Marketing site',
            lastIssues: JSON.stringify([{ id: 2, title: 'Redesign navbar' }]),
        })
        const connection = ctx.conn

        // doc-start
        const lastIssues = connection.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .orderBy('id', 'desc')
            .limit(1)
            .forUseAsInlineAggregatedArrayValue()

        const row = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:   tProject.id,
                name: tProject.name,
                lastIssues,
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, cast((select json_arrayagg(json_object('id', id, 'title', title) order by id desc limit ?) from issue where project_id = project.id) as char) as lastIssues from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:         number
            name:       string
            lastIssues: Array<{ id: number; title: string }>
        }>>()
        expect(row).toEqual(expected)
    })

    test('docs:aggregate-as-object-array/arrays-inside-an-array', async () => {
        // Section "Arrays inside an array": an inline array as a property of the elements
        // of another inline array. Organization 1 has projects 1 (issues 1, 2) and 2
        // (issue 3).
        ctx.mockNext({
            id: 1, name: 'Acme Corp',
            projects: JSON.stringify([
                { id: 1, name: 'Marketing site', issues: [{ id: 1 }, { id: 2 }] },
                { id: 2, name: 'Internal tools', issues: [{ id: 3 }] },
            ]),
        })
        const connection = ctx.conn

        // doc-start
        const issuesOfTheProject = connection.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ id: tIssue.id })
            .forUseAsInlineAggregatedArrayValue()

        const projectsOfTheOrganization = connection.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({
                id:     tProject.id,
                name:   tProject.name,
                issues: issuesOfTheProject,
            })
            .forUseAsInlineAggregatedArrayValue()

        const row = await connection.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:       tOrganization.id,
                name:     tOrganization.name,
                projects: projectsOfTheOrganization,
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, cast((select json_arrayagg(json_object('id', id, 'name', name, 'issues', (select json_arrayagg(json_object('id', id)) from issue where project_id = project.id))) from project where organization_id = organization.id) as char) as projects from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:       number
            name:     string
            projects: Array<{ id: number; name: string; issues: Array<{ id: number }> }>
        }>>()
        // No order by: the order of each array is not defined, so they are sorted to compare.
        const sorted = {
            ...row,
            projects: [...row.projects]
                .map(p => ({ ...p, issues: [...p.issues].sort((a, b) => a.id - b.id) }))
                .sort((a, b) => a.id - b.id),
        }
        expect(sorted).toEqual({
            id: 1, name: 'Acme Corp',
            projects: [
                { id: 1, name: 'Marketing site', issues: [{ id: 1 }, { id: 2 }] },
                { id: 2, name: 'Internal tools', issues: [{ id: 3 }] },
            ],
        })
    })

    test('docs:aggregate-as-object-array/array-only-when-required', async () => {
        // Section "When there are no values": `onlyWhenOrNull(false)` writes a null in the
        // place of the subquery, so the property is absent from the result.
        ctx.mockNext({ id: 1, name: 'Acme Corp', projects: null })
        const connection = ctx.conn
        const includeProjects: boolean = false

        // doc-start
        const projectsOfTheOrganization = connection.subSelectUsing(tOrganization).from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .forUseAsInlineAggregatedArrayValue()
            .onlyWhenOrNull(includeProjects)

        const row = await connection.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:       tOrganization.id,
                name:     tOrganization.name,
                projects: projectsOfTheOrganization,
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, cast(null as char) as projects from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:        number
            name:      string
            projects?: Array<{ id: number; name: string }>
        }>>()
        expect(row).toEqual({ id: 1, name: 'Acme Corp' })
    })

    test('docs:aggregate-as-object-array/optional-values-of-an-aggregate', async () => {
        // Section "Optional values in the elements": `projectingOptionalValuesAsNullable()`
        // right after `aggregateAsArray(...)`. Project 1 has issue 1 (body null) and
        // issue 2 (body set).
        ctx.mockNext({
            id: 1,
            issues: JSON.stringify([
                { id: 1, body: null },
                { id: 2, body: 'Use new tokens' },
            ]),
        })
        const connection = ctx.conn

        // doc-start
        const tIssueLeftJoin = tIssue.forUseInLeftJoin()

        const row = await connection.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                id: tProject.id,
                issues: connection.aggregateAsArray({
                    id:   tIssueLeftJoin.id,
                    body: tIssueLeftJoin.body,
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('id')
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, cast(json_arrayagg(json_object('id', issue.id, 'body', issue.\`body\`)) as char) as issues from project left join issue on issue.project_id = project.id where project.id = ? group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:     number
            issues: Array<{ id: number; body: string | null }>
        }>>()
        // No order by: the order of the array is not defined, so it is sorted to compare.
        expect([...row.issues].sort((a, b) => a.id - b.id)).toEqual([
            { id: 1, body: null },
            { id: 2, body: 'Use new tokens' },
        ])
    })

    test('docs:aggregate-as-object-array/optional-values-of-an-inline-query', async () => {
        // Section "Optional values in the elements": in the inline form the method goes
        // right after `select(...)`.
        ctx.mockNext({
            id: 1,
            issues: JSON.stringify([
                { id: 1, body: null },
                { id: 2, body: 'Use new tokens' },
            ]),
        })
        const connection = ctx.conn

        // doc-start
        const issuesOfTheProject = connection.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({
                id:   tIssue.id,
                body: tIssue.body,
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('id')
            .forUseAsInlineAggregatedArrayValue()

        const row = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                issues: issuesOfTheProject,
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast((select json_arrayagg(json_object('id', id, 'body', \`body\`) order by id) from issue where project_id = project.id) as char) as issues from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:     number
            issues: Array<{ id: number; body: string | null }>
        }>>()
        expect(row.issues).toEqual([
            { id: 1, body: null },
            { id: 2, body: 'Use new tokens' },
        ])
    })

})
