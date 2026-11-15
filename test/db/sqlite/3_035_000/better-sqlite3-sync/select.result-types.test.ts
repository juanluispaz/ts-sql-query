// Each query the library builds goes with the columns of its result, read from the context of the query (getQueryContext): the key of the
// column in a row returned by the database, its path in the result, and the type name and type category its value
// is converted with, and of the value the database returns (the projected type, which a transformProjection can
// change), in the order of the select list. A query that returns no columns has none. They travel hidden in
// the params: they are not listed, nor sent to the database.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { type QueryResultColumn } from '../../../../../src/queryRunners/QueryRunner.js'
import { getQueryContext } from '../../../../../src/QueryContext.js'
import { tColMatrixOptional, tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

// A type shown by its name, and a custom one with its custom type: `int`, `Money (customInt)`
function typeLabel(type: QueryResultColumn['originalType']): string {
    return type.customType === undefined ? type.type : type.type + ' (' + type.customType + ')'
}

// A result column with its types shown by typeLabel, and its SQL data types as they say it (a copy: a SQL data type keeps
// hidden what a connection derives from it)
type ShownResultColumn = Omit<QueryResultColumn, 'originalType' | 'requestedType' | 'originalSqlDataType' | 'requestedSqlDataType'> & { originalType: string, requestedType: string, originalSqlDataType?: QueryResultColumn['originalSqlDataType'], requestedSqlDataType?: QueryResultColumn['requestedSqlDataType'] }

function resultColumns(params = ctx.lastParams): ShownResultColumn[] | undefined {
    return getQueryContext(ctx.lastSql, params).resultColumns?.map(column => {
        const shown: ShownResultColumn = { ...column, originalType: typeLabel(column.originalType), requestedType: typeLabel(column.requestedType) }
        if (column.originalSqlDataType !== undefined || column.requestedSqlDataType !== undefined) {
            shown.originalSqlDataType = column.originalSqlDataType && { ...column.originalSqlDataType }
            shown.requestedSqlDataType = column.requestedSqlDataType && { ...column.requestedSqlDataType }
        }
        return shown
    })
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('result-types/an-object-with-every-type', async () => {
        const t = tColMatrixOptional
        ctx.mockNext([{ id: 1 }])
        const rows = sync(ctx.conn.selectFrom(t)
            .where(t.id.equals(1))
            .select({
                id: t.id, mInt: t.mInt, mBigint: t.mBigint, mDouble: t.mDouble, mBool: t.mBool, mUuid: t.mUuid,
                mDate: t.mDate, mTime: t.mTime, mDatetime: t.mDatetime, mStr: t.mStr, cents: t.cents, money: t.money,
                signingKey: t.signingKey, semver: t.semver, channel: t.channel, releaseDay: t.releaseDay,
                cutoffClock: t.cutoffClock, signOff: t.signOff, activity: t.activity,
            })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, m_int as mInt, m_bigint as mBigint, m_double as mDouble, m_bool as mBool, m_uuid as mUuid, m_date as mDate, m_time as mTime, m_datetime as mDatetime, m_str as mStr, m_int as cents, m_double as money, m_uuid as signingKey, m_str as semver, m_str as channel, m_date as releaseDay, m_time as cutoffClock, m_datetime as signOff, m_str as activity from col_matrix where id = ?1"`)
        expect(resultColumns()).toMatchInlineSnapshot(`
          [
            {
              "name": "id",
              "originalSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "originalType": "int",
              "path": "id",
              "requestedSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "requestedType": "int",
            },
            {
              "name": "mInt",
              "originalSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "originalType": "int",
              "path": "mInt",
              "requestedSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "requestedType": "int",
            },
            {
              "name": "mBigint",
              "originalSqlDataType": {
                "bytes": 8,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "originalType": "bigint",
              "path": "mBigint",
              "requestedSqlDataType": {
                "bytes": 8,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "requestedType": "bigint",
            },
            {
              "name": "mDouble",
              "originalSqlDataType": {
                "family": "approximate numeric",
                "precision": 53,
                "typeDefault": true,
              },
              "originalType": "double",
              "path": "mDouble",
              "requestedSqlDataType": {
                "family": "approximate numeric",
                "precision": 53,
                "typeDefault": true,
              },
              "requestedType": "double",
            },
            {
              "name": "mBool",
              "originalSqlDataType": {
                "family": "boolean",
                "typeDefault": true,
              },
              "originalType": "boolean",
              "path": "mBool",
              "requestedSqlDataType": {
                "family": "boolean",
                "typeDefault": true,
              },
              "requestedType": "boolean",
            },
            {
              "name": "mUuid",
              "originalSqlDataType": {
                "family": "uuid",
                "typeDefault": true,
              },
              "originalType": "uuid",
              "path": "mUuid",
              "requestedSqlDataType": {
                "family": "uuid",
                "typeDefault": true,
              },
              "requestedType": "uuid",
            },
            {
              "name": "mDate",
              "originalSqlDataType": {
                "family": "datetime",
                "fields": "date",
                "typeDefault": true,
              },
              "originalType": "localDate",
              "path": "mDate",
              "requestedSqlDataType": {
                "family": "datetime",
                "fields": "date",
                "typeDefault": true,
              },
              "requestedType": "localDate",
            },
            {
              "name": "mTime",
              "originalSqlDataType": {
                "family": "datetime",
                "fields": "time",
                "typeDefault": true,
              },
              "originalType": "localTime",
              "path": "mTime",
              "requestedSqlDataType": {
                "family": "datetime",
                "fields": "time",
                "typeDefault": true,
              },
              "requestedType": "localTime",
            },
            {
              "name": "mDatetime",
              "originalSqlDataType": {
                "family": "datetime",
                "fields": "timestamp",
                "typeDefault": true,
              },
              "originalType": "localDateTime",
              "path": "mDatetime",
              "requestedSqlDataType": {
                "family": "datetime",
                "fields": "timestamp",
                "typeDefault": true,
              },
              "requestedType": "localDateTime",
            },
            {
              "name": "mStr",
              "originalSqlDataType": {
                "family": "character string",
                "typeDefault": true,
              },
              "originalType": "string",
              "path": "mStr",
              "requestedSqlDataType": {
                "family": "character string",
                "typeDefault": true,
              },
              "requestedType": "string",
            },
            {
              "name": "cents",
              "originalSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "originalType": "Cents (customInt)",
              "path": "cents",
              "requestedSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "requestedType": "Cents (customInt)",
            },
            {
              "name": "money",
              "originalSqlDataType": {
                "family": "approximate numeric",
                "precision": 53,
                "typeDefault": true,
              },
              "originalType": "Money (customDouble)",
              "path": "money",
              "requestedSqlDataType": {
                "family": "approximate numeric",
                "precision": 53,
                "typeDefault": true,
              },
              "requestedType": "Money (customDouble)",
            },
            {
              "name": "signingKey",
              "originalSqlDataType": {
                "family": "uuid",
                "typeDefault": true,
              },
              "originalType": "SigningKey (customUuid)",
              "path": "signingKey",
              "requestedSqlDataType": {
                "family": "uuid",
                "typeDefault": true,
              },
              "requestedType": "SigningKey (customUuid)",
            },
            {
              "name": "semver",
              "originalType": "Semver (customComparable)",
              "path": "semver",
              "requestedType": "Semver (customComparable)",
            },
            {
              "name": "channel",
              "originalType": "ReleaseChannel (custom)",
              "path": "channel",
              "requestedType": "ReleaseChannel (custom)",
            },
            {
              "name": "releaseDay",
              "originalSqlDataType": {
                "family": "datetime",
                "fields": "date",
                "typeDefault": true,
              },
              "originalType": "ReleaseDay (customLocalDate)",
              "path": "releaseDay",
              "requestedSqlDataType": {
                "family": "datetime",
                "fields": "date",
                "typeDefault": true,
              },
              "requestedType": "ReleaseDay (customLocalDate)",
            },
            {
              "name": "cutoffClock",
              "originalSqlDataType": {
                "family": "datetime",
                "fields": "time",
                "typeDefault": true,
              },
              "originalType": "CutoffClock (customLocalTime)",
              "path": "cutoffClock",
              "requestedSqlDataType": {
                "family": "datetime",
                "fields": "time",
                "typeDefault": true,
              },
              "requestedType": "CutoffClock (customLocalTime)",
            },
            {
              "name": "signOff",
              "originalSqlDataType": {
                "family": "datetime",
                "fields": "timestamp",
                "typeDefault": true,
              },
              "originalType": "SignOffStamp (customLocalDateTime)",
              "path": "signOff",
              "requestedSqlDataType": {
                "family": "datetime",
                "fields": "timestamp",
                "typeDefault": true,
              },
              "requestedType": "SignOffStamp (customLocalDateTime)",
            },
            {
              "name": "activity",
              "originalType": "WorklogActivity (enum)",
              "path": "activity",
              "requestedType": "WorklogActivity (enum)",
            },
          ]
        `)
        const money = getQueryContext(ctx.lastSql, ctx.lastParams).getResultColumn('money')
        // A custom double without a SQL data type of its column has the one of its data type
        const doubleOfType = { family: 'approximate numeric', precision: 53, typeDefault: true }
        expect(money && { ...money, originalType: typeLabel(money.originalType), requestedType: typeLabel(money.requestedType) }).toEqual({ name: 'money', path: 'money', originalType: 'Money (customDouble)', requestedType: 'Money (customDouble)', originalSqlDataType: doubleOfType, requestedSqlDataType: doubleOfType })
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
        const rows = sync(ctx.conn.selectFrom(tIssue)
            .leftJoin(parent).on(parent.id.equals(tIssue.parentId))
            .where(tIssue.id.equals(3))
            .select({
                id: tIssue.id,
                detail: { title: tIssue.title },
                parent: { id: parent.id, title: parent.title },
            })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as "detail.title", parent.id as "parent.id", parent.title as "parent.title" from issue left join issue as parent on parent.id = issue.parent_id where issue.id = ?1"`)
        expect(resultColumns()).toMatchInlineSnapshot(`
          [
            {
              "name": "id",
              "originalSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "originalType": "int",
              "path": "id",
              "requestedSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "requestedType": "int",
            },
            {
              "name": "detail.title",
              "originalSqlDataType": {
                "family": "character string",
                "typeDefault": true,
              },
              "originalType": "string",
              "path": "detail.title",
              "requestedSqlDataType": {
                "family": "character string",
                "typeDefault": true,
              },
              "requestedType": "string",
            },
            {
              "name": "parent.id",
              "originalSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "originalType": "int",
              "path": "parent.id",
              "requestedSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "requestedType": "int",
            },
            {
              "name": "parent.title",
              "originalSqlDataType": {
                "family": "character string",
                "typeDefault": true,
              },
              "originalType": "string",
              "path": "parent.title",
              "requestedSqlDataType": {
                "family": "character string",
                "typeDefault": true,
              },
              "requestedType": "string",
            },
          ]
        `)
        expect(rows.map(row => row.id)).toEqual([3])
    })

    test('result-types/an-alias-longer-than-63-bytes', async () => {
        ctx.mockNext([{ id: 1, aVeryLongPropertyNameThatGoesBeyondTheSixtyThreeBytesOfAnIdentifier: 'Acme Corp' }])
        const rows = sync(ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ id: tOrganization.id, aVeryLongPropertyNameThatGoesBeyondTheSixtyThreeBytesOfAnIdentifier: tOrganization.name })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as aVeryLongPropertyNameThatGoesBeyondTheSixtyThreeBytesOfAnIdentifier from organization where id = ?1"`)
        expect(resultColumns()).toMatchInlineSnapshot(`
          [
            {
              "name": "id",
              "originalSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "originalType": "int",
              "path": "id",
              "requestedSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "requestedType": "int",
            },
            {
              "name": "aVeryLongPropertyNameThatGoesBeyondTheSixtyThreeBytesOfAnIdentifier",
              "originalSqlDataType": {
                "family": "character string",
                "typeDefault": true,
              },
              "originalType": "string",
              "path": "aVeryLongPropertyNameThatGoesBeyondTheSixtyThreeBytesOfAnIdentifier",
              "requestedSqlDataType": {
                "family": "character string",
                "typeDefault": true,
              },
              "requestedType": "string",
            },
          ]
        `)
        expect(rows.map(row => row.aVeryLongPropertyNameThatGoesBeyondTheSixtyThreeBytesOfAnIdentifier)).toEqual(['Acme Corp'])
    })

    test('result-types/one-column-and-count', async () => {
        ctx.mockNext(['Acme Corp'])
        const names = sync(ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .selectOneColumn(tOrganization.name)
            .executeSelectMany())
        expect(resultColumns()).toMatchInlineSnapshot(`
          [
            {
              "name": "result",
              "originalSqlDataType": {
                "family": "character string",
                "typeDefault": true,
              },
              "originalType": "string",
              "path": "result",
              "requestedSqlDataType": {
                "family": "character string",
                "typeDefault": true,
              },
              "requestedType": "string",
            },
          ]
        `)
        expect(names).toEqual(['Acme Corp'])

        ctx.mockNext(2)
        const count = sync(ctx.conn.selectFrom(tOrganization)
            .selectCountAll()
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as result from organization"`)
        expect(resultColumns()).toMatchInlineSnapshot(`
          [
            {
              "name": "result",
              "originalSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "originalType": "int",
              "path": "result",
              "requestedSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "requestedType": "int",
            },
          ]
        `)
        expect(count).toBe(2)
    })

    test('result-types/select-page', async () => {
        ctx.mockNext([{ id: 1, name: 'Acme Corp' }])
        ctx.mockNext(2)
        const page = sync(ctx.conn.selectFrom(tOrganization)
            .select({ id: tOrganization.id, name: tOrganization.name })
            .orderBy('id')
            .limit(1)
            .executeSelectPage())
        expect(ctx.history.map(entry => entry.sql)).toMatchInlineSnapshot(`
          [
            "select id as id, name as name from organization order by id limit ?1",
            "select count(*) from organization",
          ]
        `)
        expect(ctx.history.map(entry => resultColumns(entry.params))).toMatchInlineSnapshot(`
          [
            [
              {
                "name": "id",
                "originalSqlDataType": {
                  "bytes": 4,
                  "family": "exact numeric",
                  "scale": 0,
                  "typeDefault": true,
                },
                "originalType": "int",
                "path": "id",
                "requestedSqlDataType": {
                  "bytes": 4,
                  "family": "exact numeric",
                  "scale": 0,
                  "typeDefault": true,
                },
                "requestedType": "int",
              },
              {
                "name": "name",
                "originalSqlDataType": {
                  "family": "character string",
                  "typeDefault": true,
                },
                "originalType": "string",
                "path": "name",
                "requestedSqlDataType": {
                  "family": "character string",
                  "typeDefault": true,
                },
                "requestedType": "string",
              },
            ],
            [
              {
                "name": "",
                "originalSqlDataType": {
                  "bytes": 4,
                  "family": "exact numeric",
                  "scale": 0,
                  "typeDefault": true,
                },
                "originalType": "int",
                "path": "",
                "requestedSqlDataType": {
                  "bytes": 4,
                  "family": "exact numeric",
                  "scale": 0,
                  "typeDefault": true,
                },
                "requestedType": "int",
              },
            ],
          ]
        `)
        expect(page).toEqual({ data: [{ id: 1, name: 'Acme Corp' }], count: 2 })
    })

    test('result-types/compound-select', async () => {
        ctx.mockNext([{ id: 1, label: 'Acme Corp' }, { id: 2, label: 'Globex Ltd' }])
        const rows = sync(ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ id: tOrganization.id, label: tOrganization.name })
            .union(
                ctx.conn.selectFrom(tOrganization)
                    .where(tOrganization.id.equals(2))
                    .select({ id: tOrganization.id, label: tOrganization.name })
            )
            .orderBy('label')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as label from organization where id = ?1 union select id as id, name as label from organization where id = ?2 order by label"`)
        expect(resultColumns()).toMatchInlineSnapshot(`
          [
            {
              "name": "id",
              "originalSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "originalType": "int",
              "path": "id",
              "requestedSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "requestedType": "int",
            },
            {
              "name": "label",
              "originalSqlDataType": {
                "family": "character string",
                "typeDefault": true,
              },
              "originalType": "string",
              "path": "label",
              "requestedSqlDataType": {
                "family": "character string",
                "typeDefault": true,
              },
              "requestedType": "string",
            },
          ]
        `)
        expect(rows.map(row => row.id)).toEqual([1, 2])
    })

    test('result-types/aggregate-as-array', async () => {
        ctx.mockNext({ id: 1, issueIds: '[1,2]' })
        const project = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .and(tIssue.id.lessOrEqual(2))
            .select({ id: ctx.conn.const(1, 'int'), issueIds: ctx.conn.aggregateAsArrayOfOneColumn(tIssue.id) })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ?1 as id, json_group_array(id) as issueIds from issue where project_id = ?2 and id <= ?3"`)
        expect(resultColumns()).toMatchInlineSnapshot(`
          [
            {
              "name": "id",
              "originalSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "originalType": "int",
              "path": "id",
              "requestedSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "requestedType": "int",
            },
            {
              "name": "issueIds",
              "originalType": "aggregatedArray",
              "path": "issueIds",
              "requestedType": "aggregatedArray",
            },
          ]
        `)
        expect([...project.issueIds].sort()).toEqual([1, 2])
    })

    test('result-types/a-fragment-with-its-type', async () => {
        ctx.mockNext([{ id: 1, shout: 'ACME CORP' }])
        const rows = sync(ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ id: tOrganization.id, shout: ctx.conn.fragmentWithType('string', 'required').sql`upper(${tOrganization.name})` })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, upper(name) as shout from organization where id = ?1"`)
        expect(resultColumns()).toMatchInlineSnapshot(`
          [
            {
              "name": "id",
              "originalSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "originalType": "int",
              "path": "id",
              "requestedSqlDataType": {
                "bytes": 4,
                "family": "exact numeric",
                "scale": 0,
                "typeDefault": true,
              },
              "requestedType": "int",
            },
            {
              "name": "shout",
              "originalSqlDataType": {
                "family": "character string",
                "typeDefault": true,
              },
              "originalType": "string",
              "path": "shout",
              "requestedSqlDataType": {
                "family": "character string",
                "typeDefault": true,
              },
              "requestedType": "string",
            },
          ]
        `)
        expect(rows).toEqual([{ id: 1, shout: 'ACME CORP' }])
    })

    test('result-types/insert-returning-the-last-inserted-id', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext(100)
            const id = sync(ctx.conn.insertInto(tOrganization)
                .values({ name: 'Initech', plan: 'free' })
                .returningLastInsertedId()
                .executeInsert())
            expect(resultColumns()).toMatchInlineSnapshot(`
              [
                {
                  "name": "",
                  "originalSqlDataType": {
                    "bytes": 4,
                    "family": "exact numeric",
                    "scale": 0,
                    "typeDefault": true,
                  },
                  "originalType": "int",
                  "path": "",
                  "requestedSqlDataType": {
                    "bytes": 4,
                    "family": "exact numeric",
                    "scale": 0,
                    "typeDefault": true,
                  },
                  "requestedType": "int",
                },
              ]
            `)
            expect(typeof id).toBe('number')
        })
    })

    test('result-types/insert-returning-the-last-inserted-ids-of-many-rows', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext([101, 102])
            const ids = sync(ctx.conn.insertInto(tOrganization)
                .values([{ name: 'Initrode', plan: 'free' }, { name: 'Hooli', plan: 'free' }])
                .returningLastInsertedId()
                .executeInsert())
            expect(resultColumns()).toMatchInlineSnapshot(`
              [
                {
                  "name": "",
                  "originalSqlDataType": {
                    "bytes": 4,
                    "family": "exact numeric",
                    "scale": 0,
                    "typeDefault": true,
                  },
                  "originalType": "int",
                  "path": "",
                  "requestedSqlDataType": {
                    "bytes": 4,
                    "family": "exact numeric",
                    "scale": 0,
                    "typeDefault": true,
                  },
                  "requestedType": "int",
                },
              ]
            `)
            expect(ids.length).toBe(2)
        })
    })

    test('result-types/mutations-without-returning', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            sync(ctx.conn.insertInto(tOrganization)
                .values({ name: 'Initech', plan: 'free' })
                .executeInsert())
            expect(resultColumns()).toEqual([])

            ctx.mockNext(1)
            const updated = sync(ctx.conn.update(tOrganization)
                .set({ plan: 'pro' })
                .where(tOrganization.name.equals('Initech'))
                .executeUpdate())
            expect(resultColumns()).toEqual([])
            expect(updated).toBe(1)

            ctx.mockNext(1)
            const deleted = sync(ctx.conn.deleteFrom(tOrganization)
                .where(tOrganization.name.equals('Initech'))
                .executeDelete())
            expect(resultColumns()).toEqual([])
            expect(deleted).toBe(1)
        })
    })

    test('result-types/update-returning', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext({ id: 2, name: 'Globex Ltd' })
            const updated = sync(ctx.conn.update(tOrganization)
                .set({ plan: 'pro' })
                .where(tOrganization.id.equals(2))
                .returning({ id: tOrganization.id, name: tOrganization.name })
                .executeUpdateOne())
            expect(resultColumns()).toMatchInlineSnapshot(`
              [
                {
                  "name": "id",
                  "originalSqlDataType": {
                    "bytes": 4,
                    "family": "exact numeric",
                    "scale": 0,
                    "typeDefault": true,
                  },
                  "originalType": "int",
                  "path": "id",
                  "requestedSqlDataType": {
                    "bytes": 4,
                    "family": "exact numeric",
                    "scale": 0,
                    "typeDefault": true,
                  },
                  "requestedType": "int",
                },
                {
                  "name": "name",
                  "originalSqlDataType": {
                    "family": "character string",
                    "typeDefault": true,
                  },
                  "originalType": "string",
                  "path": "name",
                  "requestedSqlDataType": {
                    "family": "character string",
                    "typeDefault": true,
                  },
                  "requestedType": "string",
                },
              ]
            `)
            expect(updated).toEqual({ id: 2, name: 'Globex Ltd' })
        })
    })

    test('result-types/delete-returning', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext(100)
            const id = sync(ctx.conn.insertInto(tOrganization)
                .values({ name: 'Initech', plan: 'free' })
                .returningLastInsertedId()
                .executeInsert())

            ctx.mockNext([{ name: 'Initech' }])
            const deleted = sync(ctx.conn.deleteFrom(tOrganization)
                .where(tOrganization.id.equals(id))
                .returning({ name: tOrganization.name })
                .executeDeleteMany())
            expect(resultColumns()).toMatchInlineSnapshot(`
              [
                {
                  "name": "name",
                  "originalSqlDataType": {
                    "family": "character string",
                    "typeDefault": true,
                  },
                  "originalType": "string",
                  "path": "name",
                  "requestedSqlDataType": {
                    "family": "character string",
                    "typeDefault": true,
                  },
                  "requestedType": "string",
                },
              ]
            `)
            expect(deleted).toEqual([{ name: 'Initech' }])
        })
    })

    test('result-types/insert-returning-a-row', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext({ id: 100, name: 'Mobile app' })
            const inserted = sync(ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, name: 'Mobile app', slug: 'mobile' })
                .returning({ id: tProject.id, name: tProject.name })
                .executeInsertOne())
            expect(resultColumns()).toMatchInlineSnapshot(`
              [
                {
                  "name": "id",
                  "originalSqlDataType": {
                    "bytes": 4,
                    "family": "exact numeric",
                    "scale": 0,
                    "typeDefault": true,
                  },
                  "originalType": "int",
                  "path": "id",
                  "requestedSqlDataType": {
                    "bytes": 4,
                    "family": "exact numeric",
                    "scale": 0,
                    "typeDefault": true,
                  },
                  "requestedType": "int",
                },
                {
                  "name": "name",
                  "originalSqlDataType": {
                    "family": "character string",
                    "typeDefault": true,
                  },
                  "originalType": "string",
                  "path": "name",
                  "requestedSqlDataType": {
                    "family": "character string",
                    "typeDefault": true,
                  },
                  "requestedType": "string",
                },
              ]
            `)
            expect(inserted.name).toBe('Mobile app')
        })
    })

    // NOT-SUPPORTED: SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('result-types/a-function', async () => {
        ctx.mockNext(1)
        const open = await ctx.conn.callCountOpenIssues(1)
        expect(resultColumns()).toMatchInlineSnapshot()
        expect(typeof open).toBe('number')
    })
    */

    // NOT-SUPPORTED: SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('result-types/a-procedure-has-no-columns', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext(undefined)
            await ctx.conn.callRefreshStats()
            expect(resultColumns()).toEqual([])
        })
    })
    */

    test('result-types/a-transaction-statement-has-no-columns', async () => {
        ctx.mockNext(['Acme Corp'])
        const names = await ctx.conn.transaction(async () => {
            return sync(ctx.conn.selectFrom(tOrganization).where(tOrganization.id.equals(1)).selectOneColumn(tOrganization.name).executeSelectMany())
        })
        // The params of the transaction are its options
        expect(getQueryContext('', ctx.lastTransactionOpts ?? []).resultColumns).toEqual([])
        expect(names).toEqual(['Acme Corp'])
    })
})
