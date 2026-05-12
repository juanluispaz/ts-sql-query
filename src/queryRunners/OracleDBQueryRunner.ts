import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from './QueryRunner.js'
import type { Connection, DBError } from 'oracledb'
import * as oracleDb from 'oracledb'
import { DelegatedSetTransactionQueryRunner } from './DelegatedSetTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getOracleEngineErrorReason } from './databaseErrorMappers/OracleErrorMapper.js'

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
        return this.connection.execute(query, params, {outFormat: oracleDb.OUT_FORMAT_OBJECT}).then((result) => result.rows || [])
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
            params.push({dir: oracleDb.BIND_OUT, as: name})
        } else {
            params.push({dir: oracleDb.BIND_OUT})
        }
        return ':' + index
    }
    processOutBinds(params: any[], outBinds: any): any[] {
        if (!outBinds) {
            return []
        }
        if (!Array.isArray(outBinds)) {
            throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'invalid out binds returned', value: outBinds }, 'Invalid outBinds returned by the database')
        } 

        if (outBinds.length <= 0) {
            return []
        }

        const out: any[] = []
        for (let i = 0, length = params.length; i < length; i++) {
            const param = params[i]
            if (param && typeof param === 'object' && param.dir === oracleDb.BIND_OUT ) {
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
    const code = getOracleErrorCode(error)
    if (code.startsWith('NJS-') || code.startsWith('DPI-') || code.startsWith('OCI-') || isNodeOracleNetworkErrorCode(code)) {
        return mapOracleDriverError(error, code)
    }
    if (typeof error.errorNum === 'number') {
        return getOracleEngineErrorReason({
            errorNum: error.errorNum,
            code,
            message: error.message,
        })
    }
    return { reason: 'SQL_UNKNOWN', databaseErrorCode: code || undefined, databaseErrorMessage: error.message || undefined }
}

function mapOracleDriverError(error: DBError, code = getOracleErrorCode(error)): TsSqlErrorReason {
    const databaseErrorCode = code || undefined
    const databaseErrorMessage = error.message || undefined

    if (isOracleInvalidParameterCode(code)) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, ...getOracleInvalidParameterDetails(code, error.message) }
    }
    if (isOracleForbiddenConcurrentUsageCode(code)) {
        return { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorCode, databaseErrorMessage }
    }
    if (isOracleDriverConnectionLostCode(code)) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (isOracleDriverConnectionTemporarilyUnavailableCode(code)) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'temporarily unavailable' }
    }
    if (isOracleDriverInvalidConnectionConfigurationCode(code)) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'invalid connection configuration' }
    }
    if (isOracleDriverPoolErrorCode(code)) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'pool error' }
    }
    if (isOracleDriverConnectionTimeoutCode(code)) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'connection' }
    }
    if (isOracleDriverStatementTimeoutCode(code)) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'statement' }
    }
    if (isOracleDriverPoolResourceLimitCode(code)) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'pool' }
    }
    if (isOracleDriverMemoryResourceLimitCode(code)) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'memory' }
    }
    if (isOracleDriverUnsupportedFeatureCode(code)) {
        return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
    }
    if (isOracleDriverInvalidSqlStatementCode(code)) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid statement context' }
    }
    if (isOracleDriverInvalidValueCode(code)) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: getOracleDriverInvalidValueType(code) }
    }
    if (isOracleDriverObjectStateErrorCode(code)) {
        return { reason: 'SQL_OBJECT_STATE_ERROR', databaseErrorCode, databaseErrorMessage, objectStateErrorType: getOracleDriverObjectStateErrorType(code), objectType: getOracleDriverObjectType(code) }
    }
    if (isOracleDriverTransactionErrorCode(code)) {
        const transactionErrorType = getOracleDriverTransactionErrorType(code)
        if (transactionErrorType === 'not in transaction') {
            return { reason: 'NOT_IN_TRANSACTION', databaseErrorCode, databaseErrorMessage }
        }
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType }
    }
    if (isOracleDriverAuthenticationErrorCode(code)) {
        return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (isOracleDriverConfigurationErrorCode(code)) {
        return { reason: 'SQL_CONFIGURATION_ERROR', databaseErrorCode, databaseErrorMessage, configurationErrorType: 'runtime parameter' }
    }
    if (isOracleDriverRoutineErrorCode(code)) {
        return { reason: 'SQL_ROUTINE_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (isOracleDriverIoErrorCode(code)) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'unknown' }
    }
    if (isOracleDriverInternalErrorCode(code)) {
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'api misuse' }
    }
    if (code === 'DPI-1022') {
        const columnName = extractOracleDriverMissingAttribute(error.message)
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'column', columnName, objectName: columnName }
    }
    if (code === 'OCI-22303') {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectName: extractOracleDriverQuotedObjectName(error.message) }
    }
    if (code === 'OCI-22164') {
        return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'OCI-22165') {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, parameterErrorType: 'invalid index', parameterIndex: extractOracleDriverBracketIndex(error.message) }
    }
    return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
}

