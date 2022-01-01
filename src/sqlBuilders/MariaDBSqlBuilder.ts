import { AnyValueSource, isValueSource, __AggregatedArrayColumns } from "../expressions/values"
import { AbstractMySqlMariaDBSqlBuilder } from "./AbstractMySqlMariaBDSqlBuilder"
import { CompoundOperator, FlatQueryColumns, flattenQueryColumns, SelectData } from "./SqlBuilder"

export class MariaDBSqlBuilder extends AbstractMySqlMariaDBSqlBuilder {
    mariaDB: true = true
    _isReservedKeyword(word: string): boolean {
        return word.toUpperCase() in reservedWords
    }
    _appendCompoundOperator(compoundOperator: CompoundOperator, _params: any[]): string {
        switch(compoundOperator) {
            case 'union':
                return ' union '
            case 'unionAll':
                return ' union all '
            case 'intersect':
                return ' intersect '
            case 'intersectAll':
                return ' intersect all '
            case 'except':
                return ' except '
            case 'exceptAll':
                return ' except all '
            case 'minus':
                return ' minus '
            case 'minusAll':
                return ' minus all '
            default:
                throw new Error('Invalid compound operator: ' + compoundOperator)
        }   
    }
    _supportOrderByWhenAggregateArray = true
    _supportLimitWhenAggregateArray = true
    _appendAggragateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, params: any[], query: SelectData | undefined): string {
        let result = ''
        if (isValueSource(aggregatedArrayColumns)) {
            result += 'json_arrayagg(' + this._appendSql(aggregatedArrayColumns, params)
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', " + this._appendSql(columns[prop]!, params)
            }

            result = 'json_arrayagg(json_object(' + result + ')'
        }

        if (query && query.__asInlineAggregatedArrayValue && !this._isAggregateArrayWrapped(params)) {
            if (this._supportOrderByWhenAggregateArray) {
                result += this._buildAggregateArrayOrderBy(query, params, true)
            }
            if (this._supportLimitWhenAggregateArray) {
                result += this._buildSelectLimitOffset(query, params)
            }
        }
        return result + ')'
    }
}

