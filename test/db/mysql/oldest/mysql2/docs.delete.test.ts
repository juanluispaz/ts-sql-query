// Documentation snippets for the DELETE page (docs/queries/delete.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

// tProject is referenced by the commented-out `docs:delete/delete-using`
// test below; the cells where that test is uncommented use it for real.
void tProject

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:delete/delete-by-id', async () => {
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const affected = await connection.deleteFrom(tIssue)
                .where(tIssue.id.equals(4))
                .executeDelete()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    // NOT-APPLICABLE: MySQL has no RETURNING
    /*
    test('docs:delete/delete-returning', async () => {
        ctx.mockNext({ id: 4, title: 'Document /v2/users' })

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const removed = await connection.deleteFrom(tIssue)
                .where(tIssue.id.equals(4))
                .returning({
                    id:    tIssue.id,
                    title: tIssue.title,
                })
                .executeDeleteOne()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = ? returning id as id, title as title"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            assertType<Exact<typeof removed, {
                id:    number
                title: string
            }>>()
            expect(removed.id).toBe(4)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING
    /*
    test('docs-extra:delete/returning-one-column', async () => {
        // "Delete returning" prose: `returningOneColumn(col)` is the
        // single-column counterpart of `returning({...})`.
        ctx.mockNext('Document /v2/users')

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const removedTitle = await connection.deleteFrom(tIssue)
                .where(tIssue.id.equals(4))
                .returningOneColumn(tIssue.title)
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = ? returning title as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            assertType<Exact<typeof removedTitle, string>>()
        })
    })
    */

    test('docs:delete/delete-using', async () => {
        // The seeded 'Public API' project has one issue.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const deletePublicApiIssues = await connection.deleteFrom(tIssue)
                .using(tProject)
                .where(tIssue.projectId.equals(tProject.id))
                .and(tProject.name.containsInsensitive('PUBLIC'))
                .executeDelete()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using issue, project where issue.project_id = project.id and lower(project.\`name\`) like concat('%', lower(?), '%')"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "PUBLIC",
              ]
            `)
            assertType<Exact<typeof deletePublicApiIssues, number>>()
            expect(deletePublicApiIssues).toBe(1)
        })
    })

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — the VALUES table constructor requires MySQL 8.0.19+; below it the library refuses to emit it (UNSUPPORTED_QUERY), and MySQL 5.7 has no VALUES row source.
    /*
    test('docs:delete/bulk-delete', async () => {
        // Seeded issue 4 is the only one with this title and status.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            class VIssueForDelete extends Values<DBConnection, 'issueForDelete'> {
                title  = this.column('string')
                status = this.column('string')
            }
            const issueForDelete = Values.create(VIssueForDelete, 'issueForDelete', [{
                title:  'Document /v2/users',
                status: 'closed',
            }])

            const deleteIssue = await connection.deleteFrom(tIssue)
                .using(issueForDelete)
                .where(tIssue.title.equals(issueForDelete.title))
                .and(tIssue.status.equals(issueForDelete.status))
                .executeDelete()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof deleteIssue, number>>()
            expect(deleteIssue).toBe(1)
        })
    })
    */

    test('docs:delete/delete-without-where', async () => {
        // Section "Delete without a where": every seeded issue goes.
        ctx.mockNext(4)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const deletedCount = await connection.deleteAllowingNoWhereFrom(tIssue)
                .executeDelete()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof deletedCount, number>>()
            expect(deletedCount).toBe(4)
        })
    })

    test('docs:delete/minimum-and-maximum-rows', async () => {
        // Section "The number of deleted rows": exactly one row must be deleted.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const deletedCount = await connection.deleteFrom(tIssue)
                .where(tIssue.id.equals(4))
                .executeDelete(1, 1)
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            assertType<Exact<typeof deletedCount, number>>()
            expect(deletedCount).toBe(1)
        })
    })

    test('docs:delete/delete-with-subquery', async () => {
        // Section "Delete using other tables or views": the issue of the "Public API" project.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const deletedCount = await connection.deleteFrom(tIssue)
                .where(tIssue.projectId.in(
                    connection.selectFrom(tProject)
                        .where(tProject.name.containsInsensitive('Public'))
                        .selectOneColumn(tProject.id)
                ))
                .executeDelete()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where project_id in (select id as result from project where lower(\`name\`) like concat('%', lower(?), '%'))"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Public",
              ]
            `)
            assertType<Exact<typeof deletedCount, number>>()
            expect(deletedCount).toBe(1)
        })
    })

    test('docs:delete/delete-with-join', async () => {
        // The issue of the "Public API" project: one row.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const deletedCount = await connection.deleteFrom(tIssue)
                .innerJoin(tProject).on(tIssue.projectId.equals(tProject.id))
                .where(tProject.name.containsInsensitive('Public'))
                .executeDelete()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using issue inner join project on issue.project_id = project.id where lower(project.\`name\`) like concat('%', lower(?), '%')"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Public",
              ]
            `)
            assertType<Exact<typeof deletedCount, number>>()
            expect(deletedCount).toBe(1)
        })
    })
})