function isOracleInvalidParameterCode(code: string): boolean {
    return code === 'NJS-005'
        || code === 'NJS-004'
        || code === 'NJS-007'
        || code === 'NJS-009'
        || code === 'NJS-011'
        || code === 'NJS-012'
        || code === 'NJS-013'
        || code === 'NJS-015'
        || code === 'NJS-016'
        || code === 'NJS-021'
        || code === 'NJS-034'
        || code === 'NJS-035'
        || code === 'NJS-036'
        || code === 'NJS-037'
        || code === 'NJS-044'
        || code === 'NJS-052'
        || code === 'NJS-055'
        || code === 'NJS-056'
        || code === 'NJS-057'
        || code === 'NJS-058'
        || code === 'NJS-059'
        || code === 'NJS-060'
        || code === 'NJS-061'
        || code === 'NJS-062'
        || code === 'NJS-063'
        || code === 'NJS-068'
        || code === 'NJS-070'
        || code === 'NJS-097'
        || code === 'NJS-098'
        || code === 'NJS-109'
        || code === 'NJS-110'
        || code === 'NJS-120'
        || code === 'NJS-121'
        || code === 'NJS-122'
        || code === 'NJS-129'
        || code === 'NJS-131'
        || code === 'NJS-132'
        || code === 'NJS-134'
        || code === 'NJS-135'
        || code === 'NJS-137'
        || code === 'NJS-141'
        || code === 'NJS-149'
        || code === 'NJS-150'
        || code === 'NJS-151'
        || code === 'NJS-153'
        || code === 'NJS-154'
        || code === 'NJS-158'
        || code === 'NJS-159'
        || code === 'NJS-160'
        || code === 'NJS-161'
        || code === 'NJS-163'
        || code === 'NJS-164'
        || code === 'NJS-165'
        || code === 'NJS-166'
        || code === 'NJS-167'
        || code === 'NJS-174'
        || code === 'DPI-1009'
        || code === 'DPI-1015'
        || code === 'DPI-1018'
        || code === 'DPI-1019'
        || code === 'DPI-1021'
        || code === 'DPI-1024'
        || code === 'DPI-1025'
        || code === 'DPI-1027'
        || code === 'DPI-1028'
        || code === 'DPI-1031'
        || code === 'DPI-1035'
        || code === 'DPI-1036'
        || code === 'DPI-1046'
        || code === 'DPI-1053'
        || code === 'DPI-1057'
        || code === 'DPI-1059'
        || code === 'DPI-1070'
        || code === 'DPI-1071'
        || code === 'DPI-1073'
        || code === 'DPI-1085'
        || code === 'DPI-1086'
        || code === 'DPI-1088'
}

function isOracleDbError(error: unknown): error is DBError {
    return !!error && error instanceof Error && (
        typeof (error as DBError).message === 'string'
        && (typeof (error as DBError).code === 'string' || typeof (error as DBError).errorNum === 'number' || getOracleErrorCode(error as DBError) !== '')
    )
}

function getOracleErrorCode(error: DBError): string {
    const code = error.code
    if (typeof code === 'string' && code) {
        return code
    }
    const message = error.message || ''
    const match = /^(NJS|DPI|ORA|OCI)-\d{3,5}/.exec(message)
    return match?.[0] || ''
}

function isNodeOracleNetworkErrorCode(code: string): boolean {
    return code === 'ECONNRESET'
        || code === 'EPIPE'
        || code === 'ETIMEDOUT'
        || code === 'ESOCKETTIMEDOUT'
        || code === 'ECONNREFUSED'
        || code === 'EHOSTUNREACH'
        || code === 'ENETUNREACH'
        || code === 'ENOTFOUND'
        || code === 'EAI_AGAIN'
}

function isOracleForbiddenConcurrentUsageCode(code: string): boolean {
    return code === 'NJS-017' || code === 'NJS-023' || code === 'NJS-081' || code === 'NJS-104'
}

