import { SqlBuilder, SqlOperationStatic0, SqlOperationStatic1, SqlOperation0, SqlOperation1, SqlOperation2, ToSql, HasOperation, SqlSequenceOperation, SqlFragmentOperation, AggregateFunctions0, AggregateFunctions1, AggregateFunctions1or2 } from "../sqlBuilders/SqlBuilder"
import { BooleanValueSource, IntValueSource, DoubleValueSource, NumberValueSource, StringValueSource, TypeSafeStringValueSource, ValueSource, NullableValueSource, LocalDateValueSource, LocalTimeValueSource, LocalDateTimeValueSource, DateValueSource, TimeValueSource, DateTimeValueSource, StringIntValueSource, StringDoubleValueSource, StringNumberValueSource, __ValueSourcePrivate } from "../expressions/values"
import { TypeAdapter } from "../TypeAdapter"

export abstract class ValueSourceImpl extends ValueSource<any, any, any> implements NullableValueSource<any, any, any>, BooleanValueSource<any, any, any>, IntValueSource<any, any, any>, StringIntValueSource<any, any, any>, DoubleValueSource<any, any, any>, StringDoubleValueSource<any, any, any>, NumberValueSource<any, any, any>, StringNumberValueSource<any, any, any>, StringValueSource<any, any, any>, TypeSafeStringValueSource<any, any, any>, LocalDateValueSource<any, any, any>, LocalTimeValueSource<any, any, any>, LocalDateTimeValueSource<any, any, any>, DateValueSource<any, any, any>, TimeValueSource<any, any, any>, DateTimeValueSource<any, any, any>, ToSql, __ValueSourcePrivate {
    __columnType: string
    __typeAdapter?: TypeAdapter
    constructor(columnType: string, typeAdapter: TypeAdapter | undefined) {
        super()
        this.__columnType = columnType
        this.__typeAdapter = typeAdapter
    }
    abstract __toSql(sqlBuilder: SqlBuilder, params: any[]): string
    asOptional(): any {
        return this
    }
    // SqlComparator0
    isNull(): any {
        return new SqlOperation0ValueSource('_isNull', this, 'boolean', this.__typeAdapter)
    }
    isNotNull(): any {
        return new SqlOperation0ValueSource('_isNotNull', this, 'boolean', this.__typeAdapter)
    }
    // SqlComparator1
    equalsIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_equals', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    equals(value: any): any {
        return new SqlOperation1ValueSource('_equals', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notEqualsIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_notEquals', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notEquals(value: any): any {
        return new SqlOperation1ValueSource('_notEquals', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    isIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_is', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    is(value: any): any {
        return new SqlOperation1ValueSource('_is', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    isNotIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_isNot', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    isNot(value: any): any {
        return new SqlOperation1ValueSource('_isNot', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    asString(): any { // test function
        return this
    }
    equalsInsensitiveIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_equalsInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    equalsInsensitive(value: any): any {
        return new SqlOperation1ValueSource('_equalsInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notEqualsInsensitiveIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_notEqualsInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notEqualsInsensitive(value: any): any {
        return new SqlOperation1ValueSource('_notEqualsInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    smallerIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_smaller', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    smaller(value: any): any {
        return new SqlOperation1ValueSource('_smaller', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    largerIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_larger', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    larger(value: any): any {
        return new SqlOperation1ValueSource('_larger', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    smallAsIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_smallAs', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    smallAs(value: any): any {
        return new SqlOperation1ValueSource('_smallAs', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    largeAsIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_largeAs', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    largeAs(value: any): any {
        return new SqlOperation1ValueSource('_largeAs', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    inIfValue(value: any): any {
        if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length <= 0)) {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_in', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    in(value: any): any {
        return new SqlOperation1ValueSource('_in', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notInIfValue(value: any): any {
        if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length <= 0)) {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_notIn', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notIn(value: any): any {
        return new SqlOperation1ValueSource('_notIn', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    inN(...value: any[]): any {
        return new SqlOperation1ValueSource('_in', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notInN(...value: any[]): any {
        return new SqlOperation1ValueSource('_notIn', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    likeIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_like', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    like(value: any): any {
        return new SqlOperation1ValueSource('_like', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notLikeIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_notLike', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notLike(value: any): any {
        return new SqlOperation1ValueSource('_notLike', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    likeInsensitiveIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_likeInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    likeInsensitive(value: any): any {
        return new SqlOperation1ValueSource('_likeInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notLikeInsensitiveIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_notLikeInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notLikeInsensitive(value: any): any {
        return new SqlOperation1ValueSource('_notLikeInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    startWithIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_startWith', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    startWith(value: any): any {
        return new SqlOperation1ValueSource('_startWith', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notStartWithIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_notStartWith', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notStartWith(value: any): any {
        return new SqlOperation1ValueSource('_notStartWith', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    endWithIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_endWith', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    endWith(value: any): any {
        return new SqlOperation1ValueSource('_endWith', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notEndWithIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_notEndWith', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notEndWith(value: any): any {
        return new SqlOperation1ValueSource('_notEndWith', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    startWithInsensitiveIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_startWithInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    startWithInsensitive(value: any): any {
        return new SqlOperation1ValueSource('_startWithInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notStartWithInsensitiveIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_notStartWithInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notStartWithInsensitive(value: any): any {
        return new SqlOperation1ValueSource('_notStartWithInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    endWithInsensitiveIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_endWithInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    endWithInsensitive(value: any): any {
        return new SqlOperation1ValueSource('_endWithInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notEndWithInsensitiveIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_notEndWithInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notEndWithInsensitive(value: any): any {
        return new SqlOperation1ValueSource('_notEndWithInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    containsIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_contains', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    contains(value: any): any {
        return new SqlOperation1ValueSource('_contains', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notContainsIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_notContains', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notContains(value: any): any {
        return new SqlOperation1ValueSource('_notContains', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    containsInsensitiveIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_containsInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    containsInsensitive(value: any): any {
        return new SqlOperation1ValueSource('_containsInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notContainsInsensitiveIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return new NeutralBooleanValueSource('boolean', this.__typeAdapter)
        }
        return new SqlOperation1ValueSource('_notContainsInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    notContainsInsensitive(value: any): any {
        return new SqlOperation1ValueSource('_notContainsInsensitive', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    // SqlComparator2
    between(value: any, value2: any): any {
        return new SqlOperation2ValueSource('_between', this, value, value2, 'boolean', getTypeAdapter2(this, value))
    }
    notBetween(value: any, value2: any): any {
        return new SqlOperation2ValueSource('_notBetween', this, value, value2, 'boolean', getTypeAdapter2(this, value))
    }
    // SqlFunctionStatic: never used here
    // SqlFunction0
    // Boolean
    negate(): any {
        return new SqlOperation0ValueSource('_negate', this, 'boolean', this.__typeAdapter)
    }
    // String
    lower(): any {
        return new SqlOperation0ValueSource('_lower', this, this.__columnType, this.__typeAdapter)
    }
    upper(): any {
        return new SqlOperation0ValueSource('_upper', this, this.__columnType, this.__typeAdapter)
    }
    length(): any {
        return new SqlOperation0ValueSource('_length', this, 'int', this.__typeAdapter)
    }
    trim(): any {
        return new SqlOperation0ValueSource('_trim', this, this.__columnType, this.__typeAdapter)
    }
    ltrim(): any {
        return new SqlOperation0ValueSource('_ltrim', this, this.__columnType, this.__typeAdapter)
    }
    rtrim(): any {
        return new SqlOperation0ValueSource('_rtrim', this, this.__columnType, this.__typeAdapter)
    }
    reverse(): any {
        return new SqlOperation0ValueSource('_reverse', this, this.__columnType, this.__typeAdapter)
    }
    // Number functions
    asDouble(): any {
        return new SqlOperation0ValueSource('_asDouble', this, 'double', this.__typeAdapter)
    }
    asStringDouble(): any {
        return new SqlOperation0ValueSource('_asDouble', this, 'stringDouble', this.__typeAdapter)
    }
    asInt(): any { // test function
        return new NoopValueSource(this, 'int', this.__typeAdapter)
    }
    asStringInt(): any {
        return new NoopValueSource(this, 'stringInt', this.__typeAdapter)
    }
    asStringNumber(): any {
        return new NoopValueSource(this, 'stringInt', this.__typeAdapter)
    }
    abs(): any {
        return new SqlOperation0ValueSource('_abs', this, this.__columnType, this.__typeAdapter)
    }
    ceil(): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation0ValueSource('_ceil', this, 'stringInt', this.__typeAdapter)
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation0ValueSource('_ceil', this, 'stringInt', this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_ceil', this, 'int', this.__typeAdapter)
        }
    }
    floor(): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation0ValueSource('_floor', this, 'stringInt', this.__typeAdapter)
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation0ValueSource('_floor', this, 'stringInt', this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_floor', this, 'int', this.__typeAdapter)
        }
    }
    round(): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation0ValueSource('_round', this, 'stringInt', this.__typeAdapter)
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation0ValueSource('_round', this, 'stringInt', this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_round', this, 'int', this.__typeAdapter)
        }
    }
    exp(): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation0ValueSource('_exp', this, 'stringDouble', this.__typeAdapter)
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation0ValueSource('_exp', this, 'stringDouble', this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_exp', this, 'double', this.__typeAdapter)
        }
    }
    ln(): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation0ValueSource('_ln', this, 'stringDouble', this.__typeAdapter)
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation0ValueSource('_ln', this, 'stringDouble', this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_ln', this, 'double', this.__typeAdapter)
        }
    }
    log10(): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation0ValueSource('_log10', this, 'stringDouble', this.__typeAdapter)
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation0ValueSource('_log10', this, 'stringDouble', this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_log10', this, 'double', this.__typeAdapter)
        }
    }
    sqrt(): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation0ValueSource('_sqrt', this, 'stringDouble', this.__typeAdapter)
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation0ValueSource('_sqrt', this, 'stringDouble', this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_sqrt', this, 'double', this.__typeAdapter)
        }
    }
    cbrt(): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation0ValueSource('_cbrt', this, 'stringDouble', this.__typeAdapter)
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation0ValueSource('_cbrt', this, 'stringDouble', this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_cbrt', this, 'double', this.__typeAdapter)
        }
    }
    sign(): any {
        return new SqlOperation0ValueSource('_sign', this, 'int', this.__typeAdapter)
    }
    // Trigonometric Functions
    acos(): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation0ValueSource('_acos', this, 'stringDouble', this.__typeAdapter)
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation0ValueSource('_acos', this, 'stringDouble', this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_acos', this, 'double', this.__typeAdapter)
        }
    }
    asin(): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation0ValueSource('_asin', this, 'stringDouble', this.__typeAdapter)
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation0ValueSource('_asin', this, 'stringDouble', this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_asin', this, 'double', this.__typeAdapter)
        }
    }
    atan(): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation0ValueSource('_atan', this, 'stringDouble', this.__typeAdapter)
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation0ValueSource('_atan', this, 'stringDouble', this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_atan', this, 'double', this.__typeAdapter)
        }
    }
    cos(): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation0ValueSource('_cos', this, 'stringDouble', this.__typeAdapter)
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation0ValueSource('_cos', this, 'stringDouble', this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_cos', this, 'double', this.__typeAdapter)
        }
    }
    cot(): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation0ValueSource('_cot', this, 'stringDouble', this.__typeAdapter)
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation0ValueSource('_cot', this, 'stringDouble', this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_cot', this, 'double', this.__typeAdapter)
        }
    }
    sin(): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation0ValueSource('_sin', this, 'stringDouble', this.__typeAdapter)
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation0ValueSource('_sin', this, 'stringDouble', this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_sin', this, 'double', this.__typeAdapter)
        }
    }
    tan(): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation0ValueSource('_tan', this, 'stringDouble', this.__typeAdapter)
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation0ValueSource('_tan', this, 'stringDouble', this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_tan', this, 'double', this.__typeAdapter)
        }
    }
    // Date & Time Functions
    getDate(): any {
        return new SqlOperation0ValueSource('_getDate', this, 'int', this.__typeAdapter)
    }
    getTime(): any {
        return new SqlOperation0ValueSource('_getTime', this, 'int', this.__typeAdapter)
    }
    getFullYear(): any {
        return new SqlOperation0ValueSource('_getFullYear', this, 'int', this.__typeAdapter)
    }
    getMonth(): any {
        return new SqlOperation0ValueSource('_getMonth', this, 'int', this.__typeAdapter)
    }
    getDay(): any {
        return new SqlOperation0ValueSource('_getDay', this, 'int', this.__typeAdapter)
    }
    getHours(): any {
        return new SqlOperation0ValueSource('_getHours', this, 'int', this.__typeAdapter)
    }
    getMinutes(): any {
        return new SqlOperation0ValueSource('_getMinutes', this, 'int', this.__typeAdapter)
    }
    getSeconds(): any {
        return new SqlOperation0ValueSource('_getSeconds', this, 'int', this.__typeAdapter)
    }
    getMilliseconds(): any {
        return new SqlOperation0ValueSource('_getMilliseconds', this, 'int', this.__typeAdapter)
    }
    // SqlFunction1
    valueWhenNull(value: any): any {
        return new SqlOperation1ValueSource('_valueWhenNull', this, value, this.__columnType, getTypeAdapter2(this, value))
    }
    and(value: any): any {
        return new SqlOperation1ValueSource('_and', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    or(value: any): any {
        return new SqlOperation1ValueSource('_or', this, value, 'boolean', getTypeAdapter2(this, value))
    }
    // Trigonometric Functions
    atan2(value: any): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation1ValueSource('_atan2', this, value, 'stringDouble', getTypeAdapter2(this, value))
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation1ValueSource('_atan2', this, value, 'stringDouble', getTypeAdapter2(this, value))
        } else {
            return new SqlOperation1ValueSource('_atan2', this, value, 'double', getTypeAdapter2(this, value))
        }
    }
    // String Functions
    concat(value: any): any {
        return new SqlOperation1ValueSource('_concat', this, value, this.__columnType, getTypeAdapter2(this, value))
    }
    concatIfValue(value: any): any {
        if (value === null || value === undefined || value === '') {
            return this
        }
        return new SqlOperation1ValueSource('_concat', this, value, this.__columnType, getTypeAdapter2(this, value))
    }
    substringToEnd(start: any): any {
        return new SqlOperation1ValueSource('_substringToEnd', this, start, this.__columnType, getTypeAdapter2(this, start))
    }
    // Number
    power(value: any): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation1ValueSource('_power', this, value, 'stringDouble', getTypeAdapter2(this, value))
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation1ValueSource('_power', this, value, 'stringDouble', getTypeAdapter2(this, value))
        } else {
            return new SqlOperation1ValueSource('_power', this, value, 'double', getTypeAdapter2(this, value))
        }
    }
    logn(value: any): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation1ValueSource('_logn', this, value, 'stringDouble', getTypeAdapter2(this, value))
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation1ValueSource('_logn', this, value, 'stringDouble', getTypeAdapter2(this, value))
        } else {
            return new SqlOperation1ValueSource('_logn', this, value, 'double', getTypeAdapter2(this, value))
        }
    }
    roundn(value: any): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation1ValueSource('_roundn', this, value, 'stringDouble', getTypeAdapter2(this, value))
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation1ValueSource('_roundn', this, value, 'stringDouble', getTypeAdapter2(this, value))
        } else {
            return new SqlOperation1ValueSource('_roundn', this, value, 'double', getTypeAdapter2(this, value))
        }
    }
    minValue(value: any): any {
        return createSqlOperation1ofOverloadedNumber(this, value, '_minValue')
    }
    maxValue(value: any): any {
        return createSqlOperation1ofOverloadedNumber(this, value, '_maxValue')
    }
    // Number operators
    add(value: any): any {
        return createSqlOperation1ofOverloadedNumber(this, value, '_add')
    }
    substract(value: any): any {
        return createSqlOperation1ofOverloadedNumber(this, value, '_substract')
    }
    multiply(value: any): any {
        return createSqlOperation1ofOverloadedNumber(this, value, '_multiply')
    }
    divide(value: any): any {
        if (this.__columnType === 'stringInt') {
            return new SqlOperation1ValueSource('_divide', this, value, 'stringDouble', getTypeAdapter2(this, value))
        } else if (this.__columnType === 'stringDouble') {
            return new SqlOperation1ValueSource('_divide', this, value, 'stringDouble', getTypeAdapter2(this, value))
        } else {
            return new SqlOperation1ValueSource('_divide', this, value, 'double', getTypeAdapter2(this, value))
        }
    }
    mod(value: any): any {
        return createSqlOperation1ofOverloadedNumber(this, value, '_mod')
    }
    // SqlFunction2
    substring(start: any, end: any): any {
        return new SqlOperation2ValueSource('_substring', this, start, end, this.__columnType, getTypeAdapter3(this, start, end))
    }
    replaceIfValue(findString: any, replaceWith: any): any {
        if (findString === null || findString === undefined || findString === '') {
            return this
        }
        if (replaceWith === null || replaceWith === undefined || replaceWith === '') {
            return this
        }
        return new SqlOperation2ValueSource('_replace', this, findString, replaceWith, this.__columnType, getTypeAdapter3(this, findString, replaceWith))
    }
    replace(findString: any, replaceWith: any): any {
        return new SqlOperation2ValueSource('_replace', this, findString, replaceWith, this.__columnType, getTypeAdapter3(this, findString, replaceWith))
    }
}

export class SqlOperationStatic0ValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof SqlOperationStatic0

    constructor(operation: keyof SqlOperationStatic0, columnType: string, typeAdapter: TypeAdapter | undefined) {
        super(columnType, typeAdapter)
        this.__operation = operation
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params)
    }
}

export class SqlOperationStatic1ValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof SqlOperationStatic1
    __value: any

    constructor(operation: keyof SqlOperationStatic1, value: any, columnType: string, typeAdapter: TypeAdapter | undefined) {
        super(columnType, typeAdapter)
        this.__operation = operation
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__value, this.__columnType, this.__typeAdapter)
    }
}

export class SqlOperation0ValueSource extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation0

    constructor(operation: keyof SqlOperation0, valueSource: ValueSourceImpl, columnType: string, typeAdapter: TypeAdapter | undefined) {
        super(columnType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__valueSource)
    }
}

export class SqlOperation1ValueSource extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation1
    __value: any

    constructor(operation: keyof SqlOperation1, valueSource: ValueSourceImpl, value: any, columnType: string, typeAdapter: TypeAdapter | undefined) {
        super(columnType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__valueSource, this.__value, this.__valueSource.__columnType, this.__valueSource.__typeAdapter)
    }
}

export class SqlOperation2ValueSource extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation2
    __value: any
    __value2: any

    constructor(operation: keyof SqlOperation2, valueSource: ValueSourceImpl, value: any, value2: any, columnType: string, typeAdapter?: TypeAdapter | undefined) {
        super(columnType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
        this.__value = value
        this.__value2 = value2
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__valueSource, this.__value, this.__value2, this.__valueSource.__columnType, this.__valueSource.__typeAdapter)
    }
}

export class NeutralBooleanValueSource extends ValueSourceImpl {
    constructor(columnType: string, typeAdapter: TypeAdapter | undefined) {
        super(columnType, typeAdapter)
    }
    __toSql(_sqlBuilder: SqlBuilder, _params: any[]): string {
        return ''
    }
}

export class NoopValueSource extends ValueSourceImpl {
    __valueSource: ValueSourceImpl
    constructor(valueSource: ValueSourceImpl, columnType: string, typeAdapter: TypeAdapter | undefined) {
        super(columnType, typeAdapter)
        this.__valueSource = valueSource
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return this.__valueSource.__toSql(sqlBuilder, params)
    }
}

export class SequenceValueSource extends ValueSourceImpl {
    __operation: keyof SqlSequenceOperation
    __sequenceName: string
    constructor(operation: keyof SqlSequenceOperation, sequenceName: string, columnType: string, typeAdapter: TypeAdapter | undefined) {
        super(columnType, typeAdapter)
        this.__operation = operation
        this.__sequenceName = sequenceName
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__sequenceName)
    }
}

export class FragmentValueSource extends ValueSourceImpl {
    __operation: keyof SqlFragmentOperation = '_fragment' // Needed to detect if parenthesis is required
    __sql: TemplateStringsArray
    __sqlParams: ValueSource<any, any, any>[]

    constructor(sql: TemplateStringsArray, sqlParams: ValueSource<any, any, any>[], columnType: string, typeAdapter: TypeAdapter | undefined) {
        super(columnType, typeAdapter)
        this.__sql = sql
        this.__sqlParams = sqlParams
    }

    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder._fragment(params, this.__sql, this.__sqlParams)
    }
}

export class AggregateFunctions0ValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof AggregateFunctions0

    constructor(operation: keyof AggregateFunctions0, columnType: string, typeAdapter: TypeAdapter | undefined) {
        super(columnType, typeAdapter)
        this.__operation = operation
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params)
    }
}

export class AggregateFunctions1ValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof AggregateFunctions1
    __value: any

    constructor(operation: keyof AggregateFunctions1, value: any, columnType: string, typeAdapter: TypeAdapter | undefined) {
        super(columnType, typeAdapter)
        this.__operation = operation
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__value)
    }
}

export class AggregateFunctions1or2ValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof AggregateFunctions1or2
    __value: any
    __separator: string | undefined

    constructor(operation: keyof AggregateFunctions1or2, separator: string | undefined, value: any, columnType: string, typeAdapter: TypeAdapter | undefined) {
        super(columnType, typeAdapter)
        this.__operation = operation
        this.__separator = separator
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__separator, this.__value)
    }
}

function getTypeAdapter2(a: ValueSourceImpl, b: any): TypeAdapter | undefined {
    if (a.__typeAdapter) {
        return a.__typeAdapter
    }
    if (b instanceof ValueSourceImpl) {
        return b.__typeAdapter
    }
    return undefined
}


function getTypeAdapter3(a: ValueSourceImpl, b: any, c: any): TypeAdapter | undefined {
    if (a.__typeAdapter) {
        return a.__typeAdapter
    }
    if (b instanceof ValueSourceImpl && b.__typeAdapter) {
        return b.__typeAdapter
    }
    if (c instanceof ValueSourceImpl) {
        return c.__typeAdapter
    }
    return undefined
}

function createSqlOperation1ofOverloadedNumber(thiz: ValueSourceImpl, value: any, operation: keyof SqlOperation1) {
    if (thiz.__columnType === 'double' || thiz.__columnType === 'stringDouble') {
        return new SqlOperation1ValueSource(operation, thiz, value, thiz.__columnType, getTypeAdapter2(thiz, value))
    }
    if (thiz.__columnType === 'stringInt') {
        if (value instanceof ValueSourceImpl) {
            if (value.__columnType === 'int' || value.__columnType === 'stringInt') {
                return new SqlOperation1ValueSource(operation, thiz, value, 'stringInt', thiz.__typeAdapter)
            } else {
                return new SqlOperation1ValueSource(operation, thiz, value, 'stringDouble', getTypeAdapter2(thiz, value))
            }
        }
        if (Number.isInteger(value)) {
            return new SqlOperation1ValueSource(operation, thiz, value, 'stringInt', thiz.__typeAdapter)
        } else {
            return new SqlOperation1ValueSource(operation, thiz, value, 'stringDouble', getTypeAdapter2(thiz, value))
        }
    } else {
        if (value instanceof ValueSourceImpl) {
            if (value.__columnType === 'int') {
                return new SqlOperation1ValueSource(operation, thiz, value, 'int', thiz.__typeAdapter)
            } else if (value.__columnType === 'stringInt') {
                return new SqlOperation1ValueSource(operation, thiz, value, 'stringInt', thiz.__typeAdapter)
            } else if (value.__columnType === 'stringDouble') {
                return new SqlOperation1ValueSource(operation, thiz, value, 'stringDouble', getTypeAdapter2(thiz, value))
            } else {
                return new SqlOperation1ValueSource(operation, thiz, value, 'double', getTypeAdapter2(thiz, value))
            }
        }
        if (Number.isInteger(value)) {
            return new SqlOperation1ValueSource(operation, thiz, value, 'int', thiz.__typeAdapter)
        } else {
            return new SqlOperation1ValueSource(operation, thiz, value, 'double', getTypeAdapter2(thiz, value))
        }
    }
}