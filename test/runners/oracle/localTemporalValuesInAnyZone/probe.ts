// Run by LocalTemporalValuesInAnyZone.test.ts in a process of its own, started with TZ set: the zone of a process is
// set when it starts, and the suite pins UTC. It builds the runner it is told, runs the cases of
// ../../lib/localTemporalValuesProbe.ts (mode `cases`), or only creates the runner and uses it once (mode `create`),
// and prints the result as JSON.

import { OracleConnection } from '../../../../src/connections/OracleConnection.js'
import { Table } from '../../../../src/Table.js'
import type { QueryRunner } from '../../../../src/queryRunners/QueryRunner.js'
import { creationOutcome, oracleTemporalDialect, printResult, probeConfig, runTemporalProbe, type TemporalColumnOps } from '../../lib/localTemporalValuesProbe.js'

interface Config {
    mode: 'cases' | 'create'
    runner: string
    options: Record<string, never>
    connection: { user: string, password: string, connectString: string } | undefined
}

const config = probeConfig<Config>()
const db = config.connection ?? { user: '', password: '', connectString: '' }

async function createRunner(): Promise<{ runner: QueryRunner, close: () => Promise<unknown> }> {
    switch (config.runner) {
        case 'OracleDBQueryRunner': {
            const { default: oracledb } = await import('oracledb')
            const { OracleDBQueryRunner } = await import('../../../../src/queryRunners/OracleDBQueryRunner.js')
            const connection = await oracledb.getConnection(db)
            return { runner: new OracleDBQueryRunner(connection), close: () => connection.close() }
        }
        case 'OracleDBPoolQueryRunner': {
            const { default: oracledb } = await import('oracledb')
            const { OracleDBPoolQueryRunner } = await import('../../../../src/queryRunners/OracleDBPoolQueryRunner.js')
            const pool = await oracledb.createPool({ ...db, poolMin: 0, poolMax: 2 })
            return { runner: new OracleDBPoolQueryRunner(pool), close: () => pool.close(0) }
        }
        case 'OracleDBPoolPromiseQueryRunner': {
            const { default: oracledb } = await import('oracledb')
            const { OracleDBPoolPromiseQueryRunner } = await import('../../../../src/queryRunners/OracleDBPoolPromiseQueryRunner.js')
            const pool = oracledb.createPool({ ...db, poolMin: 0, poolMax: 2 })
            return { runner: new OracleDBPoolPromiseQueryRunner(pool), close: async () => (await pool).close(0) }
        }
        default:
            throw new Error('Unknown runner ' + config.runner)
    }
}

class DBConnection extends OracleConnection<'DBConnection'> { }

class TValues extends Table<DBConnection, 'TValues'> {
    id = this.primaryKey('id', 'int')
    d = this.optionalColumn('d', 'localDate')
    t = this.optionalColumn('t', 'localTime')
    dt = this.optionalColumn('dt', 'localDateTime')
    dtx = this.optionalColumn('dtx', 'localDateTime')
    dtz = this.optionalColumn('dtz', 'localDateTime')
    constructor() {
        super('rt_tz_values')
    }
}
const tValues = new TValues()

type DateTimeName = 'dt' | 'dtx' | 'dtz'

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
                    case 'dtx': return conn.insertInto(tValues).from(conn.selectFromNoTable().select({ id: conn.const(id, 'int'), dtx: conn.const(value, 'localDateTime') })).executeInsert()
                    case 'dtz': return conn.insertInto(tValues).from(conn.selectFromNoTable().select({ id: conn.const(id, 'int'), dtz: conn.const(value, 'localDateTime') })).executeInsert()
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
        dtx: localDateTime('dtx'),
        dtz: localDateTime('dtz'),
    }
}

if (config.mode === 'create') {
    let close: (() => Promise<unknown>) | undefined
    printResult(await creationOutcome(async () => {
        const created = await createRunner()
        close = created.close
        return created.runner
    }, oracleTemporalDialect.selectOne))
    await close?.()
} else {
    const { runner, close } = await createRunner()
    printResult(await runTemporalProbe(oracleTemporalDialect, runner, opsFor(new DBConnection(runner))))
    await close()
}
process.exit(0)
