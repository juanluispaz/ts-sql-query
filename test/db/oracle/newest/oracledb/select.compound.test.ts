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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select name as "label" from project union select title as "label" from issue order by 1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as "label" from issue where status = :0 union all select status as "label" from issue where status = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "open",
          ]
        `)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })
})
