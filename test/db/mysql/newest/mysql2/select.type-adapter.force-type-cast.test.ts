// Coverage of the `ForceTypeCast` type adapter
// ([`src/TypeAdapter.ts`](../../../../../src/TypeAdapter.js)).
// ForceTypeCast forces a placeholder cast on **PostgreSQL**, which cannot
// always infer a bound parameter's type correctly (see
// `PostgreSqlConnection.transformPlaceholder`). On every OTHER dialect it
// is an intentional **NO-OP**: those engines infer the parameter type
// fine, so wrapping a column in ForceTypeCast emits SQL identical to an
// unwrapped column (no cast, no error). This is by design — NOT a dialect
// boundary — so these tests run here too and pin the no-op; the
// `::<type>` cast variant is asserted in the postgres cells.
//
// The fixture is a local `Table` re-mapped over the existing `project`
// table (same columns/rows as `tProject`), with `id`/`name` wrapped in a
// ForceTypeCast adapter.

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
        // `tProjectFC.id` is wrapped in ForceTypeCast. On this
        // (non-PostgreSQL) dialect the adapter is an intentional no-op, so
        // the emitted SQL is the plain comparison with no placeholder cast —
        // the `::<type>` cast only appears on PostgreSQL.
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(tProjectFC)
            .where(tProjectFC.id.equals(1))
            .select({ id: tProjectFC.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(rows).toEqual([{ id: 1 }])
    })

    test('force-type-cast-adapter-on-string-column-in-where', async () => {
        // Same no-op on a string column: ForceTypeCast leaves the
        // comparison uncast on every dialect except PostgreSQL.
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(tProjectFC)
            .where(tProjectFC.name.equals('Marketing site'))
            .select({ id: tProjectFC.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where \`name\` = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Marketing site",
          ]
        `)
        expect(rows).toEqual([{ id: 1 }])
    })
})
