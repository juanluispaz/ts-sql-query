import type { SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import type { IntType } from './number.js'
import type { INumberValue, OptionalityOf, SourceOf, DataTypeOf, ValueSource, OperandOf, DataTypeOfClass } from './base.js'
import type { CombinedOptionality } from './valueSource.js'
import type { additiveValueSource } from '../utils/symbols.js'
import type { NSource } from '../utils/sourceName.js'
import type { TypedValueSource } from './valueSource.js'
import { __registeredDataType } from './dataTypeRegistry.js'
import { __typeClassOf } from '../nodes/dataTypeClassOf.js'
import { __operation0, __operation1 } from '../nodes/operations.js'
import { __keptClassOf, __computedClassOf } from '../nodes/adaptedTypeClass.js'
import { doubleSqlDataType, intSqlDataType } from './numericSqlDataTypes.js'

/*
 * The numbers, by what they can do: each level adds operations, and a data type works only with itself (outside the
 * group number of number.ts, which combines an int and a double): what it takes and what it gives is its data type.
 *
 * ArithmeticType
 * ├── NumberType (number.ts)        the numbers of JavaScript: int and double work together
 * └── AdditiveType                  added and subtracted (a sum of money)
 *     ├── ScaledBigIntsType         the exact decimals kept as a bigint with its scale (scaledBigInts.ts)
 *     └── MultipliableType          multiplied
 *         ├── IntegersType          the integers: BigintType (bigint.ts)
 *         ├── DecimalsType          the exact decimals (decimals.ts): StringDecimalType, DnumDecimalsType (DnumDecimalType)
 *         └── DivisibleType         divided
 *             └── RealsType         the floating point numbers, with their functions
 *
 * A data type of the user extends the level of what it can do, with its type name; IntegersType, DecimalsType and
 * RealsType send and read it as an int, an exact decimal and a double, the others convert nothing.
 */

/** What a position that takes a value source of any number that works only with itself accepts (sum, average) */
export interface IAnyAdditiveValueSource</*in|out*/ SOURCE extends NSource> extends TypedValueSource<SOURCE, any, any> {
    [additiveValueSource]: 'AdditiveValueSource'
}

/** A number: the root of the numbers */
export abstract class ArithmeticType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    /** The data type of a value of a type of yours of this family, of that type name, for a specific use (see EqualableType.of) */
    declare static readonly of: <VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME, ...options: never[]) => DataTypeOfClass<ArithmeticType<VALUE_TYPE, TYPE_NAME>>
}

/**
 * A number that is added and subtracted with itself (a sum of money). A data type of the user extends it with its type
 * name, as a value only the user knows (the library converts nothing and gives it no SQL data type):
 * `class MoneyType extends AdditiveType<Money, 'Money'> { static override readonly type = 'Money' }`
 */
