// Run by LocalTemporalValuesInAnyZone.test.ts in a process of its own, started with TZ set: the zone of a process is
// set when it starts, and the suite pins UTC. It builds the runner it is told, runs the cases of
// ../../lib/localTemporalValuesProbe.ts (mode `cases`), or only creates the runner and uses it once (mode `create`),
// and prints the result as JSON.

import { MariaDBConnection } from '../../../../src/connections/MariaDBConnection.js'
import { Table } from '../../../../src/Table.js'
import type { QueryRunner } from '../../../../src/queryRunners/QueryRunner.js'
import { creationOutcome, mysqlTemporalDialect, printResult, probeConfig, runTemporalProbe, type TemporalColumnOps } from '../../lib/localTemporalValuesProbe.js'

interface Config {
    mode: 'cases' | 'create'
    runner: string
    options: Record<string, never>
    connection: { host: string, port: number, user: string, password: string, database: string } | undefined
}

const config = probeConfig<Config>()
const db = config.connection ?? { host: '', port: 0, user: '', password: '', database: '' }

async function createRunner(): Promise<{ runner: QueryRunner, close: () => Promise<unknown> }> {
    switch (config.runner) {
        case 'MySql2QueryRunner': {
            const { default: mysql2 } = await import('mysql2')
            const { MySql2QueryRunner } = await import('../../../../src/queryRunners/MySql2QueryRunner.js')
            const connection = mysql2.createConnection(db)
            return { runner: new MySql2QueryRunner(connection, 'mariaDB'), close: () => new Promise<void>(resolve => connection.end(() => resolve())) }
        }
        case 'MySql2PoolQueryRunner': {
            const { default: mysql2 } = await import('mysql2')
            const { MySql2PoolQueryRunner } = await import('../../../../src/queryRunners/MySql2PoolQueryRunner.js')
            const pool = mysql2.createPool({ ...db, connectionLimit: 2 })
            return { runner: new MySql2PoolQueryRunner(pool, 'mariaDB'), close: () => new Promise<void>(resolve => pool.end(() => resolve())) }
        }
        case 'MariaDBQueryRunner': {
            const { default: mariadb } = await import('mariadb')
            const { MariaDBQueryRunner } = await import('../../../../src/queryRunners/MariaDBQueryRunner.js')
            const connection = await mariadb.createConnection({ ...db, allowPublicKeyRetrieval: true })
            return { runner: new MariaDBQueryRunner(connection, 'mariaDB'), close: () => connection.end() }
        }
        case 'MariaDBPoolQueryRunner': {
            const { default: mariadb } = await import('mariadb')
            const { MariaDBPoolQueryRunner } = await import('../../../../src/queryRunners/MariaDBPoolQueryRunner.js')
            const pool = mariadb.createPool({ ...db, allowPublicKeyRetrieval: true, connectionLimit: 2, minimumIdle: 0 })
            return { runner: new MariaDBPoolQueryRunner(pool, 'mariaDB'), close: () => pool.end() }
        }
        case 'BunSqlMySqlQueryRunner': {
            const { SQL } = await import('bun')
            const { BunSqlMySqlQueryRunner } = await import('../../../../src/queryRunners/BunSqlMySqlQueryRunner.js')
            const sql = new SQL({ adapter: 'mysql', hostname: db.host, port: db.port, username: db.user, password: db.password, database: db.database, foundRows: true, allowPublicKeyRetrieval: true, max: 2 })
            return { runner: new BunSqlMySqlQueryRunner(sql, 'mariaDB'), close: () => sql.close() }
        }
        default:
            throw new Error('Unknown runner ' + config.runner)
    }
}

class DBConnection extends MariaDBConnection<'DBConnection'> { }

class TValues extends Table<DBConnection, 'TValues'> {
    id = this.primaryKey('id', 'int')
    d = this.optionalColumn('d', 'localDate')
    t = this.optionalColumn('t', 'localTime')
    dt = this.optionalColumn('dt', 'localDateTime')
    constructor() {
        super('rt_tz_values')
    }
}
const tValues = new TValues()

type DateTimeName = 'dt'

