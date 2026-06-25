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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as label from issue where status = ? union all select status as label from issue where status = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue where status = ? intersect select status as status from issue where id <= ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ status: string }>>>()
        expect(result.map(r => r.status).sort()).toEqual(['open'])
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue except select status as status from issue where id <= ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ status: string }>>>()
        expect(result.map(r => r.status).sort()).toEqual(['closed'])
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select * from (select name as label from project union select title as label from issue) as o_1_ order by lower(label) asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })


    test('compound-with-optional-seed-column-yields-optional-result', async () => {
        // D4: the compound result optionality is decided by the SEED (first)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select archived_at as "a" from project where archived_at is null union select archived_at as "a" from project where archived_at is null"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ a?: Date | undefined }>>>()
        expect(result).toEqual(expected)
    })
})
