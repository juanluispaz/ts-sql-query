import type { ToSql, SelectData, InsertData, UpdateData, FlatQueryColumns, OrderByEntry, PlainSelectData, CompoundSelectData } from './SqlBuilder.js'
import { flattenQueryColumns, getQueryColumn, hasToSql } from './SqlBuilder.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import type { AnyValueSource, __AggregatedArrayColumns, ValueType } from '../expressions/values.js'
import { isValueSource, __isUuidValueSource, __isLocalDateValueSource, __isLocalTimeValueSource, __isLocalDateTimeValueSource, __isUuidValueType } from '../expressions/values.js'
import { AbstractSqlBuilder, type SelectColumnSql } from './AbstractSqlBuilder.js'
import { __getValueSourcePrivate } from '../expressions/values.js'
import type { DBColumn } from '../utils/Column.js'
import { isColumn } from '../utils/Column.js'
import type { SqliteDateTimeFormat, SqliteDateTimeFormatType, SqliteDecimalStrategy } from '../connections/SqliteConfiguration.js'
import type { AnyTableOrView } from '../utils/ITableOrView.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { FragmentValueSource, InlineSelectValueSource, SqlOperationConstValueSource, TableOrViewRawFragmentValueSource } from '../internal/ValueSourceImpl.js'
import { __isDecimalCategory } from '../utils/typeCategory.js'
import { isSqliteReservedWord } from '../utils/sqlite/sqliteReservedWords.js'

/**
 * The canonical text of a decimal: no zeros before the integer part ('0' when it is zero), none at the end of the
 * fraction, and no minus sign for a zero (`007.50` is `7.5`, `-0.00` is `0`, `.5` is `0.5`). A text that isn't a plain
 * decimal is left as it is.
 */
export function canonicalDecimalText(text: string): string {
    const match = /^(-?)0*(\d*)(?:\.(\d*?)0*)?$/.exec(text)
    if (!match) {
        return text
    }
    const integer = match[2] || '0'
    const fraction = match[3] || ''
    if (integer === '0' && fraction === '') {
        return '0'
    }
    return match[1] + integer + (fraction ? '.' + fraction : '')
}

