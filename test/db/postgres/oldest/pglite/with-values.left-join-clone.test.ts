// Values↔View coverage asymmetry on the clone/left-join surface. The View
// tests both `forUseInLeftJoin()` arms (no-arg AND aliased); the Values
// coverage in `with-values.advanced.test.ts` only ever uses the aliased
// `forUseInLeftJoinAs(alias)` / `.as(alias)` forms on a virtual-column-FREE
// Values. This file closes the two gaps:
//   - the NO-ARG `forUseInLeftJoin()` on a Values (qualified by the WITH
//     name, not a user alias), and
//   - cloning (`.as(alias)` / `forUseInLeftJoinAs(alias)`) a Values that
//     carries a VIRTUAL column — the clone re-walks column names through
//     `__setColumnsName`, whose `isValueSource` `continue` branch skips the
//     virtual column (a Values↔View divergence: View doesn't re-walk on
//     clone). Reading the virtual field inlines its fragment SQL instead of
//     qualifying it with the alias.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Values } from '../../../../../src/Values.js'
import { DBConnection, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

class VProjectPatch extends Values<DBConnection, 'projectPatch'> {
    id   = this.column('int')
    name = this.column('string')
}

// A Values that carries a VIRTUAL column (`label`) alongside the real
// `column(...)` members. The virtual column is NOT a VALUES tuple member;
// reading it inlines the fragment SQL, and the clone re-walk skips it.
class VProjectPatchVirtual extends Values<DBConnection, 'projectPatchV'> {
    id    = this.column('int')
    name  = this.column('string')
    label = this.virtualColumnFromFragment('string', fragment => fragment.sql`'PATCH'`)
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('values-for-use-in-left-join-no-arg-qualifies-by-with-name', async () => {
        // `.forUseInLeftJoin()` (NO alias) marks the values view left-joinable;
        // without an alias the join qualifies its columns by the WITH name
        // `projectPatch`. Project 2 has no patch row → newName is absent.
        ctx.mockNext([
            { pid: 1, newName: 'one' },
            { pid: 2, newName: undefined },
        ])
        const patch = Values.create(VProjectPatch, 'projectPatch', [
            { id: 1, name: 'one' },
        ]).forUseInLeftJoin()

        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(patch).on(patch.id.equals(tProject.id))
            .where(tProject.id.lessOrEqual(2))
            .select({
                pid:     tProject.id,
                newName: patch.name,
            })
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectPatch(id, name) as (values ($1::int4, $2::text)) select project.id as pid, projectPatch.name as "newName" from project left join projectPatch on projectPatch.id = project.id where project.id <= $3 order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "one",
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ pid: number; newName?: string }>>>()
        expect(rows).toEqual([
            { pid: 1, newName: 'one' },
            { pid: 2 },
        ])
    })

    test('values-with-virtual-column-aliased-via-as-skips-virtual-in-name-walk', async () => {
        // `.as(alias)` clones a Values that carries a virtual column. The clone
        // re-walks the column names; the virtual `label` is a value source so
        // it is skipped (`continue`), keeping it out of the WITH `name(cols)`
        // list. Real columns qualify by the alias (`pp.id`/`pp.name`); reading
        // the virtual `label` inlines its fragment (`'PATCH'`).
        const expected = [
            { id: 1, name: 'one', label: 'PATCH' },
            { id: 2, name: 'two', label: 'PATCH' },
        ]
        ctx.mockNext(expected)
        const patch = Values.create(VProjectPatchVirtual, 'projectPatchV', [
            { id: 1, name: 'one' },
            { id: 2, name: 'two' },
        ])
        const pp = patch.as('pp')

        const rows = await ctx.conn.selectFrom(pp)
            .select({ id: pp.id, name: pp.name, label: pp.label })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectPatchV(id, name) as (values ($1::int4, $2::text), ($3::int4, $4::text)) select pp.id as id, pp.name as name, 'PATCH' as label from projectPatchV as pp order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "one",
            2,
            "two",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; name: string; label: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('values-with-virtual-column-for-use-in-left-join-as-skips-virtual', async () => {
        // `.forUseInLeftJoinAs(alias)` clones the virtual-column-carrying Values
        // as the optional join side. The virtual `label` is again skipped in
        // the name re-walk; reading it inlines the fragment. Project 2 has no
        // patch row, so its real columns are absent but the inlined virtual
        // `label` still renders.
        ctx.mockNext([
            { pid: 1, newName: 'one',      tag: 'PATCH' },
            { pid: 2, newName: undefined,  tag: 'PATCH' },
        ])
        const patch = Values.create(VProjectPatchVirtual, 'projectPatchV', [
            { id: 1, name: 'one' },
        ])
        const pp = patch.forUseInLeftJoinAs('pp')

        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(pp).on(pp.id.equals(tProject.id))
            .where(tProject.id.lessOrEqual(2))
            .select({
                pid:     tProject.id,
                newName: pp.name,
                tag:     pp.label,
            })
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectPatchV(id, name) as (values ($1::int4, $2::text)) select project.id as pid, pp.name as "newName", 'PATCH' as tag from project left join projectPatchV as pp on pp.id = project.id where project.id <= $3 order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "one",
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ pid: number; newName?: string; tag?: string }>>>()
        expect(rows).toEqual([
            { pid: 1, newName: 'one', tag: 'PATCH' },
            { pid: 2, tag: 'PATCH' },
        ])
    })
})
