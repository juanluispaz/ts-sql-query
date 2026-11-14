// The types of MariaDB as SQL data types and back (MariaDBConnection.sqlDataTypeFrom / nativeSqlDataTypeOf), against the
// catalogue of the engine (the COLUMN_TYPE of information_schema.columns).

import mariadb from 'mariadb'
import { afterAll, beforeAll, describe, test } from '../../lib/testRunner.js'
import { MariaDBConnection } from '../../../src/connections/MariaDBConnection.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mariadb/runners.js'
import { checkCatalog, type CatalogCase } from '../lib/sqlDataTypeCatalog.js'

const integer = (bytes: 1 | 2 | 3 | 4 | 8, unsigned?: boolean) => unsigned ? { family: 'exact numeric' as const, scale: 0, bytes, unsigned } : { family: 'exact numeric' as const, scale: 0, bytes }
const cases: CatalogCase[] = [
    { ddl: 'tinyint', family: integer(1), canonical: 'tinyint' },
    { ddl: 'boolean', family: integer(1), canonical: 'tinyint' },
    { ddl: 'smallint', family: integer(2), canonical: 'smallint' },
    { ddl: 'mediumint unsigned', family: integer(3, true), canonical: 'mediumint unsigned' },
    { ddl: 'int', family: integer(4), canonical: 'int' },
    { ddl: 'bigint unsigned', family: integer(8, true), canonical: 'bigint unsigned' },
    { ddl: 'decimal(18, 4)', family: { family: 'exact numeric', precision: 18, scale: 4 }, canonical: 'decimal(18, 4)' },
    { ddl: 'decimal', family: { family: 'exact numeric', precision: 10, scale: 0 }, canonical: 'decimal(10, 0)' },
    { ddl: 'float', family: { family: 'approximate numeric', precision: 24 }, canonical: 'float' },
    { ddl: 'double', family: { family: 'approximate numeric', precision: 53 }, canonical: 'double' },
    { ddl: 'bit(3)', family: { family: 'bit string', length: 3, fixed: true }, canonical: 'bit(3)' },
    { ddl: 'char(5)', family: { family: 'character string', length: 5, fixed: true }, canonical: 'char(5)' },
    { ddl: 'varchar(20)', family: { family: 'character string', length: 20 }, canonical: 'varchar(20)' },
    { ddl: 'tinytext', family: { family: 'character string', length: 255, largeObject: true }, canonical: 'tinytext' },
    { ddl: 'text', family: { family: 'character string', length: 65535, largeObject: true }, canonical: 'text' },
    { ddl: 'mediumtext', family: { family: 'character string', length: 16777215, largeObject: true }, canonical: 'mediumtext' },
    { ddl: 'longtext', family: { family: 'character string', length: 4294967295, largeObject: true }, canonical: 'longtext' },
    { ddl: 'binary(4)', family: { family: 'binary string', length: 4, fixed: true }, canonical: 'binary(4)' },
    { ddl: 'varbinary(8)', family: { family: 'binary string', length: 8 }, canonical: 'varbinary(8)' },
    { ddl: 'blob', family: { family: 'binary string', length: 65535, largeObject: true }, canonical: 'blob' },
    { ddl: 'longblob', family: { family: 'binary string', length: 4294967295, largeObject: true }, canonical: 'longblob' },
    { ddl: 'date', family: { family: 'datetime', fields: 'date' }, canonical: 'date' },
    { ddl: 'time(3)', family: { family: 'datetime', fields: 'time', precision: 3, timeZone: 'none' }, canonical: 'time(3)' },
    { ddl: 'datetime', family: { family: 'datetime', fields: 'timestamp', timeZone: 'none' }, canonical: 'datetime' },
    { ddl: 'datetime(6)', family: { family: 'datetime', fields: 'timestamp', precision: 6, timeZone: 'none' }, canonical: 'datetime(6)' },
    { ddl: 'timestamp(3) null', family: { family: 'datetime', fields: 'timestamp', precision: 3, timeZone: 'session' }, canonical: 'timestamp(3)' },
    { ddl: 'year', family: { family: 'datetime', fields: 'year' }, canonical: 'year' },
    // MariaDB's json is a longtext with a check
    { ddl: 'json', family: { family: 'character string', length: 4294967295, largeObject: true }, canonical: 'longtext' },
    { ddl: 'uuid', family: { family: 'uuid' }, canonical: 'uuid' },
    { ddl: 'inet4', family: { family: 'network address', kind: 'inet', ipFamily: 4 }, canonical: 'inet4' },
    { ddl: 'inet6', family: { family: 'network address', kind: 'inet', ipFamily: 6 }, canonical: 'inet6' },
    { ddl: 'xmltype', family: { family: 'document', format: 'xml' }, canonical: 'xmltype' },
    { ddl: "enum('a', 'b''s')", family: { family: 'enumeration', values: ['a', "b's"] }, canonical: "enum('a', 'b''s')" },
    { ddl: "set('x', 'y')", family: { family: 'enumeration', values: ['x', 'y'], multiple: true }, canonical: "set('x', 'y')" },
    { ddl: 'geometry', family: { family: 'spatial', model: 'geometry' }, canonical: 'geometry' },
    { ddl: 'point', family: { family: 'spatial', model: 'geometry', subtype: 'point' }, canonical: 'point' },
    { ddl: 'multipolygon', family: { family: 'spatial', model: 'geometry', subtype: 'multipolygon' }, canonical: 'multipolygon' },
    { ddl: 'vector(3)', family: { family: 'vector', dimensions: 3, element: 'float32' }, canonical: 'vector(3)' },
]

describe.skipIf(!isRealDbEnabled('mariadb', 'docker', 'newest', 'mariadb'))('MariaDB: the types of the catalogue as SQL data types', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    let connection: Awaited<ReturnType<typeof mariadb.createConnection>> | undefined
    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
        connection = await mariadb.createConnection({ host: db.host, port: db.port, user: db.user, password: db.password, database: db.database })
    }, 300_000)
    afterAll(async () => {
        await connection?.end()
        await db?.release()
    }, 300_000)

    test('every-type-and-back', async () => {
        await checkCatalog({
            database: 'mariaDB',
            from: name => MariaDBConnection.sqlDataTypeFrom(name),
            of: type => MariaDBConnection.nativeSqlDataTypeOf(type),
            createTable: async (table, columns) => { await connection!.query(`create table ${table} (${columns.join(', ')})`) },
            catalogTypes: async (table) => (await connection!.query(`select column_type as t from information_schema.columns where table_schema = database() and table_name = ? order by ordinal_position`, [table]) as any[]).map(row => String(row.t)),
            dropTable: async (table) => { await connection!.query(`drop table if exists ${table}`) },
        }, cases, 'rt_sql_data_types')
    })
})
