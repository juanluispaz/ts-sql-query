// The types of Oracle as SQL data types and back (sqlDataTypeFrom / nativeSqlDataTypeOf of a connection), against the
// catalogue of the engine: the DATA_TYPE of user_tab_columns with its precision, scale and length, as a generator
// writes them.

import { afterAll, beforeAll, describe, test } from '../../lib/testRunner.js'
import { OracleConnection } from '../../../src/connections/OracleConnection.js'
import { NoExecutionQueryRunner } from '../../../src/queryRunners/NoExecutionQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/oracle/runners.js'
import { checkCatalog, type CatalogCase } from '../lib/sqlDataTypeCatalog.js'


// A connection made only to convert the types: it executes nothing
class IntrospectionConnection extends OracleConnection<'IntrospectionConnection'> { }
const introspection = new IntrospectionConnection(new NoExecutionQueryRunner())

const cases: CatalogCase[] = [
    { ddl: 'number(18, 4)', family: { family: 'exact numeric', precision: 18, scale: 4 }, canonical: 'NUMBER(18, 4)' },
    { ddl: 'number(10)', family: { family: 'exact numeric', precision: 10, scale: 0 }, canonical: 'NUMBER(10, 0)' },
    { ddl: 'number', family: { family: 'exact numeric' }, canonical: 'NUMBER' },
    // As Oracle keeps it: a NUMBER(38, 0)
    { ddl: 'integer', family: { family: 'exact numeric', precision: 38, scale: 0 }, canonical: 'NUMBER(38, 0)' },
    { ddl: 'float', family: { family: 'approximate numeric', precision: 126 }, canonical: 'BINARY_DOUBLE' },
    { ddl: 'binary_float', family: { family: 'approximate numeric', precision: 24 }, canonical: 'BINARY_FLOAT' },
    { ddl: 'binary_double', family: { family: 'approximate numeric', precision: 53 }, canonical: 'BINARY_DOUBLE' },
    { ddl: 'boolean', family: { family: 'boolean' }, canonical: 'NUMBER(1)' },
    { ddl: 'char(5)', family: { family: 'character string', length: 5, lengthUnit: 'octets', fixed: true }, canonical: 'CHAR(5 BYTE)' },
    { ddl: 'varchar2(20 char)', family: { family: 'character string', length: 20, lengthUnit: 'characters' }, canonical: 'VARCHAR2(20 CHAR)' },
    { ddl: 'varchar2(20)', family: { family: 'character string', length: 20, lengthUnit: 'octets' }, canonical: 'VARCHAR2(20 BYTE)' },
    { ddl: 'nchar(3)', family: { family: 'character string', length: 3, fixed: true, national: true }, canonical: 'NCHAR(3)' },
    { ddl: 'nvarchar2(20)', family: { family: 'character string', length: 20, national: true }, canonical: 'NVARCHAR2(20)' },
    { ddl: 'clob', family: { family: 'character string', largeObject: true }, canonical: 'CLOB' },
    { ddl: 'nclob', family: { family: 'character string', national: true, largeObject: true }, canonical: 'NCLOB' },
    { ddl: 'raw(16)', family: { family: 'binary string', length: 16 }, canonical: 'RAW(16)' },
    { ddl: 'blob', family: { family: 'binary string', largeObject: true }, canonical: 'BLOB' },
    // Its own: the family alone is a TIMESTAMP(0)
    { ddl: 'date', family: { family: 'datetime', fields: 'timestamp', precision: 0, timeZone: 'none' }, canonical: 'TIMESTAMP(0)' },
    { ddl: 'timestamp(3)', family: { family: 'datetime', fields: 'timestamp', precision: 3, timeZone: 'none' }, canonical: 'TIMESTAMP(3)' },
    { ddl: 'timestamp with local time zone', family: { family: 'datetime', fields: 'timestamp', precision: 6, timeZone: 'session' }, canonical: 'TIMESTAMP(6) WITH LOCAL TIME ZONE' },
    { ddl: 'timestamp(2) with time zone', family: { family: 'datetime', fields: 'timestamp', precision: 2, timeZone: 'kept' }, canonical: 'TIMESTAMP(2) WITH TIME ZONE' },
    { ddl: 'interval year to month', family: { family: 'interval', fields: 'year to month' }, canonical: 'INTERVAL YEAR TO MONTH' },
    { ddl: 'interval day to second(3)', family: { family: 'interval', fields: 'day to second', precision: 3 }, canonical: 'INTERVAL DAY TO SECOND(3)' },
    { ddl: 'json', family: { family: 'document', format: 'json' }, canonical: 'JSON' },
    { ddl: 'urowid', family: { family: 'row locator', kind: 'universal' }, canonical: 'UROWID' },
    { ddl: 'rowid', family: { family: 'row locator', kind: 'physical' }, canonical: 'ROWID' },
]

/** The type of a column as a generator writes it from user_tab_columns */
function typeOfColumn(row: { DATA_TYPE: string, DATA_PRECISION: number | null, DATA_SCALE: number | null, DATA_LENGTH: number, CHAR_LENGTH: number, CHAR_USED: string | null }): string {
    switch (row.DATA_TYPE) {
        case 'NUMBER':
            if (row.DATA_PRECISION === null && row.DATA_SCALE === null) return 'NUMBER'
            return 'NUMBER(' + (row.DATA_PRECISION ?? 38) + ',' + (row.DATA_SCALE ?? 0) + ')'
        case 'FLOAT':
            return 'FLOAT(' + row.DATA_PRECISION + ')'
        case 'CHAR': case 'VARCHAR2':
            return row.DATA_TYPE + '(' + row.CHAR_LENGTH + (row.CHAR_USED === 'C' ? ' CHAR' : ' BYTE') + ')'
        case 'NCHAR': case 'NVARCHAR2':
            return row.DATA_TYPE + '(' + row.CHAR_LENGTH + ')'
        case 'RAW':
            return 'RAW(' + row.DATA_LENGTH + ')'
        default:
            return row.DATA_TYPE
    }
}

describe.skipIf(!isRealDbEnabled('oracle', 'docker', 'newest', 'oracledb'))('Oracle: the types of the catalogue as SQL data types', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    let connection: import('oracledb').Connection | undefined
    let oracledb: typeof import('oracledb') | undefined
    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
        oracledb = (await import('oracledb')).default
        connection = await oracledb.getConnection({ user: db.user, password: db.password, connectString: db.connectString })
    }, 300_000)
    afterAll(async () => {
        await connection?.close()
        await db?.release()
    }, 300_000)

    test('every-type-and-back', async () => {
        await checkCatalog({
            database: 'oracle',
            from: name => introspection.sqlDataTypeFrom(name),
            of: type => introspection.nativeSqlDataTypeOf(type),
            createTable: async (table, columns) => { await connection!.execute(`create table ${table} (${columns.join(', ')})`) },
            catalogTypes: async (table) => ((await connection!.execute(`select data_type, data_precision, data_scale, data_length, char_length, char_used from user_tab_columns where table_name = upper(:0) order by column_id`, [table], { outFormat: oracledb!.OUT_FORMAT_OBJECT })).rows as any[]).map(typeOfColumn),
            dropTable: async (table) => { try { await connection!.execute(`drop table ${table} purge`) } catch { /* it doesn't exist */ } },
        }, cases, 'rt_sql_data_types')
    })
})
