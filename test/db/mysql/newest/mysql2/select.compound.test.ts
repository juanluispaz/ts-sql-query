// Behavioral coverage of compound queries: UNION, UNION ALL, INTERSECT.
// Two select queries combined into one result set.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('union', async () => {
        // Names from projects + titles from issues, in one stream.
        const expected = [
            { label: 'Document /v2/users' },
            { label: 'Internal tools' },
            { label: 'Legacy app' },
            { label: 'Marketing site' },
            { label: 'Migrate to ESM' },
            { label: 'Public API' },
            { label: 'Redesign navbar' },
            { label: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const projectsQ = ctx.conn.selectFrom(tProject)
            .select({ label: tProject.name })
        const issuesQ = ctx.conn.selectFrom(tIssue)
            .select({ label: tIssue.title })
        const result = await projectsQ
            .union(issuesQ)
            .orderBy('label')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by label"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('union-all-preserves-duplicates', async () => {
        const expected = [
            { label: 'open' },
            { label: 'open' },
            { label: 'open' },
            { label: 'open' },
        ]
        ctx.mockNext(expected)
        const part = () => ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ label: tIssue.status })
        const result = await part()
            .unionAll(part())
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`status\` as label from issue where \`status\` = ? union all select \`status\` as label from issue where \`status\` = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "open",
          ]
        `)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('intersect', async () => {
        // status values appearing in both opened-issues and id<=2-issues:
        // both sets contain 'open' (id 1 has status open and is ≤ 2).
        const expected = [{ status: 'open' }]
        ctx.mockNext(expected)
        const left = ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ status: tIssue.status })
        const right = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.lessOrEqual(2))
            .select({ status: tIssue.status })
        const result = await left.intersect(right).executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`status\` as \`status\` from issue where \`status\` = ? intersect select \`status\` as \`status\` from issue where id <= ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ status: string }>>>()
        expect(result).toEqual(expected)
    })

    test('except', async () => {
        // statuses present in issues but NOT under id <= 2.
        // id<=2 contains: open (id=1), in_progress (id=2)
        // all issues: open (1), in_progress (2), open (3), closed (4)
        // except → { closed }
        const expected = [{ status: 'closed' }]
        ctx.mockNext(expected)
        const all = ctx.conn.selectFrom(tIssue)
            .select({ status: tIssue.status })
        const small = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.lessOrEqual(2))
            .select({ status: tIssue.status })
        const result = await all.except(small).executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`status\` as \`status\` from issue except select \`status\` as \`status\` from issue where id <= ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ status: string }>>>()
        expect(result).toEqual(expected)
    })
    test('union-with-insensitive-order-by', async () => {
        // Compound (union) ordered case-insensitively. A compound's ORDER
        // BY may reference only result-column names / ordinal positions
        // (no expressions), so the builder wraps the whole compound in
        // `select * from (...)` and applies `lower(...)` on the plain wrapper.
        const expected = [
            { label: 'Document /v2/users' },
            { label: 'Internal tools' },
            { label: 'Legacy app' },
            { label: 'Marketing site' },
            { label: 'Migrate to ESM' },
            { label: 'Public API' },
            { label: 'Redesign navbar' },
            { label: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const projectsQ = ctx.conn.selectFrom(tProject)
            .select({ label: tProject.name })
        const issuesQ = ctx.conn.selectFrom(tIssue)
            .select({ label: tIssue.title })
        const result = await projectsQ
            .union(issuesQ)
            .orderBy('label', 'asc insensitive')
            .executeSelectMany()
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by lower(label) asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })


    test('compound-order-by-desc', async () => {
        // `orderBy('label', 'desc')` on a compound — the enum-mode overload with
        // the simple `desc` mode, rendered INLINE through the compound (distinct
        // from the `'asc insensitive'` case, which wraps the compound in
        // `select * from (...)`). All 8 union labels are distinct, so descending
        // order is deterministic.
        const expected = [
            { label: 'Update hero copy' },
            { label: 'Redesign navbar' },
            { label: 'Public API' },
            { label: 'Migrate to ESM' },
            { label: 'Marketing site' },
            { label: 'Legacy app' },
            { label: 'Internal tools' },
            { label: 'Document /v2/users' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .select({ label: tProject.name })
            .union(ctx.conn.selectFrom(tIssue).select({ label: tIssue.title }))
            .orderBy('label', 'desc')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by label desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('compound-order-by-asc-nulls-first', async () => {
        // `orderBy('label', 'asc nulls first')` on a compound. No label is null,
        // so the result is a plain ascending order; the mode is pinned by the
        // snapshot (native `asc nulls first` on PostgreSQL, plain `asc` on the
        // dialects where ASC already sorts NULLs first).
        const expected = [
            { label: 'Document /v2/users' },
            { label: 'Internal tools' },
            { label: 'Legacy app' },
            { label: 'Marketing site' },
            { label: 'Migrate to ESM' },
            { label: 'Public API' },
            { label: 'Redesign navbar' },
            { label: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .select({ label: tProject.name })
            .union(ctx.conn.selectFrom(tIssue).select({ label: tIssue.title }))
            .orderBy('label', 'asc nulls first')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by label asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('compound-order-by-desc-nulls-last', async () => {
        // `orderBy('label', 'desc nulls last')` on a compound. No label is null,
        // so the result is a plain descending order; the snapshot pins the mode
        // (native `desc nulls last` on PostgreSQL, plain `desc` on the dialects
        // where DESC already sorts NULLs last).
        const expected = [
            { label: 'Update hero copy' },
            { label: 'Redesign navbar' },
            { label: 'Public API' },
            { label: 'Migrate to ESM' },
            { label: 'Marketing site' },
            { label: 'Legacy app' },
            { label: 'Internal tools' },
            { label: 'Document /v2/users' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .select({ label: tProject.name })
            .union(ctx.conn.selectFrom(tIssue).select({ label: tIssue.title }))
            .orderBy('label', 'desc nulls last')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by label desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('compound-order-by-asc-nulls-last', async () => {
        // `orderBy('label', 'asc nulls last')` on a compound. No label is null,
        // so the result is a plain ascending order; the snapshot pins the mode
        // (native `asc nulls last` on PostgreSQL; the `is null` / `iif` NULLs
        // emulation on the dialects without native NULLS ordering, applied to the
        // compound's output column).
        const expected = [
            { label: 'Document /v2/users' },
            { label: 'Internal tools' },
            { label: 'Legacy app' },
            { label: 'Marketing site' },
            { label: 'Migrate to ESM' },
            { label: 'Public API' },
            { label: 'Redesign navbar' },
            { label: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .select({ label: tProject.name })
            .union(ctx.conn.selectFrom(tIssue).select({ label: tIssue.title }))
            .orderBy('label', 'asc nulls last')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by label is null, label asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('compound-order-by-desc-nulls-first', async () => {
        // `orderBy('label', 'desc nulls first')` on a compound. No label is null,
        // so the result is a plain descending order; the snapshot pins the mode
        // (native `desc nulls first` on PostgreSQL; the `is not null` / `iif`
        // NULLs emulation on the dialects without native NULLS ordering).
        const expected = [
            { label: 'Update hero copy' },
            { label: 'Redesign navbar' },
            { label: 'Public API' },
            { label: 'Migrate to ESM' },
            { label: 'Marketing site' },
            { label: 'Legacy app' },
            { label: 'Internal tools' },
            { label: 'Document /v2/users' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .select({ label: tProject.name })
            .union(ctx.conn.selectFrom(tIssue).select({ label: tIssue.title }))
            .orderBy('label', 'desc nulls first')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by label is not null, label desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('compound-with-optional-seed-column-yields-optional-result', async () => {
        // the compound result optionality is decided by the SEED (first)
        // query. Here the seed projects the optional column `archivedAt`, so
        // the merged column stays optional (`a?`) — distinct from every other
        // compound test, which seeds a required column. Both branches filter to
        // the NULL-archivedAt projects so the union dedups to a single absent
        // value (project 4's archived_at is a non-deterministic
        // CURRENT_TIMESTAMP, so it is excluded).
        const expected = [{}]
        ctx.mockNext(expected)
        const optSeed = ctx.conn.selectFrom(tProject)
            .where(tProject.archivedAt.isNull())
            .select({ a: tProject.archivedAt })
        const other = ctx.conn.selectFrom(tProject)
            .where(tProject.archivedAt.isNull())
            .select({ a: tProject.archivedAt })
        const result = await optSeed.union(other).executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select archived_at as \`a\` from project where archived_at is null union select archived_at as \`a\` from project where archived_at is null"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ a?: Date | undefined }>>>()
        expect(result).toEqual(expected)
    })

    test('chained-compound-three-way-union', async () => {
        // A second compound chained onto the first: `a.union(b).union(c)`. The
        // RESULT type and the compound FEATURES carry through the 2nd compound.
        // Three single-column queries unioned: project 1 'Marketing site',
        // issue 1 'Update hero copy', issue 2 'Redesign navbar'.
        const expected = [
            { label: 'Marketing site' },
            { label: 'Redesign navbar' },
            { label: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const a = ctx.conn.selectFrom(tProject).where(tProject.id.equals(1)).select({ label: tProject.name })
        const b = ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ label: tIssue.title })
        const c = ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ label: tIssue.title })
        const result = await a.union(b).union(c).orderBy('label').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project where id = ? union select title as label from issue where id = ? union select title as label from issue where id = ? order by label"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('chained-compound-union-then-union-all', async () => {
        // A mixed chain: `a.union(b).unionAll(c)`. The first compound dedups
        // (union), the second appends a duplicate (union all), proving the
        // chained compound preserves the second op's set semantics. project 1
        // 'Marketing site', issue 1 'Update hero copy', issue 1 again
        // 'Update hero copy' (the union-all duplicate survives).
        const expected = [
            { label: 'Marketing site' },
            { label: 'Update hero copy' },
            { label: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const a = ctx.conn.selectFrom(tProject).where(tProject.id.equals(1)).select({ label: tProject.name })
        const b = ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ label: tIssue.title })
        const c = ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ label: tIssue.title })
        const result = await a.union(b).unionAll(c).orderBy('label').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project where id = ? union select title as label from issue where id = ? union all select title as label from issue where id = ? order by label"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })
    test('compound-order-by-from-string', async () => {
        // `orderByFromString('label')` on a compound — the dynamic-string ORDER BY
        // entry. A compound's ORDER BY references the result-column name.
        const expected = [
            { label: 'Document /v2/users' },
            { label: 'Internal tools' },
            { label: 'Legacy app' },
            { label: 'Marketing site' },
            { label: 'Migrate to ESM' },
            { label: 'Public API' },
            { label: 'Redesign navbar' },
            { label: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .select({ label: tProject.name })
            .union(ctx.conn.selectFrom(tIssue).select({ label: tIssue.title }))
            .orderByFromString('label')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by label"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('compound-order-by-from-string-if-value', async () => {
        // `orderByFromStringIfValue('label')` on a compound — present value
        // emits the ORDER BY; an absent value (null/undefined/'') is the no-op
        // branch, leaving the compound unordered. Both arms are exercised.
        const expected = [
            { label: 'Document /v2/users' },
            { label: 'Internal tools' },
            { label: 'Legacy app' },
            { label: 'Marketing site' },
            { label: 'Migrate to ESM' },
            { label: 'Public API' },
            { label: 'Redesign navbar' },
            { label: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .select({ label: tProject.name })
            .union(ctx.conn.selectFrom(tIssue).select({ label: tIssue.title }))
            .orderByFromStringIfValue('label')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by label"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)

        // No-op branch: an undefined order-by string leaves the compound unordered.
        ctx.mockNext(expected)
        await ctx.conn.selectFrom(tProject)
            .select({ label: tProject.name })
            .union(ctx.conn.selectFrom(tIssue).select({ label: tIssue.title }))
            .orderByFromStringIfValue(undefined)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('compound-order-by-from-string-array', async () => {
        // `orderByFromStringArray(['label desc'])` on a compound — the array
        // form joins its entries into the ORDER BY list. Single descending key.
        const expected = [
            { label: 'Update hero copy' },
            { label: 'Redesign navbar' },
            { label: 'Public API' },
            { label: 'Migrate to ESM' },
            { label: 'Marketing site' },
            { label: 'Legacy app' },
            { label: 'Internal tools' },
            { label: 'Document /v2/users' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .select({ label: tProject.name })
            .union(ctx.conn.selectFrom(tIssue).select({ label: tIssue.title }))
            .orderByFromStringArray(['label desc'])
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by label desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('compound-order-by-from-string-array-if-value', async () => {
        // `orderByFromStringArrayIfValue([...])` on a compound — present entries
        // emit; a fully-absent array is the no-op branch. Both arms exercised.
        const expected = [
            { label: 'Document /v2/users' },
            { label: 'Internal tools' },
            { label: 'Legacy app' },
            { label: 'Marketing site' },
            { label: 'Migrate to ESM' },
            { label: 'Public API' },
            { label: 'Redesign navbar' },
            { label: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .select({ label: tProject.name })
            .union(ctx.conn.selectFrom(tIssue).select({ label: tIssue.title }))
            .orderByFromStringArrayIfValue(['label'])
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by label"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)

        // No-op branch: an array of only absent entries leaves it unordered.
        ctx.mockNext(expected)
        await ctx.conn.selectFrom(tProject)
            .select({ label: tProject.name })
            .union(ctx.conn.selectFrom(tIssue).select({ label: tIssue.title }))
            .orderByFromStringArrayIfValue([undefined, null])
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('compound-order-by-raw-fragment', async () => {
        // `orderBy(rawFragment)` on a compound. A bare
        // `rawFragment\`1\`` emits the ordinal `order by 1`, a portable way to
        // order a compound by its first result column (`label`, ascending).
        const expected = [
            { label: 'Document /v2/users' },
            { label: 'Internal tools' },
            { label: 'Legacy app' },
            { label: 'Marketing site' },
            { label: 'Migrate to ESM' },
            { label: 'Public API' },
            { label: 'Redesign navbar' },
            { label: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .select({ label: tProject.name })
            .union(ctx.conn.selectFrom(tIssue).select({ label: tIssue.title }))
            .orderBy(ctx.conn.rawFragment`1`)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('compound-order-by-value-source-secondary', async () => {
        // `orderBy(valueSource)` on a compound — the no-table-required ValueSource
        // overload. A compound can only order by result columns / no-table expressions, so
        // the value source is exercised as a benign constant secondary key after
        // a primary `orderBy('label')`; the result stays deterministic (label asc)
        // while the second ORDER BY item pins the overload's emission.
        const expected = [
            { label: 'Document /v2/users' },
            { label: 'Internal tools' },
            { label: 'Legacy app' },
            { label: 'Marketing site' },
            { label: 'Migrate to ESM' },
            { label: 'Public API' },
            { label: 'Redesign navbar' },
            { label: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .select({ label: tProject.name })
            .union(ctx.conn.selectFrom(tIssue).select({ label: tIssue.title }))
            .orderBy('label')
            .orderBy(ctx.conn.const(1, 'int'))
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by label, ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('compound-with-limit-and-offset', async () => {
        // `.limit(...).offset(...)` chained after a compound. Union of project
        // names + issue titles, ordered by label; offset 3 + limit 2 picks rows
        // 4-5 ('Marketing site', 'Migrate to ESM').
        const expected = [{ label: 'Marketing site' }, { label: 'Migrate to ESM' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject).select({ label: tProject.name })
            .union(ctx.conn.selectFrom(tIssue).select({ label: tIssue.title }))
            .orderBy('label')
            .limit(2)
            .offset(3)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by label limit ? offset ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('compound-with-limit-if-value-and-offset-if-value', async () => {
        // `.limitIfValue(...).offsetIfValue(...)` chained after a compound; with
        // present values both clauses emit. Same paged union → rows 4-5.
        const expected = [{ label: 'Marketing site' }, { label: 'Migrate to ESM' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject).select({ label: tProject.name })
            .union(ctx.conn.selectFrom(tIssue).select({ label: tIssue.title }))
            .orderBy('label')
            .limitIfValue(2)
            .offsetIfValue(3)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by label limit ? offset ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('union-with-remaining-insensitive-order-by-modes', async () => {
        // The compound-wrap insensitive path beyond `'asc insensitive'`
        // (covered by union-with-insensitive-order-by above). Each of the
        // other six insensitive OrderByMode values wraps the compound in
        // `select * from (...) as o_1_` and applies `lower(...)` with its own
        // suffix. None of the 8 union labels is null, so the nulls-first /
        // nulls-last permutations sort identically to plain asc / desc; only
        // the emitted suffix differs (pinned per cell by the snapshots).
        const ascOrder = [
            { label: 'Document /v2/users' },
            { label: 'Internal tools' },
            { label: 'Legacy app' },
            { label: 'Marketing site' },
            { label: 'Migrate to ESM' },
            { label: 'Public API' },
            { label: 'Redesign navbar' },
            { label: 'Update hero copy' },
        ]
        const descOrder = [...ascOrder].reverse()
        const compound = () => ctx.conn.selectFrom(tProject)
            .select({ label: tProject.name })
            .union(ctx.conn.selectFrom(tIssue).select({ label: tIssue.title }))

        // 'insensitive' — bare (defaults to ascending).
        ctx.mockNext(ascOrder)
        const r1 = await compound().orderBy('label', 'insensitive').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by lower(label)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof r1, Array<{ label: string }>>>()
        expect(r1).toEqual(ascOrder)

        // 'desc insensitive'
        ctx.mockNext(descOrder)
        const r2 = await compound().orderBy('label', 'desc insensitive').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by lower(label) desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(r2).toEqual(descOrder)

        // 'asc nulls first insensitive'
        ctx.mockNext(ascOrder)
        const r3 = await compound().orderBy('label', 'asc nulls first insensitive').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by lower(label) asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(r3).toEqual(ascOrder)

        // 'asc nulls last insensitive'
        ctx.mockNext(ascOrder)
        const r4 = await compound().orderBy('label', 'asc nulls last insensitive').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by label is null, label asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(r4).toEqual(ascOrder)

        // 'desc nulls first insensitive'
        ctx.mockNext(descOrder)
        const r5 = await compound().orderBy('label', 'desc nulls first insensitive').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by label is not null, label desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(r5).toEqual(descOrder)

        // 'desc nulls last insensitive'
        ctx.mockNext(descOrder)
        const r6 = await compound().orderBy('label', 'desc nulls last insensitive').executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project union select title as label from issue order by lower(label) desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(r6).toEqual(descOrder)
    })

    test('compound-arm-parenthesized-by-its-own-limit', async () => {
        // A compound ARM that carries its own `limit` is wrapped in parentheses
        // so the operator binds the limited arm, not the whole compound:
        // `left.limit(2).union(right)` -> `(select … limit $1) union …`. The left
        // arm filters to project 1 (one row, 'Marketing site'); the limit keeps
        // it. The right arm filters to issue 1 ('Update hero copy'). The outer
        // ORDER BY makes the union deterministic.
        const expected = [{ label: 'Marketing site' }, { label: 'Update hero copy' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ label: tProject.name })
            .limit(2)
            .union(
                ctx.conn.selectFrom(tIssue)
                    .where(tIssue.id.equals(1))
                    .select({ label: tIssue.title }),
            )
            .orderBy('label')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"(select \`name\` as label from project where id = ? limit ?) union select title as label from issue where id = ? order by label"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('compound-arm-parenthesized-by-its-own-order-by-and-limit', async () => {
        // The RIGHT arm carries its own `orderBy` + `limit`, so it is
        // parenthesized: `left.unionAll(right.orderBy('label').limit(3))` ->
        // `… union all (select … order by label limit $1)`. The right arm is
        // project 1's two issues sorted by title, capped at 3 (both survive);
        // the left arm is project 1 ('Marketing site'). The outer ORDER BY makes
        // the union all deterministic.
        const expected = [
            { label: 'Marketing site' },
            { label: 'Redesign navbar' },
            { label: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ label: tProject.name })
            .unionAll(
                ctx.conn.selectFrom(tIssue)
                    .where(tIssue.projectId.equals(1))
                    .select({ label: tIssue.title })
                    .orderBy('label')
                    .limit(3),
            )
            .orderBy('label')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`name\` as label from project where id = ? union all (select title as label from issue where project_id = ? order by label limit ?) order by label"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

})
