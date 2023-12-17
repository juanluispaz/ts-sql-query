import type { ToSql, SelectData, WithValuesData } from "./SqlBuilder"
import { CustomBooleanTypeAdapter, TypeAdapter } from "../TypeAdapter"
import { AbstractSqlBuilder } from "./AbstractSqlBuilder"
import { Column, isColumn, __getColumnOfObject, __getColumnPrivate } from "../utils/Column"
import { __isBooleanValueSource, isValueSource } from "../expressions/values"

export class PostgreSqlSqlBuilder extends AbstractSqlBuilder {
    postgreSql: true = true
    constructor() {
        super()
        this._operationsThatNeedParenthesis._getMonth = true
        this._operationsThatNeedParenthesis._getMilliseconds = true
    }
    _isReservedKeyword(word: string): boolean {
        return word.toUpperCase() in reservedWords
    }
    _appendColumnAlias(name: string, params: any[]): string {
        if (!this._isWithGeneratedFinished(params)) {
            // Avoid quote identifiers when the with clause is generated
            return this._escape(name, true)
        }
        if (this._isAggregateArrayWrapped(params)) {
            // Avoid quote identifiers when the aggregate array query wrapper is generated
            return this._escape(name, true)
        }
        if (name.toLocaleLowerCase() !== name) {
            // Avoid automatically lowercase identifiers by postgresql when it contains uppercase characters
            return this._forceAsIdentifier(name)
        }
        return this._escape(name, true)
    }
    _buildWithValues(withValues: WithValuesData, params: any[]) {
        let result = withValues.__name
        let columns = ''
        for (var columnName in withValues) {
            const column = __getColumnOfObject(withValues.__getTableOrView(), columnName)
            if (!column) {
                continue
            }
            if (columns) {
                columns += ', '
            }
            const columnPrivate = __getColumnPrivate(column)
            columns += this._appendColumnAlias(columnPrivate.__name, params)
        }
        result += '(' + columns + ')'
        result += ' as (values '

        const values = withValues.__values
        let valuesSql = ''
        for (let i = 0, length = values.length; i < length; i++) {
            if (valuesSql) {
                valuesSql += ', '
            }
            const value = values[i]!
            let valueSql = ''
            for (var columnName in withValues) {
                const column = __getColumnOfObject(withValues.__getTableOrView(), columnName)
                if (!column) {
                    continue
                }
                if (valueSql) {
                    valueSql += ', '
                }
                valueSql += this._appendValueForColumn(column, value[columnName], params, true)
            }
            valuesSql += '(' + valueSql + ')'
        }
        result += valuesSql
        result += ')'
        return result
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
    _appendCustomBooleanRemapForColumnIfRequired(column: Column, value: any, params: any[]): string | null {
        const columnPrivate = __getColumnPrivate(column)
        const columnTypeAdapter = columnPrivate.__typeAdapter
        const columnTypeName = columnPrivate.__valueTypeName

        if (!__isBooleanValueSource(columnPrivate)) {
            return null // non-boolean
        }

        if (columnTypeAdapter instanceof CustomBooleanTypeAdapter) {
            if (isColumn(value)) {
                const valuePrivate = __getColumnPrivate(value)
                const valueTypeAdapter = valuePrivate.__typeAdapter

                if (valueTypeAdapter instanceof CustomBooleanTypeAdapter) {
                    if (columnTypeAdapter.trueValue === valueTypeAdapter.trueValue && columnTypeAdapter.falseValue === valueTypeAdapter.falseValue) {
                        return this._appendRawColumnName(value, params) // same boolean as column
                    }

                    if (columnPrivate.__optionalType === 'required') {
                        // remapped
                        return 'case when ' + this._appendRawColumnName(value, params) + ' = ' + this._appendLiteralValue(valueTypeAdapter.trueValue, params) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' end'
                    } else {
                        // remapped
                        return 'case ' + this._appendRawColumnName(value, params) + ' when ' + this._appendLiteralValue(valueTypeAdapter.trueValue, params) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when ' + this._appendLiteralValue(valueTypeAdapter.falseValue, params) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
                    }
                } else {
                    if (columnPrivate.__optionalType === 'required') {
                        // remapped
                        return 'case when ' + this._appendConditionValue(value, params, columnTypeName, columnTypeAdapter) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' end'
                    } else {
                        // remapped
                        return 'case ' + this._appendConditionValue(value, params, columnTypeName, columnTypeAdapter) + ' when ' + this._trueValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when ' + this._falseValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
                    }
                }
            } else if (isValueSource(value)) {
                // There are some boolean expressions involved
                if (columnPrivate.__optionalType === 'required') {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, params, columnTypeName, columnTypeAdapter) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' end'
                } else {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, params, columnTypeName, columnTypeAdapter) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when not ' + this._appendConditionValue(value, params, columnTypeName, columnTypeAdapter) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
                }
            } else {
                if (columnPrivate.__optionalType === 'required') {
                    // remapped
                    return 'case when ' + this._appendConditionValue(value, params, columnTypeName, columnTypeAdapter, true) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' end'
                } else {
                    // remapped
                    return 'case ' + this._appendConditionValue(value, params, columnTypeName, columnTypeAdapter, true) + ' when ' + this._trueValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when ' + this._falseValue + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
                }
            }
        }

