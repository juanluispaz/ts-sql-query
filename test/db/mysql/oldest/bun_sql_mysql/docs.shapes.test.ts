// Documentation snippets for the page of the shapes (docs/queries/shapes.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { extractWritableShapeFrom } from '../../../../../src/extras/utils.js'
import type { UpdatableValuesShapedAs } from '../../../../../src/extras/types.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:shapes/insert-with-shape', async () => {
        // Section "Insert with a shape" — `shapedAs(...)` renames
        // the source-object keys to the actual column names; `extendShape`
        // tacks on additional mappings.
        ctx.mockNext(77)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const projectToInsert = {
                projectName: 'Operations',
                projectSlug: 'ops',
            }
            const currentOrgId = 1

            const id = await connection.insertInto(tProject)
                .shapedAs({
                    projectName: 'name',
                    projectSlug: 'slug',
                }).set(projectToInsert)
                .extendShape({
                    projectOrganizationId: 'organizationId',
                }).set({
                    projectOrganizationId: currentOrgId,
                })
                .returningLastInsertedId()
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (name, slug, organization_id) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Operations",
                "ops",
                1,
              ]
            `)
            assertType<Exact<typeof id, number>>()
            expect(typeof id).toBe('number')
        })
    })
    // NOT-APPLICABLE: MySQL can't return the last inserted id of an insert of multiple rows, so returningLastInsertedId is typed never after values(array)
    /*
    test('docs:shapes/insert-multiple-with-shape', async () => {
        // Section "Insert multiple rows with a shape" — combine
        // `shapedAs` with `values(arr)` + `extendShape` + `setForAll` to
        // apply a constant to every row.
        ctx.mockNext([81, 82])

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const projectsToInsert = [
                { projectName: 'Mobile app', projectSlug: 'mobile' },
                { projectName: 'Dashboard',  projectSlug: 'dash' },
            ]
            const currentOrgId = 1

            const insertMultipleProjects = await connection.insertInto(tProject)
                .shapedAs({
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .values(projectsToInsert)
                .extendShape({
                    projectOrganizationId: 'organizationId',
                }).setForAll({
                    projectOrganizationId: currentOrgId,
                }).returningLastInsertedId()
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof insertMultipleProjects, number[]>>()
            expect(insertMultipleProjects).toHaveLength(2)
        })
    })
    */
    test('docs:shapes/update-with-shape', async () => {
        // Section "Update with a shape" — `shapedAs(...)` renames
        // the source-object keys to column names; `extendShape` tacks on
        // additional mappings for chained sets.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const issueId = 1
            const issueData = {
                newTitle:    'Update hero copy (revised)',
                newPriority: 1,
            }
            const newAssignee = 2

            const affected = await connection.update(tIssue)
                .shapedAs({
                    newTitle:    'title',
                    newPriority: 'priority',
                })
                .set(issueData)
                .extendShape({
                    newAssignee: 'assigneeId',
                })
                .set({
                    newAssignee,
                })
                .where(tIssue.id.equals(issueId))
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ?, priority = ?, assignee_id = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Update hero copy (revised)",
                1,
                2,
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })
    test('docs:shapes/update-multiple-tables', async () => {
        // Both tables change, so the engine counts one row in each.
        ctx.mockNext(2)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const projectNameAndOrganizationName = {
                id:               1,
                projectName:      'Marketing site (v2)',
                projectSlug:      'mktg-site-v2',
                organizationName: 'Acme Inc.',
            }

            const updatedCount = await connection.update(tProject)
                .innerJoin(tOrganization).on(tProject.organizationId.equals(tOrganization.id))
                .shapedAs({
                    projectName:      tProject.name,
                    projectSlug:      tProject.slug,
                    organizationName: tOrganization.name,
                })
                .set(projectNameAndOrganizationName)
                .where(tProject.id.equals(projectNameAndOrganizationName.id))
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project inner join organization on project.organization_id = organization.id set project.name = ?, project.slug = ?, organization.name = ? where project.id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site (v2)",
                "mktg-site-v2",
                "Acme Inc.",
                1,
              ]
            `)
            assertType<Exact<typeof updatedCount, number>>()
            expect(updatedCount).toBe(2)
        })
    })

    test('docs:shapes/extract-writable-shape-from', async () => {
        // Section "A shape from the columns of the table": sessionToken isn't part of the shape.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const issueData = {
                title: 'New title',
                body: 'New body',
                sessionToken: 'abc',
            }

            const updatedCount = await connection.update(tIssue)
                .shapedAs(extractWritableShapeFrom(tIssue, ['id', 'projectId', 'number', 'status', 'priority']))
                .set(issueData)
                .where(tIssue.id.equals(2))
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ?, body = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "New title",
                "New body",
                2,
              ]
            `)
            assertType<Exact<typeof updatedCount, number>>()
            expect(updatedCount).toBe(1)
        })
    })

    test('docs:shapes/type-of-the-values', async () => {
        // Section "The type of the values": the values follow the names of the shape.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const issueShape = {
                newTitle: 'title',
                newBody: 'body',
            } as const

            type IssueData = UpdatableValuesShapedAs<typeof tIssue, typeof issueShape>

            const issueData: IssueData = { newTitle: 'New title' }

            const updatedCount = await connection.update(tIssue)
                .shapedAs(issueShape)
                .set(issueData)
                .where(tIssue.id.equals(2))
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "New title",
                2,
              ]
            `)
            assertType<Exact<typeof updatedCount, number>>()
            expect(updatedCount).toBe(1)
        })
    })
})
