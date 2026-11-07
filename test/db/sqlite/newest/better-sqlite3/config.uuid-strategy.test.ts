// Per-connection coverage of `SqliteConnection.uuidStrategy`. The two
// supported strategies branch the dialect's emitter for the UUID
// surface in:
//
//   - `'uuid-extension'` (the library default for SqliteConnection;
//     the shared test connection overrides the default to `'string'` —
//     see test/db/sqlite/domain/connection.ts): assumes the SQLite `uuid_blob` /
//     `uuid_str` functions are loaded. Inputs are wrapped with
//     `uuid_blob(?)` in `_appendParam`, outputs at the outermost query
//     get a `uuid_str(...)` wrapper in `_appendColumnValue`, and
//     `.asString()` on a uuid column / value source emits
//     `uuid_str(...)` via `_asString`.
//   - `'string'`: inputs and outputs are plain TEXT — every dialect
//     hook returns the underlying SQL unchanged.
//
// `ctx.withUuidStrategy(...)` returns a `DBConnection` whose
// `uuidStrategy` is pinned to the requested value while sharing
// `ctx.conn`'s underlying `CaptureInterceptor` and driver.
//
// The `'string'` branch tests emit a plain `select ? as result` —
// universally executable, so they run end-to-end in mock and real-DB
// mode. The `'uuid-extension'` branch tests emit
// `uuid_str(uuid_blob(?))`, which requires the SQLite `uuid` extension
// functions. This connector registers them in the test harness (see
// test/db/sqlite/runners.ts — better-sqlite3 / bun:sqlite / node:sqlite
// via `db.function(...)`, sqlite-wasm-OO1 via `db.createFunction(...)`), so
// those tests run end-to-end against the real engine. The `sqlite3` and
// Bun SQL connectors can't register them (no user-defined-function API),
// so they keep these tests mock-only (via `ctx.mockOnlyConnection()`), per
// [DESIGN.md §1 #18](../../../../DESIGN.md#1-principles): there the
// assertion of interest is the SqlBuilder shape, not engine execution.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { ctx } from './setup.js'

