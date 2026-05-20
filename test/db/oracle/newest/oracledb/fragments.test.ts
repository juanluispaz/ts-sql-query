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
// [src/queryBuilders/FragmentQueryBuilder.ts](../../../../../src/queryBuilders/FragmentQueryBuilder.ts)
// and lands on the dialect's `_appendRawFragment` /
// `_appendFragmentWithType` (or equivalent) — the snapshots are the
// authoritative SQL the lib emits, so a per-dialect render
// difference shows up immediately.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tAppUser } from '../../domain/connection.js'
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where id = :0"`)
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
                    .sql`length(${tIssue.title})`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", length(title) as "len" from issue where id = :0"`)
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
                    .sql`length(${tIssue.title})`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", length(title) as "len" from issue where id = :0"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", lower(email) as "em" from app_user where id = :0"`)
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
            .sql`length(${tIssue.title})`
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:      tIssue.id,
                doubled: connection.fragmentWithType('int', 'required')
                    .sql`${inner} + ${inner}`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", length(title) + length(title) as "doubled" from issue where id = :0"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue order by issue.priority desc, "id""`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", priority + :0 as "padded" from issue where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            10,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; padded: number }>>>()
    })
})
