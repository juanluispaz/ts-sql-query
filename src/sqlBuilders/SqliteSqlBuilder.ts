import type { ToSql, SelectData, InsertData, UpdateData, FlatQueryColumns } from './SqlBuilder.js'
import { flattenQueryColumns } from './SqlBuilder.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import type { AnyValueSource, __AggregatedArrayColumns, ValueType } from '../expressions/values.js'
import { isValueSource, __isUuidValueSource, __isLocalDateValueSource, __isLocalTimeValueSource, __isLocalDateTimeValueSource, __isUuidValueType } from '../expressions/values.js'
import { AbstractSqlBuilder } from './AbstractSqlBuilder.js'
import { __getValueSourcePrivate } from '../expressions/values.js'
import type { DBColumn } from '../utils/Column.js'
import { isColumn } from '../utils/Column.js'
import type { SqliteDateTimeFormat, SqliteDateTimeFormatType } from '../connections/SqliteConfiguration.js'
import type { AnyTableOrView } from '../utils/ITableOrView.js'
import { TsSqlProcessingError } from '../TsSqlError.js'

export class SqliteSqlBuilder extends AbstractSqlBuilder {
    sqlite: true = true
    constructor() {
        super()
        this._operationsThatNeedParenthesis._getMonth = true
        this._operationsThatNeedParenthesis._getMilliseconds = true
    }
    _getDateTimeFormat(type: SqliteDateTimeFormatType): SqliteDateTimeFormat {
        return this._connectionConfiguration.getDateTimeFormat!(type) as any
    }
    _getUuidStrategy(): 'string' | 'uuid-extension' {
        return this._connectionConfiguration.uuidStrategy as any || 'uuid-extension'
    }
    _unixEpochSeconds(timeValue: string): string {
        // unixepoch() was added in SQLite 3.38; falls back to strftime('%s', ...) on older versions
        if (this._connectionConfiguration.compatibilityVersion >= 3_038) {
            return 'unixepoch(' + timeValue + ')'
        }
        return "cast(strftime('%s', " + timeValue + ') as integer)'
    }
    _unixEpochMilliseconds(timeValue: string): string {
        // The 'subsec' modifier on unixepoch() was added in SQLite 3.42; older versions
        // need to go through julianday() arithmetic to preserve sub-second precision
        if (this._connectionConfiguration.compatibilityVersion >= 3_042) {
            return 'cast(unixepoch(' + timeValue + ", 'subsec') * 1000 as integer)"
        }
        return 'cast((julianday(' + timeValue + ') - 2440587.5) * 86400000.0 as integer)'
    }
    _getValueSourceDateTimeFormat(valueSource: ToSql): SqliteDateTimeFormat {
        if (isValueSource(valueSource)) {
            const valueSourcePrivate = __getValueSourcePrivate(valueSource)
            if (__isLocalDateValueSource(valueSourcePrivate)) {
                return this._getDateTimeFormat('date')
            } else if (__isLocalTimeValueSource(valueSourcePrivate)) {
                return this._getDateTimeFormat('time')
            } else if (__isLocalDateTimeValueSource(valueSourcePrivate)) {
                return this._getDateTimeFormat('dateTime')
            } else {
                throw new TsSqlProcessingError({ reason: 'UNKNOWN_DATA_TYPE', typeName: valueSourcePrivate.__valueTypeName }, 'Unknown date type: ' + valueSourcePrivate.__valueType + ' ' + valueSourcePrivate.__valueTypeName)
            }
        }
        throw new TsSqlProcessingError({ reason: 'UNKNOWN_DATA_TYPE' }, 'Unable to determine the value source type')
    }
    override _isReservedKeyword(word: string): boolean {
        return word.toUpperCase() in reservedWords
    }
    override _buildSelectWithColumnsInfoForCompound(query: SelectData, params: any[], columnsForInsert: { [name: string]: DBColumn | undefined }, isOutermostQuery: boolean): string {
        const result = this._buildSelectWithColumnsInfo(query, params, columnsForInsert, isOutermostQuery)
        if (query.__limit !== undefined || query.__offset !== undefined || query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems) {
            return 'select * from (' + result + ')'
        }
        return result
    }
    override _buildSelectOrderBy(query: SelectData, params: any[]): string {
        if (this._connectionConfiguration.compatibilityVersion >= 3_030) {
            return super._buildSelectOrderBy(query, params)
        }
        const orderBy = query.__orderBy
        if (!orderBy) {
            let orderByColumns = ''

            const customization = query.__customization
            if (customization && customization.beforeOrderByItems) {
                orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, params)
            }

            if (customization && customization.afterOrderByItems) {
                if (orderByColumns) {
                    orderByColumns += ', '
                }
                orderByColumns += this._appendRawFragment(customization.afterOrderByItems, params)
            }

            if (!orderByColumns) {
                return ''
            }
            return ' order by ' + orderByColumns
        }

