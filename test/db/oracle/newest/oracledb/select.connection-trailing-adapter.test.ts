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
import type { WorklogActivity, ReleaseChannel } from '../../domain/connection.js'
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

// The boolean marshaller yields a `boolean`; negate it so the adapter's effect
// on a boolean const is observable. `transformValueToDB` delegates to `next`,
// so the const boolean is sent verbatim and the placeholder/cast is unchanged.
const boolNegate: TypeAdapter = {
    transformValueFromDB(value, type, next) {
        const v = next.transformValueFromDB(value, type)
        return typeof v === 'boolean' ? !v : v
    },
    transformValueToDB(value, type, next) {
        return next.transformValueToDB(value, type)
    },
}

// The temporal marshallers (`localTime` / `localDateTime`) yield a `Date`;
// shift it forward one hour so the adapter's read transform is observable on a
// Date — a distinct `transformValueFromDB` marshaller family from the numeric /
// uuid / boolean adapters above. `transformValueToDB` delegates to `next`, so
// the const Date is sent verbatim and the placeholder/cast is unchanged.
const shiftHourFromDb: TypeAdapter = {
    transformValueFromDB(value, type, next) {
        const v = next.transformValueFromDB(value, type)
        return v instanceof Date ? new Date(v.getTime() + 3600000) : v
    },
    transformValueToDB(value, type, next) {
        return next.transformValueToDB(value, type)
    },
}

