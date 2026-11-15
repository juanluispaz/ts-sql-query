import type { CustomType } from '../TypeAdapter.js'
import { __isBigint, __isExactDecimal } from './dataTypes.js'
import { ComparableType } from './comparable.js'
import type { IValueWithType, OptionalOf, SourceOf, CustomTypeClass, TypeOf, ValueSource } from './base.js'
import type { MergeOptional } from './valueSource.js'
import { operandTypeName, typeName } from '../utils/symbols.js'

/*
 * The numbers. int and double are the numbers of JavaScript and work together, in the group `number`: an operand of
 * one can be the other, and an operation of an int with a double gives a double. NumberType, the data type of both,
 * is what a result is when TypeScript can't know which of them it is. Every other numeric data type (bigint, the exact
 * decimals and the custom ones) works only with itself.
 */

/** What a position that takes an int or a double accepts */
export type INumberValue = IValueWithType<`type:${string}:number:`>

/**
 * The data type of an operation of a number with another one, the way the library decides it: a double if any of them
 * is a double, an int if both are; when one of them can be either (a number given as a value: 2 and 2.5 are both a
 * `number` for TypeScript, and the library decides when it has the value), the number in general
 */
export type PromotedNumberType<RECEIVER, OPERAND> =
    RECEIVER extends DoubleType ? DoubleType :
    OPERAND extends DoubleType ? DoubleType :
    OPERAND extends IntType ? RECEIVER :
    NumberType