function opsFor(conn: DBConnection): Partial<Record<'d' | 't' | DateTimeName, TemporalColumnOps>> {
    const byId = (id: number) => conn.selectFrom(tValues).where(tValues.id.equals(id))
    const localDateTime = (name: DateTimeName): TemporalColumnOps => {
        const column = tValues[name]
        const sets = (value: Date): Partial<Record<DateTimeName, Date>> => ({ [name]: value })
        return {
            insert: (id, value) => conn.insertInto(tValues).set({ id }).setIfValue(sets(value)).executeInsert(),
            update: (id, value) => conn.update(tValues).setIfValue(sets(value)).where(tValues.id.equals(id)).executeUpdate(),
            insertFromSelectOfConsts: (id, value) => {
                switch (name) {
                    case 'dt': return conn.insertInto(tValues).from(conn.selectFromNoTable().select({ id: conn.const(id, 'int'), dt: conn.const(value, 'localDateTime') })).executeInsert()
                }
            },
            equals: (id, value) => byId(id).and(column.equals(value)).selectOneColumn(tValues.id).executeSelectMany(),
            in: (id, values) => byId(id).and(column.in(values)).selectOneColumn(tValues.id).executeSelectMany(),
            between: (id, from, to) => byId(id).and(column.between(from, to)).selectOneColumn(tValues.id).executeSelectMany(),
            selectConst: (value) => conn.selectFromNoTable().selectOneColumn(conn.const(value, 'localDateTime')).executeSelectOne(),
            read: (id) => byId(id).selectOneColumn(column).executeSelectOne(),
            readAggregateAsArray: (id) => byId(id).select({ values: conn.aggregateAsArray({ v: column }) }).executeSelectOne().then(row => row.values.map(element => element.v ?? null)),
        }
    }
    return {
        d: {
            insert: (id, value) => conn.insertInto(tValues).set({ id, d: value }).executeInsert(),
            update: (id, value) => conn.update(tValues).set({ d: value }).where(tValues.id.equals(id)).executeUpdate(),
            insertFromSelectOfConsts: (id, value) => conn.insertInto(tValues).from(conn.selectFromNoTable().select({ id: conn.const(id, 'int'), d: conn.const(value, 'localDate') })).executeInsert(),
            equals: (id, value) => byId(id).and(tValues.d.equals(value)).selectOneColumn(tValues.id).executeSelectMany(),
            in: (id, values) => byId(id).and(tValues.d.in(values)).selectOneColumn(tValues.id).executeSelectMany(),
            between: (id, from, to) => byId(id).and(tValues.d.between(from, to)).selectOneColumn(tValues.id).executeSelectMany(),
            selectConst: (value) => conn.selectFromNoTable().selectOneColumn(conn.const(value, 'localDate')).executeSelectOne(),
            read: (id) => byId(id).selectOneColumn(tValues.d).executeSelectOne(),
            readAggregateAsArray: (id) => byId(id).select({ values: conn.aggregateAsArray({ v: tValues.d }) }).executeSelectOne().then(row => row.values.map(element => element.v ?? null)),
        },
        t: {
            insert: (id, value) => conn.insertInto(tValues).set({ id, t: value }).executeInsert(),
            update: (id, value) => conn.update(tValues).set({ t: value }).where(tValues.id.equals(id)).executeUpdate(),
            insertFromSelectOfConsts: (id, value) => conn.insertInto(tValues).from(conn.selectFromNoTable().select({ id: conn.const(id, 'int'), t: conn.const(value, 'localTime') })).executeInsert(),
            equals: (id, value) => byId(id).and(tValues.t.equals(value)).selectOneColumn(tValues.id).executeSelectMany(),
            in: (id, values) => byId(id).and(tValues.t.in(values)).selectOneColumn(tValues.id).executeSelectMany(),
            between: (id, from, to) => byId(id).and(tValues.t.between(from, to)).selectOneColumn(tValues.id).executeSelectMany(),
            selectConst: (value) => conn.selectFromNoTable().selectOneColumn(conn.const(value, 'localTime')).executeSelectOne(),
            read: (id) => byId(id).selectOneColumn(tValues.t).executeSelectOne(),
            readAggregateAsArray: (id) => byId(id).select({ values: conn.aggregateAsArray({ v: tValues.t }) }).executeSelectOne().then(row => row.values.map(element => element.v ?? null)),
        },
        dt: localDateTime('dt'),
    }
}

if (config.mode === 'create') {
    let close: (() => Promise<unknown>) | undefined
    printResult(await creationOutcome(async () => {
        const created = await createRunner()
        close = created.close
        return created.runner
    }, mysqlTemporalDialect.selectOne))
    await close?.()
} else {
    const { runner, close } = await createRunner()
    printResult(await runTemporalProbe(mysqlTemporalDialect, runner, opsFor(new DBConnection(runner))))
    await close()
}
process.exit(0)