// The string marshaller family (`string` / `enum` / `custom` / `customComparable`
// and — through the string base — `customUuid`) yields a `string`; wrap it in
// `[...]` on read so the adapter's effect on a string const/fragment is
// observable. `transformValueToDB` delegates to `next`, so the value is sent
// verbatim and the emitted placeholder/cast is unchanged.
const stringBracket: TypeAdapter = {
    transformValueFromDB(value, type, next) {
        const v = next.transformValueFromDB(value, type)
        return typeof v === 'string' ? '[' + v + ']' : v
    },
    transformValueToDB(value, type, next) {
        return next.transformValueToDB(value, type)
    },
}
// Used only inside the NOT-APPLICABLE block below (oracle bare-const bind limit).
void stringBracket

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

    // ── const/optionalConst(value, 'customX', typeName, adapter) ────────
    // The CUSTOM-kind overload places the trailing TypeAdapter in the
    // `adapter2` slot (the 4th positional arg, after the typeName), a distinct
    // runtime branch from the plain-kind `const(value, kind, adapter)` above. The
    // custom kind is `customDouble` ('Money'), so the value marshals through
    // `double` and the adapter's `* 10` read transform is observable.

    test('const/custom-double-adapter-transforms-read-value', async () => {
        // `const(2.5, 'customDouble', 'Money', doubleTimesTen)`. Raw 2.5 read
        // back as 25 through the adapter parked in the `adapter2` slot.
        ctx.mockNext(2.5)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(2.5, 'customDouble', 'Money', doubleTimesTen))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2.5,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(25)
    })

    test('optional-const/custom-double-adapter-transforms-read-value', async () => {
        // `optionalConst(2.5, 'customDouble', 'Money', doubleTimesTen)` — same
        // transform through the `adapter2` slot; the optional overload widens
        // the leaf to `number | null`.
        ctx.mockNext(2.5)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.optionalConst(2.5, 'customDouble', 'Money', doubleTimesTen))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2.5,
          ]
        `)
        assertType<Exact<typeof v, number | null>>()
        expect(v).toBe(25)
    })

    test('optional-const/custom-double-adapter-passes-null-through', async () => {
        // The adapter delegates `null` to `next`, so a null custom const reads
        // back as null (the `* 10` branch is skipped) — the `adapter2` slot is
        // on the hot path but does not fabricate a value.
        ctx.mockNext(null)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.optionalConst<number, 'Money'>(null, 'customDouble', 'Money', doubleTimesTen))
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

    // ── const/optionalConst(value, 'boolean', adapter) ──────────────────
    // The const `true` is sent verbatim; the value read back (raw true) is
    // negated to false by `boolNegate`.

    test('const/boolean-adapter-transforms-read-value', async () => {
        ctx.mockNext(true)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(true, 'boolean', boolNegate))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, boolean>>()
        expect(v).toBe(false)
    })

    test('optional-const/boolean-adapter-transforms-read-value', async () => {
        // Same transform through the `optional` overload; the flag only widens
        // the leaf to `boolean | null`.
        ctx.mockNext(true)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.optionalConst(true, 'boolean', boolNegate))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, boolean | null>>()
        expect(v).toBe(false)
    })

    test('const/local-time-adapter-transforms-read-value', async () => {
        const lt = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        ctx.mockNext(lt)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(lt, 'localTime', shiftHourFromDb))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1970-01-01T17:00:00.000Z,
          ]
        `)
        assertType<Exact<typeof v, Date>>()
        expect(v).toEqual(new Date(Date.UTC(1970, 0, 1, 18, 0, 0)))
    })

    test('const/local-date-time-adapter-transforms-read-value', async () => {
        const ldt = new Date(Date.UTC(2024, 0, 14, 12, 30, 0))
        ctx.mockNext(ldt)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(ldt, 'localDateTime', shiftHourFromDb))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-14T12:30:00.000Z,
          ]
        `)
        assertType<Exact<typeof v, Date>>()
        expect(v).toEqual(new Date(Date.UTC(2024, 0, 14, 13, 30, 0)))
    })

    test('optional-const/local-time-adapter-transforms-read-value', async () => {
        // Same transform through the `optional` overload; the flag only widens
        // the leaf to `Date | null`.
        const lt = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        ctx.mockNext(lt)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.optionalConst(lt, 'localTime', shiftHourFromDb))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1970-01-01T17:00:00.000Z,
          ]
        `)
        assertType<Exact<typeof v, Date | null>>()
        expect(v).toEqual(new Date(Date.UTC(1970, 0, 1, 18, 0, 0)))
    })

    test('optional-const/local-date-time-adapter-transforms-read-value', async () => {
        const ldt = new Date(Date.UTC(2024, 0, 14, 12, 30, 0))
        ctx.mockNext(ldt)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.optionalConst(ldt, 'localDateTime', shiftHourFromDb))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-14T12:30:00.000Z,
          ]
        `)
        assertType<Exact<typeof v, Date | null>>()
        expect(v).toEqual(new Date(Date.UTC(2024, 0, 14, 13, 30, 0)))
    })
    // NOT-APPLICABLE: oracle rejects the bare 'select :0 from dual' const/typed-fragment bind for non-numeric adapter kinds (untyped-placeholder bind-type limitation, ORA-01722/01858); the adapter slot is covered here for numeric/uuid kinds via the pre-existing tests and runs live for all kinds on every other cell
    /*
    // The trailing-adapter slot on the remaining const/optionalConst kinds and
    // on both fragmentWithType / aggregateFragmentWithType kinds. Each adapter's
    // transformValueFromDB does an observable transform (numeric ×10, string /
    // uuid bracket, boolean negate, Date +1h); the mock queues the RAW value and
    // the test asserts the TRANSFORMED value.

    // ── B1: const(value, 'localDate' | 'enum', adapter) ─────────────────
    // localDate through the trailing adapter — a Date marshaller shifted +1h on
    // read. A non-null localDate const echoed back is not round-trippable on
    // every driver (some return a non-ISO format the marshaller rejects — see
    // select.value-source.required-const.test.ts), so the shifted value is
    // asserted mock-only and the presence-as-Date structurally on the real DB.
    // ── B1: const/optionalConst(value, 'customX', typeName, adapter2) ────
    // The custom-kind overloads park the trailing TypeAdapter in the `adapter2`
    // slot (4th positional, after the typeName). One const + optionalConst per
    // remaining custom kind, each routing its base marshaller through the adapter.

    test('const/custom-int-adapter-transforms-read-value', async () => {
        ctx.mockNext(5)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<number, 'Cents'>(5, 'customInt', 'Cents', intTimesTen))
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

    test('optional-const/custom-int-adapter-transforms-read-value', async () => {
        ctx.mockNext(5)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.optionalConst<number, 'Cents'>(5, 'customInt', 'Cents', intTimesTen))
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

    test('const/custom-uuid-adapter-transforms-read-value', async () => {
        ctx.mockNext(UUID_LOWER)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<string, 'SigningKey'>(UUID_LOWER, 'customUuid', 'SigningKey', uuidBracket))
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

    test('optional-const/custom-uuid-adapter-transforms-read-value', async () => {
        ctx.mockNext(UUID_LOWER)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.optionalConst<string, 'SigningKey'>(UUID_LOWER, 'customUuid', 'SigningKey', uuidBracket))
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

    // ── B3: fragmentWithType(kind, required, adapter) — remaining kinds ──
    // A typed fragment carrying the adapter, interpolating a same-kind const so
    // the projected value is deterministic and table-free. required + optional
    // per kind; the optional flag only widens the leaf type (same SQL).

    test('fragment-with-type/string-adapter-transforms-read-value', async () => {
        ctx.mockNext('hi')
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType('string', 'required', stringBracket).sql`${ctx.conn.const('hi', 'string')}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "hi",
          ]
        `)
        assertType<Exact<typeof v, string>>()
        expect(v).toBe('[hi]')
    })

    test('fragment-with-type/string-optional-adapter-transforms-read-value', async () => {
        ctx.mockNext('hi')
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType('string', 'optional', stringBracket).sql`${ctx.conn.const('hi', 'string')}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "hi",
          ]
        `)
        assertType<Exact<typeof v, string | null>>()
        expect(v).toBe('[hi]')
    })

    test('fragment-with-type/local-time-adapter-transforms-read-value', async () => {
        const lt = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        ctx.mockNext(lt)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType('localTime', 'required', shiftHourFromDb).sql`${ctx.conn.const(lt, 'localTime')}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1970-01-01T17:00:00.000Z,
          ]
        `)
        assertType<Exact<typeof v, Date>>()
        expect(v).toEqual(new Date(Date.UTC(1970, 0, 1, 18, 0, 0)))
    })

    test('fragment-with-type/local-time-optional-adapter-transforms-read-value', async () => {
        const lt = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        ctx.mockNext(lt)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType('localTime', 'optional', shiftHourFromDb).sql`${ctx.conn.const(lt, 'localTime')}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1970-01-01T17:00:00.000Z,
          ]
        `)
        assertType<Exact<typeof v, Date | null>>()
        expect(v).toEqual(new Date(Date.UTC(1970, 0, 1, 18, 0, 0)))
    })

    test('fragment-with-type/local-date-time-adapter-transforms-read-value', async () => {
        const ldt = new Date(Date.UTC(2024, 0, 14, 12, 30, 0))
        ctx.mockNext(ldt)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType('localDateTime', 'required', shiftHourFromDb).sql`${ctx.conn.const(ldt, 'localDateTime')}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-14T12:30:00.000Z,
          ]
        `)
        assertType<Exact<typeof v, Date>>()
        expect(v).toEqual(new Date(Date.UTC(2024, 0, 14, 13, 30, 0)))
    })

    test('fragment-with-type/local-date-time-optional-adapter-transforms-read-value', async () => {
        const ldt = new Date(Date.UTC(2024, 0, 14, 12, 30, 0))
        ctx.mockNext(ldt)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType('localDateTime', 'optional', shiftHourFromDb).sql`${ctx.conn.const(ldt, 'localDateTime')}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-14T12:30:00.000Z,
          ]
        `)
        assertType<Exact<typeof v, Date | null>>()
        expect(v).toEqual(new Date(Date.UTC(2024, 0, 14, 13, 30, 0)))
    })

    test('fragment-with-type/enum-adapter-transforms-read-value', async () => {
        ctx.mockNext('coding')
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType<WorklogActivity, 'WorklogActivity'>('enum', 'WorklogActivity', 'required', stringBracket).sql`${ctx.conn.const<WorklogActivity, 'WorklogActivity'>('coding', 'enum', 'WorklogActivity')}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "coding",
          ]
        `)
        assertType<Exact<typeof v, WorklogActivity>>()
        expect(v).toBe('[coding]')
    })

    test('fragment-with-type/enum-optional-adapter-transforms-read-value', async () => {
        ctx.mockNext('coding')
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType<WorklogActivity, 'WorklogActivity'>('enum', 'WorklogActivity', 'optional', stringBracket).sql`${ctx.conn.const<WorklogActivity, 'WorklogActivity'>('coding', 'enum', 'WorklogActivity')}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "coding",
          ]
        `)
        assertType<Exact<typeof v, WorklogActivity | null>>()
        expect(v).toBe('[coding]')
    })

    test('fragment-with-type/custom-int-adapter-transforms-read-value', async () => {
        ctx.mockNext(5)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', intTimesTen).sql`${ctx.conn.const<number, 'Cents'>(5, 'customInt', 'Cents')}`)
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

    test('fragment-with-type/custom-int-optional-adapter-transforms-read-value', async () => {
        ctx.mockNext(5)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'optional', intTimesTen).sql`${ctx.conn.const<number, 'Cents'>(5, 'customInt', 'Cents')}`)
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

    test('fragment-with-type/custom-double-adapter-transforms-read-value', async () => {
        ctx.mockNext(2.5)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', doubleTimesTen).sql`${ctx.conn.const<number, 'Money'>(2.5, 'customDouble', 'Money')}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2.5,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(25)
    })

    test('fragment-with-type/custom-double-optional-adapter-transforms-read-value', async () => {
        ctx.mockNext(2.5)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'optional', doubleTimesTen).sql`${ctx.conn.const<number, 'Money'>(2.5, 'customDouble', 'Money')}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2.5,
          ]
        `)
        assertType<Exact<typeof v, number | null>>()
        expect(v).toBe(25)
    })

    test('fragment-with-type/custom-comparable-adapter-transforms-read-value', async () => {
        ctx.mockNext('1.0.0')
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType<string, 'Semver'>('customComparable', 'Semver', 'required', stringBracket).sql`${ctx.conn.const<string, 'Semver'>('1.0.0', 'customComparable', 'Semver')}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.0.0",
          ]
        `)
        assertType<Exact<typeof v, string>>()
        expect(v).toBe('[1.0.0]')
    })

    test('fragment-with-type/custom-comparable-optional-adapter-transforms-read-value', async () => {
        ctx.mockNext('1.0.0')
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType<string, 'Semver'>('customComparable', 'Semver', 'optional', stringBracket).sql`${ctx.conn.const<string, 'Semver'>('1.0.0', 'customComparable', 'Semver')}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.0.0",
          ]
        `)
        assertType<Exact<typeof v, string | null>>()
        expect(v).toBe('[1.0.0]')
    })

    test('fragment-with-type/custom-adapter-transforms-read-value', async () => {
        ctx.mockNext('stable')
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType<ReleaseChannel, 'ReleaseChannel'>('custom', 'ReleaseChannel', 'required', stringBracket).sql`${ctx.conn.const<ReleaseChannel, 'ReleaseChannel'>('stable', 'custom', 'ReleaseChannel')}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "stable",
          ]
        `)
        assertType<Exact<typeof v, ReleaseChannel>>()
        expect(v).toBe('[stable]')
    })

    test('fragment-with-type/custom-optional-adapter-transforms-read-value', async () => {
        ctx.mockNext('stable')
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType<ReleaseChannel, 'ReleaseChannel'>('custom', 'ReleaseChannel', 'optional', stringBracket).sql`${ctx.conn.const<ReleaseChannel, 'ReleaseChannel'>('stable', 'custom', 'ReleaseChannel')}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "stable",
          ]
        `)
        assertType<Exact<typeof v, ReleaseChannel | null>>()
        expect(v).toBe('[stable]')
    })

    test('fragment-with-type/custom-uuid-adapter-transforms-read-value', async () => {
        ctx.mockNext(UUID_LOWER)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType<string, 'SigningKey'>('customUuid', 'SigningKey', 'required', uuidBracket).sql`${ctx.conn.const<string, 'SigningKey'>(UUID_LOWER, 'customUuid', 'SigningKey')}`)
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

    test('fragment-with-type/custom-uuid-optional-adapter-transforms-read-value', async () => {
        ctx.mockNext(UUID_LOWER)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType<string, 'SigningKey'>('customUuid', 'SigningKey', 'optional', uuidBracket).sql`${ctx.conn.const<string, 'SigningKey'>(UUID_LOWER, 'customUuid', 'SigningKey')}`)
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

    test('fragment-with-type/custom-local-time-adapter-transforms-read-value', async () => {
        const lt = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        ctx.mockNext(lt)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType<Date, 'CutoffClock'>('customLocalTime', 'CutoffClock', 'required', shiftHourFromDb).sql`${ctx.conn.const<Date, 'CutoffClock'>(lt, 'customLocalTime', 'CutoffClock')}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1970-01-01T17:00:00.000Z,
          ]
        `)
        assertType<Exact<typeof v, Date>>()
        expect(v).toEqual(new Date(Date.UTC(1970, 0, 1, 18, 0, 0)))
    })

    test('fragment-with-type/custom-local-time-optional-adapter-transforms-read-value', async () => {
        const lt = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        ctx.mockNext(lt)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType<Date, 'CutoffClock'>('customLocalTime', 'CutoffClock', 'optional', shiftHourFromDb).sql`${ctx.conn.const<Date, 'CutoffClock'>(lt, 'customLocalTime', 'CutoffClock')}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1970-01-01T17:00:00.000Z,
          ]
        `)
        assertType<Exact<typeof v, Date | null>>()
        expect(v).toEqual(new Date(Date.UTC(1970, 0, 1, 18, 0, 0)))
    })

    test('fragment-with-type/custom-local-date-time-adapter-transforms-read-value', async () => {
        const ldt = new Date(Date.UTC(2024, 0, 14, 12, 30, 0))
        ctx.mockNext(ldt)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType<Date, 'SignOffStamp'>('customLocalDateTime', 'SignOffStamp', 'required', shiftHourFromDb).sql`${ctx.conn.const<Date, 'SignOffStamp'>(ldt, 'customLocalDateTime', 'SignOffStamp')}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-14T12:30:00.000Z,
          ]
        `)
        assertType<Exact<typeof v, Date>>()
        expect(v).toEqual(new Date(Date.UTC(2024, 0, 14, 13, 30, 0)))
    })

    test('fragment-with-type/custom-local-date-time-optional-adapter-transforms-read-value', async () => {
        const ldt = new Date(Date.UTC(2024, 0, 14, 12, 30, 0))
        ctx.mockNext(ldt)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.fragmentWithType<Date, 'SignOffStamp'>('customLocalDateTime', 'SignOffStamp', 'optional', shiftHourFromDb).sql`${ctx.conn.const<Date, 'SignOffStamp'>(ldt, 'customLocalDateTime', 'SignOffStamp')}`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-14T12:30:00.000Z,
          ]
        `)
        assertType<Exact<typeof v, Date | null>>()
        expect(v).toEqual(new Date(Date.UTC(2024, 0, 14, 13, 30, 0)))
    })

    // ── B3: aggregateFragmentWithType(kind, required, adapter) — kinds ───
    // The aggregate dispatcher parks the adapter in the `adapter2` slot after the
    // positional shift (a different runtime branch than fragmentWithType). Each
    // aggregates a real seed column of a compatible base type. The number kinds
    // use max(priority) (=3, deterministic → ×10 = 30); the string / temporal
    // kinds aggregate a non-deterministic seed column, so the transformed value
    // is asserted mock-only and structurally on the real DB.
    // NOTE: uuid / customUuid are omitted from this max()-based fan-out — max()
    // over them is not portable across dialects.

    test('aggregate-fragment-with-type/double-adapter-transforms-read-value', async () => {
        ctx.mockNext(3)
        const v = await ctx.conn.selectFrom(tIssue)
            .selectOneColumn(ctx.conn.aggregateFragmentWithType('double', 'required', doubleTimesTen).sql`max(${tIssue.priority})`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(priority) as "result" from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(30)
    })

    test('aggregate-fragment-with-type/custom-int-adapter-transforms-read-value', async () => {
        ctx.mockNext(3)
        const v = await ctx.conn.selectFrom(tIssue)
            .selectOneColumn(ctx.conn.aggregateFragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', intTimesTen).sql`max(${tIssue.priority})`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(priority) as "result" from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(30)
    })

    test('aggregate-fragment-with-type/custom-double-adapter-transforms-read-value', async () => {
        ctx.mockNext(3)
        const v = await ctx.conn.selectFrom(tIssue)
            .selectOneColumn(ctx.conn.aggregateFragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', doubleTimesTen).sql`max(${tIssue.priority})`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(priority) as "result" from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(30)
    })

    test('aggregate-fragment-with-type/string-adapter-transforms-read-value', async () => {
        ctx.mockNext('zzz')
        const v = await ctx.conn.selectFrom(tIssue)
            .selectOneColumn(ctx.conn.aggregateFragmentWithType('string', 'required', stringBracket).sql`max(${tIssue.title})`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(title) as "result" from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, string>>()
        if (!ctx.realDbEnabled) expect(v).toBe('[zzz]')
        else expect(typeof v).toBe('string')
    })

    test('aggregate-fragment-with-type/enum-adapter-transforms-read-value', async () => {
        ctx.mockNext('coding')
        const v = await ctx.conn.selectFrom(tIssue)
            .selectOneColumn(ctx.conn.aggregateFragmentWithType<WorklogActivity, 'WorklogActivity'>('enum', 'WorklogActivity', 'required', stringBracket).sql`max(${tIssue.title})`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(title) as "result" from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, WorklogActivity>>()
        if (!ctx.realDbEnabled) expect(v).toBe('[coding]')
        else expect(typeof v).toBe('string')
    })

    test('aggregate-fragment-with-type/custom-adapter-transforms-read-value', async () => {
        ctx.mockNext('stable')
        const v = await ctx.conn.selectFrom(tIssue)
            .selectOneColumn(ctx.conn.aggregateFragmentWithType<ReleaseChannel, 'ReleaseChannel'>('custom', 'ReleaseChannel', 'required', stringBracket).sql`max(${tIssue.title})`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(title) as "result" from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, ReleaseChannel>>()
        if (!ctx.realDbEnabled) expect(v).toBe('[stable]')
        else expect(typeof v).toBe('string')
    })

    test('aggregate-fragment-with-type/custom-comparable-adapter-transforms-read-value', async () => {
        ctx.mockNext('1.0.0')
        const v = await ctx.conn.selectFrom(tIssue)
            .selectOneColumn(ctx.conn.aggregateFragmentWithType<string, 'Semver'>('customComparable', 'Semver', 'required', stringBracket).sql`max(${tIssue.title})`)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(title) as "result" from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, string>>()
        if (!ctx.realDbEnabled) expect(v).toBe('[1.0.0]')
        else expect(typeof v).toBe('string')
    })

    */
    // const/optionalConst + trailing adapter for the remaining value kinds. The
    // string-backed kinds (enum / custom / customComparable) route through stringBracket
    // and are fully real-validated; the temporal / customLocal kinds route a Date
    // through shiftHourFromDb and assert the +1h transform mock-only + Date presence on
    // the real DB (some drivers do not round-trip a date-only / custom-temporal const).

    test('const/enum-adapter-transforms-read-value', async () => {
        ctx.mockNext('coding')
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<WorklogActivity, 'WorklogActivity'>('coding', 'enum', 'WorklogActivity', stringBracket))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "coding",
          ]
        `)
        assertType<Exact<typeof v, WorklogActivity>>()
        expect(v).toBe('[coding]')
    })

    test('const/custom-adapter-transforms-read-value', async () => {
        ctx.mockNext('stable')
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<ReleaseChannel, 'ReleaseChannel'>('stable', 'custom', 'ReleaseChannel', stringBracket))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "stable",
          ]
        `)
        assertType<Exact<typeof v, ReleaseChannel>>()
        expect(v).toBe('[stable]')
    })

    test('const/custom-comparable-adapter-transforms-read-value', async () => {
        ctx.mockNext('1.2.0')
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<string, 'Semver'>('1.2.0', 'customComparable', 'Semver', stringBracket))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.2.0",
          ]
        `)
        assertType<Exact<typeof v, string>>()
        expect(v).toBe('[1.2.0]')
    })

    test('optional-const/enum-adapter-transforms-read-value', async () => {
        ctx.mockNext('review')
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.optionalConst<WorklogActivity, 'WorklogActivity'>('review', 'enum', 'WorklogActivity', stringBracket))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "review",
          ]
        `)
        assertType<Exact<typeof v, WorklogActivity | null>>()
        expect(v).toBe('[review]')
    })

    // NOTE: a plain `const(date, 'localDate', adapter)` is intentionally omitted — a
    // date-only const round-tripped through selectFromNoTable is not read-parsable on
    // the pg driver (the marshaller rejects PG's `...+00:00` echo, throwing
    // INVALID_VALUE_RECEIVED_FROM_DATABASE), the exact non-round-trippable case the B1
    // comment above warns about. The customLocal kinds below DO round-trip.

    test('const/custom-local-time-adapter-transforms-read-value', async () => {
        const lt = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        ctx.mockNext(lt)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<Date, 'CutoffClock'>(lt, 'customLocalTime', 'CutoffClock', shiftHourFromDb))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1970-01-01T17:00:00.000Z,
          ]
        `)
        assertType<Exact<typeof v, Date>>()
        if (!ctx.realDbEnabled) expect(v).toEqual(new Date(Date.UTC(1970, 0, 1, 18, 0, 0)))
        else expect(v instanceof Date).toBe(true)
    })

    // NOTE: `const(date, 'customLocalDate', ...)` is omitted for the same reason as the
    // plain localDate above — the underlying localDate marshaller rejects PG's date-only
    // echo. The time / date-time customLocal kinds (above and below) round-trip fine.

    test('const/custom-local-date-time-adapter-transforms-read-value', async () => {
        const ldt = new Date(Date.UTC(2024, 0, 14, 12, 30, 0))
        ctx.mockNext(ldt)
        const v = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const<Date, 'SignOffStamp'>(ldt, 'customLocalDateTime', 'SignOffStamp', shiftHourFromDb))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-14T12:30:00.000Z,
          ]
        `)
        assertType<Exact<typeof v, Date>>()
        if (!ctx.realDbEnabled) expect(v).toEqual(new Date(Date.UTC(2024, 0, 14, 13, 30, 0)))
        else expect(v instanceof Date).toBe(true)
    })

})