const UUID_VALUE = '123e4567-e89b-12d3-a456-426614174000'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('uuid-strategy: string is no-op for asString', async () => {
        // `'string'` strategy renders `.asString()` as the underlying
        // bind expression — `select ? as result`, valid on every
        // sqlite connector, so the test runs end-to-end.
        const conn = ctx.withUuidStrategy('string')
        ctx.mockNext(UUID_VALUE)
        await conn.selectFromNoTable()
            .selectOneColumn(conn.const(UUID_VALUE, 'uuid').asString())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ?1 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-12d3-a456-426614174000",
          ]
        `)
    })

    test('uuid-strategy: uuid-extension wraps asString in uuid_str', async () => {
        // Runs end-to-end here — see file header. The emitted
        // `uuid_str(uuid_blob(?))` executes against the real engine
        // because this connector provides the `uuid` extension
        // functions (the connectors without a user-defined-function API
        // stay mock-only).
        const conn = ctx.withUuidStrategy('uuid-extension')
        ctx.mockNext(UUID_VALUE)
        await conn.selectFromNoTable()
            .selectOneColumn(conn.const(UUID_VALUE, 'uuid').asString())
            .executeSelectOne()
        // _asString wraps with uuid_str; _appendParam also wraps the
        // bound literal with uuid_blob so the round-trip through the
        // ext-UUID storage stays consistent.
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select uuid_str(uuid_blob(?1)) as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-12d3-a456-426614174000",
          ]
        `)
    })

    test('uuid-strategy: outermost-column projection wraps uuid value with uuid_str on uuid-extension', async () => {
        // Runs end-to-end here — see file header. `_appendColumnValue`
        // adds a `uuid_str(...)` wrapper at the outermost query for any
        // uuid value source when strategy is `'uuid-extension'`; the
        // resulting SQL executes on this connector's real engine.
        const conn = ctx.withUuidStrategy('uuid-extension')
        ctx.mockNext(UUID_VALUE)
        await conn.selectFromNoTable()
            .selectOneColumn(conn.const(UUID_VALUE, 'uuid'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select uuid_str(uuid_blob(?1)) as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-12d3-a456-426614174000",
          ]
        `)
    })

    test('uuid-strategy: executeFunction returning a uuid reads it with uuid_str on uuid-extension', async () => {
        // The function returns the uuid as it is stored (a blob); executeFunction reads it
        // as a column of a select is read, with `uuid_str(...)` around the call.
        const conn = ctx.withUuidStrategy('uuid-extension')
        ctx.mockNext(UUID_VALUE)
        const value = await conn.uuidAsBlob(UUID_VALUE)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select uuid_str(uuid_blob(?1))"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-12d3-a456-426614174000",
          ]
        `)
        assertType<Exact<typeof value, string>>()
        expect(value).toBe(UUID_VALUE)
    })

    test('uuid-strategy: outermost-column projection on string strategy emits raw bind', async () => {
        // Mirror of the first test on the `'string'` strategy: every
        // UUID hook returns the underlying SQL unchanged. The bind is
        // the raw string parameter — no `uuid_blob` / `uuid_str`
        // decoration — valid on every sqlite connector.
        const conn = ctx.withUuidStrategy('string')
        ctx.mockNext(UUID_VALUE)
        await conn.selectFromNoTable()
            .selectOneColumn(conn.const(UUID_VALUE, 'uuid'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ?1 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-12d3-a456-426614174000",
          ]
        `)
    })

    // Inline aggregated arrays over a uuid value: under `'uuid-extension'` each
    // aggregated uuid is rendered through `uuid_str(...)` (inside
    // `json_group_array` / `json_object`, or over the wrapping subquery's column
    // when the inner query is ordered). The seed stores `external_ref` as text,
    // so the fragment converts it with `uuid_blob(...)` into the binary form the
    // strategy expects. Project 1 has issues 1 ('Update hero copy',
    // 0a8f9c1e-…) and 2 ('Redesign navbar', 7b3e9d20-…).

    test('uuid-strategy: uuid-extension renders aggregated uuids with uuid_str', async () => {
        const conn = ctx.withUuidStrategy('uuid-extension')
        const issueRef = conn.fragmentWithType('uuid', 'required').sql`uuid_blob(${tIssue.externalRef})`
        ctx.mockNext({
            id:     1,
            refs:   ['0a8f9c1e-1111-4222-8333-444455556666', '7b3e9d20-2222-4c55-9b66-dddd00009999'],
            issues: [
                { ref: '0a8f9c1e-1111-4222-8333-444455556666', title: 'Update hero copy' },
                { ref: '7b3e9d20-2222-4c55-9b66-dddd00009999', title: 'Redesign navbar' },
            ],
        })
        const row = await conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                refs:   conn.subSelectUsing(tProject).from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .selectOneColumn(issueRef)
                    .forUseAsInlineAggregatedArrayValue(),
                issues: conn.subSelectUsing(tProject).from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .select({ ref: issueRef, title: tIssue.title })
                    .forUseAsInlineAggregatedArrayValue(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (select json_group_array(uuid_str(uuid_blob(external_ref))) from issue where project_id = project.id) as refs, (select json_group_array(json_object('ref', uuid_str(uuid_blob(external_ref)), 'title', title)) from issue where project_id = project.id) as issues from project where id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        // The aggregates carry no ORDER BY, so the element order is not
        // guaranteed: compare them sorted by uuid.
        expect({
            id:     row.id,
            refs:   [...row.refs].sort(),
            issues: [...row.issues].sort((a, b) => a.ref.localeCompare(b.ref)),
        }).toEqual({
            id:     1,
            refs:   ['0a8f9c1e-1111-4222-8333-444455556666', '7b3e9d20-2222-4c55-9b66-dddd00009999'],
            issues: [
                { ref: '0a8f9c1e-1111-4222-8333-444455556666', title: 'Update hero copy' },
                { ref: '7b3e9d20-2222-4c55-9b66-dddd00009999', title: 'Redesign navbar' },
            ],
        })
    })

    test('uuid-strategy: uuid-extension renders ordered aggregated uuids with uuid_str over the wrapping subquery', async () => {
        // Descending by the binary uuid: 7b3e9d20-… sorts before 0a8f9c1e-….
        const conn = ctx.withUuidStrategy('uuid-extension')
        const issueRef = conn.fragmentWithType('uuid', 'required').sql`uuid_blob(${tIssue.externalRef})`
        ctx.mockNext({
            id:     1,
            refs:   ['7b3e9d20-2222-4c55-9b66-dddd00009999', '0a8f9c1e-1111-4222-8333-444455556666'],
            issues: [
                { ref: '7b3e9d20-2222-4c55-9b66-dddd00009999', title: 'Redesign navbar' },
                { ref: '0a8f9c1e-1111-4222-8333-444455556666', title: 'Update hero copy' },
            ],
        })
        const row = await conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                refs:   conn.subSelectUsing(tProject).from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .selectOneColumn(issueRef)
                    .orderBy('result', 'desc')
                    .forUseAsInlineAggregatedArrayValue(),
                issues: conn.subSelectUsing(tProject).from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .select({ ref: issueRef, title: tIssue.title })
                    .orderBy('title')
                    .forUseAsInlineAggregatedArrayValue(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (select json_group_array(uuid_str(a_1_.result)) from (select uuid_blob(external_ref) as result from issue where project_id = project.id order by result desc) as a_1_) as refs, (select json_group_array(json_object('ref', uuid_str(a_2_.ref), 'title', a_2_.title)) from (select uuid_blob(external_ref) as ref, title as title from issue where project_id = project.id order by title) as a_2_) as issues from project where id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(row).toEqual({
            id:     1,
            refs:   ['7b3e9d20-2222-4c55-9b66-dddd00009999', '0a8f9c1e-1111-4222-8333-444455556666'],
            issues: [
                { ref: '7b3e9d20-2222-4c55-9b66-dddd00009999', title: 'Redesign navbar' },
                { ref: '0a8f9c1e-1111-4222-8333-444455556666', title: 'Update hero copy' },
            ],
        })
    })
})
