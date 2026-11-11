// The name of a `with` (a select used with forUseInQueryAs, or Values) is written in its definition as it is written
// where it is used: quoted when it is a reserved word of the database or has a space, on every database. On PGlite and
// SQLite, the query runs and returns its rows.

import { Database } from 'bun:sqlite'
import { describe, expect, test } from '../../lib/testRunner.js'
import { MariaDBConnection } from '../../../src/connections/MariaDBConnection.js'
import { MySqlConnection } from '../../../src/connections/MySqlConnection.js'
import { OracleConnection } from '../../../src/connections/OracleConnection.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { SqlServerConnection } from '../../../src/connections/SqlServerConnection.js'
import { SqliteConnection } from '../../../src/connections/SqliteConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { PgLiteQueryRunner } from '../../../src/queryRunners/PgLiteQueryRunner.js'
import { BunSqliteQueryRunner } from '../../../src/queryRunners/BunSqliteQueryRunner.js'
import { Table } from '../../../src/Table.js'
import { Values } from '../../../src/Values.js'
import { isRealDbEnabled } from '../../lib/backends.js'

class PostgreSqlDB extends PostgreSqlConnection<'PostgreSqlDB'> { }
class OracleDB extends OracleConnection<'OracleDB'> { }
class SqlServerDB extends SqlServerConnection<'SqlServerDB'> { }
class MySqlDB extends MySqlConnection<'MySqlDB'> { }
class MariaDB extends MariaDBConnection<'MariaDB'> { }
class SqliteDB extends SqliteConnection<'SqliteDB'> { }

type AnyDB = PostgreSqlDB | OracleDB | SqlServerDB | MySqlDB | MariaDB | SqliteDB

// A select used as a with, and a Values, named `name`, selected from
function queriesWith(conn: AnyDB, name: string) {
    class TItem extends Table<any, 'TItem'> {
        id = this.primaryKey('id', 'int')
        constructor() {
            super('item')
        }
    }
    class VItem extends Values<any, 'VItem'> {
        id = this.column('int')
    }
    const tItem = new TItem()
    const withSelect = (conn as any).selectFrom(tItem).select({ id: tItem.id }).forUseInQueryAs(name)
    // The name of a Values is the name of its class in its type; here it is given at run time
    const withValues = Values.create(VItem, name as never, [{ id: 1 }, { id: 2 }])
    return {
        select: (conn as any).selectFrom(withSelect).select({ id: withSelect.id }).orderBy('id'),
        values: (conn as any).selectFrom(withValues).select({ id: withValues.id }).orderBy('id'),
    }
}

describe('The name of a with', () => {
    test('a-reserved-word-or-a-name-with-a-space-is-quoted-where-it-is-defined-as-where-it-is-used', () => {
        const sqlOf = (conn: AnyDB, name: string) => {
            const queries = queriesWith(conn, name)
            return [queries.select.query(), queries.values.query()]
        }
        expect(sqlOf(new PostgreSqlDB(new MockQueryRunner(() => 1, { database: 'postgreSql' })), 'user')).toEqual([
            'with "user" as (select id as id from item) select id as id from "user" order by id',
            'with "user"(id) as (values ($1::int4), ($2::int4)) select id as id from "user" order by id',
        ])
        expect(sqlOf(new PostgreSqlDB(new MockQueryRunner(() => 1, { database: 'postgreSql' })), 'my items')).toEqual([
            'with "my items" as (select id as id from item) select id as id from "my items" order by id',
            'with "my items"(id) as (values ($1::int4), ($2::int4)) select id as id from "my items" order by id',
        ])
        expect(sqlOf(new OracleDB(new MockQueryRunner(() => 1, { database: 'oracle' })), 'order')).toEqual([
            'with "order" as (select id as id from item) select id as "id" from "order" order by "id"',
            'with "order"(id) as (values (:0), (:1)) select id as "id" from "order" order by "id"',
        ])
        expect(sqlOf(new SqlServerDB(new MockQueryRunner(() => 1, { database: 'sqlServer' })), 'order')).toEqual([
            'with [order] as (select id as id from item) select id as id from [order] order by id',
            'with [order] as (select * from (values (@0), (@1)) as [order](id)) select id as id from [order] order by id',
        ])
        expect(sqlOf(new MySqlDB(new MockQueryRunner(() => 1, { database: 'mySql' })), 'count')).toEqual([
            'with `count` as (select id as id from item) select id as id from `count` order by id',
            'with `count`(id) as (values row(?), row(?)) select id as id from `count` order by id',
        ])
        expect(sqlOf(new MariaDB(new MockQueryRunner(() => 1, { database: 'mariaDB' })), 'system')).toEqual([
            'with `system` as (select id as id from item) select id as id from `system` order by id',
            'with `system`(id) as (values (?), (?)) select id as id from `system` order by id',
        ])
        expect(sqlOf(new SqliteDB(new MockQueryRunner(() => 1, { database: 'sqlite' })), 'recursive')).toEqual([
            'with "recursive" as (select id as id from item) select id as id from "recursive" order by id',
            'with "recursive"(id) as (values (?1), (?2)) select id as id from "recursive" order by id',
        ])
    })

    test.skipIf(!isRealDbEnabled('sqlite', 'native', 'newest', 'bun_sqlite'))('sqlite-runs-a-with-named-with-a-reserved-word-and-with-a-space', async () => {
        const db = new Database(':memory:')
        try {
            db.run('create table item (id int primary key)')
            db.run('insert into item values (1), (2)')
            const conn = new SqliteDB(new BunSqliteQueryRunner(db))
            for (const name of ['recursive', 'my items']) {
                const queries = queriesWith(conn, name)
                expect(await queries.select.executeSelectMany()).toEqual([{ id: 1 }, { id: 2 }])
                expect(await queries.values.executeSelectMany()).toEqual([{ id: 1 }, { id: 2 }])
            }
        } finally {
            db.close()
        }
    })

    test.skipIf(!isRealDbEnabled('postgres', 'wasm', 'newest', 'pglite'))('pglite-runs-a-with-named-with-a-reserved-word-and-with-a-space', async () => {
        const { PGlite } = await import('@electric-sql/pglite')
        const db = await PGlite.create('memory://', { postgresqlconf: ["timezone = 'UTC'"] })
        try {
            await db.exec('create table item (id int primary key); insert into item values (1), (2)')
            const conn = new PostgreSqlDB(new PgLiteQueryRunner(db))
            for (const name of ['user', 'my items']) {
                const queries = queriesWith(conn, name)
                expect(await queries.select.executeSelectMany()).toEqual([{ id: 1 }, { id: 2 }])
                expect(await queries.values.executeSelectMany()).toEqual([{ id: 1 }, { id: 2 }])
            }
        } finally {
            await db.close()
        }
    })
})