function isOracleDriverConnectionLostCode(code: string): boolean {
    return code === 'NJS-003'
        || code === 'NJS-500'
        || code === 'NJS-501'
        || code === 'NJS-513'
        || code === 'NJS-521'
        || code === 'DPI-1010'
        || code === 'DPI-1080'
        || code === 'ECONNRESET'
        || code === 'EPIPE'
}

function isOracleDriverConnectionTemporarilyUnavailableCode(code: string): boolean {
    return code === 'NJS-503'
        || code === 'NJS-504'
        || code === 'NJS-511'
        || code === 'ECONNREFUSED'
        || code === 'EHOSTUNREACH'
        || code === 'ENETUNREACH'
}

function isOracleDriverInvalidConnectionConfigurationCode(code: string): boolean {
    return code === 'NJS-045'
        || code === 'NJS-067'
        || code === 'NJS-075'
        || code === 'NJS-080'
        || code === 'NJS-085'
        || code === 'NJS-086'
        || code === 'NJS-090'
        || code === 'NJS-091'
        || code === 'NJS-092'
        || code === 'NJS-101'
        || code === 'NJS-118'
        || code === 'NJS-125'
        || code === 'NJS-136'
        || code === 'NJS-140'
        || code === 'NJS-505'
        || code === 'NJS-506'
        || code === 'NJS-507'
        || code === 'NJS-508'
        || code === 'NJS-512'
        || code === 'NJS-514'
        || code === 'NJS-515'
        || code === 'NJS-516'
        || code === 'NJS-517'
        || code === 'NJS-518'
        || code === 'NJS-519'
        || code === 'NJS-520'
        || code === 'NJS-523'
        || code === 'NJS-524'
        || code === 'NJS-529'
        || code === 'NJS-530'
        || code === 'NJS-531'
        || code === 'NJS-532'
        || code === 'NJS-533'
        || code === 'NJS-534'
        || code === 'NJS-535'
        || code === 'DPI-1005'
        || code === 'DPI-1012'
        || code === 'DPI-1026'
        || code === 'DPI-1032'
        || code === 'DPI-1047'
        || code === 'DPI-1049'
        || code === 'DPI-1050'
        || code === 'DPI-1058'
        || code === 'DPI-1061'
        || code === 'DPI-1069'
        || code === 'DPI-1072'
        || code === 'DPI-1079'
        || code === 'DPI-1082'
        || code === 'DPI-1083'
        || code === 'ENOTFOUND'
        || code === 'EAI_AGAIN'
}

function isOracleDriverPoolErrorCode(code: string): boolean {
    return code === 'NJS-002'
        || code === 'NJS-046'
        || code === 'NJS-047'
        || code === 'NJS-064'
        || code === 'NJS-065'
        || code === 'NJS-082'
        || code === 'NJS-083'
        || code === 'DPI-1011'
}

function isOracleDriverConnectionTimeoutCode(code: string): boolean {
    return code === 'NJS-040' || code === 'NJS-510' || code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT'
}

function isOracleDriverStatementTimeoutCode(code: string): boolean {
    return code === 'NJS-123' || code === 'DPI-1067'
}

function isOracleDriverPoolResourceLimitCode(code: string): boolean {
    return code === 'NJS-076'
}

function isOracleDriverMemoryResourceLimitCode(code: string): boolean {
    return code === 'NJS-024' || code === 'DPI-1001'
}

function isOracleDriverUnsupportedFeatureCode(code: string): boolean {
    return code === 'NJS-010'
        || code === 'NJS-078'
        || code === 'NJS-089'
        || code === 'NJS-100'
        || code === 'NJS-116'
        || code === 'NJS-126'
        || code === 'NJS-130'
        || code === 'NJS-133'
        || code === 'NJS-138'
        || code === 'NJS-144'
        || code === 'NJS-145'
        || code === 'NJS-155'
        || code === 'NJS-156'
        || code === 'DPI-1008'
        || code === 'DPI-1013'
        || code === 'DPI-1014'
        || code === 'DPI-1020'
        || code === 'DPI-1064'
        || code === 'DPI-1066'
        || code === 'DPI-1076'
        || code === 'DPI-1077'
        || code === 'DPI-1078'
        || code === 'DPI-1084'
}

function isOracleDriverInvalidSqlStatementCode(code: string): boolean {
    return code === 'NJS-019'
        || code === 'NJS-095'
        || code === 'NJS-157'
        || code === 'DPI-1007'
        || code === 'DPI-1063'
        || code === 'DPI-1087'
}

