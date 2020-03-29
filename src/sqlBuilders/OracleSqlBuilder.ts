import { AbstractSqlBuilder } from "./AbstractSqlBuilder"
import { ToSql, InsertData } from "./SqlBuilder"
import { TypeAdapter } from "../TypeAdapter"
import { ValueSource } from "../expressions/values"
import { __getColumnOfTable, __getColumnPrivate } from "../utils/Column"

export class OracleSqlBuilder extends AbstractSqlBuilder {
    oracle: true = true
    constructor() {
        super()
        this._operationsThatNeedParenthesis._getDate = true
        this._operationsThatNeedParenthesis._getMilliseconds = false
    }

    _isReservedKeyword(word: string): boolean {
        return word.toUpperCase() in reservedWords
    }
    _nextSequenceValue(_params: any[], sequenceName: string) {
        return this._escape(sequenceName) + '.nextval'
    }
    _currentSequenceValue(_params: any[], sequenceName: string): string {
        return this._escape(sequenceName) + '.currval'
    }
    _fromNoTable() {
        return ' from dual'
    }
    _trueValue = 'cast(1 as boolean)'
    _falseValue = 'cast(0 as boolean)'
    _appendColumnAlias(name: string, _params: any[]): string {
        return '"' + name + '"'
    }
    _buildInsertMultiple(query: InsertData, params: any[]): string {
        const multiple = query.__multiple
        if (!multiple) {
            throw new Error('Exepected a multiple insert')
        }
        if (multiple.length <= 0) {
            return ''
        }

        const table = query.__table
        const oldSafeTableOrView = this._getSafeTableOrView(params)
        this._setSafeTableOrView(params, table)

        const returning = !!query.__idColumn

        let insertAll: string
        let insertInto: string
        let end: string
        if (returning) {
            insertInto = 'insert into '
            end = '; '
            insertAll = ''
        } else {
            insertInto = ' into '
            end = ''
            insertAll = 'insert all'
        }

        for (let i = 0, length = multiple.length; i < length; i++) {

            const sets = multiple[i]
    
            let columns = ''
            let values = ''
    
            for (var columnName in table) {
                if (columnName in sets) {
                    continue
                }
                const column = __getColumnOfTable(table, columnName)
                if (!column) {
                    continue
                }
                const columnPrivate = __getColumnPrivate(column)
                if (!columnPrivate.__sequenceName) {
                    continue
                }
    
                if (columns) {
                    columns += ', '
                    values += ', '
                }
    
                columns += this._appendSql(column, params)
                values += this._nextSequenceValue(params, columnPrivate.__sequenceName)
            }
    
            const properties = Object.getOwnPropertyNames(sets)
            for (let i = 0, length = properties.length; i < length; i++) {
                if (columns) {
                    columns += ', '
                    values += ', '
                }
    
                const property = properties[i]
                const value = sets[property]
                const column = __getColumnOfTable(table, property)
                if (column) {
                    columns += this._appendSql(column, params)
                    const columnPrivate = __getColumnPrivate(column)
                    values += this._appendValue(value, params, columnPrivate.__columnType, columnPrivate.__typeAdapter)
                } else {
                    throw new Error('Unable to find the column "' + property + ' in the table "' + this._getTableOrViewNameInSql(table) +'". The column is not included in the table definition')
                }
            }
    
            insertAll += insertInto + this._getTableOrViewNameInSql(table) + ' (' + columns + ')' + this._buildInsertOutput(query, params) + ' values (' + values + ')' + this._buildInsertReturning(query, params) + end
        }

        this._setSafeTableOrView(params, oldSafeTableOrView)

        if (returning) {
            return 'begin ' + insertAll + 'end;'
        } else {
            return insertAll + ' select ' + multiple.length + ' from dual'
        }
    }
    _buildInsertOutput(_query: InsertData, _params: any[]): string {
        return ''
    }
    _buildInsertReturning(query: InsertData, params: any[]): string {
        const idColumn = query.__idColumn
        if (!idColumn) {
            return ''
        }
        return ' returning ' + this._appendSql(idColumn, params) + ' into ' + this._queryRunner.addOutParam(params, '') // Empty name for the out params, no special name is requiered
    }
    _is(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'decode(' + this._appendSqlParenthesis(valueSource, params) + ', ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ', 1, 0 ) = 1'
    }
    _isNot(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'decode(' + this._appendSqlParenthesis(valueSource, params) + ', ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ', 1, 0 ) = 0'
    }
    _random(_params: any): string {
        return '(select dbms_random.value from dual)'
    }
    _currentDate(_params: any): string {
        return 'trunc(current_timestamp)'
    }
    _valueWhenNull(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'nvl(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _divide(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' / ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _asDouble(params: any[], valueSource: ToSql): string {
        return 'cast(' + this._appendSql(valueSource, params) + ' as float)'
    }
    _log10(params: any[], valueSource: ToSql): string {
        return 'log(' + this._appendSql(valueSource, params) + ', 10)'
    }
    _cbrt(params: any[], valueSource: ToSql): string {
        return 'power(' + this._appendSql(valueSource, params) + ', 3)'
    }
    _getDate(params: any[], valueSource: ToSql): string {
        return 'extract(day from ' + this._appendSql(valueSource, params) + ')'
    }
    _getTime(params: any[], valueSource: ToSql): string {
        return "round((" + this._appendSql(valueSource, params) + " - to_date('01-01-1970','DD-MM-YYYY')) * 86400000)"
    }
    _getFullYear(params: any[], valueSource: ToSql): string {
        return 'extract(year from ' + this._appendSql(valueSource, params) + ')'
    }
    _getMonth(params: any[], valueSource: ToSql): string {
        return 'extract(month from ' + this._appendSql(valueSource, params) + ')'
    }
    _getDay(params: any[], valueSource: ToSql): string {
        return 'extract(day_of_week from ' + this._appendSql(valueSource, params) + ') - 1'
    }
    _getHours(params: any[], valueSource: ToSql): string {
        return 'extract(hour from ' + this._appendSql(valueSource, params) + ')'
    }
    _getMinutes(params: any[], valueSource: ToSql): string {
        return 'extract(minute from ' + this._appendSql(valueSource, params) + ')'
    }
    _getSeconds(params: any[], valueSource: ToSql): string {
        return 'extract(second from ' + this._appendSql(valueSource, params) + ')'
    }
    _getMilliseconds(params: any[], valueSource: ToSql): string {
        return 'extract(millisecond from ' + this._appendSql(valueSource, params) + ')'
    }
    _buildCallProcedure(params: any[], procedureName: string, procedureParams: ValueSource<any, any, any>[]): string {
        let result = 'begin ' + this._escape(procedureName) + '('
        if (procedureParams.length > 0) {
            result += this._appendSql(procedureParams[0], params)

            for (let i = 1, length = procedureParams.length; i < length; i++) {
                result += ', ' + this._appendSql(procedureParams[i], params)
            }
        }

        return result + '); end;'
    }
    _buildCallFunction(params: any[], functionName: string, functionParams: ValueSource<any, any, any>[]): string {
        let result = 'select ' + this._escape(functionName) + '('
        if (functionParams.length > 0) {
            result += this._appendSql(functionParams[0], params)

            for (let i = 1, length = functionParams.length; i < length; i++) {
                result += ', ' + this._appendSql(functionParams[i], params)
            }
        }

        return result + ') from dual'
    }
    _stringConcat(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'listagg(' + this._appendSql(value, params) + ", ',') within group (order by" + this._appendSql(value, params) + ')'
        } else if (separator === '') {
            return 'listagg(' + this._appendSql(value, params) + ') within group (order by' +  this._appendSql(value, params) + ')'
        } else {
            return 'listagg(' + this._appendSql(value, params) + ', ' + this._appendValue(separator, params, 'string', undefined) + ') within group (order by' +  this._appendSql(value, params) + ')'
        }
    }
    _stringConcatDistinct(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'listagg(distinct ' + this._appendSql(value, params) + ", ',') within group (order by" +  this._appendSql(value, params) + ')'
        } else if (separator === '') {
            return 'listagg(distinct ' + this._appendSql(value, params) + ') within group (order by' +  this._appendSql(value, params) + ')'
        } else {
            return 'listagg(distinct ' + this._appendSql(value, params) + ', ' + this._appendValue(separator, params, 'string', undefined) + ') within group (order by' +  this._appendSql(value, params) + ')'
        }
    }
    _escapeLikeWildcard(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'string') {
            value = value.replace(/\[/g, '[[]')
            value = value.replace(/%/g, '[%]')
            value = value.replace(/_/g, '[]')
            return this._appendValue(value, params, columnType, typeAdapter)
        } else {
            return "replace(replace(replace(" + this._appendValue(value, params, columnType, typeAdapter) + ", '[', '[[]'), '%', '[%]'), '_', '[]')"
        }
    }
    _like(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' like ' + this._appendValue(value, params, columnType, typeAdapter) + " escape '\\'"
    }
    _notLike(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not like ' + this._appendValue(value, params, columnType, typeAdapter) + " escape '\\'"
    }
    _likeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ') like lower(' + this._appendValue(value, params, columnType, typeAdapter) + ") escape '\\'"
    }
    _notLikeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ') not like lower(' + this._appendValue(value, params, columnType, typeAdapter) + ") escape '\\'"
    }
    _startWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _notStartWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _endWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
    }
    _notEndWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
    }
    _startWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ') like lower(' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _notStartWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ') not like lower(' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _endWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
    }
    _notEndWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ") not like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
    }
    _contains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _notContains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _in(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (Array.isArray(value)) {
            if (value.length <= 0) {
                return this._falseValue
            } else {
                return this._appendSqlParenthesis(valueSource, params) + ' in ' + this._appendValue(value, params, columnType, typeAdapter)
            }
        } else {
            return this._appendSqlParenthesis(valueSource, params) + ' in (' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
    }
    _notIn(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (Array.isArray(value)) {
            if (value.length <= 0) {
                return this._trueValue
            } else {
                return this._appendSqlParenthesis(valueSource, params) + ' not in ' + this._appendValue(value, params, columnType, typeAdapter)
            }
        } else {
            return this._appendSqlParenthesis(valueSource, params) + ' not in (' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
    }
}

/*
 * Source: Combine reserved words from:
 * - Oracle 10g: https://docs.oracle.com/cd/B19306_01/em.102/b40103/app_oracle_reserved_words.htm
 * - Oracle 19: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Oracle-SQL-Reserved-Words.html#GUID-55C49D1E-BE08-4C50-A9DD-8593EB925612
 */
const reservedWords: { [word: string]: boolean | undefined } = {
    ACCOUNT: true,
    ACTIVATE: true,
    ADMIN: true,
    ADVISE: true,
    AFTER: true,
    ALL_ROWS: true,
    ALLOCATE: true,
    ANALYZE: true,
    ARCHIVE: true,
    ARCHIVELOG: true,
    ARRAY: true,
    AT: true,
    AUTHENTICATED: true,
    AUTHORIZATION: true,
    AUTOEXTEND: true,
    AUTOMATIC: true,
    BACKUP: true,
    BECOME: true,
    BEFORE: true,
    BEGIN: true,
    BFILE: true,
    BITMAP: true,
    BLOB: true,
    BLOCK: true,
    BODY: true,
    CACHE: true,
    CACHE_INSTANCES: true,
    CANCEL: true,
    CASCADE: true,
    CAST: true,
    CFILE: true,
    CHAINED: true,
    CHANGE: true,
    CHAR_CS: true,
    CHARACTER: true,
    CHECKPOINT: true,
    CHOOSE: true,
    CHUNK: true,
    CLEAR: true,
    CLOB: true,
    CLONE: true,
    CLOSE: true,
    CLOSE_CACHED_OPEN_CURSORS: true,
    COALESCE: true,
    COLUMNS: true,
    COMMIT: true,
    COMMITTED: true,
    COMPATIBILITY: true,
    COMPILE: true,
    COMPLETE: true,
    COMPOSITE_LIMIT: true,
    COMPUTE: true,
    CONNECT_TIME: true,
    CONSTRAINT: true,
    CONSTRAINTS: true,
    CONTENTS: true,
    CONTINUE: true,
    CONTROLFILE: true,
    CONVERT: true,
    COST: true,
    CPU_PER_CALL: true,
    CPU_PER_SESSION: true,
    CURRENT_SCHEMA: true,
    CURREN_USER: true,
    CURSOR: true,
    CYCLE: true,
    DANGLING: true,
    DATABASE: true,
    DATAFILE: true,
    DATAFILES: true,
    DATAOBJNO: true,
    DBA: true,
    DBHIGH: true,
    DBLOW: true,
    DBMAC: true,
    DEALLOCATE: true,
    DEBUG: true,
    DEC: true,
    DECLARE: true,
    DEFERRABLE: true,
    DEFERRED: true,
    DEGREE: true,
    DEREF: true,
    DIRECTORY: true,
    DISABLE: true,
    DISCONNECT: true,
    DISMOUNT: true,
    DISTRIBUTED: true,
    DML: true,
    DOUBLE: true,
    DUMP: true,
    EACH: true,
    ENABLE: true,
    END: true,
    ENFORCE: true,
    ENTRY: true,
    ESCAPE: true,
    EXCEPT: true,
    EXCEPTIONS: true,
    EXCHANGE: true,
    EXCLUDING: true,
    EXECUTE: true,
    EXPIRE: true,
    EXPLAIN: true,
    EXTENT: true,
    EXTENTS: true,
    EXTERNALLY: true,
    FAILED_LOGIN_ATTEMPTS: true,
    FALSE: true,
    FAST: true,
    FIRST_ROWS: true,
    FLAGGER: true,
    FLOB: true,
    FLUSH: true,
    FORCE: true,
    FOREIGN: true,
    FREELIST: true,
    FREELISTS: true,
    FULL: true,
    FUNCTION: true,
    GLOBAL: true,
    GLOBALLY: true,
    GLOBAL_NAME: true,
    GROUPS: true,
    HASH: true,
    HASHKEYS: true,
    HEADER: true,
    HEAP: true,
    IDGENERATORS: true,
    IDLE_TIME: true,
    IF: true,
    INCLUDING: true,
    INDEXED: true,
    INDEXES: true,
    INDICATOR: true,
    IND_PARTITION: true,
    INITIALLY: true,
    INITRANS: true,
    INSTANCE: true,
    INSTANCES: true,
    INSTEAD: true,
    INT: true,
    INTERMEDIATE: true,
    ISOLATION: true,
    ISOLATION_LEVEL: true,
    KEEP: true,
    KEY: true,
    KILL: true,
    LABEL: true,
    LAYER: true,
    LESS: true,
    LIBRARY: true,
    LIMIT: true,
    LINK: true,
    LIST: true,
    LOB: true,
    LOCAL: true,
    LOCKED: true,
    LOG: true,
    LOGFILE: true,
    LOGGING: true,
    LOGICAL_READS_PER_CALL: true,
    LOGICAL_READS_PER_SESSION: true,
    MANAGE: true,
    MASTER: true,
    MAX: true,
    MAXARCHLOGS: true,
    MAXDATAFILES: true,
    MAXINSTANCES: true,
    MAXLOGFILES: true,
    MAXLOGHISTORY: true,
    MAXLOGMEMBERS: true,
    MAXSIZE: true,
    MAXTRANS: true,
    MAXVALUE: true,
    MIN: true,
    MEMBER: true,
    MINIMUM: true,
    MINEXTENTS: true,
    MINVALUE: true,
    MLS_LABEL_FORMAT: true,
    MOUNT: true,
    MOVE: true,
    MTS_DISPATCHERS: true,
    MULTISET: true,
    NATIONAL: true,
    NCHAR: true,
    NCHAR_CS: true,
    NCLOB: true,
    NEEDED: true,
    NESTED: true,
    NETWORK: true,
    NEW: true,
    NEXT: true,
    NOARCHIVELOG: true,
    NOCACHE: true,
    NOCYCLE: true,
    NOFORCE: true,
    NOLOGGING: true,
    NOMAXVALUE: true,
    NOMINVALUE: true,
    NONE: true,
    NOORDER: true,
    NOOVERRIDE: true,
    NOPARALLEL: true,
    NOREVERSE: true,
    NORMAL: true,
    NOSORT: true,
    NOTHING: true,
    NUMERIC: true,
    NVARCHAR2: true,
    OBJECT: true,
    OBJNO: true,
    OBJNO_REUSE: true,
    OFF: true,
    OID: true,
    OIDINDEX: true,
    OLD: true,
    ONLY: true,
    OPCODE: true,
    OPEN: true,
    OPTIMAL: true,
    OPTIMIZER_GOAL: true,
    ORGANIZATION: true,
    OSLABEL: true,
    OVERFLOW: true,
    OWN: true,
    PACKAGE: true,
    PARALLEL: true,
    PARTITION: true,
    PASSWORD: true,
    PASSWORD_GRACE_TIME: true,
    PASSWORD_LIFE_TIME: true,
    PASSWORD_LOCK_TIME: true,
    PASSWORD_REUSE_MAX: true,
    PASSWORD_REUSE_TIME: true,
    PASSWORD_VERIFY_FUNCTION: true,
    PCTINCREASE: true,
    PCTTHRESHOLD: true,
    PCTUSED: true,
    PCTVERSION: true,
    PERCENT: true,
    PERMANENT: true,
    PLAN: true,
    PLSQL_DEBUG: true,
    POST_TRANSACTION: true,
    PRECISION: true,
    PRESERVE: true,
    PRIMARY: true,
    PRIVATE: true,
    PRIVATE_SGA: true,
    PRIVILEGE: true,
    PRIVILEGES: true,
    PROCEDURE: true,
    PROFILE: true,
    PURGE: true,
    QUEUE: true,
    QUOTA: true,
    RANGE: true,
    RBA: true,
    READ: true,
    READUP: true,
    REAL: true,
    REBUILD: true,
    RECOVER: true,
    RECOVERABLE: true,
    RECOVERY: true,
    REF: true,
    REFERENCES: true,
    REFERENCING: true,
    REFRESH: true,
    REPLACE: true,
    RESET: true,
    RESETLOGS: true,
    RESIZE: true,
    RESTRICTED: true,
    RETURN: true,
    RETURNING: true,
    REUSE: true,
    REVERSE: true,
    ROLE: true,
    ROLES: true,
    ROLLBACK: true,
    RULE: true,
    SAMPLE: true,
    SAVEPOINT: true,
    SB4: true,
    SCAN_INSTANCES: true,
    SCHEMA: true,
    SCN: true,
    SCOPE: true,
    SD_ALL: true,
    SD_INHIBIT: true,
    SD_SHOW: true,
    SEGMENT: true,
    SEG_BLOCK: true,
    SEG_FILE: true,
    SEQUENCE: true,
    SERIALIZABLE: true,
    SESSION_CACHED_CURSORS: true,
    SESSIONS_PER_USER: true,
    SHARED: true,
    SHARED_POOL: true,
    SHRINK: true,
    SKIP: true,
    SKIP_UNUSABLE_INDEXES: true,
    SNAPSHOT: true,
    SOME: true,
    SORT: true,
    SPECIFICATION: true,
    SPLIT: true,
    SQL_TRACE: true,
    STANDBY: true,
    STATEMENT_ID: true,
    STATISTICS: true,
    STOP: true,
    STORAGE: true,
    STORE: true,
    STRUCTURE: true,
    SWITCH: true,
    SYS_OP_ENFORCE_NOT_NULL$: true,
    SYS_OP_NTCIMG$: true,
    SYSDBA: true,
    SYSOPER: true,
    SYSTEM: true,
    TABLES: true,
    TABLESPACE: true,
    TABLESPACE_NO: true,
    TABNO: true,
    TEMPORARY: true,
    THAN: true,
    THE: true,
    THREAD: true,
    TIMESTAMP: true,
    TIME: true,
    TOPLEVEL: true,
    TRACE: true,
    TRACING: true,
    TRANSACTION: true,
    TRANSITIONAL: true,
    TRIGGERS: true,
    TRUE: true,
    TRUNCATE: true,
    TX: true,
    TYPE: true,
    UB2: true,
    UBA: true,
    UNARCHIVED: true,
    UNDO: true,
    UNLIMITED: true,
    UNLOCK: true,
    UNRECOVERABLE: true,
    UNTIL: true,
    UNUSABLE: true,
    UNUSED: true,
    UPDATABLE: true,
    USAGE: true,
    USE: true,
    USING: true,
    VALIDATION: true,
    VALUE: true,
    VARYING: true,
    WHEN: true,
    WITHOUT: true,
    WORK: true,
    WRITE: true,
    WRITEDOWN: true,
    WRITEUP: true,
    XID: true,
    YEAR: true,
    ZONE: true,
    ACCESS: true,
    ADD: true,
    ALL: true,
    ALTER: true,
    AND: true,
    ANY: true,
    AS: true,
    ASC: true,
    AUDIT: true,
    BETWEEN: true,
    BY: true,
    CHAR: true,
    CHECK: true,
    CLUSTER: true,
    COLUMN: true,
    COLUMN_VALUE: true,
    COMMENT: true,
    COMPRESS: true,
    CONNECT: true,
    CREATE: true,
    CURRENT: true,
    DATE: true,
    DECIMAL: true,
    DEFAULT: true,
    DELETE: true,
    DESC: true,
    DISTINCT: true,
    DROP: true,
    ELSE: true,
    EXCLUSIVE: true,
    EXISTS: true,
    FILE: true,
    FLOAT: true,
    FOR: true,
    FROM: true,
    GRANT: true,
    GROUP: true,
    HAVING: true,
    IDENTIFIED: true,
    IMMEDIATE: true,
    IN: true,
    INCREMENT: true,
    INDEX: true,
    INITIAL: true,
    INSERT: true,
    INTEGER: true,
    INTERSECT: true,
    INTO: true,
    IS: true,
    LEVEL: true,
    LIKE: true,
    LOCK: true,
    LONG: true,
    MAXEXTENTS: true,
    MINUS: true,
    MLSLABEL: true,
    MODE: true,
    MODIFY: true,
    NESTED_TABLE_ID: true,
    NOAUDIT: true,
    NOCOMPRESS: true,
    NOT: true,
    NOWAIT: true,
    NULL: true,
    NUMBER: true,
    OF: true,
    OFFLINE: true,
    ON: true,
    ONLINE: true,
    OPTION: true,
    OR: true,
    ORDER: true,
    PCTFREE: true,
    PRIOR: true,
    PUBLIC: true,
    RAW: true,
    RENAME: true,
    RESOURCE: true,
    REVOKE: true,
    ROW: true,
    ROWID: true,
    ROWNUM: true,
    ROWS: true,
    SELECT: true,
    SESSION: true,
    SET: true,
    SHARE: true,
    SIZE: true,
    SMALLINT: true,
    START: true,
    SUCCESSFUL: true,
    SYNONYM: true,
    SYSDATE: true,
    TABLE: true,
    THEN: true,
    TO: true,
    TRIGGER: true,
    UID: true,
    UNION: true,
    UNIQUE: true,
    UPDATE: true,
    USER: true,
    VALIDATE: true,
    VALUES: true,
    VARCHAR: true,
    VARCHAR2: true,
    VIEW: true,
    WHENEVER: true,
    WHERE: true,
    WITH: true
}