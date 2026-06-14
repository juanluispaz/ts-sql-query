import type { AnyValueSource, __AggregatedArrayColumns } from '../expressions/values.js'
import { isValueSource } from '../expressions/values.js'
import { AbstractMySqlMariaDBSqlBuilder } from './AbstractMySqlMariaBDSqlBuilder.js'
import type { FlatQueryColumns, InsertData, SelectData } from './SqlBuilder.js'
import { flattenQueryColumns } from './SqlBuilder.js'
import type { DBColumn } from '../utils/Column.js'
import { __getColumnPrivate } from '../utils/Column.js'
import { __getTableOrViewPrivate } from '../utils/ITableOrView.js'

export class MariaDBSqlBuilder extends AbstractMySqlMariaDBSqlBuilder {
    mariaDB: true = true
    override _isReservedKeyword(word: string): boolean {
        return word.toUpperCase() in reservedWords
    }
    override _useInsertSupportWith(): boolean {
        // MariaDB rejects the leading `WITH cte AS (...) INSERT INTO ...`
        // form at parse time (ER_PARSE_ERROR), but accepts the CTE *inside*
        // the SELECT of an INSERT ... SELECT (`INSERT INTO t (cols)
        // WITH cte AS (...) SELECT ...`). Returning false makes the builder
        // emit that inner-WITH form (the same mechanism Oracle uses).
        // Verified against mariadb:latest (server 12.3.2).
        return false
    }
    // No `_appendCompoundOperator` override: MariaDB renders `.minus(...)` /
    // `.minusAll(...)` as the abstract builder's `EXCEPT` / `EXCEPT ALL`
    // (the same form PostgreSQL and MySQL emit). MariaDB's `MINUS` keyword
    // only exists under `SET SQL_MODE=ORACLE` — which ts-sql-query does not
    // set — so in the default mode every connection uses, `MINUS` is a parse
    // error on every version while `EXCEPT` (since 10.3.0) always works.
    override _supportOrderByWhenAggregateArray = true
    override _supportLimitWhenAggregateArray = true
    override _appendRawColumnNameForValuesForInsert(column: DBColumn, _params: any[]): string {
        // MariaDB 10.3 renamed the VALUES() function to VALUE() to avoid clashing
        // with the standard Table Value Constructors syntax introduced in the same
        // release (MDEV-12172). The legacy VALUES() name still works inside
        // ON DUPLICATE KEY UPDATE but VALUE() is the preferred form on every
        // version that recognises it.
        if (this._connectionConfiguration.compatibilityVersion >= 10_003_003) {
            const columnPrivate = __getColumnPrivate(column)
            return 'value(' + this._escape(columnPrivate.__name, true) + ')'
        }
        return super._appendRawColumnNameForValuesForInsert(column, _params)
    }
    override _appendRawColumnName(column: DBColumn, params: any[]): string {
        // MariaDB 13.0.1 added UPDATE ... RETURNING with the OLD_VALUE(col) function
        // (MDEV-5092) to reference a column's value from before the update; bare
        // column references inside RETURNING already return the post-update value,
        // so no special handling is needed for the new-value side.
        if (this._connectionConfiguration.compatibilityVersion >= 13_000_001) {
            const columnPrivate = __getColumnPrivate(column)
            const tableOrView = columnPrivate.__tableOrView
            if (__getTableOrViewPrivate(tableOrView).__oldValues) {
                return 'old_value(' + this._escape(columnPrivate.__name, true) + ')'
            }
        }
        return super._appendRawColumnName(column, params)
    }
    override _nextSequenceValue(_params: any[], sequenceName: string): string {
        // MariaDB sequences (MDEV-10139, MariaDB 10.3.0) expose NEXTVAL(seq) for the
        // function form and the SQL-standard NEXT VALUE FOR seq alias; we emit the
        // function form because it accepts a regular (back-tick-escaped) identifier.
        return 'nextval(' + this._escape(sequenceName, false) + ')'
    }
    override _currentSequenceValue(_params: any[], sequenceName: string): string {
        // LASTVAL(seq) returns the most recent NEXTVAL(seq) issued in the current
        // connection (NULL if none); equivalent to PostgreSQL's currval() and to
        // the SQL-standard PREVIOUS VALUE FOR seq.
        return 'lastval(' + this._escape(sequenceName, false) + ')'
    }
    override _buildInsertReturning(query: InsertData, params: any[]): string {
        if (this._connectionConfiguration.compatibilityVersion >= 10_005_000 || query.__from || query.__multiple || query.__columns || query.__onConflictUpdateSets) {
            return super._buildInsertReturning(query, params)
        }
        this._setContainsInsertReturningClause(params, false)
        return ''
    }
    override _appendAggragateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayDistinct: boolean, params: any[], query: SelectData | undefined): string {
        const distict = aggregatedArrayDistinct ? 'distinct ' : ''
        let result = ''
        if (isValueSource(aggregatedArrayColumns)) {
            result += 'json_arrayagg(' + distict + this._appendSql(aggregatedArrayColumns, params, false)
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', " + this._appendSql(columns[prop]!, params, false)
            }

            result = 'json_arrayagg(' +  distict + 'json_object(' + result + ')'
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
