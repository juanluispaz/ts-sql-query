import type { DataTypeClass, SqlDataType } from '../TypeAdapter.js'
import { ArithmeticType } from './numeric.js'
import { doubleSqlDataType, intSqlDataType } from './numericSqlDataTypes.js'
import { BigintType } from './bigint.js'
import type { INumberValue, OptionalityOf, SourceOf, DataTypeOf, ValueSource } from './base.js'
import type { CombinedOptionality } from './valueSource.js'
import { arithmeticOperandClass, operandTypeName, typeName, valueOperandClass } from '../utils/symbols.js'
import { __typeClassOf } from '../nodes/dataTypeClassOf.js'
import { getOptionalType2 } from '../nodes/operands.js'
import { __newNoopValueSource, __newSqlOperation1ValueSource, __operation0, __operation1 } from '../nodes/operations.js'
import type { SqlOperation1 } from '../sqlBuilders/SqlBuilder.js'
import { __computedClassOf, __keptClassOf } from '../nodes/adaptedTypeClass.js'
import { type AnyType } from './base.js'
import { isValueSource, __asNodeValueSource } from '../nodes/NodeStrategy.js'

/*
 * The numbers of JavaScript: int and double work together, in the group `number`: an operand of one can be the other,
 * and an operation of an int with a double gives a double. NumberType, the data type of both, is what a result is when
 * TypeScript can't know which of them it is. The other numbers (bigint, the exact decimals, the ones of the user) work
 * only with themselves (numeric.ts, bigint.ts, decimals.ts).
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
export abstract class NumberType extends ArithmeticType<number, string> {
    /**
     * A number given to an arithmetic operation of a number is an int when it is an integer and a double otherwise, as
     * TypeScript can't tell 2 from 2.5; a bigint is a bigint
     */
    static [arithmeticOperandClass](value: unknown): DataTypeClass | undefined {
        if (typeof value === 'number') {
            const valueClass = Number.isInteger(value) ? IntType : DoubleType
            return isOfClass(this, valueClass) ? undefined : valueClass
        }
        if (typeof value === 'bigint') {
            return BigintType
        }
        return undefined
    }

    declare [typeName]: `type:${string}:number:`
    declare [operandTypeName]: `type:${string}:number:`

    /**
     * The number as an int: rounded to the nearest integer and cast to an integer type of the database; ties go away
     * from zero (2.5 gives 3, -2.5 gives -3), unless the connection sets `usePlatformDependentRound`
     */
    asInt(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    asInt(): any {
        return __operation0(this, '_asInt', IntType)
    }
    /** The number as a double: a double is kept as it is, and an int is cast to a floating point type */
    asDouble(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    asDouble(): any {
        const vs = __asNodeValueSource(this)
        return __newNoopValueSource(vs, DoubleType, vs.__optionalType)
    }
    /**
     * The number as a bigint: rounded to the nearest integer and cast to an integer type of the database; ties go away
     * from zero (2.5 gives 3, -2.5 gives -3), unless the connection sets `usePlatformDependentRound`
     */
    asBigint(): ValueSource<SourceOf<this>, BigintType, OptionalityOf<this>>
    asBigint(): any {
        return __operation0(this, '_asBigint', BigintType)
    }
    /** The absolute value of the number, `abs(x)`, of the same data type */
    abs(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    abs(): any {
        return __operation0(this, '_abs', __computedClassOf(this, __typeClassOf(this)))
    }
    /** The smallest integer greater than or equal to the number, `ceil(x)` (`ceiling` on SQL Server), as an int */
    ceil(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    ceil(): any {
        return __operation0(this, '_ceil', IntType)
    }
    /** The greatest integer less than or equal to the number, `floor(x)`, as an int */
    floor(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    floor(): any {
        return __operation0(this, '_floor', IntType)
    }
    /**
     * The number rounded to the nearest integer, `round(x)`, as an int; ties go away from zero (2.5 gives 3, -2.5 gives
     * -3), unless the connection sets `usePlatformDependentRound`
     */
    round(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    round(): any {
        return __operation0(this, '_round', IntType)
    }
    /** e raised to the number, `exp(x)`, as a double */
    exp(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    exp(): any {
        return __operation0(this, '_exp', DoubleType)
    }
    /** The natural logarithm (base e) of the number, `ln(x)`, as a double */
    ln(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    ln(): any {
        return __operation0(this, '_ln', DoubleType)
    }
    /** The logarithm in base 10 of the number, as a double */
    log10(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    log10(): any {
        return __operation0(this, '_log10', DoubleType)
    }
    /** The square root of the number, `sqrt(x)`, as a double */
    sqrt(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    sqrt(): any {
        return __operation0(this, '_sqrt', DoubleType)
    }
    /**
     * The cube root of the number, as a double; a negative number has one too: it is written as
     * `sign(x) * power(abs(x), 1.0e0 / 3.0e0)`
     */
    cbrt(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    cbrt(): any {
        return __operation0(this, '_cbrt', DoubleType)
    }
    /** The sign of the number, `sign(x)`: -1, 0 or 1, as an int */
    sign(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    sign(): any {
        return __operation0(this, '_sign', IntType)
    }
    /** The arc cosine of the number, in radians, `acos(x)`, as a double */
    acos(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    acos(): any {
        return __operation0(this, '_acos', DoubleType)
    }
    /** The arc sine of the number, in radians, `asin(x)`, as a double */
    asin(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    asin(): any {
        return __operation0(this, '_asin', DoubleType)
    }
    /** The arc tangent of the number, in radians, `atan(x)`, as a double */
    atan(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    atan(): any {
        return __operation0(this, '_atan', DoubleType)
    }
    /** The cosine of the number, an angle in radians, `cos(x)`, as a double */
    cos(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    cos(): any {
        return __operation0(this, '_cos', DoubleType)
    }
    /** The cotangent of the number, an angle in radians, `cot(x)`, as a double */
    cot(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    cot(): any {
        return __operation0(this, '_cot', DoubleType)
    }
    /** The sine of the number, an angle in radians, `sin(x)`, as a double */
    sin(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    sin(): any {
        return __operation0(this, '_sin', DoubleType)
    }
    /** The tangent of the number, an angle in radians, `tan(x)`, as a double */
    tan(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    tan(): any {
        return __operation0(this, '_tan', DoubleType)
    }
    /** The number raised to the power given, `power(x, value)`, as a double; null when either is null */
    power(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    /** The number raised to the power given, `power(x, value)`, as a double; null when either is null */
    power<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    power(value: any): any {
        return __operation1(this, '_power', value, DoubleType)
    }
    /**
     * The logarithm of the number in the base given, `log(base, x)` (`log(x, base)` on SQL Server), as a double; null
     * when either is null
     */
    logn(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    /**
     * The logarithm of the number in the base given, `log(base, x)` (`log(x, base)` on SQL Server), as a double; null
     * when either is null
     */
    logn<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    logn(value: any): any {
        return __operation1(this, '_logn', value, DoubleType)
    }
    /**
     * The number rounded to the decimals given, `round(x, decimals)`, as a double; ties go away from zero (2.5 gives 3,
     * -2.5 gives -3), unless the connection sets `usePlatformDependentRound`. A number of decimals given with a
     * fraction is rounded to an integer; null when either is null
     */
    roundn(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    /**
     * The number rounded to the decimals given, `round(x, decimals)`, as a double; ties go away from zero (2.5 gives 3,
     * -2.5 gives -3), unless the connection sets `usePlatformDependentRound`. A number of decimals given with a
     * fraction is rounded to an integer; null when either is null
     */
    roundn<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    roundn(value: any): any {
        return __operation1(this, '_roundn', value, DoubleType)
    }
    /**
     * The number, but at least the one given: the greater of the two, `greatest(x, value)` (a lower bound); null when
     * either is null. An int with a double gives a double; a number given as a value is an int when it is an integer
     * and a double otherwise
     */
    minValue(value: number): ValueSource<SourceOf<this>, PromotedNumberType<DataTypeOf<this>, NumberType>, OptionalityOf<this>>
    /**
     * The number, but at least the one given: the greater of the two, `greatest(x, value)` (a lower bound); null when
     * either is null. An int with a double gives a double; a number given as a value is an int when it is an integer
     * and a double otherwise
     */
    minValue<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PromotedNumberType<DataTypeOf<this>, DataTypeOf<VALUE>>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    minValue(value: any): any {
        return promotedNumberOperation(this, value, '_maximumBetweenTwoValues')
    }
    /**
     * The number, but at most the one given: the smaller of the two, `least(x, value)` (an upper bound); null when
     * either is null. An int with a double gives a double; a number given as a value is an int when it is an integer
     * and a double otherwise
     */
    maxValue(value: number): ValueSource<SourceOf<this>, PromotedNumberType<DataTypeOf<this>, NumberType>, OptionalityOf<this>>
    /**
     * The number, but at most the one given: the smaller of the two, `least(x, value)` (an upper bound); null when
     * either is null. An int with a double gives a double; a number given as a value is an int when it is an integer
     * and a double otherwise
     */
    maxValue<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PromotedNumberType<DataTypeOf<this>, DataTypeOf<VALUE>>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    maxValue(value: any): any {
        return promotedNumberOperation(this, value, '_minimumBetweenTwoValues')
    }
    /**
     * The sum of the number and the one given, `x + value`; null when either is null. An int with a double gives a
     * double; a number given as a value is an int when it is an integer and a double otherwise
     */
    add(value: number): ValueSource<SourceOf<this>, PromotedNumberType<DataTypeOf<this>, NumberType>, OptionalityOf<this>>
    /**
     * The sum of the number and the one given, `x + value`; null when either is null. An int with a double gives a
     * double; a number given as a value is an int when it is an integer and a double otherwise
     */
    add<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PromotedNumberType<DataTypeOf<this>, DataTypeOf<VALUE>>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    add(value: any): any {
        return promotedNumberOperation(this, value, '_add')
    }
    /**
     * The number minus the one given, `x - value`; null when either is null. An int with a double gives a double; a
     * number given as a value is an int when it is an integer and a double otherwise
     */
    subtract(value: number): ValueSource<SourceOf<this>, PromotedNumberType<DataTypeOf<this>, NumberType>, OptionalityOf<this>>
    /**
     * The number minus the one given, `x - value`; null when either is null. An int with a double gives a double; a
     * number given as a value is an int when it is an integer and a double otherwise
     */
    subtract<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PromotedNumberType<DataTypeOf<this>, DataTypeOf<VALUE>>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    subtract(value: any): any {
        return promotedNumberOperation(this, value, '_subtract')
    }
    /**
     * The product of the number and the one given, `x * value`; null when either is null. An int with a double gives a
     * double; a number given as a value is an int when it is an integer and a double otherwise
     */
    multiply(value: number): ValueSource<SourceOf<this>, PromotedNumberType<DataTypeOf<this>, NumberType>, OptionalityOf<this>>
    /**
     * The product of the number and the one given, `x * value`; null when either is null. An int with a double gives a
     * double; a number given as a value is an int when it is an integer and a double otherwise
     */
    multiply<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PromotedNumberType<DataTypeOf<this>, DataTypeOf<VALUE>>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    multiply(value: any): any {
        return promotedNumberOperation(this, value, '_multiply')
    }
    /**
     * The number divided by the one given, `x / value`, always a double, as `/` in JavaScript: there is no integer
     * division (`5 / 2` gives 2.5); null when either is null
     */
    divide(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    /**
     * The number divided by the one given, `x / value`, always a double, as `/` in JavaScript: there is no integer
     * division (`5 / 2` gives 2.5); null when either is null
     */
    divide<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    divide(value: any): any {
        return __operation1(this, '_divide', value, DoubleType)
    }
    /**
     * The remainder of dividing the number by the one given, `x % value` (`mod(x, value)` on Oracle), with the sign of
     * the number, as `%` in JavaScript; null when either is null. An int with a double gives a double; a number given
     * as a value is an int when it is an integer and a double otherwise
     */
    modulo(value: number): ValueSource<SourceOf<this>, PromotedNumberType<DataTypeOf<this>, NumberType>, OptionalityOf<this>>
    /**
     * The remainder of dividing the number by the one given, `x % value` (`mod(x, value)` on Oracle), with the sign of
     * the number, as `%` in JavaScript; null when either is null. An int with a double gives a double; a number given
     * as a value is an int when it is an integer and a double otherwise
     */
    modulo<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, PromotedNumberType<DataTypeOf<this>, DataTypeOf<VALUE>>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    modulo(value: any): any {
        return promotedNumberOperation(this, value, '_modulo')
    }
    /**
     * The arc tangent of the number divided by the one given, `atan2(x, value)` (`atn2` on SQL Server), in radians and
     * in the quadrant of the signs of both, as a double; null when either is null
     */
    atan2(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    /**
     * The arc tangent of the number divided by the one given, `atan2(x, value)` (`atn2` on SQL Server), in radians and
     * in the quadrant of the signs of both, as a double; null when either is null
     */
    atan2<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    atan2(value: any): any {
        return __operation1(this, '_atan2', value, DoubleType)
    }
}

/** An integer number, a JavaScript number */
export abstract class IntType extends NumberType {
    static override readonly type = 'int'
    static override readonly sqlDataType: SqlDataType = intSqlDataType
    declare [typeName]: 'type:int:number:'

    /** A value with a fraction compared with an int (or given as its fallback, ...) is a double; with a list or two bounds, any of them */
    static [valueOperandClass](value: unknown): DataTypeClass | undefined {
        return hasFraction(value) ? DoubleType : undefined
    }

    /** An int is already an int */
    override asInt(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    override asInt(): any {
        const vs = __asNodeValueSource(this)
        return __newNoopValueSource(vs, IntType, vs.__optionalType)
    }
    /** An int is converted to a double */
    override asDouble(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    override asDouble(): any {
        return __operation0(this, '_asDouble', DoubleType)
    }
    /** An int is a bigint as it is */
    override asBigint(): ValueSource<SourceOf<this>, BigintType, OptionalityOf<this>>
    override asBigint(): any {
        const vs = __asNodeValueSource(this)
        return __newNoopValueSource(vs, BigintType, vs.__optionalType)
    }
}

/** A floating point number, a JavaScript number */
export abstract class DoubleType extends NumberType {
    static override readonly type = 'double'
    static override readonly sqlDataType: SqlDataType = doubleSqlDataType
    declare [typeName]: 'type:double:number:'
}

/** Whether the class is the one given or extends it */
function isOfClass(typeClass: object, base: abstract new (...args: any) => any): boolean {
    return typeClass === base || (typeClass as { prototype: unknown }).prototype instanceof base
}

/** Whether a number given as a value has a fraction; a list (`in`) or the two bounds of `between`, any of them */
function hasFraction(value: unknown): boolean {
    if (Array.isArray(value)) {
        for (let i = 0, length = value.length; i < length; i++) {
            if (hasFraction(value[i])) {
                return true
            }
        }
        return false
    }
    return typeof value === 'number' && !Number.isInteger(value)
}

/**
 * An operation of an int or a double with another number (add, minValue, ...): a double when the receiver is a double;
 * an int when the operand is an int too (a number given as a value is an int when it is an integer: TypeScript can't
 * tell 2 from 2.5, the value decides); a double otherwise
 */
function promotedNumberOperation(valueSource: AnyType, value: any, operation: keyof SqlOperation1): any {
    const vs = __asNodeValueSource(valueSource)
    // The result keeps the conversions of the type adapter of the receiver while it keeps its data type. The minimum and
    // the maximum of two values are one of them, so they also keep its SQL data type (__keptClassOf); a value computed
    // from it doesn't (__computedClassOf). An int that becomes a double has neither
    const sameType = operation === '_minimumBetweenTwoValues' || operation === '_maximumBetweenTwoValues' ? __keptClassOf : __computedClassOf
    if (vs instanceof DoubleType) {
        return __operation1(vs, operation, value, sameType(vs, DoubleType))
    }
    if (isValueSource(value) ? value instanceof IntType : Number.isInteger(value)) {
        return __newSqlOperation1ValueSource(operation, vs, value, sameType(vs, IntType), getOptionalType2(vs, value))
    }
    return __newSqlOperation1ValueSource(operation, vs, value, DoubleType, getOptionalType2(vs, value))
}
