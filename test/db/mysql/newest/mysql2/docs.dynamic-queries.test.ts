// Documentation snippets for the Dynamic queries page
// (docs/queries/dynamic-queries.md). Demonstrates the `*IfValue` helpers
// (omit a predicate when the value is null/undefined/empty) and
// `dynamicBooleanExpressionUsing` for builder-style composition.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, \`status\` as \`status\` from issue where \`status\` = ? order by id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where \`status\` = ? order by id"`)
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

    test('docs:dynamic-queries/only-when-or-null', async () => {
        // Section "Ignorable expression as null" — `onlyWhenOrNull(cond)`
        // keeps the expression in the SELECT when `cond` is true and
        // replaces it with `null` when false.
        const expected = { id: 1, title: 'Update hero copy', body: 'hidden' }
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const displayBody = true
        const issue = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
                body:  tIssue.body.onlyWhenOrNull(displayBody),
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, body as body from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof issue, {
            id:    number
            title: string
            body?: string
        }>>()
    })

    test('docs-extra:dynamic-queries/ignore-when-as-null', async () => {
        // Same section: `ignoreWhenAsNull(cond)` is the opposite of
        // `onlyWhenOrNull` — null when cond is true, value when false.
        ctx.mockNext({ id: 1, title: 'Update hero copy', body: undefined })
        const connection = ctx.conn

        const hide = true
        const issue = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
                body:  tIssue.body.ignoreWhenAsNull(hide),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, null as body from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof issue, {
            id:    number
            title: string
            body?: string
        }>>()
    })

    test('docs:dynamic-queries/optional-join', async () => {
        // Section "Optional joins" — `optionalJoin(other).on(...)` is
        // omitted from the final SQL when no column of `other` ends up
        // referenced (selected, used in a where, etc.). Here we pass a
        // null filter; the join must NOT be emitted.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
            { id: 4, title: 'Document /v2/users' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectName: string | null = null

        const issues = await connection.selectFrom(tIssue)
            .optionalJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .where(tProject.name.equalsIfValue(projectName))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{
            id:    number
            title: string
        }>>>()
        // With no filter on tProject and no select of its columns the
        // join must be elided: the emitted SQL does not include
        // "join project".
        expect(ctx.lastSql).not.toContain('join project')
    })
})
