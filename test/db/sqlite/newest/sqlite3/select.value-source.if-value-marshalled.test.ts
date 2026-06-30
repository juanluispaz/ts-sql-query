// The value-marshalled `*IfValue` arms. The `equalsIfValue`/`inIfValue`/
// `notInN`/compare-`*IfValue` dispatchers are already pinned on the int
// (`tIssue.id`/`tIssue.priority`) and string (`tIssue.status`) representatives
// in `select.value-source.null-and-if-value-modifiers.test.ts` and
// `select.value-source.if-value-negated-and-is.test.ts`. What those don't
// prove is that the SAME IfValue dispatcher carries the value-encoded leaves'
// observable param-encoding when the predicate FIRES — bigint, customInt,
// customDouble, uuid, customUuid, enum and the numeric-custom-boolean remap.
// The non-IfValue equality/comparison twins on these exact leaves are pinned
// in `select.value-source.equality-comparison-by-type.test.ts`; this file is
// the IfValue mirror, asserting both the FIRE half (a present value emits the
// marshalled param, identical SQL to the non-IfValue twin) and an ELIDE half
// (an `undefined`/empty value drops the clause, leaving only an anchoring
// `id > $1` predicate).
//
// Seed (from domain/seed.sql):
//   issue_worklog: durationMs 1=5400000, 2=NULL, 3=1800000;
//                  costCents  1=100, 2=100, 3=400;
//                  billedAmount 1=200, 2=50, 3=200;
//                  invoiced   1=true, 2=false, 3=true;
//                  activity   1=coding, 2=review, 3=meeting.
//   issue:         externalRef 1=0a8f9c1e-…, 2=7b3e9d20-…, 3,4=NULL.
//   project_release: signingKey 1=0a8f9c1e-…, 2=NULL, 3=7b3e9d20-…;
//                    version 1=1.2.0, 2=1.3.0-beta.1, 3=0.9.0.
//
// Every test filters in the WHERE with the `*IfValue`, projects the int
// primary key, and asserts `Array<{ id: number }>` + SQL + params + value,
// `.orderBy('id')`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tIssueWorklog, tProjectRelease } from '../../domain/connection.js'
import type { WorklogActivity } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // ------------------------------------------------------------------
    // bigint — tIssueWorklog.durationMs (optional bigint).
    // ------------------------------------------------------------------

    test('bigint-equals-if-value-fires-and-in-if-value-fires', async () => {
        // `equalsIfValue(5400000n)` fires → `duration_ms = $1` matches
        // worklog 1; `inIfValue([5400000n, 1800000n])` fires →
        // `duration_ms in ($1, $2)` matches worklogs 1 and 3. Both carry the
        // marshalled bigint params.
        const expectedEq = [{ id: 1 }]
        ctx.mockNext(expectedEq)
        const durEq: bigint | undefined = 5400000n
        const eqRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.equalsIfValue(durEq))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5400000,
          ]
        `)
        assertType<Exact<typeof eqRows, Array<{ id: number }>>>()
        expect(eqRows).toEqual(expectedEq)

        const expectedIn = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedIn)
        const durIn: bigint[] | undefined = [5400000n, 1800000n]
        const inRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.durationMs.inIfValue(durIn))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where duration_ms in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5400000,
            1800000,
          ]
        `)
        expect(inRows).toEqual(expectedIn)
    })

    test('bigint-equals-if-value-elides-on-undefined', async () => {
        // `equalsIfValue(undefined)` elides → the predicate is dropped, leaving
        // only the anchoring `id > $1` clause. All three worklogs (ids 1,2,3 >
        // 0) survive.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const durEq: bigint | undefined = undefined
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.greaterThan(0)
                .and(tIssueWorklog.durationMs.equalsIfValue(durEq)))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where id > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    // ------------------------------------------------------------------
    // customInt — tIssueWorklog.costCents ('Cents', required, marshalled int).
    // ------------------------------------------------------------------

    test('customInt-equals-if-value-fires', async () => {
        // `equalsIfValue(400)` fires → `cost_cents = $1` matches worklog 3; the
        // param carries the marshalled customInt value.
        const expected = [{ id: 3 }]
        ctx.mockNext(expected)
        const cost: number | undefined = 400
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.costCents.equalsIfValue(cost))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where cost_cents = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            400,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    // ------------------------------------------------------------------
    // customDouble — tIssueWorklog.billedAmount ('Money', required,
    // marshalled double).
    // ------------------------------------------------------------------

    test('customDouble-equals-if-value-fires', async () => {
        // `equalsIfValue(50)` fires → `billed_amount = $1` matches worklog 2;
        // the param carries the marshalled customDouble value.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const amount: number | undefined = 50
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billedAmount.equalsIfValue(amount))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billed_amount = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    // ------------------------------------------------------------------
    // uuid — tIssue.externalRef (optional uuid).
    // ------------------------------------------------------------------

    test('uuid-equals-if-value-fires', async () => {
        // `equalsIfValue(<issue-1 uuid>)` fires → `external_ref = $1` matches
        // issue 1; the param carries the marshalled uuid string.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const ref: string | undefined = '0a8f9c1e-1111-4222-8333-444455556666'
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.equalsIfValue(ref))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    // ------------------------------------------------------------------
    // customUuid — tProjectRelease.signingKey (optional customUuid 'SigningKey').
    // ------------------------------------------------------------------

    test('customUuid-equals-if-value-fires', async () => {
        // `equalsIfValue(<release-1 key>)` fires → `signing_key = $1` matches
        // release 1; the param carries the marshalled customUuid string.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const key: string | undefined = '0a8f9c1e-1111-4222-8333-444455556666'
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.equalsIfValue(key))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where signing_key = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    // ------------------------------------------------------------------
    // enum/custom — tIssueWorklog.activity ('WorklogActivity', required enum):
    //   worklog 1=coding, 2=review, 3=meeting.
    // ------------------------------------------------------------------

    test('enum-equals-if-value-fires-and-in-if-value-fires', async () => {
        // `equalsIfValue('coding')` fires → `activity = $1` matches worklog 1;
        // `inIfValue(['coding', 'meeting'])` fires → `activity in ($1, $2)`
        // matches worklogs 1 and 3. Both carry the marshalled enum params.
        const expectedEq = [{ id: 1 }]
        ctx.mockNext(expectedEq)
        const act: WorklogActivity | undefined = 'coding'
        const eqRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.equalsIfValue(act))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where activity = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "coding",
          ]
        `)
        assertType<Exact<typeof eqRows, Array<{ id: number }>>>()
        expect(eqRows).toEqual(expectedEq)

        const expectedIn = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedIn)
        const acts: WorklogActivity[] | undefined = ['coding', 'meeting']
        const inRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.activity.inIfValue(acts))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where activity in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "coding",
            "meeting",
          ]
        `)
        expect(inRows).toEqual(expectedIn)
    })

    // ------------------------------------------------------------------
    // numeric-custom-boolean — tIssueWorklog.invoiced (CustomBooleanTypeAdapter
    // 1/0): worklog 1=true, 2=false, 3=true. The remap emits `(invoiced = 1)`
    // around the column when the predicate fires, nothing when it elides.
    // ------------------------------------------------------------------

    test('numeric-custom-boolean-equals-if-value-fires', async () => {
        // `equalsIfValue(true)` fires → `(invoiced = 1) = $1` matches worklogs
        // 1 and 3. The remap-wrapped column is part of the fired predicate; the
        // boolean param rides through the IfValue dispatcher.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const flag: boolean | undefined = true
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.invoiced.equalsIfValue(flag))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where (invoiced = 1) = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('numeric-custom-boolean-equals-if-value-elides-on-undefined', async () => {
        // `equalsIfValue(undefined)` elides → the remap-wrapped predicate is
        // dropped entirely (no `(invoiced = 1)` in the SQL), leaving only the
        // anchoring `id > $1`. All three worklogs survive.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const flag: boolean | undefined = undefined
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.greaterThan(0)
                .and(tIssueWorklog.invoiced.equalsIfValue(flag)))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where id > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    // ------------------------------------------------------------------
    // compare-`*IfValue` on a non-int leaf — customComparable
    // tProjectRelease.version ('Semver', required): 1=1.2.0, 2=1.3.0-beta.1,
    // 3=0.9.0. customComparable is a ComparableValueSource, so the ordered
    // IfValue arms (`greaterOrEqualIfValue`/`lessThanIfValue`) apply.
    // ------------------------------------------------------------------

    test('customComparable-compare-if-value-fires-and-elides', async () => {
        // `greaterOrEqualIfValue('1.0.0')` fires → `version >= $1`; on the
        // seeded semver text that keeps releases 1 ('1.2.0') and 2
        // ('1.3.0-beta.1'); release 3 ('0.9.0') sorts below. The AND'd
        // `lessThanIfValue(undefined)` elides, so the emitted WHERE carries
        // only the fired `version >= $1` predicate.
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const lo: string | undefined = '1.0.0'
        const hi: string | undefined = undefined
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.greaterOrEqualIfValue(lo)
                .and(tProjectRelease.version.lessThanIfValue(hi)))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where version >= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.0.0",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    // ------------------------------------------------------------------
    // notInN on a non-int leaf — customComparable tProjectRelease.version.
    // `notInN(...vals)` is the variadic-rest overload of `notIn([...])`; on a
    // non-int leaf it carries the marshalled customComparable params.
    // ------------------------------------------------------------------

    test('customComparable-not-in-n-variadic-spread', async () => {
        // `version.notInN('1.2.0', '0.9.0')` excludes releases 1 and 3 → only
        // release 2 ('1.3.0-beta.1') survives. Same `not in ($1, $2)` SQL as
        // the array form, params carrying the marshalled semver strings.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.notInN('1.2.0', '0.9.0'))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where version not in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.2.0",
            "0.9.0",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })
})
