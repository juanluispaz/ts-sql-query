import type { CustomType } from '../TypeAdapter.js'
import { __isBigint, __isExactDecimal } from './dataTypes.js'
import { ComparableType } from './comparable.js'
import type { INumberValue, IntOf, IValueWithType, OptionalOf, SourceOf, TypeOf, ValueSource } from './base.js'
import type { MergeOptional } from './valueSource.js'
import type { operandTypeName } from '../utils/symbols.js'

/*
 * The numeric data types that work only with themselves (bigint, the exact decimals and the custom numbers), by what
 * they share: their bases. The numbers of JavaScript are in number.ts and the exact decimals in decimals.ts.
 */

/** A numeric data type that works only with itself */
export abstract class NumericType</*in|out*/ VALUE_TYPE> extends ComparableType<VALUE_TYPE> {
    /** Whether a type and a custom type are of a number that works only with itself: a bigint, a stringDecimal or a custom number */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return __isBigint(type, customType) || __isExactDecimal(type, customType) || customType === 'customInt' || customType === 'customDouble'
    }

    abstract abs(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract ceil(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract floor(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract round(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract sign(): ValueSource<SourceOf<this>, IntOf<this>, OptionalOf<this>>
    abstract minValue(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract minValue<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract maxValue(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract maxValue<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract add(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract add<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract subtract(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract subtract<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract modulo(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract modulo<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract multiply(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract multiply<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
}

/** An integer number that works only with itself (bigint, customInt, customBigint) */
export abstract class IntegersType</*in|out*/ VALUE_TYPE> extends NumericType<VALUE_TYPE> {
    /** Whether a type and a custom type are of an integer number that works only with itself: a bigint, a customInt or a customBigint */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return __isBigint(type, customType) || customType === 'customInt'
    }

}

/** A floating point number that works only with itself (customDouble): its floating point functions keep its data type */
export abstract class RealsType</*in|out*/ VALUE_TYPE> extends NumericType<VALUE_TYPE> {
    /** Whether a type and a custom type are of a floating point number that works only with itself: a customDouble */
    protected static override __isOfGroup(_type: string, customType: CustomType | undefined): boolean {
        return customType === 'customDouble'
    }

    abstract exp(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract ln(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract log10(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract sqrt(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract cbrt(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract acos(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract asin(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract atan(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract cos(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract cot(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract sin(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract tan(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract power(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract power<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract logn(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract logn<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract roundn(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract roundn(value: number): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract roundn<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract roundn<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract divide(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract divide<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract atan2(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract atan2<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
}