export abstract class AdditiveType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ArithmeticType<VALUE_TYPE, TYPE_NAME> {
    /** The data type of a value of a type of yours of this family, of that type name, for a specific use (see EqualableType.of) */
    declare static readonly of: <VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME, ...options: never[]) => DataTypeOfClass<AdditiveType<VALUE_TYPE, TYPE_NAME>>
    declare [additiveValueSource]: 'AdditiveValueSource'

    /** The absolute value of the number, `abs(x)`, of the same data type */
    abs(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    abs(): any {
        return __operation0(this, '_abs', __computedClassOf(this, __typeClassOf(this)))
    }
    /** The sign of the number, `sign(x)`: -1, 0 or 1, as an int */
    sign(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    sign(): any {
        return __operation0(this, '_sign', __registeredDataType('int'))
    }
    /**
     * The number, but at least the one given: the greater of the two, `greatest(x, value)` (a lower bound), of the same
     * data type; null when either is null
     */
    minValue(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The number, but at least the one given: the greater of the two, `greatest(x, value)` (a lower bound), of the same
     * data type; null when either is null
     */
    minValue<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    minValue(value: any): any {
        return __operation1(this, '_maximumBetweenTwoValues', value, __keptClassOf(this, __typeClassOf(this)))
    }
    /**
     * The number, but at most the one given: the smaller of the two, `least(x, value)` (an upper bound), of the same
     * data type; null when either is null
     */
    maxValue(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The number, but at most the one given: the smaller of the two, `least(x, value)` (an upper bound), of the same
     * data type; null when either is null
     */
    maxValue<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    maxValue(value: any): any {
        return __operation1(this, '_minimumBetweenTwoValues', value, __keptClassOf(this, __typeClassOf(this)))
    }
    /** The sum of the number and the one given, `x + value`, of the same data type; null when either is null */
    add(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /** The sum of the number and the one given, `x + value`, of the same data type; null when either is null */
    add<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    add(value: any): any {
        return __operation1(this, '_add', value, __computedClassOf(this, __typeClassOf(this)))
    }
    /** The number minus the one given, `x - value`, of the same data type; null when either is null */
    subtract(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /** The number minus the one given, `x - value`, of the same data type; null when either is null */
    subtract<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    subtract(value: any): any {
        return __operation1(this, '_subtract', value, __computedClassOf(this, __typeClassOf(this)))
    }
    /**
     * The remainder of dividing the number by the one given, `x % value` (`mod(x, value)` on Oracle), with the sign of
     * the number, of the same data type; null when either is null
     */
    modulo(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The remainder of dividing the number by the one given, `x % value` (`mod(x, value)` on Oracle), with the sign of
     * the number, of the same data type; null when either is null
     */
    modulo<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    modulo(value: any): any {
        return __operation1(this, '_modulo', value, __computedClassOf(this, __typeClassOf(this)))
    }
}

/** A number that is also multiplied by itself; a data type of the user extends it as AdditiveType */
export abstract class MultipliableType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends AdditiveType<VALUE_TYPE, TYPE_NAME> {
    /** The data type of a value of a type of yours of this family, of that type name, for a specific use (see EqualableType.of) */
    declare static readonly of: <VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME, ...options: never[]) => DataTypeOfClass<MultipliableType<VALUE_TYPE, TYPE_NAME>>
    /** The product of the number and the one given, `x * value`, of the same data type; null when either is null */
    multiply(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /** The product of the number and the one given, `x * value`, of the same data type; null when either is null */
    multiply<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    multiply(value: any): any {
        return __operation1(this, '_multiply', value, __computedClassOf(this, __typeClassOf(this)))
    }
}

/**
 * An integer number that works only with itself (bigint, and a data type of the user). A data type of the user extends
 * it with its type name, sent and read as an int, a JavaScript number, unless its class says another SQL data type or
 * another conversion: `class QuantityType extends IntegersType<number, 'Quantity'> { static override readonly type = 'Quantity' }`
 */
export abstract class IntegersType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends MultipliableType<VALUE_TYPE, TYPE_NAME> {
    /** The data type of a value of a type of yours of this family, of that type name, for a specific use (see EqualableType.of) */
    declare static readonly of: <VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME, ...options: never[]) => DataTypeOfClass<IntegersType<VALUE_TYPE, TYPE_NAME>>
    static override readonly sqlDataType: SqlDataType | undefined = intSqlDataType
}

/** A number that is also divided by itself; a data type of the user extends it as AdditiveType */
export abstract class DivisibleType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends MultipliableType<VALUE_TYPE, TYPE_NAME> {
    /** The data type of a value of a type of yours of this family, of that type name, for a specific use (see EqualableType.of) */
    declare static readonly of: <VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME, ...options: never[]) => DataTypeOfClass<DivisibleType<VALUE_TYPE, TYPE_NAME>>
    /** The number divided by the one given, `x / value`, of the same data type; null when either is null */
    divide(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /** The number divided by the one given, `x / value`, of the same data type; null when either is null */
    divide<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    divide(value: any): any {
        return __operation1(this, '_divide', value, __computedClassOf(this, __typeClassOf(this)))
    }
}

/**
 * A floating point number that works only with itself: its floating point functions keep its data type. A data type of
 * the user extends it with its type name, sent and read as a double:
 * `class RatioType extends RealsType<number, 'Ratio'> { static override readonly type = 'Ratio' }`
 */
export abstract class RealsType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends DivisibleType<VALUE_TYPE, TYPE_NAME> {
    /** The data type of a value of a type of yours of this family, of that type name, for a specific use (see EqualableType.of) */
    declare static readonly of: <VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME, ...options: never[]) => DataTypeOfClass<RealsType<VALUE_TYPE, TYPE_NAME>>
    static override readonly sqlDataType: SqlDataType | undefined = doubleSqlDataType

    /**
     * The smallest integer greater than or equal to the number, `ceil(x)` (`ceiling` on SQL Server), of the same data
     * type
     */
    ceil(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    ceil(): any {
        return __operation0(this, '_ceil', __computedClassOf(this, __typeClassOf(this)))
    }
    /** The greatest integer less than or equal to the number, `floor(x)`, of the same data type */
    floor(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    floor(): any {
        return __operation0(this, '_floor', __computedClassOf(this, __typeClassOf(this)))
    }
    /**
     * The number rounded to the nearest integer, `round(x)`, of the same data type; ties go away from zero (2.5 gives
     * 3, -2.5 gives -3), unless the connection sets `usePlatformDependentRound`
     */
    round(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    round(): any {
        return __operation0(this, '_round', __computedClassOf(this, __typeClassOf(this)))
    }
    /**
     * The number rounded to the decimals given, `round(x, decimals)`, of the same data type; ties go away from zero
     * (2.5 gives 3, -2.5 gives -3), unless the connection sets `usePlatformDependentRound`. A number of decimals given
     * with a fraction is rounded to an integer; null when either is null
     */
    roundn(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The number rounded to the decimals given, `round(x, decimals)`, of the same data type; ties go away from zero
     * (2.5 gives 3, -2.5 gives -3), unless the connection sets `usePlatformDependentRound`. A number of decimals given
     * with a fraction is rounded to an integer; null when either is null
     */
    roundn(value: number): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The number rounded to the decimals given, `round(x, decimals)`, of the same data type; ties go away from zero
     * (2.5 gives 3, -2.5 gives -3), unless the connection sets `usePlatformDependentRound`. A number of decimals given
     * with a fraction is rounded to an integer; null when either is null
     */
    roundn<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /**
     * The number rounded to the decimals given, `round(x, decimals)`, of the same data type; ties go away from zero
     * (2.5 gives 3, -2.5 gives -3), unless the connection sets `usePlatformDependentRound`. A number of decimals given
     * with a fraction is rounded to an integer; null when either is null
     */
    roundn<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    roundn(value: any): any {
        return __operation1(this, '_roundn', value, __computedClassOf(this, __typeClassOf(this)))
    }
    /** e raised to the number, `exp(x)`, as the same data type */
    exp(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    exp(): any {
        return __operation0(this, '_exp', __typeClassOf(this))
    }
    /** The natural logarithm (base e) of the number, `ln(x)`, as the same data type */
    ln(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    ln(): any {
        return __operation0(this, '_ln', __typeClassOf(this))
    }
    /** The logarithm in base 10 of the number, as the same data type */
    log10(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    log10(): any {
        return __operation0(this, '_log10', __typeClassOf(this))
    }
    /** The square root of the number, `sqrt(x)`, as the same data type */
    sqrt(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    sqrt(): any {
        return __operation0(this, '_sqrt', __typeClassOf(this))
    }
    /**
     * The cube root of the number, as the same data type; a negative number has one too: it is written as
     * `sign(x) * power(abs(x), 1.0e0 / 3.0e0)`
     */
    cbrt(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    cbrt(): any {
        return __operation0(this, '_cbrt', __typeClassOf(this))
    }
    /** The arc cosine of the number, in radians, `acos(x)`, as the same data type */
    acos(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    acos(): any {
        return __operation0(this, '_acos', __typeClassOf(this))
    }
    /** The arc sine of the number, in radians, `asin(x)`, as the same data type */
    asin(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    asin(): any {
        return __operation0(this, '_asin', __typeClassOf(this))
    }
    /** The arc tangent of the number, in radians, `atan(x)`, as the same data type */
    atan(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    atan(): any {
        return __operation0(this, '_atan', __typeClassOf(this))
    }
    /** The cosine of the number, an angle in radians, `cos(x)`, as the same data type */
    cos(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    cos(): any {
        return __operation0(this, '_cos', __typeClassOf(this))
    }
    /** The cotangent of the number, an angle in radians, `cot(x)`, as the same data type */
    cot(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    cot(): any {
        return __operation0(this, '_cot', __typeClassOf(this))
    }
    /** The sine of the number, an angle in radians, `sin(x)`, as the same data type */
    sin(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    sin(): any {
        return __operation0(this, '_sin', __typeClassOf(this))
    }
    /** The tangent of the number, an angle in radians, `tan(x)`, as the same data type */
    tan(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    tan(): any {
        return __operation0(this, '_tan', __typeClassOf(this))
    }
    /** The number raised to the power given, `power(x, value)`, as the same data type; null when either is null */
    power(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /** The number raised to the power given, `power(x, value)`, as the same data type; null when either is null */
    power<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    power(value: any): any {
        return __operation1(this, '_power', value, __typeClassOf(this))
    }
    /**
     * The logarithm of the number in the base given, `log(base, x)` (`log(x, base)` on SQL Server), as the same data
     * type; null when either is null
     */
    logn(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The logarithm of the number in the base given, `log(base, x)` (`log(x, base)` on SQL Server), as the same data
     * type; null when either is null
     */
    logn<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    logn(value: any): any {
        return __operation1(this, '_logn', value, __typeClassOf(this))
    }
    /**
     * The arc tangent of the number divided by the one given, `atan2(x, value)` (`atn2` on SQL Server), in radians and
     * in the quadrant of the signs of both, as the same data type; null when either is null
     */
    atan2(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The arc tangent of the number divided by the one given, `atan2(x, value)` (`atn2` on SQL Server), in radians and
     * in the quadrant of the signs of both, as the same data type; null when either is null
     */
    atan2<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    atan2(value: any): any {
        return __operation1(this, '_atan2', value, __typeClassOf(this))
    }
}
