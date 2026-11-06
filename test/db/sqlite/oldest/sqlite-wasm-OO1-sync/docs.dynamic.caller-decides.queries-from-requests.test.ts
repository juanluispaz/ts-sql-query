// The examples of docs/dynamic/caller-decides/queries-from-requests.md: the rows the caller may see are decided by the code,
// and the condition, the order and the page come from a request.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DynamicCondition } from '../../../../../src/dynamic/condition.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

type IssueFilter = DynamicCondition<{
    title: 'string',
    status: 'string',
    priority: 'int'
}>

interface IssueRequest {
    filter?: IssueFilter,
    order?: string,
    limit?: number,
    offset?: number
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    const filterableFields = () => ({ title: tIssue.title, status: tIssue.status, priority: tIssue.priority })

    function getIssueTable(projectOfTheUser: number, request: IssueRequest) {
        const connection = ctx.conn
        // doc-start
        return sync(connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(projectOfTheUser))
            .and(connection.dynamicConditionFor(filterableFields()).withValues(request.filter ?? {}))
            .select({
                id: tIssue.id,
                title: tIssue.title,
            })
            .orderByFromStringIfValue(request.order)
            .orderBy('id')
            .limit(Math.min(request.limit ?? 20, 2))
            .offsetIfValue(request.offset)
            .executeSelectPage())
        // doc-end
    }

    test('docs:queries-from-requests/table-in-a-user-interface', async () => {
        const expected = [{ id: 1, title: 'Update hero copy' }]
        ctx.mockNext(expected)
        ctx.mockNext(1)
        const page = await getIssueTable(1, {
            filter: JSON.parse('{"title":{"startsWith":"Update hero"},"status":{"contains":""}}'),
            order: 'title asc',
            limit: 5000,
        })
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) from issue where project_id = ?1 and title like (?2 || '%') escape '\\'"`)
        assertType<Exact<typeof page, { data: Array<{ id: number; title: string }>; count: number }>>()
        expect(page.data).toEqual(expected)
        expect(page.count).toBe(1)
    })

    test('docs:queries-from-requests/a-filter-can-not-see-outside-of-the-code-conditions', async () => {
        ctx.mockNext([])
        ctx.mockNext(0)
        const page = await getIssueTable(-1, { filter: JSON.parse('{"or":[{"title":{"isNotNull":true}},{"title":{"isNull":true}}]}') })
        expect(page.data).toEqual([])
        expect(page.count).toBe(0)
    })

    test('docs:queries-from-requests/a-dto-with-nulls', async () => {
        const expected = [{ id: 1, title: 'Update hero copy' }]
        ctx.mockNext(expected)
        ctx.mockNext(1)
        const page = await getIssueTable(1, {
            filter: JSON.parse('{"title":{"startsWith":"Update hero","contains":null,"in":null},"status":null,"priority":{"equals":null}}'),
        })
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) from issue where project_id = ?1 and title like (?2 || '%') escape '\\'"`)
        expect(page.data).toEqual(expected)
    })

    test('docs-extra:queries-from-requests/errors-of-the-caller-reach-a-try', async () => {
        const reasonOf = async (request: IssueRequest) => {
            try {
                await getIssueTable(1, request)
                return undefined
            } catch (e) {
                return e instanceof TsSqlError ? e.errorReason.reason : undefined
            }
        }
        expect(await reasonOf({ filter: JSON.parse('{"nope":{"equals":1}}') })).toBe('DYNAMIC_CONDITION_UNKNOWN_COLUMN')
        expect(await reasonOf({ filter: JSON.parse('{"title":{"nope":1}}') })).toBe('DYNAMIC_CONDITION_UNKNOWN_OPERATION')
        expect(await reasonOf({ filter: JSON.parse('{"title":1}') })).toBe('DYNAMIC_CONDITION_INVALID_FILTER')
        expect(await reasonOf({ order: 'nope' })).toBe('ORDER_BY_COLUMN_NOT_IN_SELECT')
        expect(await reasonOf({ order: 'title nope' })).toBe('INVALID_ORDER_BY_ORDERING')
        expect(await reasonOf({ filter: JSON.parse('{"priority":{"equals":"x"}}') })).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })
})
