// Documentation snippets for the UPDATE page (docs/queries/update.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:update/update-one-row', async () => {
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const affected = await connection.update(tProject)
                .set({ name: 'Marketing site (v2)' })
                .where(tProject.id.equals(1))
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0 where id = @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site (v2)",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('docs:update/update-with-set-if-value', async () => {
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const newTitle: string | null = 'Update hero copy (revised)'
            const newPriority: number | null = null

            const affected = await connection.update(tIssue)
                .set({})
                .setIfValue({ title:    newTitle })
                .setIfValue({ priority: newPriority })
                .where(tIssue.id.equals(1))
                .executeUpdate()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = @0 where id = @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Update hero copy (revised)",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('docs:update/update-returning', async () => {
        ctx.mockNext({ id: 1, name: 'Marketing site (v2)', slug: 'mktg-site' })

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const updated = await connection.update(tProject)
                .set({ name: 'Marketing site (v2)' })
                .where(tProject.id.equals(1))
                .returning({
                    id:   tProject.id,
                    name: tProject.name,
                    slug: tProject.slug,
                })
                .executeUpdateOne()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0 output inserted.id as id, inserted.name as name, inserted.slug as slug where id = @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site (v2)",
                1,
              ]
            `)
            assertType<Exact<typeof updated, {
                id:   number
                name: string
                slug: string
            }>>()
            expect(updated.name).toBe('Marketing site (v2)')
        })
    })
})
