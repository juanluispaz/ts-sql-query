import type { PlainTemporalFields } from '../utils/plainTemporalFields.js'
import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { ToSql, SelectData, InsertData, UpdateData, FlatQueryColumns, OrderByEntry, PlainSelectData, CompoundSelectData } from './SqlBuilder.js'
import { flattenQueryColumns, getQueryColumn, hasToSql } from './SqlBuilder.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import { AbstractSqlBuilder, ZonedTextInstantOperand, __zonedTextInstantValue, type PlainTemporalDifferenceSql, type SelectColumnSql } from './AbstractSqlBuilder.js'
import type { DBColumn } from '../utils/Column.js'
import type { SqliteDateTimeFormat, SqliteDateTimeFormatType, SqliteDecimalStrategy } from '../connections/SqliteConfiguration.js'
import type { AnyTableOrView } from '../utils/ITableOrView.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { __isConst, __isFragment, __isInlineSelect, __isTableOrViewRawFragment, __isColumn, __asNodeValueSource, isValueSource } from '../typeSystem/valueSourceFactory.js'
import { __isExactDecimalSql, __sqlFamilyOf, __valueSourceTypeNameOf } from '../typeSystem/dataTypes.js'
import { isSqliteReservedWord } from '../utils/sqlite/sqliteReservedWords.js'
import type { AnyValueSource, __AggregatedArrayColumns } from '../typeSystem/valueSource.js'
import { __isLocalDateTimeValueSource, __isLocalDateValueSource, __isLocalTimeValueSource, __isUuidValueSource } from '../typeSystem/valueSource.js'
import { __classOf } from '../nodes/adaptedTypeClass.js'
import { isPlainTemporalClass } from '../utils/plainTemporalValues.js'
import { sqliteOperationsThatNeedParenthesis } from '../utils/sqlite/sqliteOperationsThatNeedParenthesis.js'
import { __registeredDataType } from '../typeSystem/dataTypeRegistry.js'
import { isZeroDuration } from '../utils/durationValues.js'
import { __arithmeticOperandClassOf, __valueOperandClassOf } from '../typeSystem/dataTypeClasses.js'

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
    override _operationsThatNeedParenthesis = sqliteOperationsThatNeedParenthesis
    _getDateTimeFormat(type: SqliteDateTimeFormatType): SqliteDateTimeFormat {
        return this._connectionConfiguration.getDateTimeFormat!(type) as any
    }
    _getUuidStrategy(): 'string' | 'uuid-extension' {
        // 'string as sent' stores a uuid as 'string' does; only the connection reads it otherwise
        const strategy = this._connectionConfiguration.uuidStrategy
        return strategy === 'string as sent' ? 'string' : strategy as any || 'uuid-extension'
    }
    /** How an exact decimal is computed and compared (`decimalStrategy`) */
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
     * A canonical text variant: the library writes every exact decimal in its canonical text (see canonicalDecimalText)
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
     * With 'decimal-functions' and its canonical variant, an exact decimal is compared by its key (tsq_decimal_key),
     * whose text order is the order of the numbers and which is the same for 1.5 and 1.50, so an index on
     * tsq_decimal_key(column) serves every comparison
     */
    _decimalKeySql(sql: string): string {
        return 'tsq_decimal_key(' + sql + ')'
    }
    /** A comparison of an exact decimal value source with a value, as numbers: by their keys, or by decimal_cmp */
    _decimalOrderComparison(operator: '<' | '>' | '<=' | '>=', context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._usesDecimalKeyFunctions()) {
            return this._decimalKeySql(this._appendSql(valueSource, context, false)) + ' ' + operator + ' ' + this._decimalKeySql(this._appendValue(value, context, typeClass, false))
        }
        return this._decimalCompare(context, valueSource, value, typeClass) + ' ' + operator + ' 0'
    }
    /**
     * With the decimal strategies 'text' and 'canonical text', SQLite computes with a text in floating point, so no
     * arithmetic of an exact decimal is exact: the query is rejected instead of writing a result that has lost digits
     */
    _rejectDecimalArithmeticAsText(operation: string): never {
        throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, 'The ' + operation + ' of a decimal is not exact with the decimal strategy \'' + this._getDecimalStrategy() + '\' of SQLite: use a decimal strategy with functions, like \'decimal-extension and tsq-functions with canonical text\'')
    }
    /**
     * An exact decimal whose text is canonical in a canonical text variant: a column (stored so), a constant or a value
     * (sent so), or the value of a query (whose select list gives it so). Any other expression (a computation, a
     * fragment) may give another text of the same number
     */
    _isCanonicalDecimalSource(value: unknown): boolean {
        return !isValueSource(value) || __isColumn(value) || __isConst(value) || __isInlineSelect(value)
    }
    /**
     * In a canonical text variant, the SQL of an exact decimal turned into its canonical text when it may not be, the
     * expression computed once, in a subquery; otherwise the SQL as it is. The result of a function of the decimal
     * extension or of the library has no zeros before its integer part, so only the zeros at the end of its fraction and
     * the sign of a zero go; a fragment can be any text, which gets its normal form. Only a text is turned: anything
     * else (a floating point number) reaches the reading of the value as it is, which rejects it
     */
    _canonicalDecimalSql(value: unknown, sql: string): string {
        if (!this._isCanonicalDecimalText() || this._isCanonicalDecimalSource(value)) {
            return sql
        }
        if (__isFragment(value) || __isTableOrViewRawFragment(value)) {
            return "(select case when typeof(tsq_v) = 'text' and tsq_v not glob '*[^0-9.-]*' then " + this._decimalNormalForm('tsq_v') + ' else tsq_v end from (select ' + sql + ' as tsq_v))'
        }
        return "(select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select " + sql + ' as tsq_v))'
    }
    /**
     * A text of an exact decimal that is the same for the values equal as numbers: in a canonical text variant, the
     * canonical text (the SQL as it is for a column, a constant or a value); otherwise, the normal form
     */
    _decimalComparableText(value: unknown, sql: string): string {
        if (this._isCanonicalDecimalText()) {
            return this._canonicalDecimalSql(value, sql)
        }
        return this._decimalNormalForm(sql)
    }
    _isCustomDecimal(value: unknown): boolean {
        return isValueSource(value) && __isExactDecimalSql(__classOf(__asNodeValueSource(value)))
    }
    /** A value that can be null: a value source that isn't required, or a null */
    _canBeNull(value: unknown): boolean {
        if (isValueSource(value)) {
            return __asNodeValueSource(value).__optionalType !== 'required'
        }
        return value === null || value === undefined
    }
    /**
     * The parts of the text of an exact decimal, written in SQL over the SQL of the value (repeated, so a value
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
     * The parts of a canonical text of an exact decimal (see canonicalDecimalText), shorter to compute: its significant
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
    /** The text of the number of an exact decimal, the same for the values equal as numbers: `001.50` is `1.5`, `-0.00` is `0` */
    _decimalNormalForm(sql: string): string {
        const parts = this._decimalParts(sql)
        return '(case when ' + sql + ' is null then null when ' + parts.digits + " = '' then '0' else (case when " + parts.negative + " then '-' else '' end) || (case when " + parts.integer + " = '' then '0' else " + parts.integer + " end) || (case when " + parts.fraction + " <> '' then '.' || " + parts.fraction + " else '' end) end)"
    }
    /** -1, 0 or 1 by the sign of the number of an exact decimal; null for a null */
    _decimalSign(sql: string): string {
        const parts = this._decimalParts(sql)
        return '(case when ' + sql + ' is null then null when ' + parts.digits + " = '' then 0 when " + parts.negative + ' then -1 else 1 end)'
    }
    /**
     * -1, 0 or 1 as the number of the first exact decimal is less, equal or greater than the second one; null when one
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
     * The terms that order an exact decimal as the numbers, in SQL: by the sign, then the place of the point and the
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
     * The smallest or the largest exact decimal of the group, with its text, in SQL: each value gets a key made of the
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
    _decimalFunction(functionName: string, context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        let nullCheck = ''
        if (this._canBeNull(valueSource)) {
            nullCheck = this._appendSql(valueSource, context, false) + ' is null'
        }
        if (this._canBeNull(value) && hasToSql(value)) {
            const valueCheck = this._appendValue(value, context, typeClass, false) + ' is null'
            if (valueCheck !== nullCheck) {
                nullCheck += (nullCheck ? ' or ' : '') + valueCheck
            }
        }
        const call = functionName + '(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, typeClass, false) + ')'
        if (nullCheck) {
            return 'case when ' + nullCheck + ' then null else ' + call + ' end'
        }
        return call
    }
    /**
     * The smaller or the larger of two exact decimal values, compared as numbers; null when one is null, as min and
     * max of two values in SQLite
     */
    _decimalChoice(comparison: '<=' | '>=', context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const first = this._appendSql(valueSource, context, false)
        const second = this._appendValue(value, context, typeClass, false)
        let nullCheck = ''
        if (this._canBeNull(valueSource)) {
            nullCheck = first + ' is null'
        }
        if (this._canBeNull(value) && hasToSql(value) && second !== first) {
            nullCheck += (nullCheck ? ' or ' : '') + second + ' is null'
        }
        return 'case ' + (nullCheck ? 'when ' + nullCheck + ' then null ' : '') + 'when ' + this._decimalCmpSql(first, second) + ' ' + comparison + ' 0 then ' + first + ' else ' + second + ' end'
    }
    /** -1, 0 or 1 as the exact decimal value source is less, equal or greater than the value, compared as numbers */
    _decimalCompare(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return this._decimalCmpSql(this._appendSql(valueSource, context, false), this._appendValue(value, context, typeClass, false))
    }
    /**
     * Whether two exact decimal values are the same number: with the decimal extension's functions, by decimal_cmp;
     * with the decimal strategy 'text', by their normal forms (`1.5` and `1.50` are the same)
     */
    _decimalEquality(operator: '=' | '<>', context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._usesDecimalKeyFunctions() && !this._isCanonicalDecimalText()) {
            return this._decimalKeySql(this._appendSql(valueSource, context, false)) + ' ' + operator + ' ' + this._decimalKeySql(this._appendValue(value, context, typeClass, false))
        }
        if (this._usesDecimalExtensionFunctions() && !this._isCanonicalDecimalText()) {
            return this._decimalCompare(context, valueSource, value, typeClass) + ' ' + operator + ' 0'
        }
        return this._decimalComparableText(valueSource, this._appendSql(valueSource, context, false)) + ' ' + operator + ' ' + this._decimalComparableText(value, this._appendValue(value, context, typeClass, false))
    }
    override _equals(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (__isExactDecimalSql(typeClass)) {
            return this._decimalEquality('=', context, valueSource, value, typeClass)
        }
        return super._equals(context, valueSource, value, typeClass)
    }
    override _notEquals(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (__isExactDecimalSql(typeClass)) {
            return this._decimalEquality('<>', context, valueSource, value, typeClass)
        }
        return super._notEquals(context, valueSource, value, typeClass)
    }
    override _lessThan(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (__isExactDecimalSql(typeClass)) {
            return this._decimalOrderComparison('<', context, valueSource, value, typeClass)
        }
        return super._lessThan(context, valueSource, value, typeClass)
    }
    override _greaterThan(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (__isExactDecimalSql(typeClass)) {
            return this._decimalOrderComparison('>', context, valueSource, value, typeClass)
        }
        return super._greaterThan(context, valueSource, value, typeClass)
    }
    override _lessOrEqual(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (__isExactDecimalSql(typeClass)) {
            return this._decimalOrderComparison('<=', context, valueSource, value, typeClass)
        }
        return super._lessOrEqual(context, valueSource, value, typeClass)
    }
    override _greaterOrEqual(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (__isExactDecimalSql(typeClass)) {
            return this._decimalOrderComparison('>=', context, valueSource, value, typeClass)
        }
        return super._greaterOrEqual(context, valueSource, value, typeClass)
    }
    /**
     * An exact decimal in a list or in the values of a query, compared as numbers. A list: with the decimal extension's
     * functions, one decimal_cmp per value; otherwise, by the normal forms. A query: its values in their normal form,
     * through a with that names its only column whatever its name is
     */
    _decimalIn(not: boolean, context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string | undefined {
        if (Array.isArray(value)) {
            if (value.length <= 0) {
                return undefined
            }
            const first = this._appendSql(valueSource, context, false)
            if (this._usesDecimalKeyFunctions() && !this._isCanonicalDecimalText()) {
                return this._decimalKeySql(first) + (not ? ' not in (' : ' in (') + value.map(item => this._decimalKeySql(this._appendValue(item, context, typeClass, false))).join(', ') + ')'
            }
            if (this._usesDecimalExtensionFunctions() && !this._isCanonicalDecimalText()) {
                return '(' + value.map(item => this._decimalCmpSql(first, this._appendValue(item, context, typeClass, false)) + (not ? ' <> 0' : ' = 0')).join(not ? ' and ' : ' or ') + ')'
            }
            return this._decimalComparableText(valueSource, first) + (not ? ' not in (' : ' in (') + value.map(item => this._decimalComparableText(item, this._appendValue(item, context, typeClass, false))).join(', ') + ')'
        }
        if (hasToSql(value) && this._isCanonicalDecimalText()) {
            // The select list of the query gives the canonical texts
            return this._decimalComparableText(valueSource, this._appendSql(valueSource, context, false)) + (not ? ' not in ' : ' in ') + '(' + this._appendSql(value, context, false) + ')'
        }
        if (hasToSql(value) && this._usesDecimalKeyFunctions()) {
            const alias = 'q_' + context.generateUnique() + '_'
            return this._decimalKeySql(this._appendSql(valueSource, context, false)) + (not ? ' not in ' : ' in ') + '(with ' + alias + '(v) as (' + this._appendSql(value, context, false) + ') select ' + this._decimalKeySql(alias + '.v') + ' from ' + alias + ')'
        }
        if (hasToSql(value)) {
            const alias = 'q_' + context.generateUnique() + '_'
            return this._decimalNormalForm(this._appendSql(valueSource, context, false)) + (not ? ' not in ' : ' in ') + '(with ' + alias + '(v) as (' + this._appendSql(value, context, false) + ') select ' + this._decimalNormalForm(alias + '.v') + ' from ' + alias + ')'
        }
        return undefined
    }
    override _in(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (__isExactDecimalSql(typeClass)) {
            const result = this._decimalIn(false, context, valueSource, value, typeClass)
            if (result !== undefined) {
                return result
            }
        }
        return super._in(context, valueSource, value, typeClass)
    }
    override _notIn(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (__isExactDecimalSql(typeClass)) {
            const result = this._decimalIn(true, context, valueSource, value, typeClass)
            if (result !== undefined) {
                return result
            }
        }
        return super._notIn(context, valueSource, value, typeClass)
    }
    override _between(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, typeClass: DataTypeClass): string {
        if (__isExactDecimalSql(typeClass) && this._usesDecimalKeyFunctions()) {
            return this._decimalKeySql(this._appendSql(valueSource, context, false)) + ' between ' + this._decimalKeySql(this._appendValue(value, context, typeClass, false)) + ' and ' + this._decimalKeySql(this._appendValue(value2, context, typeClass, false))
        }
        if (__isExactDecimalSql(typeClass)) {
            const first = this._appendSql(valueSource, context, false)
            return '(' + this._decimalCmpSql(first, this._appendValue(value, context, typeClass, false)) + ' >= 0 and ' + this._decimalCmpSql(first, this._appendValue(value2, context, typeClass, false)) + ' <= 0)'
        }
        return super._between(context, valueSource, value, value2, typeClass)
    }
    override _notBetween(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, typeClass: DataTypeClass): string {
        if (__isExactDecimalSql(typeClass) && this._usesDecimalKeyFunctions()) {
            return this._decimalKeySql(this._appendSql(valueSource, context, false)) + ' not between ' + this._decimalKeySql(this._appendValue(value, context, typeClass, false)) + ' and ' + this._decimalKeySql(this._appendValue(value2, context, typeClass, false))
        }
        if (__isExactDecimalSql(typeClass)) {
            const first = this._appendSql(valueSource, context, false)
            return 'not (' + this._decimalCmpSql(first, this._appendValue(value, context, typeClass, false)) + ' >= 0 and ' + this._decimalCmpSql(first, this._appendValue(value2, context, typeClass, false)) + ' <= 0)'
        }
        return super._notBetween(context, valueSource, value, value2, typeClass)
    }
    override _add(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (__isExactDecimalSql(typeClass) && !this._usesDecimalExtensionFunctions()) {
            this._rejectDecimalArithmeticAsText('addition')
        }
        if (__isExactDecimalSql(typeClass) && this._usesDecimalExtensionFunctions()) {
            return this._decimalFunction('decimal_add', context, valueSource, value, typeClass)
        }
        return super._add(context, valueSource, value, typeClass)
    }
    override _subtract(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (__isExactDecimalSql(typeClass) && !this._usesDecimalExtensionFunctions()) {
            this._rejectDecimalArithmeticAsText('subtraction')
        }
        if (__isExactDecimalSql(typeClass) && this._usesDecimalExtensionFunctions()) {
            return this._decimalFunction('decimal_sub', context, valueSource, value, typeClass)
        }
        return super._subtract(context, valueSource, value, typeClass)
    }
    override _multiply(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (__isExactDecimalSql(typeClass) && !this._usesDecimalExtensionFunctions()) {
            this._rejectDecimalArithmeticAsText('multiplication')
        }
        if (__isExactDecimalSql(typeClass) && this._usesDecimalExtensionFunctions()) {
            // decimal_mul returns null for a null operand
            return 'decimal_mul(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, typeClass, false) + ')'
        }
        return super._multiply(context, valueSource, value, typeClass)
    }
    /**
     * decimal_sum of the extension gives 0 when every value is null, where sum gives null as on the other databases:
     * without a value counted, the sum is null
     */
    override _sum(context: SqlBuildContext, value: any): string {
        if (this._isCustomDecimal(value) && !this._usesDecimalExtensionFunctions()) {
            this._rejectDecimalArithmeticAsText('sum')
        }
        if (this._isCustomDecimal(value) && this._usesDecimalExtensionFunctions()) {
            return 'case when count(' + this._appendSql(value, context, false) + ') = 0 then null else decimal_sum(' + this._appendSql(value, context, false) + ') end'
        }
        return super._sum(context, value)
    }
    /** The distinct values of an exact decimal are the distinct numbers: their normal forms (`1.5` and `1.50` are one) */
    override _sumDistinct(context: SqlBuildContext, value: any): string {
        if (this._isCustomDecimal(value) && !this._usesDecimalExtensionFunctions()) {
            this._rejectDecimalArithmeticAsText('sum')
        }
        if (this._isCustomDecimal(value) && this._usesDecimalExtensionFunctions()) {
            const sql = this._appendSql(value, context, false)
            return 'case when count(' + sql + ') = 0 then null else decimal_sum(distinct ' + this._decimalComparableText(value, sql) + ') end'
        }
        return super._sumDistinct(context, value)
    }
    override _countDistinct(context: SqlBuildContext, value: any): string {
        if (this._isCustomDecimal(value)) {
            return 'count(distinct ' + this._decimalGroupingKeySql(value, this._appendSql(value, context, false)) + ')'
        }
        return super._countDistinct(context, value)
    }
    override _averageDistinct(context: SqlBuildContext, value: any): string {
        if (this._isCustomDecimal(value)) {
            // avg reads the text of each distinct number as a number
            return 'avg(distinct ' + this._decimalComparableText(value, this._appendSql(value, context, false)) + ')'
        }
        return super._averageDistinct(context, value)
    }
    /** The order by names an exact decimal, which is ordered by expressions of it */
    _isDecimalOrderByEntry(entry: OrderByEntry, query: SelectData): boolean {
        const expression = entry.expression
        const column = typeof expression === 'string' ? getQueryColumn(query.__columns, expression) : expression
        return this._isCustomDecimal(column)
    }
    /** With the decimal strategy 'decimal-functions', an exact decimal is ordered by its key, whose text orders as the number does */
    override _appendOrderByColumnAlias(entry: OrderByEntry, query: SelectData, context: SqlBuildContext): string {
        if (context.orderByDecimalAsReal || !this._usesDecimalKeyFunctions() || !this._isDecimalOrderByEntry(entry, query)) {
            return super._appendOrderByColumnAlias(entry, query, context)
        }
        context.orderByDecimalAsReal = true
        try {
            return 'tsq_decimal_key(' + this._appendOrderByColumnForExpression(entry, query, context) + ')'
        } finally {
            context.orderByDecimalAsReal = false
        }
    }
    /**
     * Without the functions of the library for the order, an exact decimal is ordered as the number by terms
     * written in SQL (see _decimalOrderByTerms), the ordering of the entry applied to them
     */
    override _appendOrderByEntryTerms(entry: OrderByEntry, query: SelectData, context: SqlBuildContext): string | undefined {
        if (context.orderByDecimalAsReal || this._usesDecimalKeyFunctions() || !this._isDecimalOrderByEntry(entry, query)) {
            return undefined
        }
        const order = entry.order || ''
        if (order && !/^(asc|desc)?( nulls (first|last))?( insensitive)?$|^insensitive$/.test(order)) {
            return undefined
        }
        const nulls = order.includes('nulls first') ? ' nulls first' : order.includes('nulls last') ? ' nulls last' : ''
        context.orderByDecimalAsReal = true
        try {
            // In a canonical text variant the text ordered is canonical: a column of the select list, a column, a
            // constant or a value
            const expression = entry.expression
            const canonical = this._isCanonicalDecimalText() && (typeof expression === 'string' || this._isCanonicalDecimalSource(expression))
            return this._decimalOrderByTerms(this._appendOrderByColumnForExpression(entry, query, context), order.startsWith('desc'), nulls, canonical)
        } finally {
            context.orderByDecimalAsReal = false
        }
    }
    /** A compound query can only order by its columns: an expression of an exact decimal goes over a query that wraps it */
    override _needsCompoundOrderByWrap(query: SelectData): boolean {
        if (super._needsCompoundOrderByWrap(query)) {
            return true
        }
        return query.__type === 'compound' && !!query.__orderBy && query.__orderBy.some(entry => this._isDecimalOrderByEntry(entry, query))
    }
    /**
     * min and max of an exact decimal compare the numbers: with the decimal strategy 'decimal-functions', the aggregates
     * of the library; otherwise in SQL (see _decimalMinOrMax)
     */
    override _min(context: SqlBuildContext, value: any): string {
        if (this._isCustomDecimal(value)) {
            if (this._usesDecimalKeyFunctions()) {
                return 'tsq_decimal_min(' + this._appendSql(value, context, false) + ')'
            }
            return this._decimalMinOrMax('min', this._appendSql(value, context, false), this._isCanonicalDecimalText() && this._isCanonicalDecimalSource(value))
        }
        return super._min(context, value)
    }
    override _max(context: SqlBuildContext, value: any): string {
        if (this._isCustomDecimal(value)) {
            if (this._usesDecimalKeyFunctions()) {
                return 'tsq_decimal_max(' + this._appendSql(value, context, false) + ')'
            }
            return this._decimalMinOrMax('max', this._appendSql(value, context, false), this._isCanonicalDecimalText() && this._isCanonicalDecimalSource(value))
        }
        return super._max(context, value)
    }
    /**
     * With the decimal extension's functions, `is` and `is not` of an exact decimal compare the numbers: equal when both
     * are null or decimal_cmp gives 0 (decimal_cmp is null when one is null)
     */
    _decimalIs(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const first = this._appendSql(valueSource, context, false)
        const second = this._appendValue(value, context, typeClass, false)
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
     * A union, an intersect or an except of queries with an exact decimal column takes the values equal as numbers
     * (`1.5` and `1.50`) as the same: the rows are compared by the grouping key of each exact decimal (see
     * _decimalGroupingKey), and each group of equal rows gives one of them
     */
    override _buildCompoundCore(query: CompoundSelectData, context: SqlBuildContext, columnsForInsert: { [name: string]: DBColumn | undefined }, isOutermostQuery: boolean): string {
        const operator = query.__compoundOperator
        const removesDuplicates = operator === 'union' || operator === 'intersect' || operator === 'except' || operator === 'minus'
        if (!removesDuplicates || this._isCanonicalDecimalText()) {
            // In a canonical text variant each select list gives the canonical texts, which the operator compares
            return super._buildCompoundCore(query, context, columnsForInsert, isOutermostQuery)
        }
        const columns: FlatQueryColumns = {}
        flattenQueryColumns(query.__columns, columns, '')
        let hasDecimal = false
        for (const property in columns) {
            hasDecimal = hasDecimal || this._isCustomDecimal(columns[property])
        }
        if (!hasDecimal) {
            return super._buildCompoundCore(query, context, columnsForInsert, isOutermostQuery)
        }
        const firstAlias = 'c_' + context.generateUnique() + '_'
        const key = (property: string, alias: string) => {
            const column = alias + '.' + this._appendColumnAlias(property, context)
            return this._isCustomDecimal(columns[property]) ? this._decimalGroupingKeySql(undefined, column) : column
        }
        let selectColumns = ''
        let groupBy = ''
        for (const property in columns) {
            selectColumns += (selectColumns ? ', ' : '') + firstAlias + '.' + this._appendColumnAlias(property, context) + ' as ' + this._appendColumnAlias(property, context)
            groupBy += (groupBy ? ', ' : '') + key(property, firstAlias)
        }
        if (this._hasCustomizedColumns(query)) {
            // A customization adds columns of its own: every column is passed on; the rows are compared by the columns of
            // the select
            selectColumns = firstAlias + '.*'
        }
        if (operator === 'union') {
            const first = this._buildSelectWithColumnsInfoForCompound(query.__firstQuery, context, columnsForInsert, isOutermostQuery, this._compoundOperandNeedsGrouping(query.__firstQuery, 'first', 'unionAll'))
            const second = this._buildSelectWithColumnsInfoForCompound(query.__secondQuery, context, columnsForInsert, isOutermostQuery, this._compoundOperandNeedsGrouping(query.__secondQuery, 'second', 'unionAll'))
            return 'select ' + selectColumns + ' from (' + first + ' union all ' + second + ') as ' + firstAlias + ' group by ' + groupBy
        }
        const secondAlias = 'c_' + context.generateUnique() + '_'
        const first = this._buildSelectWithColumnsInfo(query.__firstQuery, context, columnsForInsert, isOutermostQuery)
        const second = this._buildSelectWithColumnsInfo(query.__secondQuery, context, columnsForInsert, isOutermostQuery)
        let sameRow = ''
        for (const property in columns) {
            sameRow += (sameRow ? ' and ' : '') + key(property, firstAlias) + ' is ' + key(property, secondAlias)
        }
        return 'select ' + selectColumns + ' from (' + first + ') as ' + firstAlias + ' where ' + (operator === 'intersect' ? '' : 'not ') + 'exists (select 1 from (' + second + ') as ' + secondAlias + ' where ' + sameRow + ') group by ' + groupBy
    }
    /**
     * abs, ceil, floor, round, roundn and modulo of an exact decimal: with the strategies with functions, the functions
     * of the library (tsq_), which the decimal extension doesn't have; abs, without functions of the library, without
     * the minus sign of the text; with 'text' and 'canonical text' no other emission is exact
     */
    _decimalOperationNotExact(operation: string): never {
        throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, 'The ' + operation + ' of a decimal is not exact with the decimal strategy \'' + this._getDecimalStrategy() + '\' of SQLite: use a decimal strategy with functions, like \'decimal-extension and tsq-functions with canonical text\'')
    }
    override _abs(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._isCustomDecimal(valueSource)) {
            if (this._usesDecimalKeyFunctions()) {
                return 'tsq_decimal_abs(' + this._appendSql(valueSource, context, false) + ')'
            }
            // The text without its minus sign, which keeps its digits and its scale; a null stays null
            const value = this._appendSql(valueSource, context, false)
            return "(case when substr(" + value + ", 1, 1) = '-' then substr(" + value + ', 2) else ' + value + ' end)'
        }
        return super._abs(context, valueSource)
    }
    override _ceil(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._isCustomDecimal(valueSource)) {
            if (!this._usesDecimalExtensionFunctions()) {
                this._decimalOperationNotExact('ceiling')
            }
            return 'tsq_decimal_ceil(' + this._appendSql(valueSource, context, false) + ')'
        }
        return super._ceil(context, valueSource)
    }
    override _floor(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._isCustomDecimal(valueSource)) {
            if (!this._usesDecimalExtensionFunctions()) {
                this._decimalOperationNotExact('floor')
            }
            return 'tsq_decimal_floor(' + this._appendSql(valueSource, context, false) + ')'
        }
        return super._floor(context, valueSource)
    }
    override _round(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._isCustomDecimal(valueSource)) {
            if (!this._usesDecimalExtensionFunctions()) {
                this._decimalOperationNotExact('rounding')
            }
            return 'tsq_decimal_round(' + this._appendSql(valueSource, context, false) + ', 0)'
        }
        return super._round(context, valueSource)
    }
    // SQLite truncates a fractional scale of round
    override _roundnTruncatesTheScale = true
    override _roundn(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (__isExactDecimalSql(typeClass)) {
            if (!this._usesDecimalExtensionFunctions()) {
                this._decimalOperationNotExact('rounding')
            }
            return 'tsq_decimal_round(' + this._appendSql(valueSource, context, false) + ', ' + this._appendRoundnScale(value, context, typeClass) + ')'
        }
        return super._roundn(context, valueSource, value, typeClass)
    }
    override _modulo(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (__isExactDecimalSql(typeClass)) {
            if (!this._usesDecimalExtensionFunctions()) {
                this._decimalOperationNotExact('modulo')
            }
            return 'tsq_decimal_mod(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, typeClass, false) + ')'
        }
        return super._modulo(context, valueSource, value, typeClass)
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
        // `_epochMilliseconds` already does with the same expression.
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
     * second), so the fallback divides by a REAL literal and floors; its milliseconds follow as a modifier of seconds
     * where they count (keepFraction), not for a part of the date or of the time.
     */
    _unixMillisecondsAsDateTimeArgument(sql: string, keepFraction: boolean): string {
        if (this._connectionConfiguration.compatibilityVersion >= 3_042_000) {
            return sql + " / 1000.0, 'unixepoch', 'subsec'"
        }
        if (!keepFraction) {
            return 'cast(floor(' + sql + " / 1000.0) as integer), 'unixepoch'"
        }
        return 'cast(floor(' + sql + " / 1000.0) as integer), 'unixepoch', (" + this._unixMillisecondsAsMilliseconds(sql) + " / 1000.0) || ' seconds'"
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
            const nodeValueSource = __asNodeValueSource(valueSource)
            if (__isLocalDateValueSource(nodeValueSource)) {
                return this._getDateTimeFormat('date')
            } else if (__isLocalTimeValueSource(nodeValueSource)) {
                return this._getDateTimeFormat('time')
            } else if (__isLocalDateTimeValueSource(nodeValueSource)) {
                return this._getDateTimeFormat('dateTime')
            } else {
                throw new TsSqlProcessingError({ reason: 'UNKNOWN_DATA_TYPE', typeName: __valueSourceTypeNameOf(nodeValueSource) }, 'Unknown date type: ' + __valueSourceTypeNameOf(nodeValueSource))
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
     *
     * A Unix time in milliseconds of an older SQLite gives its milliseconds only where they count (keepFraction): not
     * to take a part of the date or of the time.
     */
    _dateFunctionArgument(context: SqlBuildContext, valueSource: ToSql, keepFraction: boolean = true): string {
        const format = this._getValueSourceDateTimeFormat(valueSource)
        const isTime = isValueSource(valueSource) && __isLocalTimeValueSource(__asNodeValueSource(valueSource))
        const isDate = isValueSource(valueSource) && __isLocalDateValueSource(__asNodeValueSource(valueSource))
        // A Temporal value without zone has no zone to take it to: its digits are the ones it has
        const inApplicationZone = !!this._connectionConfiguration.sqliteRunsInApplicationTimeZone
            && !isDate
            && !isLocalTextFormat(format)
            && !(isValueSource(valueSource) && isPlainTemporalClass(__classOf(__asNodeValueSource(valueSource))))
        const modifier = inApplicationZone ? ", 'localtime'" : ''
        switch (format) {
            case 'Unix time seconds as integer':
                return this._appendSql(valueSource, context, false) + ", 'unixepoch'" + modifier
            case 'Unix time milliseconds as integer':
                return this._unixMillisecondsAsDateTimeArgument(this._appendSql(valueSource, context, false), keepFraction) + modifier
            case 'Julian day as real number':
                if (isTime) {
                    return this._appendSqlParenthesis(valueSource, context, false) + ' + 2440587.5' + modifier
                }
                return this._appendSql(valueSource, context, false) + modifier
            default:
                if (isTime && inApplicationZone) {
                    return "'1970-01-01 ' || " + this._appendSqlParenthesis(valueSource, context, false) + modifier
                }
                return this._appendSql(valueSource, context, false) + modifier
        }
    }
    override _appendGroupBySelectColumn(entry: AnyValueSource, selectColumn: SelectColumnSql, _context: SqlBuildContext, _isOutermostQuery: boolean): string {
        // The same SQL as the select list: a numbered placeholder (?1) can be repeated, and it is the same expression; in
        // a canonical text variant the select list already gives the canonical text
        if (this._isCanonicalDecimalText()) {
            return selectColumn.sql
        }
        return this._decimalGroupingKey(entry, selectColumn.sql)
    }
    /**
     * The values of an exact decimal are grouped by the number they are (`1.5` with `1.50`): in a canonical text variant,
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
     * A distinct select of groups (a group by or an aggregate) with an exact decimal column would compare the texts of
     * the rows it gives, where `1.5` and `1.50` are different: no emission of SQLite removes them as numbers there,
     * unless the texts are canonical
     */
    _rejectDistinctDecimalOfGroups(): never {
        throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, 'A distinct select with an exact decimal column and a group by or an aggregate is not exact in SQLite with the decimal strategy \'' + this._getDecimalStrategy() + '\': use its canonical text variant, like \'decimal-extension and tsq-functions with canonical text\', remove the distinct, or group by the columns instead')
    }
    override _buildSelectGroupBy(query: PlainSelectData, context: SqlBuildContext, isOutermostQuery: boolean, selectColumnsSql?: Map<AnyValueSource, SelectColumnSql> | undefined): string {
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
                    result += this._appendGroupBySelectColumn(entry, selectColumn, context, isOutermostQuery)
                } else {
                    result += this._decimalGroupingKey(entry, this._appendSelectColumn(entry, context, undefined, isOutermostQuery))
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
        // A distinct select with an exact decimal, without aggregates, is grouped by its columns, the exact decimal by
        // its grouping key, so the values equal as numbers are one row
        let hasDecimal = false
        let hasAggregation = false
        for (const column of selectColumnsSql.keys()) {
            hasAggregation = hasAggregation || __asNodeValueSource(column).__hasAggregation(this)
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
    override _anyValue(context: SqlBuildContext, value: any): string {
        // SQLite has no any_value: a column outside an aggregate in a grouped query (a bare column) takes the value
        // of one of the rows of the group, which is what any_value means
        return this._appendSqlParenthesis(value, context, false)
    }
    override _isReservedKeyword(word: string): boolean {
        return isSqliteReservedWord(word)
    }
    override _compoundIntersectHasPrecedence(): boolean {
        // Reads a chain of compound operators from left to right
        return false
    }
    override _buildSelectWithColumnsInfoForCompound(query: SelectData, context: SqlBuildContext, columnsForInsert: { [name: string]: DBColumn | undefined }, isOutermostQuery: boolean, needsGrouping: boolean): string {
        const result = this._buildSelectWithColumnsInfo(query, context, columnsForInsert, isOutermostQuery)
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
    override _buildSelectOrderBy(query: SelectData, context: SqlBuildContext): string {
        if (this._connectionConfiguration.compatibilityVersion >= 3_030_000) {
            return super._buildSelectOrderBy(query, context)
        }
        const orderBy = query.__orderBy
        if (!orderBy) {
            let orderByColumns = ''

            const customization = query.__customization
            if (customization && customization.beforeOrderByItems) {
                orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, context)
            }

            if (customization && customization.afterOrderByItems) {
                if (orderByColumns) {
                    orderByColumns += ', '
                }
                orderByColumns += this._appendRawFragment(customization.afterOrderByItems, context)
            }

            if (!orderByColumns) {
                return ''
            }
            return ' order by ' + orderByColumns
        }

        let orderByColumns = ''

        const customization = query.__customization
        if (customization && customization.beforeOrderByItems) {
            orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, context)
        }

        for (let i = 0, length = orderBy.length; i < length; i++) {
            const entry = orderBy[i]!
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const order = entry.order
            const ownTerms = this._appendOrderByEntryTerms(entry, query, context)
            if (ownTerms !== undefined) {
                orderByColumns += ownTerms
            } else if (!order) {
                orderByColumns += this._appendOrderByColumnAlias(entry, query, context)
            } else switch (order) {
                case 'asc':
                case 'asc nulls first':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, context) + ' asc'
                    break
                case 'desc':
                case 'desc nulls last':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, context) + ' desc'
                    break
                case 'asc nulls last':
                    orderByColumns += this._appendOrderByColumnForExpression(entry, query, context) + ' is null, ' + this._appendOrderByColumnAlias(entry, query, context) + ' asc'
                    break
                case 'desc nulls first':
                    orderByColumns += this._appendOrderByColumnForExpression(entry, query, context) + ' is not null, ' + this._appendOrderByColumnAlias(entry, query, context) + ' desc'
                    break
                case 'insensitive':
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, context)
                    break
                case 'asc insensitive':
                case 'asc nulls first insensitive':
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, context) + ' asc'
                    break
                case 'desc insensitive':
                case 'desc nulls last insensitive':
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, context) + ' desc'
                    break
                case 'asc nulls last insensitive':
                    orderByColumns += this._appendOrderByColumnForExpression(entry, query, context) + ' is null, ' + this._appendOrderByColumnAliasInsensitive(entry, query, context) + ' asc'
                    break
                case 'desc nulls first insensitive':
                    orderByColumns += this._appendOrderByColumnForExpression(entry, query, context) + ' is not null, ' + this._appendOrderByColumnAliasInsensitive(entry, query, context) + ' desc'
                    break
                default:
                    throw new TsSqlProcessingError({ reason: 'INVALID_ORDER_BY_ORDERING', column: this._appendOrderByColumnAlias(entry, query, context), ordering: order }, 'Invalid order by: ' + order)
            }
        }

        if (customization && customization.afterOrderByItems) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            orderByColumns += this._appendRawFragment(customization.afterOrderByItems, context)
        }

        if (!orderByColumns) {
            return ''
        }
        return ' order by ' + orderByColumns
    }
    override _buildSelectLimitOffset(query: SelectData, context: SqlBuildContext): string {
        let result = ''

        const limit = query.__limit
        if (limit !== null && limit !== undefined) {
            result += ' limit ' + this._appendValue(limit, context, __registeredDataType('int'), false)
        }

        const offset = query.__offset
        if (offset !== null && offset !== undefined) {
            if (!result) {
                // Sqlite doesn't support an offset without a limit, let put the the max value of an int
                result += ' limit 2147483647'
            }
            result += ' offset ' + this._appendValue(offset, context, __registeredDataType('int'), false)
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
    override _appendUpdateOldValueForUpdate(_query: UpdateData, _updatePrimaryKey: boolean, _requiredTables: Set<AnyTableOrView> | undefined, _context: SqlBuildContext) {
        return ''
    }
    override _buildInsertOutput(_query: InsertData, _context: SqlBuildContext): string {
        return ''
    }
    override _buildInsertReturning(query: InsertData, context: SqlBuildContext): string {
        if (this._connectionConfiguration.compatibilityVersion >= 3_035_000 || query.__from || query.__multiple || query.__columns || query.__onConflictUpdateSets) {
            return super._buildInsertReturning(query, context)
        }
        this._setContainsInsertReturningClause(context, false)
        return ''
    }
    override _is(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._isZonedTextComparison(typeClass)) {
            return this._is(context, new ZonedTextInstantOperand(valueSource), __zonedTextInstantValue(value), __registeredDataType('instant'))
        }
        if (__isExactDecimalSql(typeClass)) {
            return this._decimalIs(context, valueSource, value, typeClass)
        }
        if (__isColumn(valueSource) && __isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, context) + ' is ' + this._appendRawColumnName(value, context)
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' is ' + this._appendValueParenthesis(value, context, __valueOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value))
    }
    override _isNot(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._isZonedTextComparison(typeClass)) {
            return this._isNot(context, new ZonedTextInstantOperand(valueSource), __zonedTextInstantValue(value), __registeredDataType('instant'))
        }
        if (__isExactDecimalSql(typeClass)) {
            return 'not ' + this._decimalIs(context, valueSource, value, typeClass)
        }
        if (__isColumn(valueSource) && __isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, context) + ' is not ' + this._appendRawColumnName(value, context)
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' is not ' + this._appendValueParenthesis(value, context, __valueOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value))
    }
    override _currentDate(_context: SqlBuildContext): string {
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
    override _currentTime(_context: SqlBuildContext): string {
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
    override _currentTimestamp(_context: SqlBuildContext): string {
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
    override _valueWhenNull(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return 'ifnull(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, __valueOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value)) + ')'
    }
    override _random(_context: SqlBuildContext): string {
        // SQLite's `random()` returns a uniform 64-bit signed integer
        // (-2^63..2^63-1), not a [0, 1) float like every other dialect.
        // Normalise to a double in [0, 1) so the public `connection.random()`
        // contract is uniform across engines and survives strict i64 → JS
        // number drivers (notably `node:sqlite`).
        return '(random() / 18446744073709551616.0 + 0.5)'
    }
    override _ln(context: SqlBuildContext, valueSource: ToSql): string {
        return 'ln(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _log10(context: SqlBuildContext, valueSource: ToSql): string {
        return 'log10(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _minimumBetweenTwoValues(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (__isExactDecimalSql(typeClass)) {
            return this._decimalChoice('<=', context, valueSource, value, typeClass)
        }
        return 'min(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, __arithmeticOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value)) + ')'
    }
    override _maximumBetweenTwoValues(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (__isExactDecimalSql(typeClass)) {
            return this._decimalChoice('>=', context, valueSource, value, typeClass)
        }
        return 'max(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, __arithmeticOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value)) + ')'
    }
    override _day(context: SqlBuildContext, valueSource: ToSql): string {
        return "cast(strftime('%d', " + this._dateFunctionArgument(context, valueSource, false) + ") as integer)"
    }
    override _epochMilliseconds(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return '(' + this._appendSql(valueSource, context, false) + ' * 1000)'
        } else if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time milliseconds as integer') {
            return this._appendSql(valueSource, context, false)
        }
        const format = this._getValueSourceDateTimeFormat(valueSource)
        // A local text has no zone, and SQLite reads it as UTC unless it's told it's in the local one
        const modifier = this._connectionConfiguration.sqliteRunsInApplicationTimeZone && isLocalTextFormat(format) ? ", 'utc'" : ''
        const v = this._appendSql(valueSource, context, false)
        // The 'subsec' modifier on unixepoch() was added in SQLite 3.42; older versions
        // need to go through julianday() arithmetic to preserve sub-second precision
        if (this._connectionConfiguration.compatibilityVersion >= 3_042_000) {
            return 'round(unixepoch(' + v + modifier + ", 'subsec') * 1000)"
        }
        return 'round((julianday(' + v + modifier + ') - 2440587.5) * 86400000.0)'
    }
    override _epochNanoseconds(context: SqlBuildContext, valueSource: ToSql): string {
        // Its milliseconds, an integer (round gives a real, which a product would keep inexact): SQLite keeps no digit
        // below them. A Unix time kept as an integer already is one
        const format = this._getValueSourceDateTimeFormat(valueSource)
        const milliseconds = this._epochMilliseconds(context, valueSource)
        const integer = format === 'Unix time seconds as integer' || format === 'Unix time milliseconds as integer' ? milliseconds : 'cast(' + milliseconds + ' as integer)'
        return '(' + integer + ' * 1000000)'
    }
    /**
     * The wall clock in UTC of an instant: kept in a local text when SQLite runs in the zone of the application
     * (sqliteRunsInApplicationTimeZone), it is the wall clock of that zone, which the modifier 'utc' takes to UTC;
     * otherwise the zone of the database is UTC, and it is the value
     */
    override _instantInUtc(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._connectionConfiguration.sqliteRunsInApplicationTimeZone && isLocalTextFormat(this._getValueSourceDateTimeFormat(valueSource))) {
            return this._sqliteTemporalIn('dateTime', this._appendSql(valueSource, context, false) + ", 'utc'")
        }
        return this._appendSql(valueSource, context, false)
    }
    /** The instant of a wall clock in UTC: in a local text when SQLite runs in the zone of the application, of that zone */
    override _instantOfUtc(_context: SqlBuildContext, sql: string): string {
        if (this._connectionConfiguration.sqliteRunsInApplicationTimeZone && isLocalTextFormat(this._getDateTimeFormat('dateTime'))) {
            return this._sqliteTemporalIn('dateTime', sql + ", 'localtime'")
        }
        return sql
    }
    override _instantToPlainDateTime(context: SqlBuildContext, valueSource: ToSql): string {
        // An instant is kept in the format of a localDateTime, as a plainDateTime is: the same text or number
        return this._appendSql(valueSource, context, false)
    }
    override _year(context: SqlBuildContext, valueSource: ToSql): string {
        return "cast(strftime('%Y', " + this._dateFunctionArgument(context, valueSource, false) + ") as integer)"
    }
    override _monthFromZero(context: SqlBuildContext, valueSource: ToSql): string {
        return "cast(strftime('%m', " + this._dateFunctionArgument(context, valueSource, false) + ") as integer) - 1"
    }
    override _dayOfWeekFromSunday(context: SqlBuildContext, valueSource: ToSql): string {
        return "cast(strftime('%w'," + this._dateFunctionArgument(context, valueSource, false) + ") as integer)"
    }
    override _hour(context: SqlBuildContext, valueSource: ToSql): string {
        return "cast(strftime('%H', " + this._dateFunctionArgument(context, valueSource, false) + ") as integer)"
    }
    override _minute(context: SqlBuildContext, valueSource: ToSql): string {
        return "cast(strftime('%M', " + this._dateFunctionArgument(context, valueSource, false) + ") as integer)"
    }
    override _second(context: SqlBuildContext, valueSource: ToSql): string {
        return "cast(strftime('%S', " + this._dateFunctionArgument(context, valueSource, false) + ") as integer)"
    }
    override _millisecond(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time seconds as integer') {
            return '0'
        } else if (this._getValueSourceDateTimeFormat(valueSource) === 'Unix time milliseconds as integer') {
            return this._unixMillisecondsAsMilliseconds(this._appendSql(valueSource, context, false))
        }
        // `strftime('%f', …)` yields the STRING '01.001', which coerces to a REAL: times
        // 1000 that is 1000.9999999999999, and SQLite's `%` truncates its operands to
        // integer, so the milliseconds wrapped to 0. Rounding the REAL back to its exact
        // integer first is what the other branches get for free from their integer operand.
        // The error only hit ms values whose binade makes the product fall short — 372 of
        // the 60000 (second, millisecond) pairs, all at powers of two.
        return "cast(round(strftime('%f', " + this._appendSql(valueSource, context, false) + ") * 1000) as integer) % 1000"
    }
    override _month(context: SqlBuildContext, valueSource: ToSql): string {
        return "cast(strftime('%m', " + this._dateFunctionArgument(context, valueSource, false) + ") as integer)"
    }
    override _daysInMonthOf(context: SqlBuildContext, valueSource: ToSql): string {
        return "cast(strftime('%d', " + this._dateFunctionArgument(context, valueSource, false) + ", 'start of month', '+1 months', '-1 days') as integer)"
    }
    override _monthCode(context: SqlBuildContext, valueSource: ToSql): string {
        return "'M' || strftime('%m', " + this._dateFunctionArgument(context, valueSource, false) + ')'
    }
    override _toPlainMonthDay(context: SqlBuildContext, valueSource: ToSql): string {
        // Its month and day in the reference year
        return this._sqliteTemporalIn('date', "strftime('" + this._yearOfStoredMonthDays() + "-%m-%d', " + this._dateFunctionArgument(context, valueSource) + ')')
    }
    override _toPlainYearMonth(context: SqlBuildContext, valueSource: ToSql): string {
        // The first day of its month, and the days to the reference day
        const day = this._dayOfStoredYearMonths()
        return this._sqliteTemporalIn('date', this._dateFunctionArgument(context, valueSource) + ", 'start of month'" + (day === 1 ? '' : ", '+" + (day - 1) + " days'"))
    }
    override _dayOfWeek(context: SqlBuildContext, valueSource: ToSql): string {
        // `%w` is 0 Sunday to 6 Saturday; Temporal's dayOfWeek, 1 Monday to 7 Sunday (`%u`, only since SQLite 3.46)
        return "(cast(strftime('%w', " + this._dateFunctionArgument(context, valueSource, false) + ") as integer) + 6) % 7 + 1"
    }
    override _dayOfYear(context: SqlBuildContext, valueSource: ToSql): string {
        return "cast(strftime('%j', " + this._dateFunctionArgument(context, valueSource, false) + ") as integer)"
    }
    override _microsecond(context: SqlBuildContext, valueSource: ToSql): string {
        // The date functions of SQLite stop at the millisecond: the microseconds of the millisecond are the 4th to the
        // 6th digit of the fraction of a value kept as text, 0 when it has none. A number (a Julian day, a Unix time)
        // has none
        const format = this._getValueSourceDateTimeFormat(valueSource)
        if (format === 'Julian day as real number' || format === 'Unix time seconds as integer' || format === 'Unix time milliseconds as integer') {
            return '0'
        }
        const value = this._appendSqlParenthesis(valueSource, context, false)
        return "case when instr(" + value + ", '.') = 0 then 0 else cast(substr(" + value + " || '000000', instr(" + value + ", '.') + 4, 3) as integer) end"
    }
    override _toPlainDate(context: SqlBuildContext, valueSource: ToSql): string {
        return this._sqliteTemporalIn('date', this._dateFunctionArgument(context, valueSource))
    }
    override _toPlainTime(context: SqlBuildContext, valueSource: ToSql): string {
        return this._sqliteTemporalIn('time', this._dateFunctionArgument(context, valueSource))
    }
    override _toPlainDateTime(context: SqlBuildContext, valueSource: ToSql): string {
        return this._sqliteTemporalIn('dateTime', this._dateFunctionArgument(context, valueSource))
    }
    override _toPlainDateTimeAt(context: SqlBuildContext, valueSource: ToSql, value: any, _typeClass: DataTypeClass): string {
        // The text of the date and the time joined, read by the date functions as one date and time
        const time = isValueSource(value) ? this._dateFunctionArgument(context, __asNodeValueSource(value)) : this._appendPlainTimeOperand(context, value)
        return this._sqliteTemporalIn('dateTime', "date(" + this._dateFunctionArgument(context, valueSource) + ") || ' ' || strftime('%H:%M:%f', " + time + ")")
    }
    /** SQLite has no type for a duration: it is kept as its ISO 8601 text */
    override _supportNativeDurations(): boolean {
        return false
    }
    override _durationRoundOfOperand(context: SqlBuildContext, valueSource: ToSql): string {
        // Its text, as the date functions read it, with its milliseconds
        return "strftime('%Y-%m-%d %H:%M:%f', " + this._dateFunctionArgument(context, valueSource) + ')'
    }
    override _roundToFunction(value: string, step: string, mode: string): string {
        // The integer goes to the function and comes back as its text: a function written in JavaScript would read an
        // integer of more than 53 bits as a number, rounded
        return "cast(tsq_round_to(cast(" + value + " as text), " + step + ", '" + mode + "') as integer)"
    }
    override _truncatedDivision(dividend: string, divisor: string): string {
        // A cast to integer truncates toward zero, also a real
        return 'cast(' + dividend + ' / ' + divisor + ' as integer)'
    }
    /**
     * A date, a time or a date and time plus a duration (multiplied by sign), as Temporal adds it, with the modifiers of
     * the date functions: the months from the start of the month, and the day of the value, or the last day of the
     * month when it has fewer (SQLite's `+N months` moves Jan 31 to Mar 2, Temporal keeps it in February); then the
     * days and the seconds. A time goes round at midnight. The digits below the millisecond are the ones the date
     * functions keep
     */
    override _utcOfEpochSql(name: string, value: string, unitNanoseconds: string): string {
        // The number as its text (a function would read an integer of more than 53 bits as a rounded number); the text of
        // the result in the format of the dates of the connection
        return this._sqliteTemporalIn('dateTime', name + '(cast(' + value + ' as text), ' + unitNanoseconds + ')')
    }
    override _dateWithFunction(context: SqlBuildContext, valueSource: ToSql, fields: string): string {
        // Its text, as the date functions read it; the text of the result in the format of the dates of the connection
        return this._sqliteTemporalIn('date', "tsq_date_with(strftime('%Y-%m-%d', " + this._dateFunctionArgument(context, valueSource) + '), ' + fields + ')')
    }
    override _plusDurationFunction(fields: 'date' | 'time' | 'timestamp' | 'instant', duration: ToSql): string | undefined {
        // A duration kept as its text, added to a date, a date and time or an instant: its parts read once by the function
        if (!this._isDurationKeptAsText(duration) || fields === 'time') {
            return undefined
        }
        return fields === 'date' ? 'tsq_date_plus_duration' : fields === 'timestamp' ? 'tsq_datetime_plus_duration' : 'tsq_instant_plus_duration'
    }
    override _plusDurationOperand(context: SqlBuildContext, valueSource: ToSql, _fields: 'date' | 'time' | 'timestamp' | 'instant'): string {
        // Its text, as the date functions read it, with its milliseconds
        return "strftime('%Y-%m-%d %H:%M:%f', " + this._dateFunctionArgument(context, valueSource) + ')'
    }
    override _appendPlusDuration(context: SqlBuildContext, valueSource: ToSql, value: unknown, fields: 'date' | 'time' | 'timestamp' | 'instant', sign: 1 | -1): string | undefined {
        const sum = super._appendPlusDuration(context, valueSource, value, fields, sign)
        // The text the function gives, in the format of the dates of the connection
        return sum === undefined ? undefined : this._sqliteTemporalIn(fields === 'date' ? 'date' : 'dateTime', sum)
    }
    override _appendWithDuration(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass, sign: 1 | -1): string {
        const fields = this._temporalFieldsOfDurationOperation(typeClass)
        const constant = this._constantDurationParts(value, typeClass, fields, sign)
        if (constant && isZeroDuration(constant)) {
            return this._appendSql(valueSource, context, false)
        }
        let months: string | undefined
        let days: string | undefined
        let seconds: string | undefined
        if (constant) {
            const text = __registeredDataType('string')
            months = constant.months === 0 ? undefined : this._appendValue(constant.months + ' months', context, text, false)
            days = constant.days === 0 ? undefined : this._appendValue(constant.days + ' days', context, text, false)
            seconds = constant.seconds === 0 && constant.nanoseconds === 0 ? undefined : this._appendValue(secondsModifier(constant.seconds, constant.nanoseconds), context, text, false)
        } else {
            const duration = __asNodeValueSource(value)
            if (fields !== 'time') {
                months = '(' + this._signedDurationTextPart(context, duration, 'M', sign) + ") || ' months'"
                const wholeDays = fields === 'date' ? ' + ' + this._truncatedDivision(this._signedDurationTextPart(context, duration, 'S', sign), '86400') : ''
                days = '(' + this._signedDurationTextPart(context, duration, 'D', sign) + wholeDays + ") || ' days'"
            }
            if (fields !== 'date') {
                seconds = '(' + this._signedDurationTextPart(context, duration, 'S', sign) + ' + ' + this._signedDurationTextPart(context, duration, 'N', sign) + " / 1000000000.0) || ' seconds'"
            }
        }
        const argument = this._dateFunctionArgument(context, valueSource)
        if (fields === 'time') {
            return this._sqliteTemporalIn('time', argument + ', ' + seconds)
        }
        let date = argument
        if (months !== undefined) {
            // The first of the month, the months added, and the day of the value or the last one of that month
            const month = 'date(' + argument + ", 'start of month', " + months + ')'
            const lastDay = "cast(strftime('%d', " + month + ", '+1 months', '-1 days') as integer)"
            date = month + ", (min(cast(strftime('%d', " + argument + ') as integer), ' + lastDay + ") - 1) || ' days'"
            if (fields === 'timestamp') {
                date = 'date(' + date + ") || ' ' || strftime('%H:%M:%f', " + argument + ')'
            }
        }
        const modifiers = (days === undefined ? '' : ', ' + days) + (seconds === undefined ? '' : ', ' + seconds)
        return this._sqliteTemporalIn(fields === 'date' ? 'date' : 'dateTime', date + modifiers)
    }
    override _integerPart(sql: string): string {
        return sql
    }
    override _leastOf(value: string, other: string): string {
        return 'min(' + value + ', ' + other + ')'
    }
    /*
     * A zoned date and time is kept as its RFC 9557 text (see _zonedKeptAsText): the date functions of SQLite take the
     * text before its zone, with its offset or its Z, as its instant (to the millisecond)
     */
    override _zonedKeptAsText(): boolean {
        return true
    }
    /** tsq_ci_replace, registered in the connection of the driver with the functions of the library (libraryFunctions) */
    override _replaceAllInsensitiveFunction(): string | undefined {
        return this._libraryFunctionsInstalled() ? 'tsq_ci_replace' : undefined
    }
    /** The date and time with its offset of the text of a zoned date and time, as the date functions take it */
    _sqliteZonedTextDateTime(context: SqlBuildContext, valueSource: ToSql): string {
        return "substr(" + this._appendSql(valueSource, context, false) + ", 1, instr(" + this._appendSql(valueSource, context, false) + ", '[') - 1)"
    }
    override _zonedTextUtc(context: SqlBuildContext, valueSource: ToSql): string {
        return this._sqliteTemporalIn('dateTime', this._sqliteZonedTextDateTime(context, valueSource))
    }
    override _zonedTextWall(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._libraryFunctionsInstalled()) {
            return this._sqliteTemporalIn('dateTime', 'tsq_zoned_wall(' + this._appendSql(valueSource, context, false) + ')')
        }
        // The date and time without its offset
        return this._sqliteTemporalIn('dateTime', 'substr(' + this._sqliteZonedTextDateTime(context, valueSource) + ', 1, length(' + this._sqliteZonedTextDateTime(context, valueSource) + ') - case when ' + this._sqliteZonedTextDateTime(context, valueSource) + " like '%Z' then 1 else 6 end)")
    }
    override _zonedTextZone(context: SqlBuildContext, valueSource: ToSql): string {
        return "rtrim(substr(" + this._appendSql(valueSource, context, false) + ", instr(" + this._appendSql(valueSource, context, false) + ", '[') + 1), ']')"
    }
    override _zonedTextOffset(context: SqlBuildContext, valueSource: ToSql): string {
        return 'case when ' + this._sqliteZonedTextDateTime(context, valueSource) + " like '%Z' then '+00:00' else substr(" + this._sqliteZonedTextDateTime(context, valueSource) + ', -6) end'
    }
    override _zonedTextOffsetNanoseconds(context: SqlBuildContext, valueSource: ToSql): string {
        return '(case when ' + this._sqliteZonedTextDateTime(context, valueSource) + " like '%Z' then 0 else (case when substr(" + this._sqliteZonedTextDateTime(context, valueSource) + ", -6, 1) = '-' then -1 else 1 end) * (cast(substr(" + this._sqliteZonedTextDateTime(context, valueSource) + ', -5, 2) as integer) * 3600 + cast(substr(' + this._sqliteZonedTextDateTime(context, valueSource) + ', -2, 2) as integer) * 60) end * 1000000000)'
    }
    override _zonedTextMinOrMax(kind: 'min' | 'max', context: SqlBuildContext, value: ToSql): string {
        // The instant in UTC with its milliseconds, 23 characters, orders as the instants do
        return 'substr(' + kind + "(strftime('%Y-%m-%d %H:%M:%f', " + this._sqliteZonedTextDateTime(context, value) + ') || ' + this._appendSql(value, context, false) + '), 24)'
    }
    override _daysInMonth(_context: SqlBuildContext, year: string, month: string): string {
        return "cast(strftime('%d', printf('%04d-%02d-01', " + year + ', ' + month + "), '+1 months', '-1 days') as integer)"
    }
    override _makeDate(_context: SqlBuildContext, year: string, month: string, day: string): string {
        return this._sqliteTemporalIn('date', "printf('%04d-%02d-%02d', " + year + ', ' + month + ', ' + day + ')')
    }
    override _nanosecondOfSecond(context: SqlBuildContext, valueSource: ToSql): string {
        // The date functions of SQLite keep milliseconds
        return '(' + this._millisecond(context, valueSource) + ') * 1000000'
    }
    override _makeTime(_context: SqlBuildContext, hour: string, minute: string, second: string, nanoseconds: string): string {
        return this._sqliteTemporalIn('time', "printf('%02d:%02d:%02d.%03d', " + hour + ', ' + minute + ', ' + second + ', ' + this._truncatedDivision(nanoseconds, '1000000') + ')')
    }
    override _makeTimestamp(_context: SqlBuildContext, year: string, month: string, day: string, hour: string, minute: string, second: string, nanoseconds: string): string {
        return this._sqliteTemporalIn('dateTime', "printf('%04d-%02d-%02d %02d:%02d:%02d.%03d', " + year + ', ' + month + ', ' + day + ', ' + hour + ', ' + minute + ', ' + second + ', ' + this._truncatedDivision(nanoseconds, '1000000') + ')')
    }
    /**
     * The nanoseconds of the time of a difference as the function of JavaScript takes them: as their text, since a
     * driver gives an integer beyond 2^53 (a difference of more than 104 days) to a function as a rounded number
     */
    override _durationTextTimeArgument(nanoseconds: string): string {
        return 'cast(' + nanoseconds + ' as text)'
    }
    override _differenceTimeForTotal(context: SqlBuildContext, d: PlainTemporalDifferenceSql, afterWeeks: boolean): string {
        // Its nanoseconds as text, as tsq_duration_text takes them: a real when they overflowed the 64-bit integers
        return '0, ' + this._durationTextTimeArgument(this._nanosecondsOfDifference(this._differenceTimeOfTotal(context, d, afterWeeks), d))
    }
    override _differenceDateOf(context: SqlBuildContext, _d: PlainTemporalDifferenceSql, valueSource: ToSql): string {
        // The text of the date, whatever the format the value is kept in
        return this._dateOfValue(context, valueSource)
    }
    override _daysBetween(_context: SqlBuildContext, to: string, from: string): string {
        return 'cast(julianday(' + to + ') - julianday(' + from + ') as integer)'
    }
    override _addDaysToDate(_context: SqlBuildContext, date: string, days: string): string {
        return 'date(' + date + ', (' + days + ") || ' days')"
    }
    override _nanosecondsSinceMidnight(context: SqlBuildContext, valueSource: ToSql): string {
        // The date functions keep milliseconds
        const argument = this._dateFunctionArgument(context, valueSource)
        return 'cast(round((julianday(' + argument + ') - julianday(date(' + argument + '))) * 86400000) as integer) * 1000000'
    }
    override _withWholeTime(context: SqlBuildContext, valueSource: ToSql, given: PlainTemporalFields, fields: 'time' | 'timestamp'): string {
        const value = this._dateFunctionArgument(context, valueSource)
        return this._sqliteTemporalIn(fields === 'time' ? 'time' : 'dateTime', value + ', (' + this._withSeconds(context, valueSource, given) + ") || ' seconds'")
    }
    override _dateOfValue(context: SqlBuildContext, valueSource: ToSql): string {
        return 'date(' + this._dateFunctionArgument(context, valueSource) + ')'
    }
    override _timeOfNanoseconds(_context: SqlBuildContext, nanoseconds: string): string {
        return this._sqliteTemporalIn('time', "'00:00:00', ((" + nanoseconds + ") / 1000000000.0) || ' seconds'")
    }
    override _dateTimeOfNanoseconds(_context: SqlBuildContext, date: string, nanoseconds: string): string {
        return this._sqliteTemporalIn('dateTime', date + ', ((' + nanoseconds + ") / 1000000000.0) || ' seconds'")
    }
    /** The sign of a number from its comparisons, which are 0 or 1 (sign() is not in every version) */
    override _signOf(value: string): string {
        return '((' + value + ' > 0) - (' + value + ' < 0))'
    }
    /** The whole difference of two times or dates and times: the milliseconds of their Julian days apart */
    override _differenceTotal(context: SqlBuildContext, d: PlainTemporalDifferenceSql): string {
        if (d.fields === 'date' || d.fields === 'yearMonth') {
            return super._differenceTotal(context, d)
        }
        return 'cast(round((julianday(' + this._dateFunctionArgument(context, d.two) + ') - julianday(' + this._dateFunctionArgument(context, d.one) + ')) * 86400000) as integer)'
    }
    /** The date and time functions keep milliseconds */
    override _temporalTick(): bigint {
        return 1000000n
    }
    override _ticksSinceMidnight(context: SqlBuildContext, valueSource: ToSql): string {
        const argument = this._dateFunctionArgument(context, valueSource)
        return 'cast(round((julianday(' + argument + ') - julianday(date(' + argument + '))) * 86400000) as integer)'
    }
    override _timeOfDatabaseTicks(_context: SqlBuildContext, ticks: string): string {
        return this._sqliteTemporalIn('time', "'00:00:00', ((" + ticks + ") / 1000.0) || ' seconds'")
    }
    override _dateTimeOfDatabaseTicks(_context: SqlBuildContext, date: string, ticks: string): string {
        return this._sqliteTemporalIn('dateTime', date + ', ((' + ticks + ") / 1000.0) || ' seconds'")
    }
    override _validDayOrError(context: SqlBuildContext, year: string, month: string, day: string): string {
        // SQLite has no date that fails: an integer overflow is the error
        return 'case when ' + day + ' > ' + this._daysInMonth(context, year, month) + ' then abs(-9223372036854775807 - 1) else ' + day + ' end'
    }
    override _valueOrErrorWhenDurationHasDays(context: SqlBuildContext, value: string, duration: ToSql): string {
        // SQLite has no date that fails: an integer overflow is the error
        return 'case when ' + this._durationHasDaysSql(context, duration) + ' then abs(-9223372036854775807 - 1) else ' + value + ' end'
    }
    override _bigintOfInteger(sql: string): string {
        // An integer is of 64 bits
        return sql
    }
    override _epochDate(): string {
        return "'1970-01-01'"
    }
    /** The result, or an error of the query when the day of the value isn't in the month the duration reaches */
    override _appendWithDurationRejecting(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass, sign: 1 | -1): string {
        const fields = this._temporalFieldsOfDurationOperation(typeClass)
        const result = (this._appendPlusDuration(context, valueSource, value, fields, sign) ?? this._appendWithDuration(context, valueSource, value, typeClass, sign))
        if (fields === 'time' || !this._hasDurationMonths(value, typeClass, fields, sign)) {
            return result
        }
        if (this._libraryFunctionsInstalled()) {
            // The function fails for a day the month reached hasn't, and gives 0 otherwise
            const text = "strftime('%Y-%m-%d %H:%M:%f', " + this._dateFunctionArgument(context, valueSource) + ')'
            return 'case when tsq_day_in_month_or_error(' + text + ', ' + this._durationMonthsSql(context, value, typeClass, fields, sign) + ') = 0 then ' + result + ' end'
        }
        const monthIndex = '(' + this._year(context, valueSource) + ' * 12 + ' + this._month(context, valueSource) + ' - 1 + ' + this._durationMonthsSql(context, value, typeClass, fields, sign) + ')'
        const days = this._daysInMonth(context, this._truncatedDivision(monthIndex, '12'), '(' + this._integerRemainder(monthIndex, '12') + ' + 1)')
        return 'case when ' + this._day(context, valueSource) + ' > ' + days + ' then abs(-9223372036854775807 - 1) else ' + result + ' end'
    }
    /**
     * A date, a time or a date and time in the format its type is kept in (getDateTimeFormat), from the arguments of a
     * date function of SQLite (a value and its modifiers): its text, with the seconds or the milliseconds the format
     * says, or its number (a Julian day, of a time the fraction of a day since midnight; a Unix time)
     */
    _sqliteTemporalIn(kind: SqliteDateTimeFormatType, args: string): string {
        const format = this._getDateTimeFormat(kind)
        // A time kept as a number is the one of 1970-01-01
        const value = kind === 'date' ? 'date(' + args + ')' : kind === 'time' ? "strftime('1970-01-01 %H:%M:%f', " + args + ')' : args
        switch (format) {
            case 'Julian day as real number':
                return kind === 'time' ? '(julianday(' + value + ') - 2440587.5)' : 'julianday(' + value + ')'
            case 'Unix time seconds as integer':
                return this._unixEpochSeconds(value)
            case 'Unix time milliseconds as integer':
                return this._unixEpochMilliseconds(value)
            default:
        }
        if (kind === 'date') {
            return 'date(' + args + ')'
        }
        const time = format.includes('milliseconds') ? '%H:%M:%f' : '%H:%M:%S'
        const zone = format.includes('Z timezone') ? 'Z' : ''
        if (kind === 'time') {
            return "strftime('" + time + zone + "', " + args + ')'
        }
        return "strftime('%Y-%m-%d" + (format.includes('T separator') ? 'T' : ' ') + time + zone + "', " + args + ')'
    }
    /** In a canonical text variant a computed exact decimal is stored in its canonical text */
    override _appendValueForColumn(column: DBColumn, value: any, context: SqlBuildContext, forceTypeCast: boolean): string {
        const sql = super._appendValueForColumn(column, value, context, forceTypeCast)
        if (hasToSql(value) && this._isCanonicalDecimalText() && this._isCustomDecimal(column)) {
            return this._canonicalDecimalSql(value, sql)
        }
        return sql
    }
    override _appendParam(value: any, context: SqlBuildContext, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        if (__isExactDecimalSql(typeClass) && typeof value === 'string' && this._isCanonicalDecimalText()) {
            // In a canonical text variant an exact decimal is sent in its canonical text
            value = canonicalDecimalText(value)
        }
        if (__sqlFamilyOf(typeClass) === 'uuid' && this._getUuidStrategy() === 'uuid-extension') {
            return 'uuid_blob(' + super._appendParam(value, context, typeClass, forceTypeCast) + ')'
        }
        return super._appendParam(value, context, typeClass, forceTypeCast)
    }
    override _appendColumnValue(value: AnyValueSource, context: SqlBuildContext, isOutermostQuery: boolean): string {
        if (this._isCustomDecimal(value) && this._isCanonicalDecimalText()) {
            // In a canonical text variant a column of a select gives the canonical text of a computed exact decimal
            return this._canonicalDecimalSql(value, this._appendSql(value, context, false))
        }
        if (isOutermostQuery && this._getUuidStrategy() === 'uuid-extension') {
            if (__isUuidValueSource(__asNodeValueSource(value))) {
                return 'uuid_str(' + this._appendSql(value, context, false) + ')'
            }
        }
        return this._appendSql(value, context, false)
    }
    override _asString(context: SqlBuildContext, valueSource: ToSql): string {
        // Transform an uuid to string
        if (this._getUuidStrategy() === 'string') {
            // No conversion required
            return this._appendSql(valueSource, context, false)
        }
        return 'uuid_str(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _appendAggregateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayDistinct: boolean, context: SqlBuildContext, _query: SelectData | undefined): string {
        const distict = aggregatedArrayDistinct ? 'distinct ' : ''
        if (isValueSource(aggregatedArrayColumns)) {
            if (__isUuidValueSource(__asNodeValueSource(aggregatedArrayColumns)) && this._getUuidStrategy() === 'uuid-extension') {
                return 'json_group_array(' + distict + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, 'uuid_str(' + this._appendSql(aggregatedArrayColumns, context, false) + ')', context) + ')'
            }
            if (this._isCustomDecimal(aggregatedArrayColumns) && (aggregatedArrayDistinct || this._isCanonicalDecimalText())) {
                // The distinct values of an exact decimal are the distinct numbers, each in its normal form; in a
                // canonical text variant every value goes in its canonical text
                return 'json_group_array(' + distict + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, this._decimalComparableText(aggregatedArrayColumns, this._appendSql(aggregatedArrayColumns, context, false)), context) + ')'
            }
            return 'json_group_array(' + distict + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, this._appendSql(aggregatedArrayColumns, context, false), context) + ')'
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
                if (__isUuidValueSource(__asNodeValueSource(column)) && this._getUuidStrategy() === 'uuid-extension') {
                    result += this._appendAggregatedArrayValueProjection(column, 'uuid_str(' + this._appendSql(column, context, false) + ')', context)
                } else if (this._isCustomDecimal(column) && (aggregatedArrayDistinct || this._isCanonicalDecimalText())) {
                    result += this._appendAggregatedArrayValueProjection(column, this._decimalComparableText(column, this._appendSql(column, context, false)), context)
                } else {
                    result += this._appendAggregatedArrayValueProjection(column, this._appendSql(column, context, false), context)
                }
            }

            return 'json_group_array(' + distict + 'json_object(' + result + '))'
        }
    }
    override _appendAggregateArrayWrappedColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, context: SqlBuildContext, aggregateId: number): string {
        if (isValueSource(aggregatedArrayColumns)) {
            if (__isUuidValueSource(__asNodeValueSource(aggregatedArrayColumns)) && this._getUuidStrategy() === 'uuid-extension') {
                return 'json_group_array(' + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, 'uuid_str(a_' + aggregateId + '_.result)', context) + ')'
            }
            return 'json_group_array(' + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, 'a_' + aggregateId + '_.result', context) + ')'
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
                if (__isUuidValueSource(__asNodeValueSource(column)) && this._getUuidStrategy() === 'uuid-extension') {
                    result += this._appendAggregatedArrayValueProjection(column, 'uuid_str(a_' + aggregateId + '_.' + this._escape(prop, true) + ')', context)
                } else {
                    result += this._appendAggregatedArrayValueProjection(column, 'a_' + aggregateId + '_.' + this._escape(prop, true), context)
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

/** The modifier of the date functions of SQLite that adds the seconds given, with the nanoseconds as their fraction */
function secondsModifier(seconds: number, nanoseconds: number): string {
    const negative = seconds < 0 || nanoseconds < 0
    const fraction = String(Math.abs(nanoseconds)).padStart(9, '0').replace(/0+$/, '')
    return (negative ? '-' : '') + Math.abs(seconds) + (fraction === '' ? '' : '.' + fraction) + ' seconds'
}