function isOracleDriverInvalidValueCode(code: string): boolean {
    return code === 'NJS-105'
        || code === 'NJS-114'
        || code === 'NJS-115'
        || code === 'NJS-119'
        || code === 'NJS-139'
        || code === 'NJS-142'
        || code === 'NJS-143'
        || code === 'NJS-162'
        || code === 'DPI-1006'
        || code === 'DPI-1016'
        || code === 'DPI-1017'
        || code === 'DPI-1041'
        || code === 'DPI-1042'
        || code === 'DPI-1043'
        || code === 'DPI-1044'
        || code === 'DPI-1045'
        || code === 'DPI-1055'
}

function isOracleDriverObjectStateErrorCode(code: string): boolean {
    return code === 'NJS-018'
        || code === 'NJS-022'
        || code === 'NJS-041'
        || code === 'NJS-042'
        || code === 'NJS-043'
        || code === 'NJS-066'
        || code === 'NJS-107'
        || code === 'NJS-146'
        || code === 'NJS-147'
        || code === 'DPI-1023'
        || code === 'DPI-1029'
        || code === 'DPI-1039'
        || code === 'DPI-1040'
        || code === 'DPI-1056'
        || code === 'DPI-1060'
        || code === 'DPI-1068'
}

function isOracleDriverTransactionErrorCode(code: string): boolean {
    return code === 'NJS-170'
        || code === 'NJS-171'
        || code === 'NJS-172'
}

function isOracleDriverAuthenticationErrorCode(code: string): boolean {
    return code === 'NJS-084'
        || code === 'NJS-087'
        || code === 'NJS-168'
        || code === 'DPI-1081'
}

function isOracleDriverConfigurationErrorCode(code: string): boolean {
    return code === 'NJS-069'
        || code === 'DPI-1052'
        || code === 'DPI-1065'
}

function isOracleDriverRoutineErrorCode(code: string): boolean {
    return code === 'NJS-169' || code === 'NJS-700'
}

function isOracleDriverIoErrorCode(code: string): boolean {
    return code === 'DPI-1075'
}

function isOracleDriverInternalErrorCode(code: string): boolean {
    return code === 'NJS-099'
        || code === 'NJS-102'
        || code === 'NJS-103'
        || code === 'NJS-106'
        || code === 'NJS-111'
        || code === 'NJS-112'
        || code === 'NJS-113'
        || code === 'NJS-127'
        || code === 'NJS-128'
        || code === 'NJS-152'
        || code === 'NJS-173'
        || code === 'DPI-1000'
        || code === 'DPI-1002'
        || code === 'DPI-1003'
        || code === 'DPI-1004'
        || code === 'DPI-1030'
        || code === 'DPI-1033'
        || code === 'DPI-1034'
        || code === 'DPI-1037'
        || code === 'DPI-1062'
        || code === 'DPI-1074'
}

function getOracleInvalidParameterDetails(code: string, message: string): Partial<Extract<TsSqlErrorReason, { reason: 'SQL_INVALID_PARAMETER' }>> {
    if (code === 'NJS-009') {
        const match = /(\d+) provided but expected between (\d+) and (\d+)/.exec(message)
        return {
            parameterErrorType: 'wrong count',
            actualParameterCount: match?.[1] ? Number(match[1]) : undefined,
            expectedParameterCount: match?.[2] === match?.[3] && match?.[2] ? Number(match[2]) : undefined,
        }
    }
    if (code === 'NJS-097' || code === 'NJS-137') {
        return { parameterErrorType: 'missing', parameterName: extractOracleDriverBindName(message) }
    }
    if (code === 'NJS-062' || code === 'NJS-063') {
        return { parameterErrorType: 'missing' }
    }
    if (code === 'NJS-098') {
        const match = /(\d+) bind placeholders were used .* but (\d+) bind values were provided/.exec(message)
        return {
            parameterErrorType: 'wrong count',
            expectedParameterCount: match?.[1] ? Number(match[1]) : undefined,
            actualParameterCount: match?.[2] ? Number(match[2]) : undefined,
        }
    }
    if (code === 'NJS-056' || code === 'NJS-059') {
        return { parameterErrorType: 'missing', parameterIndex: extractFirstNumber(message) }
    }
    if (code === 'NJS-057' || code === 'NJS-060') {
        return { parameterErrorType: 'missing', parameterName: extractOracleDriverBindName(message) }
    }
    if (code === 'NJS-012' || code === 'NJS-034' || code === 'NJS-037' || code === 'NJS-052' || code === 'NJS-109' || code === 'NJS-110' || code === 'NJS-121' || code === 'NJS-158' || code === 'NJS-159' || code === 'NJS-160' || code === 'DPI-1021' || code === 'DPI-1071') {
        return { parameterErrorType: 'invalid type' }
    }
    if (code === 'NJS-013' || code === 'NJS-016' || code === 'NJS-044' || code === 'NJS-055' || code === 'NJS-149' || code === 'DPI-1059') {
        return { parameterErrorType: code === 'DPI-1059' ? 'not bindable' : 'invalid binding' }
    }
    if (code === 'NJS-131' || code === 'NJS-132' || code === 'DPI-1009' || code === 'DPI-1024' || code === 'DPI-1027' || code === 'DPI-1028') {
        return { parameterErrorType: 'invalid index', parameterIndex: extractFirstNumber(message) }
    }
    if (code === 'DPI-1025' || code === 'DPI-1046' || code === 'DPI-1053' || code === 'DPI-1070' || code === 'DPI-1073') {
        return { parameterErrorType: 'missing' }
    }
    if (code === 'NJS-120' || code === 'NJS-122' || code === 'NJS-166' || code === 'NJS-167') {
        return { parameterErrorType: 'invalid type' }
    }
    return { parameterErrorType: 'invalid value' }
}

