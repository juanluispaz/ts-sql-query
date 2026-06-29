// Exhaustive coverage of `customizeQuery({...})` hooks on DELETE.
// The docs page exercises `afterDeleteKeyword` + `afterQuery`; this
// file fills the gap with `beforeQuery` plus variants where the
// fragment interpolates bound values and column references - which
// drives `__registerRequiredColumn`/`__addWiths` on the DELETE
// builder.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('customize-delete-before-query-emits-leading-comment', async () => {
        // `beforeQuery` lands ahead of the DELETE keyword. Useful as
        // a routing marker the proxy reads before parsing.
        ctx.mockNext(0)
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const affected = await connection.deleteFrom(tProject)
                .where(tProject.id.equals(9999))
                .customizeQuery({
                    beforeQuery: connection.rawFragment`/* op=purge */ `,
                })
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* op=purge */  delete from project where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                9999,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

    test('customize-delete-hook-fragment-with-column-reference', async () => {
        // Column reference inside the hook fragment - drives
        // `__registerRequiredColumn` on the DELETE builder.
        ctx.mockNext(0)
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const affected = await connection.deleteFrom(tIssue)
                .where(tIssue.id.equals(99999))
                .customizeQuery({
                    afterQuery: connection.rawFragment` /* keyed-by ${tIssue.projectId} */`,
                })
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = ?  /* keyed-by project_id */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                99999,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

    test('customize-delete-all-hooks-combined', async () => {
        // The three RawFragment hooks applied together; snapshot
        // documents the layout.
        ctx.mockNext(0)
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const affected = await connection.deleteFrom(tProject)
                .where(tProject.id.equals(9999))
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterDeleteKeyword: connection.rawFragment`/*+ hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  delete /*+ hint */ from project where id = ?  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                9999,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

    test('customize-delete-returning-object-with-hooks', async () => {
        // The object-RETURNING + `customizeQuery` arm on DELETE: `.returning({...})`
        // yields a composable customizable executable, so the customize hook
        // lands on the same statement while the RETURNING result type (an
        // object) is preserved. Issue 1 is removed and its columns read back;
        // the keyed id and the seeded title are deterministic in both modes.
        const expected = { id: 1, title: 'Update hero copy' }
        ctx.mockNext(expected)
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const row = await connection.deleteFrom(tIssue)
                .where(tIssue.id.equals(1))
                .returning({ id: tIssue.id, title: tIssue.title })
                .customizeQuery({ afterDeleteKeyword: connection.rawFragment`/*+ hint */` })
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete /*+ hint */ from issue where id = ? returning id as id, title as title"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number; title: string }>>()
            expect(row).toEqual(expected)
        })
    })
    test('customize-delete-returning-one-column-with-hooks', async () => {
        // The single-column RETURNING + `customizeQuery` arm on DELETE:
        // `.returningOneColumn(col)` yields a composable customizable executable,
        // so the customize hook lands on the same statement while the SCALAR
        // RETURNING result type survives the hook. Issue 1 is removed and its
        // seeded title read back; the keyed id and the title are deterministic in
        // both modes.
        ctx.mockNext('Update hero copy')
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const title = await connection.deleteFrom(tIssue)
                .where(tIssue.id.equals(1))
                .returningOneColumn(tIssue.title)
                .customizeQuery({ afterDeleteKeyword: connection.rawFragment`/*+ hint */` })
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete /*+ hint */ from issue where id = ? returning title as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof title, string>>()
            expect(title).toBe('Update hero copy')
        })
    })

})
