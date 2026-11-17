import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from './QueryRunner.js'
import type { Connection, DbType, ExecuteOptions, FetchTypeResponse, Metadata } from 'oracledb'
import oracleDb from 'oracledb'
import { DelegatedSetTransactionQueryRunner } from './DelegatedSetTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getOracleDBErrorReason, isOracleDBError } from './connectorErrorMappers/OracleDBErrorMapper.js'
import { isProcessInUtc, rejectSessionNotInDatabaseZone, type SessionTimeZone } from '../utils/processTimeZone.js'
import { oracleSessionTimeZone } from '../utils/oracle/oracleSessionTimeZone.js'
import { oracleOutParam, queryRunnerParamBindings } from '../utils/queryRunnerParams.js'
import type { DataTypeClass, SqlDataType } from '../TypeAdapter.js'
import { __sqlDataTypeDescribes, __temporalFieldsOf, __typeSqlDataTypeOf } from '../typeSystem/dataTypes.js'
import { isOracleZonedParam, oracleTemporalBind } from '../utils/oracle/oracleParamTypes.js'
import { oracleDateParam } from '../utils/metadataSymbols.js'
import type { QueryParamContext } from '../QueryContext.js'
import { existingParamContextOf, existingQueryContextOf } from '../internal/QueryContextImpl.js'
import { getQueryContext } from '../QueryContext.js'
import type { DataTypeName } from '../typeSystem/dataTypeNames.js'

/** The options of OracleDBQueryRunner */
export interface OracleDBQueryRunnerConfig {
    /** The connection is in a transaction that something else manages, and that something else ends: the statements don't commit, and none begins, commits or rolls back through this query runner */
    forUseInTransaction?: boolean | undefined
    /**
     * The DbType of oracledb a parameter is bound with, also a RETURNING OUT bind, for a type the library doesn't bind
     * as you need, like `oracledb.DB_TYPE_NVARCHAR`; or an object with that DbType and the maxSize, in bytes, of a RETURNING
     * OUT bind; undefined to bind it as the library does. It receives what the library knows of the parameter (its type,
     * its SQL data type, ...) and the value, undefined for a RETURNING OUT bind.
     */
    driverTypeOf?: ((param: QueryParamContext, value: unknown) => DbType | OracleDBBindType | undefined) | undefined
    /**
     * The maxSize, in bytes, of a RETURNING OUT bind of a text: the longest text a RETURNING of the library can give
     * (oracledb gives 200 bytes, and fails with NJS-016 beyond it). By default 32767, the longest VARCHAR2.
     */
    returningMaxSize?: number | undefined
}

/** The DbType a parameter of a type name is bound with, and the maxSize, in bytes, of a RETURNING OUT bind of it */
export interface OracleDBBindType {
    /** The DbType of oracledb, like `oracledb.DB_TYPE_CLOB` */
    readonly type: DbType
    /** The maxSize, in bytes, of a RETURNING OUT bind of the type name */
    readonly maxSize?: number | undefined
}

/** The longest VARCHAR2, in bytes, the maxSize of a RETURNING OUT bind of a text by default */
const defaultReturningMaxSize = 32767

/**
 * The query runner of Oracle through `oracledb`, over a `Connection`. Oracle runs every statement in a transaction:
 * outside one begun through the library (and without forUseInTransaction), each statement is committed when it ends.
 */
export class OracleDBQueryRunner extends DelegatedSetTransactionQueryRunner {
    readonly database: DatabaseType
    /** The `Connection` of oracledb the query runner was created with */
    readonly connection: Connection
    private config?: OracleDBQueryRunnerConfig | undefined
    /** The zone oracledb gives the session (ORA_SDTZ, or the offset of the process), checked for each query */
    private readonly sessionTimeZone: SessionTimeZone | undefined

