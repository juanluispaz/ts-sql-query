// The types of PostgreSQL as SQL data types and back (sqlDataTypeFrom / nativeSqlDataTypeOf of a connection),
// against the catalogue of the engine (format_type).

import pg from 'pg'
import { afterAll, beforeAll, describe, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { NoExecutionQueryRunner } from '../../../src/queryRunners/NoExecutionQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/postgres/runners.js'
import { checkCatalog, type CatalogCase } from '../lib/sqlDataTypeCatalog.js'


// A connection made only to convert the types: it executes nothing
class IntrospectionConnection extends PostgreSqlConnection<'IntrospectionConnection'> { }
const introspection = new IntrospectionConnection(new NoExecutionQueryRunner())

const cases: CatalogCase[] = [
    { ddl: 'smallint', family: { family: 'exact numeric', scale: 0, bytes: 2 }, canonical: 'int2' },
    { ddl: 'int', family: { family: 'exact numeric', scale: 0, bytes: 4 }, canonical: 'int4' },
    { ddl: 'bigint', family: { family: 'exact numeric', scale: 0, bytes: 8 }, canonical: 'int8' },
    { ddl: 'numeric(18, 4)', family: { family: 'exact numeric', precision: 18, scale: 4 }, canonical: 'numeric(18, 4)' },
    { ddl: 'numeric', family: { family: 'exact numeric' }, canonical: 'numeric' },
    { ddl: 'real', family: { family: 'approximate numeric', precision: 24 }, canonical: 'float4' },
    { ddl: 'float8', family: { family: 'approximate numeric', precision: 53 }, canonical: 'float8' },
    { ddl: 'bool', family: { family: 'boolean' }, canonical: 'boolean' },
    { ddl: 'varchar(20)', family: { family: 'character string', length: 20 }, canonical: 'varchar(20)' },
    { ddl: 'varchar', family: { family: 'character string' }, canonical: 'text' },
    { ddl: 'char(5)', family: { family: 'character string', length: 5, fixed: true }, canonical: 'char(5)' },
    { ddl: 'text', family: { family: 'character string' }, canonical: 'text' },
    { ddl: '"char"', family: { family: 'character string', length: 1, lengthUnit: 'octets', fixed: true }, canonical: 'char(1)' },
    { ddl: 'name', family: { family: 'character string', length: 63, lengthUnit: 'octets' }, canonical: 'varchar(63)' },
    { ddl: 'bytea', family: { family: 'binary string' }, canonical: 'bytea' },
    { ddl: 'date', family: { family: 'datetime', fields: 'date' }, canonical: 'date' },
    { ddl: 'time', family: { family: 'datetime', fields: 'time', timeZone: 'none' }, canonical: 'time' },
    { ddl: 'time(3)', family: { family: 'datetime', fields: 'time', precision: 3, timeZone: 'none' }, canonical: 'time(3)' },
    { ddl: 'timetz(2)', family: { family: 'datetime', fields: 'time', precision: 2, timeZone: 'kept' }, canonical: 'timetz(2)' },
    { ddl: 'timestamp', family: { family: 'datetime', fields: 'timestamp', timeZone: 'none' }, canonical: 'timestamp' },
    { ddl: 'timestamp(3)', family: { family: 'datetime', fields: 'timestamp', precision: 3, timeZone: 'none' }, canonical: 'timestamp(3)' },
    { ddl: 'timestamptz', family: { family: 'datetime', fields: 'timestamp', timeZone: 'instant' }, canonical: 'timestamptz' },
    { ddl: 'interval', family: { family: 'interval' }, canonical: 'interval' },
    { ddl: 'interval year to month', family: { family: 'interval', fields: 'year to month' }, canonical: 'interval year to month' },
    { ddl: 'interval hour to minute', family: { family: 'interval', fields: 'hour to minute' }, canonical: 'interval hour to minute' },
    { ddl: 'interval day to second(3)', family: { family: 'interval', fields: 'day to second', precision: 3 }, canonical: 'interval day to second(3)' },
    { ddl: 'uuid', family: { family: 'uuid' }, canonical: 'uuid' },
    { ddl: 'json', family: { family: 'document', format: 'json' }, canonical: 'json' },
    { ddl: 'jsonb', family: { family: 'document', format: 'jsonb' }, canonical: 'jsonb' },
    { ddl: 'xml', family: { family: 'document', format: 'xml' }, canonical: 'xml' },
    { ddl: 'jsonpath', family: { family: 'document', format: 'jsonpath' }, canonical: 'jsonpath' },
    { ddl: 'point', family: { family: 'spatial', model: 'planar', subtype: 'point' }, canonical: 'point' },
    { ddl: 'circle', family: { family: 'spatial', model: 'planar', subtype: 'circle' }, canonical: 'circle' },
    { ddl: 'inet', family: { family: 'network address', kind: 'inet' }, canonical: 'inet' },
    { ddl: 'macaddr8', family: { family: 'network address', kind: 'macaddr8' }, canonical: 'macaddr8' },
    { ddl: 'bit(3)', family: { family: 'bit string', length: 3, fixed: true }, canonical: 'bit(3)' },
    { ddl: 'varbit(5)', family: { family: 'bit string', length: 5 }, canonical: 'bit varying(5)' },
    { ddl: 'money', family: { family: 'money' }, canonical: 'money' },
    { ddl: 'tsvector', family: { family: 'text search', kind: 'document' }, canonical: 'tsvector' },
    { ddl: 'tsquery', family: { family: 'text search', kind: 'query' }, canonical: 'tsquery' },
    { ddl: 'tid', family: { family: 'row locator', kind: 'physical' }, canonical: 'tid' },
    { ddl: 'oid', family: { family: 'system', kind: 'oid' }, canonical: 'oid' },
    { ddl: 'regclass', family: { family: 'system', kind: 'oid' }, canonical: 'oid' },
    { ddl: 'xid8', family: { family: 'system', kind: 'xid8' }, canonical: 'xid8' },
    { ddl: 'pg_lsn', family: { family: 'system', kind: 'pg_lsn' }, canonical: 'pg_lsn' },
    { ddl: 'integer[]', family: { family: 'collection', kind: 'array', of: { family: 'exact numeric', scale: 0, bytes: 4 } }, canonical: 'int4[]' },
    { ddl: 'varchar(10)[]', family: { family: 'collection', kind: 'array', of: { family: 'character string', length: 10 } }, canonical: 'varchar(10)[]' },
    { ddl: 'int8range', family: { family: 'collection', kind: 'range', of: { family: 'exact numeric', scale: 0, bytes: 8 } }, canonical: 'int8range' },
    { ddl: 'tstzrange', family: { family: 'collection', kind: 'range', of: { family: 'datetime', fields: 'timestamp', timeZone: 'instant' } }, canonical: 'tstzrange' },
    { ddl: 'datemultirange', family: { family: 'collection', kind: 'multirange', of: { family: 'datetime', fields: 'date' } }, canonical: 'datemultirange' },
]

describe.skipIf(!isRealDbEnabled('postgres', 'docker', 'newest', 'pg'))('PostgreSQL: the types of the catalogue as SQL data types', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    let client: pg.Client | undefined
    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
        client = new pg.Client({ connectionString: db.uri })
        await client.connect()
    }, 300_000)
    afterAll(async () => {
        await client?.end()
        await db?.release()
    }, 300_000)

    test('every-type-and-back', async () => {
        await checkCatalog({
            database: 'postgreSql',
            from: name => introspection.sqlDataTypeFrom(name),
            of: type => introspection.nativeSqlDataTypeOf(type),
            createTable: async (table, columns) => { await client!.query(`create table ${table} (${columns.join(', ')})`) },
            catalogTypes: async (table) => (await client!.query(`select format_type(atttypid, atttypmod) as t from pg_attribute where attrelid = '${table}'::regclass and attnum > 0 and not attisdropped order by attnum`)).rows.map(row => row.t),
            dropTable: async (table) => { await client!.query(`drop table if exists ${table}`) },
        }, cases, 'rt_sql_data_types')
    })
})
