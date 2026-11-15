// The SQL data type a type adapter says (withSqlDataType): set on the adapter, rejected on one that already says another,
// and given to the query runner with each parameter converted with the adapter (the value of the column, a value
// compared with it) and with each column of the result.

import { describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { SqlServerConnection } from '../../../src/connections/SqlServerConnection.js'
import { OracleConnection } from '../../../src/connections/OracleConnection.js'
import { Table } from '../../../src/Table.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { NoExecutionQueryRunner } from '../../../src/queryRunners/NoExecutionQueryRunner.js'
import { getQueryContext } from '../../../src/QueryContext.js'
import { CustomBooleanTypeAdapter, withSqlDataType, type DefaultTypeAdapter, type SqlDataType, type TypeAdapter, type TypeAdapterProjectionContext, type TypeAdapterValueFromDBContext, type TypeAdapterValueToDBContext } from '../../../src/TypeAdapter.js'
import { reasonOf } from '../lib/runnerContract.js'
import { CustomDecimalType } from '../../../src/exports/v2/index.js'

const price: SqlDataType = { family: 'exact numeric', precision: 18, scale: 4 }
const code: SqlDataType = { family: 'character string', length: 20, national: false }

class DBConnection extends PostgreSqlConnection<'DBConnection'> { }

class TProduct extends Table<DBConnection, 'TProduct'> {
    id = this.primaryKey('id', 'int')
    price = this.column('price', CustomDecimalType.of<string, 'Price'>('Price'), withSqlDataType(price))
    code = this.column('code', 'string', withSqlDataType(code))
    name = this.column('name', 'string')
    constructor() {
        super('product')
    }
}
const tProduct = new TProduct()

describe('withSqlDataType', () => {
    test('without-an-adapter-creates-one-that-says-the-type', () => {
        expect(withSqlDataType(price).sqlDataType).toBe(price)
    })

    test('with-an-adapter-sets-it-on-that-instance', () => {
        const adapter = new CustomBooleanTypeAdapter('Y', 'N')
        const result = withSqlDataType({ family: 'character string', length: 1, fixed: true }, adapter)
        expect(result).toBe(adapter)
        expect(result).toBeInstanceOf(CustomBooleanTypeAdapter)
        expect(result.sqlDataType).toEqual({ family: 'character string', length: 1, fixed: true })
        // The same type again is accepted
        expect(withSqlDataType({ family: 'character string', length: 1, fixed: true }, adapter)).toBe(adapter)
    })

    test('an-adapter-that-already-says-another-type-is-rejected', () => {
        const adapter = withSqlDataType(price, new CustomBooleanTypeAdapter(1, 0))
        let error: unknown
        try {
            withSqlDataType(code, adapter)
        } catch (e) {
            error = e
        }
        expect(reasonOf(error)).toBe('INVALID_CONFIGURATION')
        expect(adapter.sqlDataType).toBe(price)
    })
})

describe('the native names of several databases', () => {
    test('each-database-uses-its-own-and-the-others-the-family', () => {
        const timestamp: SqlDataType = { family: 'datetime', fields: 'timestamp', precision: 3, timeZone: 'none', native: { sqlServer: 'datetime', postgreSql: 'timestamp(3) without time zone' } }
        class SqlServer extends SqlServerConnection<'SqlServer'> { }
        class Oracle extends OracleConnection<'Oracle'> { }
        expect(new SqlServer(new NoExecutionQueryRunner()).nativeSqlDataTypeOf(timestamp)).toBe('datetime')
        expect(new DBConnection(new NoExecutionQueryRunner()).nativeSqlDataTypeOf(timestamp)).toBe('timestamp(3) without time zone')
        expect(new Oracle(new NoExecutionQueryRunner()).nativeSqlDataTypeOf(timestamp)).toBe('TIMESTAMP(3)')
    })
})

describe('the version and the strategies of the connection', () => {
    const json: SqlDataType = { family: 'document', format: 'json' }
    const uuid: SqlDataType = { family: 'uuid' }
    test('a-type-the-version-does-not-have-is-undefined', () => {
        class Oracle21 extends OracleConnection<'Oracle21'> { protected override compatibilityVersion = 21_000_000 }
        class Oracle19 extends OracleConnection<'Oracle19'> { protected override compatibilityVersion = 19_000_000 }
        class SqlServer2022 extends SqlServerConnection<'SqlServer2022'> { protected override compatibilityVersion = 16_000_000 }
        class SqlServer2025 extends SqlServerConnection<'SqlServer2025'> { protected override compatibilityVersion = 17_000_000 }
        expect(new Oracle21(new NoExecutionQueryRunner()).nativeSqlDataTypeOf(json)).toBe('JSON')
        expect(new Oracle19(new NoExecutionQueryRunner()).nativeSqlDataTypeOf(json)).toBeUndefined()
        expect(new SqlServer2025(new NoExecutionQueryRunner()).nativeSqlDataTypeOf(json)).toBe('json')
        expect(new SqlServer2022(new NoExecutionQueryRunner()).nativeSqlDataTypeOf(json)).toBeUndefined()
    })
    test('a-type-the-library-stores-in-another-follows-the-strategy', () => {
        class OracleRaw extends OracleConnection<'OracleRaw'> { }
        class OracleText extends OracleConnection<'OracleText'> { protected override uuidStrategy = 'string' as const }
        class OracleBoolean extends OracleConnection<'OracleBoolean'> { protected override booleanStorage = 'boolean' as const }
        const oracle = new OracleRaw(new NoExecutionQueryRunner())
        expect(oracle.nativeSqlDataTypeOf(uuid)).toBe('RAW(16)')
        expect(new OracleText(new NoExecutionQueryRunner()).nativeSqlDataTypeOf(uuid)).toBe('VARCHAR2(36)')
        expect(oracle.nativeSqlDataTypeOf({ family: 'boolean' })).toBe('NUMBER(1)')
        expect(new OracleBoolean(new NoExecutionQueryRunner()).nativeSqlDataTypeOf({ family: 'boolean' })).toBe('BOOLEAN')
        // A time of the day is kept on 1970-01-01
        expect(oracle.nativeSqlDataTypeOf({ family: 'datetime', fields: 'time', precision: 3 })).toBe('TIMESTAMP(3)')
    })
})

describe('the SQL data type in the context of the query', () => {
    function contextOf(execute: (conn: DBConnection) => Promise<unknown>): Promise<{ params: (SqlDataType | undefined)[], columns: (SqlDataType | undefined)[] }> {
        let captured: { params: (SqlDataType | undefined)[], columns: (SqlDataType | undefined)[] } | undefined
        const conn = new DBConnection(new MockQueryRunner((type, query, params) => {
            const context = getQueryContext(query, params)
            captured = {
                params: params.map((_, index) => context.getParam(index)?.requestedSqlDataType),
                columns: (context.resultColumns ?? []).map(column => column.requestedSqlDataType),
            }
            return type === 'insert' ? 1 : []
        }))
        return execute(conn).then(() => captured!)
    }

    test('the-value-of-a-column-in-an-insert', async () => {
        const context = await contextOf(conn => conn.insertInto(tProduct).set({ id: 1, price: '1.5', code: 'A', name: 'n' }).executeInsert())
        expect(context.params).toEqual([undefined, price, code, undefined])
    })

    test('a-value-compared-with-a-column', async () => {
        const context = await contextOf(conn => conn.selectFrom(tProduct)
            .where(tProduct.price.equals('2.25')).and(tProduct.code.in(['A', 'B'])).and(tProduct.name.equals('x'))
            .select({ id: tProduct.id, price: tProduct.price, code: tProduct.code }).executeSelectMany())
        expect(context.params).toEqual([price, code, code, undefined])
        expect(context.columns).toEqual([undefined, price, code])
    })

    test('a-constant-without-an-adapter-says-none', async () => {
        const context = await contextOf(conn => conn.selectFromNoTable().select({ v: conn.const('1.5', CustomDecimalType.of<string, 'Price'>('Price')) }).executeSelectMany())
        expect(context.params).toEqual([undefined])
    })
})

// An adapter that sends a date as its text: it says so, so the SQL data type of the parameter and of the column of the
// result is the one of the text, and it sees the SQL data type of the column in each transformation
const asText: SqlDataType = { family: 'character string', length: 10 }
class DateAsTextAdapter implements TypeAdapter {
    readonly seen: [SqlDataType | undefined, SqlDataType | undefined][] = []
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        this.seen.push([context.originalSqlDataType, context.requestedSqlDataType])
        context.setRequestedSqlDataType(asText)
        return next.transformValueToDB(value, context)
    }
    transformProjection(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string {
        this.seen.push([context.originalSqlDataType, context.requestedSqlDataType])
        context.setRequestedSqlDataType(asText)
        return next.transformProjection(sql, context)
    }
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        this.seen.push([context.originalSqlDataType, context.requestedSqlDataType])
        return next.transformValueFromDB(value, context)
    }
}
const day: SqlDataType = { family: 'datetime', fields: 'date' }
const dayAdapter = withSqlDataType(day, new DateAsTextAdapter())
class TEvent extends Table<DBConnection, 'TEvent'> {
    id = this.primaryKey('id', 'int')
    day = this.column('day', 'localDate', dayAdapter)
    constructor() {
        super('event')
    }
}
const tEvent = new TEvent()