/** The int and the double, the numbers of JavaScript */
export abstract class NumberType extends ComparableType<number> {
    /** Whether a type and a custom type are of the group number: an int or a double */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return customType === undefined && (type === 'int' || type === 'double')
    }

    declare [typeName]: `type:${string}:number:`
    declare [operandTypeName]: `type:${string}:number:`

    abstract asInt(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>> // Maybe unsafe cast, the value is rounded when it is necessary
    abstract asDouble(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract asBigint(): ValueSource<SourceOf<this>, BigintType, OptionalOf<this>> // Maybe unsafe cast, the value is rounded when it is necessary
    abstract abs(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract ceil(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract floor(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract round(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract exp(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract ln(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract log10(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract sqrt(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract cbrt(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract sign(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract acos(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract asin(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract atan(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract cos(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract cot(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract sin(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract tan(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract power(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract power<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract logn(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract logn<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract roundn(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract roundn<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract minValue(value: number): ValueSource<SourceOf<this>, PromotedNumberType<TypeOf<this>, NumberType>, OptionalOf<this>>
    abstract minValue<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PromotedNumberType<TypeOf<this>, TypeOf<VALUE>>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract maxValue(value: number): ValueSource<SourceOf<this>, PromotedNumberType<TypeOf<this>, NumberType>, OptionalOf<this>>
    abstract maxValue<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PromotedNumberType<TypeOf<this>, TypeOf<VALUE>>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract add(value: number): ValueSource<SourceOf<this>, PromotedNumberType<TypeOf<this>, NumberType>, OptionalOf<this>>
    abstract add<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PromotedNumberType<TypeOf<this>, TypeOf<VALUE>>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract subtract(value: number): ValueSource<SourceOf<this>, PromotedNumberType<TypeOf<this>, NumberType>, OptionalOf<this>>
    abstract subtract<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PromotedNumberType<TypeOf<this>, TypeOf<VALUE>>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract multiply(value: number): ValueSource<SourceOf<this>, PromotedNumberType<TypeOf<this>, NumberType>, OptionalOf<this>>
    abstract multiply<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PromotedNumberType<TypeOf<this>, TypeOf<VALUE>>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract divide(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract divide<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract modulo(value: number): ValueSource<SourceOf<this>, PromotedNumberType<TypeOf<this>, NumberType>, OptionalOf<this>>
    abstract modulo<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PromotedNumberType<TypeOf<this>, TypeOf<VALUE>>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract atan2(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract atan2<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
}

/** An integer number, a JavaScript number */
export abstract class IntType extends NumberType {
    static override readonly type = 'int'
    static override readonly customType = undefined
    declare [typeName]: 'type:int:number:'
}

/** A floating point number, a JavaScript number */
export abstract class DoubleType extends NumberType {
    static override readonly type = 'double'
    static override readonly customType = undefined
    declare [typeName]: 'type:double:number:'
}

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
    abstract sign(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
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
export abstract class IntegerType</*in|out*/ VALUE_TYPE> extends NumericType<VALUE_TYPE> {
    /** Whether a type and a custom type are of an integer number that works only with itself: a bigint, a customInt or a customBigint */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return __isBigint(type, customType) || customType === 'customInt'
    }

}

/** An integer number of 64 bits, a JavaScript bigint */
export abstract class BigintType extends IntegerType<bigint> {
    static override readonly type = 'bigint'
    static override readonly customType = undefined
    declare [typeName]: 'type:bigint:'
    declare [operandTypeName]: 'type:bigint:'
}

/** An integer number of a type of the user, of its type name */
export abstract class CustomIntType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends IntegerType<VALUE_TYPE> {
    static override readonly customType = 'customInt'
    declare [typeName]: `type:${TYPE_NAME}:customInt:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customInt:`

    /** The data type of an integer number of a type of the user, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomIntType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomInt extends CustomIntType<VALUE_TYPE, TYPE_NAME> {
            static override readonly type = typeName
        }
        return CustomInt
    }
}

/** An integer number of 64 bits of a type of the user, of its type name */
export abstract class CustomBigintType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends IntegerType<VALUE_TYPE> {
    static override readonly customType = 'customBigint'
    declare [typeName]: `type:${TYPE_NAME}:customBigint:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customBigint:`

    /** The data type of an integer number of 64 bits of a type of the user, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomBigintType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomBigint extends CustomBigintType<VALUE_TYPE, TYPE_NAME> {
            static override readonly type = typeName
        }
        return CustomBigint
    }
}

/** A floating point number that works only with itself (customDouble): its floating point functions keep its data type */
export abstract class RealType</*in|out*/ VALUE_TYPE> extends NumericType<VALUE_TYPE> {
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

/** A floating point number of a type of the user, of its type name */
export abstract class CustomDoubleType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends RealType<VALUE_TYPE> {
    static override readonly customType = 'customDouble'
    declare [typeName]: `type:${TYPE_NAME}:customDouble:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customDouble:`

    /** The data type of a floating point number of a type of the user, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomDoubleType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomDouble extends CustomDoubleType<VALUE_TYPE, TYPE_NAME> {
            static override readonly type = typeName
        }
        return CustomDouble
    }
}

/** An exact decimal number: its value keeps every digit; a computation that can't be exact gives a double */
export abstract class DecimalType</*in|out*/ VALUE_TYPE> extends NumericType<VALUE_TYPE> {
    /** Whether a type and a custom type are of an exact decimal: a stringDecimal or a customDecimal */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return __isExactDecimal(type, customType)
    }

    abstract exp(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract ln(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract log10(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract sqrt(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract cbrt(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract acos(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract asin(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract atan(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract cos(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract cot(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract sin(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract tan(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract power(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract power<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract logn(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract logn<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract roundn(value: number): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract roundn<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract atan2(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    abstract atan2<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
}

/** An exact decimal number that the library delivers as its text, a JavaScript string */
export abstract class StringDecimalType extends DecimalType<string> {
    static override readonly type = 'stringDecimal'
    static override readonly customType = undefined
    declare [typeName]: 'type:stringDecimal:'
    declare [operandTypeName]: 'type:stringDecimal:'
}

/** An exact decimal number of a type of the user, of its type name */
export abstract class CustomDecimalType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends DecimalType<VALUE_TYPE> {
    static override readonly customType = 'customDecimal'
    declare [typeName]: `type:${TYPE_NAME}:customDecimal:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customDecimal:`

    /** The data type of an exact decimal number of a type of the user, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): CustomTypeClass<CustomDecimalType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomDecimal extends CustomDecimalType<VALUE_TYPE, TYPE_NAME> {
            static override readonly type = typeName
        }
        return CustomDecimal
    }
}
