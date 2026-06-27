// Coverage of the `ForceTypeCast` type adapter
// A column wrapped with this adapter unconditionally forces
// `transformPlaceholder(... forceTypeCast = true)`, so every bound
// parameter for that column carries the dialect's placeholder cast —
// independently of where in the query it is used (WHERE, projection,
// INSERT VALUES, etc.). On dialects that need it (PostgreSQL) this emits
// a `::<type>` cast; on dialects that infer parameter types fine it is an
// intentional no-op. The exact emitted SQL is pinned per cell by the
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
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from project where id = :0"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from project where name = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Marketing site",
          ]
        `)
        expect(rows).toEqual([{ id: 1 }])
    })
})
