// The child side of the LocalTemporalValuesInAnyZone tests: run in a process of its own, started with TZ set, by
// `<db>/localTemporalValuesInAnyZone/probe.ts`. It holds what doesn't depend on the library's connection classes: the
// table of every database, the values, the expected text, and the plan of cases the parent turns into tests.
//
// The contract: every value in the database is stored in UTC, whatever the zone of the process.
//   - localDate read: a Date at 10:00 UTC of its day; sent: its UTC day is stored.
//   - localTime read: a Date on 1970-01-01 with the time in its UTC getters; sent: its UTC time is stored.
//   - localDateTime read: in a column without zone, a Date whose UTC getters are the stored digits; in a zoned column,
//     the instant. Sent: its UTC digits in a column without zone, its instant in a zoned column.

import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'

export const TEMPORAL_TABLE = 'rt_tz_values'
export const PROBE_ENV = 'RT_TZ_PROBE'
export const RESULT_MARKER = '@@RT_TZ_RESULT@@'

export type TemporalKind = 'date' | 'time' | 'datetime' | 'zoned'
export type TemporalColumnName = 'd' | 't' | 'dt' | 'dtx' | 'dtz'

export interface TemporalColumn {
    readonly name: TemporalColumnName
    readonly sqlType: string
    readonly kind: TemporalKind
    /** Whether the column keeps milliseconds */
    readonly ms: boolean
    /**
     * The milliseconds of the values are rounded down to a multiple of this: SQL Server's datetime keeps 1/300 s, so
     * .123 is stored as .1233333 and doesn't equal the .123 sent, a rounding of the engine and not of the zone
     */
    readonly msMultipleOf?: number
    /** The first year the column holds */
    readonly minYear: number
}

export interface TemporalDialect {
    readonly columns: readonly TemporalColumn[]
    readonly dropTable: string
    readonly createTable: string
    /** A query that returns one row, to use a runner once */
    readonly selectOne: string
    /** The SQL that gives the stored value as text: YYYY-MM-DD, HH:MM:SS.mmm or YYYY-MM-DD HH:MM:SS[.mmm] (zoned: in UTC) */
    text(column: TemporalColumn): string
    /** An SQL literal of the column with these digits (and this offset, for a zoned column) */
    literal(column: TemporalColumn, digits: string, offset?: string): string
}

export const postgresTemporalDialect: TemporalDialect = {
    columns: [
        { name: 'd', sqlType: 'date', kind: 'date', ms: true, minYear: 1 },
        { name: 't', sqlType: 'time', kind: 'time', ms: true, minYear: 1 },
        { name: 'dt', sqlType: 'timestamp', kind: 'datetime', ms: true, minYear: 1 },
        { name: 'dtz', sqlType: 'timestamptz', kind: 'zoned', ms: true, minYear: 1 },
    ],
    dropTable: `drop table if exists ${TEMPORAL_TABLE}`,
    createTable: `create table ${TEMPORAL_TABLE} (id integer primary key, d date, t time, dt timestamp, dtz timestamptz)`,
    selectOne: 'select 1',
    text(column) {
        switch (column.kind) {
            case 'date': return `to_char(${column.name}, 'YYYY-MM-DD')`
            case 'time': return `to_char(${column.name}, 'HH24:MI:SS.MS')`
            case 'zoned': return `to_char(${column.name} at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS')`
            default: return `to_char(${column.name}, 'YYYY-MM-DD HH24:MI:SS.MS')`
        }
    },
    literal(_column, digits, offset) {
        return `'${digits}${offset ?? ''}'`
    },
}

const mysqlColumns: readonly TemporalColumn[] = [
    { name: 'd', sqlType: 'DATE', kind: 'date', ms: true, minYear: 1 },
    { name: 't', sqlType: 'TIME(3)', kind: 'time', ms: true, minYear: 1 },
    { name: 'dt', sqlType: 'DATETIME(3)', kind: 'datetime', ms: true, minYear: 1 },
]

export const mysqlTemporalDialect: TemporalDialect = {
    columns: mysqlColumns,
    dropTable: `drop table if exists ${TEMPORAL_TABLE}`,
    createTable: `create table ${TEMPORAL_TABLE} (id int primary key, d date, t time(3), dt datetime(3))`,
    selectOne: 'select 1',
    text(column) {
        switch (column.kind) {
            case 'date': return `date_format(${column.name}, '%Y-%m-%d')`
            case 'time': return `left(time_format(${column.name}, '%H:%i:%s.%f'), 12)`
            default: return `left(date_format(${column.name}, '%Y-%m-%d %H:%i:%s.%f'), 23)`
        }
    },
    literal(_column, digits) {
        return `'${digits}'`
    },
}

