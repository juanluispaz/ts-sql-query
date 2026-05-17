// Documentation snippets for the Dynamic queries page
// (docs/queries/dynamic-queries.md). Demonstrates the `*IfValue` helpers
// (omit a predicate when the value is null/undefined/empty) and
// `dynamicBooleanExpressionUsing` for builder-style composition.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:dynamic-queries/with-equals-if-value', async () => {
        const expected = [
            { id: 1, title: 'Update hero copy', status: 'open' },
            { id: 3, title: 'Migrate to ESM',   status: 'open' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const filterStatus: string | null = 'open'
        const filterPriority: number | null = null

        const issues = await connection.selectFrom(tIssue)
            .where(tIssue.status.equalsIfValue(filterStatus))
              .and(tIssue.priority.equalsIfValue(filterPriority))
            .select({
                id:     tIssue.id,
                title:  tIssue.title,
                status: tIssue.status,
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, status as status from issue where status = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            id:     number
            title:  string
            status: string
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:dynamic-queries/builder-style', async () => {
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const titleContains: string | null = null
        const statusIs: string | null = 'open'

        let where = connection.dynamicBooleanExpressionUsing(tIssue)
        if (titleContains) {
            where = where.and(tIssue.title.contains(titleContains))
        }
        if (statusIs) {
            where = where.and(tIssue.status.equals(statusIs))
        }

        const issues = await connection.selectFrom(tIssue)
            .where(where)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where status = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            id:    number
            title: string
        }>>>()
        expect(issues).toEqual(expected)
    })
})