    constructor(connection: Connection, config?: OracleDBQueryRunnerConfig) {
        super()
        this.sessionTimeZone = oracleSessionTimeZone('OracleDBQueryRunner')
        this.connection = connection
        this.database = 'oracle'
        this.config = config
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'oracle') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. OracleDBQueryRunner only supports oracle databases')
        }
    }

    getNativeRunner(): Connection {
        return this.connection
    }

    getCurrentNativeConnection(): Connection | undefined {
        return this.isTransactionActive() ? this.connection : undefined
    }

    execute<RESULT>(fn: (connection: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        const rejected = rejectSessionNotInDatabaseZone(this.sessionTimeZone, params)
        if (rejected) {
            return rejected
        }
        const options: ExecuteOptions = {
            outFormat: oracleDb.OUT_FORMAT_OBJECT,
            autoCommit: this.autoCommit(),
            // Every row, whatever oracledb.maxRows says
            maxRows: 0,
            fetchTypeHandler: this.fetchTypeHandlerFor(query, params),
        }
        return this.connection.execute(query, this.bindParams(params), options).then((result) => result.rows || [])
    }
    /**
     * The fetch type handler of an execution of the library, which replaces the global one of oracledb
     * (`oracledb.fetchTypeHandler`) and, answering for every column, its `fetchAsString` and `fetchAsBuffer` too, so the
     * values are received as the library reads them whatever oracledb was configured with:
     * - a column expected as an exact decimal, a bigint or an integer of the user wider than a number is fetched as text, with all
     *   its digits (oracledb gives a NUMBER as a JavaScript number, which loses digits and the scale). The column is the
     *   one with the name expected, or the only column of a query that returns one value without a name;
     * - a DATE or a TIMESTAMP is the Date whose UTC getters are its digits, the values in the database being in UTC:
     *   oracledb builds it with the zone of the process, and the converter takes its local getters back (see
     *   utcDateOfLocalGetters);
     * - a CLOB or an NCLOB is fetched as text, and a BLOB as a Buffer, not as a Lob to read;
     * - every other column as oracledb gives its type.
     */
    protected fetchTypeHandlerFor(query: string, params: any[]): (metadata: Metadata<any>, rowsetMetaData: ReadonlyArray<Metadata<any>>) => FetchTypeResponse {
        const columns = getQueryContext(query, params).resultColumns
        let unnamed = false
        let names: Set<string> | undefined
        if (columns) {
            for (const column of columns) {
                const declared = column.requestedSqlDataType
                if (!isReadAsText(declared !== undefined && __sqlDataTypeDescribes(declared, column.requestedType) ? declared : __typeSqlDataTypeOf(column.requestedType))) {
                    continue
                }
                if (column.name) {
                    (names ??= new Set<string>()).add(column.name)
                } else {
                    unnamed = true
                }
            }
        }
        if (!unnamed && !names) {
            return oracleFetchTypeHandler
        }
        return (metadata, rowsetMetaData) => {
            if (names?.has(metadata.name) || (unnamed && rowsetMetaData.length === 1)) {
                return { type: oracleDb.DB_TYPE_VARCHAR }
            }
            return oracleFetchTypeHandler(metadata)
        }
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        const rejected = rejectSessionNotInDatabaseZone(this.sessionTimeZone, params)
        if (rejected) {
            return rejected
        }
        return this.connection.execute(query, this.bindParams(params), {autoCommit: this.autoCommit()}).then((result) => {
            // A multi-row INSERT is executed as an anonymous PL/SQL block, for
            // which Oracle doesn't populate rowsAffected; the SqlBuilder recorded
            // the affected-row count instead (see OracleSqlBuilder._buildInsertMultiple).
            const forced = this.getForcedAffectedRowCount(params)
            if (forced !== undefined) {
                return forced
            }
            return result.rowsAffected || 0
        })
    }
    protected override executeMutationReturning(query: string, params: any[]): Promise<any[]> {
        const rejected = rejectSessionNotInDatabaseZone(this.sessionTimeZone, params)
        if (rejected) {
            return rejected
        }
        return this.connection.execute(query, this.bindParams(params, true), {autoCommit: this.autoCommit()}).then((result) => {
            const outBinds = result.outBinds
            if (!hasLobs(outBinds)) {
                // The usual case: nothing to read, no promise nor copy of the OUT binds
                return this.processOutBinds(params, outBinds)
            }
            return readLobsOfOutBinds(outBinds).then(read => this.processOutBinds(params, read))
        })
    }
    /**
     * A procedure is called in PL/SQL, which has a BOOLEAN type on every version of Oracle: a boolean parameter,
     * that OracleConnection hands as 1 or 0, is bound as a BOOLEAN (a NUMBER is refused for a BOOLEAN
     * parameter with PLS-00306).
     */
    protected override executeProcedure(query: string, params: any[]): Promise<void> {
        const rejected = rejectSessionNotInDatabaseZone(this.sessionTimeZone, params)
        if (rejected) {
            return rejected
        }
        return this.connection.execute(query, this.bindParams(params, false, true), {autoCommit: this.autoCommit()}).then(() => undefined)
    }
    /**
     * The params as oracledb binds them by name: the placeholders this runner emits are named after the index of their
     * value (`:0`, `:1`, …), and binding by name gives every occurrence of a placeholder the same value, so the same
     * placeholder can be repeated in the query (an array binds one value per occurrence, in the order of the text).
     * A parameter driverTypeOf gives a DbType is bound with it. With resolveOutBinds, a
     * RETURNING OUT bind also gets the DbType of its column. The params of the query are not changed.
     */
    protected bindParams(params: any[], resolveOutBinds: boolean = false, procedure: boolean = false): Record<string, any> {
        const driverTypeOf = this.config?.driverTypeOf
        // With booleanStorage 'boolean' (Oracle 23ai) a boolean is bound as a BOOLEAN, as in a procedure
        const nativeBoolean = existingQueryContextOf(params)?.connectionConfiguration?.booleanStorage === 'boolean'
        const result: Record<string, any> = {}
        // oracledb writes a date or a timestamp with the zone the process has when it binds
        const processInUtc = isProcessInUtc()
        for (let i = 0, length = params.length; i < length; i++) {
            const value = params[i]
            const param = existingParamContextOf(params, i)
            const requestedType = param?.requestedType
            const outBind = resolveOutBinds && value && typeof value === 'object' && value.dir === oracleDb.BIND_OUT
            const declaredBind = driverTypeOf && param ? driverTypeOf(param, outBind ? undefined : value) : undefined
            const declared = isOracleDBBindType(declaredBind) ? declaredBind.type : declaredBind
            if (outBind) {
                // Each RETURNING OUT bind keeps the type of its column (addOutParam)
                // A date or a time is returned as a timestamp with time zone: Oracle converts the value of a date or a
                // timestamp column with the zone of the session (the zone of the database, see oracleSessionTimeZone), and oracledb
                // gives it as its instant, where it builds a date or a timestamp with the zone of the process
                // A text of a column its SQL data type says (withSqlDataType) is a large object is returned as a CLOB
                // (a VARCHAR2 can't hold it, ORA-22835), and one of a known length in a buffer of that length
                const sqlDataType = param?.requestedSqlDataType?.family === 'character string' && __sqlDataTypeDescribes(param.requestedSqlDataType, requestedType) ? param.requestedSqlDataType : undefined
                const lob = sqlDataType?.largeObject ? (sqlDataType.national ? oracleDb.DB_TYPE_NCLOB : oracleDb.DB_TYPE_CLOB) : undefined
                const dbType = declared ?? lob ?? (__temporalFieldsOf(requestedType) !== undefined ? oracleDb.DB_TYPE_TIMESTAMP_TZ : this.oracleDbType(requestedType, nativeBoolean))
                // A text, or a value received as one, is returned in a buffer of maxSize bytes; a character of a text
                // is up to 4 bytes (AL32UTF8)
                const lengthBytes = sqlDataType?.length !== undefined && !sqlDataType.largeObject ? (sqlDataType.lengthUnit === 'octets' ? sqlDataType.length : sqlDataType.length * 4) : undefined
                const maxSize = (isOracleDBBindType(declaredBind) ? declaredBind.maxSize : undefined) ?? lengthBytes ?? this.config?.returningMaxSize ?? defaultReturningMaxSize
                if (dbType === undefined || (dbType === oracleDb.DB_TYPE_NUMBER && declared === undefined)) {
                    // Without a type, oracledb returns an OUT value as a string; a number, with all its digits
                    result[i] = { ...value, maxSize }
                } else if (dbType === oracleDb.DB_TYPE_TIMESTAMP_TZ && declared === undefined) {
                    result[i] = { ...value, type: dbType }
                } else {
                    result[i] = { ...value, type: dbType, maxSize }
                }
                continue
            }
            if (declared !== undefined) {
                result[i] = { val: value, type: declared }
                continue
            }
            if ((procedure || nativeBoolean) && __typeSqlDataTypeOf(requestedType)?.family === 'boolean' && (value === 1 || value === 0 || value === null || value === undefined || typeof value === 'boolean')) {
                result[i] = { val: value === null || value === undefined ? null : !!value, type: oracleDb.DB_TYPE_BOOLEAN }
                continue
            }
            // A localDateTime or a localTime of a database outside UTC goes as a TIMESTAMP WITH LOCAL TIME ZONE, which
            // Oracle converts with its session (the zone of the database); oracledb writes it from the UTC of the Date
            // and the offset of DBTIMEZONE, whatever the zone of the process (NJS-201 when DBTIMEZONE is a region)
            if (value instanceof Date && !isNaN(value.getTime()) && isOracleZonedParam(params, i)) {
                result[i] = { val: value, type: oracleDb.DB_TYPE_TIMESTAMP_LTZ }
                continue
            }
            // A localDate is bound as a date, a localTime or a localDateTime as a timestamp, with their UTC digits
            const temporal = oracleTemporalBind(value, requestedType, processInUtc, param?.getMetadata(oracleDateParam) === true)
            if (temporal) {
                result[i] = { val: temporal.val, type: temporal.type === 'date' ? oracleDb.DB_TYPE_DATE : oracleDb.DB_TYPE_TIMESTAMP }
                continue
            }
            // An object of a JSON column (its SQL data type, withSqlDataType) is bound as a JSON: without a type oracledb
            // rejects an object (NJS-044)
            if (value !== null && typeof value === 'object' && !(value instanceof Date) && !(value instanceof Uint8Array) && isJsonSqlDataTypeOf(param)) {
                result[i] = { val: value, type: oracleDb.DB_TYPE_JSON }
                continue
            }
            if (value === null || value === undefined) {
                // oracledb binds a null without a type Oracle can use where nothing else gives it one: a row of a
                // union (ORA-01790) or a `case :0 when 1` (ORA-00932). A null of a number, a date or a time is bound
                // with its type: a DATE for a parameter of a DATE column (oracleDateParam).
                const type = param?.getMetadata(oracleDateParam) === true ? oracleDb.DB_TYPE_DATE : this.oracleDbType(requestedType, nativeBoolean)
                if (type !== undefined) {
                    result[i] = { val: null, type: type }
                    continue
                }
            }
            result[i] = value
        }
        return result
    }
    // The oracledb DbType of a value of each type, the one oracledb gives the values the library sends: a number
    // or a bigint is a NUMBER, a boolean is sent as a number (see OracleConnection), and a Date is a TIMESTAMP, also
    // for a localDate and a localTime (Oracle has no TIME type). A text has no DbType here: it's how oracledb binds a
    // null.
    private oracleDbType(requestedType: DataTypeClass | undefined, nativeBoolean: boolean): DbType | undefined {
        switch (__typeSqlDataTypeOf(requestedType)?.family) {
            case 'boolean':
                return nativeBoolean ? oracleDb.DB_TYPE_BOOLEAN : oracleDb.DB_TYPE_NUMBER
            case 'exact numeric':
            case 'approximate numeric':
                return oracleDb.DB_TYPE_NUMBER
            default:
                return __temporalFieldsOf(requestedType) !== undefined ? oracleDb.DB_TYPE_TIMESTAMP : undefined
        }
    }
    /**
     * Oracle always runs statements inside a transaction, and oracledb doesn't commit it unless asked (its autoCommit
     * defaults to false): outside a transaction begun through ts-sql-query, each statement is committed, as on every
     * other database; inside one, only commit() does. With forUseInTransaction the commit belongs to what manages the
     * transaction.
     */
    private autoCommit(): boolean {
        return !this.isTransactionActive() && !this.config?.forUseInTransaction
    }
    override executeBeginTransaction(opts?: BeginTransactionOpts): Promise<void> {
        if (this.config?.forUseInTransaction) {
            return this.rejectBeginInsideAManagedTransaction()
        }
        return super.executeBeginTransaction(opts)
    }
    protected override doSetTransaction(sql: string, _opts: BeginTransactionOpts): Promise<void> {
        // SET TRANSACTION opens the transaction it configures, so it must not be committed
        return this.connection.execute(sql, [], {autoCommit: false}).then(() => undefined)
    }
    protected beginTransactionInTheDriver(_opts: BeginTransactionOpts): Promise<void> {
        // Oracle automatically begins the transaction, but the level must set in a query
        return  Promise.resolve()
    }
    protected doCommit(_opts: CommitOpts): Promise<void> {
        return this.connection.commit()
    }
    protected doRollback(_opts: RollbackOpts): Promise<void> {
        return this.connection.rollback()
    }
    protected override validateInTransaction(): boolean {
        // Do not validate if in transaction due automatic in transaction oracle's hehaviour, but with forUseInTransaction
        // the transaction of the connection is not this query runner's to commit or roll back
        return !!this.config?.forUseInTransaction
    }
    addParam(params: any[], value: any, type: DataTypeName | DataTypeClass | undefined): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.OracleDBQueryRunner(params, value, type)
    }
    override addOutParam(params: any[], name: string, type: DataTypeName | DataTypeClass | undefined): string {
        // The same function MockQueryRunner uses to imitate this query runner
        return oracleOutParam(params, name, type)
    }
    /**
     * The rows of a returning from the OUT binds oracledb gives, keyed by the index of each param; no rows without OUT
     * binds
     */
    processOutBinds(params: any[], outBinds: any): any[] {
        if (!outBinds) {
            return []
        }
        if (typeof outBinds !== 'object' || Array.isArray(outBinds)) {
            // Bound by name, oracledb returns the OUT binds as an object keyed by their name (the index of the param)
            throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'invalid out binds returned', value: outBinds }, 'Invalid outBinds returned by the database')
        }

        const rows: any[][] = []
        let current: any[] = []
        rows.push(current)
        for (let i = 0, length = params.length; i < length; i++) {
            const param = params[i]
            if (!param || typeof param !== 'object' || param.dir !== oracleDb.BIND_OUT) {
                continue
            }
            const name: string = param.as || ''
            const value = outBinds[i]

            if (current.length > 0 && name in current[0]) {
                current = []
                rows.push(current)
            }

            if (!Array.isArray(value)) {
                if (current.length <= 0) {
                    current.push({})
                }
                current[0][name] = value
                continue
            }

            for (let j = current.length, length2 = value.length; j < length2; j++) {
                current[j] = {}
            }

            for (let j = 0, length2 = value.length; j < length2; j++) {
                current[j][name] = value[j]
            }
        }

        const result: any[] = []
        rows.forEach(value => {
            result.push(...value)
        })
        return result
    }

    override getErrorReason(error: unknown): TsSqlErrorReason {
        return OracleDBQueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
        return OracleDBQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        return getOracleDBErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isOracleDBError(error)
    }
}

