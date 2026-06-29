// The trailing `adapter?: TypeAdapter` overload arg on the connection methods that
// fan out to a const value source / typed fragment carrying a per-value adapter:
//
//   - `connection.const(value, kind, adapter)`
//   - `connection.optionalConst(value, kind, adapter)`
//   - `connection.fragmentWithType(kind, required, adapter).sql`...``
//   - `connection.aggregateFragmentWithType(kind, required, adapter).sql`...``
//
// exercised on the NON-string kinds (`int`, `double`, `bigint`, `uuid`), each with
// an adapter whose `transformValueFromDB` performs an OBSERVABLE value transform
// (numeric `* 10`, uuid lowercase-bracket).
//
// How the adapter is observed: `__transformValueFromDB` runs the adapter's
// `transformValueFromDB(value, type, next)` on the value coming from the
// DB. In mock mode that value is exactly what `ctx.mockNext(...)` queues —
// so each test queues the RAW value and asserts the TRANSFORMED value; the
// single unconditional `expect(...).toEqual(transformed)` validates the
// mock round-trip and (when run with `--docker`) the real-DB result at
// once. Each adapter delegates `transformValueToDB`/`transformPlaceholder`
// to `next`, so the const value is sent verbatim and the emitted
// placeholder/cast is unchanged (the snapshot pins it per cell).
//
// `aggregateFragmentWithType` shifts the positional args before reaching the
// `adapter2` slot, a different runtime branch than `fragmentWithType`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { TypeAdapter } from '../../../../../src/TypeAdapter.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

const UUID_LOWER = '0a8f9c1e-1111-4222-8333-444455556666'

// `transformValueFromDB` multiplies the marshalled number by 10 — observable
// on read. `transformValueToDB` delegates to `next`, so the const value is
// sent verbatim; no `transformPlaceholder` => the emitted placeholder/cast is
// unchanged (the snapshot records the cell's cast).
const intTimesTen: TypeAdapter = {
    transformValueFromDB(value, type, next) {
        const v = next.transformValueFromDB(value, type)
        return typeof v === 'number' ? v * 10 : v
    },
    transformValueToDB(value, type, next) {
        return next.transformValueToDB(value, type)
    },
}

// Same shape as `intTimesTen`, kept separate so each kind reads its own
// adapter (the double marshaller also yields a `number`).
const doubleTimesTen: TypeAdapter = {
    transformValueFromDB(value, type, next) {
        const v = next.transformValueFromDB(value, type)
        return typeof v === 'number' ? v * 10 : v
    },
    transformValueToDB(value, type, next) {
        return next.transformValueToDB(value, type)
    },
}

// The bigint marshaller yields a `bigint`; multiply by `10n`.
const bigintTimesTen: TypeAdapter = {
    transformValueFromDB(value, type, next) {
        const v = next.transformValueFromDB(value, type)
        return typeof v === 'bigint' ? v * 10n : v
    },
    transformValueToDB(value, type, next) {
        return next.transformValueToDB(value, type)
    },
}