        let orderByColumns = ''

        const customization = query.__customization
        if (customization && customization.beforeOrderByItems) {
            orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, params)
        }

        for (const entry of orderBy) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const order = entry.order
            if (!order) {
                orderByColumns += this._appendOrderByColumnAlias(entry, query, params)
            } else switch (order) {
                case 'asc':
                case 'asc nulls first':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, params) + ' asc'
                    break
                case 'desc':
                case 'desc nulls last':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, params) + ' desc'
                    break
                case 'asc nulls last':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, params) + ' is null, ' + this._appendOrderByColumnAlias(entry, query, params) + ' asc'
                    break
                case 'desc nulls first':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, params) + ' is not null, ' + this._appendOrderByColumnAlias(entry, query, params) + ' desc'
                    break
                case 'insensitive':
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, params)
                    break
                case 'asc insensitive':
                case 'asc nulls first insensitive':
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, params) + ' asc'
                    break
                case 'desc insensitive':
                case 'desc nulls last insensitive':
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, params) + ' desc'
                    break
                case 'asc nulls last insensitive':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, params) + ' is null, ' + this._appendOrderByColumnAliasInsensitive(entry, query, params) + ' asc'
                    break
                case 'desc nulls first insensitive':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, params) + ' is not null, ' + this._appendOrderByColumnAliasInsensitive(entry, query, params) + ' desc'
                    break
                default:
                    throw new TsSqlProcessingError({ reason: 'INVALID_ORDER_BY_ORDERING', column: this._appendOrderByColumnAlias(entry, query, params), ordering: order }, 'Invalid order by: ' + order)
            }
        }

        if (customization && customization.afterOrderByItems) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            orderByColumns += this._appendRawFragment(customization.afterOrderByItems, params)
        }

        if (!orderByColumns) {
            return ''
        }
        return ' order by ' + orderByColumns
    }
    override _buildSelectLimitOffset(query: SelectData, params: any[]): string {
        let result = ''

        const limit = query.__limit
        if (limit !== null && limit !== undefined) {
            result += ' limit ' + this._appendValue(limit, params, 'int', 'int', undefined, false)
        }

        const offset = query.__offset
        if (offset !== null && offset !== undefined) {
            if (!result) {
                // Sqlite doesn't support an offset without a limit, let put the the max value of an int
                result += ' limit 2147483647'
            }
            result += ' offset ' + this._appendValue(offset, params, 'int', 'int', undefined, false)
        }
        return result
    }
    override _trueValue = '1'
    override _falseValue = '0'
    override _trueValueForCondition = '1'
    override _falseValueForCondition = '0'
    override _appendUpdateOldValueForUpdate(_query: UpdateData, _updatePrimaryKey: boolean, _requiredTables: Set<AnyTableOrView> | undefined, _params: any[]) {
        return ''
    }
    override _buildInsertOutput(_query: InsertData, _params: any[]): string {
        return ''
    }
    override _buildInsertReturning(query: InsertData, params: any[]): string {
        if (this._connectionConfiguration.compatibilityVersion >= 3_035 || query.__from || query.__multiple || query.__columns || query.__onConflictUpdateSets) {
            return super._buildInsertReturning(query, params)
        }
        this._setContainsInsertReturningClause(params, false)
        return ''
    }
    override _is(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' is ' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params, false) + ' is ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
    }
    override _isNot(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' is not ' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params, false) + ' is not ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
    }
    override _currentDate(_params: any): string {
        const dateTimeFormat = this._getDateTimeFormat('date')
        switch (dateTimeFormat) {
            case 'localdate as text':
            case 'localdate as text using T separator':
                return "date('now', 'localtime')"
            case 'UTC as text':
            case 'UTC as text using T separator':
            case 'UTC as text using Z timezone':
            case 'UTC as text using T separator and Z timezone':
                return "date('now')"
            case 'Julian day as real number':
                return "julianday(date('now'))"
            case 'Unix time seconds as integer':
                return this._unixEpochSeconds("date('now')")
            case 'Unix time milliseconds as integer':
                // The date has no sub-second component, so seconds * 1000 is exact
                return '(' + this._unixEpochSeconds("date('now')") + ' * 1000)'
            default:
                throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dataTimeFormat', value: dateTimeFormat }, 'Invalid sqlite date time format: ' + dateTimeFormat)
        }
    }
    override _currentTime(_params: any): string {
        const dateTimeFormat = this._getDateTimeFormat('time')
        switch (dateTimeFormat) {
            case 'localdate as text':
            case 'localdate as text using T separator':
                return "time('now', 'localtime')"
            case 'UTC as text':
            case 'UTC as text using T separator':
                return "time('now')"
            case 'UTC as text using Z timezone':
            case 'UTC as text using T separator and Z timezone':
                return "(time('now') || 'Z')"
            case 'Julian day as real number':
                return "(julianday(strftime('1970-01-01 %H:%M:%f', 'now')) - julianday('1970-01-01'))"
            case 'Unix time seconds as integer':
                return this._unixEpochSeconds("strftime('1970-01-01 %H:%M:%S', 'now')")
            case 'Unix time milliseconds as integer':
                return this._unixEpochMilliseconds("strftime('1970-01-01 %H:%M:%f', 'now')")
            default:
                throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dataTimeFormat', value: dateTimeFormat }, 'Invalid sqlite date time format: ' + dateTimeFormat)
        }
    }
    override _currentTimestamp(_params: any): string {
        const dateTimeFormat = this._getDateTimeFormat('dateTime')
        switch (dateTimeFormat) {
            case 'localdate as text':
                return "datetime('now', 'localtime')"
            case 'localdate as text using T separator':
                return "strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')"
            case 'UTC as text':
                return "datetime('now')"
            case 'UTC as text using T separator':
                return "strftime('%Y-%m-%dT%H:%M:%S', 'now')"
            case 'UTC as text using Z timezone':
                return "strftime('%Y-%m-%d %H:%M:%SZ', 'now')"
            case 'UTC as text using T separator and Z timezone':
                return "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')"
            case 'Julian day as real number':
                return "julianday('now')"
            case 'Unix time seconds as integer':
                return this._unixEpochSeconds("'now'")
            case 'Unix time milliseconds as integer':
                return this._unixEpochMilliseconds("'now'")
            default:
                throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dataTimeFormat', value: dateTimeFormat }, 'Invalid sqlite date time format: ' + dateTimeFormat)
        }
    }
    override _valueWhenNull(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'ifnull(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
    }
    override _divide(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'cast(' + this._appendSql(valueSource, params, false) + ' as real) / cast(' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false) + ' as real)'
    }
    override _asDouble(params: any[], valueSource: ToSql): string {
        return 'cast(' + this._appendSql(valueSource, params, false) + 'as real)'
    }
    override _ln(params: any[], valueSource: ToSql): string {
        return 'log(' + this._appendSql(valueSource, params, false) + ')'
    }
    override _log10(params: any[], valueSource: ToSql): string {
        return 'log10(' + this._appendSql(valueSource, params, false) + ')'
    }
    override _cbrt(params: any[], valueSource: ToSql): string {
        return 'power(' + this._appendSql(valueSource, params, false) + ', 3)'
    }
    override _minimumBetweenTwoValues(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'min(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false) + ')'
    }
    override _maximumBetweenTwoValues(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'max(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false) + ')'
    }
    override _getDate(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return "cast(strftime('%d', " + this._appendSql(valueSource, params, false) + ", 'unixepoch') as integer)"
        } else if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time milliseconds as integer') {
            return "cast(strftime('%d', " + this._appendSqlParenthesis(valueSource, params, false) + " / 1000, 'unixepoch') as integer)"
        }
        return "cast(strftime('%d', " + this._appendSql(valueSource, params, false) + ") as integer)"
    }
    override _getTime(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return '(' + this._appendSql(valueSource, params, false) + ' * 1000)'
        } else if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time milliseconds as integer') {
            return this._appendSql(valueSource, params, false)
        }
        const v = this._appendSql(valueSource, params, false)
        // The 'subsec' modifier on unixepoch() was added in SQLite 3.42; older versions
        // need to go through julianday() arithmetic to preserve sub-second precision
        if (this._connectionConfiguration.compatibilityVersion >= 3_042) {
            return 'round(unixepoch(' + v + ", 'subsec') * 1000)"
        }
        return 'round((julianday(' + v + ') - 2440587.5) * 86400000.0)'
    }
    override _getFullYear(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return "cast(strftime('%Y', " + this._appendSql(valueSource, params, false) + ", 'unixepoch') as integer)"
        } else if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time milliseconds as integer') {
            return "cast(strftime('%Y', " + this._appendSqlParenthesis(valueSource, params, false) + " / 1000, 'unixepoch') as integer)"
        }
        return "cast(strftime('%Y', " + this._appendSql(valueSource, params, false) + ") as integer)"
    }
    override _getMonth(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return "cast(strftime('%m', " + this._appendSql(valueSource, params, false) + ", 'unixepoch') as integer) - 1"
        } else if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time milliseconds as integer') {
            return "cast(strftime('%m', " + this._appendSqlParenthesis(valueSource, params, false) + " / 1000, 'unixepoch') as integer) - 1"
        }
        return "cast(strftime('%m', " + this._appendSql(valueSource, params, false) + ") as integer) - 1"
    }
    override _getDay(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return "cast(strftime('%w'," + this._appendSql(valueSource, params, false) + ", 'unixepoch') as integer)"
        } else if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time milliseconds as integer') {
            return "cast(strftime('%w'," + this._appendSqlParenthesis(valueSource, params, false) + " / 1000, 'unixepoch') as integer)"
        }
        return "cast(strftime('%w'," + this._appendSql(valueSource, params, false) + ") as integer)"
    }
    override _getHours(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return "cast(strftime('%H', " + this._appendSql(valueSource, params, false) + ", 'unixepoch') as integer)"
        } else if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time milliseconds as integer') {
            return "cast(strftime('%H', " + this._appendSqlParenthesis(valueSource, params, false) + " / 1000, 'unixepoch') as integer)"
        }
        return "cast(strftime('%H', " + this._appendSql(valueSource, params, false) + ") as integer)"
    }
    override _getMinutes(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return "cast(strftime('%M', " + this._appendSql(valueSource, params, false) + ", 'unixepoch') as integer)"
        } else if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time milliseconds as integer') {
            return "cast(strftime('%M', " + this._appendSqlParenthesis(valueSource, params, false) + " / 1000, 'unixepoch') as integer)"
        }
        return "cast(strftime('%M', " + this._appendSql(valueSource, params, false) + ") as integer)"
    }
    override _getSeconds(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return "cast(strftime('%S', " + this._appendSql(valueSource, params, false) + ", 'unixepoch') as integer)"
        } else if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time milliseconds as integer') {
            return "cast(strftime('%S', " + this._appendSqlParenthesis(valueSource, params, false) + " / 1000, 'unixepoch') as integer)"
        }
        return "cast(strftime('%S', " + this._appendSql(valueSource, params, false) + ") as integer)"
    }
    override _getMilliseconds(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return '0'
        } else if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time milliseconds as integer') {
            return this._appendSqlParenthesis(valueSource, params, false) + ' % 1000'
        }
        return "strftime('%f', " + this._appendSql(valueSource, params, false) + ") * 1000 % 1000"
    }
    override _like(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' like ' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + " escape '\\'"
    }
    override _notLike(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' not like ' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + " escape '\\'"
    }
    override _likeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' like (' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ' collate ' + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + ' like ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + " escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ') like lower(' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ") escape '\\'"
        }
    }
    override _notLikeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not like (' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ' collate ' + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not like ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + " escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ') not like lower(' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ") escape '\\'"
        }
    }
    override _startsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' like (' + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%') escape '\\'"
    }
    override _notStartsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' not like (' + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%') escape '\\'"
    }
    override _endsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ") escape '\\'"
    }
    override _notEndsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ") escape '\\'"
    }
    override _startsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' like ((' + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%') collate " + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + ' like (' + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%') escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ') like lower(' + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%') escape '\\'"
        }
    }
    override _notStartsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not like ((' + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%') collate " + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not like (' + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%') escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ') not like lower(' + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%') escape '\\'"
        }
    }
    override _endsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " like (('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ") collate " + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ") escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ") escape '\\'"
        }
    }
    override _notEndsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " not like (('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ") collate " + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ") escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ") not like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ") escape '\\'"
        }
    }
    override _contains(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%') escape '\\'"
    }
    override _notContains(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%') escape '\\'"
    }
    override _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " like (('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%') collate " + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%') escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%') escape '\\'"
        }
    }
    override _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " not like (('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%') collate " + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%') escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ") not like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + " || '%') escape '\\'"
        }
    }
    override _stringConcat(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'group_concat(' + this._appendSql(value, params, false) + ')'
        } else if (separator === '') {
            return 'group_concat(' + this._appendSql(value, params, false) + ", '')"
        } else {
            return 'group_concat(' + this._appendSql(value, params, false) + ', ' + this._appendValue(separator, params, 'string', 'string', undefined, false) + ')'
        }
    }
    override _stringConcatDistinct(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'group_concat(distinct ' + this._appendSql(value, params, false) + ')'
        } else if (separator === '') {
            return 'group_concat(distinct ' + this._appendSql(value, params, false) + ", '')"
        } else {
            return 'group_concat(distinct ' + this._appendSql(value, params, false) + ', ' + this._appendValue(separator, params, 'string', 'string', undefined, false) + ')'
        }
    }
    override _appendParam(value: any, params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (__isUuidValueType(columnType) && this._getUuidStrategy() === 'uuid-extension') {
            return 'uuid_blob(' + super._appendParam(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
        }
        return super._appendParam(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    override _appendColumnValue(value: AnyValueSource, params: any[], isOutermostQuery: boolean): string {
        if (isOutermostQuery && this._getUuidStrategy() === 'uuid-extension') {
            if (__isUuidValueSource(__getValueSourcePrivate(value))) {
                return 'uuid_str(' + this._appendSql(value, params, false) + ')'
            }
        }
        return this._appendSql(value, params, false)
    }
    override _asString(params: any[], valueSource: ToSql): string {
        // Transform an uuid to string
        if (this._getUuidStrategy() === 'string') {
            // No conversion required
            return this._appendSql(valueSource, params, false)
        }
        return 'uuid_str(' + this._appendSql(valueSource, params, false) + ')'
    }
    override _appendAggragateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayDistinct: boolean, params: any[], _query: SelectData | undefined): string {
        const distict = aggregatedArrayDistinct ? 'distinct ' : ''
        if (isValueSource(aggregatedArrayColumns)) {
            if (__isUuidValueSource(__getValueSourcePrivate(aggregatedArrayColumns)) && this._getUuidStrategy() === 'uuid-extension') {
                return 'json_group_array(' + distict + 'uuid_str(' + this._appendSql(aggregatedArrayColumns, params, false) + '))'
            }
            return 'json_group_array(' + distict + this._appendSql(aggregatedArrayColumns, params, false) + ')'
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
                if (__isUuidValueSource(__getValueSourcePrivate(column)) && this._getUuidStrategy() === 'uuid-extension') {
                    result += 'uuid_str(' + this._appendSql(column, params, false) + ')'
                } else {
                    result += this._appendSql(column, params, false)
                }
            }

            return 'json_group_array(' + distict + 'json_object(' + result + '))'
        }
    }
    override _appendAggragateArrayWrappedColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, _params: any[], aggregateId: number): string {
        if (isValueSource(aggregatedArrayColumns)) {
            if (__isUuidValueSource(__getValueSourcePrivate(aggregatedArrayColumns)) && this._getUuidStrategy() === 'uuid-extension') {
                return 'json_group_array(uuid_str(a_' + aggregateId + '_.result))'
            }
            return 'json_group_array(a_' + aggregateId + '_.result)'
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
                if (__isUuidValueSource(__getValueSourcePrivate(column)) && this._getUuidStrategy() === 'uuid-extension') {
                    result += 'uuid_str(a_' + aggregateId + '_.' + this._escape(prop, true) + ')'
                } else {
                    result += 'a_' + aggregateId + '_.' + this._escape(prop, true)
                }
            }

            return 'json_group_array(json_object(' + result + '))'
        }
    }
}