/** Whether what driverTypeOf gives is a DbType with a maxSize, and not a DbType alone */
function isOracleDBBindType(value: DbType | OracleDBBindType | undefined): value is OracleDBBindType {
    return typeof value === 'object' && value !== null && 'type' in value && !('num' in value)
}

/** Whether an OUT bind, or a value of an OUT bind of several rows, is a Lob that must be read */
function hasLobs(outBinds: any): boolean {
    if (!outBinds || typeof outBinds !== 'object' || Array.isArray(outBinds)) {
        return false
    }
    for (const key in outBinds) {
        const value = outBinds[key]
        if (isLob(value)) {
            return true
        }
        if (Array.isArray(value)) {
            for (let i = 0, length = value.length; i < length; i++) {
                if (isLob(value[i])) {
                    return true
                }
            }
        }
    }
    return false
}

/**
 * The OUT binds with each Lob read as its value (a text or a Buffer), in a copy: a RETURNING OUT bind declared a CLOB,
 * an NCLOB or a BLOB (given by driverTypeOf, or by the SQL data type of its column) gives a Lob, for a value of any length.
 * Called only when hasLobs says there is one
 */
function readLobsOfOutBinds(outBinds: any): Promise<any> {
    const reads: Promise<void>[] = []
    const result: Record<string, any> = { ...outBinds }
    for (const key of Object.keys(result)) {
        const value = result[key]
        if (isLob(value)) {
            reads.push(value.getData().then((data: unknown) => { result[key] = data }))
        } else if (Array.isArray(value) && value.some(isLob)) {
            const values = value.slice()
            result[key] = values
            values.forEach((item, index) => {
                if (isLob(item)) {
                    reads.push(item.getData().then((data: unknown) => { values[index] = data }))
                }
            })
        }
    }
    return Promise.all(reads).then(() => result)
}