export const sqlServerTemporalDialect: TemporalDialect = {
    columns: [
        { name: 'd', sqlType: 'date', kind: 'date', ms: true, minYear: 1 },
        { name: 't', sqlType: 'time(3)', kind: 'time', ms: true, minYear: 1 },
        { name: 'dt', sqlType: 'datetime2(3)', kind: 'datetime', ms: true, minYear: 1 },
        { name: 'dtx', sqlType: 'datetime', kind: 'datetime', ms: true, msMultipleOf: 10, minYear: 1753 },
        { name: 'dtz', sqlType: 'datetimeoffset(3)', kind: 'zoned', ms: true, minYear: 1 },
    ],
    dropTable: `drop table if exists ${TEMPORAL_TABLE}`,
    createTable: `create table ${TEMPORAL_TABLE} (id int primary key, d date, t time(3), dt datetime2(3), dtx datetime, dtz datetimeoffset(3))`,
    selectOne: 'select 1',
    text(column) {
        switch (column.kind) {
            case 'date': return `convert(varchar(10), ${column.name}, 23)`
            case 'time': return `substring(convert(varchar(23), cast(${column.name} as datetime2(3)), 121), 12, 12)`
            case 'zoned': return `convert(varchar(23), switchoffset(${column.name}, '+00:00'), 121)`
            default: return `convert(varchar(23), ${column.name}, 121)`
        }
    },
    literal(column, digits, offset) {
        return column.kind === 'date' || column.kind === 'time' ? `'${digits}'` : `'${digits.replace(' ', 'T')}${offset ?? ''}'`
    },
}

export const oracleTemporalDialect: TemporalDialect = {
    columns: [
        { name: 'd', sqlType: 'DATE', kind: 'date', ms: true, minYear: 1 },
        { name: 't', sqlType: 'TIMESTAMP(3)', kind: 'time', ms: true, minYear: 1 },
        { name: 'dt', sqlType: 'TIMESTAMP(3)', kind: 'datetime', ms: true, minYear: 1 },
        { name: 'dtx', sqlType: 'DATE', kind: 'datetime', ms: false, minYear: 1 },
        { name: 'dtz', sqlType: 'TIMESTAMP(3) WITH TIME ZONE', kind: 'zoned', ms: true, minYear: 1 },
    ],
    dropTable: `begin execute immediate 'drop table ${TEMPORAL_TABLE}'; exception when others then if sqlcode != -942 then raise; end if; end;`,
    createTable: `create table ${TEMPORAL_TABLE} (id number(10) primary key, d date, t timestamp(3), dt timestamp(3), dtx date, dtz timestamp(3) with time zone)`,
    selectOne: 'select 1 from dual',
    text(column) {
        switch (column.kind) {
            case 'date': return `to_char(${column.name}, 'YYYY-MM-DD')`
            case 'time': return `to_char(${column.name}, 'HH24:MI:SS.FF3')`
            case 'zoned': return `to_char(sys_extract_utc(${column.name}), 'YYYY-MM-DD HH24:MI:SS.FF3')`
            default: return column.ms ? `to_char(${column.name}, 'YYYY-MM-DD HH24:MI:SS.FF3')` : `to_char(${column.name}, 'YYYY-MM-DD HH24:MI:SS')`
        }
    },
    literal(column, digits, offset) {
        switch (column.kind) {
            case 'date': return `DATE '${digits}'`
            case 'time': return `TIMESTAMP '1970-01-01 ${digits}'`
            case 'zoned': return `TIMESTAMP '${digits} ${offset}'`
            default: return column.ms ? `TIMESTAMP '${digits}'` : `TO_DATE('${digits}', 'YYYY-MM-DD HH24:MI:SS')`
        }
    },
}

// The values

interface TemporalValue {
    readonly label: string
    readonly utc: number
}

const HOUR = 3_600_000
const DAY = 24 * HOUR

function valuesOf(column: TemporalColumn, values: TemporalValue[]): TemporalValue[] {
    return values
        .filter(value => new Date(value.utc).getUTCFullYear() >= column.minYear)
        .map(value => {
            if (!column.ms) {
                return { label: value.label, utc: Math.floor(value.utc / 1000) * 1000 }
            }
            if (column.msMultipleOf) {
                const ms = new Date(value.utc).getUTCMilliseconds()
                const rounded = ms - ms % column.msMultipleOf
                const label = value.label.replace('.' + String(ms).padStart(3, '0'), '.' + String(rounded).padStart(3, '0'))
                return { label, utc: value.utc - ms + rounded }
            }
            return value
        })
}

