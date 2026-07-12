// COL F2-COL T4 — non-virtual column-factory per-kind fan-out.
//
// Every distinct column factory (`column` / `optionalColumn` /
// `columnWithDefaultValue` / `optionalColumnWithDefaultValue` /
// `computedColumn` / `optionalComputedColumn` / `primaryKey`, plus the View
// `column` / `optionalColumn`) is a distinct TYPED read path even though the
// read SQL and value coincide: the optionality / default / computed / primary-key
// distinction each factory encodes is type-level, and the per-kind read
// marshalling funnels through the same `DBColumnImpl` for all of them. So the
// `col_matrix` fixture holds one plain, NOT NULL column per base kind and the
// tColMatrix* Table classes (and vColMatrix View) each read those SAME columns
// through a DIFFERENT factory. Each test asserts the emitted SQL (snapshot), the
// bound params (snapshot), the exact projected TYPE (`assertType`) and the real
// seeded VALUE (`ctx.mockNext` + `toEqual`, holding in both mock and real modes).
//
// Temporal values follow select.column-factory-types.test.ts: the seed dates
// (m_date / m_time / m_datetime) are the same as that file's
// work_date / started_at / signed_off_at, so each driver's normalised Date read
// is the fixed-point value primed below — one deep-equality assertion holds in
// both mock and real modes. TZ=UTC is forced by the suite (setupTimezone.ts).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import {
    tColMatrixColumn,
    tColMatrixOptional,
    tColMatrixDefault,
    tColMatrixOptionalDefault,
    tColMatrixComputed,
    tColMatrixOptionalComputed,
    tColMatrixPk,
    vColMatrix,
    tColMatrixColumnAdapter,
    tColMatrixOptionalAdapter,
    tColMatrixDefaultAdapter,
    tColMatrixOptionalDefaultAdapter,
    tColMatrixComputedAdapter,
    tColMatrixOptionalComputedAdapter,
} from '../../domain/connection.js'
import type { ReleaseChannel, WorklogActivity } from '../../domain/connection.js'
import { ctx } from './setup.js'

const UUID = '0a8f9c1e-1111-4222-8333-444455556666'
// The per-driver normalised Date reads of the seeded temporal columns — the same
// fixed-point values select.column-factory-types.test.ts primes for the identical
// seed dates. m_date 2024-03-04, m_time 09:15:00, m_datetime 2024-01-14 12:30:00.
const M_DATE = new Date(Date.UTC(2024, 2, 4, 10, 0, 0))
const M_TIME = new Date(Date.UTC(1970, 0, 1, 9, 15, 0))
const M_DATETIME = new Date(Date.UTC(2024, 0, 14, 12, 30, 0))

// The full seeded row as every tColMatrix* factory class projects it (id + one
// property per kind). The custom-string kinds (semver / channel / activity) all
// read the same plain 'hello' — the read passes the value through, so the
// distinct typed leaf is what each observes.
const matrixRow = {
    id:          1,
    mInt:        42,
    mBigint:     5000n,
    mDouble:     3.5,
    mBool:       true,
    mUuid:       UUID,
    mDate:       M_DATE,
    mTime:       M_TIME,
    mDatetime:   M_DATETIME,
    mStr:        'hello',
    cents:       42,
    money:       3.5,
    signingKey:  UUID,
    semver:      'hello',
    channel:     'hello',
    releaseDay:  M_DATE,
    cutoffClock: M_TIME,
    signOff:     M_DATETIME,
    activity:    'hello',
}

