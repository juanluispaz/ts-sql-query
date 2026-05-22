// Behavioral coverage of `connection.Values` used as a `WITH name(c1, c2)
// AS (VALUES ...)` clause. Each SqlBuilder owns its own
// `_buildWithValues` implementation (Abstract default for sqlite/oracle,
// dialect overrides on postgres / sqlserver). No existing test reaches
// this path on the new test matrix.
//
// Values is typed only on postgres / sqlite / sqlserver / oracle / noopDB
// — mariadb and mysql block-comment their copies with a "not supported"
// note to keep the symmetry audit happy.

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectPatch(id, name) as (values (:0, :1), (:2, :3)) select id as "id", name as "name" from projectPatch"`)
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
        await ctx.withRollback(async () => {
            ctx.mockNext(0)
            const patch = Values.create(VProjectPatch, 'projectPatch', [
                { id: 1, name: 'renamed' },
            ])
            try {
                await ctx.conn.update(tProject)
                    .from(patch)
                    .set({ name: patch.name })
                    .where(tProject.id.equals(patch.id))
                    .executeUpdate()
            } catch {
                // some real-DB engines reject this exact form; the SQL
                // builder still emits it and that is what we capture.
            }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectPatch(id, name) as (values (:0, :1)) update project set project.name = projectPatch.name from projectPatch where project.id = projectPatch.id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "renamed",
              ]
            `)
        })
    })
})