function sendValues(column: TemporalColumn): TemporalValue[] {
    switch (column.kind) {
        case 'date': return valuesOf(column, [
            // Midnight UTC is the previous day west of UTC, and 23:30 UTC is the next day east of UTC
            { label: '00:30 UTC of 2024-01-14', utc: Date.UTC(2024, 0, 14, 0, 30) },
            { label: '23:30 UTC of 2024-01-14', utc: Date.UTC(2024, 0, 14, 23, 30) },
            { label: '10:00 UTC of 0999-01-14', utc: Date.UTC(999, 0, 14, 10) },
        ])
        case 'time': return valuesOf(column, [
            { label: '09:15:30.123 UTC', utc: Date.UTC(1970, 0, 1, 9, 15, 30, 123) },
            { label: '23:45:10.500 UTC', utc: Date.UTC(1970, 0, 1, 23, 45, 10, 500) },
            { label: '09:15:30.123 UTC of 2024-07-14', utc: Date.UTC(2024, 6, 14, 9, 15, 30, 123) },
        ])
        default: return valuesOf(column, [
            { label: '2024-01-14 09:15:30.123 UTC', utc: Date.UTC(2024, 0, 14, 9, 15, 30, 123) },
            { label: '2024-07-14 23:30:15.250 UTC', utc: Date.UTC(2024, 6, 14, 23, 30, 15, 250) },
            { label: '2024-03-31 02:30:00 UTC (the Madrid spring-forward gap)', utc: Date.UTC(2024, 2, 31, 2, 30) },
            { label: '2024-03-10 02:30:00 UTC (the New York spring-forward gap)', utc: Date.UTC(2024, 2, 10, 2, 30) },
            { label: '0999-01-14 09:15:30.123 UTC', utc: Date.UTC(999, 0, 14, 9, 15, 30, 123) },
        ])
    }
}

function readValues(column: TemporalColumn): TemporalValue[] {
    switch (column.kind) {
        case 'date': return valuesOf(column, [
            { label: '2024-01-14', utc: Date.UTC(2024, 0, 14, 10) },
            { label: '0999-01-14', utc: Date.UTC(999, 0, 14, 10) },
        ])
        case 'time': return valuesOf(column, [
            { label: '09:15:30.123', utc: Date.UTC(1970, 0, 1, 9, 15, 30, 123) },
            { label: '23:45:10.500', utc: Date.UTC(1970, 0, 1, 23, 45, 10, 500) },
        ])
        case 'datetime': return valuesOf(column, [
            { label: '2024-01-14 09:15:30.123', utc: Date.UTC(2024, 0, 14, 9, 15, 30, 123) },
            { label: '2024-03-31 02:30:00 (the Madrid spring-forward gap)', utc: Date.UTC(2024, 2, 31, 2, 30) },
            { label: '2024-03-10 02:30:00 (the New York spring-forward gap)', utc: Date.UTC(2024, 2, 10, 2, 30) },
            { label: '0999-01-14 09:15:30.123', utc: Date.UTC(999, 0, 14, 9, 15, 30, 123) },
        ])
        case 'zoned': return valuesOf(column, [
            { label: '2024-01-14 18:15:30.123+09:00', utc: Date.UTC(2024, 0, 14, 9, 15, 30, 123) },
            { label: '2024-03-31 11:30:00+09:00 (02:30 UTC, the Madrid spring-forward gap)', utc: Date.UTC(2024, 2, 31, 2, 30) },
            { label: '0999-01-14 18:15:30.123+09:00', utc: Date.UTC(999, 0, 14, 9, 15, 30, 123) },
        ])
    }
}

const pad = (value: number, length: number) => String(value).padStart(length, '0')

/** The text the database must hold for a value sent with these UTC getters */
export function storedText(column: TemporalColumn, utc: number): string {
    const date = new Date(utc)
    const day = `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`
    const seconds = `${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}:${pad(date.getUTCSeconds(), 2)}`
    const time = column.ms ? `${seconds}.${pad(date.getUTCMilliseconds(), 3)}` : seconds
    switch (column.kind) {
        case 'date': return day
        case 'time': return time
        default: return `${day} ${time}`
    }
}

