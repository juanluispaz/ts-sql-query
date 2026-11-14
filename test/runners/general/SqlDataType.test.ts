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
import { CustomBooleanTypeAdapter, withSqlDataType, type SqlDataType } from '../../../src/TypeAdapter.js'
import { reasonOf } from '../lib/runnerContract.js'

const price: SqlDataType = { family: 'exact numeric', precision: 18, scale: 4 }
const code: SqlDataType = { family: 'character string', length: 20, national: false }

class DBConnection extends PostgreSqlConnection<'DBConnection'> { }

class TProduct extends Table<DBConnection, 'TProduct'> {
    id = this.primaryKey('id', 'int')
    price = this.column<string, 'Price'>('price', 'customDecimal', 'Price', withSqlDataType(price))
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
        expect(new SqlServer(new NoExecutionQueryRunner('sqlServer')).nativeSqlDataTypeOf(timestamp)).toBe('datetime')
        expect(new DBConnection(new NoExecutionQueryRunner('postgreSql')).nativeSqlDataTypeOf(timestamp)).toBe('timestamp(3) without time zone')
        expect(new Oracle(new NoExecutionQueryRunner('oracle')).nativeSqlDataTypeOf(timestamp)).toBe('TIMESTAMP(3)')
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
        expect(new Oracle21(new NoExecutionQueryRunner('oracle')).nativeSqlDataTypeOf(json)).toBe('JSON')
        expect(new Oracle19(new NoExecutionQueryRunner('oracle')).nativeSqlDataTypeOf(json)).toBeUndefined()
        expect(new SqlServer2025(new NoExecutionQueryRunner('sqlServer')).nativeSqlDataTypeOf(json)).toBe('json')
        expect(new SqlServer2022(new NoExecutionQueryRunner('sqlServer')).nativeSqlDataTypeOf(json)).toBeUndefined()
    })
    test('a-type-the-library-stores-in-another-follows-the-strategy', () => {
        class OracleRaw extends OracleConnection<'OracleRaw'> { }
        class OracleText extends OracleConnection<'OracleText'> { protected override uuidStrategy = 'string' as const }
        class OracleBoolean extends OracleConnection<'OracleBoolean'> { protected override booleanStorage = 'boolean' as const }
        const oracle = new OracleRaw(new NoExecutionQueryRunner('oracle'))
        expect(oracle.nativeSqlDataTypeOf(uuid)).toBe('RAW(16)')
        expect(new OracleText(new NoExecutionQueryRunner('oracle')).nativeSqlDataTypeOf(uuid)).toBe('VARCHAR2(36)')
        expect(oracle.nativeSqlDataTypeOf({ family: 'boolean' })).toBe('NUMBER(1)')
        expect(new OracleBoolean(new NoExecutionQueryRunner('oracle')).nativeSqlDataTypeOf({ family: 'boolean' })).toBe('BOOLEAN')
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
                params: params.map((_, index) => context.getParam(index)?.sqlDataType),
                columns: (context.resultColumns ?? []).map(column => column.sqlDataType),
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
        const context = await contextOf(conn => conn.selectFromNoTable().select({ v: conn.const('1.5', 'customDecimal', 'Price') }).executeSelectMany())
        expect(context.params).toEqual([undefined])
    })
})