        // if value is column and its type adapter is CustomBooleanTypeAdapter append value will be required to normalize value
        // if not it is same boolean, nothing to transform here
        return null
    }
    _asDouble(params: any[], valueSource: ToSql): string {
        return this._appendSqlParenthesis(valueSource, params) + '::float'
    }
    _asString(params: any[], valueSource: ToSql): string {
        // Transform an uuid to string
        return this._appendSqlParenthesis(valueSource, params) + '::text'
    }
    _asNullValue(_params: any[], columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeAdapter && typeAdapter.transformPlaceholder) {
            return typeAdapter.transformPlaceholder('null', columnTypeName, true, null, this._defaultTypeAdapter)
        } else {
            return this._defaultTypeAdapter.transformPlaceholder('null', columnTypeName, true, null)
        }
    }
    _divide(params: any[], valueSource: ToSql, value: any, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + '::float / ' + this._appendValueParenthesis(value, params, this._getMathArgumentType(columnTypeName, value), typeAdapter) + '::float'
    }
    _equalsInsensitive(params: any[], valueSource: ToSql, value: any, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnTypeName, typeAdapter) + ' collate "' + collation + '"'
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnTypeName, typeAdapter)
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') = lower(' + this._appendValue(value, params, columnTypeName, typeAdapter) + ')'
        }
    }
    _notEqualsInsensitive(params: any[], valueSource: ToSql, value: any, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' <> ' + this._appendValueParenthesis(value, params, columnTypeName, typeAdapter) + ' collate "' + collation + '"'
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' <> ' + this._appendValueParenthesis(value, params, columnTypeName, typeAdapter)
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') <> lower(' + this._appendValue(value, params, columnTypeName, typeAdapter) + ')'
        }
    }
    _likeInsensitive(params: any[], valueSource: ToSql, value: any, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' ilike ' + this._appendValueParenthesis(value, params, columnTypeName, typeAdapter) + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params) + ' ilike ' + this._appendValueParenthesis(value, params, columnTypeName, typeAdapter)
        }
    }
    _notLikeInsensitive(params: any[], valueSource: ToSql, value: any, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' not ilike ' + this._appendValueParenthesis(value, params, columnTypeName, typeAdapter) + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params) + ' not ilike ' + this._appendValueParenthesis(value, params, columnTypeName, typeAdapter)
        }
    }
    _startsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' ilike (' +  this._escapeLikeWildcard(params, value, columnTypeName, typeAdapter) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params) + ' ilike (' +  this._escapeLikeWildcard(params, value, columnTypeName, typeAdapter) + " || '%')"
        }
    }
    _notStartsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' not ilike (' +  this._escapeLikeWildcard(params, value, columnTypeName, typeAdapter) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params) + ' not ilike (' +  this._escapeLikeWildcard(params, value, columnTypeName, typeAdapter) + " || '%')"
        }
    }
    _endsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " ilike ('%' || " +  this._escapeLikeWildcard(params, value, columnTypeName, typeAdapter) + ') collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params) + " ilike ('%' || " +  this._escapeLikeWildcard(params, value, columnTypeName, typeAdapter) + ')'
        }
    }
    _notEndsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " not ilike ('%' || " +  this._escapeLikeWildcard(params, value, columnTypeName, typeAdapter) + ') collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params) + " not ilike ('%' || " +  this._escapeLikeWildcard(params, value, columnTypeName, typeAdapter) + ')'
        }
    }
    _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " ilike ('%' || " +  this._escapeLikeWildcard(params, value, columnTypeName, typeAdapter) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params) + " ilike ('%' || " +  this._escapeLikeWildcard(params, value, columnTypeName, typeAdapter) + " || '%')"
        }
    }
    _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " not ilike ('%' || " +  this._escapeLikeWildcard(params, value, columnTypeName, typeAdapter) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params) + " not ilike ('%' || " +  this._escapeLikeWildcard(params, value, columnTypeName, typeAdapter) + " || '%')"
        }
    }
    _in(params: any[], valueSource: ToSql, value: any, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (Array.isArray(value) && value.length <= 0) {
            return this._falseValueForCondition
        }
        return super._in(params, valueSource, value, columnTypeName, typeAdapter)
    }
    _notIn(params: any[], valueSource: ToSql, value: any, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (Array.isArray(value) && value.length <= 0) {
            return this._trueValueForCondition
        }
        return super._notIn(params, valueSource, value, columnTypeName, typeAdapter)
    }
    _stringConcat(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'string_agg(' + this._appendSql(value, params) + ", ',')"
        } else if (separator === '') {
            return 'string_agg(' + this._appendSql(value, params) + ", '')"
        } else {
            return 'string_agg(' + this._appendSql(value, params) + ', ' + this._appendValue(separator, params, 'string', undefined) + ')'
        }
    }
    _stringConcatDistinct(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'string_agg(distinct ' + this._appendSql(value, params) + ", ',')"
        } else if (separator === '') {
            return 'string_agg(distinct ' + this._appendSql(value, params) + ", '')"
        } else {
            return 'string_agg(distinct ' + this._appendSql(value, params) + ', ' + this._appendValue(separator, params, 'string', undefined) + ')'
        }
    }
    _getTime(params: any[], valueSource: ToSql): string {
        return 'round(extract(epoch from ' + this._appendSql(valueSource, params) + ') * 1000)'
    }
    _getSeconds(params: any[], valueSource: ToSql): string {
        return 'extract(second from ' + this._appendSql(valueSource, params) + ')::integer'
    }
    _getMonth(params: any[], valueSource: ToSql): string {
        return 'extract(month from ' + this._appendSql(valueSource, params) + ') - 1'
    }
    _getMilliseconds(params: any[], valueSource: ToSql): string {
        return 'extract(millisecond from ' + this._appendSql(valueSource, params) + ')::integer % 1000'
    }
}