/** The SQL literal of the stored value (a zoned one written at +09:00, the same instant) */
function literalOf(dialect: TemporalDialect, column: TemporalColumn, utc: number): string {
    if (column.kind === 'zoned') {
        return dialect.literal(column, storedText(column, utc + 9 * HOUR), '+09:00')
    }
    return dialect.literal(column, storedText(column, utc))
}

/** The Date the library must give for the value stored from these UTC getters */
function readDate(column: TemporalColumn, utc: number): Date {
    const date = new Date(utc)
    switch (column.kind) {
        case 'date': return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 10))
        case 'time': return new Date(Date.UTC(1970, 0, 1, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()))
        default: return date
    }
}

function otherValue(column: TemporalColumn, utc: number): Date {
    return new Date(utc + (column.kind === 'time' ? HOUR : 2 * DAY))
}

// The plan

export type TemporalStep =
    | 'send insert'
    | 'send update set'
    | 'send insert from a select of consts'
    | 'send equals'
    | 'send in'
    | 'send between'
    | 'send const in the select list'
    | 'read'
    | 'read aggregateAsArray'
    | 'round trip equals'
    | 'round trip update set'

interface PlannedCase {
    readonly name: string
    readonly step: TemporalStep
    readonly column: TemporalColumn
    readonly value: TemporalValue
}

const sendSteps: TemporalStep[] = ['send insert', 'send update set', 'send insert from a select of consts', 'send equals', 'send in', 'send between']
const readSteps: TemporalStep[] = ['read', 'read aggregateAsArray', 'round trip equals', 'round trip update set']
// A const doesn't depend on the column: one column per data type is enough
const constColumns: TemporalColumnName[] = ['d', 't', 'dt']

export function planOf(dialect: TemporalDialect): PlannedCase[] {
    const cases: PlannedCase[] = []
    const add = (step: TemporalStep, column: TemporalColumn, value: TemporalValue) => {
        cases.push({ name: `${step} | ${column.name} ${column.sqlType} | ${value.label}`, step, column, value })
    }
    for (const column of dialect.columns) {
        for (const value of sendValues(column)) {
            for (const step of sendSteps) add(step, column, value)
            if (constColumns.includes(column.name)) add('send const in the select list', column, value)
        }
        for (const value of readValues(column)) {
            for (const step of readSteps) add(step, column, value)
        }
    }
    return cases
}

export function caseNamesOf(dialect: TemporalDialect): string[] {
    return planOf(dialect).map(planned => planned.name)
}

// What each probe does through the library, for one column

export interface TemporalColumnOps {
    insert(id: number, value: Date): Promise<unknown>
    update(id: number, value: Date): Promise<unknown>
    insertFromSelectOfConsts(id: number, value: Date): Promise<unknown>
    equals(id: number, value: Date): Promise<number[]>
    in(id: number, values: Date[]): Promise<number[]>
    between(id: number, from: Date, to: Date): Promise<number[]>
    selectConst(value: Date): Promise<Date | null>
    read(id: number): Promise<Date | null>
    readAggregateAsArray(id: number): Promise<Array<Date | null>>
}

export interface TemporalCaseResult {
    readonly name: string
    readonly actual: string
    readonly expected: string
}

function describeDate(value: unknown): string {
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString()
    }
    return 'not a Date: ' + JSON.stringify(value)
}

function describeError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error)
    return 'error: ' + message.split('\n')[0]!.slice(0, 300)
}

const found = (ids: number[], id: number) => ids.map(Number).includes(id) ? 'found' : 'not found'

