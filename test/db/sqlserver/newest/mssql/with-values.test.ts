// Behavioral coverage of `connection.Values` used as a `WITH name(c1, c2)
// AS (VALUES ...)` clause. The `WITH ... VALUES` form this dialect emits
// is pinned by the snapshot below.
//
// `Values` is typed only on the dialects that support this surface; the
// cells whose dialect types it `never` block-comment their copies with a
// "not supported" note to keep the symmetry audit happy.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { Values } from '../../../../../src/Values.js'
import { DBConnection, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

class VProjectPatch extends Values<DBConnection, 'projectPatch'> {
    id   = this.column('int')
    name = this.column('string')
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('values in select-from', async () => {
        ctx.mockNext([])
        const patch = Values.create(VProjectPatch, 'projectPatch', [
            { id: 1, name: 'one'   },
            { id: 2, name: 'two'   },
        ])
        await ctx.conn.selectFrom(patch)
            .select({ id: patch.id, name: patch.name })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectPatch as (select * from (values (@0, @1), (@2, @3)) as projectPatch(id, name)) select id as id, name as name from projectPatch"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "one",
            2,
            "two",
          ]
        `)
    })

    test('values in update-from', async () => {
        // patch.id = 1 matches seed project 1 ('Marketing site'), so the
        // UPDATE ... FROM (VALUES ...) touches exactly one row, renaming it.
        const renamedProject = { id: 1, name: 'renamed' }
        ctx.mockNext(1)              // affected rows from the UPDATE
        ctx.mockNext(renamedProject) // row from the verification SELECT
        await ctx.withRollback(async () => {
            const patch = Values.create(VProjectPatch, 'projectPatch', [
                { id: 1, name: 'renamed' },
            ])
            const affected = await ctx.conn.update(tProject)
                .from(patch)
                .set({ name: patch.name })
                .where(tProject.id.equals(patch.id))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectPatch as (select * from (values (@0, @1)) as projectPatch(id, name)) update project set name = projectPatch.name from projectPatch where project.id = projectPatch.id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "renamed",
              ]
            `)
            expect(affected).toBe(1)

            const row = await ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({ id: tProject.id, name: tProject.name })
                .executeSelectOne()
            expect(row).toEqual(renamedProject)
        })
    })
})
