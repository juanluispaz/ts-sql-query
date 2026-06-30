// `tTable.oldValues()` exposes the row state BEFORE the UPDATE is applied,
// so a single statement can `RETURNING { old: oldX, new: newX }` for
// audit / event-sourcing flows. `_buildOldValuesForUpdate` emits a
// synthetic FROM-subquery that pre-projects the target table aliased as
// `_old_` so the RETURNING clause can refer to its columns alongside the
// freshly-updated row. The exact emitted form is pinned per cell by the
// snapshot below.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('returning-old-and-new-single-column-via-oldValues', async () => {
        // Update project 1's name; return both the previous and the
        // new name in one round-trip. Seed: project 1 is 'Marketing
        // site'. After the update its name is 'Mktg site v2'.
        ctx.mockNext({ oldName: 'Marketing site', newName: 'Mktg site v2' })

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Mktg site v2' })
                .where(tProject.id.equals(1))
                .returning({
                    oldName: oldProject.name,
                    newName: tProject.name,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2 returning old.name as "oldName", name as "newName""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mktg site v2",
                1,
              ]
            `)
            assertType<Exact<typeof row, { oldName: string; newName: string }>>()
            if (!ctx.realDbEnabled) {
                expect(row).toEqual({ oldName: 'Marketing site', newName: 'Mktg site v2' })
            } else {
                expect(row.oldName).toBe('Marketing site')
                expect(row.newName).toBe('Mktg site v2')
            }
        })
    })

    test('returning-old-and-new-two-columns-via-oldValues', async () => {
        // Two-column audit projection: pre/post name and pre/post
        // slug. The emission must reference `_old_.name`, `_old_.slug`
        // inside the synthesised FROM-subquery and the matching live
        // columns on the target table.
        ctx.mockNext({
            id: 2,
            oldName: 'Internal tools',
            newName: 'Internal apps',
            oldSlug: 'tools',
            newSlug: 'apps',
        })

        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const row = await ctx.conn.update(tProject)
                .set({ name: 'Internal apps', slug: 'apps' })
                .where(tProject.id.equals(2))
                .returning({
                    id:      tProject.id,
                    oldName: oldProject.name,
                    newName: tProject.name,
                    oldSlug: oldProject.slug,
                    newSlug: tProject.slug,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1, slug = $2 where id = $3 returning id as id, old.name as "oldName", name as "newName", old.slug as "oldSlug", slug as "newSlug""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Internal apps",
                "apps",
                2,
              ]
            `)
            assertType<Exact<typeof row, {
                id: number
                oldName: string
                newName: string
                oldSlug: string
                newSlug: string
            }>>()
            if (!ctx.realDbEnabled) {
                expect(row).toEqual({
                    id: 2,
                    oldName: 'Internal tools',
                    newName: 'Internal apps',
                    oldSlug: 'tools',
                    newSlug: 'apps',
                })
            } else {
                expect(row.id).toBe(2)
                expect(row.oldName).toBe('Internal tools')
                expect(row.newName).toBe('Internal apps')
                expect(row.oldSlug).toBe('tools')
                expect(row.newSlug).toBe('apps')
            }
        })
    })

    test('returning-one-column-old-value-via-oldValues', async () => {
        // The bare single-column `returningOneColumn(oldProject.name)` form off an
        // UPDATE: it returns ONLY the previous value of `name` (pre-update). The
        // returning-object forms above pin the multi-column shape; this pins the
        // scalar one-column shape (`string`). Update project 1's name; the old
        // name 'Marketing site' comes back.
        ctx.mockNext('Marketing site')
        await ctx.withRollback(async () => {
            const oldProject = tProject.oldValues()
            const oldName = await ctx.conn.update(tProject)
                .set({ name: 'Mktg site v3' })
                .where(tProject.id.equals(1))
                .returningOneColumn(oldProject.name)
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2 returning old.name as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Mktg site v3",
                1,
              ]
            `)
            assertType<Exact<typeof oldName, string>>()
            expect(oldName).toBe('Marketing site')
        })
    })
})
