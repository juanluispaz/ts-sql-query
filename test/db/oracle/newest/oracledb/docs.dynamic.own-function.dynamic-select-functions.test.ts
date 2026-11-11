// Documentation snippets for the Functions that return a dynamic select page (docs/dynamic/own-function/dynamic-select-functions.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { type DynamicCondition, type DynamicConditionForModel } from '../../../../../src/dynamic/condition.js'
import { dynamicPickPaths, expandTypeFromDynamicPickPaths, type DynamicPickPaths, type PickValuesPath } from '../../../../../src/dynamic/pick.js'
import { tAppUser, tIssue, type DBConnection } from '../../domain/connection.js'
import type { OrderByForModel } from '../../../../../src/dynamic/orderBy.js'
import { type DeepPick, type DeepPickPaths } from '../../../../../src/extras/deepUtilities.js'
import { fromRef, type TableOrViewLeftJoinOf } from '../../../../../src/extras/types.js'
import { ctx } from './setup.js'

function insertChildIssue(assigneeId: number) {
    return ctx.conn.insertInto(tIssue)
        .set({ projectId: 1, number: 50, title: 'Child issue', status: 'open', priority: 1, parentId: 1, assigneeId })
        .returningLastInsertedId()
        .executeInsert()
}

function buildIssueAvailableFields<ASSIGNEE extends TableOrViewLeftJoinOf<typeof tAppUser, 'assignee'>>(_connection: DBConnection, assigneeRef: ASSIGNEE) {
    const assignee = fromRef(tAppUser, assigneeRef)
    return {
        id:    tIssue.id,
        title: tIssue.title,
        assignee: {
            id:   assignee.id,
            name: assignee.fullName.concat(' ').concat(assignee.email),
        },
    }
}

interface UserRules {
    anyUserNameContains?: string
    anyUserCreatedAt?: Date
}

function buildIssueConditionExtension<ASSIGNEE extends TableOrViewLeftJoinOf<typeof tAppUser, 'assignee'>>(connection: DBConnection, assigneeRef: ASSIGNEE) {
    const assignee = fromRef(tAppUser, assigneeRef)
    return {
        users: (rules: UserRules) => {
            let result = connection.dynamicBooleanExpressionUsing(tIssue)
            if (rules.anyUserNameContains) {
                const query = connection.subSelectUsing(tIssue)
                    .from(tAppUser)
                    .where(tAppUser.fullName.concat(' ').concat(tAppUser.email).containsInsensitive(rules.anyUserNameContains))
                    .selectOneColumn(tAppUser.id)
                result = result.and(connection.exists(query))
            }
            if (rules.anyUserCreatedAt) {
                const query = connection.subSelectUsing(tIssue)
                    .from(tAppUser)
                    .where(tAppUser.createdAt.equals(rules.anyUserCreatedAt))
                    .selectOneColumn(tAppUser.id)
                result = result.and(connection.exists(query))
            }
            return result
        },
        assignee: {
            isInAnotherIssueWithTitle: (title: string) => {
                const query = connection.selectFrom(tIssue)
                    .where(tIssue.title.containsInsensitive(title))
                    .selectOneColumn(tIssue.assigneeId)
                return assignee.id.in(query)
            },
        },
    }
}

type IssueFields = DynamicPickPaths<ReturnType<typeof buildIssueAvailableFields>, 'id'>

type IssueDynamicCondition = DynamicCondition<ReturnType<typeof buildIssueAvailableFields>, ReturnType<typeof buildIssueConditionExtension>>

type IssueInformation<FIELDS extends IssueFields> = PickValuesPath<ReturnType<typeof buildIssueAvailableFields>, FIELDS | 'id'>