export async function runTemporalProbe(dialect: TemporalDialect, runner: QueryRunner, ops: Partial<Record<TemporalColumnName, TemporalColumnOps>>): Promise<TemporalCaseResult[]> {
    await runner.executeDatabaseSchemaModification(dialect.dropTable)
    await runner.executeDatabaseSchemaModification(dialect.createTable)

    let nextId = 1
    const rawInsert = async (id: number, column: TemporalColumn, utc?: number) => {
        if (utc === undefined) {
            await runner.executeInsert(`insert into ${TEMPORAL_TABLE} (id) values (${id})`)
        } else {
            await runner.executeInsert(`insert into ${TEMPORAL_TABLE} (id, ${column.name}) values (${id}, ${literalOf(dialect, column, utc)})`)
        }
    }
    const textOf = async (id: number, column: TemporalColumn): Promise<string> => {
        const text: unknown = await runner.executeSelectOneColumnOneRow(`select ${dialect.text(column)} from ${TEMPORAL_TABLE} where id = ${id}`)
        return typeof text === 'string' ? text : 'not a text: ' + JSON.stringify(text)
    }

    const results: TemporalCaseResult[] = []
    for (const planned of planOf(dialect)) {
        const { column, value } = planned
        const columnOps = ops[column.name]
        const id = nextId++
        const sent = new Date(value.utc)
        const stored = storedText(column, value.utc)
        const read = describeDate(readDate(column, value.utc))
        let actual = ''
        let expected = ''
        try {
            if (!columnOps) {
                throw new Error('the probe has no operations for the column ' + column.name)
            }
            switch (planned.step) {
                case 'send insert':
                    expected = stored
                    await columnOps.insert(id, sent)
                    actual = await textOf(id, column)
                    break
                case 'send update set':
                    expected = stored
                    await rawInsert(id, column)
                    await columnOps.update(id, sent)
                    actual = await textOf(id, column)
                    break
                case 'send insert from a select of consts':
                    expected = stored
                    await columnOps.insertFromSelectOfConsts(id, sent)
                    actual = await textOf(id, column)
                    break
                case 'send equals':
                    expected = 'found'
                    await rawInsert(id, column, value.utc)
                    actual = found(await columnOps.equals(id, sent), id)
                    break
                case 'send in':
                    expected = 'found'
                    await rawInsert(id, column, value.utc)
                    actual = found(await columnOps.in(id, [otherValue(column, value.utc), sent]), id)
                    break
                case 'send between':
                    expected = 'found'
                    await rawInsert(id, column, value.utc)
                    actual = found(await columnOps.between(id, sent, sent), id)
                    break
                case 'send const in the select list':
                    expected = read
                    actual = describeDate(await columnOps.selectConst(sent))
                    break
                case 'read':
                    expected = read
                    await rawInsert(id, column, value.utc)
                    actual = describeDate(await columnOps.read(id))
                    break
                case 'read aggregateAsArray': {
                    expected = JSON.stringify([read])
                    await rawInsert(id, column, value.utc)
                    const values = await columnOps.readAggregateAsArray(id)
                    actual = JSON.stringify(Array.isArray(values) ? values.map(describeDate) : values)
                    break
                }
                case 'round trip equals': {
                    expected = 'found'
                    await rawInsert(id, column, value.utc)
                    const readValue = await columnOps.read(id)
                    if (!readValue) throw new Error('the value read is ' + readValue)
                    actual = found(await columnOps.equals(id, readValue), id)
                    break
                }
                case 'round trip update set': {
                    expected = stored
                    await rawInsert(id, column, value.utc)
                    const readValue = await columnOps.read(id)
                    if (!readValue) throw new Error('the value read is ' + readValue)
                    await columnOps.update(id, readValue)
                    actual = await textOf(id, column)
                    break
                }
            }
        } catch (error) {
            actual = describeError(error)
        }
        results.push({ name: planned.name, actual, expected })
    }
    return results
}

// The creation of a runner, for the requirements it validates

/**
 * Creates the runner and runs one query with it, and says how it went: `created` when both work, otherwise where it
 * was rejected and with what (`TsSqlProcessingError INVALID_CONFIGURATION`, or the class and message of another error).
 */
export async function creationOutcome(create: () => Promise<QueryRunner>, selectOne: string): Promise<string> {
    let runner: QueryRunner
    try {
        runner = await create()
    } catch (error) {
        return 'rejected when created: ' + describeRejection(error)
    }
    try {
        await runner.executeSelectOneColumnOneRow(selectOne)
    } catch (error) {
        return 'rejected at its first query: ' + describeRejection(error)
    }
    return 'created'
}

function describeRejection(error: unknown): string {
    if (error instanceof Error) {
        const reason = (error as { errorReason?: { reason?: unknown } }).errorReason?.reason
        return reason === undefined ? `${error.name} ${error.message.split('\n')[0]}` : `${error.name} ${String(reason)}`
    }
    return String(error)
}

export function printResult(result: unknown): void {
    process.stdout.write('\n' + RESULT_MARKER + JSON.stringify(result) + '\n')
}

export function probeConfig<T>(): T {
    const text = process.env[PROBE_ENV]
    if (!text) {
        throw new Error('The probe is run by its LocalTemporalValuesInAnyZone test, which sets ' + PROBE_ENV)
    }
    return JSON.parse(text) as T
}
