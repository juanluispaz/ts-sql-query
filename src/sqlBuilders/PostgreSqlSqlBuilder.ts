import type { ToSql, SelectData, WithValuesData } from "./SqlBuilder"
import type { TypeAdapter } from "../TypeAdapter"
import { AbstractSqlBuilder } from "./AbstractSqlBuilder"
import { __getColumnOfObject, __getColumnPrivate } from "../utils/Column"

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
    _asDouble(params: any[], valueSource: ToSql): string {
        return this._appendSqlParenthesis(valueSource, params) + '::float'
    }
    _asString(params: any[], valueSource: ToSql): string {
        // Transform an uuid to string
        return this._appendSqlParenthesis(valueSource, params) + '::text'
    }
    _divide(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + '::float / ' + this._appendValueParenthesis(value, params, this._getMathArgumentType(columnType, value), typeAdapter) + '::float'
    }
    _equalsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' collate "' + collation + '"'
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') = lower(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
    }
    _notEqualsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' <> ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' collate "' + collation + '"'
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' <> ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') <> lower(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
    }
    _likeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' ilike ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params) + ' ilike ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
        }
    }
    _notLikeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' not ilike ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params) + ' not ilike ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
        }
    }
    _startsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' ilike (' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params) + ' ilike (' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
        }
    }
    _notStartsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' not ilike (' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params) + ' not ilike (' +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
        }
    }
    _endsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " ilike ('%' || " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ') collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params) + " ilike ('%' || " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
        }
    }
    _notEndsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " not ilike ('%' || " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ') collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params) + " not ilike ('%' || " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
        }
    }
    _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " ilike ('%' || " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params) + " ilike ('%' || " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
        }
    }
    _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " not ilike ('%' || " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')" + ' collate "' + collation + '"'
        } else {
            return this._appendSqlParenthesis(valueSource, params) + " not ilike ('%' || " +  this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
        }
    }
    _in(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (Array.isArray(value) && value.length <= 0) {
            return this._falseValueForCondition
        }
        return super._in(params, valueSource, value, columnType, typeAdapter)
    }
    _notIn(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (Array.isArray(value) && value.length <= 0) {
            return this._trueValueForCondition
        }
        return super._notIn(params, valueSource, value, columnType, typeAdapter)
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