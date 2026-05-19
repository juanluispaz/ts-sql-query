// Coverage of the non-literal branch of `_escapeLikeWildcard` in every
// SqlBuilder. The literal-string branch is exercised by every existing
// `.contains('foo')` / `.startsWith('foo')` test; this file uses a
// value source (a column) as the like-argument so the builder takes the
// triple-`replace(...)` runtime escape branch instead of the
// compile-time literal escape.
//
// Each dialect picks a different shape — SQLite/PostgreSQL stitch the
// `replace(...)` chain with `||`, MySQL/MariaDB use `concat(...)`,
// SqlServer uses `+`, Oracle drops the `escape` clause.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('contains-column-argument', async () => {
        // body LIKE '%' || replace(replace(replace(title, …)) || '%'
        // — the runtime-escape branch. The body column is the search
        // haystack, the title column is the needle.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.body.contains(tIssue.title))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where "body" like ('%' || replace(replace(replace(title, '[', '[[]'), '%', '[%]'), '_', '[]') || '%') escape '\\' order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('starts-with-column-argument', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.body.startsWith(tIssue.title))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where "body" like (replace(replace(replace(title, '[', '[[]'), '%', '[%]'), '_', '[]') || '%') escape '\\' order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('ends-with-column-argument', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.body.endsWith(tIssue.title))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where "body" like ('%' || replace(replace(replace(title, '[', '[[]'), '%', '[%]'), '_', '[]')) escape '\\' order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('like-column-argument', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.body.like(tIssue.title))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where "body" like title escape '\\' order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })
})
