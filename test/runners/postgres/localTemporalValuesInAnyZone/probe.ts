// Run by LocalTemporalValuesInAnyZone.test.ts in a process of its own, started with TZ set: the zone of a process is
// set when it starts, and the suite pins UTC. It builds the runner it is told, runs the cases of
// ../../lib/localTemporalValuesProbe.ts (mode `cases`), or only creates the runner and uses it once (mode `create`),
// and prints the result as JSON.

import { PostgreSqlConnection } from '../../../../src/connections/PostgreSqlConnection.js'
import { Table } from '../../../../src/Table.js'
import type { QueryRunner } from '../../../../src/queryRunners/QueryRunner.js'
import { creationOutcome, dateGetterOf, postgresTemporalDialect, printResult, probeConfig, runTemporalProbe, timeGetterOf, type TemporalColumnOps } from '../../lib/localTemporalValuesProbe.js'

interface Config {
    mode: 'cases' | 'create'
    runner: string
    options: { binary?: boolean, infer?: boolean }
    connection: { uri: string } | undefined
}

const config = probeConfig<Config>()
const uri = config.connection?.uri ?? ''
const binary = config.options.binary === undefined ? {} : { binary: config.options.binary }

async function createRunner(): Promise<{ runner: QueryRunner, close: () => Promise<unknown> }> {
    switch (config.runner) {
        case 'PgPoolQueryRunner': {
            const { default: pg } = await import('pg')
            const { PgPoolQueryRunner } = await import('../../../../src/queryRunners/PgPoolQueryRunner.js')
            const pool = new pg.Pool({ connectionString: uri, max: 2, ...binary })
            return { runner: new PgPoolQueryRunner(pool), close: () => pool.end() }
        }
        case 'PgQueryRunner': {
            const { default: pg } = await import('pg')
            const { PgQueryRunner } = await import('../../../../src/queryRunners/PgQueryRunner.js')
            const client = new pg.Client({ connectionString: uri, ...binary })
            await client.connect()
            return { runner: new PgQueryRunner(client), close: () => client.end() }
        }
        case 'PostgresQueryRunner': {
            const { default: postgres } = await import('postgres')
            const { PostgresQueryRunner } = await import('../../../../src/queryRunners/PostgresQueryRunner.js')
            const sql = postgres(uri, { max: 2, onnotice: () => undefined, ...(config.options.infer === undefined ? {} : { infer: config.options.infer }) })
            return { runner: new PostgresQueryRunner(sql), close: () => sql.end() }
        }
        case 'PgLiteQueryRunner': {
            const { PGlite } = await import('@electric-sql/pglite')
            const { PgLiteQueryRunner } = await import('../../../../src/queryRunners/PgLiteQueryRunner.js')
            // PGlite runs inside the process: created in UTC, its session doesn't take the zone of the process
            const db = await PGlite.create('memory://', { postgresqlconf: ["timezone = 'UTC'"] })
            return { runner: new PgLiteQueryRunner(db), close: () => db.close() }
        }
        case 'BunSqlPostgresQueryRunner': {
            const { SQL } = await import('bun')
            const { BunSqlPostgresQueryRunner } = await import('../../../../src/queryRunners/BunSqlPostgresQueryRunner.js')
            const sql = new SQL(uri, { max: 2 })
            return { runner: new BunSqlPostgresQueryRunner(sql), close: () => sql.close() }
        }
        default:
            throw new Error('Unknown runner ' + config.runner)
    }
}

class DBConnection extends PostgreSqlConnection<'DBConnection'> { }

class TValues extends Table<DBConnection, 'TValues'> {
    id = this.primaryKey('id', 'int')
    d = this.optionalColumn('d', 'localDate')
    t = this.optionalColumn('t', 'localTime')
    dt = this.optionalColumn('dt', 'localDateTime')
    dtz = this.optionalColumn('dtz', 'localDateTime')
    constructor() {
        super('rt_tz_values')
    }
}
const tValues = new TValues()

