// Coverage of `fragmentWithType(...)` and `rawFragment` used in
// positions the docs page doesn't drill into:
//
//   - typed fragments in WHERE (boolean) and SELECT (int/string)
//   - typed fragments interpolating a value source (column)
//   - typed fragments interpolating a literal via `connection.const(...)`
//   - fragments composed inside other fragments
//   - raw fragments inside `customizeQuery` extension points beyond
//     the basic `afterSelectKeyword` / `afterQuery` pair
//
// Each fragment funnels through
// and lands on the dialect's `_appendRawFragment` /
// `_appendFragmentWithType` (or equivalent) — the snapshots are the
// authoritative SQL the lib emits, so a per-dialect render
// difference shows up immediately.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tAppUser, tProjectRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('fragment-as-where-with-bound-value', async () => {
        // A typed boolean fragment in WHERE — the interpolated value
        // (a literal via `connection.const(...)`) is bound, not
        // string-spliced. The snapshot proves the placeholder shape.
        ctx.mockNext([{ id: 1 }])
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(connection.fragmentWithType('boolean', 'required')
                .sql`${tIssue.id} = ${connection.const(1, 'int')}`)
            .select({ id: tIssue.id })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('fragment-in-select-with-column-arg', async () => {
        // A `length(...)` fragment in the projection list. `length`
        // is portable across every dialect — that's why the docs
        // page uses it.
        const expected = [{ id: 1, len: 16 }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                len: connection.fragmentWithType('int', 'required')
                    .sql`len(${tIssue.title})`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, len(title) as len from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; len: number }>>>()
        expect(result).toEqual(expected)
    })

    test('fragment-optional-flag-widens-result', async () => {
        // The same `length(...)` fragment with `'optional'` widens the
        // projected property to `len?: number`. The SQL is identical,
        // only the result type narrows differently.
        ctx.mockNext([{ id: 1, len: 16 }])
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                len: connection.fragmentWithType('int', 'optional')
                    .sql`len(${tIssue.title})`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, len(title) as len from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; len?: number }>>>()
    })

    test('fragment-as-string-projection-with-column', async () => {
        // A `lower(...)` fragment returning a string — proves the
        // `'string'` overload routes through the same builder and
        // surfaces a plain `string` result column.
        const expected = [{ id: 1, em: 'ada@acme.test' }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tAppUser)
            .where(tAppUser.id.equals(1))
            .select({
                id: tAppUser.id,
                em: connection.fragmentWithType('string', 'required')
                    .sql`lower(${tAppUser.email})`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, lower(email) as em from app_user where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; em: string }>>>()
        expect(result).toEqual(expected)
    })

    test('fragment-composed-inside-another-fragment', async () => {
        // Build a typed fragment, then embed it as a sub-expression
        // inside another typed fragment. Confirms fragments are
        // first-class value sources and compose without escaping.
        const expected = [{ id: 1, doubled: 32 }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const inner = connection.fragmentWithType('int', 'required')
            .sql`len(${tIssue.title})`
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:      tIssue.id,
                doubled: connection.fragmentWithType('int', 'required')
                    .sql`${inner} + ${inner}`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, len(title) + len(title) as doubled from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; doubled: number }>>>()
        expect(result).toEqual(expected)
    })

    test('raw-fragment-as-orderBy-extension', async () => {
        // `beforeOrderByItems` is documented to splice the raw
        // fragment as an additional `order by` item, comma-joined
        // against the explicit items — so the fragment is expected
        // to render *as an item* (e.g. another column with a
        // direction), not as a free-form prefix. The SQL builder
        // also injects the table name to keep the reference clear
        // of the projection alias.
        ctx.mockNext([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }])
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy('id')
            .customizeQuery({
                beforeOrderByItems: connection.rawFragment`${tIssue.priority} desc`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by issue.priority desc, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('fragment-mixes-literal-and-column-interpolations', async () => {
        // A typed fragment that interpolates both a literal (bound)
        // and a column (rendered inline) in the same expression. The
        // snapshot shows the placeholder shape (`?`/`$1`/`:1`/`@1`)
        // sitting between the two column references.
        ctx.mockNext([{ id: 1, padded: 12 }])
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:     tIssue.id,
                padded: connection.fragmentWithType('int', 'required')
                    .sql`${tIssue.priority} + ${connection.const(10, 'int')}`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority + @0 as padded from issue where id = @1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            10,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; padded: number }>>>()
    })
    test('aggregate-fragment-with-type-as-inline-aggregate-in-projection', async () => {
        // `aggregateFragmentWithType(...)` is the aggregate counterpart of
        // `fragmentWithType(...)`: the value it produces is MARKED as an
        // aggregate, so it's accepted in `select({...})` / `having` /
        // `orderBy` and rejected by the compiler in `where` / `groupBy` /
        // join `on` (the rejection is locked by types.negative/select.ts).
        // Here it computes the total priority weight per project with a
        // one-off inline `sum(...)`, grouped by project. Seed: project 1 ->
        // issues 1,2 (priority 2+1=3), project 2 -> issue 3 (3), project 3 ->
        // issue 4 (2).
        const expected = [
            { projectId: 1, totalWeight: 3 },
            { projectId: 2, totalWeight: 3 },
            { projectId: 3, totalWeight: 2 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .groupBy(tIssue.projectId)
            .select({
                projectId:   tIssue.projectId,
                totalWeight: connection.aggregateFragmentWithType('int', 'required')
                    .sql`sum(${tIssue.priority})`,
            })
            .orderBy('projectId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, sum(priority) as totalWeight from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ projectId: number; totalWeight: number }>>>()
        expect(result).toEqual(expected)
    })
    test('fragment-with-type-bigint-required-and-optional', async () => {
        // The `bigint` return-type arm of `fragmentWithType`, in both the
        // 'required' and 'optional' forms — same emitted SQL, the optional flag
        // only widens the result type. view_count is 0 -> abs(0) = 0n.
        const expected = [{ id: 1, b: 0n, ob: 0n }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                b:  connection.fragmentWithType('bigint', 'required').sql`abs(${tIssue.viewCount})`,
                ob: connection.fragmentWithType('bigint', 'optional').sql`abs(${tIssue.viewCount})`,
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, abs(view_count) as [b], abs(view_count) as ob from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; b: bigint; ob?: bigint }>>>()
        expect(result).toEqual(expected)
    })

    test('fragment-with-type-uuid-and-custom-comparable', async () => {
        // The `uuid` arm (-> string leaf) and the `customComparable` arm
        // (-> string leaf, carrying the 'Semver' TYPE_NAME). The uuid fragment
        // coalesces release 1's signing key; the comparable fragment surfaces
        // its version.
        const REF1 = '0a8f9c1e-1111-4222-8333-444455556666'
        const expected = [{ u: REF1, v: '1.2.0' }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                u: connection.fragmentWithType('uuid', 'required')
                    .sql`coalesce(${tProjectRelease.signingKey}, ${tProjectRelease.signingKey})`,
                v: connection.fragmentWithType<string, 'Semver'>('customComparable', 'Semver', 'required')
                    .sql`${tProjectRelease.version}`,
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select coalesce(signing_key, signing_key) as [u], version as [v] from project_release where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ u: string; v: string }>>>()
        expect(result).toEqual(expected)
    })

    test('aggregate-fragment-with-type-bigint-and-optional-arms', async () => {
        // `aggregateFragmentWithType` for a `bigint` return family and an
        // 'optional' arm. `max(view_count)` is a bigint aggregate (0n);
        // `max(priority)` is an optional int aggregate (3). One row (no group by).
        const expected = { mx: 0n, omx: 3 }
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .select({
                mx:  connection.aggregateFragmentWithType('bigint', 'required').sql`max(${tIssue.viewCount})`,
                omx: connection.aggregateFragmentWithType('int', 'optional').sql`max(${tIssue.priority})`,
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(view_count) as mx, max(priority) as omx from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, { mx: bigint; omx?: number }>>()
        expect(result).toEqual(expected)
    })

    test('raw-fragment-with-many-interpolations', async () => {
        // `rawFragment` with four interpolated value sources spliced as
        // order-by items — the RawFragment carries the widened source union;
        // the emitted SQL pins the rendering.
        ctx.mockNext([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }])
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy('id')
            .customizeQuery({
                beforeOrderByItems: connection.rawFragment`${tIssue.priority} desc, ${tIssue.status} asc, ${tIssue.projectId} asc, ${tIssue.number} desc`,
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by issue.priority desc, issue.status asc, issue.project_id asc, issue.number desc, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })
    test('custom-typed-fragment-then-operator', async () => {
        // A `customInt` typed fragment is a first-class value source —
        // applying `.add(...)` keeps the customInt brand. `IssueId` is
        // marshalled to int, so it surfaces a clean number. Issue 1 priority
        // 2 -> priority + 1 = 3.
        const expected = [{ id: 1, n: 3 }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                n:  connection.fragmentWithType<number, 'IssueId'>('customInt', 'IssueId', 'required')
                        .sql`${tIssue.priority}`.add(1),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (priority) + @0 as [n] from issue where id = @1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; n: number }>>>()
        expect(result).toEqual(expected)
    })
})