describe('the SQL data type in the context of a type adapter', () => {
    test('it-is-read-and-set-in-each-transformation', async () => {
        let captured: { params: (SqlDataType | undefined)[][], columns: (SqlDataType | undefined)[][] } | undefined
        const conn = new DBConnection(new MockQueryRunner((_type, query, params) => {
            const context = getQueryContext(query, params)
            captured = { params: params.map((_, index) => [context.getParam(index)?.originalSqlDataType, context.getParam(index)?.requestedSqlDataType]), columns: (context.resultColumns ?? []).map(column => [column.originalSqlDataType, column.requestedSqlDataType]) }
            return [{ day: '2024-01-15' }]
        }))
        const rows = await conn.selectFrom(tEvent).where(tEvent.day.equals(new Date('2024-01-15T00:00:00Z'))).select({ day: tEvent.day }).executeSelectMany()
        expect(rows).toEqual([{ day: new Date('2024-01-15T10:00:00.000Z') }])
        // The parameter and the column of the result keep the original type, and request the one the adapter set
        expect(captured).toEqual({ params: [[day, asText]], columns: [[day, asText]] })
        // Each transformation saw the SQL data type of the column as the original and the requested one; reading, the
        // one its projection requested
        expect(dayAdapter.seen.slice(0, 2)).toEqual([[day, day], [day, day]])
        expect(dayAdapter.seen[dayAdapter.seen.length - 1]).toEqual([day, asText])
    })
})

