// Coverage of the `ForceTypeCast` type adapter
// A column wrapped with this adapter unconditionally asks the query
// runner to give the database the type of every bound parameter for that
// column (`addParam(... forceTypeCast = true)`) — independently of where
// in the query it is used (WHERE, projection, INSERT VALUES, etc.). On
// PostgreSQL, pg and Bun SQL emit a `::<type>` cast while postgres.js and
// PGlite send the parameter typed; on dialects that infer parameter
// types fine it is an intentional no-op. The exact emitted SQL is pinned per cell by the
// snapshots.
//
// The fixture re-maps the shared
// `project` table (same columns, same row shape as the shared
// `tProject`), with `id` and `name` wrapped in a `ForceTypeCast`
// adapter. Using the same physical table keeps real-DB execution
// trivial; the only observable behaviour change is the bound
// placeholder syntax.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { ForceTypeCast } from '../../../../../src/TypeAdapter.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'

// A single ForceTypeCast instance is stateless (it only flips the
// force-cast flag), so the same adapter can back every column.
const forceCast = new ForceTypeCast()

const tProjectForcedCast = new class TProjectForcedCast extends Table<DBConnection, 'TProjectForcedCast'> {
    id   = this.column('id',   'int',    forceCast)
    name = this.column('name', 'string', forceCast)
    constructor() { super('project') }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('force-type-cast-adapter-on-int-column-in-where', async () => {
        // `tProjectForcedCast.id` is wrapped in a `ForceTypeCast`; comparing it
        // to a literal forces the dialect's placeholder cast on the bound
        // param (a no-op where the engine infers types — see the snapshot).
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(tProjectForcedCast)
            .where(tProjectForcedCast.id.equals(1))
            .select({ id: tProjectForcedCast.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(rows).toEqual([{ id: 1 }])
    })

    test('force-type-cast-adapter-on-string-column-in-where', async () => {
        // `tProjectForcedCast.name` is wrapped in a `ForceTypeCast`; the
        // comparison forces the dialect's placeholder cast on the bound
        // param (a no-op where the engine infers types — see the snapshot).
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(tProjectForcedCast)
            .where(tProjectForcedCast.name.equals('Marketing site'))
            .select({ id: tProjectForcedCast.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where name = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Marketing site",
          ]
        `)
        expect(rows).toEqual([{ id: 1 }])
    })
    test('force-type-cast-adapter-in-insert-values-position', async () => {
        // A ForceTypeCast-wrapped column forces the dialect's placeholder cast in
        // the INSERT VALUES position too (a no-op where the engine infers types).
        // `.query()` / `.params()` capture the emitted SQL without executing, so
        // the assertion is independent of the physical table's other NOT NULL
        // columns (which this partial mapping doesn't set).
        const built = ctx.conn.insertInto(tProjectForcedCast)
            .set({ id: 1, name: 'Marketing site' })

        expect(built.query()).toMatchInlineSnapshot(`"insert into project (id, name) values (?1, ?2)"`)
        expect(built.params()).toMatchInlineSnapshot(`
          [
            1,
            "Marketing site",
          ]
        `)
    })

    test('force-type-cast-adapter-in-update-set-position', async () => {
        // The same forced placeholder cast lands in the UPDATE SET position (on the
        // set value) and the WHERE position (on the id), captured via `.query()` /
        // `.params()` without executing.
        const built = ctx.conn.update(tProjectForcedCast)
            .set({ name: 'Renamed' })
            .where(tProjectForcedCast.id.equals(1))

        expect(built.query()).toMatchInlineSnapshot(`"update project set name = ?1 where id = ?2"`)
        expect(built.params()).toMatchInlineSnapshot(`
          [
            "Renamed",
            1,
          ]
        `)
    })

    test('force-type-cast-adapter-on-a-null-const-that-poisons-the-result', async () => {
        // A NULL const carrying the ForceTypeCast adapter is known while building:
        // `minValue` over it collapses to the cast NULL `null::int4`, and `concat`
        // binds it as a null cast to text (`$1::text`); both casts come from the
        // adapter. Both results come back null, so the optional keys are absent.
        ctx.mockNext([{ id: 1, lowest: null, label: null }])
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                lowest: ctx.conn.optionalConst(null, 'int', forceCast).minValue(tProject.id),
                label:  ctx.conn.optionalConst(null, 'string', forceCast).concat(tProject.name),
            })
            .executeSelectMany()
        assertType<Exact<typeof rows, Array<{ id: number; lowest?: number; label?: string }>>>()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, max(?1, id) as lowest, ?2 || name as label from project where id = ?3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
            null,
            1,
          ]
        `)
        expect(rows).toEqual([{ id: 1 }])
    })
})
