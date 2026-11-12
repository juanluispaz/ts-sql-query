// Per-connection coverage of `OracleConnection.uuidStrategy`. Oracle has
// three strategies; the shared test connection uses the library default
// `'built-in'` (exercised by the regular uuid tests, which emit
// `raw_to_uuid(uuid_to_raw(...))`). This file pins the two NON-default
// branches:
//
//   - `'string'`: uuids are plain TEXT — `_asString` and the param/column
//     hooks return the underlying SQL unchanged (no `raw_to_uuid` /
//     `uuid_to_raw` wrapping).
//   - `'custom-functions'`: identical EMITTED SQL to `'built-in'` (both go
//     through `_uuidUsesRawFunctions()`), so it wraps with the same
//     `raw_to_uuid` / `uuid_to_raw` user-defined functions — this pins that
//     the `custom-functions` arm routes through the raw-function path (vs the
//     plain-text `'string'` arm above).
//
// `ctx.withUuidStrategy(...)` returns a `DBConnection` whose `uuidStrategy`
// is pinned to the requested value while sharing `ctx.conn`'s underlying
// `CaptureInterceptor` and driver. Tests use a uuid CONST through
// `.asString()` (not a stored column, which is RAW(16) under the default
// strategy and would not round-trip under `'string'`), so they stay
// universally executable.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection } from '../../domain/connection.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'

// A v4 uuid: Oracle 23ai's native `uuid_to_raw` (used by the `'built-in'`
// and `'custom-functions'` strategies) accepts only RFC 4122 version-4
// uuids and raises ORA-62432 on other versions, so the value must be v4 to
// round-trip through the `custom-functions` path exercised below.
const UUID_VALUE = '123e4567-e89b-42d3-a456-426614174000'

// The title of the issues, a text column, declared as a uuid: a uuid stored as text
const tIssueTitleAsUuid = new class TIssueTitleAsUuid extends Table<DBConnection, 'TIssueTitleAsUuid'> {
    id  = this.primaryKey('id', 'int')
    ref = this.column('title', 'uuid')
    constructor() {
        super('issue')
    }
}()
const UPPER_UUID = 'C733575E-B5BA-400C-8803-3D3D4BBCD52F'
const LOWER_UUID = 'c733575e-b5ba-400c-8803-3d3d4bbcd52f'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('uuid-strategy: string is plain text for asString', async () => {
        const conn = ctx.withUuidStrategy('string')
        ctx.mockNext(UUID_VALUE)
        await conn.selectFromNoTable()
            .selectOneColumn(conn.const(UUID_VALUE, 'uuid').asString())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-42d3-a456-426614174000",
          ]
        `)
    })

    test('uuid-strategy: custom-functions wraps asString in raw_to_uuid/uuid_to_raw', async () => {
        const conn = ctx.withUuidStrategy('custom-functions')
        ctx.mockNext(UUID_VALUE)
        await conn.selectFromNoTable()
            .selectOneColumn(conn.const(UUID_VALUE, 'uuid').asString())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select raw_to_uuid(uuid_to_raw(:0)) as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-42d3-a456-426614174000",
          ]
        `)
    })

    test('uuid-strategy: string writes and reads a uuid in lower case', async () => {
        // The uuid sent in upper case is stored in lower case, and the equality
        // with the upper-case text finds it: the parameter is sent in lower case
        const conn = ctx.withUuidStrategy('string')
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await conn.update(tIssueTitleAsUuid)
                .set({ ref: UPPER_UUID })
                .where(tIssueTitleAsUuid.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = :0 where id = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "c733575e-b5ba-400c-8803-3d3d4bbcd52f",
                1,
              ]
            `)

            ctx.mockNext({ ref: LOWER_UUID, stored: LOWER_UUID })
            const row = await conn.selectFrom(tIssueTitleAsUuid)
                .where(tIssueTitleAsUuid.ref.equals(UPPER_UUID))
                .select({ ref: tIssueTitleAsUuid.ref, stored: tIssueTitleAsUuid.ref.asString() })
                .executeSelectNoneOrOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as "ref", title as "stored" from issue where title = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "c733575e-b5ba-400c-8803-3d3d4bbcd52f",
              ]
            `)
            assertType<Exact<typeof row, { ref: string; stored: string } | null>>()
            expect(row).toEqual({ ref: LOWER_UUID, stored: LOWER_UUID })
        })
    })

    test('uuid-strategy: string as sent keeps the case of a uuid', async () => {
        // The uuid is stored as it was sent, in upper case, and read so
        const conn = ctx.withUuidStrategy('string as sent')
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await conn.update(tIssueTitleAsUuid)
                .set({ ref: UPPER_UUID })
                .where(tIssueTitleAsUuid.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = :0 where id = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "C733575E-B5BA-400C-8803-3D3D4BBCD52F",
                1,
              ]
            `)

            ctx.mockNext(UPPER_UUID)
            const ref = await conn.selectFrom(tIssueTitleAsUuid)
                .where(tIssueTitleAsUuid.id.equals(1))
                .selectOneColumn(tIssueTitleAsUuid.ref)
                .executeSelectOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as "result" from issue where id = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof ref, string>>()
            expect(ref).toEqual(UPPER_UUID)
        })
    })
})