function getOracleDriverInvalidValueType(code: string): Extract<TsSqlErrorReason, { reason: 'SQL_INVALID_VALUE' }>['errorType'] {
    if (code === 'NJS-142' || code === 'NJS-143' || code === 'DPI-1045') {
        return 'too long'
    }
    if (code === 'NJS-115' || code === 'DPI-1044') {
        return 'out of range'
    }
    if (code === 'NJS-162') {
        return 'invalid json'
    }
    if (code === 'NJS-139') {
        return 'invalid xml'
    }
    if (code === 'DPI-1017') {
        return 'null not allowed'
    }
    if (code === 'DPI-1006' || code === 'DPI-1041') {
        return 'invalid encoding'
    }
    return 'invalid value'
}

function getOracleDriverObjectStateErrorType(code: string): Extract<TsSqlErrorReason, { reason: 'SQL_OBJECT_STATE_ERROR' }>['objectStateErrorType'] {
    if (code === 'NJS-146' || code === 'DPI-1023' || code === 'DPI-1056') {
        return 'wrong object type'
    }
    return 'invalid state'
}

function getOracleDriverObjectType(code: string): Extract<TsSqlErrorReason, { reason: 'SQL_OBJECT_STATE_ERROR' }>['objectType'] {
    if (code === 'NJS-018' || code === 'NJS-041' || code === 'NJS-042' || code === 'NJS-043' || code === 'NJS-107' || code === 'NJS-147' || code === 'DPI-1029' || code === 'DPI-1039') {
        return 'cursor'
    }
    if (code === 'NJS-061' || code === 'NJS-066' || code === 'DPI-1060' || code === 'DPI-1068') {
        return 'cursor'
    }
    return undefined
}

function getOracleDriverTransactionErrorType(code: string): Extract<TsSqlErrorReason, { reason: 'TRANSACTION_ERROR' }>['transactionErrorType'] | 'not in transaction' {
    if (code === 'NJS-171') {
        return 'active transaction'
    }
    if (code === 'NJS-172') {
        return 'not in transaction'
    }
    return 'invalid state'
}

function extractOracleDriverBindName(message: string): string | undefined {
    const bind = /":([^"]+)"/.exec(message)
    return bind?.[1]
}

function extractOracleDriverMissingAttribute(message: string): string | undefined {
    const match = /attribute (.+?) is not part of object type/.exec(message)
    return match?.[1]
}

function extractOracleDriverQuotedObjectName(message: string): string | undefined {
    const match = /"([^"]+)"\."([^"]+)"/.exec(message)
    if (match) {
        return `${match[1]}.${match[2]}`
    }
    return undefined
}

function extractFirstNumber(message: string): number | undefined {
    const messageWithoutCode = message.replace(/^[A-Z]{3}-\d{3,5}:\s*/, '')
    const match = /-?\d+/.exec(messageWithoutCode)
    return match ? Number(match[0]) : undefined
}

function extractOracleDriverBracketIndex(message: string): number | undefined {
    const match = /index \[(-?\d+)\]/.exec(message)
    return match ? Number(match[1]) : undefined
}