async function getSubissues<FIELDS extends IssueFields>(connection: DBConnection, parentIssueId: number, fields: FIELDS[], condition: IssueDynamicCondition, orderBy?: OrderByForModel<IssueInformation<IssueFields>>[]): Promise<IssueInformation<FIELDS>[]> {
    const assignee = tAppUser.forUseInLeftJoinAs('assignee')
    const availableFields = buildIssueAvailableFields(connection, assignee)
    const conditionExtension = buildIssueConditionExtension(connection, assignee)
    const dynamicCondition = connection.dynamicConditionFor(availableFields, conditionExtension).withValues(condition)
    const selectedFields = dynamicPickPaths(availableFields, fields, ['id'])
    const issues = await connection
        .selectFrom(tIssue)
        .optionalLeftOuterJoin(assignee).on(tIssue.assigneeId.equals(assignee.id))
        .where(dynamicCondition)
        .and(tIssue.parentId.equals(parentIssueId))
        .select(selectedFields)
        .orderByFromStringIfValue(orderBy?.join(', '))
        .executeSelectMany()
    return expandTypeFromDynamicPickPaths(availableFields, fields, issues, ['id'])
}

interface IssueInformationModel {
    id: number
    title: string
    assignee?: {
        id: number
        name: string
    }
}

async function getSubissuesFromModel<FIELDS extends DeepPickPaths<IssueInformationModel>>(connection: DBConnection, parentIssueId: number, fields: FIELDS[], condition: DynamicConditionForModel<IssueInformationModel>, orderBy?: OrderByForModel<IssueInformationModel>[]): Promise<DeepPick<IssueInformationModel, FIELDS | 'id'>[]> {
    const assignee = tAppUser.forUseInLeftJoinAs('assignee')
    const availableFields = {
        id:    tIssue.id,
        title: tIssue.title,
        assignee: {
            id:   assignee.id,
            name: assignee.fullName.concat(' ').concat(assignee.email),
        },
    }
    const dynamicCondition = connection.dynamicConditionFor(availableFields).withValues(condition)
    const selectedFields = dynamicPickPaths(availableFields, fields, ['id'])
    const issues = await connection
        .selectFrom(tIssue)
        .optionalLeftOuterJoin(assignee).on(tIssue.assigneeId.equals(assignee.id))
        .where(dynamicCondition)
        .and(tIssue.parentId.equals(parentIssueId))
        .select(selectedFields)
        .orderByFromStringIfValue(orderBy?.join(', '))
        .executeSelectMany()
    return expandTypeFromDynamicPickPaths(availableFields, fields, issues, ['id'])
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:dynamic-select-functions/full-dynamic-from-database-1', async () => {
        ctx.mockNext(50)
        ctx.mockNext([{ id: 50, title: 'Child issue' }])

        await ctx.withRollback(async () => {
            const childId = await insertChildIssue(2)

            // doc-start
            const issueId = 1
            const result = await getSubissues(ctx.conn, issueId, ['title'], {
                title: { containsInsensitive: 'CHILD' },
            })
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title as "title" from issue where lower(title) like lower('%' || :0 || '%') escape '\\' and parent_id = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "CHILD",
                1,
              ]
            `)
            assertType<Exact<typeof result, Array<{
                id:    number
                title: string
            }>>>()
            expect(result).toEqual([{ id: childId, title: 'Child issue' }])
        })
    })

    test('docs:dynamic-select-functions/full-dynamic-from-database-2', async () => {
        ctx.mockNext(50)
        ctx.mockNext([{ 'id': 50, 'title': 'Child issue', 'assignee.name': 'Grace Hopper grace@acme.test' }])

        await ctx.withRollback(async () => {
            const childId = await insertChildIssue(2)

            // doc-start
            const issueId = 1
            const result = await getSubissues(ctx.conn, issueId, ['title', 'assignee.name'], {
                users: { anyUserNameContains: 'lovelace' },
            })
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "id", issue.title as "title", case when assignee.full_name is null or assignee.email is null then null else assignee.full_name || :0 || assignee.email end as "assignee.name" from issue left outer join app_user assignee on issue.assignee_id = assignee.id where exists(select id as "result" from app_user where lower(full_name || :1 || email) like lower('%' || :2 || '%') escape '\\') and issue.parent_id = :3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " ",
                " ",
                "lovelace",
                1,
              ]
            `)
            assertType<Exact<typeof result, Array<{
                id:    number
                title: string
                assignee?: {
                    name: string
                }
            }>>>()
            expect(result).toEqual([{
                id:       childId,
                title:    'Child issue',
                assignee: { name: 'Grace Hopper grace@acme.test' },
            }])
        })
    })

    test('docs:dynamic-select-functions/full-dynamic-from-database-3', async () => {
        // Seeded issue 1 is assigned to user 1, the assignee of the child too.
        ctx.mockNext(50)
        ctx.mockNext([{ id: 50, title: 'Child issue' }])

        await ctx.withRollback(async () => {
            const childId = await insertChildIssue(1)

            // doc-start
            const issueId = 1
            const result = await getSubissues(ctx.conn, issueId, ['title'], {
                assignee: { isInAnotherIssueWithTitle: 'Update hero' },
            })
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "id", issue.title as "title" from issue left outer join app_user assignee on issue.assignee_id = assignee.id where assignee.id in (select assignee_id as "result" from issue where lower(title) like lower('%' || :0 || '%') escape '\\') and issue.parent_id = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Update hero",
                1,
              ]
            `)
            assertType<Exact<typeof result, Array<{
                id:    number
                title: string
            }>>>()
            expect(result).toEqual([{ id: childId, title: 'Child issue' }])
        })
    })

    test('docs:dynamic-select-functions/full-dynamic-from-database-4', async () => {
        ctx.mockNext(50)
        ctx.mockNext([{ id: 50, title: 'Child issue' }])

        await ctx.withRollback(async () => {
            const childId = await insertChildIssue(2)

            // doc-start
            const issueId = 1
            const result = await getSubissues(ctx.conn, issueId, ['title'], {
                or: [
                    { users: { anyUserNameContains: 'Ada' } },
                    { users: { anyUserCreatedAt: new Date('2000-03-01') } },
                ],
            })
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title as "title" from issue where (exists(select id as "result" from app_user where lower(full_name || :0 || email) like lower('%' || :1 || '%') escape '\\') or exists(select id as "result" from app_user where created_at = :2)) and parent_id = :3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " ",
                "Ada",
                2000-03-01T00:00:00.000Z,
                1,
              ]
            `)
            assertType<Exact<typeof result, Array<{
                id:    number
                title: string
            }>>>()
            expect(result).toEqual([{ id: childId, title: 'Child issue' }])
        })
    })

    test('docs:dynamic-select-functions/full-dynamic-from-model', async () => {
        ctx.mockNext(50)
        ctx.mockNext([{ 'id': 50, 'title': 'Child issue', 'assignee.name': 'Grace Hopper grace@acme.test' }])

        await ctx.withRollback(async () => {
            const childId = await insertChildIssue(2)

            // doc-start
            const result = await getSubissuesFromModel(ctx.conn, 1, ['title', 'assignee.name'],
                { title: { containsInsensitive: 'CHILD' } },
                ['assignee.name asc nulls last', 'title desc'])
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "id", issue.title as "title", case when assignee.full_name is null or assignee.email is null then null else assignee.full_name || :0 || assignee.email end as "assignee.name" from issue left outer join app_user assignee on issue.assignee_id = assignee.id where lower(issue.title) like lower('%' || :1 || '%') escape '\\' and issue.parent_id = :2 order by "assignee.name" asc nulls last, "title" desc"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " ",
                "CHILD",
                1,
              ]
            `)
            assertType<Exact<typeof result, Array<{
                id:    number
                title: string
                assignee?: {
                    name: string
                }
            }>>>()
            expect(result).toEqual([{
                id:       childId,
                title:    'Child issue',
                assignee: { name: 'Grace Hopper grace@acme.test' },
            }])
        })
    })
})
