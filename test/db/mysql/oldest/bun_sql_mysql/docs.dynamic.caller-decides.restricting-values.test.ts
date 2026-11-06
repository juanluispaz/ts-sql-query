// Documentation snippets for the Restricting values page (docs/dynamic/caller-decides/restricting-values.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { dynamicPick } from '../../../../../src/dynamic/pick.js'
import { tIssue } from '../../domain/connection.js'
import { TsSqlError, TsSqlProcessingError, TsSqlQueryExecutionError } from '../../../../../src/TsSqlError.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:restricting-values/disallowed-http-handler', async () => {
        let statusCode = 200
        let responseBody = ''
        const res = {
            status(code: number) {
                statusCode = code
                return res
            },
            json<BODY>(body: BODY) {
                responseBody = JSON.stringify(body)
            },
        }
        const req = { body: { fields: { title: true, body: true } } }
        const connection = ctx.conn
        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
            body:  tIssue.body.allowWhen(false, "You don't have permission to see the body"),
        }

        async function handleRequest() {
            // doc-start
            try {
                const rows = await connection.selectFrom(tIssue)
                    .select(dynamicPick(availableFields, req.body.fields, ['id']))
                    .executeSelectMany()
                res.json(rows)
            } catch (e) {
                if (e instanceof TsSqlError && e.errorReason.reason === 'DISALLOWED') {
                    res.status(403).json({ error: e.errorReason.message })
                    return
                }
                throw e
            }
            // doc-end
        }

        await handleRequest()

        expect(statusCode).toBe(403)
        expect(responseBody).toMatchInlineSnapshot(`"{"error":"You don't have permission to see the body"}"`)
    })

    test('docs:restricting-values/allow-when-own-error', async () => {
        const connection = ctx.conn
        let caught: unknown = null

        // doc-start
        class NoPermissionError extends Error {}

        const canSeeBody = false

        const issues = connection.selectFrom(tIssue)
            .select({
                id:   tIssue.id,
                body: tIssue.body.allowWhen(canSeeBody, new NoPermissionError("You can't see the body")),
            })
            .executeSelectMany()

        await issues.catch((e) => {
            if (e instanceof NoPermissionError) {
                caught = e
            }
        })
        // doc-end

        expect(caught).toBeInstanceOf(NoPermissionError)
    })

    test('docs-extra:restricting-values/allow-when-text-arrives-wrapped', async () => {
        const connection = ctx.conn
        let caught: unknown = null

        await connection.selectFrom(tIssue)
            .select({
                id:   tIssue.id,
                body: tIssue.body.allowWhen(false, "You can't see the body"),
            })
            .executeSelectMany()
            .catch((e) => {
                caught = e
            })

        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        const error = caught as TsSqlQueryExecutionError
        expect(error.message).toBe("DISALLOWED: You can't see the body")
        expect(error.errorReason).toEqual({ reason: 'DISALLOWED', message: "You can't see the body", functionName: 'allowWhen' })
        expect(error.cause).toBeInstanceOf(TsSqlProcessingError)
    })

    test('docs-extra:restricting-values/filter-on-a-restricted-field', async () => {
        const connection = ctx.conn
        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
            body:  tIssue.body.allowWhen(false, "You can't see the body"),
        }

        const rejected = connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor(availableFields).withValues({ body: { contains: 'x' } }))
            .select({ id: tIssue.id })
            .executeSelectMany()
        await expect(rejected).rejects.toThrow('DISALLOWED')

        ctx.mockNext([])
        const allowed = await connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor(availableFields).withValues({ title: { contains: 'not in any title' } }))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(allowed).toEqual([])
    })

    test('docs:restricting-values/allow-when-not-picked', async () => {
        const expected = [{ id: 2, title: 'Redesign navbar', status: 'in_progress' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const bodyVisible = false

        const availableFields = {
            id:     tIssue.id,
            title:  tIssue.title,
            status: tIssue.status,
            body:   tIssue.body.allowWhen(bodyVisible, "You don't have permission to see the body"),
        }

        const fieldsToPick = {
            title:  true,
            status: true,
        }

        // always include id field as required
        const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

        const issues = await connection.selectFrom(tIssue)
            .select(pickedFields)
            .where(tIssue.id.equals(2))
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, \`status\` as \`status\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            id:      number
            title?:  string
            status?: string
            body?:   string
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:restricting-values/allow-when-picked-throws', async () => {
        const connection = ctx.conn
        const bodyVisible = false

        const availableFields = {
            id:     tIssue.id,
            title:  tIssue.title,
            status: tIssue.status,
            body:   tIssue.body.allowWhen(bodyVisible, "You don't have permission to see the body"),
        }

        // doc-start
        const fieldsToPick = {
            title:  true,
            status: true,
            body:   true,
        }
        // doc-end

        const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

        let caught: unknown = null
        try {
            await connection.selectFrom(tIssue)
                .select(pickedFields)
                .where(tIssue.id.equals(2))
                .executeSelectMany()
        } catch (e) {
            caught = e
        }

        expect(caught).not.toBeNull()
        expect(String(caught)).toContain("You don't have permission to see the body")
    })

    test('docs-extra:restricting-values/disallow-when-picked-throws', async () => {
        const connection = ctx.conn

        // disallowWhen is the boolean-inverted twin of allowWhen.
        const bodyHidden = true

        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
            body:  tIssue.body.disallowWhen(bodyHidden, 'body hidden'),
        }

        const pickedFields = dynamicPick(availableFields, { body: true }, ['id'])

        let caught: unknown = null
        try {
            await connection.selectFrom(tIssue)
                .select(pickedFields)
                .orderBy('id')
                .executeSelectMany()
        } catch (e) {
            caught = e
        }

        expect(caught).not.toBeNull()
        expect(String(caught)).toContain('body hidden')
    })
})
