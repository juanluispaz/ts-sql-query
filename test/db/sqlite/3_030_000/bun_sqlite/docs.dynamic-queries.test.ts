// Documentation snippets for the Dynamic queries page (docs/queries/dynamic-queries.md): the `*IfValue`
// methods, the ignorable expressions and a condition that ends up empty.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { ctx } from './setup.js'

const byTitleDescending = (a: { title: string }, b: { title: string }) => b.title.localeCompare(a.title)

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:dynamic-queries/easy-dynamic-queries', async () => {
        const expected = [
            { id: 2, name: 'Internal tools tools' },
            { id: 1, name: 'Marketing site mktg-site' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const nameContains = 'te'
        const slugContains = null
        const archivedAtIs = null
        const searchOrderBy = 'name insensitive, archivedAt asc nulls last'

        const searchedProjects = await connection.selectFrom(tProject)
            .where(
                        tProject.name.containsIfValue(nameContains)
                    .or(tProject.slug.containsIfValue(slugContains))
                ).and(
                    tProject.archivedAt.equalsIfValue(archivedAtIs)
                )
            .select({
                id:         tProject.id,
                name:       tProject.name.concat(' ').concat(tProject.slug),
                archivedAt: tProject.archivedAt,
            })
            .orderByFromString(searchOrderBy)
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name || ?1 || slug as name, archived_at as archivedAt from project where name like ('%' || ?2 || '%') escape '\\' order by lower(name || ?1 || slug), archivedAt asc nulls last"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            " ",
            "te",
          ]
        `)
        assertType<Exact<typeof searchedProjects, Array<{
            id:          number
            name:        string
            archivedAt?: Date
        }>>>()
        expect(searchedProjects).toEqual(expected)
    })

    test('docs:dynamic-queries/only-when', async () => {
        const expected = [
            { title: 'Update hero copy', status: 'open' },
            { title: 'Redesign navbar',  status: 'in_progress', body: 'Use new tokens' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const userProjectId = 1
        const onlyIssuesOfUserProject = true

        const issues = await connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(userProjectId).onlyWhen(onlyIssuesOfUserProject))
            .select({
                title:  tIssue.title,
                status: tIssue.status,
                body:   tIssue.body,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as title, status as status, body as body from issue where project_id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            title:  string
            status: string
            body?:  string
        }>>>()
        // The query has no order by.
        expect([...issues].sort(byTitleDescending)).toEqual(expected)
    })

    test('docs:dynamic-queries/only-when-false', async () => {
        const expected = [
            { title: 'Update hero copy',   status: 'open' },
            { title: 'Redesign navbar',    status: 'in_progress', body: 'Use new tokens' },
            { title: 'Migrate to ESM',     status: 'open' },
            { title: 'Document /v2/users', status: 'closed', body: 'See ADR-014' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const userProjectId = 1
        const onlyIssuesOfUserProject = false // CHANGED

        const issues = await connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(userProjectId).onlyWhen(onlyIssuesOfUserProject))
            .select({
                title:  tIssue.title,
                status: tIssue.status,
                body:   tIssue.body,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as title, status as status, body as body from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{
            title:  string
            status: string
            body?:  string
        }>>>()
        // The query has no order by.
        expect([...issues].sort(byTitleDescending)).toEqual(expected)
    })

    test('docs:dynamic-queries/no-value-boolean', async () => {
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
            { id: 4, title: 'Document /v2/users' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const canSeeEveryProject: boolean = true
        const userProjectId = 1

        const issues = await connection.selectFrom(tIssue)
            .where(canSeeEveryProject ? connection.noValueBoolean() : tIssue.projectId.equals(userProjectId))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{
            id:    number
            title: string
        }>>>()
        // The query has no order by.
        expect([...issues].sort((a, b) => a.id - b.id)).toEqual(expected)
    })

    test('docs:dynamic-queries/only-when-or-null', async () => {
        const expected = { id: 2, title: 'Redesign navbar', status: 'in_progress', body: 'Use new tokens' }
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const issueId = 2
        const displayNames = true

        const issueWithRules = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(issueId))
            .select({
                id:     tIssue.id,
                title:  tIssue.title.onlyWhenOrNull(displayNames),
                status: tIssue.status.onlyWhenOrNull(displayNames),
                body:   tIssue.body,
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, status as status, body as body from issue where id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof issueWithRules, {
            id:      number
            title?:  string
            status?: string
            body?:   string
        }>>()
        expect(issueWithRules).toEqual(expected)
    })

    test('docs:dynamic-queries/only-when-or-null-false', async () => {
        const expected = { id: 2, body: 'Use new tokens' }
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const issueId = 2
        const displayNames = false // CHANGED

        const issueWithRules = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(issueId))
            .select({
                id:     tIssue.id,
                title:  tIssue.title.onlyWhenOrNull(displayNames),
                status: tIssue.status.onlyWhenOrNull(displayNames),
                body:   tIssue.body,
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, null as title, null as status, body as body from issue where id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof issueWithRules, {
            id:      number
            title?:  string
            status?: string
            body?:   string
        }>>()
        expect(issueWithRules).toEqual(expected)
    })

    test('docs-extra:dynamic-queries/ignore-when-as-null', async () => {
        // `ignoreWhenAsNull(cond)` is the opposite of `onlyWhenOrNull`: null when cond is true.
        const expected = { id: 2, title: 'Redesign navbar' }
        ctx.mockNext(expected)
        const connection = ctx.conn

        const hide = true
        const issue = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
                body:  tIssue.body.ignoreWhenAsNull(hide),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, null as body from issue where id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof issue, {
            id:    number
            title: string
            body?: string
        }>>()
        expect(issue).toEqual(expected)
    })

    test('docs:dynamic-queries/declarative', async () => {
        // Section "Declarative dynamic queries": no value, no where.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
            { id: 4, title: 'Document /v2/users' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectId: number | null = null

        const issues = await connection.selectFrom(tIssue)
            .where(tIssue.projectId.equalsIfValue(projectId))
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
        expect(issues).toEqual(expected)
    })

    test('docs:dynamic-queries/false-when-no-value', async () => {
        // Section "When there is no value": an empty list means no rows, not all of them.
        ctx.mockNext([])
        const connection = ctx.conn

        // doc-start
        const allowedProjectIds: number[] = []

        const issues = await connection.selectFrom(tIssue)
            .where(tIssue.projectId.inIfValue(allowedProjectIds).falseWhenNoValue())
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where 0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{
            id:    number
            title: string
        }>>>()
        expect(issues).toEqual([])
    })

    test('docs:dynamic-queries/value-when-no-value', async () => {
        // Section "When there is no value": the other condition takes its place.
        // Seed: the issues 1 and 3 are open.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const title: string | null = null

        const issues = await connection.selectFrom(tIssue)
            .where(
                tIssue.title.equalsIfValue(title)
                    .valueWhenNoValue(tIssue.status.equals('open'))
            )
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where status = ?1 order by id"`)
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

    test('docs:dynamic-queries/no-value-condition-in-the-select', async () => {
        // Section "When there is no value": with falseWhenNoValue the condition can be selected.
        // Seed: the issues 1 and 2 are of the project 1, the issues 3 and 4 aren't.
        const expected = [
            { id: 1, isInSearchedProject: true },
            { id: 2, isInSearchedProject: true },
            { id: 3, isInSearchedProject: false },
            { id: 4, isInSearchedProject: false },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const searchedProjectId: number | null = 1

        const issues = await connection.selectFrom(tIssue)
            .select({
                id:                  tIssue.id,
                isInSearchedProject: tIssue.projectId.equalsIfValue(searchedProjectId).falseWhenNoValue(),
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, project_id = ?1 as isInSearchedProject from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            id:                  number
            isInSearchedProject: boolean
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:dynamic-queries/ignore-when', async () => {
        // Section "Ignorable boolean expression": the restriction doesn't apply to an administrator.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
            { id: 4, title: 'Document /v2/users' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const userProjectId = 1
        const userIsAdmin = true

        const issues = await connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(userProjectId).ignoreWhen(userIsAdmin))
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
        expect(issues).toEqual(expected)
    })

    test('docs:dynamic-queries/missing-where', async () => {
        // Section "A condition that ends up empty": the rejection arrives through the promise,
        // and nothing reaches the database. The rollback protects the seed if the guard ever goes.
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            let reason: string | undefined

            // doc-start
            const issueId: number | null = null

            try {
                await connection.deleteFrom(tIssue)
                    .where(tIssue.id.equalsIfValue(issueId))
                    .executeDelete()
            } catch (e) {
                if (e instanceof TsSqlError && e.errorReason.reason === 'MISSING_WHERE') {
                    // Nothing was deleted, and no query was sent
                    reason = e.errorReason.reason
                }
            }
            // doc-end

            expect(reason).toBe('MISSING_WHERE')
            expect(ctx.lastNoTransactionSql).toBe('')
        })
    })
})
