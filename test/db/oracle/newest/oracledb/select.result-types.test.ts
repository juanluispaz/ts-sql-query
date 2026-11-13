// Each query the library builds goes with the columns of its result, read from the context of the query (getQueryContext): the key of the
// column in a row returned by the database, its path in the result, and the type name and type category its value
// is converted with, in the order of the select list. A query that returns no columns has none. They travel hidden in
// the params: they are not listed, nor sent to the database.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { type QueryResultColumn } from '../../../../../src/queryRunners/QueryRunner.js'
import { getQueryContext } from '../../../../../src/QueryContext.js'
import { tColMatrixOptional, tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

function resultColumns(params = ctx.lastParams): readonly QueryResultColumn[] | undefined {
    return getQueryContext(ctx.lastSql, params).resultColumns
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('result-types/an-object-with-every-type', async () => {
        const t = tColMatrixOptional
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(t)
            .where(t.id.equals(1))
            .select({
                id: t.id, mInt: t.mInt, mBigint: t.mBigint, mDouble: t.mDouble, mBool: t.mBool, mUuid: t.mUuid,
                mDate: t.mDate, mTime: t.mTime, mDatetime: t.mDatetime, mStr: t.mStr, cents: t.cents, money: t.money,
                signingKey: t.signingKey, semver: t.semver, channel: t.channel, releaseDay: t.releaseDay,
                cutoffClock: t.cutoffClock, signOff: t.signOff, activity: t.activity,
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", m_int as "mInt", m_bigint as "mBigint", m_double as "mDouble", m_bool as "mBool", raw_to_uuid(m_uuid) as "mUuid", m_date as "mDate", m_time as "mTime", m_datetime as "mDatetime", m_str as "mStr", m_int as "cents", m_double as "money", raw_to_uuid(m_uuid) as "signingKey", m_str as "semver", m_str as "channel", m_date as "releaseDay", m_time as "cutoffClock", m_datetime as "signOff", m_str as "activity" from col_matrix where id = :0"`)
        expect(resultColumns()).toMatchInlineSnapshot(`
          [
            {
              "name": "id",
              "path": "id",
              "type": "int",
              "typeCategory": "int",
            },
            {
              "name": "mInt",
              "path": "mInt",
              "type": "int",
              "typeCategory": "int",
            },
            {
              "name": "mBigint",
              "path": "mBigint",
              "type": "bigint",
              "typeCategory": "bigint",
            },
            {
              "name": "mDouble",
              "path": "mDouble",
              "type": "double",
              "typeCategory": "double",
            },
            {
              "name": "mBool",
              "path": "mBool",
              "type": "boolean",
              "typeCategory": "boolean",
            },
            {
              "name": "mUuid",
              "path": "mUuid",
              "type": "uuid",
              "typeCategory": "uuid",
            },
            {
              "name": "mDate",
              "path": "mDate",
              "type": "localDate",
              "typeCategory": "localDate",
            },
            {
              "name": "mTime",
              "path": "mTime",
              "type": "localTime",
              "typeCategory": "localTime",
            },
            {
              "name": "mDatetime",
              "path": "mDatetime",
              "type": "localDateTime",
              "typeCategory": "localDateTime",
            },
            {
              "name": "mStr",
              "path": "mStr",
              "type": "string",
              "typeCategory": "string",
            },
            {
              "name": "cents",
              "path": "cents",
              "type": "Cents",
              "typeCategory": "customInt",
            },
            {
              "name": "money",
              "path": "money",
              "type": "Money",
              "typeCategory": "customDouble",
            },
            {
              "name": "signingKey",
              "path": "signingKey",
              "type": "SigningKey",
              "typeCategory": "customUuid",
            },
            {
              "name": "semver",
              "path": "semver",
              "type": "Semver",
              "typeCategory": "customComparable",
            },
            {
              "name": "channel",
              "path": "channel",
              "type": "ReleaseChannel",
              "typeCategory": "custom",
            },
            {
              "name": "releaseDay",
              "path": "releaseDay",
              "type": "ReleaseDay",
              "typeCategory": "customLocalDate",
            },
            {
              "name": "cutoffClock",
              "path": "cutoffClock",
              "type": "CutoffClock",
              "typeCategory": "customLocalTime",
            },
            {
              "name": "signOff",
              "path": "signOff",
              "type": "SignOffStamp",
              "typeCategory": "customLocalDateTime",
            },
            {
              "name": "activity",
              "path": "activity",
              "type": "WorklogActivity",
              "typeCategory": "enum",
            },
          ]
        `)
        expect(getQueryContext(ctx.lastSql, ctx.lastParams).getResultColumn('money')).toEqual({ name: 'money', path: 'money', type: 'Money', typeCategory: 'customDouble' })
        expect(getQueryContext(ctx.lastSql, ctx.lastParams).getResultColumn('unknown')).toBeUndefined()
        // Hidden: the params list only the values sent to the database
        expect(Object.keys(ctx.lastParams)).toEqual(['0'])
        expect(JSON.stringify(ctx.lastParams)).toBe('[1]')
        assertType<Exact<typeof rows[number]['money'], number | undefined>>()
        expect(rows.map(row => row.id)).toEqual([1])
    })

    test('result-types/nested-and-left-join-objects', async () => {
        const parent = tIssue.forUseInLeftJoinAs('parent')
        ctx.mockNext([{ id: 3, 'detail.title': 'Migrate to ESM' }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(parent).on(parent.id.equals(tIssue.parentId))
            .where(tIssue.id.equals(3))
            .select({
                id: tIssue.id,
                detail: { title: tIssue.title },
                parent: { id: parent.id, title: parent.title },
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "id", issue.title as "detail.title", parent.id as "parent.id", parent.title as "parent.title" from issue left join issue parent on parent.id = issue.parent_id where issue.id = :0"`)
        expect(resultColumns()).toMatchInlineSnapshot(`
          [
            {
              "name": "id",
              "path": "id",
              "type": "int",
              "typeCategory": "int",
            },
            {
              "name": "detail.title",
              "path": "detail.title",
              "type": "string",
              "typeCategory": "string",
            },
            {
              "name": "parent.id",
              "path": "parent.id",
              "type": "int",
              "typeCategory": "int",
            },
            {
              "name": "parent.title",
              "path": "parent.title",
              "type": "string",
              "typeCategory": "string",
            },
          ]
        `)
        expect(rows.map(row => row.id)).toEqual([3])
    })

    test('result-types/an-alias-longer-than-63-bytes', async () => {
        ctx.mockNext([{ id: 1, aVeryLongPropertyNameThatGoesBeyondTheSixtyThreeBytesOfAnIdentifier: 'Acme Corp' }])
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ id: tOrganization.id, aVeryLongPropertyNameThatGoesBeyondTheSixtyThreeBytesOfAnIdentifier: tOrganization.name })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", name as "aVeryLongPropertyNameThatGoesBeyondTheSixtyThreeBytesOfAnIdentifier" from "organization" where id = :0"`)
        expect(resultColumns()).toMatchInlineSnapshot(`
          [
            {
              "name": "id",
              "path": "id",
              "type": "int",
              "typeCategory": "int",
            },
            {
              "name": "aVeryLongPropertyNameThatGoesBeyondTheSixtyThreeBytesOfAnIdentifier",
              "path": "aVeryLongPropertyNameThatGoesBeyondTheSixtyThreeBytesOfAnIdentifier",
              "type": "string",
              "typeCategory": "string",
            },
          ]
        `)
        expect(rows.map(row => row.aVeryLongPropertyNameThatGoesBeyondTheSixtyThreeBytesOfAnIdentifier)).toEqual(['Acme Corp'])
    })

    test('result-types/one-column-and-count', async () => {
        ctx.mockNext(['Acme Corp'])
        const names = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .selectOneColumn(tOrganization.name)
            .executeSelectMany()
        expect(resultColumns()).toMatchInlineSnapshot(`
          [
            {
              "name": "result",
              "path": "result",
              "type": "string",
              "typeCategory": "string",
            },
          ]
        `)
        expect(names).toEqual(['Acme Corp'])

        ctx.mockNext(2)
        const count = await ctx.conn.selectFrom(tOrganization)
            .selectCountAll()
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as "result" from "organization""`)
        expect(resultColumns()).toMatchInlineSnapshot(`
          [
            {
              "name": "result",
              "path": "result",
              "type": "int",
              "typeCategory": "int",
            },
          ]
        `)
        expect(count).toBe(2)
    })

    test('result-types/select-page', async () => {
        ctx.mockNext([{ id: 1, name: 'Acme Corp' }])
        ctx.mockNext(2)
        const page = await ctx.conn.selectFrom(tOrganization)
            .select({ id: tOrganization.id, name: tOrganization.name })
            .orderBy('id')
            .limit(1)
            .executeSelectPage()
        expect(ctx.history.map(entry => entry.sql)).toMatchInlineSnapshot(`
          [
            "select id as "id", name as "name" from "organization" order by "id" fetch next :0 rows only",
            "select count(*) from "organization"",
          ]
        `)
        expect(ctx.history.map(entry => resultColumns(entry.params))).toMatchInlineSnapshot(`
          [
            [
              {
                "name": "id",
                "path": "id",
                "type": "int",
                "typeCategory": "int",
              },
              {
                "name": "name",
                "path": "name",
                "type": "string",
                "typeCategory": "string",
              },
            ],
            [
              {
                "name": "",
                "path": "",
                "type": "int",
                "typeCategory": "int",
              },
            ],
          ]
        `)
        expect(page).toEqual({ data: [{ id: 1, name: 'Acme Corp' }], count: 2 })
    })

    test('result-types/compound-select', async () => {
        ctx.mockNext([{ id: 1, label: 'Acme Corp' }, { id: 2, label: 'Globex Ltd' }])
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ id: tOrganization.id, label: tOrganization.name })
            .union(
                ctx.conn.selectFrom(tOrganization)
                    .where(tOrganization.id.equals(2))
                    .select({ id: tOrganization.id, label: tOrganization.name })
            )
            .orderBy('label')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", name as "label" from "organization" where id = :0 union select id as "id", name as "label" from "organization" where id = :1 order by 2"`)
        expect(resultColumns()).toMatchInlineSnapshot(`
          [
            {
              "name": "id",
              "path": "id",
              "type": "int",
              "typeCategory": "int",
            },
            {
              "name": "label",
              "path": "label",
              "type": "string",
              "typeCategory": "string",
            },
          ]
        `)
        expect(rows.map(row => row.id)).toEqual([1, 2])
    })

    test('result-types/aggregate-as-array', async () => {
        ctx.mockNext({ id: 1, issueIds: '[1,2]' })
        const project = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .and(tIssue.id.lessOrEqual(2))
            .select({ id: ctx.conn.const(1, 'int'), issueIds: ctx.conn.aggregateAsArrayOfOneColumn(tIssue.id) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "id", json_arrayagg(id) as "issueIds" from issue where project_id = :1 and id <= :2"`)
        expect(resultColumns()).toMatchInlineSnapshot(`
          [
            {
              "name": "id",
              "path": "id",
              "type": "int",
              "typeCategory": "int",
            },
            {
              "name": "issueIds",
              "path": "issueIds",
              "type": "aggregatedArray",
              "typeCategory": "",
            },
          ]
        `)
        expect([...project.issueIds].sort()).toEqual([1, 2])
    })

    test('result-types/a-fragment-with-its-type', async () => {
        ctx.mockNext([{ id: 1, shout: 'ACME CORP' }])
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ id: tOrganization.id, shout: ctx.conn.fragmentWithType('string', 'required').sql`upper(${tOrganization.name})` })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", upper(name) as "shout" from "organization" where id = :0"`)
        expect(resultColumns()).toMatchInlineSnapshot(`
          [
            {
              "name": "id",
              "path": "id",
              "type": "int",
              "typeCategory": "int",
            },
            {
              "name": "shout",
              "path": "shout",
              "type": "string",
              "typeCategory": "string",
            },
          ]
        `)
        expect(rows).toEqual([{ id: 1, shout: 'ACME CORP' }])
    })

    test('result-types/insert-returning-the-last-inserted-id', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext(100)
            const id = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Initech', plan: 'free' })
                .returningLastInsertedId()
                .executeInsert()
            expect(resultColumns()).toMatchInlineSnapshot(`
              [
                {
                  "name": "",
                  "path": "",
                  "type": "int",
                  "typeCategory": "int",
                },
              ]
            `)
            expect(typeof id).toBe('number')
        })
    })

    test('result-types/insert-returning-the-last-inserted-ids-of-many-rows', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext([101, 102])
            const ids = await ctx.conn.insertInto(tOrganization)
                .values([{ name: 'Initrode', plan: 'free' }, { name: 'Hooli', plan: 'free' }])
                .returningLastInsertedId()
                .executeInsert()
            expect(resultColumns()).toMatchInlineSnapshot(`
              [
                {
                  "name": "",
                  "path": "",
                  "type": "int",
                  "typeCategory": "int",
                },
              ]
            `)
            expect(ids.length).toBe(2)
        })
    })

    test('result-types/mutations-without-returning', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Initech', plan: 'free' })
                .executeInsert()
            expect(resultColumns()).toEqual([])

            ctx.mockNext(1)
            const updated = await ctx.conn.update(tOrganization)
                .set({ plan: 'pro' })
                .where(tOrganization.name.equals('Initech'))
                .executeUpdate()
            expect(resultColumns()).toEqual([])
            expect(updated).toBe(1)

            ctx.mockNext(1)
            const deleted = await ctx.conn.deleteFrom(tOrganization)
                .where(tOrganization.name.equals('Initech'))
                .executeDelete()
            expect(resultColumns()).toEqual([])
            expect(deleted).toBe(1)
        })
    })

    test('result-types/update-returning', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext({ id: 2, name: 'Globex Ltd' })
            const updated = await ctx.conn.update(tOrganization)
                .set({ plan: 'pro' })
                .where(tOrganization.id.equals(2))
                .returning({ id: tOrganization.id, name: tOrganization.name })
                .executeUpdateOne()
            expect(resultColumns()).toMatchInlineSnapshot(`
              [
                {
                  "name": "id",
                  "path": "id",
                  "type": "int",
                  "typeCategory": "int",
                },
                {
                  "name": "name",
                  "path": "name",
                  "type": "string",
                  "typeCategory": "string",
                },
              ]
            `)
            expect(updated).toEqual({ id: 2, name: 'Globex Ltd' })
        })
    })

    test('result-types/delete-returning', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext(100)
            const id = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Initech', plan: 'free' })
                .returningLastInsertedId()
                .executeInsert()

            ctx.mockNext([{ name: 'Initech' }])
            const deleted = await ctx.conn.deleteFrom(tOrganization)
                .where(tOrganization.id.equals(id))
                .returning({ name: tOrganization.name })
                .executeDeleteMany()
            expect(resultColumns()).toMatchInlineSnapshot(`
              [
                {
                  "name": "name",
                  "path": "name",
                  "type": "string",
                  "typeCategory": "string",
                },
              ]
            `)
            expect(deleted).toEqual([{ name: 'Initech' }])
        })
    })

    test('result-types/insert-returning-a-row', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext({ id: 100, name: 'Mobile app' })
            const inserted = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, name: 'Mobile app', slug: 'mobile' })
                .returning({ id: tProject.id, name: tProject.name })
                .executeInsertOne()
            expect(resultColumns()).toMatchInlineSnapshot(`
              [
                {
                  "name": "id",
                  "path": "id",
                  "type": "int",
                  "typeCategory": "int",
                },
                {
                  "name": "name",
                  "path": "name",
                  "type": "string",
                  "typeCategory": "string",
                },
              ]
            `)
            expect(inserted.name).toBe('Mobile app')
        })
    })

    test('result-types/a-function', async () => {
        ctx.mockNext(1)
        const open = await ctx.conn.callCountOpenIssues(1)
        expect(resultColumns()).toMatchInlineSnapshot(`
          [
            {
              "name": "",
              "path": "",
              "type": "int",
              "typeCategory": "int",
            },
          ]
        `)
        expect(typeof open).toBe('number')
    })

    test('result-types/a-procedure-has-no-columns', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext(undefined)
            await ctx.conn.callRefreshStats()
            expect(resultColumns()).toEqual([])
        })
    })

    test('result-types/a-transaction-statement-has-no-columns', async () => {
        ctx.mockNext(['Acme Corp'])
        const names = await ctx.conn.transaction(async () => {
            return await ctx.conn.selectFrom(tOrganization).where(tOrganization.id.equals(1)).selectOneColumn(tOrganization.name).executeSelectMany()
        })
        // The params of the transaction are its options
        expect(getQueryContext('', ctx.lastTransactionOpts ?? []).resultColumns).toEqual([])
        expect(names).toEqual(['Acme Corp'])
    })
})
