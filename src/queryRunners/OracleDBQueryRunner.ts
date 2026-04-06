import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from './QueryRunner.js'
import { OUT_FORMAT_OBJECT, BIND_OUT, type Connection, type DBError } from 'oracledb'
import { DelegatedSetTransactionQueryRunner } from './DelegatedSetTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'

export class OracleDBQueryRunner extends DelegatedSetTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Connection

    constructor(connection: Connection) {
        super()
        this.connection = connection
        this.database = 'oracle'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'oracle') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. OracleDBQueryRunner only supports oracle databases')
        }
    }

    getNativeRunner(): Connection {
        return this.connection
    }

    getCurrentNativeTransaction(): undefined {
        return undefined
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return this.connection.execute(query, params, {outFormat: OUT_FORMAT_OBJECT}).then((result) => result.rows || [])
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.connection.execute(query, params).then((result) => result.rowsAffected || 0)
    }
    protected executeMutationReturning(query: string, params: any[] = []): Promise<any[]> {
        return this.connection.execute(query, params).then((result) => {
            return this.processOutBinds(params, result.outBinds)
        })
    }
    doBeginTransaction(_opts: BeginTransactionOpts): Promise<void> {
        // Oracle automatically begins the transaction, but the level must set in a query
        return  Promise.resolve()
    }
    doCommit(_opts: CommitOpts): Promise<void> {
        return this.connection.commit()
    }
    doRollback(_opts: RollbackOpts): Promise<void> {
        return this.connection.rollback()
    }
    validateIntransaction(): boolean {
        // Do not validate if in transaction due automatic in transaction oracle's hehaviour
        return false
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        params.push(value)
        return ':' + index
    }
    addOutParam(params: any[], name: string): string {
        const index = params.length
        if (name) {
            params.push({dir: BIND_OUT, as: name})
        } else {
            params.push({dir: BIND_OUT})
        }
        return ':' + index
    }
    processOutBinds(params: any[], outBinds: any): any[] {
        if (!outBinds) {
            return []
        }
        if (!Array.isArray(outBinds)) {
            throw new TsSqlProcessingError({ reason: 'INTERNAL_INVALID_OUT_BINDS_RETURNED', value: outBinds }, 'Invalid outBinds returned by the database')
        } 

        if (outBinds.length <= 0) {
            return []
        }

        const out: any[] = []
        for (let i = 0, length = params.length; i < length; i++) {
            const param = params[i]
            if (param && typeof param === 'object' && param.dir === BIND_OUT ) {
                out.push(param)
            }
        }

        const rows: any[][] = []
        let current: any[] = []
        rows.push(current)
        for (let i = 0, length = outBinds.length; i < length; i++) {
            const param: any = out[i]
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
    
    getErrorReason(error: unknown): TsSqlErrorReason {
        return OracleDBQueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return OracleDBQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (!isOracleDbError(error)) {
            return { reason: 'UNKNOWN' }
        }
        return getOracleDbErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isOracleDbError(error)
    }
}

function getOracleDbErrorReason(error: DBError): TsSqlErrorReason {
    const errorNum = error.errorNum
    const code = error.code || ''
    const databaseErrorMessage = error.message || undefined

    switch (errorNum) {
        case 1:
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode: errorNum, databaseErrorMessage, constraintType: 'unique', constraintName: extractOracleConstraintName(error.message) }
        case 1400:
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode: errorNum, databaseErrorMessage, constraintType: 'not null', tableName: extractOracleTableName(error.message), columnName: extractOracleColumnName(error.message) }
        case 2291:
        case 2292:
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode: errorNum, databaseErrorMessage, constraintType: 'foreign key', constraintName: extractOracleConstraintName(error.message) }
        case 2290:
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode: errorNum, databaseErrorMessage, constraintType: 'check', constraintName: extractOracleConstraintName(error.message) }
        case 12899:
            return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', databaseErrorCode: errorNum, databaseErrorMessage, errorType: 'too long', columnName: extractOracleColumnName(error.message) }
        case 1438:
        case 1455:
            return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', databaseErrorCode: errorNum, databaseErrorMessage, errorType: 'out of range' }
        case 1722:
        case 1830:
        case 1840:
        case 1841:
        case 1843:
        case 1847:
        case 1858:
        case 1861:
        case 1882:
        case 1888:
            return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', databaseErrorCode: errorNum, databaseErrorMessage, errorType: 'invalid value' }
        case 942:
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode: errorNum, databaseErrorMessage, objectType: 'table or view', objectName: extractOracleObjectName(error.message) }
        case 904:
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode: errorNum, databaseErrorMessage, objectType: 'column', columnName: extractOracleColumnName(error.message), objectName: extractOracleObjectName(error.message) }
        case 1006:
        case 1008:
        case 1036:
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: errorNum, databaseErrorMessage }
        case 4043:
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode: errorNum, databaseErrorMessage, objectName: extractOracleObjectName(error.message) }
        case 6550:
            return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode: errorNum, databaseErrorMessage }
        case 955:
            return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode: errorNum, databaseErrorMessage, objectName: extractOracleObjectName(error.message) }
        case 933:
        case 907:
        case 936:
        case 923:
        case 1756:
            return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode: errorNum, databaseErrorMessage }
        case 918:
            return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', databaseErrorCode: errorNum, databaseErrorMessage, identifier: extractQuotedName(error.message) }
        case 1427:
            return { reason: 'SQL_CARDINALITY_VIOLATION', databaseErrorCode: errorNum, databaseErrorMessage }
        case 1476:
            return { reason: 'SQL_DIVISION_BY_ZERO', databaseErrorCode: errorNum, databaseErrorMessage }
        case 8177:
            return { reason: 'SQL_SERIALIZATION_FAILURE', databaseErrorCode: errorNum, databaseErrorMessage }
        case 54:
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: errorNum, databaseErrorMessage, timeoutType: 'lock' }
        case 60:
            return { reason: 'SQL_DEADLOCK_DETECTED', databaseErrorCode: errorNum, databaseErrorMessage }
        case 1013:
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: errorNum, databaseErrorMessage, timeoutType: 'cancelled' }
        case 2049:
        case 30006:
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: errorNum, databaseErrorMessage, timeoutType: 'lock' }
        case 30036:
        case 1652:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: errorNum, databaseErrorMessage, resourceType: 'temp space' }
        case 4030:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: errorNum, databaseErrorMessage, resourceType: 'memory' }
        case 1017:
        case 28000:
        case 28001:
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: errorNum, databaseErrorMessage }
        case 1031:
            return { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode: errorNum, databaseErrorMessage }
        case 1012:
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: errorNum, databaseErrorMessage, errorType: 'connection lost' }
        case 1041:
        case 12516:
        case 12519:
        case 12520:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: errorNum, databaseErrorMessage, resourceType: 'connections' }
        case 12514:
        case 12505:
        case 12154:
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: errorNum, databaseErrorMessage, errorType: 'invalid connection configuration' }
        case 12541:
        case 12543:
        case 12545:
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: errorNum, databaseErrorMessage, errorType: 'connection lost' }
        case 12170:
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: errorNum, databaseErrorMessage, timeoutType: 'connection' }
        case 20:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: errorNum, databaseErrorMessage, resourceType: 'connections' }
        case 4021:
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: errorNum, databaseErrorMessage, timeoutType: 'lock' }
        case 16000:
            return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode: errorNum, databaseErrorMessage }
        case 3001:
        case 439:
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode: errorNum, databaseErrorMessage }
        default:
            if (isOracleInvalidParameterCode(code)) {
                return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage }
            }
            if (code.startsWith('NJS-') || code.startsWith('DPI-')) {
                return mapOracleDriverError(error)
            }
            return { reason: 'SQL_UNKNOWN', databaseErrorCode: code || errorNum, databaseErrorMessage }
    }
}