describe('the native name, built once for each class of connection', () => {
    test('it-is-built-once-and-kept-hidden-in-the-sql-data-type', () => {
        let builds = 0
        class Counted extends PostgreSqlConnection<'Counted'> {
            protected override buildNativeSqlDataTypeOf(sqlDataType: SqlDataType): string | undefined {
                builds++
                return super.buildNativeSqlDataTypeOf(sqlDataType)
            }
        }
        class Oracle21 extends OracleConnection<'Oracle21'> { protected override compatibilityVersion = 21_000_000 }
        const type: SqlDataType = { family: 'exact numeric', precision: 18, scale: 4 }
        const json: SqlDataType = { family: 'document', format: 'json' }
        const first = new Counted(new NoExecutionQueryRunner())
        const second = new Counted(new NoExecutionQueryRunner())
        expect([first.nativeSqlDataTypeOf(type), first.nativeSqlDataTypeOf(type), second.nativeSqlDataTypeOf(type)]).toEqual(['numeric(18, 4)', 'numeric(18, 4)', 'numeric(18, 4)'])
        expect(builds).toBe(1)
        // Another class has its own entry; undefined (a type the database can't hold) is kept too
        const oracle = new Oracle21(new NoExecutionQueryRunner())
        expect(oracle.nativeSqlDataTypeOf(type)).toBe('NUMBER(18, 4)')
        expect([first.nativeSqlDataTypeOf({ family: 'row version' }), first.nativeSqlDataTypeOf(json)]).toEqual([undefined, 'json'])
        // Hidden: a copy, the JSON and the keys of the SQL data type don't see it
        expect(JSON.stringify(type)).toBe('{"family":"exact numeric","precision":18,"scale":4}')
        expect(Object.keys({ ...type })).toEqual(['family', 'precision', 'scale'])
    })
})

describe('the conversion of the types in the configuration of the connection', () => {
    test('a-query-runner-reads-the-native-name-of-a-parameter', async () => {
        let natives: (string | undefined)[] = []
        const conn = new DBConnection(new MockQueryRunner((_type, query, params) => {
            const context = getQueryContext(query, params)
            const configuration = context.connectionConfiguration!
            natives = params.map((_, index) => {
                const sqlDataType = context.getParam(index)?.requestedSqlDataType
                return sqlDataType === undefined ? undefined : configuration.nativeSqlDataTypeOf(sqlDataType)
            })
            expect(configuration.sqlDataTypeFrom('int4')).toEqual({ family: 'exact numeric', scale: 0, bytes: 4, native: { postgreSql: 'int4' } })
            return []
        }))
        await conn.selectFrom(tProduct).where(tProduct.price.equals('2.25')).and(tProduct.code.equals('A')).and(tProduct.name.equals('x')).select({ id: tProduct.id }).executeSelectMany()
        expect(natives).toEqual(['numeric(18, 4)', 'character varying(20)', undefined])
    })
})

describe('a custom boolean column projected by a with', () => {
    test('the-column-of-the-with-is-a-boolean-without-the-adapter-nor-its-sql-data-type', async () => {
        const yesNo = withSqlDataType({ family: 'character string', length: 1, fixed: true }, new CustomBooleanTypeAdapter('Y', 'N'))
        class TFlag extends Table<DBConnection, 'TFlag'> {
            id = this.column('id', 'int')
            active = this.column('active', 'boolean', yesNo)
            constructor() { super('flag') }
        }
        const tFlag = new TFlag()
        let lastQuery = ''
        let lastParams: any[] = []
        const conn = new DBConnection(new MockQueryRunner((_type, query, params) => {
            lastQuery = query
            lastParams = params
            return [{ active: true }]
        }))
        const flags = conn.selectFrom(tFlag).select({ id: tFlag.id, active: tFlag.active }).forUseInQueryAs('flags')
        const rows = await conn.selectFrom(flags).select({ active: flags.active }).executeSelectMany()
        // The with already writes the boolean of the database: the column of the with is that boolean
        expect(lastQuery).toBe("with flags as (select id as id, (active = 'Y') as active from flag) select active as active from flags")
        expect(rows).toEqual([{ active: true }])
        expect(getQueryContext(lastQuery, lastParams).resultColumns?.[0]?.originalSqlDataType).toBeUndefined()
    })
})
