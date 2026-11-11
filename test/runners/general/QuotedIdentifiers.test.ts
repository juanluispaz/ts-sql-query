// A table or a column declared already quoted the way the database quotes an identifier ("Plan", `Plan`, [Plan]) is
// written as it is, on every database; a name the library composes with it (the alias of a column of another table in
// the old values of an update) takes it without its quotes. On PGlite, a table and a column created quoted with upper
// case, read and written through the library.

import { describe, expect, test } from '../../lib/testRunner.js'
import { MariaDBConnection } from '../../../src/connections/MariaDBConnection.js'
import { MySqlConnection } from '../../../src/connections/MySqlConnection.js'
import { OracleConnection } from '../../../src/connections/OracleConnection.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { SqlServerConnection } from '../../../src/connections/SqlServerConnection.js'
import { SqliteConnection } from '../../../src/connections/SqliteConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { PgLiteQueryRunner } from '../../../src/queryRunners/PgLiteQueryRunner.js'
import { Table } from '../../../src/Table.js'
import { isRealDbEnabled } from '../../lib/backends.js'

class PostgreSqlDB extends PostgreSqlConnection<'PostgreSqlDB'> { }
class OracleDB extends OracleConnection<'OracleDB'> { }
class SqlServerDB extends SqlServerConnection<'SqlServerDB'> { }
class MySqlDB extends MySqlConnection<'MySqlDB'> { }
class MariaDB extends MariaDBConnection<'MariaDB'> { }
class SqliteDB extends SqliteConnection<'SqliteDB'> { }

class TPgOrganization extends Table<PostgreSqlDB, 'TPgOrganization'> {
    id = this.primaryKey('id', 'int')
    plan = this.column('"Plan"', 'string')
    constructor() {
        super('"Organization"')
    }
}

// Below PostgreSQL 18 the old values of an update are read from a select in its from
class PostgreSql17DB extends PostgreSqlConnection<'PostgreSql17DB'> {
    protected override compatibilityVersion = 17_000_000
}
class TPg17Organization extends Table<PostgreSql17DB, 'TPg17Organization'> {
    id = this.primaryKey('id', 'int')
    plan = this.column('"Plan"', 'string')
    otherId = this.column('other_id', 'int')
    constructor() {
        super('"Organization"')
    }
}
class TPg17Other extends Table<PostgreSql17DB, 'TPg17Other'> {
    id = this.primaryKey('id', 'int')
    label = this.column('"Label"', 'string')
    constructor() {
        super('"Other"')
    }
}
function updateWithOldValues(conn: PostgreSql17DB) {
    const tOrganization = new TPg17Organization()
    const tOther = new TPg17Other()
    const old = tOrganization.oldValues()
    return conn.update(tOrganization).from(tOther).set({ plan: tOther.label }).where(tOrganization.otherId.equals(tOther.id))
        .returning({ oldPlan: old.plan, plan: tOrganization.plan, label: tOther.label })
}

