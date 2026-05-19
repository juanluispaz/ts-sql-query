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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('docs:delete/delete-many', async () => {
        ctx.mockNext(2)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const affected = await connection.deleteFrom(tIssue)
                .where(tIssue.status.equals('open'))
                .executeDelete()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where status = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "open",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(2)
        })
    })

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = :0 returning id, title into :1, :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "title",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof removed, {
                id:    number
                title: string
            }>>()
            expect(removed.id).toBe(4)
        })
    })

    test('docs:delete/delete-using', async () => {
        // Section "Delete using other tables or views" — `.using(other)`
        // brings another table into the delete so the WHERE can reference
        // its columns.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const affected = await connection.deleteFrom(tIssue)
                .using(tProject)
                .where(tIssue.projectId.equals(tProject.id))
                .and(tProject.name.containsInsensitive('Legacy'))
                .executeDelete()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using project where issue.project_id = project.id and lower(project.name) like lower('%' || :0 || '%') escape '\\'"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Legacy",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = :0 returning title into :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
                {
                  "as": "result",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof removedTitle, string>>()
        })
    })
})
