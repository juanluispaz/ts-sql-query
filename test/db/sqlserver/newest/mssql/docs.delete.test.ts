// Documentation snippets for the DELETE page (docs/queries/delete.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = @0"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where status = @0"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue output deleted.id as id, deleted.title as title where id = @0"`)
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
})