// Source: https://www.postgresql.org/docs/12/sql-keywords-appendix.html (version: 12, only the ones marked as reserved by postgreSql)
const reservedWords: { [word: string]: boolean | undefined } = {
    ALL: true,
    ANALYSE: true,
    ANALYZE: true,
    AND: true,
    ANY: true,
    ARRAY: true,
    AS: true,
    ASC: true,
    ASYMMETRIC: true,
    BOTH: true,
    CASE: true,
    CAST: true,
    CHECK: true,
    COLLATE: true,
    COLUMN: true,
    CONSTRAINT: true,
    CREATE: true,
    CURRENT_CATALOG: true,
    CURRENT_DATE: true,
    CURRENT_ROLE: true,
    CURRENT_TIME: true,
    CURRENT_TIMESTAMP: true,
    CURRENT_USER: true,
    DEFAULT: true,
    DEFERRABLE: true,
    DESC: true,
    DISTINCT: true,
    DO: true,
    ELSE: true,
    END: true,
    EXCEPT: true,
    FALSE: true,
    FETCH: true,
    FOR: true,
    FOREIGN: true,
    FROM: true,
    GRANT: true,
    GROUP: true,
    HAVING: true,
    IN: true,
    INITIALLY: true,
    INTERSECT: true,
    INTO: true,
    LATERAL: true,
    LEADING: true,
    LIMIT: true,
    LOCALTIME: true,
    LOCALTIMESTAMP: true,
    NOT: true,
    NULL: true,
    OFFSET: true,
    ON: true,
    ONLY: true,
    OR: true,
    ORDER: true,
    PLACING: true,
    PRIMARY: true,
    REFERENCES: true,
    RETURNING: true,
    SELECT: true,
    SESSION_USER: true,
    SOME: true,
    SYMMETRIC: true,
    TABLE: true,
    THEN: true,
    TO: true,
    TRAILING: true,
    TRUE: true,
    UNION: true,
    UNIQUE: true,
    USER: true,
    USING: true,
    VARIADIC: true,
    WHEN: true,
    WHERE: true,
    WINDOW: true,
    WITH: true,
    AUTHORIZATION: true,
    BINARY: true,
    COLLATION: true,
    CONCURRENTLY: true,
    CROSS: true,
    CURRENT_SCHEMA: true,
    FREEZE: true,
    FULL: true,
    ILIKE: true,
    INNER: true,
    IS: true,
    ISNULL: true,
    JOIN: true,
    LEFT: true,
    LIKE: true,
    NATURAL: true,
    NOTNULL: true,
    OUTER: true,
    OVERLAPS: true,
    RIGHT: true,
    SIMILAR: true,
    TABLESAMPLE: true,
    VERBOSE: true
}