// Source: https://www.sqlite.org/lang_keywords.html (version: 3.30.1)
const reservedWords: { [word: string]: boolean | undefined } = {
    ABORT: true,
    ACTION: true,
    ADD: true,
    AFTER: true,
    ALL: true,
    ALTER: true,
    ANALYZE: true,
    AND: true,
    AS: true,
    ASC: true,
    ATTACH: true,
    AUTOINCREMENT: true,
    BEFORE: true,
    BEGIN: true,
    BETWEEN: true,
    BY: true,
    CASCADE: true,
    CASE: true,
    CAST: true,
    CHECK: true,
    COLLATE: true,
    COLUMN: true,
    COMMIT: true,
    CONFLICT: true,
    CONSTRAINT: true,
    CREATE: true,
    CROSS: true,
    CURRENT: true,
    CURRENT_DATE: true,
    CURRENT_TIME: true,
    CURRENT_TIMESTAMP: true,
    DATABASE: true,
    DEFAULT: true,
    DEFERRABLE: true,
    DEFERRED: true,
    DELETE: true,
    DESC: true,
    DETACH: true,
    DISTINCT: true,
    DO: true,
    DROP: true,
    EACH: true,
    ELSE: true,
    END: true,
    ESCAPE: true,
    EXCEPT: true,
    EXCLUDE: true,
    EXCLUSIVE: true,
    EXISTS: true,
    EXPLAIN: true,
    FAIL: true,
    FILTER: true,
    FIRST: true,
    FOLLOWING: true,
    FOR: true,
    FOREIGN: true,
    FROM: true,
    FULL: true,
    GLOB: true,
    GROUP: true,
    GROUPS: true,
    HAVING: true,
    IF: true,
    IGNORE: true,
    IMMEDIATE: true,
    IN: true,
    INDEX: true,
    INDEXED: true,
    INITIALLY: true,
    INNER: true,
    INSERT: true,
    INSTEAD: true,
    INTERSECT: true,
    INTO: true,
    IS: true,
    ISNULL: true,
    JOIN: true,
    KEY: true,
    LAST: true,
    LEFT: true,
    LIKE: true,
    LIMIT: true,
    MATCH: true,
    NATURAL: true,
    NO: true,
    NOT: true,
    NOTHING: true,
    NOTNULL: true,
    NULL: true,
    NULLS: true,
    OF: true,
    OFFSET: true,
    ON: true,
    OR: true,
    ORDER: true,
    OTHERS: true,
    OUTER: true,
    OVER: true,
    PARTITION: true,
    PLAN: true,
    PRAGMA: true,
    PRECEDING: true,
    PRIMARY: true,
    QUERY: true,
    RAISE: true,
    RANGE: true,
    RECURSIVE: true,
    REFERENCES: true,
    REGEXP: true,
    REINDEX: true,
    RELEASE: true,
    RENAME: true,
    REPLACE: true,
    RESTRICT: true,
    RIGHT: true,
    ROLLBACK: true,
    ROW: true,
    ROWS: true,
    SAVEPOINT: true,
    SELECT: true,
    SET: true,
    TABLE: true,
    TEMP: true,
    TEMPORARY: true,
    THEN: true,
    TIES: true,
    TO: true,
    TRANSACTION: true,
    TRIGGER: true,
    UNBOUNDED: true,
    UNION: true,
    UNIQUE: true,
    UPDATE: true,
    USING: true,
    VACUUM: true,
    VALUES: true,
    VIEW: true,
    VIRTUAL: true,
    WHEN: true,
    WHERE: true,
    WINDOW: true,
    WITH: true,
    WITHOUT: true
}