type DateTimeName = 'dt' | 'dtz'

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
                    case 'dtz': return conn.insertInto(tValues).from(conn.selectFromNoTable().select({ id: conn.const(id, 'int'), dtz: conn.const(value, 'localDateTime') })).executeInsert()
                }
            },
            equals: (id, value) => byId(id).and(column.equals(value)).selectOneColumn(tValues.id).executeSelectMany(),
            in: (id, values) => byId(id).and(column.in(values)).selectOneColumn(tValues.id).executeSelectMany(),
            between: (id, from, to) => byId(id).and(column.between(from, to)).selectOneColumn(tValues.id).executeSelectMany(),
            selectConst: (value) => conn.selectFromNoTable().selectOneColumn(conn.const(value, 'localDateTime')).executeSelectOne(),
            selectConstGetter: (value, getter) => conn.selectFromNoTable().selectOneColumn(conn.const(value, 'localDateTime')[getter]()).executeSelectOne(),
            read: (id) => byId(id).selectOneColumn(column).executeSelectOne(),
            readAggregateAsArray: (id) => byId(id).select({ values: conn.aggregateAsArray({ v: column }) }).executeSelectOne().then(row => row.values.map(element => element.v ?? null)),
            readGetter: (id, getter) => byId(id).selectOneColumn(column[getter]()).executeSelectOne(),
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
            selectConstGetter: (value, getter) => conn.selectFromNoTable().selectOneColumn(conn.const(value, 'localDate')[dateGetterOf(getter)]()).executeSelectOne(),
            read: (id) => byId(id).selectOneColumn(tValues.d).executeSelectOne(),
            readAggregateAsArray: (id) => byId(id).select({ values: conn.aggregateAsArray({ v: tValues.d }) }).executeSelectOne().then(row => row.values.map(element => element.v ?? null)),
            readGetter: (id, getter) => byId(id).selectOneColumn(tValues.d[dateGetterOf(getter)]()).executeSelectOne(),
        },
        t: {
            insert: (id, value) => conn.insertInto(tValues).set({ id, t: value }).executeInsert(),
            update: (id, value) => conn.update(tValues).set({ t: value }).where(tValues.id.equals(id)).executeUpdate(),
            insertFromSelectOfConsts: (id, value) => conn.insertInto(tValues).from(conn.selectFromNoTable().select({ id: conn.const(id, 'int'), t: conn.const(value, 'localTime') })).executeInsert(),
            equals: (id, value) => byId(id).and(tValues.t.equals(value)).selectOneColumn(tValues.id).executeSelectMany(),
            in: (id, values) => byId(id).and(tValues.t.in(values)).selectOneColumn(tValues.id).executeSelectMany(),
            between: (id, from, to) => byId(id).and(tValues.t.between(from, to)).selectOneColumn(tValues.id).executeSelectMany(),
            selectConst: (value) => conn.selectFromNoTable().selectOneColumn(conn.const(value, 'localTime')).executeSelectOne(),
            selectConstGetter: (value, getter) => conn.selectFromNoTable().selectOneColumn(conn.const(value, 'localTime')[timeGetterOf(getter)]()).executeSelectOne(),
            read: (id) => byId(id).selectOneColumn(tValues.t).executeSelectOne(),
            readAggregateAsArray: (id) => byId(id).select({ values: conn.aggregateAsArray({ v: tValues.t }) }).executeSelectOne().then(row => row.values.map(element => element.v ?? null)),
            readGetter: (id, getter) => byId(id).selectOneColumn(tValues.t[timeGetterOf(getter)]()).executeSelectOne(),
        },
        dt: localDateTime('dt'),
        dtz: localDateTime('dtz'),
    }
}

if (config.mode === 'create') {
    let close: (() => Promise<unknown>) | undefined
    printResult(await creationOutcome(async () => {
        const created = await createRunner()
        close = created.close
        return created.runner
    }, postgresTemporalDialect.selectOne))
    await close?.()
} else {
    const { runner, close } = await createRunner()
    printResult(await runTemporalProbe(postgresTemporalDialect, runner, opsFor(new DBConnection(runner))))
    await close()
}
process.exit(0)