function mapOracleDriverError(error: DBError): TsSqlErrorReason {
    const code = error.code || ''
    if (isOracleInvalidParameterCode(code)) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage: error.message }
    }
    if (code === 'NJS-081') {
        return { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorCode: code, databaseErrorMessage: error.message }
    }
    if (code === 'NJS-123') {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage: error.message, timeoutType: 'statement' }
    }
    if (code === 'NJS-511' || code === 'NJS-503' || code === 'NJS-500') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'connection lost' }
    }
    if (code === 'NJS-512' || code === 'NJS-514' || code === 'NJS-515' || code === 'NJS-517' || code === 'NJS-518' || code === 'NJS-519' || code === 'NJS-520' || code === 'NJS-530') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'invalid connection configuration' }
    }
    if (code === 'NJS-040') {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: code, databaseErrorMessage: error.message, resourceType: 'pool' }
    }
    if (code === 'NJS-064' || code === 'NJS-065' || code === 'NJS-082') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'pool error' }
    }
    if (code === 'NJS-076') {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: code, databaseErrorMessage: error.message, resourceType: 'pool' }
    }
    if (code === 'DPI-1010') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'connection lost' }
    }
    if (code === 'DPI-1080') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'connection lost' }
    }
    return { reason: 'SQL_UNKNOWN', databaseErrorCode: code, databaseErrorMessage: error.message }
}

function isOracleInvalidParameterCode(code: string): boolean {
    return code === 'NJS-005'
        || code === 'NJS-009'
        || code === 'NJS-011'
        || code === 'NJS-012'
        || code === 'NJS-035'
        || code === 'NJS-036'
        || code === 'NJS-044'
        || code === 'NJS-056'
        || code === 'NJS-057'
        || code === 'NJS-059'
        || code === 'NJS-060'
        || code === 'NJS-097'
        || code === 'NJS-098'
        || code === 'NJS-137'
}

function isOracleDbError(error: unknown): error is DBError {
    return !!error && error instanceof Error && (
        typeof (error as DBError).message === 'string'
        && (typeof (error as DBError).code === 'string' || typeof (error as DBError).errorNum === 'number')
    )
}

function extractOracleConstraintName(message: string): string | undefined {
    const match = /\(([^)]+)\)/.exec(message)
    return match?.[1]
}

function extractOracleColumnName(message: string): string | undefined {
    const quotedValues = extractAllQuotedNames(message)
    return quotedValues.at(-1)
}

function extractOracleTableName(message: string): string | undefined {
    const quotedValues = extractAllQuotedNames(message)
    if (quotedValues.length >= 2) {
        return quotedValues[quotedValues.length - 2]
    }
    return undefined
}

function extractOracleObjectName(message: string): string | undefined {
    return extractQuotedName(message)
}

function extractAllQuotedNames(message: string): string[] {
    return [...message.matchAll(/"([^"]+)"/g)].map((match) => match[1]!)
}

function extractQuotedName(message: string): string | undefined {
    const doubleQuoted = /"([^"]+)"/.exec(message)
    if (doubleQuoted) {
        return doubleQuoted[1]
    }
    const singleQuoted = /'([^']+)'/.exec(message)
    if (singleQuoted) {
        return singleQuoted[1]
    }
    return undefined
}
