import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { AnyValueSource, ValueType, __AggregatedArrayColumns } from '../expressions/values.js'
import { isValueSource } from '../expressions/values.js'
import { AbstractMySqlMariaDBSqlBuilder } from './AbstractMySqlMariaBDSqlBuilder.js'
import type { FlatQueryColumns, InsertData, SelectData } from './SqlBuilder.js'
import { flattenQueryColumns } from './SqlBuilder.js'
import type { DBColumn } from '../utils/Column.js'
import { __getColumnPrivate } from '../utils/Column.js'
import { __getTableOrViewPrivate } from '../utils/ITableOrView.js'
import { isMariaDBReservedWord } from '../utils/mySqlMariaDB/mariaDBReservedWords.js'

export class MariaDBSqlBuilder extends AbstractMySqlMariaDBSqlBuilder {
    mariaDB: true = true
    // MariaDB 10.4.0 added DOUBLE as a cast target.
    override _castAsDoubleMinCompatibilityVersion: number = 10_004_000
    override _isReservedKeyword(word: string): boolean {
        return isMariaDBReservedWord(word)
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
    override _appendRawColumnNameForValuesForInsert(column: DBColumn, _context: SqlBuildContext): string {
        // MariaDB 10.3 renamed the VALUES() function to VALUE() to avoid clashing
        // with the standard Table Value Constructors syntax introduced in the same
        // release (MDEV-12172). The legacy VALUES() name still works inside
        // ON DUPLICATE KEY UPDATE but VALUE() is the preferred form on every
        // version that recognises it.
        if (this._connectionConfiguration.compatibilityVersion >= 10_003_003) {
            const columnPrivate = __getColumnPrivate(column)
            return 'value(' + this._escape(columnPrivate.__name, true) + ')'
        }
        return super._appendRawColumnNameForValuesForInsert(column, _context)
    }
    override _appendRawColumnName(column: DBColumn, context: SqlBuildContext): string {
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
        return super._appendRawColumnName(column, context)
    }
    override _nextSequenceValue(_context: SqlBuildContext, sequenceName: string, _columnType: ValueType): string {
        // MariaDB sequences (MDEV-10139, MariaDB 10.3.0) expose NEXTVAL(seq) for the
        // function form and the SQL-standard NEXT VALUE FOR seq alias; we emit the
        // function form because it accepts a regular (back-tick-escaped) identifier.
        return 'nextval(' + this._escape(sequenceName, false) + ')'
    }
    override _currentSequenceValue(_context: SqlBuildContext, sequenceName: string, _columnType: ValueType): string {
        // LASTVAL(seq) returns the most recent NEXTVAL(seq) issued in the current
        // connection (NULL if none); equivalent to PostgreSQL's currval() and to
        // the SQL-standard PREVIOUS VALUE FOR seq.
        return 'lastval(' + this._escape(sequenceName, false) + ')'
    }
    override _buildInsertReturning(query: InsertData, context: SqlBuildContext): string {
        if (this._connectionConfiguration.compatibilityVersion >= 10_005_000 || query.__from || query.__multiple || query.__columns || query.__onConflictUpdateSets) {
            return super._buildInsertReturning(query, context)
        }
        this._setContainsInsertReturningClause(context, false)
        return ''
    }
    /**
     * The distinct of an aggregated array stays inside `json_arrayagg`, which compares what goes in the JSON, also a
     * converted value: MariaDB doesn't see a column of the outer query inside a derived table (error 1054, `Unknown
     * column`), so a correlated select can't be written over a select of the distinct values
     */
    override _getDistinctAggregatedArrayToWrap(_query: SelectData, _columns: FlatQueryColumns): undefined {
        return undefined
    }
    override _appendAggragateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayDistinct: boolean, context: SqlBuildContext, query: SelectData | undefined): string {
        const distict = aggregatedArrayDistinct ? 'distinct ' : ''
        let result = ''
        if (isValueSource(aggregatedArrayColumns)) {
            result += 'json_arrayagg(' + distict + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, this._appendSql(aggregatedArrayColumns, context, false))
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', " + this._appendAggregatedArrayValueProjection(columns[prop]!, this._appendSql(columns[prop]!, context, false))
            }

            result = 'json_arrayagg(' +  distict + 'json_object(' + result + ')'
        }

        if (query && query.__asInlineAggregatedArrayValue && !context.aggregateArrayWrapped) {
            if (this._supportOrderByWhenAggregateArray) {
                result += this._buildAggregateArrayOrderBy(query, context, true)
            }
            if (this._supportLimitWhenAggregateArray) {
                result += this._buildSelectLimitOffset(query, context)
            }
        }
        return result + ')'
    }
}
