import type { ToSql, SelectData, InsertData } from "./SqlBuilder"
import type { TypeAdapter } from "../TypeAdapter"
import type { OrderByMode } from "../expressions/select"
import { isValueSource, ValueSource } from "../expressions/values"
import { AbstractSqlBuilder } from "./AbstractSqlBuilder"
import { __getValueSourcePrivate } from "../expressions/values"
import { Column, isColumn } from "../utils/Column"
import { SqliteDateTimeFormat, SqliteDateTimeFormatType } from "../connections/SqliteConfiguration"

export class SqliteSqlBuilder extends AbstractSqlBuilder {
    sqlite: true = true
    _getDateTimeFormat(type: SqliteDateTimeFormatType): SqliteDateTimeFormat {
        return this._connectionConfiguration.getDateTimeFormat!(type) as any
    }
    _getValueSourceDateTimeFormat(valueSource: ToSql): SqliteDateTimeFormat {
        if (isValueSource(valueSource)) {
            const type = __getValueSourcePrivate(valueSource).__valueType
            switch(type) {
                case 'localDate':
                    return this._getDateTimeFormat('date')
                case 'localTime':
                    return this._getDateTimeFormat('time')
                case 'localDateTime':
                    return this._getDateTimeFormat('dateTime')
                default:
                    throw new Error('Unknown date type type: ' + type)
            }
        }
        throw new Error('Unable to determine the value source type')
    }
    _isReservedKeyword(word: string): boolean {
        return word.toUpperCase() in reservedWords
    }
    _buildSelectWithColumnsInfoForCompound(query: SelectData, params: any[], columnsForInsert: { [name: string]: Column | undefined }): string {
        const result = this._buildSelectWithColumnsInfo(query, params, columnsForInsert)
        if (query.__limit !== undefined || query.__offset !== undefined || query.__orderBy !== undefined) {
            return 'select * from (' + result + ')'
        }
        return result
    }
    _buildSelectOrderBy(query: SelectData, _params: any[]): string {
        const orderBy = query.__orderBy
        if (!orderBy) {
            return ''
        }
        const columns = query.__columns
        let orderByColumns = ''
        for (const property in orderBy) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const column = columns[property]
            if (!column) {
                throw new Error('Column ' + property + ' included in the order by not found in the select clause')
            }
            const order = orderBy[property]
            if (!order) {
                orderByColumns += this._escape(property, true)
            } else switch (order as OrderByMode) {
                case 'asc':
                case 'asc nulls first':
                    orderByColumns += this._escape(property, true) + ' asc'
                    break
                case 'desc':
                case 'desc nulls last':
                    orderByColumns += this._escape(property, true) + ' desc'
                    break
                case 'asc nulls last':
                    orderByColumns += this._escape(property, true) + ' is null, ' + this._escape(property, true) + ' asc'
                    break
                case 'desc nulls first':
                    orderByColumns += this._escape(property, true) + ' is not null, ' + this._escape(property, true) + ' desc'
                    break
                case 'insensitive':
                    orderByColumns += this._escapeInsensitive(property, column)
                    break
                case 'asc insensitive':
                case 'asc nulls first insensitive':
                    orderByColumns += this._escapeInsensitive(property, column) + ' asc'
                    break
                case 'desc insensitive':
                case 'desc nulls last insensitive':
                    orderByColumns += this._escapeInsensitive(property, column) + ' desc'
                    break
                case 'asc nulls last insensitive':
                    orderByColumns += this._escape(property, true) + ' is null, ' + this._escapeInsensitive(property, column) + ' asc'
                    break
                case 'desc nulls first insensitive':
                    orderByColumns += this._escape(property, true) + ' is not null, ' + this._escapeInsensitive(property, column) + ' desc'
                    break
                default:
                    throw new Error('Invalid order by: ' + property + ' ' + order)
            }
        }