// Source: https://mariadb.com/kb/en/reserved-words/ (version: 10.4)
const reservedWords: { [word: string]: boolean | undefined } = {
    ACCESSIBLE: true,
    ADD: true,
    ALL: true,
    ALTER: true,
    ANALYZE: true,
    AND: true,
    AS: true,
    ASC: true,
    ASENSITIVE: true,
    BEFORE: true,
    BETWEEN: true,
    BIGINT: true,
    BINARY: true,
    BLOB: true,
    BOTH: true,
    BY: true,
    CALL: true,
    CASCADE: true,
    CASE: true,
    CHANGE: true,
    CHAR: true,
    CHARACTER: true,
    CHECK: true,
    COLLATE: true,
    COLUMN: true,
    CONDITION: true,
    CONSTRAINT: true,
    CONTINUE: true,
    CONVERT: true,
    CREATE: true,
    CROSS: true,
    CURRENT_DATE: true,
    CURRENT_ROLE: true,
    CURRENT_TIME: true,
    CURRENT_TIMESTAMP: true,
    CURRENT_USER: true,
    CURSOR: true,
    DATABASE: true,
    DATABASES: true,
    DAY_HOUR: true,
    DAY_MICROSECOND: true,
    DAY_MINUTE: true,
    DAY_SECOND: true,
    DEC: true,
    DECIMAL: true,
    DECLARE: true,
    DEFAULT: true,
    DELAYED: true,
    DELETE: true,
    DESC: true,
    DESCRIBE: true,
    DETERMINISTIC: true,
    DISTINCT: true,
    DISTINCTROW: true,
    DIV: true,
    DO_DOMAIN_IDS: true,
    DOUBLE: true,
    DROP: true,
    DUAL: true,
    EACH: true,
    ELSE: true,
    ELSEIF: true,
    ENCLOSED: true,
    ESCAPED: true,
    EXCEPT: true,
    EXISTS: true,
    EXIT: true,
    EXPLAIN: true,
    FALSE: true,
    FETCH: true,
    FLOAT: true,
    FLOAT4: true,
    FLOAT8: true,
    FOR: true,
    FORCE: true,
    FOREIGN: true,
    FROM: true,
    FULLTEXT: true,
    GENERAL: true,
    GRANT: true,
    GROUP: true,
    HAVING: true,
    HIGH_PRIORITY: true,
    HOUR_MICROSECOND: true,
    HOUR_MINUTE: true,
    HOUR_SECOND: true,
    IF: true,
    IGNORE: true,
    IGNORE_DOMAIN_IDS: true,
    IGNORE_SERVER_IDS: true,
    IN: true,
    INDEX: true,
    INFILE: true,
    INNER: true,
    INOUT: true,
    INSENSITIVE: true,
    INSERT: true,
    INT: true,
    INT1: true,
    INT2: true,
    INT3: true,
    INT4: true,
    INT8: true,
    INTEGER: true,
    INTERSECT: true,
    INTERVAL: true,
    INTO: true,
    IS: true,
    ITERATE: true,
    JOIN: true,
    KEY: true,
    KEYS: true,
    KILL: true,
    LEADING: true,
    LEAVE: true,
    LEFT: true,
    LIKE: true,
    LIMIT: true,
    LINEAR: true,
    LINES: true,
    LOAD: true,
    LOCALTIME: true,
    LOCALTIMESTAMP: true,
    LOCK: true,
    LONG: true,
    LONGBLOB: true,
    LONGTEXT: true,
    LOOP: true,
    LOW_PRIORITY: true,
    MASTER_HEARTBEAT_PERIOD: true,
    MASTER_SSL_VERIFY_SERVER_CERT: true,
    MATCH: true,
    MAXVALUE: true,
    MEDIUMBLOB: true,
    MEDIUMINT: true,
    MEDIUMTEXT: true,
    MIDDLEINT: true,
    MINUTE_MICROSECOND: true,
    MINUTE_SECOND: true,
    MOD: true,
    MODIFIES: true,
    NATURAL: true,
    NOT: true,
    NO_WRITE_TO_BINLOG: true,
    NULL: true,
    NUMERIC: true,
    ON: true,
    OPTIMIZE: true,
    OPTION: true,
    OPTIONALLY: true,
    OR: true,
    ORDER: true,
    OUT: true,
    OUTER: true,
    OUTFILE: true,
    OVER: true,
    PAGE_CHECKSUM: true,
    PARSE_VCOL_EXPR: true,
    PARTITION: true,
    PRECISION: true,
    PRIMARY: true,
    PROCEDURE: true,
    PURGE: true,
    RANGE: true,
    READ: true,
    READS: true,
    READ_WRITE: true,
    REAL: true,
    RECURSIVE: true,
    REF_SYSTEM_ID: true,
    REFERENCES: true,
    REGEXP: true,
    RELEASE: true,
    RENAME: true,
    REPEAT: true,
    REPLACE: true,
    REQUIRE: true,
    RESIGNAL: true,
    RESTRICT: true,
    RETURN: true,
    RETURNING: true,
    REVOKE: true,
    RIGHT: true,
    RLIKE: true,
    ROWS: true,
    SCHEMA: true,
    SCHEMAS: true,
    SECOND_MICROSECOND: true,
    SELECT: true,
    SENSITIVE: true,
    SEPARATOR: true,
    SET: true,
    SHOW: true,
    SIGNAL: true,
    SLOW: true,
    SMALLINT: true,
    SPATIAL: true,
    SPECIFIC: true,
    SQL: true,
    SQLEXCEPTION: true,
    SQLSTATE: true,
    SQLWARNING: true,
    SQL_BIG_RESULT: true,
    SQL_CALC_FOUND_ROWS: true,
    SQL_SMALL_RESULT: true,
    SSL: true,
    STARTING: true,
    STATS_AUTO_RECALC: true,
    STATS_PERSISTENT: true,
    STATS_SAMPLE_PAGES: true,
    STRAIGHT_JOIN: true,
    TABLE: true,
    TERMINATED: true,
    THEN: true,
    TINYBLOB: true,
    TINYINT: true,
    TINYTEXT: true,
    TO: true,
    TRAILING: true,
    TRIGGER: true,
    TRUE: true,
    UNDO: true,
    UNION: true,
    UNIQUE: true,
    UNLOCK: true,
    UNSIGNED: true,
    UPDATE: true,
    USAGE: true,
    USE: true,
    USING: true,
    UTC_DATE: true,
    UTC_TIME: true,
    UTC_TIMESTAMP: true,
    VALUES: true,
    VARBINARY: true,
    VARCHAR: true,
    VARCHARACTER: true,
    VARYING: true,
    WHEN: true,
    WHERE: true,
    WHILE: true,
    WINDOW: true,
    WITH: true,
    WRITE: true,
    XOR: true,
    YEAR_MONTH: true,
    ZEROFILL: true,
    BODY: true,
    ELSIF: true,
    GOTO: true,
    HISTORY: true,
    OTHERS: true,
    PACKAGE: true,
    PERIOD: true,
    RAISE: true,
    ROWTYPE: true,
    SYSTEM: true,
    SYSTEM_TIME: true,
    VERSIONING: true,
    WITHOUT: true    
}
