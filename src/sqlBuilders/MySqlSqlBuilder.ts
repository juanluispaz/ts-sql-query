import type { AnyValueSource, __AggregatedArrayColumns, ValueType } from '../expressions/values.js'
import { isValueSource, __getValueSourcePrivate, __isUuidValueSource, __isUuidValueType } from '../expressions/values.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import type { AnyTableOrView } from '../utils/ITableOrView.js'
import { __getTableOrViewPrivate } from '../utils/ITableOrView.js'
import { AbstractMySqlMariaDBSqlBuilder } from './AbstractMySqlMariaBDSqlBuilder.js'
import type { FlatQueryColumns, InsertData, SelectData, ToSql, WithQueryData } from './SqlBuilder.js'
import { flattenQueryColumns, getQueryColumn, hasWithData } from './SqlBuilder.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import type { DBColumn } from '../utils/Column.js'
import { __getColumnPrivate } from '../utils/Column.js'
import { isMySqlReservedWord } from '../utils/mySqlMariaDB/mySqlReservedWords.js'

export class MySqlSqlBuilder extends AbstractMySqlMariaDBSqlBuilder {
    mySql: true = true
    // MySQL 8.0.17 added DOUBLE (and FLOAT / REAL) as cast targets.
    override _castAsDoubleMinCompatibilityVersion: number = 8_000_017
    _getUuidStrategy(): 'string' | 'binary' {
        return this._connectionConfiguration.uuidStrategy as any || 'binary'
    }
    override _isReservedKeyword(word: string): boolean {
        return isMySqlReservedWord(word)
    }
    override _useInsertSupportWith(): boolean {
        // MySQL rejects the leading `WITH cte AS (...) INSERT INTO ...`
        // form at parse time (ER_PARSE_ERROR), but accepts the CTE *inside*
        // the SELECT of an INSERT ... SELECT (`INSERT INTO t (cols)
        // WITH cte AS (...) SELECT ...`). Returning false makes the builder
        // emit that inner-WITH form (the same mechanism Oracle uses).
        // Verified against mysql:9 (server 9.7).
        return false
    }
    override _withValuesRowConstructorKeyword(): string {
        // MySQL's table value constructor requires the `ROW(...)` row
        // constructor — the bare `VALUES (a, b)` form the SQL standard
        // (and every other supported dialect) uses is a parse error.
        // Verified against mysql:9 (server 9.7).
        return 'row'
    }
    override _buildInsertReturning(_query: InsertData, params: any[]): string {
        this._setContainsInsertReturningClause(params, false)
        return ''
    }
    override _appendRawColumnNameForValuesForInsert(column: DBColumn, params: any[]): string {
        // MySQL 8.0.19 introduced a row alias for INSERT ... ON DUPLICATE KEY UPDATE
        // (`INSERT ... AS new ON DUPLICATE KEY UPDATE col = new.col`), and 8.0.20
        // deprecated the previous VALUES(col) function reference in favour of it.
        // ts-sql-query uses its canonical alias name '_new_' (see _updateNewAlias),
        // matching the convention used elsewhere in the library.
        if (this._connectionConfiguration.compatibilityVersion >= 8_000_019) {
            const columnPrivate = __getColumnPrivate(column)
            return this._escape(this._updateNewAlias, true) + '.' + this._escape(columnPrivate.__name, true)
        }
        return super._appendRawColumnNameForValuesForInsert(column, params)
    }
    override _buildInsertOnConflictBeforeReturning(query: InsertData, params: any[]): string {
        if (this._connectionConfiguration.compatibilityVersion < 8_000_019) {
            return super._buildInsertOnConflictBeforeReturning(query, params)
        }

        if (query.__from && !query.__valuesForInsert) {
            // INSERT ... SELECT form: MySQL accepts the `AS _new_` row alias only
            // after a `VALUES (...)` tuple, never after a SELECT source — placing
            // it there is a parse error near `as _new_ on duplicate key update`.
            // Without the alias the target table is the only relation visible in
            // the SET clause, so unqualified column references are unambiguous;
            // emit the same shape MariaDB does (no alias, no forced table
            // qualifier). When the SET clause reads the would-be-inserted row,
            // _buildInsertSelectSource makes the select a derived table named `_new_`.
            return super._buildInsertOnConflictBeforeReturning(query, params)
        }

        // With the row alias `_new_` in scope on MySQL 8.0.19+, both the target
        // table and `_new_` are visible inside the SET clause. Unqualified
        // column references to the target table therefore become ambiguous and
        // MySQL rejects them with `ER_NON_UNIQ_ERROR (1052): Column '<col>' in
        // field list is ambiguous`. We use the existing force-alias mechanism
        // (the same one `_buildUpdate` uses to emulate `oldValues`) to qualify
        // column references to the target table with the table's own name. The
        // `_appendRawColumnNameForValuesForInsert` override handles references
        // through `tTable.valuesForInsert()` separately, emitting `_new_.col`.
        const oldForceAliasFor = this._getForceAliasFor(params)
        const oldForceAliasAs = this._getForceAliasAs(params)
        this._setForceAliasFor(params, query.__table)
        this._setForceAliasAs(params, __getTableOrViewPrivate(query.__table).__name)
        const result = super._buildInsertOnConflictBeforeReturning(query, params)
        this._setForceAliasFor(params, oldForceAliasFor)
        this._setForceAliasAs(params, oldForceAliasAs)

        if (!result) {
            return result
        }
        if (query.__from) {
            return result // `_new_` is the derived table of _buildInsertSelectSource
        }
        // The row alias must sit between the VALUES clause and ON DUPLICATE KEY UPDATE
        return ' as ' + this._escape(this._updateNewAlias, true) + result
    }
    override _buildInsertSelectSource(query: InsertData, from: SelectData, columns: string, params: any[], columnsForInsert: { [name: string]: DBColumn | undefined }): string {
        const select = super._buildInsertSelectSource(query, from, columns, params, columnsForInsert)
        if (this._connectionConfiguration.compatibilityVersion < 8_000_019 || !query.__valuesForInsert) {
            return select
        }
        return 'select * from (' + select + ') as ' + this._escape(this._updateNewAlias, true) + ' (' + columns + ')'
    }
    override _appendParam(value: any, params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (__isUuidValueType(columnType) && this._getUuidStrategy() === 'binary') {
            return 'uuid_to_bin(' + super._appendParam(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
        }
        return super._appendParam(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    override _appendColumnValue(value: AnyValueSource, params: any[], isOutermostQuery: boolean): string {
        if (isOutermostQuery && this._getUuidStrategy() === 'binary') {
            if (__isUuidValueSource(__getValueSourcePrivate(value))) {
                return 'bin_to_uuid(' + this._appendSql(value, params, false) + ')'
            }
        }
        // Delegate to the base so an outermost aggregated-array column is finalised to text
        // (`cast(... as char)`) — mysql2 pre-parses a JSON column and rounds bigints otherwise.
        return super._appendColumnValue(value, params, isOutermostQuery)
    }
    override _asString(params: any[], valueSource: ToSql): string {
        // Transform an uuid to string
        if (this._getUuidStrategy() === 'string') {
            // No conversion required
            return this._appendSql(valueSource, params, false)
        }
        return 'bin_to_uuid(' + this._appendSql(valueSource, params, false) + ')'
    }
    override _escapeRegexpReplacement(value: any, params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        // MySQL's `REGEXP_REPLACE` uses the ICU engine, whose replacement treats BOTH `$`
        // (group references `$0` / `$1`) and `\` as metacharacters — unlike MariaDB/PostgreSQL,
        // where only `\` is special. Escape both with a leading backslash (`$` → `\$`,
        // `\` → `\\`) so the replacement stays literal, matching `replaceAll`.
        if (typeof value === 'string') {
            return this._appendValue(value.replace(/[\\$]/g, '\\$&'), params, columnType, columnTypeName, typeAdapter, forceTypeCast)
        }
        // Value source: escape the backslash first (doubled for the MySQL string literal), then
        // the dollar, so the backslash added for `$` is not doubled again.
        let sql = this._appendValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
        sql = "replace(" + sql + ", '\\\\', '\\\\\\\\')"
        sql = "replace(" + sql + ", '$', '\\\\$')"
        return sql
    }
    override _appendAggragateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayDistinct: boolean, params: any[], _query: SelectData | undefined): string {
        const distict = aggregatedArrayDistinct ? 'distinct ' : ''
        if (isValueSource(aggregatedArrayColumns)) {
            if (__isUuidValueSource(__getValueSourcePrivate(aggregatedArrayColumns)) && this._getUuidStrategy() === 'binary') {
                return 'json_arrayagg(' + distict + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, 'bin_to_uuid(' + this._appendSql(aggregatedArrayColumns, params, false) + ')') + ')'
            }
            return 'json_arrayagg(' + distict + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, this._appendSql(aggregatedArrayColumns, params, false)) + ')'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', "
                const column = columns[prop]!
                if (__isUuidValueSource(__getValueSourcePrivate(column)) && this._getUuidStrategy() === 'binary') {
                    result += this._appendAggregatedArrayValueProjection(column, 'bin_to_uuid(' + this._appendSql(column, params, false) + ')')
                } else {
                    result += this._appendAggregatedArrayValueProjection(column, this._appendSql(column, params, false))
                }
            }

            return 'json_arrayagg(' +  distict + 'json_object(' + result + '))'
        }
    }
    override _appendAggragateArrayWrappedColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, _params: any[], aggregateId: number): string {
        if (isValueSource(aggregatedArrayColumns)) {
            if (__isUuidValueSource(__getValueSourcePrivate(aggregatedArrayColumns)) && this._getUuidStrategy() === 'binary') {
                return 'json_arrayagg(' + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, 'bin_to_uuid(a_' + aggregateId + '_.result)') + ')'
            }
            return 'json_arrayagg(' + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, 'a_' + aggregateId + '_.result') + ')'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', "
                const column = columns[prop]!
                if (__isUuidValueSource(__getValueSourcePrivate(column)) && this._getUuidStrategy() === 'binary') {
                    result += this._appendAggregatedArrayValueProjection(column, 'bin_to_uuid(a_' + aggregateId + '_.' + this._escape(prop, true) + ')')
                } else {
                    result += this._appendAggregatedArrayValueProjection(column, 'a_' + aggregateId + '_.' + this._escape(prop, true))
                }
            }

            return 'json_arrayagg(json_object(' + result + '))'
        }
    }

    override _buildWith(withData: WithQueryData, params: any[]): string {
        if (this._connectionConfiguration.compatibilityVersion < 8_000_000) {
            // No with should be generated
            return ''
        }
        return super._buildWith(withData, params)
    }
    override _appendTableOrViewNameForFrom(table: AnyTableOrView, params: any[]): string {
        if (this._connectionConfiguration.compatibilityVersion < 8_000_000) {
            // The with clause must be expanded inline when it is required
            if (hasWithData(table)) {
                if (table.__type === 'with') {
                    if (table.__recursive) {
                        throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, 'Recursive queries are not supported in MySql compatibility mode')
                    }
                    return '(' + this._buildSelect(table.__selectData, params) + ')'
                } else {
                    throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, 'Values are not supported in MySql compatibility mode')
                }
            }
        }
        return super._appendTableOrViewNameForFrom(table, params)
    }
    override _appendTableOrViewNoAliasForFrom(table: AnyTableOrView, params: any[]): string {
        if (this._connectionConfiguration.compatibilityVersion < 8_000_000) {
            // The with name must be used as alias
            if (hasWithData(table)) {
                return table.__name
            }
        }

        return super._appendTableOrViewNoAliasForFrom(table, params)
    }
    override _needsSelectOrderByWrap(query: SelectData, params: any[]): boolean {
        // A column of the select the query is grouped by, whose SQL carries parameters, is in the group by as its
        // position in the select. Written again inside an expression of the order by, it gets new parameters, and
        // MySQL doesn't take it as the grouped column (not in GROUP BY); written as its alias, MySQL takes a column of
        // the from with the same name before it. Over a query that wraps the select, the alias is the only column with
        // that name
        if (super._needsSelectOrderByWrap(query, params)) {
            return true
        }
        if (query.__type !== 'plain') {
            return false
        }
        const orderBy = query.__orderBy
        if (!orderBy) {
            return false
        }
        const customization = query.__customization
        if (customization && (customization.beforeOrderByItems || customization.afterOrderByItems)) {
            // A raw fragment can refer to the columns of the tables, which aren't visible over the wrapping query
            return false
        }
        const groupByColumnNames = query.__groupByColumnNames
        if (!groupByColumnNames) {
            return false
        }
        let result = false
        for (let i = 0, length = orderBy.length; i < length; i++) {
            const entry = orderBy[i]!
            const expression = entry.expression
            if (typeof expression !== 'string') {
                // An expression can refer to the columns of the tables, which aren't visible over the wrapping query
                return false
            }
            if (!this._isOrderByColumnInExpression(entry, query)) {
                continue
            }
            const selectColumn = this._getOrderBySelectColumnWithParams(entry, query, params)
            if (selectColumn && groupByColumnNames.has(getQueryColumn(query.__columns, expression)!)) {
                result = true
            }
        }
        return result
    }
    override _setSafeTableOrView(params: any[], tableOrView: AnyTableOrView | undefined): void {
        if (this._connectionConfiguration.compatibilityVersion < 8_000_000) {
            // The inline query alias (from the with) always requires explicit name
            if (hasWithData(tableOrView)) {
                super._setSafeTableOrView(params, undefined)
                return
            }
        }
        super._setSafeTableOrView(params, tableOrView)
    }
}