        if (!orderByColumns) {
            return ''
        }
        return ' order by ' + orderByColumns
    }
    _escapeInsensitive(identifier: string, column: ValueSource<any, any>) {
        const collation = this._connectionConfiguration.insesitiveCollation
        const columnType = __getValueSourcePrivate(column).__valueType
        if (columnType != 'string') {
            // Ignore the insensitive term, it do nothing
            return this._escape(identifier, true)
        } else if (collation) {
            return this._escape(identifier, true) + ' collate ' + collation
        } else if (collation === '') {
            return this._escape(identifier, true)
        } else {
            return 'lower(' + this._escape(identifier, true) + ')'
        }
    } 
    _buildSelectLimitOffset(query: SelectData, params: any[]): string {
        let result = ''

        const limit = query.__limit
        if (limit !== null && limit !== undefined) {
            result += ' limit ' + this._appendValue(limit, params, 'int', undefined)
        }

        const offset = query.__offset
        if (offset !== null && offset !== undefined) {
            result += ' offset ' + this._appendValue(offset, params, 'int', undefined)
        }
        return result
    }
    _trueValue = '1'
    _falseValue = '0'
    _trueValueForCondition = '1'
    _falseValueForCondition = '0'
    _buildInsertOutput(_query: InsertData, _params: any[]): string {
        return ''
    }
    _buildInsertReturning(_query: InsertData, params: any[]): string {
        this._setContainsInsertReturningClause(params, false)
        return ''
    }
    _is(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' is ' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params) + ' is ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _isNot(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' is not ' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params) + ' is not ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    /*
        switch (this._getDateTimeFormat()) {
            case 'localdate as text':
            case 'localdate as text using T separator':
            case 'UTC as text':
            case 'UTC as text using T separator':
            case 'UTC as text using Z timezone':
            case 'UTC as text using T separator and Z timezone':
            case 'Julian day as real number (day start at noon)':
            case 'Unix time seconds as integer':
            default:
                throw new Error('Invalid sqlite date time format: ' + this._getDateTimeFormat())
        }
        */
    _currentDate(_params: any): string {
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
                return "cast(strftime('%s', date('now')) as integer)"
            default:
                throw new Error('Invalid sqlite date time format: ' + dateTimeFormat)
        }
    }
    _currentTime(_params: any): string {
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
                return "(julianday('2000-01-01 ' || time('now')) - julianday('2000-01-01'))"
            case 'Unix time seconds as integer':
                return "cast(strftime('%s', '1970-01-01 ' || time('now')) as integer)"
            default:
                throw new Error('Invalid sqlite date time format: ' + dateTimeFormat)
        }
    }
    _currentTimestamp(_params: any): string {
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
                return "cast(strftime('%s', 'now') as integer)"
            default:
                throw new Error('Invalid sqlite date time format: ' + dateTimeFormat)
        }
    }
    _valueWhenNull(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'ifnull(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _divide(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'cast(' + this._appendSql(valueSource, params) + ' as real) / cast(' + this._appendValue(value, params, columnType, typeAdapter) + ' as real)'
    }
    _asDouble(params: any[], valueSource: ToSql): string {
        return 'cast(' + this._appendSql(valueSource, params) + 'as real)'
    }
    _ln(params: any[], valueSource: ToSql): string {
        return 'log(' + this._appendSql(valueSource, params) + ')'
    }
    _log10(params: any[], valueSource: ToSql): string {
        return 'log10(' + this._appendSql(valueSource, params) + ')'
    }
    _cbrt(params: any[], valueSource: ToSql): string {
        return 'power(' + this._appendSql(valueSource, params) + ', 3)'
    }
    _minValue(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'min(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _maxValue(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'max(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _getDate(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return "cast(strftime('%d', " + this._appendSql(valueSource, params) + ", 'unixepoch') as integer)"
        }
        return "cast(strftime('%d', " + this._appendSql(valueSource, params) + ") as integer)"
    }
    _getTime(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return "round((julianday(" + this._appendSql(valueSource, params) + ", 'unixepoch') - 2440587.5) * 86400000.0)"
        }
        return "round((julianday(" + this._appendSql(valueSource, params) + ") - 2440587.5) * 86400000.0)"
    }
    _getFullYear(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return "cast(strftime('%Y', " + this._appendSql(valueSource, params) + ", 'unixepoch') as integer)"
        }
        return "cast(strftime('%Y', " + this._appendSql(valueSource, params) + ") as integer)"
    }
    _getMonth(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return "cast(strftime('%m', " + this._appendSql(valueSource, params) + ", 'unixepoch') as integer)"
        }
        return "cast(strftime('%m', " + this._appendSql(valueSource, params) + ") as integer)"
    }
    _getDay(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return "cast(strftime('%w'," + this._appendSql(valueSource, params) + ", 'unixepoch') as integer)"
        }
        return "cast(strftime('%w'," + this._appendSql(valueSource, params) + ") as integer)"
    }
    _getHours(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return "cast(strftime('%H', " + this._appendSql(valueSource, params) + ", 'unixepoch') as integer)"
        }
        return "cast(strftime('%H', " + this._appendSql(valueSource, params) + ") as integer)"
    }
    _getMinutes(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return "cast(strftime('%M', " + this._appendSql(valueSource, params) + ", 'unixepoch') as integer)"
        }
        return "cast(strftime('%M', " + this._appendSql(valueSource, params) + ") as integer)"
    }
    _getSeconds(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return "cast(strftime('%S', " + this._appendSql(valueSource, params) + ", 'unixepoch') as integer)"
        }
        return "cast(strftime('%S', " + this._appendSql(valueSource, params) + ") as integer)"
    }
    _getMilliseconds(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return "(strftime('%f', " + this._appendSql(valueSource, params) + ", 'unixepoch') * 1000 % 1000)"
        }
        return "(strftime('%f', " + this._appendSql(valueSource, params) + ") * 1000 % 1000)"
    }
    _like(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' like ' + this._appendValue(value, params, columnType, typeAdapter) + " escape '\\'"
    }
    _notLike(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not like ' + this._appendValue(value, params, columnType, typeAdapter) + " escape '\\'"
    }
    _likeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' like (' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' collate ' + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' like ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + " escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') like lower(' + this._appendValue(value, params, columnType, typeAdapter) + ") escape '\\'"
        }
    }
    _notLikeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' not like (' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' collate ' + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' not like ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + " escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') not like lower(' + this._appendValue(value, params, columnType, typeAdapter) + ") escape '\\'"
        }
    }
    _startsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _notStartsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _endsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
    }
    _notEndsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
    }
    _startsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' like ((' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') collate " + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') like lower(' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
        }
    }
    _notStartsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' not like ((' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') collate " + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' not like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') not like lower(' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
        }
    }
    _endsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " like (('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") collate " + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
        }
    }
    _notEndsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " not like (('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") collate " + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") not like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ") escape '\\'"
        }
    }
    _contains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _notContains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
    }
    _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " like (('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') collate " + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
        }
    }
    _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " not like (('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') collate " + collation + ") escape '\\'"
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") not like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') escape '\\'"
        }
    }
    _stringConcat(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'group_concat(' + this._appendSql(value, params) + ')'
        } else if (separator === '') {
            return 'group_concat(' + this._appendSql(value, params) + ", '')"
        } else {
            return 'group_concat(' + this._appendSql(value, params) + ', ' + this._appendValue(separator, params, 'string', undefined) + ')'
        }
    }
    _stringConcatDistinct(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'group_concat(distinct ' + this._appendSql(value, params) + ')'
        } else if (separator === '') {
            return 'group_concat(distinct ' + this._appendSql(value, params) + ", '')"
        } else {
            return 'group_concat(distinct ' + this._appendSql(value, params) + ', ' + this._appendValue(separator, params, 'string', undefined) + ')'
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