// Coverage of the 4-arg `column(name, customType, typeName, adapter)`
// declaration form on `Table` — exercised by a local fixture that
// re-projects the existing `project` table with its `id` column
// declared as a branded `customInt` (`'ProjectId'`) carrying a
// `TypeAdapter`. The form lives on `Table.column` overloads
// (typed by 'customInt'/'customDouble'/'customUuid'/
// 'customLocalDate*'/'customComparable') and is mirrored on
// `optionalColumn`.
//
// The adapter used here is `LoggingAdapter`: it records the
// `transformValueFromDB` and `transformValueToDB` invocations into
// in-test arrays so we can assert the adapter was wired (and called)
// for the custom-typed column.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { Table } from '../../../../../src/Table.js'
import type { TypeAdapter, DefaultTypeAdapter } from '../../../../../src/TypeAdapter.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

const fromDBCalls: Array<{ type: string }> = []
const toDBCalls:   Array<{ type: string }> = []

const loggingAdapter: TypeAdapter = {
    transformValueFromDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown {
        fromDBCalls.push({ type })
        return next.transformValueFromDB(value, type)
    },
    transformValueToDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown {
        toDBCalls.push({ type })
        return next.transformValueToDB(value, type)
    },
}

const tProjectBranded = new class TProjectBranded extends Table<DBConnection, 'TProjectBranded'> {
    id   = this.column<number, 'ProjectId'>('id', 'customInt', 'ProjectId', loggingAdapter)
    name = this.column('name', 'string')
    constructor() { super('project') }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => {
        ctx.reset()
        fromDBCalls.length = 0
        toDBCalls.length = 0
    })

    test('custom-int-column-with-adapter-roundtrips-through-adapter', async () => {
        // mockNext returns the raw rows; the lib runs each `id` cell
        // through the adapter's `transformValueFromDB`. After the call
        // we assert `fromDBCalls` was populated (the adapter was on the
        // hot path). Mock matches the full seed (4 projects, all
        // dialects) so the value assertion is identical in mock and
        // real-DB modes — `orderBy('id')` pins the order.
        ctx.mockNext([
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
            { id: 4, name: 'Legacy app' },
        ])
        const rows = await ctx.conn.selectFrom(tProjectBranded)
            .select({
                id:   tProjectBranded.id,
                name: tProjectBranded.name,
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual([
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
            { id: 4, name: 'Legacy app' },
        ])
        // The adapter is called for every retrieved `id` cell.
        expect(fromDBCalls.length).toBeGreaterThanOrEqual(4)
        expect(fromDBCalls[0]?.type).toBe('ProjectId')
    })

    test('custom-int-column-with-adapter-fires-to-db-on-where', async () => {
        // The WHERE comparison binds a literal whose value goes through
        // the adapter's `transformValueToDB` before becoming the bound
        // parameter. After the call we assert that `toDBCalls` was
        // populated.
        ctx.mockNext([{ id: 1, name: 'Marketing site' }])
        const rows = await ctx.conn.selectFrom(tProjectBranded)
            .where(tProjectBranded.id.equals(1))
            .select({
                id:   tProjectBranded.id,
                name: tProjectBranded.name,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(rows).toEqual([{ id: 1, name: 'Marketing site' }])
        expect(toDBCalls.length).toBeGreaterThanOrEqual(1)
        expect(toDBCalls.find(c => c.type === 'ProjectId')).toBeDefined()
    })
})
