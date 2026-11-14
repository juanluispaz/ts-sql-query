// The types of SQLite as SQL data types and back (sqlDataTypeFrom / nativeSqlDataTypeOf of a connection), against the
// declarations SQLite keeps (pragma table_info): the six types of a STRICT table as they are, and in a table that isn't
// STRICT, the declared name read as the type of another database.

import Database from 'better-sqlite3'
import { describe, test } from '../../lib/testRunner.js'
import { SqliteConnection } from '../../../src/connections/SqliteConnection.js'
import { NoExecutionQueryRunner } from '../../../src/queryRunners/NoExecutionQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { checkCatalog, type CatalogCase, type CatalogEngine } from '../lib/sqlDataTypeCatalog.js'


// A connection made only to convert the types: it executes nothing
class IntrospectionConnection extends SqliteConnection<'IntrospectionConnection'> { }
const introspection = new IntrospectionConnection(new NoExecutionQueryRunner('sqlite'))

const strictCases: CatalogCase[] = [
    { ddl: 'INT', family: { family: 'exact numeric', scale: 0, bytes: 8 }, canonical: 'INTEGER' },
    { ddl: 'INTEGER', family: { family: 'exact numeric', scale: 0, bytes: 8 }, canonical: 'INTEGER' },
    { ddl: 'REAL', family: { family: 'approximate numeric', precision: 53 }, canonical: 'REAL' },
    { ddl: 'TEXT', family: { family: 'character string' }, canonical: 'TEXT' },
    { ddl: 'BLOB', family: { family: 'binary string' }, canonical: 'BLOB' },
    { ddl: 'ANY', family: { family: 'variant' }, canonical: 'ANY' },
]

// Not STRICT: the name says the intent; the canonical type is the one of a STRICT table the library stores it in
const declaredCases: CatalogCase[] = [
    { ddl: 'VARCHAR(10)', family: { family: 'character string', length: 10 }, canonical: 'TEXT' },
    { ddl: 'DECIMAL(10, 2)', family: { family: 'exact numeric', precision: 10, scale: 2 }, canonical: 'TEXT' },
    { ddl: 'DATETIME', family: { family: 'datetime', fields: 'timestamp', timeZone: 'none' }, canonical: 'TEXT' },
    { ddl: 'DATE', family: { family: 'datetime', fields: 'date' }, canonical: 'TEXT' },
    { ddl: 'BOOLEAN', family: { family: 'boolean' }, canonical: 'INTEGER' },
    { ddl: 'UUID', family: { family: 'uuid' }, canonical: 'BLOB' },
    { ddl: 'DOUBLE PRECISION', family: { family: 'approximate numeric', precision: 53 }, canonical: 'REAL' },
    { ddl: 'BIGINT', family: { family: 'exact numeric', scale: 0, bytes: 8 }, canonical: 'INTEGER' },
    { ddl: 'MONEYBAG', family: { family: 'user-defined', name: 'MONEYBAG' }, canonical: undefined },
    { ddl: '', family: { family: 'variant' }, canonical: 'ANY' },
]

function engineOf(db: Database.Database, strict: boolean): CatalogEngine {
    return {
        database: 'sqlite',
        from: name => introspection.sqlDataTypeFrom(name),
        of: type => introspection.nativeSqlDataTypeOf(type),
        createTable: async (table, columns) => { db.exec(`create table ${table} (${columns.join(', ')})${strict ? ' strict' : ''}`) },
        catalogTypes: async (table) => (db.prepare(`pragma table_info(${table})`).all() as { type: string }[]).map(row => row.type),
        dropTable: async (table) => { db.exec(`drop table if exists ${table}`) },
    }
}

describe.skipIf(!isRealDbEnabled('sqlite', 'native', 'newest', 'better-sqlite3'))('SQLite: the declared types as SQL data types', () => {
    test('the-types-of-a-strict-table-and-back', async () => {
        const db = new Database(':memory:')
        try {
            await checkCatalog(engineOf(db, true), strictCases, 'rt_sql_data_types')
        } finally {
            db.close()
        }
    })

    test('the-declared-names-of-a-table-not-strict-and-back', async () => {
        const db = new Database(':memory:')
        try {
            await checkCatalog(engineOf(db, false), declaredCases, 'rt_sql_data_types')
        } finally {
            db.close()
        }
    })
})
