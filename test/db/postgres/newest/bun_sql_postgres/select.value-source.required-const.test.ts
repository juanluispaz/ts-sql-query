// Per-keyword coverage of `const(value, keyword[, typeName])`. Each keyword arm
// returns a distinct `*ValueSource<…, 'required'>` and a distinct emitted
// placeholder/cast. This file projects one value per arm through
// `selectFromNoTable().select({...})` (each required const projects as a
// non-optional `key: T`) and pins the emitted SQL (the cast ladder is
// dialect-specific; each cell records its own) plus the resolved REQUIRED leaf
// type.
//
// Custom typeNames are the ones the domain connection marshals through their
// native base (Money->double, ReleaseTag->int, SigningKey->uuid, Semver->
// string, CutoffClock/SignOffStamp->localTime/DateTime), so the const values
// round-trip typed on every engine. The `localDate` arm is omitted: a non-null
// date const echoed back is not round-trippable on every driver (some return a
// non-ISO format the localDate marshaller rejects), and `const` cannot take a
// null value to skip the parse.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { ReleaseChannel, WorklogActivity } from '../../domain/connection.js'
import { ctx } from './setup.js'

const UUID_V = '0a8f9c1e-1111-4222-8333-444455556666'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('required-const/int-double-bigint-boolean', async () => {
        // The int/double/bigint/boolean arms of const — the emitted SQL/cast
        // and the REQUIRED leaf type (no `?`).
        const expected = { i: 7, d: 1.5, bi: 9n, b: true }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFromNoTable()
            .select({
                i:  ctx.conn.const(7, 'int'),
                d:  ctx.conn.const(1.5, 'double'),
                bi: ctx.conn.const(9n, 'bigint'),
                b:  ctx.conn.const(true, 'boolean'),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int4 as "i", $2::float8 as "d", $3::int8 as bi, $4::bool as "b""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            1.5,
            9n,
            true,
          ]
        `)
        assertType<Exact<typeof row, { i: number; d: number; bi: bigint; b: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('required-const/uuid-enum-custom-comparable', async () => {
        // uuid (-> string), enum (-> the branded union), custom (equality, ->
        // the branded union), customComparable (-> string). The branded leaves
        // resolve to their underlying TS type, all REQUIRED.
        const expected = { u: UUID_V, e: 'coding' as WorklogActivity, c: 'stable' as ReleaseChannel, cc: '1.2.0' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFromNoTable()
            .select({
                u:  ctx.conn.const(UUID_V, 'uuid'),
                e:  ctx.conn.const<WorklogActivity, 'WorklogActivity'>('coding', 'enum', 'WorklogActivity'),
                c:  ctx.conn.const<ReleaseChannel, 'ReleaseChannel'>('stable', 'custom', 'ReleaseChannel'),
                cc: ctx.conn.const<string, 'Semver'>('1.2.0', 'customComparable', 'Semver'),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::uuid as "u", $2 as "e", $3 as "c", $4 as cc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
            "coding",
            "stable",
            "1.2.0",
          ]
        `)
        assertType<Exact<typeof row, { u: string; e: WorklogActivity; c: ReleaseChannel; cc: string }>>()
        expect(row).toEqual(expected)
    })

    test('required-const/custom-numeric-and-uuid', async () => {
        // customInt (-> number), customDouble (-> number), customUuid
        // (-> string). Brands carry through; the leaves are the underlying type,
        // all REQUIRED.
        const expected = { ci: 7, cd: 1.5, cu: UUID_V }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFromNoTable()
            .select({
                ci: ctx.conn.const<number, 'ReleaseTag'>(7, 'customInt', 'ReleaseTag'),
                cd: ctx.conn.const<number, 'Money'>(1.5, 'customDouble', 'Money'),
                cu: ctx.conn.const<string, 'SigningKey'>(UUID_V, 'customUuid', 'SigningKey'),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::int4 as ci, $2::float8 as cd, $3 as cu"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            1.5,
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        assertType<Exact<typeof row, { ci: number; cd: number; cu: string }>>()
        expect(row).toEqual(expected)
    })

    test('required-const/temporal-time-and-datetime', async () => {
        // localTime / localDateTime and their custom siblings customLocalTime /
        // customLocalDateTime (-> Date), all REQUIRED. These four round-trip a
        // const value cleanly on every engine. A time-only value sits on
        // 1970-01-01.
        const lt  = new Date(Date.UTC(1970, 0, 1, 17, 0, 0))
        const ldt = new Date(Date.UTC(2024, 0, 14, 12, 30, 0))
        const expected = { lt, ldt, clt: lt, cldt: ldt }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFromNoTable()
            .select({
                lt:   ctx.conn.const(lt, 'localTime'),
                ldt:  ctx.conn.const(ldt, 'localDateTime'),
                clt:  ctx.conn.const<Date, 'CutoffClock'>(lt, 'customLocalTime', 'CutoffClock'),
                cldt: ctx.conn.const<Date, 'SignOffStamp'>(ldt, 'customLocalDateTime', 'SignOffStamp'),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::time as lt, $2::timestamp as ldt, $3 as clt, $4 as cldt"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "17:00:00",
            "2024-01-14T12:30:00.000Z",
            "17:00:00",
            "2024-01-14T12:30:00.000Z",
          ]
        `)
        assertType<Exact<typeof row, {
            lt: Date; ldt: Date; clt: Date; cldt: Date
        }>>()
        expect(row).toEqual(expected)
    })
})
