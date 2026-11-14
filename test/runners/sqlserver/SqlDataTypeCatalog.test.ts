// The types of SQL Server as SQL data types and back (sqlDataTypeFrom / nativeSqlDataTypeOf of a connection),
// against the catalogue of the engine: the name of sys.types with the length, precision and scale of sys.columns, as
// a generator writes them.

import { afterAll, beforeAll, describe, test } from '../../lib/testRunner.js'
import { SqlServerConnection } from '../../../src/connections/SqlServerConnection.js'
import { NoExecutionQueryRunner } from '../../../src/queryRunners/NoExecutionQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/sqlserver/runners.js'
import { checkCatalog, type CatalogCase } from '../lib/sqlDataTypeCatalog.js'


// A connection made only to convert the types: it executes nothing
class IntrospectionConnection extends SqlServerConnection<'IntrospectionConnection'> { }
const introspection = new IntrospectionConnection(new NoExecutionQueryRunner('sqlServer'))

const cases: CatalogCase[] = [
    { ddl: 'tinyint', family: { family: 'exact numeric', scale: 0, bytes: 1, unsigned: true }, canonical: 'tinyint' },
    { ddl: 'smallint', family: { family: 'exact numeric', scale: 0, bytes: 2 }, canonical: 'smallint' },
    { ddl: 'int', family: { family: 'exact numeric', scale: 0, bytes: 4 }, canonical: 'int' },
    { ddl: 'bigint', family: { family: 'exact numeric', scale: 0, bytes: 8 }, canonical: 'bigint' },
    { ddl: 'decimal(18, 4)', family: { family: 'exact numeric', precision: 18, scale: 4 }, canonical: 'decimal(18, 4)' },
    { ddl: 'numeric', family: { family: 'exact numeric', precision: 18, scale: 0 }, canonical: 'decimal(18, 0)' },
    { ddl: 'money', family: { family: 'money', scale: 4 }, canonical: 'money' },
    { ddl: 'smallmoney', family: { family: 'money', scale: 4 }, canonical: 'money' },
    { ddl: 'real', family: { family: 'approximate numeric', precision: 24 }, canonical: 'real' },
    { ddl: 'float', family: { family: 'approximate numeric', precision: 53 }, canonical: 'float' },
    { ddl: 'bit', family: { family: 'boolean' }, canonical: 'bit' },
    { ddl: 'char(5)', family: { family: 'character string', length: 5, fixed: true, national: false }, canonical: 'char(5)' },
    { ddl: 'varchar(20)', family: { family: 'character string', length: 20, national: false }, canonical: 'varchar(20)' },
    { ddl: 'varchar(max)', family: { family: 'character string', national: false, largeObject: true }, canonical: 'varchar(max)' },
    { ddl: 'nchar(3)', family: { family: 'character string', length: 3, fixed: true, national: true }, canonical: 'nchar(3)' },
    { ddl: 'nvarchar(20)', family: { family: 'character string', length: 20, national: true }, canonical: 'nvarchar(20)' },
    { ddl: 'nvarchar(max)', family: { family: 'character string', national: true, largeObject: true }, canonical: 'nvarchar(max)' },
    { ddl: 'binary(4)', family: { family: 'binary string', length: 4, fixed: true }, canonical: 'binary(4)' },
    { ddl: 'varbinary(8)', family: { family: 'binary string', length: 8 }, canonical: 'varbinary(8)' },
    { ddl: 'varbinary(max)', family: { family: 'binary string', largeObject: true }, canonical: 'varbinary(max)' },
    { ddl: 'date', family: { family: 'datetime', fields: 'date' }, canonical: 'date' },
    { ddl: 'time(3)', family: { family: 'datetime', fields: 'time', precision: 3, timeZone: 'none' }, canonical: 'time(3)' },
    { ddl: 'datetime2', family: { family: 'datetime', fields: 'timestamp', precision: 7, timeZone: 'none' }, canonical: 'datetime2(7)' },
    { ddl: 'datetime2(3)', family: { family: 'datetime', fields: 'timestamp', precision: 3, timeZone: 'none' }, canonical: 'datetime2(3)' },
    // Their own: the family alone is a datetime2
    { ddl: 'datetime', family: { family: 'datetime', fields: 'timestamp', precision: 3, timeZone: 'none' }, canonical: 'datetime2(3)' },
    { ddl: 'smalldatetime', family: { family: 'datetime', fields: 'timestamp', precision: 0, timeZone: 'none' }, canonical: 'datetime2(0)' },
    { ddl: 'datetimeoffset(2)', family: { family: 'datetime', fields: 'timestamp', precision: 2, timeZone: 'kept' }, canonical: 'datetimeoffset(2)' },
    { ddl: 'uniqueidentifier', family: { family: 'uuid' }, canonical: 'uniqueidentifier' },
    { ddl: 'xml', family: { family: 'document', format: 'xml' }, canonical: 'xml' },
    { ddl: 'json', family: { family: 'document', format: 'json' }, canonical: 'json' },
    { ddl: 'geography', family: { family: 'spatial', model: 'geography' }, canonical: 'geography' },
    { ddl: 'rowversion', family: { family: 'row version' }, canonical: 'rowversion' },
    { ddl: 'sql_variant', family: { family: 'variant' }, canonical: 'sql_variant' },
    { ddl: 'hierarchyid', family: { family: 'hierarchy' }, canonical: 'hierarchyid' },
]

/** The type of a column as a generator writes it from sys.types and sys.columns */
function typeOfColumn(row: { type: string, max_length: number, precision: number, scale: number }): string {
    switch (row.type) {
        case 'char': case 'varchar': case 'binary': case 'varbinary':
            return row.type + '(' + (row.max_length === -1 ? 'max' : row.max_length) + ')'
        case 'nchar': case 'nvarchar':
            return row.type + '(' + (row.max_length === -1 ? 'max' : row.max_length / 2) + ')'
        case 'decimal': case 'numeric':
            return row.type + '(' + row.precision + ',' + row.scale + ')'
        case 'time': case 'datetime2': case 'datetimeoffset':
            return row.type + '(' + row.scale + ')'
        default:
            return row.type
    }
}

describe.skipIf(!isRealDbEnabled('sqlserver', 'docker', 'newest', 'mssql'))('SQL Server: the types of the catalogue as SQL data types', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    let pool: import('mssql').ConnectionPool | undefined
    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
        pool = await new db.mssql.ConnectionPool({ ...db.config, pool: { max: 2, min: 0 } }).connect()
    }, 300_000)
    afterAll(async () => {
        await pool?.close()
        await db?.release()
    }, 300_000)

    test('every-type-and-back', async () => {
        await checkCatalog({
            database: 'sqlServer',
            from: name => introspection.sqlDataTypeFrom(name),
            of: type => introspection.nativeSqlDataTypeOf(type),
            createTable: async (table, columns) => { await pool!.request().query(`create table ${table} (${columns.join(', ')})`) },
            catalogTypes: async (table) => (await pool!.request().query(`select t.name as type, c.max_length, c.precision, c.scale from sys.columns c join sys.types t on c.user_type_id = t.user_type_id where c.object_id = object_id('${table}') order by c.column_id`)).recordset.map(typeOfColumn),
            dropTable: async (table) => { await pool!.request().query(`drop table if exists ${table}`) },
        }, cases, 'rt_sql_data_types')
    })
})