export class SqliteSqlBuilder extends AbstractSqlBuilder {
    sqlite: true = true
    constructor() {
        super()
    }
    _getDateTimeFormat(type: SqliteDateTimeFormatType): SqliteDateTimeFormat {
        return this._connectionConfiguration.getDateTimeFormat!(type) as any
    }
    _getUuidStrategy(): 'string' | 'uuid-extension' {
        return this._connectionConfiguration.uuidStrategy as any || 'uuid-extension'
    }
    /** How a customDecimal is computed and compared (`decimalStrategy`) */
    _getDecimalStrategy(): SqliteDecimalStrategy {
        return this._connectionConfiguration.decimalStrategy as SqliteDecimalStrategy | undefined || 'decimal-extension and tsq-functions with canonical text'
    }
    /** The strategy without its canonical text variant: 'text', 'decimal-functions' or 'decimal-extension and tsq-functions' */
    _getDecimalBaseStrategy(): 'text' | 'decimal-functions' | 'decimal-extension and tsq-functions' {
        const strategy = this._getDecimalStrategy()
        if (strategy === 'canonical text') {
            return 'text'
        }
        return strategy.replace(' with canonical text', '') as 'text' | 'decimal-functions' | 'decimal-extension and tsq-functions'
    }
    /**
     * A canonical text variant: the library writes every customDecimal in its canonical text (see canonicalDecimalText)
     * and takes the values stored as written so, which compare and group as their text
     */
    _isCanonicalDecimalText(): boolean {
        const strategy = this._getDecimalStrategy()
        return strategy === 'canonical text' || strategy.endsWith(' with canonical text')
    }
    /** The decimal extension's functions compute and compare (every strategy but 'text' and 'canonical text') */
    _usesDecimalExtensionFunctions(): boolean {
        return this._getDecimalBaseStrategy() !== 'text'
    }
    /** The functions of the library order, group, and give min and max ('decimal-functions' and its canonical variant) */
    _usesDecimalKeyFunctions(): boolean {
        return this._getDecimalBaseStrategy() === 'decimal-functions'
    }
    /**
     * With 'decimal-functions' and its canonical variant, a customDecimal is compared by its key (tsq_decimal_key),
     * whose text order is the order of the numbers and which is the same for 1.5 and 1.50, so an index on
     * tsq_decimal_key(column) serves every comparison
     */
    _decimalKeySql(sql: string): string {
        return 'tsq_decimal_key(' + sql + ')'
    }
    /** A comparison of a customDecimal value source with a value, as numbers: by their keys, or by decimal_cmp */
    _decimalOrderComparison(operator: '<' | '>' | '<=' | '>=', params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._usesDecimalKeyFunctions()) {
            return this._decimalKeySql(this._appendSql(valueSource, params, false)) + ' ' + operator + ' ' + this._decimalKeySql(this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false))
        }
        return this._decimalCompare(params, valueSource, value, columnType, columnTypeName, typeAdapter) + ' ' + operator + ' 0'
    }
    /**
     * With the decimal strategies 'text' and 'canonical text', SQLite computes with a text in floating point, so no
     * arithmetic of a customDecimal is exact: the query is rejected instead of writing a result that has lost digits
     */
    _rejectDecimalArithmeticAsText(operation: string): never {
        throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, 'The ' + operation + ' of a customDecimal is not exact with the decimal strategy \'' + this._getDecimalStrategy() + '\' of SQLite: use a decimal strategy with functions, like \'decimal-extension and tsq-functions with canonical text\'')
    }
    /**
     * A customDecimal whose text is canonical in a canonical text variant: a column (stored so), a constant or a value
     * (sent so), or the value of a query (whose select list gives it so). Any other expression (a computation, a
     * fragment) may give another text of the same number
     */
    _isCanonicalDecimalSource(value: unknown): boolean {
        return !isValueSource(value) || isColumn(value) || value instanceof SqlOperationConstValueSource || value instanceof InlineSelectValueSource
    }
    /**
     * In a canonical text variant, the SQL of a customDecimal turned into its canonical text when it may not be, the
     * expression computed once, in a subquery; otherwise the SQL as it is. The result of a function of the decimal
     * extension or of the library has no zeros before its integer part, so only the zeros at the end of its fraction and
     * the sign of a zero go; a fragment can be any text, which gets its normal form. Only a text is turned: anything
     * else (a floating point number) reaches the reading of the value as it is, which rejects it
     */
    _canonicalDecimalSql(value: unknown, sql: string): string {
        if (!this._isCanonicalDecimalText() || this._isCanonicalDecimalSource(value)) {
            return sql
        }
        if (value instanceof FragmentValueSource || value instanceof TableOrViewRawFragmentValueSource) {
            return "(select case when typeof(tsq_v) = 'text' and tsq_v not glob '*[^0-9.-]*' then " + this._decimalNormalForm('tsq_v') + ' else tsq_v end from (select ' + sql + ' as tsq_v))'
        }
        return "(select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select " + sql + ' as tsq_v))'
    }
    /**
     * A text of a customDecimal that is the same for the values equal as numbers: in a canonical text variant, the
     * canonical text (the SQL as it is for a column, a constant or a value); otherwise, the normal form
     */
    _decimalComparableText(value: unknown, sql: string): string {
        if (this._isCanonicalDecimalText()) {
            return this._canonicalDecimalSql(value, sql)
        }
        return this._decimalNormalForm(sql)
    }
    _isCustomDecimal(value: unknown): boolean {
        return isValueSource(value) && __isDecimalCategory(__getValueSourcePrivate(value).__valueType)
    }
    /** A value that can be null: a value source that isn't required, or a null */
    _canBeNull(value: unknown): boolean {
        if (isValueSource(value)) {
            return __getValueSourcePrivate(value).__optionalType !== 'required'
        }
        return value === null || value === undefined
    }
    /**
     * The parts of the text of a customDecimal, written in SQL over the SQL of the value (repeated, so a value
     * written once per use): the integer part without its leading zeros, the fraction without its trailing zeros,
     * the significant digits (empty for a zero), where the point goes from the first significant digit, and whether
     * it has a minus sign. They compare and group the values as the numbers they are without a function of the
     * application: `1.5` and `001.50` have the same parts.
     */
    _decimalParts(sql: string): { integer: string, fraction: string, digits: string, exponent: string, negative: string } {
        const absolute = 'ltrim(' + sql + ", '-')"
        const point = 'instr(' + absolute + " || '.', '.')"
        const integer = 'ltrim(substr(' + absolute + ', 1, ' + point + " - 1), '0')"
        const fraction = 'rtrim(substr(' + absolute + ', ' + point + " + 1), '0')"
        const digits = 'rtrim(ltrim(' + integer + ' || ' + fraction + ", '0'), '0')"
        const exponent = '(case when ' + integer + " <> '' then length(" + integer + ') else length(ltrim(' + fraction + ", '0')) - length(" + fraction + ') end)'
        const negative = 'substr(' + sql + ", 1, 1) = '-'"
        return { integer, fraction, digits, exponent, negative }
    }
    /**
     * The parts of a canonical text of a customDecimal (see canonicalDecimalText), shorter to compute: its significant
     * digits (with the zeros at the end of the integer part, which compare the same), where the point goes, and whether
     * it has a minus sign; a zero is '0'
     */
    _decimalCanonicalParts(sql: string): { digits: string, exponent: string, negative: string, zero: string } {
        const absolute = 'ltrim(' + sql + ", '-')"
        const digits = "ltrim(replace(" + absolute + ", '.', ''), '0')"
        const exponent = '(case when substr(' + absolute + ", 1, 2) = '0.' then length(ltrim(substr(" + absolute + ", 3), '0')) - length(substr(" + absolute + ', 3)) else instr(' + absolute + " || '.', '.') - 1 end)"
        const negative = 'substr(' + sql + ", 1, 1) = '-'"
        const zero = sql + " = '0'"
        return { digits, exponent, negative, zero }
    }
    /** The text of the number of a customDecimal, the same for the values equal as numbers: `001.50` is `1.5`, `-0.00` is `0` */
    _decimalNormalForm(sql: string): string {
        const parts = this._decimalParts(sql)
        return '(case when ' + sql + ' is null then null when ' + parts.digits + " = '' then '0' else (case when " + parts.negative + " then '-' else '' end) || (case when " + parts.integer + " = '' then '0' else " + parts.integer + " end) || (case when " + parts.fraction + " <> '' then '.' || " + parts.fraction + " else '' end) end)"
    }
    /** -1, 0 or 1 by the sign of the number of a customDecimal; null for a null */
    _decimalSign(sql: string): string {
        const parts = this._decimalParts(sql)
        return '(case when ' + sql + ' is null then null when ' + parts.digits + " = '' then 0 when " + parts.negative + ' then -1 else 1 end)'
    }
    /**
     * -1, 0 or 1 as the number of the first customDecimal is less, equal or greater than the second one; null when one
     * is null. With the decimal extension's functions, decimal_cmp; with the decimal strategy 'text', in SQL, by the
     * sign, the place of the point and the significant digits, in reverse for the negative numbers
     */
    _decimalCmpSql(first: string, second: string): string {
        if (this._usesDecimalExtensionFunctions()) {
            return 'decimal_cmp(' + first + ', ' + second + ')'
        }
        const a = this._decimalParts(first)
        const b = this._decimalParts(second)
        const signA = this._decimalSign(first)
        const signB = this._decimalSign(second)
        return '(case when ' + signA + ' <> ' + signB + ' then (case when ' + signA + ' < ' + signB + ' then -1 else 1 end) when ' + signA + ' = 0 then 0 else ' + signA + ' * (case when ' + a.exponent + ' <> ' + b.exponent + ' then (case when ' + a.exponent + ' < ' + b.exponent + ' then -1 else 1 end) when ' + a.digits + ' < ' + b.digits + ' then -1 when ' + a.digits + ' > ' + b.digits + ' then 1 else 0 end) end)'
    }
    /**
     * The terms that order a customDecimal as the numbers, in SQL: by the sign, then the place of the point and the
     * significant digits, ascending for the positive numbers and descending for the negative ones; a descending order
     * turns every term around. The nulls go where the ordering says, by the first term.
     */
    _decimalOrderByTerms(sql: string, descending: boolean, nulls: '' | ' nulls first' | ' nulls last', canonical: boolean): string {
        const parts = canonical ? this._decimalCanonicalParts(sql) : this._decimalParts(sql)
        const direction = descending ? ' desc' : ' asc'
        const opposite = descending ? ' asc' : ' desc'
        let nullsTerm = ''
        if (nulls && this._connectionConfiguration.compatibilityVersion < 3_030_000) {
            // Without nulls first / nulls last, a term puts them where they go
            nullsTerm = sql + (nulls === ' nulls last' ? ' is null, ' : ' is not null, ')
            nulls = ''
        }
        // A zero has no digits nor place of the point, whatever its sign: the equal numbers are equal in every term
        const sign = canonical ? '(case when ' + sql + ' is null then null when ' + (parts as { zero: string }).zero + ' then 0 when ' + parts.negative + ' then -1 else 1 end)' : this._decimalSign(sql)
        return nullsTerm + sign + direction + nulls
            + ', (case when ' + sign + ' = 1 then ' + parts.exponent + ' end)' + direction
            + ', (case when ' + sign + ' = -1 then ' + parts.exponent + ' end)' + opposite
            + ', (case when ' + sign + ' = 1 then ' + parts.digits + ' end)' + direction
            + ', (case when ' + sign + ' = -1 then ' + parts.digits + ' end)' + opposite
    }
    /**
     * The smallest or the largest customDecimal of the group, with its text, in SQL: each value gets a key made of the
     * place of its point and its significant digits followed by the value itself; the smallest number is the negative
     * one of the largest magnitude, or else the non negative one of the smallest key (a zero before any positive
     * number), and the other way round for the largest. The value is what follows the digits and the space of the key.
     */
    _decimalMinOrMax(kind: 'min' | 'max', sql: string, canonical: boolean): string {
        const parts = canonical ? this._decimalCanonicalParts(sql) : this._decimalParts(sql)
        const negativeNotZero = parts.negative + ' and ' + parts.digits + " <> ''"
        const magnitude = "printf('%010d', " + parts.exponent + ' + 500000000) || ' + parts.digits + " || ' ' || " + sql
        const notNegative = '(case when ' + parts.digits + " = '' then '1 ' || " + sql + " else '2' || " + magnitude + ' end)'
        const value = (key: string) => "ltrim(ltrim(" + key + ", '0123456789'), ' ')"
        const ofNegatives = (kind === 'min' ? 'max' : 'min') + '(case when ' + negativeNotZero + ' then ' + magnitude + ' end)'
        const ofNotNegatives = kind + '(case when not (' + negativeNotZero + ') then ' + notNegative + ' end)'
        if (kind === 'min') {
            return 'coalesce(' + value(ofNegatives) + ', ' + value(ofNotNegatives) + ')'
        }
        return 'coalesce(' + value(ofNotNegatives) + ', ' + value(ofNegatives) + ')'
    }
    /**
     * A function of the decimal extension over two operands. `decimal_add` and `decimal_sub` of the extension fail with
     * "out of memory" when an operand is null, instead of returning null: an operand that can be null is checked first
     */
    _decimalFunction(functionName: string, params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        let nullCheck = ''
        if (this._canBeNull(valueSource)) {
            nullCheck = this._appendSql(valueSource, params, false) + ' is null'
        }
        if (this._canBeNull(value) && hasToSql(value)) {
            const valueCheck = this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ' is null'
            if (valueCheck !== nullCheck) {
                nullCheck += (nullCheck ? ' or ' : '') + valueCheck
            }
        }
        const call = functionName + '(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
        if (nullCheck) {
            return 'case when ' + nullCheck + ' then null else ' + call + ' end'
        }
        return call
    }
    /**
     * The smaller or the larger of two customDecimal values, compared as numbers; null when one is null, as min and
     * max of two values in SQLite
     */
    _decimalChoice(comparison: '<=' | '>=', params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const first = this._appendSql(valueSource, params, false)
        const second = this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false)
        let nullCheck = ''
        if (this._canBeNull(valueSource)) {
            nullCheck = first + ' is null'
        }
        if (this._canBeNull(value) && hasToSql(value) && second !== first) {
            nullCheck += (nullCheck ? ' or ' : '') + second + ' is null'
        }
        return 'case ' + (nullCheck ? 'when ' + nullCheck + ' then null ' : '') + 'when ' + this._decimalCmpSql(first, second) + ' ' + comparison + ' 0 then ' + first + ' else ' + second + ' end'
    }
    /** -1, 0 or 1 as the customDecimal value source is less, equal or greater than the value, compared as numbers */
    _decimalCompare(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._decimalCmpSql(this._appendSql(valueSource, params, false), this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false))
    }
    /**
     * Whether two customDecimal values are the same number: with the decimal extension's functions, by decimal_cmp;
     * with the decimal strategy 'text', by their normal forms (`1.5` and `1.50` are the same)
     */
    _decimalEquality(operator: '=' | '<>', params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._usesDecimalKeyFunctions() && !this._isCanonicalDecimalText()) {
            return this._decimalKeySql(this._appendSql(valueSource, params, false)) + ' ' + operator + ' ' + this._decimalKeySql(this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false))
        }
        if (this._usesDecimalExtensionFunctions() && !this._isCanonicalDecimalText()) {
            return this._decimalCompare(params, valueSource, value, columnType, columnTypeName, typeAdapter) + ' ' + operator + ' 0'
        }
        return this._decimalComparableText(valueSource, this._appendSql(valueSource, params, false)) + ' ' + operator + ' ' + this._decimalComparableText(value, this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false))
    }
    override _equals(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType)) {
            return this._decimalEquality('=', params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        return super._equals(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _notEquals(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType)) {
            return this._decimalEquality('<>', params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        return super._notEquals(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _lessThan(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType)) {
            return this._decimalOrderComparison('<', params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        return super._lessThan(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _greaterThan(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType)) {
            return this._decimalOrderComparison('>', params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        return super._greaterThan(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _lessOrEqual(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType)) {
            return this._decimalOrderComparison('<=', params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        return super._lessOrEqual(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _greaterOrEqual(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType)) {
            return this._decimalOrderComparison('>=', params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        return super._greaterOrEqual(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    /**
     * A customDecimal in a list or in the values of a query, compared as numbers. A list: with the decimal extension's
     * functions, one decimal_cmp per value; otherwise, by the normal forms. A query: its values in their normal form,
     * through a with that names its only column whatever its name is
     */
    _decimalIn(not: boolean, params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string | undefined {
        if (Array.isArray(value)) {
            if (value.length <= 0) {
                return undefined
            }
            const first = this._appendSql(valueSource, params, false)
            if (this._usesDecimalKeyFunctions() && !this._isCanonicalDecimalText()) {
                return this._decimalKeySql(first) + (not ? ' not in (' : ' in (') + value.map(item => this._decimalKeySql(this._appendValue(item, params, columnType, columnTypeName, typeAdapter, false))).join(', ') + ')'
            }
            if (this._usesDecimalExtensionFunctions() && !this._isCanonicalDecimalText()) {
                return '(' + value.map(item => this._decimalCmpSql(first, this._appendValue(item, params, columnType, columnTypeName, typeAdapter, false)) + (not ? ' <> 0' : ' = 0')).join(not ? ' and ' : ' or ') + ')'
            }
            return this._decimalComparableText(valueSource, first) + (not ? ' not in (' : ' in (') + value.map(item => this._decimalComparableText(item, this._appendValue(item, params, columnType, columnTypeName, typeAdapter, false))).join(', ') + ')'
        }
        if (hasToSql(value) && this._isCanonicalDecimalText()) {
            // The select list of the query gives the canonical texts
            return this._decimalComparableText(valueSource, this._appendSql(valueSource, params, false)) + (not ? ' not in ' : ' in ') + '(' + this._appendSql(value, params, false) + ')'
        }
        if (hasToSql(value) && this._usesDecimalKeyFunctions()) {
            const alias = 'q_' + this._generateUnique() + '_'
            return this._decimalKeySql(this._appendSql(valueSource, params, false)) + (not ? ' not in ' : ' in ') + '(with ' + alias + '(v) as (' + this._appendSql(value, params, false) + ') select ' + this._decimalKeySql(alias + '.v') + ' from ' + alias + ')'
        }
        if (hasToSql(value)) {
            const alias = 'q_' + this._generateUnique() + '_'
            return this._decimalNormalForm(this._appendSql(valueSource, params, false)) + (not ? ' not in ' : ' in ') + '(with ' + alias + '(v) as (' + this._appendSql(value, params, false) + ') select ' + this._decimalNormalForm(alias + '.v') + ' from ' + alias + ')'
        }
        return undefined
    }
    override _in(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType)) {
            const result = this._decimalIn(false, params, valueSource, value, columnType, columnTypeName, typeAdapter)
            if (result !== undefined) {
                return result
            }
        }
        return super._in(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _notIn(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType)) {
            const result = this._decimalIn(true, params, valueSource, value, columnType, columnTypeName, typeAdapter)
            if (result !== undefined) {
                return result
            }
        }
        return super._notIn(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _between(params: any[], valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType) && this._usesDecimalKeyFunctions()) {
            return this._decimalKeySql(this._appendSql(valueSource, params, false)) + ' between ' + this._decimalKeySql(this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false)) + ' and ' + this._decimalKeySql(this._appendValue(value2, params, columnType, columnTypeName, typeAdapter, false))
        }
        if (__isDecimalCategory(columnType)) {
            const first = this._appendSql(valueSource, params, false)
            return '(' + this._decimalCmpSql(first, this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false)) + ' >= 0 and ' + this._decimalCmpSql(first, this._appendValue(value2, params, columnType, columnTypeName, typeAdapter, false)) + ' <= 0)'
        }
        return super._between(params, valueSource, value, value2, columnType, columnTypeName, typeAdapter)
    }
    override _notBetween(params: any[], valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType) && this._usesDecimalKeyFunctions()) {
            return this._decimalKeySql(this._appendSql(valueSource, params, false)) + ' not between ' + this._decimalKeySql(this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false)) + ' and ' + this._decimalKeySql(this._appendValue(value2, params, columnType, columnTypeName, typeAdapter, false))
        }
        if (__isDecimalCategory(columnType)) {
            const first = this._appendSql(valueSource, params, false)
            return 'not (' + this._decimalCmpSql(first, this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false)) + ' >= 0 and ' + this._decimalCmpSql(first, this._appendValue(value2, params, columnType, columnTypeName, typeAdapter, false)) + ' <= 0)'
        }
        return super._notBetween(params, valueSource, value, value2, columnType, columnTypeName, typeAdapter)
    }
    override _add(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType) && !this._usesDecimalExtensionFunctions()) {
            this._rejectDecimalArithmeticAsText('addition')
        }
        if (__isDecimalCategory(columnType) && this._usesDecimalExtensionFunctions()) {
            return this._decimalFunction('decimal_add', params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        return super._add(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _subtract(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType) && !this._usesDecimalExtensionFunctions()) {
            this._rejectDecimalArithmeticAsText('subtraction')
        }
        if (__isDecimalCategory(columnType) && this._usesDecimalExtensionFunctions()) {
            return this._decimalFunction('decimal_sub', params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        return super._subtract(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _multiply(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType) && !this._usesDecimalExtensionFunctions()) {
            this._rejectDecimalArithmeticAsText('multiplication')
        }
        if (__isDecimalCategory(columnType) && this._usesDecimalExtensionFunctions()) {
            // decimal_mul returns null for a null operand
            return 'decimal_mul(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
        }
        return super._multiply(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    /**
     * decimal_sum of the extension gives 0 when every value is null, where sum gives null as on the other databases:
     * without a value counted, the sum is null
     */
    override _sum(params: any[], value: any): string {
        if (this._isCustomDecimal(value) && !this._usesDecimalExtensionFunctions()) {
            this._rejectDecimalArithmeticAsText('sum')
        }
        if (this._isCustomDecimal(value) && this._usesDecimalExtensionFunctions()) {
            return 'case when count(' + this._appendSql(value, params, false) + ') = 0 then null else decimal_sum(' + this._appendSql(value, params, false) + ') end'
        }
        return super._sum(params, value)
    }
    /** The distinct values of a customDecimal are the distinct numbers: their normal forms (`1.5` and `1.50` are one) */
    override _sumDistinct(params: any[], value: any): string {
        if (this._isCustomDecimal(value) && !this._usesDecimalExtensionFunctions()) {
            this._rejectDecimalArithmeticAsText('sum')
        }
        if (this._isCustomDecimal(value) && this._usesDecimalExtensionFunctions()) {
            const sql = this._appendSql(value, params, false)
            return 'case when count(' + sql + ') = 0 then null else decimal_sum(distinct ' + this._decimalComparableText(value, sql) + ') end'
        }
        return super._sumDistinct(params, value)
    }
    override _countDistinct(params: any[], value: any): string {
        if (this._isCustomDecimal(value)) {
            return 'count(distinct ' + this._decimalGroupingKeySql(value, this._appendSql(value, params, false)) + ')'
        }
        return super._countDistinct(params, value)
    }
    override _averageDistinct(params: any[], value: any): string {
        if (this._isCustomDecimal(value)) {
            // avg reads the text of each distinct number as a number
            return 'avg(distinct ' + this._decimalComparableText(value, this._appendSql(value, params, false)) + ')'
        }
        return super._averageDistinct(params, value)
    }
    _isOrderByDecimalAsReal(params: any[]): boolean {
        return !!(params as any)._orderByDecimalAsReal
    }
    _setOrderByDecimalAsReal(params: any[], value: boolean): void {
        Object.defineProperty(params, '_orderByDecimalAsReal', {
            value: value,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    /** The order by names a customDecimal, which is ordered by expressions of it */
    _isDecimalOrderByEntry(entry: OrderByEntry, query: SelectData): boolean {
        const expression = entry.expression
        const column = typeof expression === 'string' ? getQueryColumn(query.__columns, expression) : expression
        return this._isCustomDecimal(column)
    }
    /** With the decimal strategy 'decimal-functions', a customDecimal is ordered by its key, whose text orders as the number does */
    override _appendOrderByColumnAlias(entry: OrderByEntry, query: SelectData, params: any[]): string {
        if (this._isOrderByDecimalAsReal(params) || !this._usesDecimalKeyFunctions() || !this._isDecimalOrderByEntry(entry, query)) {
            return super._appendOrderByColumnAlias(entry, query, params)
        }
        this._setOrderByDecimalAsReal(params, true)
        try {
            return 'tsq_decimal_key(' + this._appendOrderByColumnForExpression(entry, query, params) + ')'
        } finally {
            this._setOrderByDecimalAsReal(params, false)
        }
    }
    /**
     * Without the functions of the library for the order, a customDecimal is ordered as the number by terms
     * written in SQL (see _decimalOrderByTerms), the ordering of the entry applied to them
     */
    override _appendOrderByEntryTerms(entry: OrderByEntry, query: SelectData, params: any[]): string | undefined {
        if (this._isOrderByDecimalAsReal(params) || this._usesDecimalKeyFunctions() || !this._isDecimalOrderByEntry(entry, query)) {
            return undefined
        }
        const order = entry.order || ''
        if (order && !/^(asc|desc)?( nulls (first|last))?( insensitive)?$|^insensitive$/.test(order)) {
            return undefined
        }
        const nulls = order.includes('nulls first') ? ' nulls first' : order.includes('nulls last') ? ' nulls last' : ''
        this._setOrderByDecimalAsReal(params, true)
        try {
            // In a canonical text variant the text ordered is canonical: a column of the select list, a column, a
            // constant or a value
            const expression = entry.expression
            const canonical = this._isCanonicalDecimalText() && (typeof expression === 'string' || this._isCanonicalDecimalSource(expression))
            return this._decimalOrderByTerms(this._appendOrderByColumnForExpression(entry, query, params), order.startsWith('desc'), nulls, canonical)
        } finally {
            this._setOrderByDecimalAsReal(params, false)
        }
    }
    /** A compound query can only order by its columns: an expression of a customDecimal goes over a query that wraps it */
    override _needsCompoundOrderByWrap(query: SelectData): boolean {
        if (super._needsCompoundOrderByWrap(query)) {
            return true
        }
        return query.__type === 'compound' && !!query.__orderBy && query.__orderBy.some(entry => this._isDecimalOrderByEntry(entry, query))
    }
    /**
     * min and max of a customDecimal compare the numbers: with the decimal strategy 'decimal-functions', the aggregates
     * of the library; otherwise in SQL (see _decimalMinOrMax)
     */
    override _min(params: any[], value: any): string {
        if (this._isCustomDecimal(value)) {
            if (this._usesDecimalKeyFunctions()) {
                return 'tsq_decimal_min(' + this._appendSql(value, params, false) + ')'
            }
            return this._decimalMinOrMax('min', this._appendSql(value, params, false), this._isCanonicalDecimalText() && this._isCanonicalDecimalSource(value))
        }
        return super._min(params, value)
    }
    override _max(params: any[], value: any): string {
        if (this._isCustomDecimal(value)) {
            if (this._usesDecimalKeyFunctions()) {
                return 'tsq_decimal_max(' + this._appendSql(value, params, false) + ')'
            }
            return this._decimalMinOrMax('max', this._appendSql(value, params, false), this._isCanonicalDecimalText() && this._isCanonicalDecimalSource(value))
        }
        return super._max(params, value)
    }
    /**
     * With the decimal extension's functions, `is` and `is not` of a customDecimal compare the numbers: equal when both
     * are null or decimal_cmp gives 0 (decimal_cmp is null when one is null)
     */
    _decimalIs(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const first = this._appendSql(valueSource, params, false)
        const second = this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false)
        if (this._usesDecimalKeyFunctions() && !this._isCanonicalDecimalText()) {
            // The keys are null for a null, and is compares the nulls too
            return this._decimalKeySql(first) + ' is ' + this._decimalKeySql(second)
        }
        if (!this._usesDecimalExtensionFunctions() || this._isCanonicalDecimalText()) {
            // The comparable texts are null for a null, and is compares the nulls too
            return this._decimalComparableText(valueSource, first) + ' is ' + this._decimalComparableText(value, second)
        }
        const firstCanBeNull = this._canBeNull(valueSource)
        const secondCanBeNull = this._canBeNull(value)
        const compare = 'decimal_cmp(' + first + ', ' + second + ') = 0'
        if (!firstCanBeNull && !secondCanBeNull) {
            return compare
        }
        if (!firstCanBeNull || !secondCanBeNull) {
            return 'coalesce(' + compare + ', 0)'
        }
        return 'coalesce(' + compare + ', ' + first + ' is null and ' + second + ' is null)'
    }
    /**
     * A union, an intersect or an except of queries with a customDecimal column takes the values equal as numbers
     * (`1.5` and `1.50`) as the same: the rows are compared by the grouping key of each customDecimal (see
     * _decimalGroupingKey), and each group of equal rows gives one of them
     */
    override _buildCompoundCore(query: CompoundSelectData, params: any[], columnsForInsert: { [name: string]: DBColumn | undefined }, isOutermostQuery: boolean): string {
        const operator = query.__compoundOperator
        const removesDuplicates = operator === 'union' || operator === 'intersect' || operator === 'except' || operator === 'minus'
        if (!removesDuplicates || this._isCanonicalDecimalText()) {
            // In a canonical text variant each select list gives the canonical texts, which the operator compares
            return super._buildCompoundCore(query, params, columnsForInsert, isOutermostQuery)
        }
        const columns: FlatQueryColumns = {}
        flattenQueryColumns(query.__columns, columns, '')
        let hasDecimal = false
        for (const property in columns) {
            hasDecimal = hasDecimal || this._isCustomDecimal(columns[property])
        }
        if (!hasDecimal) {
            return super._buildCompoundCore(query, params, columnsForInsert, isOutermostQuery)
        }
        const firstAlias = 'c_' + this._generateUnique() + '_'
        const key = (property: string, alias: string) => {
            const column = alias + '.' + this._appendColumnAlias(property, params)
            return this._isCustomDecimal(columns[property]) ? this._decimalGroupingKeySql(undefined, column) : column
        }
        let selectColumns = ''
        let groupBy = ''
        for (const property in columns) {
            selectColumns += (selectColumns ? ', ' : '') + firstAlias + '.' + this._appendColumnAlias(property, params) + ' as ' + this._appendColumnAlias(property, params)
            groupBy += (groupBy ? ', ' : '') + key(property, firstAlias)
        }
        if (this._hasCustomizedColumns(query)) {
            // A customization adds columns of its own: every column is passed on; the rows are compared by the columns of
            // the select
            selectColumns = firstAlias + '.*'
        }
        if (operator === 'union') {
            const first = this._buildSelectWithColumnsInfoForCompound(query.__firstQuery, params, columnsForInsert, isOutermostQuery, this._compoundOperandNeedsGrouping(query.__firstQuery, 'first', 'unionAll'))
            const second = this._buildSelectWithColumnsInfoForCompound(query.__secondQuery, params, columnsForInsert, isOutermostQuery, this._compoundOperandNeedsGrouping(query.__secondQuery, 'second', 'unionAll'))
            return 'select ' + selectColumns + ' from (' + first + ' union all ' + second + ') as ' + firstAlias + ' group by ' + groupBy
        }
        const secondAlias = 'c_' + this._generateUnique() + '_'
        const first = this._buildSelectWithColumnsInfo(query.__firstQuery, params, columnsForInsert, isOutermostQuery)
        const second = this._buildSelectWithColumnsInfo(query.__secondQuery, params, columnsForInsert, isOutermostQuery)
        let sameRow = ''
        for (const property in columns) {
            sameRow += (sameRow ? ' and ' : '') + key(property, firstAlias) + ' is ' + key(property, secondAlias)
        }
        return 'select ' + selectColumns + ' from (' + first + ') as ' + firstAlias + ' where ' + (operator === 'intersect' ? '' : 'not ') + 'exists (select 1 from (' + second + ') as ' + secondAlias + ' where ' + sameRow + ') group by ' + groupBy
    }
    /**
     * abs, ceil, floor, round, roundn and modulo of a customDecimal: with the strategies with functions, the functions
     * of the library (tsq_), which the decimal extension doesn't have; abs, without functions of the library, without
     * the minus sign of the text; with 'text' and 'canonical text' no other emission is exact
     */
    _decimalOperationNotExact(operation: string): never {
        throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, 'The ' + operation + ' of a customDecimal is not exact with the decimal strategy \'' + this._getDecimalStrategy() + '\' of SQLite: use a decimal strategy with functions, like \'decimal-extension and tsq-functions with canonical text\'')
    }
    override _abs(params: any[], valueSource: ToSql): string {
        if (this._isCustomDecimal(valueSource)) {
            if (this._usesDecimalKeyFunctions()) {
                return 'tsq_decimal_abs(' + this._appendSql(valueSource, params, false) + ')'
            }
            // The text without its minus sign, which keeps its digits and its scale; a null stays null
            const value = this._appendSql(valueSource, params, false)
            return "(case when substr(" + value + ", 1, 1) = '-' then substr(" + value + ', 2) else ' + value + ' end)'
        }
        return super._abs(params, valueSource)
    }
    override _ceil(params: any[], valueSource: ToSql): string {
        if (this._isCustomDecimal(valueSource)) {
            if (!this._usesDecimalExtensionFunctions()) {
                this._decimalOperationNotExact('ceiling')
            }
            return 'tsq_decimal_ceil(' + this._appendSql(valueSource, params, false) + ')'
        }
        return super._ceil(params, valueSource)
    }
    override _floor(params: any[], valueSource: ToSql): string {
        if (this._isCustomDecimal(valueSource)) {
            if (!this._usesDecimalExtensionFunctions()) {
                this._decimalOperationNotExact('floor')
            }
            return 'tsq_decimal_floor(' + this._appendSql(valueSource, params, false) + ')'
        }
        return super._floor(params, valueSource)
    }
    override _round(params: any[], valueSource: ToSql): string {
        if (this._isCustomDecimal(valueSource)) {
            if (!this._usesDecimalExtensionFunctions()) {
                this._decimalOperationNotExact('rounding')
            }
            return 'tsq_decimal_round(' + this._appendSql(valueSource, params, false) + ', 0)'
        }
        return super._round(params, valueSource)
    }
    override _roundn(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType)) {
            if (!this._usesDecimalExtensionFunctions()) {
                this._decimalOperationNotExact('rounding')
            }
            return 'tsq_decimal_round(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false) + ')'
        }
        return super._roundn(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _modulo(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType)) {
            if (!this._usesDecimalExtensionFunctions()) {
                this._decimalOperationNotExact('modulo')
            }
            return 'tsq_decimal_mod(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
        }
        return super._modulo(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    _unixEpochSeconds(timeValue: string): string {
        // unixepoch() was added in SQLite 3.38; falls back to strftime('%s', ...) on older versions
        if (this._connectionConfiguration.compatibilityVersion >= 3_038_000) {
            return 'unixepoch(' + timeValue + ')'
        }
        return "cast(strftime('%s', " + timeValue + ') as integer)'
    }
    _unixEpochMilliseconds(timeValue: string): string {
        // The 'subsec' modifier on unixepoch() was added in SQLite 3.42; older versions
        // need to go through julianday() arithmetic to preserve sub-second precision.
        if (this._connectionConfiguration.compatibilityVersion >= 3_042_000) {
            return 'cast(unixepoch(' + timeValue + ", 'subsec') * 1000 as integer)"
        }
        // The julianday arithmetic lands a hair below the whole millisecond about half the
        // time, and a cast truncates — costing a millisecond on 29818 of the 60000
        // (second, millisecond) pairs. Round to the millisecond before casting, the way
        // `_getTime` already does with the same expression.
        return 'cast(round((julianday(' + timeValue + ') - 2440587.5) * 86400000.0) as integer)'
    }
    /**
     * An instant stored as unix-time MILLISECONDS, spelled as the value + modifiers a date
     * function takes: `strftime('%S', <this>)`.
     *
     * SQLite 3.42's 'subsec' modifier lets `unixepoch` take fractional seconds, which is
     * exactly what the stored value is once divided — so the engine does the conversion
     * itself, sub-second part included. Older versions only accept whole seconds, and the
     * value has to be floored first: `x / 1000` won't do, because both operands are
     * integers and SQLite's integer division truncates **toward zero** rather than
     * flooring. That is the same thing for an instant at or after 1970 and one second off
     * before it (`-1500 / 1000` is `-1`, putting `1969-12-31 23:59:58.500` on the wrong
     * second), so the fallback divides by a REAL literal and floors.
     */
    _unixMillisecondsAsDateTimeArgument(sql: string): string {
        if (this._connectionConfiguration.compatibilityVersion >= 3_042_000) {
            return sql + " / 1000.0, 'unixepoch', 'subsec'"
        }
        return 'cast(floor(' + sql + " / 1000.0) as integer), 'unixepoch'"
    }
    /**
     * The millisecond component of an instant stored as unix-time MILLISECONDS.
     *
     * `x % 1000` keeps the sign of the dividend in SQLite, so a pre-1970 instant yields a
     * NEGATIVE millisecond — which the declared type (and the JavaScript accessor this
     * mirrors) cannot hold. The double modulo brings it back into 0-999. This stays plain
     * integer arithmetic on the stored value: routing it through a date function would ask
     * the engine to parse and rebuild an instant only to take it apart again.
     */
    _unixMillisecondsAsMilliseconds(sql: string): string {
        return '((' + sql + ' % 1000) + 1000) % 1000'
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
    /**
     * The value and modifiers that a date function takes to read a value in the getters.
     *
     * A date is a calendar day, and it stays as it is. A local text is already the wall clock of the application. The
     * rest are read in UTC, unless `sqliteRunsInApplicationTimeZone` says that SQLite runs in the zone of the
     * application: then they are read as JavaScript reads them.
     *
     * A time needs a date to be moved to another zone, and on its own SQLite gives it another one than JavaScript,
     * which uses 1970-01-01. In a Julian day, a time is the part of the day since midnight, while a Julian day starts
     * at noon, so it needs that date anyway.
     */
    _dateFunctionArgument(params: any[], valueSource: ToSql): string {
        const format = this._getValueSourceDateTimeFormat(valueSource)
        const isTime = isValueSource(valueSource) && __isLocalTimeValueSource(__getValueSourcePrivate(valueSource))
        const isDate = isValueSource(valueSource) && __isLocalDateValueSource(__getValueSourcePrivate(valueSource))
        const inApplicationZone = !!this._connectionConfiguration.sqliteRunsInApplicationTimeZone
            && !isDate
            && !isLocalTextFormat(format)
        const modifier = inApplicationZone ? ", 'localtime'" : ''
        switch (format) {
            case 'Unix time seconds as integer':
                return this._appendSql(valueSource, params, false) + ", 'unixepoch'" + modifier
            case 'Unix time milliseconds as integer':
                return this._unixMillisecondsAsDateTimeArgument(this._appendSql(valueSource, params, false)) + modifier
            case 'Julian day as real number':
                if (isTime) {
                    return this._appendSqlParenthesis(valueSource, params, false) + ' + 2440587.5' + modifier
                }
                return this._appendSql(valueSource, params, false) + modifier
            default:
                if (isTime && inApplicationZone) {
                    return "'1970-01-01 ' || " + this._appendSqlParenthesis(valueSource, params, false) + modifier
                }
                return this._appendSql(valueSource, params, false) + modifier
        }
    }
    override _appendGroupBySelectColumn(entry: AnyValueSource, selectColumn: SelectColumnSql, _params: any[], _isOutermostQuery: boolean): string {
        // The same SQL as the select list: a numbered placeholder (?1) can be repeated, and it is the same expression; in
        // a canonical text variant the select list already gives the canonical text
        if (this._isCanonicalDecimalText()) {
            return selectColumn.sql
        }
        return this._decimalGroupingKey(entry, selectColumn.sql)
    }
    /**
     * The values of a customDecimal are grouped by the number they are (`1.5` with `1.50`): in a canonical text variant,
     * by their canonical text; with 'decimal-functions', by the key of the value; otherwise by its normal form
     */
    _decimalGroupingKey(value: unknown, sql: string): string {
        if (this._isCustomDecimal(value)) {
            return this._decimalGroupingKeySql(value, sql)
        }
        return sql
    }
    _decimalGroupingKeySql(value: unknown, sql: string): string {
        if (this._isCanonicalDecimalText()) {
            return this._canonicalDecimalSql(value, sql)
        }
        if (this._usesDecimalKeyFunctions()) {
            return 'tsq_decimal_key(' + sql + ')'
        }
        return this._decimalNormalForm(sql)
    }
    /**
     * A distinct select of groups (a group by or an aggregate) with a customDecimal column would compare the texts of
     * the rows it gives, where `1.5` and `1.50` are different: no emission of SQLite removes them as numbers there,
     * unless the texts are canonical
     */
    _rejectDistinctDecimalOfGroups(): never {
        throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, 'A distinct select with a customDecimal column and a group by or an aggregate is not exact in SQLite with the decimal strategy \'' + this._getDecimalStrategy() + '\': use its canonical text variant, like \'decimal-extension and tsq-functions with canonical text\', remove the distinct, or group by the columns instead')
    }
    override _buildSelectGroupBy(query: PlainSelectData, params: any[], isOutermostQuery: boolean, selectColumnsSql?: Map<AnyValueSource, SelectColumnSql> | undefined): string {
        if (query.__groupBy.length > 0) {
            const groupBy = query.__groupBy
            let result = ' group by '
            for (let i = 0, length = groupBy.length; i < length; i++) {
                if (i > 0) {
                    result += ', '
                }
                const entry = groupBy[i]!
                const selectColumn = query.__groupByColumnNames?.has(entry) ? selectColumnsSql?.get(entry) : undefined
                if (selectColumn) {
                    result += this._appendGroupBySelectColumn(entry, selectColumn, params, isOutermostQuery)
                } else {
                    result += this._decimalGroupingKey(entry, this._appendSelectColumn(entry, params, undefined, isOutermostQuery))
                }
            }
            if (query.__distinct && selectColumnsSql && !this._isCanonicalDecimalText() && [...selectColumnsSql.keys()].some(column => this._isCustomDecimal(column))) {
                this._rejectDistinctDecimalOfGroups()
            }
            return result
        }
        if (!query.__distinct || !selectColumnsSql || this._isCanonicalDecimalText()) {
            // In a canonical text variant the select list gives the canonical texts, which a distinct compares
            return ''
        }
        // A distinct select with a customDecimal, without aggregates, is grouped by its columns, the customDecimal by
        // its grouping key, so the values equal as numbers are one row
        let hasDecimal = false
        let hasAggregation = false
        for (const column of selectColumnsSql.keys()) {
            hasAggregation = hasAggregation || __getValueSourcePrivate(column).__hasAggregation(this)
            hasDecimal = hasDecimal || this._isCustomDecimal(column)
        }
        if (!hasDecimal) {
            return ''
        }
        if (hasAggregation) {
            this._rejectDistinctDecimalOfGroups()
        }
        let result = ''
        for (const [column, selectColumn] of selectColumnsSql) {
            result += (result ? ', ' : ' group by ') + this._decimalGroupingKey(column, selectColumn.sql)
        }
        return result
    }
    override _anyValue(params: any[], value: any): string {
        // SQLite has no any_value: a column outside an aggregate in a grouped query (a bare column) takes the value
        // of one of the rows of the group, which is what any_value means
        return this._appendSqlParenthesis(value, params, false)
    }
    override _isReservedKeyword(word: string): boolean {
        return isSqliteReservedWord(word)
    }
    override _compoundIntersectHasPrecedence(): boolean {
        // Reads a chain of compound operators from left to right
        return false
    }
    override _buildSelectWithColumnsInfoForCompound(query: SelectData, params: any[], columnsForInsert: { [name: string]: DBColumn | undefined }, isOutermostQuery: boolean, needsGrouping: boolean): string {
        const result = this._buildSelectWithColumnsInfo(query, params, columnsForInsert, isOutermostQuery)
        if (needsGrouping || query.__limit !== undefined || query.__offset !== undefined || query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems) {
            return 'select * from (' + result + ')'
        }
        return result
    }
    // SQLite accepts `col collate <name>` as a compound ORDER BY term (COLLATE
    // is a modifier on the result column) but rejects `lower(col)` (a function
    // call doesn't match a result column). So the collation form orders inline;
    // the `lower()` default still needs the `select * from (...)` wrapper.
    override _supportCollateInCompoundOrderBy(): boolean {
        return true
    }
    override _needsCompoundNullsEmulationOrderByWrap(query: SelectData): boolean {
        // Below SQLite 3.30 there is no native `nulls first` / `nulls last`, so the
        // `asc nulls last` / `desc nulls first` modes (and their insensitive
        // variants) are emulated with an `<col> is null` term (see
        // `_buildSelectOrderBy`). That expression is illegal inside a compound
        // ORDER BY — SQLite rejects it with "ORDER BY term does not match any
        // column in the result set" — so the compound must be wrapped as
        // `select * from (<compound>)` and the ordering applied on the plain
        // wrapper. From 3.30 the native syntax is emitted inline and needs no
        // wrapper; the other NULLs modes render as a plain `asc` / `desc`.
        if (this._connectionConfiguration.compatibilityVersion >= 3_030_000) {
            return false
        }
        if (query.__type !== 'compound') {
            return false
        }
        const orderBy = query.__orderBy
        if (!orderBy) {
            return false
        }
        for (let i = 0, length = orderBy.length; i < length; i++) {
            const entry = orderBy[i]!
            const order = entry.order
            if (order === 'asc nulls last' || order === 'desc nulls first'
                || order === 'asc nulls last insensitive' || order === 'desc nulls first insensitive') {
                return true
            }
        }
        return false
    }
    override _supportOrderByColumnAliasInExpression(): boolean {
        // Inside an expression of the order by, SQLite takes a column of the from with the same name before the alias
        return false
    }
    override _buildSelectOrderBy(query: SelectData, params: any[]): string {
        if (this._connectionConfiguration.compatibilityVersion >= 3_030_000) {
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

        for (let i = 0, length = orderBy.length; i < length; i++) {
            const entry = orderBy[i]!
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const order = entry.order
            const ownTerms = this._appendOrderByEntryTerms(entry, query, params)
            if (ownTerms !== undefined) {
                orderByColumns += ownTerms
            } else if (!order) {
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
                    orderByColumns += this._appendOrderByColumnForExpression(entry, query, params) + ' is null, ' + this._appendOrderByColumnAlias(entry, query, params) + ' asc'
                    break
                case 'desc nulls first':
                    orderByColumns += this._appendOrderByColumnForExpression(entry, query, params) + ' is not null, ' + this._appendOrderByColumnAlias(entry, query, params) + ' desc'
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
                    orderByColumns += this._appendOrderByColumnForExpression(entry, query, params) + ' is null, ' + this._appendOrderByColumnAliasInsensitive(entry, query, params) + ' asc'
                    break
                case 'desc nulls first insensitive':
                    orderByColumns += this._appendOrderByColumnForExpression(entry, query, params) + ' is not null, ' + this._appendOrderByColumnAliasInsensitive(entry, query, params) + ' desc'
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
    // SQLite's LIKE has no default escape character, so the `\`-escaped wildcards
    // produced by `_escapeLikeWildcard` need an explicit `escape '\'` clause.
    override _likeEscape = " escape '\\'"
    override _appendUpdateOldValueForUpdate(_query: UpdateData, _updatePrimaryKey: boolean, _requiredTables: Set<AnyTableOrView> | undefined, _params: any[]) {
        return ''
    }
    override _buildInsertOutput(_query: InsertData, _params: any[]): string {
        return ''
    }
    override _buildInsertReturning(query: InsertData, params: any[]): string {
        if (this._connectionConfiguration.compatibilityVersion >= 3_035_000 || query.__from || query.__multiple || query.__columns || query.__onConflictUpdateSets) {
            return super._buildInsertReturning(query, params)
        }
        this._setContainsInsertReturningClause(params, false)
        return ''
    }
    override _is(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType)) {
            return this._decimalIs(params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' is ' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params, false) + ' is ' + this._appendValueParenthesis(value, params, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
    }
    override _isNot(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType)) {
            return 'not ' + this._decimalIs(params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' is not ' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params, false) + ' is not ' + this._appendValueParenthesis(value, params, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value))
    }
    override _currentDate(_params: any): string {
        const dateTimeFormat = this._getDateTimeFormat('date')
        // A date is written with the calendar of the application, whatever the format is
        const today = this._connectionConfiguration.sqliteRunsInApplicationTimeZone ? "date('now', 'localtime')" : "date('now')"
        switch (dateTimeFormat) {
            case 'localdate seconds as text':
            case 'localdate milliseconds as text':
            case 'localdate seconds as text using T separator':
            case 'localdate milliseconds as text using T separator':
                return "date('now', 'localtime')"
            case 'UTC seconds as text':
            case 'UTC milliseconds as text':
            case 'UTC seconds as text using T separator':
            case 'UTC milliseconds as text using T separator':
            case 'UTC seconds as text using Z timezone':
            case 'UTC milliseconds as text using Z timezone':
            case 'UTC seconds as text using T separator and Z timezone':
            case 'UTC milliseconds as text using T separator and Z timezone':
                return today
            case 'Julian day as real number':
                return 'julianday(' + today + ')'
            case 'Unix time seconds as integer':
                return this._unixEpochSeconds(today)
            case 'Unix time milliseconds as integer':
                // The date has no sub-second component, so seconds * 1000 is exact
                return '(' + this._unixEpochSeconds(today) + ' * 1000)'
            default:
                throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dataTimeFormat', value: dateTimeFormat }, 'Invalid sqlite date time format: ' + dateTimeFormat)
        }
    }
    override _currentTime(_params: any): string {
        const dateTimeFormat = this._getDateTimeFormat('time')
        switch (dateTimeFormat) {
            case 'localdate seconds as text':
            case 'localdate seconds as text using T separator':
                return "time('now', 'localtime')"
            case 'localdate milliseconds as text':
            case 'localdate milliseconds as text using T separator':
                return "strftime('%H:%M:%f', 'now', 'localtime')"
            case 'UTC seconds as text':
            case 'UTC seconds as text using T separator':
                return "time('now')"
            case 'UTC milliseconds as text':
            case 'UTC milliseconds as text using T separator':
                return "strftime('%H:%M:%f', 'now')"
            case 'UTC seconds as text using Z timezone':
            case 'UTC seconds as text using T separator and Z timezone':
                return "strftime('%H:%M:%SZ', 'now')"
            case 'UTC milliseconds as text using Z timezone':
            case 'UTC milliseconds as text using T separator and Z timezone':
                return "strftime('%H:%M:%fZ', 'now')"
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
            case 'localdate seconds as text':
                return "datetime('now', 'localtime')"
            case 'localdate milliseconds as text':
                return "strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime')"
            case 'localdate seconds as text using T separator':
                return "strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')"
            case 'localdate milliseconds as text using T separator':
                return "strftime('%Y-%m-%dT%H:%M:%f', 'now', 'localtime')"
            case 'UTC seconds as text':
                return "datetime('now')"
            case 'UTC milliseconds as text':
                return "strftime('%Y-%m-%d %H:%M:%f', 'now')"
            case 'UTC seconds as text using T separator':
                return "strftime('%Y-%m-%dT%H:%M:%S', 'now')"
            case 'UTC milliseconds as text using T separator':
                return "strftime('%Y-%m-%dT%H:%M:%f', 'now')"
            case 'UTC seconds as text using Z timezone':
                return "strftime('%Y-%m-%d %H:%M:%SZ', 'now')"
            case 'UTC milliseconds as text using Z timezone':
                return "strftime('%Y-%m-%d %H:%M:%fZ', 'now')"
            case 'UTC seconds as text using T separator and Z timezone':
                return "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')"
            case 'UTC milliseconds as text using T separator and Z timezone':
                return "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
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
        return 'ifnull(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, this._getWidenedArgumentType(columnType, columnTypeName, value), this._getWidenedArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')'
    }
    override _random(_params: any): string {
        // SQLite's `random()` returns a uniform 64-bit signed integer
        // (-2^63..2^63-1), not a [0, 1) float like every other dialect.
        // Normalise to a double in [0, 1) so the public `connection.random()`
        // contract is uniform across engines and survives strict i64 → JS
        // number drivers (notably `node:sqlite`).
        return '(random() / 18446744073709551616.0 + 0.5)'
    }
    override _ln(params: any[], valueSource: ToSql): string {
        return 'ln(' + this._appendSql(valueSource, params, false) + ')'
    }
    override _log10(params: any[], valueSource: ToSql): string {
        return 'log10(' + this._appendSql(valueSource, params, false) + ')'
    }
    override _minimumBetweenTwoValues(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType)) {
            return this._decimalChoice('<=', params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        return 'min(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')'
    }
    override _maximumBetweenTwoValues(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (__isDecimalCategory(columnType)) {
            return this._decimalChoice('>=', params, valueSource, value, columnType, columnTypeName, typeAdapter)
        }
        return 'max(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, this._widenedArgumentNeedsTypeCast(columnType, columnTypeName, value)) + ')'
    }
    override _getDate(params: any[], valueSource: ToSql): string {
        return "cast(strftime('%d', " + this._dateFunctionArgument(params, valueSource) + ") as integer)"
    }
    override _getTime(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return '(' + this._appendSql(valueSource, params, false) + ' * 1000)'
        } else if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time milliseconds as integer') {
            return this._appendSql(valueSource, params, false)
        }
        const format = this._getValueSourceDateTimeFormat(valueSource)
        // A local text has no zone, and SQLite reads it as UTC unless it's told it's in the local one
        const modifier = this._connectionConfiguration.sqliteRunsInApplicationTimeZone && isLocalTextFormat(format) ? ", 'utc'" : ''
        const v = this._appendSql(valueSource, params, false)
        // The 'subsec' modifier on unixepoch() was added in SQLite 3.42; older versions
        // need to go through julianday() arithmetic to preserve sub-second precision
        if (this._connectionConfiguration.compatibilityVersion >= 3_042_000) {
            return 'round(unixepoch(' + v + modifier + ", 'subsec') * 1000)"
        }
        return 'round((julianday(' + v + modifier + ') - 2440587.5) * 86400000.0)'
    }
    override _getFullYear(params: any[], valueSource: ToSql): string {
        return "cast(strftime('%Y', " + this._dateFunctionArgument(params, valueSource) + ") as integer)"
    }
    override _getMonth(params: any[], valueSource: ToSql): string {
        return "cast(strftime('%m', " + this._dateFunctionArgument(params, valueSource) + ") as integer) - 1"
    }
    override _getDay(params: any[], valueSource: ToSql): string {
        return "cast(strftime('%w'," + this._dateFunctionArgument(params, valueSource) + ") as integer)"
    }
    override _getHours(params: any[], valueSource: ToSql): string {
        return "cast(strftime('%H', " + this._dateFunctionArgument(params, valueSource) + ") as integer)"
    }
    override _getMinutes(params: any[], valueSource: ToSql): string {
        return "cast(strftime('%M', " + this._dateFunctionArgument(params, valueSource) + ") as integer)"
    }
    override _getSeconds(params: any[], valueSource: ToSql): string {
        return "cast(strftime('%S', " + this._dateFunctionArgument(params, valueSource) + ") as integer)"
    }
    override _getMilliseconds(params: any[], valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return '0'
        } else if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time milliseconds as integer') {
            return this._unixMillisecondsAsMilliseconds(this._appendSql(valueSource, params, false))
        }
        // `strftime('%f', …)` yields the STRING '01.001', which coerces to a REAL: times
        // 1000 that is 1000.9999999999999, and SQLite's `%` truncates its operands to
        // integer, so the milliseconds wrapped to 0. Rounding the REAL back to its exact
        // integer first is what the other branches get for free from their integer operand.
        // The error only hit ms values whose binade makes the product fall short — 372 of
        // the 60000 (second, millisecond) pairs, all at powers of two.
        return "cast(round(strftime('%f', " + this._appendSql(valueSource, params, false) + ") * 1000) as integer) % 1000"
    }
    /** In a canonical text variant a computed customDecimal is stored in its canonical text */
    override _appendValueForColumn(column: DBColumn, value: any, params: any[], forceTypeCast: boolean): string {
        const sql = super._appendValueForColumn(column, value, params, forceTypeCast)
        if (hasToSql(value) && this._isCanonicalDecimalText() && this._isCustomDecimal(column)) {
            return this._canonicalDecimalSql(value, sql)
        }
        return sql
    }
    override _appendParam(value: any, params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (__isDecimalCategory(columnType) && typeof value === 'string' && this._isCanonicalDecimalText()) {
            // In a canonical text variant a customDecimal is sent in its canonical text
            value = canonicalDecimalText(value)
        }
        if (__isUuidValueType(columnType) && this._getUuidStrategy() === 'uuid-extension') {
            return 'uuid_blob(' + super._appendParam(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast) + ')'
        }
        return super._appendParam(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
    }
    override _appendColumnValue(value: AnyValueSource, params: any[], isOutermostQuery: boolean): string {
        if (this._isCustomDecimal(value) && this._isCanonicalDecimalText()) {
            // In a canonical text variant a column of a select gives the canonical text of a computed customDecimal
            return this._canonicalDecimalSql(value, this._appendSql(value, params, false))
        }
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
                return 'json_group_array(' + distict + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, 'uuid_str(' + this._appendSql(aggregatedArrayColumns, params, false) + ')') + ')'
            }
            if (this._isCustomDecimal(aggregatedArrayColumns) && (aggregatedArrayDistinct || this._isCanonicalDecimalText())) {
                // The distinct values of a customDecimal are the distinct numbers, each in its normal form; in a
                // canonical text variant every value goes in its canonical text
                return 'json_group_array(' + distict + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, this._decimalComparableText(aggregatedArrayColumns, this._appendSql(aggregatedArrayColumns, params, false))) + ')'
            }
            return 'json_group_array(' + distict + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, this._appendSql(aggregatedArrayColumns, params, false)) + ')'
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
                    result += this._appendAggregatedArrayValueProjection(column, 'uuid_str(' + this._appendSql(column, params, false) + ')')
                } else if (this._isCustomDecimal(column) && (aggregatedArrayDistinct || this._isCanonicalDecimalText())) {
                    result += this._appendAggregatedArrayValueProjection(column, this._decimalComparableText(column, this._appendSql(column, params, false)))
                } else {
                    result += this._appendAggregatedArrayValueProjection(column, this._appendSql(column, params, false))
                }
            }

            return 'json_group_array(' + distict + 'json_object(' + result + '))'
        }
    }
    override _appendAggragateArrayWrappedColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, _params: any[], aggregateId: number): string {
        if (isValueSource(aggregatedArrayColumns)) {
            if (__isUuidValueSource(__getValueSourcePrivate(aggregatedArrayColumns)) && this._getUuidStrategy() === 'uuid-extension') {
                return 'json_group_array(' + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, 'uuid_str(a_' + aggregateId + '_.result)') + ')'
            }
            return 'json_group_array(' + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, 'a_' + aggregateId + '_.result') + ')'
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
                    result += this._appendAggregatedArrayValueProjection(column, 'uuid_str(a_' + aggregateId + '_.' + this._escape(prop, true) + ')')
                } else {
                    result += this._appendAggregatedArrayValueProjection(column, 'a_' + aggregateId + '_.' + this._escape(prop, true))
                }
            }

            return 'json_group_array(json_object(' + result + '))'
        }
    }
}

function isLocalTextFormat(format: SqliteDateTimeFormat): boolean {
    return format === 'localdate seconds as text' || format === 'localdate milliseconds as text'
        || format === 'localdate seconds as text using T separator' || format === 'localdate milliseconds as text using T separator'
}
