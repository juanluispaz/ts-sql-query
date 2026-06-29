// A SHAPED insert/update chained into `customizeQuery(...)` and into the `returning`
// surface — the `shaped × customizeQuery` and `shaped × returning` combinations for
// both INSERT and UPDATE.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('shaped-insert-customize-query', async () => {
        // `insertInto(t).shapedAs({...}).set({...}).customizeQuery({...})` — the
        // shaped insert chained through the customization seam (a leading
        // comment fragment). The renamed keys still map to the real columns.
        ctx.mockNext(1)
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const inserted = await connection.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug' })
                .set({ orgId: 1, projectName: 'Shaped + customize', projectSlug: 'shaped-customize' })
                .customizeQuery({ beforeQuery: connection.rawFragment`/* shaped-insert */ ` })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* shaped-insert */  insert into project (organization_id, name, slug) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped + customize",
                "shaped-customize",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-insert-returning-last-inserted-id', async () => {
        // `insertInto(t).shapedAs({...}).set({...}).returningLastInsertedId()` —
        // the shaped insert chained into the last-inserted-id returning seam.
        const mockId = 100
        ctx.mockNext(mockId)
        await ctx.withRollback(async () => {
            const id = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug' })
                .set({ orgId: 1, projectName: 'Shaped + returning id', projectSlug: 'shaped-ret-id' })
                .returningLastInsertedId()
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped + returning id",
                "shaped-ret-id",
              ]
            `)
            assertType<Exact<typeof id, number>>()
            // The generated id is non-deterministic on a real engine (seed
            // reserves project ids 1-4); the mock pins the exact queued value.
            if (!ctx.realDbEnabled) expect(id).toBe(mockId)
            else expect(id).toBeGreaterThan(4)
        })
    })

    test('shaped-update-customize-query', async () => {
        // `update(t).shapedAs({...}).set({...}).where(...).customizeQuery({...})` —
        // the shaped update chained through the customization seam.
        ctx.mockNext(1)
        const connection = ctx.conn
        await ctx.withRollback(async () => {
            const affected = await connection.update(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Shaped update + customize' })
                .where(tProject.id.equals(1))
                .customizeQuery({ beforeQuery: connection.rawFragment`/* shaped-update */ ` })
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* shaped-update */  update project set name = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Shaped update + customize",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-update-returning-one-row', async () => {
        // `update(t).shapedAs({...}).set({...}).where(...).returning({...})` — the
        // shaped update chained into the RETURNING projection seam. The renamed
        // key drives the SET; the returning object reads the real columns back.
        // Project 1 is renamed and the new row is returned.
        const expected = { id: 1, name: 'Shaped update + returning' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Shaped update + returning' })
                .where(tProject.id.equals(1))
                .returning({ id: tProject.id, name: tProject.name })
                .executeUpdateOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = ? where id = ? returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Shaped update + returning",
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number; name: string }>>()
            expect(row).toEqual(expected)
        })
    })
})
