// Documentation snippets for the Booleans and three-valued logic page (docs/dynamic/optional-parts/three-valued-booleans.md).
//
// tIssueWorklog.billable is an optional boolean column: worklog 1 is true, worklog 2 is false and worklog 3 is null.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssueWorklog, tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:three-valued-booleans/is-null-safe', async () => {
        const expected = [{ id: 3, title: 'Migrate to ESM' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const assigneeId: number | null = null

        const issues = sync(connection.selectFrom(tIssue)
            .where(tIssue.assigneeId.is(assigneeId))
            .select({
                id: tIssue.id,
                title: tIssue.title
            })
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where assignee_id is ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
          ]
        `)
        assertType<Exact<typeof issues, Array<{ id: number; title: string }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:three-valued-booleans/result-type', async () => {
        const expected = [
            { id: 1, isTheFirstIssue: true, assignedToTheFirstWithEquals: true, assignedToTheFirstWithIs: true },
            { id: 2, isTheFirstIssue: false, assignedToTheFirstWithEquals: false, assignedToTheFirstWithIs: false },
            { id: 3, isTheFirstIssue: false, assignedToTheFirstWithIs: false },
            { id: 4, isTheFirstIssue: false, assignedToTheFirstWithEquals: false, assignedToTheFirstWithIs: false },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const issues = sync(connection.selectFrom(tIssue)
            .select({
                id: tIssue.id,
                isTheFirstIssue: tIssue.id.equals(1),
                assignedToTheFirstWithEquals: tIssue.assigneeId.equals(1),
                assignedToTheFirstWithIs: tIssue.assigneeId.is(1)
            })
            .orderBy('id')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, id = ?1 as isTheFirstIssue, assignee_id = ?2 as assignedToTheFirstWithEquals, assignee_id is ?3 as assignedToTheFirstWithIs from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            1,
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            id: number
            isTheFirstIssue: boolean
            assignedToTheFirstWithEquals?: boolean
            assignedToTheFirstWithIs: boolean
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs-extra:three-valued-booleans/condition-results', async () => {
        // The tables of results: what each condition answers on each row.
        const expected = [
            { id: 1, equalsOne: true, notEqualsOne: false, negated: false, isOne: true, isNotOne: false, isNullValue: false, isNotNullValue: true, withDefault: true },
            { id: 2, equalsOne: false, notEqualsOne: true, negated: true, isOne: false, isNotOne: true, isNullValue: false, isNotNullValue: true, withDefault: false },
            { id: 3, isOne: false, isNotOne: true, isNullValue: true, isNotNullValue: false, withDefault: false },
            { id: 4, equalsOne: false, notEqualsOne: true, negated: true, isOne: false, isNotOne: true, isNullValue: false, isNotNullValue: true, withDefault: false },
        ]
        ctx.mockNext(expected)

        const issues = sync(ctx.conn.selectFrom(tIssue)
            .select({
                id:             tIssue.id,
                equalsOne:      tIssue.assigneeId.equals(1),
                notEqualsOne:   tIssue.assigneeId.notEquals(1),
                negated:        tIssue.assigneeId.equals(1).negate(),
                isOne:          tIssue.assigneeId.is(1),
                isNotOne:       tIssue.assigneeId.isNot(1),
                isNullValue:    tIssue.assigneeId.is(null),
                isNotNullValue: tIssue.assigneeId.isNot(null),
                withDefault:    tIssue.assigneeId.equals(1).valueWhenNull(false),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, assignee_id = ?1 as equalsOne, assignee_id <> ?2 as notEqualsOne, not (assignee_id = ?3) as negated, assignee_id is ?4 as isOne, assignee_id is not ?5 as isNotOne, assignee_id is ?6 as isNullValue, assignee_id is not ?7 as isNotNullValue, ifnull(assignee_id = ?8, ?9) as withDefault from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            1,
            1,
            1,
            null,
            null,
            1,
            false,
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            id:             number
            equalsOne?:     boolean
            notEqualsOne?:  boolean
            negated?:       boolean
            isOne:          boolean
            isNotOne:       boolean
            isNullValue:    boolean
            isNotNullValue: boolean
            withDefault:    boolean
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs-extra:three-valued-booleans/filter-leaves-out-null', async () => {
        // notEquals and negate discard the row whose assignee is null; an or of a condition and its opposite too.
        const expected = [{ id: 2 }, { id: 4 }]
        ctx.mockNext(expected)
        const withNotEquals = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.assigneeId.notEquals(1))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where assignee_id <> ?1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof withNotEquals, Array<{ id: number }>>>()
        expect(withNotEquals).toEqual(expected)

        ctx.mockNext(expected)
        const withNegate = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.assigneeId.equals(1).negate())
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where not (assignee_id = ?1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof withNegate, Array<{ id: number }>>>()
        expect(withNegate).toEqual(expected)

        const expectedOr = [{ id: 1 }, { id: 2 }, { id: 4 }]
        ctx.mockNext(expectedOr)
        const withOr = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.assigneeId.equals(1).or(tIssue.assigneeId.notEquals(1)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where assignee_id = ?1 or assignee_id <> ?2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof withOr, Array<{ id: number }>>>()
        expect(withOr).toEqual(expectedOr)
    })

    test('docs-extra:three-valued-booleans/truth-tables', async () => {
        // Every combination of true, false and null in and, or and negate.
        const expected = [
            { idA: 1, idB: 1, andResult: true, orResult: true, notResult: false },
            { idA: 1, idB: 2, andResult: false, orResult: true, notResult: false },
            { idA: 1, idB: 3, orResult: true, notResult: false },
            { idA: 2, idB: 1, andResult: false, orResult: true, notResult: true },
            { idA: 2, idB: 2, andResult: false, orResult: false, notResult: true },
            { idA: 2, idB: 3, andResult: false, notResult: true },
            { idA: 3, idB: 1, orResult: true },
            { idA: 3, idB: 2, andResult: false },
            { idA: 3, idB: 3 },
        ]
        ctx.mockNext(expected)
        const other = tIssueWorklog.as('other')

        const combinations = sync(ctx.conn.selectFrom(tIssueWorklog)
            .join(other).on(other.id.greaterThan(0))
            .select({
                idA:       tIssueWorklog.id,
                idB:       other.id,
                andResult: tIssueWorklog.billable.and(other.billable),
                orResult:  tIssueWorklog.billable.or(other.billable),
                notResult: tIssueWorklog.billable.negate(),
            })
            .orderBy('idA')
            .orderBy('idB')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue_worklog.id as idA, other.id as idB, issue_worklog.billable and other.billable as andResult, issue_worklog.billable or other.billable as orResult, not issue_worklog.billable as notResult from issue_worklog join issue_worklog as other on other.id > ?1 order by idA, idB"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof combinations, Array<{
            idA:        number
            idB:        number
            andResult?: boolean
            orResult?:  boolean
            notResult?: boolean
        }>>>()
        expect(combinations).toEqual(expected)
    })

    test('docs-extra:three-valued-booleans/optional-boolean-as-condition', async () => {
        // An optional boolean column keeps true on its own and false when negated; null is in neither.
        const expectedTrue = [{ id: 1 }]
        ctx.mockNext(expectedTrue)
        const whenTrue = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable)
            .select({ id: tIssueWorklog.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billable"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof whenTrue, Array<{ id: number }>>>()
        expect(whenTrue).toEqual(expectedTrue)

        const expectedFalse = [{ id: 2 }]
        ctx.mockNext(expectedFalse)
        const whenFalse = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.negate())
            .select({ id: tIssueWorklog.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where not billable"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof whenFalse, Array<{ id: number }>>>()
        expect(whenFalse).toEqual(expectedFalse)
    })

    test('docs:three-valued-booleans/optional-columns-compared', async () => {
        const expected = [
            { id: 1, isItsOwnAssignee: true },
            { id: 2, isItsOwnAssignee: true },
            { id: 3 },
            { id: 4, isItsOwnAssignee: false },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const issues = sync(connection.selectFrom(tIssue)
            .select({
                id: tIssue.id,
                isItsOwnAssignee: tIssue.id.equals(tIssue.assigneeId)
            })
            .orderBy('id')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, id = assignee_id as isItsOwnAssignee from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{ id: number; isItsOwnAssignee?: boolean }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:three-valued-booleans/optional-const', async () => {
        const expected: Array<{ id: number; title: string }> = []
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const assigneeId: number | null = null

        const issues = sync(connection.selectFrom(tIssue)
            .where(tIssue.assigneeId.equals(connection.optionalConst(assigneeId, 'int')))
            .select({
                id: tIssue.id,
                title: tIssue.title
            })
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where assignee_id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
          ]
        `)
        assertType<Exact<typeof issues, Array<{ id: number; title: string }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:three-valued-booleans/not-in-subquery', async () => {
        const expected = [{ id: 4, title: 'Document /v2/users' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const assignees = connection.selectFrom(tIssue)
            .where(tIssue.assigneeId.isNotNull())
            .selectOneColumn(tIssue.assigneeId)

        const issues = sync(connection.selectFrom(tIssue)
            .where(tIssue.id.notIn(assignees))
            .select({
                id: tIssue.id,
                title: tIssue.title
            })
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where id not in (select assignee_id as result from issue where assignee_id is not null)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{ id: number; title: string }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs-extra:three-valued-booleans/not-in-subquery-with-null', async () => {
        // Without leaving the nulls out of the subquery, notIn returns no rows.
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)

        const issues = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.notIn(ctx.conn.selectFrom(tIssue).selectOneColumn(tIssue.assigneeId)))
            .select({ id: tIssue.id })
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where id not in (select assignee_id as result from issue)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{ id: number }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs-extra:three-valued-booleans/is-not', async () => {
        // Null-safe too: the null row differs from false, and false differs from null.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)

        const worklogs = sync(ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.isNot(false))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billable is not ?1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            false,
          ]
        `)
        assertType<Exact<typeof worklogs, Array<{ id: number }>>>()
        expect(worklogs).toEqual(expected)
    })

    test('docs-extra:three-valued-booleans/equals-result-optional-type', async () => {
        // equals and notEquals are null on the null row.
        const expected = [
            { id: 1, isBillable: true, isNotBillable: false },
            { id: 2, isBillable: false, isNotBillable: true },
            { id: 3 },
        ]
        ctx.mockNext(expected)

        const worklogs = sync(ctx.conn.selectFrom(tIssueWorklog)
            .select({
                id:            tIssueWorklog.id,
                isBillable:    tIssueWorklog.billable.equals(true),
                isNotBillable: tIssueWorklog.billable.notEquals(true),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billable = ?1 as isBillable, billable <> ?2 as isNotBillable from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
            true,
          ]
        `)
        assertType<Exact<typeof worklogs, Array<{ id: number; isBillable?: boolean; isNotBillable?: boolean }>>>()
        expect(worklogs).toEqual(expected)
    })

    test('docs-extra:three-valued-booleans/is-result-definite-type', async () => {
        // is and isNot are a definite boolean on every row, the null row included.
        const expected = [
            { id: 1, isBillable: true, isNotBillable: false, hasNoValue: false, hasValue: true },
            { id: 2, isBillable: false, isNotBillable: true, hasNoValue: false, hasValue: true },
            { id: 3, isBillable: false, isNotBillable: true, hasNoValue: true, hasValue: false },
        ]
        ctx.mockNext(expected)

        const worklogs = sync(ctx.conn.selectFrom(tIssueWorklog)
            .select({
                id:            tIssueWorklog.id,
                isBillable:    tIssueWorklog.billable.is(true),
                isNotBillable: tIssueWorklog.billable.isNot(true),
                hasNoValue:    tIssueWorklog.billable.is(null),
                hasValue:      tIssueWorklog.billable.isNot(undefined),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billable is ?1 as isBillable, billable is not ?2 as isNotBillable, billable is ?3 as hasNoValue, billable is not ?4 as hasValue from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
            true,
            null,
            null,
          ]
        `)
        assertType<Exact<typeof worklogs, Array<{
            id:            number
            isBillable:    boolean
            isNotBillable: boolean
            hasNoValue:    boolean
            hasValue:      boolean
        }>>>()
        expect(worklogs).toEqual(expected)
    })

    test('docs:three-valued-booleans/equals-present', async () => {
        const expected = [{ id: 1, title: 'Update hero copy' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const assigneeId: number = 1

        const issues = sync(connection.selectFrom(tIssue)
            .where(tIssue.assigneeId.equals(assigneeId)) // assigneeId can't be null or undefined here
            .select({
                id: tIssue.id,
                title: tIssue.title
            })
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where assignee_id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof issues, Array<{ id: number; title: string }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:three-valued-booleans/equals-if-value-omitted', async () => {
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
            { id: 4, title: 'Document /v2/users' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        // It comes from the request and may be absent: absent means "don't filter by it"
        const assigneeId: number | null | undefined = undefined

        const issues = sync(connection.selectFrom(tIssue)
            .where(tIssue.assigneeId.equalsIfValue(assigneeId))
            .select({
                id: tIssue.id,
                title: tIssue.title
            })
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{ id: number; title: string }>>>()
        expect(issues.toSorted((a, b) => a.id - b.id)).toEqual(expected)
    })

    test('docs:three-valued-booleans/false-when-no-value', async () => {
        const expected: Array<{ id: number; title: string }> = []
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const assigneeId: number | null | undefined = undefined

        const issues = sync(connection.selectFrom(tIssue)
            .where(tIssue.assigneeId.equalsIfValue(assigneeId).falseWhenNoValue())
            .select({
                id: tIssue.id,
                title: tIssue.title
            })
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where 0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{ id: number; title: string }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs-extra:three-valued-booleans/optional-column-type', async () => {
        const expected = [
            { id: 1, billable: true },
            { id: 2, billable: false },
            { id: 3 },
        ]
        ctx.mockNext(expected)

        const worklogs = sync(ctx.conn.selectFrom(tIssueWorklog)
            .select({ id: tIssueWorklog.id, billable: tIssueWorklog.billable })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billable as billable from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof worklogs, Array<{ id: number; billable?: boolean }>>>()
        expect(worklogs).toEqual(expected)
    })
})
