// CONN F5-CONN B2 — executeFunction return-kind × {required, optional} ×
// {no-adapter, trailing-adapter} fan-out.
//
// Every distinct return kind is a distinct typed executeFunction path, and the
// trailing `adapter?` slot is a further distinct path per (kind, req/opt). To
// real-validate each, the domain declares one zero-arg `cm_<basekind>()`
// function (schema.sql) returning that kind's col_matrix row-1 value, and four
// `callCm<Kind>*` wrappers per kind (base required / optional, adapter required
// / optional). Each test asserts the emitted SQL (snapshot), the bound params
// (snapshot), the exact result TYPE (`assertType`) and the seeded VALUE
// (`ctx.mockNext` + assertion, holding in mock and real modes).
//
// The col_matrix row-1 seed: m_int 42, m_bigint 5000, m_double 3.5, m_bool
// TRUE, m_uuid <UUID>, m_date 2024-03-04, m_time 09:15:00, m_datetime
// 2024-01-14 12:30:00, m_str 'hello'. The observable adapters transform the read
// value (numeric ×10, bigint ×10n, boolean negate, uuid/string bracket, Date
// +1h). Non-temporal kinds round-trip deterministically, so the transformed
// value is asserted unconditionally; temporal kinds do not (a bare function
// result is not normalised the way the column read path is — see
// exec.procedure-function.test.ts), so the base value is asserted structurally
// and the adapter's shift is asserted mock-only with a structural real-DB guard.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // ---- exec.function-value-kinds (CONN B2 return-kind + adapter fan-out) ----

    // ── int (cm_int) ────────────────────────────────────────────────────
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('int-required', async () => {
        ctx.mockNext(42)
        const v = await ctx.conn.callCmInt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(42)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('int-optional', async () => {
        ctx.mockNext(42)
        const v = await ctx.conn.callCmIntOpt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, number | null>>()
        expect(v).toBe(42)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('int-required-adapter', async () => {
        ctx.mockNext(42)
        const v = await ctx.conn.callCmIntAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(420)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('int-optional-adapter', async () => {
        ctx.mockNext(42)
        const v = await ctx.conn.callCmIntOptAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, number | null>>()
        expect(v).toBe(420)
    })
    */

    // ── bigint (cm_bigint) ──────────────────────────────────────────────
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('bigint-required', async () => {
        ctx.mockNext(5000n)
        const v = await ctx.conn.callCmBigint()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, bigint>>()
        expect(v).toBe(5000n)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('bigint-optional', async () => {
        ctx.mockNext(5000n)
        const v = await ctx.conn.callCmBigintOpt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, bigint | null>>()
        expect(v).toBe(5000n)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('bigint-required-adapter', async () => {
        ctx.mockNext(5000n)
        const v = await ctx.conn.callCmBigintAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, bigint>>()
        expect(v).toBe(50000n)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('bigint-optional-adapter', async () => {
        ctx.mockNext(5000n)
        const v = await ctx.conn.callCmBigintOptAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, bigint | null>>()
        expect(v).toBe(50000n)
    })
    */

    // ── double (cm_double) ──────────────────────────────────────────────
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('double-required', async () => {
        ctx.mockNext(3.5)
        const v = await ctx.conn.callCmDouble()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(3.5)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('double-optional', async () => {
        ctx.mockNext(3.5)
        const v = await ctx.conn.callCmDoubleOpt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, number | null>>()
        expect(v).toBe(3.5)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('double-required-adapter', async () => {
        ctx.mockNext(3.5)
        const v = await ctx.conn.callCmDoubleAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(35)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('double-optional-adapter', async () => {
        ctx.mockNext(3.5)
        const v = await ctx.conn.callCmDoubleOptAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, number | null>>()
        expect(v).toBe(35)
    })
    */

    // ── boolean (cm_bool) ───────────────────────────────────────────────
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('boolean-required', async () => {
        ctx.mockNext(true)
        const v = await ctx.conn.callCmBoolean()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, boolean>>()
        expect(v).toBe(true)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('boolean-optional', async () => {
        ctx.mockNext(true)
        const v = await ctx.conn.callCmBooleanOpt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, boolean | null>>()
        expect(v).toBe(true)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('boolean-required-adapter', async () => {
        ctx.mockNext(true)
        const v = await ctx.conn.callCmBooleanAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, boolean>>()
        expect(v).toBe(false)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('boolean-optional-adapter', async () => {
        ctx.mockNext(true)
        const v = await ctx.conn.callCmBooleanOptAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, boolean | null>>()
        expect(v).toBe(false)
    })
    */

    // ── uuid (cm_uuid) ──────────────────────────────────────────────────
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('uuid-required', async () => {
        ctx.mockNext(UUID)
        const v = await ctx.conn.callCmUuid()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, string>>()
        expect(v).toBe(UUID)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('uuid-optional', async () => {
        ctx.mockNext(UUID)
        const v = await ctx.conn.callCmUuidOpt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, string | null>>()
        expect(v).toBe(UUID)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('uuid-required-adapter', async () => {
        ctx.mockNext(UUID)
        const v = await ctx.conn.callCmUuidAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, string>>()
        expect(v).toBe(BRACKET_UUID)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('uuid-optional-adapter', async () => {
        ctx.mockNext(UUID)
        const v = await ctx.conn.callCmUuidOptAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, string | null>>()
        expect(v).toBe(BRACKET_UUID)
    })
    */

    // ── localDate (cm_date) — temporal: base structural, adapter guarded ──
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('local-date-required', async () => {
        ctx.mockNext(CM_DATE)
        const v = await ctx.conn.callCmLocalDate()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date>>()
        expect(v).toBeInstanceOf(Date)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('local-date-optional', async () => {
        ctx.mockNext(CM_DATE)
        const v = await ctx.conn.callCmLocalDateOpt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date | null>>()
        expect(v).toBeInstanceOf(Date)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('local-date-required-adapter', async () => {
        ctx.mockNext(CM_DATE)
        const v = await ctx.conn.callCmLocalDateAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date>>()
        expect(v).toEqual(CM_DATE_1H)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('local-date-optional-adapter', async () => {
        ctx.mockNext(CM_DATE)
        const v = await ctx.conn.callCmLocalDateOptAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date | null>>()
        expect(v).toEqual(CM_DATE_1H)
    })
    */

    // ── localTime (cm_time) ─────────────────────────────────────────────
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('local-time-required', async () => {
        ctx.mockNext(CM_TIME)
        const v = await ctx.conn.callCmLocalTime()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date>>()
        expect(v).toBeInstanceOf(Date)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('local-time-optional', async () => {
        ctx.mockNext(CM_TIME)
        const v = await ctx.conn.callCmLocalTimeOpt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date | null>>()
        expect(v).toBeInstanceOf(Date)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('local-time-required-adapter', async () => {
        ctx.mockNext(CM_TIME)
        const v = await ctx.conn.callCmLocalTimeAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date>>()
        expect(v).toEqual(CM_TIME_1H)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('local-time-optional-adapter', async () => {
        ctx.mockNext(CM_TIME)
        const v = await ctx.conn.callCmLocalTimeOptAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date | null>>()
        expect(v).toEqual(CM_TIME_1H)
    })
    */

    // ── localDateTime (cm_datetime) ─────────────────────────────────────
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('local-date-time-required', async () => {
        ctx.mockNext(CM_DATETIME)
        const v = await ctx.conn.callCmLocalDateTime()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date>>()
        expect(v).toBeInstanceOf(Date)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('local-date-time-optional', async () => {
        ctx.mockNext(CM_DATETIME)
        const v = await ctx.conn.callCmLocalDateTimeOpt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date | null>>()
        expect(v).toBeInstanceOf(Date)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('local-date-time-required-adapter', async () => {
        ctx.mockNext(CM_DATETIME)
        const v = await ctx.conn.callCmLocalDateTimeAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date>>()
        expect(v).toEqual(CM_DATETIME_1H)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('local-date-time-optional-adapter', async () => {
        ctx.mockNext(CM_DATETIME)
        const v = await ctx.conn.callCmLocalDateTimeOptAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date | null>>()
        expect(v).toEqual(CM_DATETIME_1H)
    })
    */

    // ── string (cm_str) ─────────────────────────────────────────────────
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('string-required', async () => {
        ctx.mockNext('hello')
        const v = await ctx.conn.callCmString()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, string>>()
        expect(v).toBe('hello')
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('string-optional', async () => {
        ctx.mockNext('hello')
        const v = await ctx.conn.callCmStringOpt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, string | null>>()
        expect(v).toBe('hello')
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('string-required-adapter', async () => {
        ctx.mockNext('hello')
        const v = await ctx.conn.callCmStringAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, string>>()
        expect(v).toBe('[hello]')
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('string-optional-adapter', async () => {
        ctx.mockNext('hello')
        const v = await ctx.conn.callCmStringOptAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, string | null>>()
        expect(v).toBe('[hello]')
    })
    */

    // ── enum (cm_str, WorklogActivity) ──────────────────────────────────
    // The identity enum read passes the raw 'hello' through — not a declared
    // WorklogActivity member, but the library does not validate enum values, so
    // the marshalled string reaches the caller unchanged.
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('enum-required', async () => {
        ctx.mockNext('hello')
        const v = await ctx.conn.callCmEnum()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, WorklogActivity>>()
        expect(v).toBe('hello')
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('enum-optional', async () => {
        ctx.mockNext('hello')
        const v = await ctx.conn.callCmEnumOpt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, WorklogActivity | null>>()
        expect(v).toBe('hello')
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('enum-required-adapter', async () => {
        ctx.mockNext('hello')
        const v = await ctx.conn.callCmEnumAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, WorklogActivity>>()
        expect(v).toBe('[hello]')
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('enum-optional-adapter', async () => {
        ctx.mockNext('hello')
        const v = await ctx.conn.callCmEnumOptAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, WorklogActivity | null>>()
        expect(v).toBe('[hello]')
    })
    */

    // ── custom (cm_str, ReleaseChannel) ─────────────────────────────────
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-required', async () => {
        ctx.mockNext('hello')
        const v = await ctx.conn.callCmCustom()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, ReleaseChannel>>()
        expect(v).toBe('hello')
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-optional', async () => {
        ctx.mockNext('hello')
        const v = await ctx.conn.callCmCustomOpt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, ReleaseChannel | null>>()
        expect(v).toBe('hello')
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-required-adapter', async () => {
        ctx.mockNext('hello')
        const v = await ctx.conn.callCmCustomAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, ReleaseChannel>>()
        expect(v).toBe('[hello]')
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-optional-adapter', async () => {
        ctx.mockNext('hello')
        const v = await ctx.conn.callCmCustomOptAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, ReleaseChannel | null>>()
        expect(v).toBe('[hello]')
    })
    */

    // ── customComparable (cm_str, Semver) ───────────────────────────────
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-comparable-required', async () => {
        ctx.mockNext('hello')
        const v = await ctx.conn.callCmCustomComparable()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, string>>()
        expect(v).toBe('hello')
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-comparable-optional', async () => {
        ctx.mockNext('hello')
        const v = await ctx.conn.callCmCustomComparableOpt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, string | null>>()
        expect(v).toBe('hello')
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-comparable-required-adapter', async () => {
        ctx.mockNext('hello')
        const v = await ctx.conn.callCmCustomComparableAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, string>>()
        expect(v).toBe('[hello]')
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-comparable-optional-adapter', async () => {
        ctx.mockNext('hello')
        const v = await ctx.conn.callCmCustomComparableOptAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, string | null>>()
        expect(v).toBe('[hello]')
    })
    */

    // ── customInt (cm_int, Cents) ───────────────────────────────────────
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-int-required', async () => {
        ctx.mockNext(42)
        const v = await ctx.conn.callCmCustomInt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(42)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-int-optional', async () => {
        ctx.mockNext(42)
        const v = await ctx.conn.callCmCustomIntOpt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, number | null>>()
        expect(v).toBe(42)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-int-required-adapter', async () => {
        ctx.mockNext(42)
        const v = await ctx.conn.callCmCustomIntAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(420)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-int-optional-adapter', async () => {
        ctx.mockNext(42)
        const v = await ctx.conn.callCmCustomIntOptAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, number | null>>()
        expect(v).toBe(420)
    })
    */

    // ── customUuid (cm_uuid, SigningKey) ────────────────────────────────
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-uuid-required', async () => {
        ctx.mockNext(UUID)
        const v = await ctx.conn.callCmCustomUuid()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, string>>()
        expect(v).toBe(UUID)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-uuid-optional', async () => {
        ctx.mockNext(UUID)
        const v = await ctx.conn.callCmCustomUuidOpt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, string | null>>()
        expect(v).toBe(UUID)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-uuid-required-adapter', async () => {
        ctx.mockNext(UUID)
        const v = await ctx.conn.callCmCustomUuidAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, string>>()
        expect(v).toBe(BRACKET_UUID)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-uuid-optional-adapter', async () => {
        ctx.mockNext(UUID)
        const v = await ctx.conn.callCmCustomUuidOptAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, string | null>>()
        expect(v).toBe(BRACKET_UUID)
    })
    */

    // ── customDouble (cm_double, Money) ─────────────────────────────────
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-double-required', async () => {
        ctx.mockNext(3.5)
        const v = await ctx.conn.callCmCustomDouble()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(3.5)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-double-optional', async () => {
        ctx.mockNext(3.5)
        const v = await ctx.conn.callCmCustomDoubleOpt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, number | null>>()
        expect(v).toBe(3.5)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-double-required-adapter', async () => {
        ctx.mockNext(3.5)
        const v = await ctx.conn.callCmCustomDoubleAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(35)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-double-optional-adapter', async () => {
        ctx.mockNext(3.5)
        const v = await ctx.conn.callCmCustomDoubleOptAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, number | null>>()
        expect(v).toBe(35)
    })
    */

    // ── customLocalDate (cm_date, ReleaseDay) — temporal ────────────────
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-local-date-required', async () => {
        ctx.mockNext(CM_DATE)
        const v = await ctx.conn.callCmCustomLocalDate()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date>>()
        expect(v).toBeInstanceOf(Date)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-local-date-optional', async () => {
        ctx.mockNext(CM_DATE)
        const v = await ctx.conn.callCmCustomLocalDateOpt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date | null>>()
        expect(v).toBeInstanceOf(Date)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-local-date-required-adapter', async () => {
        ctx.mockNext(CM_DATE)
        const v = await ctx.conn.callCmCustomLocalDateAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date>>()
        expect(v).toEqual(CM_DATE_1H)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-local-date-optional-adapter', async () => {
        ctx.mockNext(CM_DATE)
        const v = await ctx.conn.callCmCustomLocalDateOptAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date | null>>()
        expect(v).toEqual(CM_DATE_1H)
    })
    */

    // ── customLocalTime (cm_time, CutoffClock) ──────────────────────────
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-local-time-required', async () => {
        ctx.mockNext(CM_TIME)
        const v = await ctx.conn.callCmCustomLocalTime()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date>>()
        expect(v).toBeInstanceOf(Date)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-local-time-optional', async () => {
        ctx.mockNext(CM_TIME)
        const v = await ctx.conn.callCmCustomLocalTimeOpt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date | null>>()
        expect(v).toBeInstanceOf(Date)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-local-time-required-adapter', async () => {
        ctx.mockNext(CM_TIME)
        const v = await ctx.conn.callCmCustomLocalTimeAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date>>()
        expect(v).toEqual(CM_TIME_1H)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-local-time-optional-adapter', async () => {
        ctx.mockNext(CM_TIME)
        const v = await ctx.conn.callCmCustomLocalTimeOptAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date | null>>()
        expect(v).toEqual(CM_TIME_1H)
    })
    */

    // ── customLocalDateTime (cm_datetime, SignOffStamp) ─────────────────
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-local-date-time-required', async () => {
        ctx.mockNext(CM_DATETIME)
        const v = await ctx.conn.callCmCustomLocalDateTime()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date>>()
        expect(v).toBeInstanceOf(Date)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-local-date-time-optional', async () => {
        ctx.mockNext(CM_DATETIME)
        const v = await ctx.conn.callCmCustomLocalDateTimeOpt()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date | null>>()
        expect(v).toBeInstanceOf(Date)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-local-date-time-required-adapter', async () => {
        ctx.mockNext(CM_DATETIME)
        const v = await ctx.conn.callCmCustomLocalDateTimeAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date>>()
        expect(v).toEqual(CM_DATETIME_1H)
    })
    */
    // TODO[LIMITATION]: SQLite has no DDL for user-defined SQL functions; see exec.procedure-function.test.ts
    /*
    test('custom-local-date-time-optional-adapter', async () => {
        ctx.mockNext(CM_DATETIME)
        const v = await ctx.conn.callCmCustomLocalDateTimeOptAdapter()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof v, Date | null>>()
        expect(v).toEqual(CM_DATETIME_1H)
    })
    */

})