/** Whether the value is a Lob of oracledb, read with getData */
function isLob(value: unknown): value is { getData(): Promise<unknown> } {
    // A Lob of oracledb (its class isn't in its types)
    return typeof value === 'object' && value !== null && typeof (value as { getData?: unknown }).getData === 'function'
}

/**
 * Whether a column of that SQL data type is fetched as text, with all its digits: an exact number that isn't an integer
 * of 4 bytes or less (a decimal, a bigint, an integer of more digits), which oracledb would give as a JavaScript number
 */
function isReadAsText(sqlDataType: SqlDataType | undefined): boolean {
    return sqlDataType?.family === 'exact numeric' && !(sqlDataType.scale === 0 && sqlDataType.bytes !== undefined && sqlDataType.bytes <= 4)
}

/**
 * The Date whose UTC getters are the local getters of the one oracledb built for a DATE or a TIMESTAMP, which has the
 * digits stored in its local getters (it is built with the zone of the process): the values in the database are in
 * UTC. Exact, except for a stored time that doesn't exist in the zone of the process (the hour a change to summer time
 * skips), which oracledb has already moved, and a year below 100, that oracledb builds as 19xx.
 */
function utcDateOfLocalGetters(value: unknown): unknown {
    if (!(value instanceof Date)) {
        return value
    }
    const result = new Date(0)
    result.setUTCFullYear(value.getFullYear(), value.getMonth(), value.getDate())
    result.setUTCHours(value.getHours(), value.getMinutes(), value.getSeconds(), value.getMilliseconds())
    return result
}

/** The fetch type of every column that is not expected as text (see fetchTypeHandlerFor) */
function oracleFetchTypeHandler(metadata: Metadata<any>): FetchTypeResponse {
    const dbType = metadata.dbType
    switch (dbType) {
        case oracleDb.DB_TYPE_DATE:
        case oracleDb.DB_TYPE_TIMESTAMP:
            return { type: dbType, converter: utcDateOfLocalGetters }
        case oracleDb.DB_TYPE_CLOB:
        case oracleDb.DB_TYPE_NCLOB:
            return { type: oracleDb.STRING }
        case oracleDb.DB_TYPE_BLOB:
            return { type: oracleDb.BUFFER }
        default:
            return { type: dbType as DbType }
    }
}

/** Whether the SQL data type requested for the parameter is a JSON document that describes its value */
function isJsonSqlDataTypeOf(param: QueryParamContext | undefined): boolean {
    const sqlDataType = param?.requestedSqlDataType
    return sqlDataType !== undefined && sqlDataType.family === 'document' && sqlDataType.format === 'json' && __sqlDataTypeDescribes(sqlDataType, param!.requestedType)
}
