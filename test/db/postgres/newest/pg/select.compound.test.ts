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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select name as label from project union select title as label from issue order by label"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as label from issue where status = $1 union all select status as label from issue where status = $2"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue where status = $1 intersect select status as status from issue where id <= $2"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue except select status as status from issue where id <= $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ status: string }>>>()
        expect(result).toEqual(expected)
    })
    test('union-with-insensitive-order-by', async () => {
        // TODO[BUG]: a union ordered by `.orderBy(alias, 'asc insensitive')`
        // emits `order by lower(label)`, which PostgreSQL rejects in a
        // compound ORDER BY ("only result column names can be used"). See
        // test/BUGS.md. The test pins the emitted SQL; it can't run on the
        // real engine until the lib emits portable SQL here.
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
        // tests-audit-disable-next-line mock-only -- TODO[BUG] (see test/BUGS.md): PostgreSQL rejects expressions in a UNION ORDER BY; only the emitted SQL can be validated
        if (ctx.realDbEnabled) return
        const result = await ctx.conn.selectFrom(tProject)
            .select({ label: tProject.name })
            .union(ctx.conn.selectFrom(tIssue).select({ label: tIssue.title }))
            .orderBy('label', 'asc insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select name as label from project union select title as label from issue order by lower(label) asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

})