describe('Identifiers declared quoted', () => {
    test('a-table-and-a-column-declared-quoted-are-written-as-they-are', () => {
        const sqlOf = (conn: any, table: any) => [
            conn.selectFrom(table).where(table.plan.equals('x')).select({ id: table.id, plan: table.plan }).query(),
            conn.insertInto(table).values([{ id: 1, plan: 'a' }, { id: 2, plan: 'b' }]).query(),
            conn.update(table).set({ plan: 'z' }).where(table.id.equals(1)).query(),
        ]
        class TOracle extends Table<OracleDB, 'TOracle'> { id = this.primaryKey('id', 'int'); plan = this.column('"Plan"', 'string'); constructor() { super('"Organization"') } }
        class TSqlServer extends Table<SqlServerDB, 'TSqlServer'> { id = this.primaryKey('id', 'int'); plan = this.column('[Plan]', 'string'); constructor() { super('[Organization]') } }
        class TMySql extends Table<MySqlDB, 'TMySql'> { id = this.primaryKey('id', 'int'); plan = this.column('`Plan`', 'string'); constructor() { super('`Organization`') } }
        class TMariaDB extends Table<MariaDB, 'TMariaDB'> { id = this.primaryKey('id', 'int'); plan = this.column('`Plan`', 'string'); constructor() { super('`Organization`') } }
        class TSqlite extends Table<SqliteDB, 'TSqlite'> { id = this.primaryKey('id', 'int'); plan = this.column('"Plan"', 'string'); constructor() { super('"Organization"') } }
        expect(sqlOf(new PostgreSqlDB(new MockQueryRunner(() => 1, { database: 'postgreSql' })), new TPgOrganization())).toEqual([
            'select id as id, "Plan" as plan from "Organization" where "Plan" = $1',
            'insert into "Organization" (id, "Plan") values ($1, $2), ($3, $4)',
            'update "Organization" set "Plan" = $1 where id = $2',
        ])
        expect(sqlOf(new OracleDB(new MockQueryRunner(() => 1, { database: 'oracle' })), new TOracle())).toEqual([
            'select id as "id", "Plan" as "plan" from "Organization" where "Plan" = :0',
            'begin insert into "Organization" (id, "Plan") values (:0, :1); insert into "Organization" (id, "Plan") values (:2, :3); end;',
            'update "Organization" set "Plan" = :0 where id = :1',
        ])
        expect(sqlOf(new SqlServerDB(new MockQueryRunner(() => 1, { database: 'sqlServer' })), new TSqlServer())).toEqual([
            'select id as id, [Plan] as [plan] from [Organization] where [Plan] = @0',
            'insert into [Organization] (id, [Plan]) values (@0, @1), (@2, @3)',
            'update [Organization] set [Plan] = @0 where id = @1',
        ])
        expect(sqlOf(new MySqlDB(new MockQueryRunner(() => 1, { database: 'mySql' })), new TMySql())).toEqual([
            'select id as id, `Plan` as plan from `Organization` where `Plan` = ?',
            'insert into `Organization` (id, `Plan`) values (?, ?), (?, ?)',
            'update `Organization` set `Plan` = ? where id = ?',
        ])
        expect(sqlOf(new MariaDB(new MockQueryRunner(() => 1, { database: 'mariaDB' })), new TMariaDB())).toEqual([
            'select id as id, `Plan` as plan from `Organization` where `Plan` = ?',
            'insert into `Organization` (id, `Plan`) values (?, ?), (?, ?)',
            'update `Organization` set `Plan` = ? where id = ?',
        ])
        expect(sqlOf(new SqliteDB(new MockQueryRunner(() => 1, { database: 'sqlite' })), new TSqlite())).toEqual([
            'select id as id, "Plan" as plan from "Organization" where "Plan" = ?1',
            'insert into "Organization" (id, "Plan") values (?1, ?2), (?3, ?4)',
            'update "Organization" set "Plan" = ?1 where id = ?2',
        ])
    })

    test('a-name-composed-with-a-quoted-one-takes-it-without-its-quotes', () => {
        const conn = new PostgreSql17DB(new MockQueryRunner(() => 1, { database: 'postgreSql' }))
        expect(updateWithOldValues(conn).query()).toBe(
            'update "Organization" as _new_ set "Plan" = _old_.Other__Label from (select _old_.*, "Other"."Label" as Other__Label from "Organization" as _old_, "Other" where _old_.other_id = "Other".id for no key update of _old_) as _old_ where _new_.id = _old_.id returning _old_."Plan" as "oldPlan", _new_."Plan" as plan, _old_.Other__Label as label')
    })
})

describe.skipIf(!isRealDbEnabled('postgres', 'wasm', 'newest', 'pglite'))('PGlite: a table and a column created quoted with upper case', () => {
    test('they-are-read-and-written-through-their-quoted-names', async () => {
        const { PGlite } = await import('@electric-sql/pglite')
        const db = await PGlite.create('memory://', { postgresqlconf: ["timezone = 'UTC'"] })
        try {
            await db.exec('create table "Organization" (id int primary key, "Plan" text)')
            const conn = new PostgreSqlDB(new PgLiteQueryRunner(db))
            const tOrganization = new TPgOrganization()
            await conn.insertInto(tOrganization).values([{ id: 1, plan: 'basic' }, { id: 2, plan: 'pro' }]).executeInsert()
            await conn.update(tOrganization).set({ plan: 'team' }).where(tOrganization.id.equals(2)).executeUpdate()
            expect(await conn.selectFrom(tOrganization).where(tOrganization.plan.notEquals('basic')).select({ id: tOrganization.id, plan: tOrganization.plan }).executeSelectMany()).toEqual([
                { id: 2, plan: 'team' },
            ])
            expect((await db.query('select id, "Plan" as plan from "Organization" order by id')).rows).toEqual([{ id: 1, plan: 'basic' }, { id: 2, plan: 'team' }])
            // The old values of an update with a from, read from a select in its from (below PostgreSQL 18)
            await db.exec('alter table "Organization" add column other_id int; update "Organization" set other_id = id; create table "Other" (id int primary key, "Label" text); insert into "Other" values (1, \'gold\'), (2, \'silver\')')
            expect(await updateWithOldValues(new PostgreSql17DB(new PgLiteQueryRunner(db))).executeUpdateMany()).toEqual([
                { oldPlan: 'basic', plan: 'gold', label: 'gold' },
                { oldPlan: 'team', plan: 'silver', label: 'silver' },
            ])
        } finally {
            await db.close()
        }
    })
})
