// Behavioral coverage of `connection.Values` used as a `WITH name(c1, c2)
// AS (VALUES ...)` clause. The `WITH ... VALUES` form this dialect emits
// is pinned by the snapshot below.
//
// `Values` is typed only on the dialects that support this surface; the
// cells whose dialect types it `never` block-comment their copies with a
// "not supported" note to keep the symmetry audit happy.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
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
            let caught: unknown
            try {
                await ctx.conn.update(tProject)
                    .from(patch)
                    .set({ name: patch.name })
                    .where(tProject.id.equals(patch.id))
                    .executeUpdate()
            } catch (e) {
                caught = e
            }
            // The SQL builder emits the `UPDATE … FROM` + WITH-VALUES form,
            // which Oracle has no syntax for, so the real engine rejects it
            // at execution; the mock resolves 0. Either way the interceptor
            // captured the emitted SQL, which is what this test pins.
            if (ctx.realDbEnabled) expect(caught).toBeInstanceOf(Error)
            else expect(caught).toBeUndefined()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectPatch(id, name) as (values (:0, :1)) update project set project.name = projectPatch.name from projectPatch where project.id = projectPatch.id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "renamed",
              ]
            `)
        })
    })

    test('values in a compound-union arm', async () => {
        // An inline `Values` view used as one ARM of a compound (UNION): the arm's
        // `WITH name(cols) AS (VALUES ...)` must bubble up to the TOP-LEVEL compound
        // WITH clause (SelectQueryBuilder collects the arm's WITHs). The seed arm is
        // the Values view (so the result stays required). project 1 ('Marketing
        // site') ∪ the two literal VALUES rows, ordered by id.
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 100, name: 'from-values-a' },
            { id: 200, name: 'from-values-b' },
        ]
        ctx.mockNext(expected)
        const patch = Values.create(VProjectPatch, 'projectPatch', [
            { id: 100, name: 'from-values-a' },
            { id: 200, name: 'from-values-b' },
        ])
        const result = await ctx.conn.selectFrom(patch)
            .select({ id: patch.id, name: patch.name })
            .union(
                ctx.conn.selectFrom(tProject)
                    .where(tProject.id.equals(1))
                    .select({ id: tProject.id, name: tProject.name }),
            )
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectPatch(id, name) as (values (:0, :1), (:2, :3)) select id as "id", name as "name" from projectPatch union select id as "id", name as "name" from project where id = :4 order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
            "from-values-a",
            200,
            "from-values-b",
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; name: string }>>>()
        expect(result).toEqual(expected)
    })

})
