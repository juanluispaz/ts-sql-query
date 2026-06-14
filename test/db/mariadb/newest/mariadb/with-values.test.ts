// Behavioral coverage of `connection.Values` used as a `WITH name(c1, c2)
// AS (VALUES ...)` clause. MariaDB 12.3.2 accepts the library's exact
// emission verbatim — `name(cols) AS (VALUES (a, b), (c, d))` (no `ROW`
// keyword) — both as a `select ... from` source and to drive its
// multi-table `UPDATE ... , values_cte`.

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
            // so the multi-table UPDATE ... , projectPatch touches exactly
            // one row.
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
})