// The uuid marshaller yields the uuid string verbatim; lowercase-then-bracket
// it. Lowercasing first keeps the assertion stable across engines that echo a
// uuid in a different case (e.g. SQL Server can return it uppercased).
const uuidBracket: TypeAdapter = {
    transformValueFromDB(value, type, next) {
        const v = next.transformValueFromDB(value, type)
        return typeof v === 'string' ? '[' + v.toLowerCase() + ']' : v
    },
    transformValueToDB(value, type, next) {
        return next.transformValueToDB(value, type)
    },
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // ── const(value, kind, adapter) — non-string kinds ──────────────────

    test('const/int-adapter-transforms-read-value', async () => {
        // `const(5, 'int', intTimesTen)`. The const 5 is sent verbatim; the
        // value read back (raw 5) is multiplied to 50 by the adapter.
        ctx.mockNext(5)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(5, 'int', intTimesTen))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(50)
    })

    test('const/double-adapter-transforms-read-value', async () => {
        // `const(1.5, 'double', doubleTimesTen)`. Raw 1.5 read back as 15.
        ctx.mockNext(1.5)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(1.5, 'double', doubleTimesTen))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1.5,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(15)
    })

    test('const/bigint-adapter-transforms-read-value', async () => {
        // `const(9n, 'bigint', bigintTimesTen)`. Raw 9n read back as 90n.
        ctx.mockNext(9n)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(9n, 'bigint', bigintTimesTen))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            9n,
          ]
        `)
        assertType<Exact<typeof v, bigint>>()
        expect(v).toBe(90n)
    })

    test('const/uuid-adapter-transforms-read-value', async () => {
        // `const(UUID_LOWER, 'uuid', uuidBracket)`. The uuid is sent verbatim;
        // the value read back is lowercased and bracketed by the adapter.
        ctx.mockNext(UUID_LOWER)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(UUID_LOWER, 'uuid', uuidBracket))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select raw_to_uuid(uuid_to_raw(:0)) as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        assertType<Exact<typeof v, string>>()
        expect(v).toBe('[' + UUID_LOWER + ']')
    })

    // ── optionalConst(value, kind, adapter) — non-string kinds ──────────

    test('optional-const/int-adapter-transforms-read-value', async () => {
        // `optionalConst(5, 'int', intTimesTen)` — same transform, the
        // `optional` overload widens the leaf to `number | null`.
        ctx.mockNext(5)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.optionalConst(5, 'int', intTimesTen))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
          ]
        `)
        assertType<Exact<typeof v, number | null>>()
        expect(v).toBe(50)
    })

    test('optional-const/double-adapter-transforms-read-value', async () => {
        ctx.mockNext(1.5)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.optionalConst(1.5, 'double', doubleTimesTen))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1.5,
          ]
        `)
        assertType<Exact<typeof v, number | null>>()
        expect(v).toBe(15)
    })

    test('optional-const/bigint-adapter-transforms-read-value', async () => {
        ctx.mockNext(9n)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.optionalConst(9n, 'bigint', bigintTimesTen))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            9n,
          ]
        `)
        assertType<Exact<typeof v, bigint | null>>()
        expect(v).toBe(90n)
    })

    test('optional-const/uuid-adapter-transforms-read-value', async () => {
        ctx.mockNext(UUID_LOWER)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.optionalConst(UUID_LOWER, 'uuid', uuidBracket))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select raw_to_uuid(uuid_to_raw(:0)) as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        assertType<Exact<typeof v, string | null>>()
        expect(v).toBe('[' + UUID_LOWER + ']')
    })

    test('optional-const/int-adapter-passes-null-through', async () => {
        // The adapter delegates `null` to `next` (which returns null), so the
        // `* 10` branch is skipped and a null const reads back as null — the
        // adapter is on the hot path but does not fabricate a value.
        ctx.mockNext(null)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.optionalConst(null, 'int', intTimesTen))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
          ]
        `)
        assertType<Exact<typeof v, number | null>>()
        expect(v).toBeNull()
    })

    // ── fragmentWithType(kind, required, adapter).sql`...` ──────────────

    test('fragment-with-type/int-adapter-transforms-read-value', async () => {
        // A typed `int` fragment carrying `intTimesTen`. The fragment
        // interpolates an `int` const (5) so the projected value is
        // deterministic and table-free; raw 5 reads back as 50.
        ctx.mockNext(5)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(
                ctx.conn.fragmentWithType('int', 'required', intTimesTen)
                    .sql`${ctx.conn.const(5, 'int')}`,
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(50)
    })

    test('fragment-with-type/double-adapter-transforms-read-value', async () => {
        ctx.mockNext(1.5)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(
                ctx.conn.fragmentWithType('double', 'required', doubleTimesTen)
                    .sql`${ctx.conn.const(1.5, 'double')}`,
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1.5,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(15)
    })

    test('fragment-with-type/bigint-adapter-transforms-read-value', async () => {
        ctx.mockNext(9n)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(
                ctx.conn.fragmentWithType('bigint', 'required', bigintTimesTen)
                    .sql`${ctx.conn.const(9n, 'bigint')}`,
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            9n,
          ]
        `)
        assertType<Exact<typeof v, bigint>>()
        expect(v).toBe(90n)
    })

    test('fragment-with-type/uuid-adapter-transforms-read-value', async () => {
        ctx.mockNext(UUID_LOWER)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(
                ctx.conn.fragmentWithType('uuid', 'required', uuidBracket)
                    .sql`${ctx.conn.const(UUID_LOWER, 'uuid')}`,
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select raw_to_uuid(uuid_to_raw(:0)) as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        assertType<Exact<typeof v, string>>()
        expect(v).toBe('[' + UUID_LOWER + ']')
    })

    test('fragment-with-type/int-optional-adapter-transforms-read-value', async () => {
        // The `optional` arm of `fragmentWithType` with the same adapter —
        // same emitted SQL, the optional flag only widens the leaf type.
        ctx.mockNext(5)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(
                ctx.conn.fragmentWithType('int', 'optional', intTimesTen)
                    .sql`${ctx.conn.const(5, 'int')}`,
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
          ]
        `)
        assertType<Exact<typeof v, number | null>>()
        expect(v).toBe(50)
    })

    // ── aggregateFragmentWithType(kind, required, adapter).sql`...` ──────
    // NOTE: distinct dispatcher branch from fragmentWithType — the non-string
    // `adapter` lands on the `adapter2` slot after the positional shift.

    test('aggregate-fragment-with-type/int-adapter-transforms-read-value', async () => {
        // `sum(priority)` over the seed (2+1+3+2 = 8) as a typed `int`
        // aggregate carrying `intTimesTen`; raw 8 reads back as 80.
        ctx.mockNext(8)
        const v = await ctx.conn.selectFrom(tIssue)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType('int', 'required', intTimesTen)
                    .sql`sum(${tIssue.priority})`,
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(priority) as "result" from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(80)
    })

    test('aggregate-fragment-with-type/int-optional-adapter-transforms-read-value', async () => {
        // The `optional` arm — `max(priority)` (3) as an optional int
        // aggregate carrying `intTimesTen`; raw 3 reads back as 30.
        ctx.mockNext(3)
        const v = await ctx.conn.selectFrom(tIssue)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType('int', 'optional', intTimesTen)
                    .sql`max(${tIssue.priority})`,
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(priority) as "result" from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number | null>>()
        expect(v).toBe(30)
    })

    test('aggregate-fragment-with-type/bigint-adapter-transforms-read-value', async () => {
        // `count(id)` over the seed (4 issues) as a typed `bigint` aggregate
        // carrying `bigintTimesTen`. The bigint marshaller coerces the raw
        // count (queued as 4) to 4n; the adapter reads it back as 40n.
        ctx.mockNext(4)
        const v = await ctx.conn.selectFrom(tIssue)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType('bigint', 'required', bigintTimesTen)
                    .sql`count(${tIssue.id})`,
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(id) as "result" from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, bigint>>()
        expect(v).toBe(40n)
    })
})