// The adapter-arm expected row: the SAME raw seed read through each column's
// trailing TypeAdapter (numeric ×10, bigint ×10n, boolean negate, uuid
// lowercase+bracket, string bracket, Date +1h). Priming `matrixRow` (raw) and
// asserting this holds unconditionally in mock AND real — the adapter runs on
// `transformValueFromDB` in both modes. `id` carries no adapter.
const M_DATE_1H = new Date(Date.UTC(2024, 2, 4, 11, 0, 0))
const M_TIME_1H = new Date(Date.UTC(1970, 0, 1, 10, 15, 0))
const M_DATETIME_1H = new Date(Date.UTC(2024, 0, 14, 13, 30, 0))
const BRACKET_UUID = '[' + UUID + ']'
const matrixRowAdapted = {
    id:          1,
    mInt:        420,
    mBigint:     50000n,
    mDouble:     35,
    mBool:       false,
    mUuid:       BRACKET_UUID,
    mDate:       M_DATE_1H,
    mTime:       M_TIME_1H,
    mDatetime:   M_DATETIME_1H,
    mStr:        '[hello]',
    cents:       420,
    money:       35,
    signingKey:  BRACKET_UUID,
    semver:      '[hello]',
    channel:     '[hello]',
    releaseDay:  M_DATE_1H,
    cutoffClock: M_TIME_1H,
    signOff:     M_DATETIME_1H,
    activity:    '[hello]',
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // ---- column-factory-matrix (COL F2-COL T4 fan-out) ----

    test('required-column-factory-projects-each-kind', async () => {
        // `column(name, kind)` (required) per kind.
        ctx.mockNext(matrixRow)
        const row = await ctx.conn.selectFrom(tColMatrixColumn)
            .select({
                id:          tColMatrixColumn.id,
                mInt:        tColMatrixColumn.mInt,
                mBigint:     tColMatrixColumn.mBigint,
                mDouble:     tColMatrixColumn.mDouble,
                mBool:       tColMatrixColumn.mBool,
                mUuid:       tColMatrixColumn.mUuid,
                mDate:       tColMatrixColumn.mDate,
                mTime:       tColMatrixColumn.mTime,
                mDatetime:   tColMatrixColumn.mDatetime,
                mStr:        tColMatrixColumn.mStr,
                cents:       tColMatrixColumn.cents,
                money:       tColMatrixColumn.money,
                signingKey:  tColMatrixColumn.signingKey,
                semver:      tColMatrixColumn.semver,
                channel:     tColMatrixColumn.channel,
                releaseDay:  tColMatrixColumn.releaseDay,
                cutoffClock: tColMatrixColumn.cutoffClock,
                signOff:     tColMatrixColumn.signOff,
                activity:    tColMatrixColumn.activity,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, m_int as "mInt", m_bigint as "mBigint", m_double as "mDouble", m_bool as "mBool", m_uuid as "mUuid", m_date as "mDate", m_time as "mTime", m_datetime as "mDatetime", m_str as "mStr", m_int as cents, m_double as money, m_uuid as "signingKey", m_str as semver, m_str as channel, m_date as "releaseDay", m_time as "cutoffClock", m_datetime as "signOff", m_str as activity from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, {
            id:          number
            mInt:        number
            mBigint:     bigint
            mDouble:     number
            mBool:       boolean
            mUuid:       string
            mDate:       Date
            mTime:       Date
            mDatetime:   Date
            mStr:        string
            cents:       number
            money:       number
            signingKey:  string
            semver:      string
            channel:     ReleaseChannel
            releaseDay:  Date
            cutoffClock: Date
            signOff:     Date
            activity:    WorklogActivity
        }>>()
        expect(row).toEqual(matrixRow)
    })

    test('optional-column-factory-projects-each-kind', async () => {
        // `optionalColumn(name, kind)` per kind → `?: T` leaves (base type, not
        // `T | null`). `id` stays a required primaryKey, so the optional siblings
        // are `?: T` (no `| undefined`). Every seeded column is present.
        ctx.mockNext(matrixRow)
        const row = await ctx.conn.selectFrom(tColMatrixOptional)
            .select({
                id:          tColMatrixOptional.id,
                mInt:        tColMatrixOptional.mInt,
                mBigint:     tColMatrixOptional.mBigint,
                mDouble:     tColMatrixOptional.mDouble,
                mBool:       tColMatrixOptional.mBool,
                mUuid:       tColMatrixOptional.mUuid,
                mDate:       tColMatrixOptional.mDate,
                mTime:       tColMatrixOptional.mTime,
                mDatetime:   tColMatrixOptional.mDatetime,
                mStr:        tColMatrixOptional.mStr,
                cents:       tColMatrixOptional.cents,
                money:       tColMatrixOptional.money,
                signingKey:  tColMatrixOptional.signingKey,
                semver:      tColMatrixOptional.semver,
                channel:     tColMatrixOptional.channel,
                releaseDay:  tColMatrixOptional.releaseDay,
                cutoffClock: tColMatrixOptional.cutoffClock,
                signOff:     tColMatrixOptional.signOff,
                activity:    tColMatrixOptional.activity,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, m_int as "mInt", m_bigint as "mBigint", m_double as "mDouble", m_bool as "mBool", m_uuid as "mUuid", m_date as "mDate", m_time as "mTime", m_datetime as "mDatetime", m_str as "mStr", m_int as cents, m_double as money, m_uuid as "signingKey", m_str as semver, m_str as channel, m_date as "releaseDay", m_time as "cutoffClock", m_datetime as "signOff", m_str as activity from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, {
            id:           number
            mInt?:        number
            mBigint?:     bigint
            mDouble?:     number
            mBool?:       boolean
            mUuid?:       string
            mDate?:       Date
            mTime?:       Date
            mDatetime?:   Date
            mStr?:        string
            cents?:       number
            money?:       number
            signingKey?:  string
            semver?:      string
            channel?:     ReleaseChannel
            releaseDay?:  Date
            cutoffClock?: Date
            signOff?:     Date
            activity?:    WorklogActivity
        }>>()
        expect(row).toEqual(matrixRow)
    })

    test('column-with-default-value-factory-projects-each-kind', async () => {
        // `columnWithDefaultValue(name, kind)` (required on read) per kind.
        ctx.mockNext(matrixRow)
        const row = await ctx.conn.selectFrom(tColMatrixDefault)
            .select({
                id:          tColMatrixDefault.id,
                mInt:        tColMatrixDefault.mInt,
                mBigint:     tColMatrixDefault.mBigint,
                mDouble:     tColMatrixDefault.mDouble,
                mBool:       tColMatrixDefault.mBool,
                mUuid:       tColMatrixDefault.mUuid,
                mDate:       tColMatrixDefault.mDate,
                mTime:       tColMatrixDefault.mTime,
                mDatetime:   tColMatrixDefault.mDatetime,
                mStr:        tColMatrixDefault.mStr,
                cents:       tColMatrixDefault.cents,
                money:       tColMatrixDefault.money,
                signingKey:  tColMatrixDefault.signingKey,
                semver:      tColMatrixDefault.semver,
                channel:     tColMatrixDefault.channel,
                releaseDay:  tColMatrixDefault.releaseDay,
                cutoffClock: tColMatrixDefault.cutoffClock,
                signOff:     tColMatrixDefault.signOff,
                activity:    tColMatrixDefault.activity,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, m_int as "mInt", m_bigint as "mBigint", m_double as "mDouble", m_bool as "mBool", m_uuid as "mUuid", m_date as "mDate", m_time as "mTime", m_datetime as "mDatetime", m_str as "mStr", m_int as cents, m_double as money, m_uuid as "signingKey", m_str as semver, m_str as channel, m_date as "releaseDay", m_time as "cutoffClock", m_datetime as "signOff", m_str as activity from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, {
            id:          number
            mInt:        number
            mBigint:     bigint
            mDouble:     number
            mBool:       boolean
            mUuid:       string
            mDate:       Date
            mTime:       Date
            mDatetime:   Date
            mStr:        string
            cents:       number
            money:       number
            signingKey:  string
            semver:      string
            channel:     ReleaseChannel
            releaseDay:  Date
            cutoffClock: Date
            signOff:     Date
            activity:    WorklogActivity
        }>>()
        expect(row).toEqual(matrixRow)
    })

    test('optional-column-with-default-value-factory-projects-each-kind', async () => {
        // `optionalColumnWithDefaultValue(name, kind)` per kind → `?: T` leaves.
        ctx.mockNext(matrixRow)
        const row = await ctx.conn.selectFrom(tColMatrixOptionalDefault)
            .select({
                id:          tColMatrixOptionalDefault.id,
                mInt:        tColMatrixOptionalDefault.mInt,
                mBigint:     tColMatrixOptionalDefault.mBigint,
                mDouble:     tColMatrixOptionalDefault.mDouble,
                mBool:       tColMatrixOptionalDefault.mBool,
                mUuid:       tColMatrixOptionalDefault.mUuid,
                mDate:       tColMatrixOptionalDefault.mDate,
                mTime:       tColMatrixOptionalDefault.mTime,
                mDatetime:   tColMatrixOptionalDefault.mDatetime,
                mStr:        tColMatrixOptionalDefault.mStr,
                cents:       tColMatrixOptionalDefault.cents,
                money:       tColMatrixOptionalDefault.money,
                signingKey:  tColMatrixOptionalDefault.signingKey,
                semver:      tColMatrixOptionalDefault.semver,
                channel:     tColMatrixOptionalDefault.channel,
                releaseDay:  tColMatrixOptionalDefault.releaseDay,
                cutoffClock: tColMatrixOptionalDefault.cutoffClock,
                signOff:     tColMatrixOptionalDefault.signOff,
                activity:    tColMatrixOptionalDefault.activity,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, m_int as "mInt", m_bigint as "mBigint", m_double as "mDouble", m_bool as "mBool", m_uuid as "mUuid", m_date as "mDate", m_time as "mTime", m_datetime as "mDatetime", m_str as "mStr", m_int as cents, m_double as money, m_uuid as "signingKey", m_str as semver, m_str as channel, m_date as "releaseDay", m_time as "cutoffClock", m_datetime as "signOff", m_str as activity from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, {
            id:           number
            mInt?:        number
            mBigint?:     bigint
            mDouble?:     number
            mBool?:       boolean
            mUuid?:       string
            mDate?:       Date
            mTime?:       Date
            mDatetime?:   Date
            mStr?:        string
            cents?:       number
            money?:       number
            signingKey?:  string
            semver?:      string
            channel?:     ReleaseChannel
            releaseDay?:  Date
            cutoffClock?: Date
            signOff?:     Date
            activity?:    WorklogActivity
        }>>()
        expect(row).toEqual(matrixRow)
    })

    test('computed-column-factory-projects-each-kind', async () => {
        // `computedColumn(name, kind)` (required on read, excluded from the
        // writable shape) per kind.
        ctx.mockNext(matrixRow)
        const row = await ctx.conn.selectFrom(tColMatrixComputed)
            .select({
                id:          tColMatrixComputed.id,
                mInt:        tColMatrixComputed.mInt,
                mBigint:     tColMatrixComputed.mBigint,
                mDouble:     tColMatrixComputed.mDouble,
                mBool:       tColMatrixComputed.mBool,
                mUuid:       tColMatrixComputed.mUuid,
                mDate:       tColMatrixComputed.mDate,
                mTime:       tColMatrixComputed.mTime,
                mDatetime:   tColMatrixComputed.mDatetime,
                mStr:        tColMatrixComputed.mStr,
                cents:       tColMatrixComputed.cents,
                money:       tColMatrixComputed.money,
                signingKey:  tColMatrixComputed.signingKey,
                semver:      tColMatrixComputed.semver,
                channel:     tColMatrixComputed.channel,
                releaseDay:  tColMatrixComputed.releaseDay,
                cutoffClock: tColMatrixComputed.cutoffClock,
                signOff:     tColMatrixComputed.signOff,
                activity:    tColMatrixComputed.activity,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, m_int as "mInt", m_bigint as "mBigint", m_double as "mDouble", m_bool as "mBool", m_uuid as "mUuid", m_date as "mDate", m_time as "mTime", m_datetime as "mDatetime", m_str as "mStr", m_int as cents, m_double as money, m_uuid as "signingKey", m_str as semver, m_str as channel, m_date as "releaseDay", m_time as "cutoffClock", m_datetime as "signOff", m_str as activity from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, {
            id:          number
            mInt:        number
            mBigint:     bigint
            mDouble:     number
            mBool:       boolean
            mUuid:       string
            mDate:       Date
            mTime:       Date
            mDatetime:   Date
            mStr:        string
            cents:       number
            money:       number
            signingKey:  string
            semver:      string
            channel:     ReleaseChannel
            releaseDay:  Date
            cutoffClock: Date
            signOff:     Date
            activity:    WorklogActivity
        }>>()
        expect(row).toEqual(matrixRow)
    })

    test('optional-computed-column-factory-projects-each-kind', async () => {
        // `optionalComputedColumn(name, kind)` per kind → `?: T` leaves.
        ctx.mockNext(matrixRow)
        const row = await ctx.conn.selectFrom(tColMatrixOptionalComputed)
            .select({
                id:          tColMatrixOptionalComputed.id,
                mInt:        tColMatrixOptionalComputed.mInt,
                mBigint:     tColMatrixOptionalComputed.mBigint,
                mDouble:     tColMatrixOptionalComputed.mDouble,
                mBool:       tColMatrixOptionalComputed.mBool,
                mUuid:       tColMatrixOptionalComputed.mUuid,
                mDate:       tColMatrixOptionalComputed.mDate,
                mTime:       tColMatrixOptionalComputed.mTime,
                mDatetime:   tColMatrixOptionalComputed.mDatetime,
                mStr:        tColMatrixOptionalComputed.mStr,
                cents:       tColMatrixOptionalComputed.cents,
                money:       tColMatrixOptionalComputed.money,
                signingKey:  tColMatrixOptionalComputed.signingKey,
                semver:      tColMatrixOptionalComputed.semver,
                channel:     tColMatrixOptionalComputed.channel,
                releaseDay:  tColMatrixOptionalComputed.releaseDay,
                cutoffClock: tColMatrixOptionalComputed.cutoffClock,
                signOff:     tColMatrixOptionalComputed.signOff,
                activity:    tColMatrixOptionalComputed.activity,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, m_int as "mInt", m_bigint as "mBigint", m_double as "mDouble", m_bool as "mBool", m_uuid as "mUuid", m_date as "mDate", m_time as "mTime", m_datetime as "mDatetime", m_str as "mStr", m_int as cents, m_double as money, m_uuid as "signingKey", m_str as semver, m_str as channel, m_date as "releaseDay", m_time as "cutoffClock", m_datetime as "signOff", m_str as activity from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, {
            id:           number
            mInt?:        number
            mBigint?:     bigint
            mDouble?:     number
            mBool?:       boolean
            mUuid?:       string
            mDate?:       Date
            mTime?:       Date
            mDatetime?:   Date
            mStr?:        string
            cents?:       number
            money?:       number
            signingKey?:  string
            semver?:      string
            channel?:     ReleaseChannel
            releaseDay?:  Date
            cutoffClock?: Date
            signOff?:     Date
            activity?:    WorklogActivity
        }>>()
        expect(row).toEqual(matrixRow)
    })

    test('primary-key-factory-projects-each-comparable-kind', async () => {
        // `primaryKey(name, kind)` per COMPARABLE kind (int / string / uuid /
        // bigint) — a caller-provided composite PK; only the read path is
        // observed. id → m_int (42), strPk → m_str ('hello'), uuidPk → m_uuid,
        // bigintPk → m_bigint (5000n).
        const expected = { id: 42, strPk: 'hello', uuidPk: UUID, bigintPk: 5000n }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tColMatrixPk)
            .select({
                id:       tColMatrixPk.id,
                strPk:    tColMatrixPk.strPk,
                uuidPk:   tColMatrixPk.uuidPk,
                bigintPk: tColMatrixPk.bigintPk,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_int as id, m_str as "strPk", m_uuid as "uuidPk", m_bigint as "bigintPk" from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { id: number; strPk: string; uuidPk: string; bigintPk: bigint }>>()
        expect(row).toEqual(expected)
    })

    test('view-required-column-factory-projects-each-kind', async () => {
        // View `column(name, kind)` (required) per kind — the View side of the
        // per-kind read marshalling, over the col_matrix_view DB view.
        ctx.mockNext(matrixRow)
        const row = await ctx.conn.selectFrom(vColMatrix)
            .select({
                id:          vColMatrix.id,
                mInt:        vColMatrix.mInt,
                mBigint:     vColMatrix.mBigint,
                mDouble:     vColMatrix.mDouble,
                mBool:       vColMatrix.mBool,
                mUuid:       vColMatrix.mUuid,
                mDate:       vColMatrix.mDate,
                mTime:       vColMatrix.mTime,
                mDatetime:   vColMatrix.mDatetime,
                mStr:        vColMatrix.mStr,
                cents:       vColMatrix.cents,
                money:       vColMatrix.money,
                signingKey:  vColMatrix.signingKey,
                semver:      vColMatrix.semver,
                channel:     vColMatrix.channel,
                releaseDay:  vColMatrix.releaseDay,
                cutoffClock: vColMatrix.cutoffClock,
                signOff:     vColMatrix.signOff,
                activity:    vColMatrix.activity,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, m_int as "mInt", m_bigint as "mBigint", m_double as "mDouble", m_bool as "mBool", m_uuid as "mUuid", m_date as "mDate", m_time as "mTime", m_datetime as "mDatetime", m_str as "mStr", m_int as cents, m_double as money, m_uuid as "signingKey", m_str as semver, m_str as channel, m_date as "releaseDay", m_time as "cutoffClock", m_datetime as "signOff", m_str as activity from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, {
            id:          number
            mInt:        number
            mBigint:     bigint
            mDouble:     number
            mBool:       boolean
            mUuid:       string
            mDate:       Date
            mTime:       Date
            mDatetime:   Date
            mStr:        string
            cents:       number
            money:       number
            signingKey:  string
            semver:      string
            channel:     ReleaseChannel
            releaseDay:  Date
            cutoffClock: Date
            signOff:     Date
            activity:    WorklogActivity
        }>>()
        expect(row).toEqual(matrixRow)
    })

    test('view-optional-column-factory-projects-each-kind', async () => {
        // View `optionalColumn(name, kind)` per kind → `?: T` leaves. Every
        // seeded column is present.
        const expected = {
            id:           1,
            oInt:         42,
            oBigint:      5000n,
            oDouble:      3.5,
            oBool:        true,
            oUuid:        UUID,
            oDate:        M_DATE,
            oTime:        M_TIME,
            oDatetime:    M_DATETIME,
            oStr:         'hello',
            oCents:       42,
            oMoney:       3.5,
            oSigningKey:  UUID,
            oSemver:      'hello',
            oChannel:     'hello',
            oReleaseDay:  M_DATE,
            oCutoffClock: M_TIME,
            oSignOff:     M_DATETIME,
            oActivity:    'hello',
        }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(vColMatrix)
            .select({
                id:           vColMatrix.id,
                oInt:         vColMatrix.oInt,
                oBigint:      vColMatrix.oBigint,
                oDouble:      vColMatrix.oDouble,
                oBool:        vColMatrix.oBool,
                oUuid:        vColMatrix.oUuid,
                oDate:        vColMatrix.oDate,
                oTime:        vColMatrix.oTime,
                oDatetime:    vColMatrix.oDatetime,
                oStr:         vColMatrix.oStr,
                oCents:       vColMatrix.oCents,
                oMoney:       vColMatrix.oMoney,
                oSigningKey:  vColMatrix.oSigningKey,
                oSemver:      vColMatrix.oSemver,
                oChannel:     vColMatrix.oChannel,
                oReleaseDay:  vColMatrix.oReleaseDay,
                oCutoffClock: vColMatrix.oCutoffClock,
                oSignOff:     vColMatrix.oSignOff,
                oActivity:    vColMatrix.oActivity,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, m_int as "oInt", m_bigint as "oBigint", m_double as "oDouble", m_bool as "oBool", m_uuid as "oUuid", m_date as "oDate", m_time as "oTime", m_datetime as "oDatetime", m_str as "oStr", m_int as "oCents", m_double as "oMoney", m_uuid as "oSigningKey", m_str as "oSemver", m_str as "oChannel", m_date as "oReleaseDay", m_time as "oCutoffClock", m_datetime as "oSignOff", m_str as "oActivity" from col_matrix_view"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, {
            id:            number
            oInt?:         number
            oBigint?:      bigint
            oDouble?:      number
            oBool?:        boolean
            oUuid?:        string
            oDate?:        Date
            oTime?:        Date
            oDatetime?:    Date
            oStr?:         string
            oCents?:       number
            oMoney?:       number
            oSigningKey?:  string
            oSemver?:      string
            oChannel?:     ReleaseChannel
            oReleaseDay?:  Date
            oCutoffClock?: Date
            oSignOff?:     Date
            oActivity?:    WorklogActivity
        }>>()
        expect(row).toEqual(expected)
    })
    // ---- COL factory adapter-arm fan-out (round-44 T4) ----------------------
    test('required-column-factory-adapter-transforms-each-kind', async () => {
        // `column(name, kind, adapter)` — the trailing-adapter overload (required). The
        // raw seed is read through each column's adapter (numeric ×10, bigint ×10n,
        // boolean negate, uuid lowercase+bracket, string bracket, Date +1h); the leaf
        // TYPE is unchanged from the no-adapter twin.
        ctx.mockNext(matrixRow)
        const row = await ctx.conn.selectFrom(tColMatrixColumnAdapter)
            .select({
                id:          tColMatrixColumnAdapter.id,
                mInt:        tColMatrixColumnAdapter.mInt,
                mBigint:     tColMatrixColumnAdapter.mBigint,
                mDouble:     tColMatrixColumnAdapter.mDouble,
                mBool:       tColMatrixColumnAdapter.mBool,
                mUuid:       tColMatrixColumnAdapter.mUuid,
                mDate:       tColMatrixColumnAdapter.mDate,
                mTime:       tColMatrixColumnAdapter.mTime,
                mDatetime:   tColMatrixColumnAdapter.mDatetime,
                mStr:        tColMatrixColumnAdapter.mStr,
                cents:       tColMatrixColumnAdapter.cents,
                money:       tColMatrixColumnAdapter.money,
                signingKey:  tColMatrixColumnAdapter.signingKey,
                semver:      tColMatrixColumnAdapter.semver,
                channel:     tColMatrixColumnAdapter.channel,
                releaseDay:  tColMatrixColumnAdapter.releaseDay,
                cutoffClock: tColMatrixColumnAdapter.cutoffClock,
                signOff:     tColMatrixColumnAdapter.signOff,
                activity:    tColMatrixColumnAdapter.activity,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, m_int as "mInt", m_bigint as "mBigint", m_double as "mDouble", m_bool as "mBool", m_uuid as "mUuid", m_date as "mDate", m_time as "mTime", m_datetime as "mDatetime", m_str as "mStr", m_int as cents, m_double as money, m_uuid as "signingKey", m_str as semver, m_str as channel, m_date as "releaseDay", m_time as "cutoffClock", m_datetime as "signOff", m_str as activity from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, {
            id:          number
            mInt:        number
            mBigint:     bigint
            mDouble:     number
            mBool:       boolean
            mUuid:       string
            mDate:       Date
            mTime:       Date
            mDatetime:   Date
            mStr:        string
            cents:       number
            money:       number
            signingKey:  string
            semver:      string
            channel:     ReleaseChannel
            releaseDay:  Date
            cutoffClock: Date
            signOff:     Date
            activity:    WorklogActivity
        }>>()
        expect(row).toEqual(matrixRowAdapted)
    })

    test('optional-column-factory-adapter-transforms-each-kind', async () => {
        // `optionalColumn(name, kind, adapter)` — the optional trailing-adapter overload.
        // Same read transforms; `?: T` leaves (a required `id` keeps them `?: T`, not
        // `?: T | undefined`).
        ctx.mockNext(matrixRow)
        const row = await ctx.conn.selectFrom(tColMatrixOptionalAdapter)
            .select({
                id:          tColMatrixOptionalAdapter.id,
                mInt:        tColMatrixOptionalAdapter.mInt,
                mBigint:     tColMatrixOptionalAdapter.mBigint,
                mDouble:     tColMatrixOptionalAdapter.mDouble,
                mBool:       tColMatrixOptionalAdapter.mBool,
                mUuid:       tColMatrixOptionalAdapter.mUuid,
                mDate:       tColMatrixOptionalAdapter.mDate,
                mTime:       tColMatrixOptionalAdapter.mTime,
                mDatetime:   tColMatrixOptionalAdapter.mDatetime,
                mStr:        tColMatrixOptionalAdapter.mStr,
                cents:       tColMatrixOptionalAdapter.cents,
                money:       tColMatrixOptionalAdapter.money,
                signingKey:  tColMatrixOptionalAdapter.signingKey,
                semver:      tColMatrixOptionalAdapter.semver,
                channel:     tColMatrixOptionalAdapter.channel,
                releaseDay:  tColMatrixOptionalAdapter.releaseDay,
                cutoffClock: tColMatrixOptionalAdapter.cutoffClock,
                signOff:     tColMatrixOptionalAdapter.signOff,
                activity:    tColMatrixOptionalAdapter.activity,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, m_int as "mInt", m_bigint as "mBigint", m_double as "mDouble", m_bool as "mBool", m_uuid as "mUuid", m_date as "mDate", m_time as "mTime", m_datetime as "mDatetime", m_str as "mStr", m_int as cents, m_double as money, m_uuid as "signingKey", m_str as semver, m_str as channel, m_date as "releaseDay", m_time as "cutoffClock", m_datetime as "signOff", m_str as activity from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, {
            id:          number
            mInt?:       number
            mBigint?:    bigint
            mDouble?:    number
            mBool?:      boolean
            mUuid?:      string
            mDate?:      Date
            mTime?:      Date
            mDatetime?:  Date
            mStr?:       string
            cents?:      number
            money?:      number
            signingKey?: string
            semver?:     string
            channel?:    ReleaseChannel
            releaseDay?: Date
            cutoffClock?:Date
            signOff?:    Date
            activity?:   WorklogActivity
        }>>()
        expect(row).toEqual(matrixRowAdapted)
    })

    test('column-with-default-value-factory-adapter-transforms-each-kind', async () => {
        // `columnWithDefaultValue(name, kind, adapter)` — required on read, trailing adapter.
        ctx.mockNext(matrixRow)
        const row = await ctx.conn.selectFrom(tColMatrixDefaultAdapter)
            .select({
                id:          tColMatrixDefaultAdapter.id,
                mInt:        tColMatrixDefaultAdapter.mInt,
                mBigint:     tColMatrixDefaultAdapter.mBigint,
                mDouble:     tColMatrixDefaultAdapter.mDouble,
                mBool:       tColMatrixDefaultAdapter.mBool,
                mUuid:       tColMatrixDefaultAdapter.mUuid,
                mDate:       tColMatrixDefaultAdapter.mDate,
                mTime:       tColMatrixDefaultAdapter.mTime,
                mDatetime:   tColMatrixDefaultAdapter.mDatetime,
                mStr:        tColMatrixDefaultAdapter.mStr,
                cents:       tColMatrixDefaultAdapter.cents,
                money:       tColMatrixDefaultAdapter.money,
                signingKey:  tColMatrixDefaultAdapter.signingKey,
                semver:      tColMatrixDefaultAdapter.semver,
                channel:     tColMatrixDefaultAdapter.channel,
                releaseDay:  tColMatrixDefaultAdapter.releaseDay,
                cutoffClock: tColMatrixDefaultAdapter.cutoffClock,
                signOff:     tColMatrixDefaultAdapter.signOff,
                activity:    tColMatrixDefaultAdapter.activity,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, m_int as "mInt", m_bigint as "mBigint", m_double as "mDouble", m_bool as "mBool", m_uuid as "mUuid", m_date as "mDate", m_time as "mTime", m_datetime as "mDatetime", m_str as "mStr", m_int as cents, m_double as money, m_uuid as "signingKey", m_str as semver, m_str as channel, m_date as "releaseDay", m_time as "cutoffClock", m_datetime as "signOff", m_str as activity from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, {
            id:          number
            mInt:        number
            mBigint:     bigint
            mDouble:     number
            mBool:       boolean
            mUuid:       string
            mDate:       Date
            mTime:       Date
            mDatetime:   Date
            mStr:        string
            cents:       number
            money:       number
            signingKey:  string
            semver:      string
            channel:     ReleaseChannel
            releaseDay:  Date
            cutoffClock: Date
            signOff:     Date
            activity:    WorklogActivity
        }>>()
        expect(row).toEqual(matrixRowAdapted)
    })

    test('optional-column-with-default-value-factory-adapter-transforms-each-kind', async () => {
        // `optionalColumnWithDefaultValue(name, kind, adapter)` — optional, trailing adapter.
        ctx.mockNext(matrixRow)
        const row = await ctx.conn.selectFrom(tColMatrixOptionalDefaultAdapter)
            .select({
                id:          tColMatrixOptionalDefaultAdapter.id,
                mInt:        tColMatrixOptionalDefaultAdapter.mInt,
                mBigint:     tColMatrixOptionalDefaultAdapter.mBigint,
                mDouble:     tColMatrixOptionalDefaultAdapter.mDouble,
                mBool:       tColMatrixOptionalDefaultAdapter.mBool,
                mUuid:       tColMatrixOptionalDefaultAdapter.mUuid,
                mDate:       tColMatrixOptionalDefaultAdapter.mDate,
                mTime:       tColMatrixOptionalDefaultAdapter.mTime,
                mDatetime:   tColMatrixOptionalDefaultAdapter.mDatetime,
                mStr:        tColMatrixOptionalDefaultAdapter.mStr,
                cents:       tColMatrixOptionalDefaultAdapter.cents,
                money:       tColMatrixOptionalDefaultAdapter.money,
                signingKey:  tColMatrixOptionalDefaultAdapter.signingKey,
                semver:      tColMatrixOptionalDefaultAdapter.semver,
                channel:     tColMatrixOptionalDefaultAdapter.channel,
                releaseDay:  tColMatrixOptionalDefaultAdapter.releaseDay,
                cutoffClock: tColMatrixOptionalDefaultAdapter.cutoffClock,
                signOff:     tColMatrixOptionalDefaultAdapter.signOff,
                activity:    tColMatrixOptionalDefaultAdapter.activity,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, m_int as "mInt", m_bigint as "mBigint", m_double as "mDouble", m_bool as "mBool", m_uuid as "mUuid", m_date as "mDate", m_time as "mTime", m_datetime as "mDatetime", m_str as "mStr", m_int as cents, m_double as money, m_uuid as "signingKey", m_str as semver, m_str as channel, m_date as "releaseDay", m_time as "cutoffClock", m_datetime as "signOff", m_str as activity from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, {
            id:          number
            mInt?:       number
            mBigint?:    bigint
            mDouble?:    number
            mBool?:      boolean
            mUuid?:      string
            mDate?:      Date
            mTime?:      Date
            mDatetime?:  Date
            mStr?:       string
            cents?:      number
            money?:      number
            signingKey?: string
            semver?:     string
            channel?:    ReleaseChannel
            releaseDay?: Date
            cutoffClock?:Date
            signOff?:    Date
            activity?:   WorklogActivity
        }>>()
        expect(row).toEqual(matrixRowAdapted)
    })

    test('computed-column-factory-adapter-transforms-each-kind', async () => {
        // `computedColumn(name, kind, adapter)` — required on read, trailing adapter.
        ctx.mockNext(matrixRow)
        const row = await ctx.conn.selectFrom(tColMatrixComputedAdapter)
            .select({
                id:          tColMatrixComputedAdapter.id,
                mInt:        tColMatrixComputedAdapter.mInt,
                mBigint:     tColMatrixComputedAdapter.mBigint,
                mDouble:     tColMatrixComputedAdapter.mDouble,
                mBool:       tColMatrixComputedAdapter.mBool,
                mUuid:       tColMatrixComputedAdapter.mUuid,
                mDate:       tColMatrixComputedAdapter.mDate,
                mTime:       tColMatrixComputedAdapter.mTime,
                mDatetime:   tColMatrixComputedAdapter.mDatetime,
                mStr:        tColMatrixComputedAdapter.mStr,
                cents:       tColMatrixComputedAdapter.cents,
                money:       tColMatrixComputedAdapter.money,
                signingKey:  tColMatrixComputedAdapter.signingKey,
                semver:      tColMatrixComputedAdapter.semver,
                channel:     tColMatrixComputedAdapter.channel,
                releaseDay:  tColMatrixComputedAdapter.releaseDay,
                cutoffClock: tColMatrixComputedAdapter.cutoffClock,
                signOff:     tColMatrixComputedAdapter.signOff,
                activity:    tColMatrixComputedAdapter.activity,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, m_int as "mInt", m_bigint as "mBigint", m_double as "mDouble", m_bool as "mBool", m_uuid as "mUuid", m_date as "mDate", m_time as "mTime", m_datetime as "mDatetime", m_str as "mStr", m_int as cents, m_double as money, m_uuid as "signingKey", m_str as semver, m_str as channel, m_date as "releaseDay", m_time as "cutoffClock", m_datetime as "signOff", m_str as activity from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, {
            id:          number
            mInt:        number
            mBigint:     bigint
            mDouble:     number
            mBool:       boolean
            mUuid:       string
            mDate:       Date
            mTime:       Date
            mDatetime:   Date
            mStr:        string
            cents:       number
            money:       number
            signingKey:  string
            semver:      string
            channel:     ReleaseChannel
            releaseDay:  Date
            cutoffClock: Date
            signOff:     Date
            activity:    WorklogActivity
        }>>()
        expect(row).toEqual(matrixRowAdapted)
    })

    test('optional-computed-column-factory-adapter-transforms-each-kind', async () => {
        // `optionalComputedColumn(name, kind, adapter)` — optional, trailing adapter.
        ctx.mockNext(matrixRow)
        const row = await ctx.conn.selectFrom(tColMatrixOptionalComputedAdapter)
            .select({
                id:          tColMatrixOptionalComputedAdapter.id,
                mInt:        tColMatrixOptionalComputedAdapter.mInt,
                mBigint:     tColMatrixOptionalComputedAdapter.mBigint,
                mDouble:     tColMatrixOptionalComputedAdapter.mDouble,
                mBool:       tColMatrixOptionalComputedAdapter.mBool,
                mUuid:       tColMatrixOptionalComputedAdapter.mUuid,
                mDate:       tColMatrixOptionalComputedAdapter.mDate,
                mTime:       tColMatrixOptionalComputedAdapter.mTime,
                mDatetime:   tColMatrixOptionalComputedAdapter.mDatetime,
                mStr:        tColMatrixOptionalComputedAdapter.mStr,
                cents:       tColMatrixOptionalComputedAdapter.cents,
                money:       tColMatrixOptionalComputedAdapter.money,
                signingKey:  tColMatrixOptionalComputedAdapter.signingKey,
                semver:      tColMatrixOptionalComputedAdapter.semver,
                channel:     tColMatrixOptionalComputedAdapter.channel,
                releaseDay:  tColMatrixOptionalComputedAdapter.releaseDay,
                cutoffClock: tColMatrixOptionalComputedAdapter.cutoffClock,
                signOff:     tColMatrixOptionalComputedAdapter.signOff,
                activity:    tColMatrixOptionalComputedAdapter.activity,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, m_int as "mInt", m_bigint as "mBigint", m_double as "mDouble", m_bool as "mBool", m_uuid as "mUuid", m_date as "mDate", m_time as "mTime", m_datetime as "mDatetime", m_str as "mStr", m_int as cents, m_double as money, m_uuid as "signingKey", m_str as semver, m_str as channel, m_date as "releaseDay", m_time as "cutoffClock", m_datetime as "signOff", m_str as activity from col_matrix"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, {
            id:          number
            mInt?:       number
            mBigint?:    bigint
            mDouble?:    number
            mBool?:      boolean
            mUuid?:      string
            mDate?:      Date
            mTime?:      Date
            mDatetime?:  Date
            mStr?:       string
            cents?:      number
            money?:      number
            signingKey?: string
            semver?:     string
            channel?:    ReleaseChannel
            releaseDay?: Date
            cutoffClock?:Date
            signOff?:    Date
            activity?:   WorklogActivity
        }>>()
        expect(row).toEqual(matrixRowAdapted)
    })

})
