import type { CustomType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import { BigintType } from './bigint.js'
import type { INumberValue, OptionalOf, SourceOf, TypeOf, ValueSource } from './base.js'
import type { MergeOptional } from './valueSource.js'
import { operandTypeName, typeName } from '../utils/symbols.js'
import { __typeClassOf } from '../nodes/dataTypeClassOf.js'
import { getOptionalType2, getTypeAdapter2 } from '../nodes/operands.js'
import { __newNoopValueSource, __newSqlOperation1ValueSource, __operation0, __operation1 } from '../nodes/operations.js'
import { type ValueSourceRoot } from '../nodes/valueSourceRoot.js'
import type { DataTypeValueSource } from '../nodes/NodeStrategy.js'
import type { SqlOperation1 } from '../sqlBuilders/SqlBuilder.js'
import { isValueSource } from './valueSource.js'

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
    /** The int and the double of the group (valueWhenNull of an int with a double gives a double) */
    /** Whether a type and a custom type are of the group number: an int or a double */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return customType === undefined && (type === 'int' || type === 'double')
    }

    declare [typeName]: `type:${string}:number:`
    declare [operandTypeName]: `type:${string}:number:`

    /** The number as an int: a double is rounded (DoubleType), an int stays as it is */
    asInt(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    asInt(): any {
        const vs = this as unknown as ValueSourceRoot
        return __newNoopValueSource(vs, IntType, vs.__optionalType, vs.__typeAdapter)
    }
    asDouble(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    asDouble(): any {
        return __operation0(this, '_asDouble', DoubleType)
    }
    /** The number as a bigint: a double is rounded (DoubleType), an int stays as it is */
    asBigint(): ValueSource<SourceOf<this>, BigintType, OptionalOf<this>>
    asBigint(): any {
        const vs = this as unknown as ValueSourceRoot
        return __newNoopValueSource(vs, BigintType, vs.__optionalType, vs.__typeAdapter)
    }
    abs(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abs(): any {
        return __operation0(this, '_abs', __typeClassOf(this))
    }
    ceil(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    ceil(): any {
        return __operation0(this, '_ceil', IntType)
    }
    floor(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    floor(): any {
        return __operation0(this, '_floor', IntType)
    }
    round(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    round(): any {
        return __operation0(this, '_round', IntType)
    }
    exp(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    exp(): any {
        return __operation0(this, '_exp', DoubleType)
    }
    ln(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    ln(): any {
        return __operation0(this, '_ln', DoubleType)
    }
    log10(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    log10(): any {
        return __operation0(this, '_log10', DoubleType)
    }
    sqrt(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    sqrt(): any {
        return __operation0(this, '_sqrt', DoubleType)
    }
    cbrt(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    cbrt(): any {
        return __operation0(this, '_cbrt', DoubleType)
    }
    sign(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    sign(): any {
        return __operation0(this, '_sign', IntType)
    }
    acos(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    acos(): any {
        return __operation0(this, '_acos', DoubleType)
    }
    asin(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    asin(): any {
        return __operation0(this, '_asin', DoubleType)
    }
    atan(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    atan(): any {
        return __operation0(this, '_atan', DoubleType)
    }
    cos(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    cos(): any {
        return __operation0(this, '_cos', DoubleType)
    }
    cot(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    cot(): any {
        return __operation0(this, '_cot', DoubleType)
    }
    sin(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    sin(): any {
        return __operation0(this, '_sin', DoubleType)
    }
    tan(): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    tan(): any {
        return __operation0(this, '_tan', DoubleType)
    }
    power(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    power<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    power(value: any): any {
        return __operation1(this, '_power', value, DoubleType)
    }
    logn(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    logn<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    logn(value: any): any {
        return __operation1(this, '_logn', value, DoubleType)
    }
    roundn(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    roundn<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    roundn(value: any): any {
        return __operation1(this, '_roundn', value, DoubleType)
    }
    minValue(value: number): ValueSource<SourceOf<this>, PromotedNumberType<TypeOf<this>, NumberType>, OptionalOf<this>>
    minValue<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PromotedNumberType<TypeOf<this>, TypeOf<VALUE>>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    minValue(value: any): any {
        return promotedNumberOperation(this, value, '_maximumBetweenTwoValues')
    }
    maxValue(value: number): ValueSource<SourceOf<this>, PromotedNumberType<TypeOf<this>, NumberType>, OptionalOf<this>>
    maxValue<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PromotedNumberType<TypeOf<this>, TypeOf<VALUE>>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    maxValue(value: any): any {
        return promotedNumberOperation(this, value, '_minimumBetweenTwoValues')
    }
    add(value: number): ValueSource<SourceOf<this>, PromotedNumberType<TypeOf<this>, NumberType>, OptionalOf<this>>
    add<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PromotedNumberType<TypeOf<this>, TypeOf<VALUE>>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    add(value: any): any {
        return promotedNumberOperation(this, value, '_add')
    }
    subtract(value: number): ValueSource<SourceOf<this>, PromotedNumberType<TypeOf<this>, NumberType>, OptionalOf<this>>
    subtract<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PromotedNumberType<TypeOf<this>, TypeOf<VALUE>>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    subtract(value: any): any {
        return promotedNumberOperation(this, value, '_subtract')
    }
    multiply(value: number): ValueSource<SourceOf<this>, PromotedNumberType<TypeOf<this>, NumberType>, OptionalOf<this>>
    multiply<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PromotedNumberType<TypeOf<this>, TypeOf<VALUE>>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    multiply(value: any): any {
        return promotedNumberOperation(this, value, '_multiply')
    }
    divide(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    divide<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    divide(value: any): any {
        return __operation1(this, '_divide', value, DoubleType)
    }
    modulo(value: number): ValueSource<SourceOf<this>, PromotedNumberType<TypeOf<this>, NumberType>, OptionalOf<this>>
    modulo<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PromotedNumberType<TypeOf<this>, TypeOf<VALUE>>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    modulo(value: any): any {
        return promotedNumberOperation(this, value, '_modulo')
    }
    atan2(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    atan2<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    atan2(value: any): any {
        return __operation1(this, '_atan2', value, DoubleType)
    }
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

    /** A double is rounded */
    override asInt(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>> {
        return __operation0(this, '_asInt', IntType)
    }
    /** A double is rounded */
    override asBigint(): ValueSource<SourceOf<this>, BigintType, OptionalOf<this>> {
        return __operation0(this, '_asBigint', BigintType)
    }
}


/**
 * An operation of an int or a double with another number (add, minValue, ...): a double with a double; an int with an
 * int, a double with a double. A number given as a value is an int when it is an integer (TypeScript can't tell 2 from
 * 2.5: the value decides it)
 */
function promotedNumberOperation(valueSource: DataTypeValueSource, value: any, operation: keyof SqlOperation1): any {
    const vs = valueSource as ValueSourceRoot
    if (vs instanceof DoubleType) {
        return __operation1(vs, operation, value, DoubleType)
    }
    if (isValueSource(value) ? value instanceof IntType : Number.isInteger(value)) {
        return __newSqlOperation1ValueSource(operation, vs, value, IntType, getOptionalType2(vs, value), vs.__typeAdapter)
    }
    return __newSqlOperation1ValueSource(operation, vs, value, DoubleType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
}
