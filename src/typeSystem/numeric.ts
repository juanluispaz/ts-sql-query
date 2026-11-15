import type { CustomType } from '../TypeAdapter.js'
import { __isBigint, __isExactDecimal } from './dataTypes.js'
import { ComparableType } from './comparable.js'
import type { IntType } from './number.js'
import type { INumberValue, IValueWithType, OptionalOf, SourceOf, TypeOf, ValueSource } from './base.js'
import type { MergeOptional } from './valueSource.js'
import { intType, type operandTypeName } from '../utils/symbols.js'
import { __typeClassOf } from '../nodes/dataTypeClassOf.js'
import { __operation0, __operation1 } from '../nodes/operations.js'

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

    abs(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abs(): any {
        return __operation0(this, '_abs', __typeClassOf(this))
    }
    ceil(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    ceil(): any {
        return __operation0(this, '_ceil', __typeClassOf(this))
    }
    floor(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    floor(): any {
        return __operation0(this, '_floor', __typeClassOf(this))
    }
    round(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    round(): any {
        return __operation0(this, '_round', __typeClassOf(this))
    }
    sign(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    sign(): any {
        return __operation0(this, '_sign', (this.constructor as any)[intType])
    }
    minValue(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    minValue<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    minValue(value: any): any {
        return __operation1(this, '_maximumBetweenTwoValues', value, __typeClassOf(this))
    }
    maxValue(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    maxValue<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    maxValue(value: any): any {
        return __operation1(this, '_minimumBetweenTwoValues', value, __typeClassOf(this))
    }
    add(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    add<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    add(value: any): any {
        return __operation1(this, '_add', value, __typeClassOf(this))
    }
    subtract(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    subtract<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    subtract(value: any): any {
        return __operation1(this, '_subtract', value, __typeClassOf(this))
    }
    modulo(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    modulo<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    modulo(value: any): any {
        return __operation1(this, '_modulo', value, __typeClassOf(this))
    }
    multiply(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    multiply<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    multiply(value: any): any {
        return __operation1(this, '_multiply', value, __typeClassOf(this))
    }
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

    exp(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    exp(): any {
        return __operation0(this, '_exp', __typeClassOf(this))
    }
    ln(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    ln(): any {
        return __operation0(this, '_ln', __typeClassOf(this))
    }
    log10(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    log10(): any {
        return __operation0(this, '_log10', __typeClassOf(this))
    }
    sqrt(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    sqrt(): any {
        return __operation0(this, '_sqrt', __typeClassOf(this))
    }
    cbrt(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    cbrt(): any {
        return __operation0(this, '_cbrt', __typeClassOf(this))
    }
    acos(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    acos(): any {
        return __operation0(this, '_acos', __typeClassOf(this))
    }
    asin(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    asin(): any {
        return __operation0(this, '_asin', __typeClassOf(this))
    }
    atan(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    atan(): any {
        return __operation0(this, '_atan', __typeClassOf(this))
    }
    cos(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    cos(): any {
        return __operation0(this, '_cos', __typeClassOf(this))
    }
    cot(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    cot(): any {
        return __operation0(this, '_cot', __typeClassOf(this))
    }
    sin(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    sin(): any {
        return __operation0(this, '_sin', __typeClassOf(this))
    }
    tan(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    tan(): any {
        return __operation0(this, '_tan', __typeClassOf(this))
    }
    power(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    power<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    power(value: any): any {
        return __operation1(this, '_power', value, __typeClassOf(this))
    }
    logn(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    logn<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    logn(value: any): any {
        return __operation1(this, '_logn', value, __typeClassOf(this))
    }
    roundn(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    roundn(value: number): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    roundn<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    roundn<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    roundn(value: any): any {
        return __operation1(this, '_roundn', value, __typeClassOf(this))
    }
    divide(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    divide<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    divide(value: any): any {
        return __operation1(this, '_divide', value, __typeClassOf(this))
    }
    atan2(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    atan2<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    atan2(value: any): any {
        return __operation1(this, '_atan2', value, __typeClassOf(this))
    }
}
