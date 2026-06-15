// Coverage of the `ForceTypeCast` type adapter
// ([`src/TypeAdapter.ts`](../../../../../src/TypeAdapter.ts)).
// A column wrapped with this adapter unconditionally forces
// `transformPlaceholder(... forceTypeCast = true)`, so every bound
// parameter for that column carries the dialect's placeholder cast —
// independently of where in the query it is used (WHERE, projection,
// INSERT VALUES, etc.). On dialects that need it (PostgreSQL) this emits
// a `::<type>` cast; on dialects that infer parameter types fine it is an
// intentional no-op. The exact emitted SQL is pinned per cell by the
// snapshots.
//
// The fixture is a local `Table` that re-maps over the existing
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

const fcInt    = new ForceTypeCast()
const fcString = new ForceTypeCast()

const tProjectFC = new class TProjectFC extends Table<DBConnection, 'TProjectFC'> {
    id   = this.column('id',   'int',    fcInt)
    name = this.column('name', 'string', fcString)
    constructor() { super('project') }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('force-type-cast-adapter-on-int-column-in-where', async () => {
        // `tProjectFC.id` is wrapped in a `ForceTypeCast`; comparing it
        // to a literal forces the dialect's placeholder cast on the bound
        // param (a no-op where the engine infers types — see the snapshot).
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(tProjectFC)
            .where(tProjectFC.id.equals(1))
            .select({ id: tProjectFC.id })
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
        // `tProjectFC.name` is wrapped in a `ForceTypeCast`; the
        // comparison forces the dialect's placeholder cast on the bound
        // param (a no-op where the engine infers types — see the snapshot).
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(tProjectFC)
            .where(tProjectFC.name.equals('Marketing site'))
            .select({ id: tProjectFC.id })
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
