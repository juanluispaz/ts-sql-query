// The name of a recursive select (recursive_select_<n>) is given by the query that writes it: it doesn't depend on the
// queries defined or executed before, and two recursive selects of the same query get different names, also when a
// query is executed between their definitions. On PGlite and SQLite, the union of two recursive selects runs.

import { Database } from 'bun:sqlite'
import { describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { SqliteConnection } from '../../../src/connections/SqliteConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { PgLiteQueryRunner } from '../../../src/queryRunners/PgLiteQueryRunner.js'
import { BunSqliteQueryRunner } from '../../../src/queryRunners/BunSqliteQueryRunner.js'
import { Table } from '../../../src/Table.js'
import { isRealDbEnabled } from '../../lib/backends.js'

class PostgreSqlDB extends PostgreSqlConnection<'PostgreSqlDB'> { }
class SqliteDB extends SqliteConnection<'SqliteDB'> { }

class TPgItem extends Table<PostgreSqlDB, 'TPgItem'> {
    id = this.primaryKey('id', 'int')
    parentId = this.optionalColumn('parent_id', 'int')
    constructor() {
        super('item')
    }
}
class TSqliteItem extends Table<SqliteDB, 'TSqliteItem'> {
    id = this.primaryKey('id', 'int')
    parentId = this.optionalColumn('parent_id', 'int')
    constructor() {
        super('item')
    }
}

// The ancestors of item 3 and the descendants of item 1, defined with a query executed between them
async function ancestorsUnionDescendants(conn: PostgreSqlDB, tItem: TPgItem): Promise<{ query: string, rows: unknown }>
async function ancestorsUnionDescendants(conn: SqliteDB, tItem: TSqliteItem): Promise<{ query: string, rows: unknown }>
async function ancestorsUnionDescendants(conn: any, tItem: any): Promise<{ query: string, rows: unknown }> {
    const ancestors = conn.selectFrom(tItem).where(tItem.id.equals(3)).select({ id: tItem.id, parentId: tItem.parentId })
        .recursiveUnionAll((parent: any) => conn.selectFrom(tItem).join(parent).on(tItem.id.equals(parent.parentId)).select({ id: tItem.id, parentId: tItem.parentId }))
    await conn.selectFrom(tItem).select({ id: tItem.id }).executeSelectMany()
    const descendants = conn.selectFrom(tItem).where(tItem.id.equals(1)).select({ id: tItem.id, parentId: tItem.parentId })
        .recursiveUnionAll((child: any) => conn.selectFrom(tItem).join(child).on(tItem.parentId.equals(child.id)).select({ id: tItem.id, parentId: tItem.parentId }))
    const query = ancestors.union(descendants).orderBy('id')
    return { query: query.query(), rows: await query.executeSelectMany() }
}

const items = [{ id: 1, parentId: null }, { id: 2, parentId: 1 }, { id: 3, parentId: 2 }]
const expectedRows = [{ id: 1 }, { id: 2, parentId: 1 }, { id: 3, parentId: 2 }]

describe('The name of a recursive select', () => {
    test('two-recursive-selects-of-a-query-get-different-names-whatever-was-executed-between-them', async () => {
        const conn = new PostgreSqlDB(new MockQueryRunner((type) => type === 'selectManyRows' ? [] : 0, { database: 'postgreSql' }))
        const { query } = await ancestorsUnionDescendants(conn, new TPgItem())
        expect(query).toBe('with recursive recursive_select_1 as (select id as id, parent_id as parentId from item where id = $1 union all select item.id as id, item.parent_id as parentId from item join recursive_select_1 on item.id = recursive_select_1.parentId), recursive_select_2 as (select id as id, parent_id as parentId from item where id = $2 union all select item.id as id, item.parent_id as parentId from item join recursive_select_2 on item.parent_id = recursive_select_2.id) select id as id, parentId as "parentId" from recursive_select_1 union select id as id, parentId as "parentId" from recursive_select_2 order by id')
    })

    test('the-name-does-not-depend-on-the-queries-defined-before', () => {
        const conn = new PostgreSqlDB(new MockQueryRunner(() => 0, { database: 'postgreSql' }))
        const tItem = new TPgItem()
        const recursive = () => conn.selectFrom(tItem).where(tItem.id.equals(3)).select({ id: tItem.id, parentId: tItem.parentId })
            .recursiveUnionAll((parent) => conn.selectFrom(tItem).join(parent).on(tItem.id.equals(parent.parentId)).select({ id: tItem.id, parentId: tItem.parentId }))
        recursive()
        recursive()
        expect(recursive().query()).toBe('with recursive recursive_select_1 as (select id as id, parent_id as parentId from item where id = $1 union all select item.id as id, item.parent_id as parentId from item join recursive_select_1 on item.id = recursive_select_1.parentId) select id as id, parentId as "parentId" from recursive_select_1')
    })

    test.skipIf(!isRealDbEnabled('postgres', 'wasm', 'newest', 'pglite'))('pglite-runs-the-union-of-two-recursive-selects', async () => {
        const { PGlite } = await import('@electric-sql/pglite')
        const db = await PGlite.create('memory://', { postgresqlconf: ["timezone = 'UTC'"] })
        try {
            await db.exec('create table item (id int primary key, parent_id int); insert into item values (1, null), (2, 1), (3, 2)')
            const { rows } = await ancestorsUnionDescendants(new PostgreSqlDB(new PgLiteQueryRunner(db)), new TPgItem())
            expect(rows).toEqual(expectedRows)
        } finally {
            await db.close()
        }
    })

    test.skipIf(!isRealDbEnabled('sqlite', 'native', 'newest', 'bun_sqlite'))('sqlite-runs-the-union-of-two-recursive-selects', async () => {
        const db = new Database(':memory:')
        try {
            db.run('create table item (id int primary key, parent_id int)')
            for (const item of items) {
                db.run('insert into item values (?, ?)', [item.id, item.parentId])
            }
            const { rows } = await ancestorsUnionDescendants(new SqliteDB(new BunSqliteQueryRunner(db)), new TSqliteItem())
            expect(rows).toEqual(expectedRows)
        } finally {
            db.close()
        }
    })
})
