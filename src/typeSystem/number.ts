import type { CustomType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import { IntegersType } from './numeric.js'
import type { INumberValue, OptionalOf, SourceOf, TypeOf, ValueSource } from './base.js'
import type { MergeOptional } from './valueSource.js'
import { operandTypeName, typeName } from '../utils/symbols.js'
import type { intType, numberTypes } from '../utils/symbols.js'

/*
 * The numbers of JavaScript and the custom ones of them. int and double are the numbers of JavaScript and work
 * together, in the group `number`: an operand of one can be the other, and an operation of an int with a double gives a
 * double. NumberType, the data type of both, is what a result is when TypeScript can't know which of them it is. bigint,
 * the JavaScript bigint, and the custom numbers work only with themselves (numeric.ts).
 */

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
    declare [numberTypes]: { number: NumberType, int: IntType, double: DoubleType }

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

/** An integer number of 64 bits, a JavaScript bigint */
export abstract class BigintType extends IntegersType<bigint> {
    static override readonly type = 'bigint'
    static override readonly customType = undefined
    declare [intType]: IntType
    declare [typeName]: 'type:bigint:'
    declare [operandTypeName]: 'type:bigint:'
}
