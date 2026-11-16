// A data type of the user registered with registerDataType, and declared in DataTypes, is given by its type name where a
// data type goes, as a built-in one: a column, a constant, the type requested by a type adapter, a column of a dynamic
// condition. Its class is the one registered, with the same SQL and params as the class given directly. A type name is
// registered once: the same class again does nothing, and another class with that type name, a class without a type
// name of its own or a type name nobody registered is an error.

import { describe, expect, test } from '../../lib/testRunner.js'
import { assertType, type Exact } from '../../lib/assertType.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { getQueryContext } from '../../../src/QueryContext.js'
import { TsSqlError } from '../../../src/TsSqlError.js'
import { Table } from '../../../src/Table.js'
import { IntegersType, RealsType, registerDataType } from '../../../src/exports/v2/index.js'
import type { DynamicCondition, TypeAdapter } from '../../../src/exports/v2/index.js'

type Points = number & { readonly __brand: 'Points' }

abstract class PointsType extends IntegersType<Points, 'Points'> {
    static override readonly type = 'Points'
}

// Another class with the type name of PointsType
abstract class OtherPointsType extends IntegersType<number, 'Points'> {
    static override readonly type = 'Points'
}

// A class with the type name of a built-in data type
abstract class OwnIntType extends IntegersType<number, 'int'> {
    static override readonly type = 'int'
}

// A class that doesn't say its type name: it has the one of its class only
abstract class UnnamedRatioType extends RealsType<number, 'UnnamedRatio'> {}

declare module '../../../src/exports/v2/index.js' {
    interface DataTypes {
        Points: PointsType
    }
}

class DBConnection extends PostgreSqlConnection<'DBConnection'> {}

let lastQuery = ''
let lastParams: any[] = []
const conn = new DBConnection(new MockQueryRunner((type, query, params) => {
    lastQuery = query
    lastParams = params
    return type === 'selectOneColumnOneRow' ? 7 : []
}))

registerDataType(PointsType)

// The same column, given by its type name and by its class
class TScore extends Table<DBConnection, 'TScore'> {
    id = this.primaryKey('id', 'int')
    pointsByName = this.column('points', 'Points')
    pointsByClass = this.column('points', PointsType)
    constructor() { super('score') }
}
const tScore = new TScore()

/** The reason of the error the function throws, or 'no error' */
function reasonOf(fn: () => unknown): string {
    try {
        fn()
    } catch (e) {
        return e instanceof TsSqlError ? e.errorReason.reason : String(e)
    }
    return 'no error'
}

describe('DataTypeRegistry', () => {
    test('a-column-given-a-registered-type-name-is-of-its-class', async () => {
        expect(tScore.pointsByName).toBeInstanceOf(PointsType)
        assertType<Exact<typeof tScore.pointsByName, typeof tScore.pointsByClass>>()

        await conn.selectFrom(tScore).where(tScore.pointsByName.greaterThan(5 as Points)).select({ points: tScore.pointsByName.add(1 as Points) }).executeSelectMany()
        const byName = [lastQuery, lastParams, getQueryContext(lastQuery, lastParams).getParam(0)?.originalType]
        await conn.selectFrom(tScore).where(tScore.pointsByClass.greaterThan(5 as Points)).select({ points: tScore.pointsByClass.add(1 as Points) }).executeSelectMany()
        const byClass = [lastQuery, lastParams, getQueryContext(lastQuery, lastParams).getParam(0)?.originalType]
        expect(byName).toEqual(byClass)
        expect(byName).toEqual(['select points + $1 as points from score where points > $2', [1, 5], PointsType])
    })

    test('a-constant-given-a-registered-type-name-is-of-its-class', async () => {
        const value = await conn.selectFromNoTable().selectOneColumn(conn.const(7 as Points, 'Points')).executeSelectOne()
        assertType<Exact<typeof value, Points>>()
        expect(value).toBe(7)
        expect(getQueryContext(lastQuery, lastParams).getParam(0)?.originalType).toBe(PointsType)
    })

    test('a-type-adapter-requests-a-registered-type-by-its-name', async () => {
        const asPoints: TypeAdapter = {
            transformValueFromDB(value, context, next) {
                return next.transformValueFromDB(value, context)
            },
            transformValueToDB(value, context, next) {
                context.setRequestedType('Points')
                return next.transformValueToDB(value, context)
            },
        }
        await conn.selectFromNoTable().selectOneColumn(conn.const(7, 'int', asPoints)).executeSelectOne()
        expect(getQueryContext(lastQuery, lastParams).getParam(0)?.requestedType).toBe(PointsType)
    })

    test('a-dynamic-condition-declares-a-column-by-a-registered-type-name', async () => {
        assertType<Exact<DynamicCondition<{ points: 'Points' }>, DynamicCondition<{ points: PointsType }>>>()
        const condition: DynamicCondition<{ points: 'Points' }> = { points: { greaterThan: 5 as Points } }
        await conn.selectFrom(tScore).where(conn.dynamicConditionFor({ points: tScore.pointsByName }).withValues(condition)).select({ id: tScore.id }).executeSelectMany()
        expect([lastQuery, lastParams]).toEqual(['select id as id from score where points > $1', [5]])
    })

    test('registering-the-same-class-again-does-nothing', () => {
        expect(reasonOf(() => registerDataType(PointsType))).toBe('no error')
    })

    test('another-class-with-a-registered-type-name-is-an-error', () => {
        expect(reasonOf(() => registerDataType(OtherPointsType))).toBe('DATA_TYPE_ALREADY_REGISTERED')
        expect(reasonOf(() => registerDataType(OwnIntType))).toBe('DATA_TYPE_ALREADY_REGISTERED')
        expect(conn.const(1 as Points, 'Points')).toBeInstanceOf(PointsType)
        expect(conn.const(1, 'int')).not.toBeInstanceOf(OwnIntType)
    })

    test('a-class-without-a-type-name-of-its-own-is-an-error', () => {
        expect(UnnamedRatioType.type).toBe('UnnamedRatioType')
        expect(reasonOf(() => registerDataType(UnnamedRatioType))).toBe('DATA_TYPE_WITHOUT_TYPE_NAME')
        expect(reasonOf(() => conn.const(1, 'UnnamedRatioType' as any))).toBe('UNKNOWN_DATA_TYPE')
    })

    test('a-type-name-nobody-registered-is-an-error', () => {
        expect(reasonOf(() => conn.const(1, 'Nobody' as any))).toBe('UNKNOWN_DATA_TYPE')
        expect(reasonOf(() => new class TNobody extends Table<DBConnection, 'TNobody'> {
            value = this.column('value', 'Nobody' as any)
            constructor() { super('nobody') }
        }())).toBe('UNKNOWN_DATA_TYPE')
    })

    test('a-type-name-not-declared-in-data-types-is-rejected-when-compiling', () => {
        // @ts-expect-error a type name not declared in DataTypes
        expect(reasonOf(() => conn.const(1, 'Nobody'))).toBe('UNKNOWN_DATA_TYPE')
        // @ts-expect-error a family has no type name: a class that extends it is the data type
        expect(reasonOf(() => registerDataType(IntegersType))).toBe('DATA_TYPE_WITHOUT_TYPE_NAME')
    })
})
