// Exhaustive coverage of `customizeQuery({...})` hooks on UPDATE.
// The docs page exercises `afterUpdateKeyword` + `afterQuery`; this
// file fills the gap with `beforeQuery` plus variants where the
// fragment interpolates bound values and column references - which
// drives `__registerRequiredColumn`/`__addWiths` on the UPDATE
// builder
//
// Hook fields defined

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('customize-update-before-query-emits-leading-comment', async () => {
        // `beforeQuery` lands ahead of the UPDATE keyword - a marker
        // a proxy can read before parsing the statement.
        ctx.mockNext(1)
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const affected = await connection.update(tProject)
                .set({ name: 'Marketing site (renamed)' })
                .where(tProject.id.equals(1))
                .customizeQuery({
                    beforeQuery: connection.rawFragment`/* op=rename */ `,
                })
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* op=rename */  update project set name = :0 where id = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site (renamed)",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

    test('customize-update-hook-fragment-with-column-reference', async () => {
        // Column reference inside the hook fragment - drives
        // `__registerRequiredColumn` on the UPDATE builder.
        ctx.mockNext(1)
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const affected = await connection.update(tIssue)
                .set({ status: 'closed' })
                .where(tIssue.id.equals(1))
                .customizeQuery({
                    afterQuery: connection.rawFragment` /* keyed-by ${tIssue.projectId} */`,
                })
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = :0 where id = :1  /* keyed-by project_id */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "closed",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })

    test('customize-update-all-hooks-combined', async () => {
        // The three RawFragment hooks applied together; the snapshot
        // documents exactly where each lands relative to the UPDATE.
        ctx.mockNext(1)
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const affected = await connection.update(tProject)
                .set({ name: 'Mobile app (v2)' })
                .where(tProject.id.equals(1))
                .customizeQuery({
                    beforeQuery:        connection.rawFragment`/* head */ `,
                    afterUpdateKeyword: connection.rawFragment`/*+ hint */`,
                    afterQuery:         connection.rawFragment` /* tail */`,
                })
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  update /*+ hint */ project set name = :0 where id = :1  /* tail */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mobile app (v2)",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
        })
    })
})
