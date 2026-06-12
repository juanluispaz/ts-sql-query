// Behavioral coverage of `connection.Values` used as a `WITH name(c1, c2)
// AS (VALUES ...)` clause. Each SqlBuilder owns its own
// `_buildWithValues` implementation (Abstract default for sqlite/oracle,
// dialect overrides on postgres / sqlserver). No existing test reaches
// this path on the new test matrix.
//
// Values is typed only on postgres / sqlite / sqlserver / oracle / noopDB
// — mariadb and mysql block-comment their copies (the feature is not
// typed on MariaDBConnection) to keep the symmetry audit happy.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: `connection.Values` (WITH name(...) AS (VALUES ...)) is not typed on MariaDBConnection — the canonical body lives in the postgres / sqlite cells.
    /*
    class VProjectPatch extends Values<DBConnection, 'projectPatch'> {
        id   = this.column('int')
        name = this.column('string')
    }

    test('values in select-from', async () => {
        ctx.mockNext([])
        const patch = Values.create(VProjectPatch, 'projectPatch', [
            { id: 1, name: 'one'   },
            { id: 2, name: 'two'   },
        ])
        await ctx.conn.selectFrom(patch)
            .select({ id: patch.id, name: patch.name })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectPatch(id, name) as (values (?, ?), (?, ?)) select id as id, name as name from projectPatch"`)
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
            // patch.id = 1 matches seed project 1 ('Marketing site'),
            // so the UPDATE ... FROM (VALUES ...) touches exactly one row.
            ctx.mockNext(1)
            const patch = Values.create(VProjectPatch, 'projectPatch', [
                { id: 1, name: 'renamed' },
            ])
            const affected = await ctx.conn.update(tProject)
                .from(patch)
                .set({ name: patch.name })
                .where(tProject.id.equals(patch.id))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectPatch(id, name) as (values (?, ?)) update project, projectPatch set project.name = projectPatch.name where project.id = projectPatch.id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "renamed",
              ]
            `)
            expect(affected).toBe(1)
        })
    })
    */
})
