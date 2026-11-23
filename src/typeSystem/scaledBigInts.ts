import type { DataTypeClass, SqlDataType } from '../TypeAdapter.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { AdditiveType } from './numeric.js'
import { decimalSqlDataType } from './numericSqlDataTypes.js'
import { __typeClassOf } from '../nodes/dataTypeClassOf.js'
import { __operation0, __operation1 } from '../nodes/operations.js'
import type { INumberValue, OptionalityOf, SourceOf, DataTypeOf, ValueSource, DataTypeOfClass } from './base.js'
import type { CombinedOptionality } from './valueSource.js'
import { arithmeticOperandClass, ofStatics } from '../utils/symbols.js'
import type { OfStatics } from './dataTypeOfName.js'
import { DoubleType, IntType } from './number.js'
import { __computedClassOf } from '../nodes/adaptedTypeClass.js'

/*
 * The exact decimals kept as a bigint with its scale in its type: `ScaledBigInt<2>` keeps cents, and `12345n` is
 * 123.45. At run time it is a plain bigint; the scale is in the class of its data type, created once for each scale.
 */

/**
 * A `bigint` with its scale in its type: `ScaledBigInt<2>` keeps cents, and `12345n` is 123.45. At run time it is a
 * plain `bigint`: whoever writes it also receives its scale, and the type checks it is the one of the value. It is
 * created with `scaledBigInt`. The scale is 0 or more: an integer, also of a column of a negative scale (as
 * `numeric(7, -2)`, whose values are multiples of 100), is the bigint itself, of the scale 0
 */
export type ScaledBigInt<SCALE extends number> = bigint & { readonly __scale: SCALE }

/** The scale of a `ScaledBigInt`: `ScaleOf<ScaledBigInt<4>>` is `4` */
export type ScaleOf<T extends ScaledBigInt<number>> = T['__scale']

/**
 * The `bigint` given as a `ScaledBigInt` of that scale: `scaledBigInt(12345n, 2)` is 123.45. It only says the type: the
 * value is the same bigint
 */
export function scaledBigInt<SCALE extends number>(value: bigint, scale: SCALE): ScaledBigInt<SCALE> {
    scale
    return value as ScaledBigInt<SCALE>
}

/**
 * The family of the exact decimals kept as a `ScaledBigInt`: a bigint and the scale of its class, sent and read as the
 * text of the decimal (`12345n` with the scale 2 is `123.45`). The scale is the one of its values, so an operation
 * that would give more decimals isn't offered: they are added, subtracted and rounded, not multiplied nor divided; a
 * computation that can't be exact gives a double. A value read with a digit beyond the scale is rejected, never cut.
 * A type of yours extends it, with the scale in its SQL data type: `class PriceType extends ScaledBigIntsType<Price,
 * 'Price'> { static override readonly type = 'Price'; static override readonly sqlDataType = { family: 'exact numeric',
 * scale: 2 } }`, or, for a specific use, `ScaledBigIntsType.of<Price, 'Price'>('Price', 2)`; the one of the library
 * of a scale is `ScaledBigIntType.of(2)`, of the type name 'ScaledBigInt<2>'
 */
export abstract class ScaledBigIntsType</*in|out*/ VALUE_TYPE extends ScaledBigInt<number>, /*in|out*/ TYPE_NAME extends string> extends AdditiveType<VALUE_TYPE, TYPE_NAME> {
    /**
     * The type of the values in the database, which says their scale, the number of their decimals:
     * `{ family: 'exact numeric', scale: 2 }`. The family says none: a class of yours says the scale of its values
     */
    static override readonly sqlDataType: SqlDataType | undefined = decimalSqlDataType

    /**
     * The data type of a scaled bigint of yours, of that type name and scale, for a specific use, like a column:
     * `this.column('price', ScaledBigIntsType.of<Price, 'Price'>('Price', 2))` (see EqualableType.of); the scale is an
     * integer of 0 or more
     */
    declare static readonly of: {
        <VALUE_TYPE extends ScaledBigInt<number>, TYPE_NAME extends string>(typeName: TYPE_NAME, scale: number): DataTypeOfClass<ScaledBigIntsType<VALUE_TYPE, TYPE_NAME>>
        /** Only so that the family extends AdditiveType, whose values can be of any type: it can't be called */
        (typeName: never, ...options: never[]): never
    }
    /** The statics of the data type `of` makes: the SQL data type of its scale */
    static override [ofStatics](options: readonly unknown[]): OfStatics {
        const scale = options[0]
        if (options.length !== 1 || typeof scale !== 'number' || !Number.isSafeInteger(scale) || scale < 0) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'scale', value: scale }, 'Invalid scale of a scaled bigint: ' + String(scale) + ' is not an integer of 0 or more')
        }
        const sqlDataType: SqlDataType = { family: 'exact numeric', scale }
        return { sqlDataType }
    }

    /**
     * A number of JavaScript given to an arithmetic operation (the decimals of `roundn`, the exponent of `power`, ...)
     * is an int when it is an integer and a double otherwise
     */
    static [arithmeticOperandClass](value: unknown): DataTypeClass | undefined {
        if (typeof value === 'number') {
            return Number.isInteger(value) ? IntType : DoubleType
        }
        return undefined
    }

    /** The smallest integer greater than or equal to the number, `ceil(x)` (`ceiling` on SQL Server), of the same data type */
    ceil(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    ceil(): any {
        return __operation0(this, '_ceil', __computedClassOf(this, __typeClassOf(this)))
    }
    /** The greatest integer less than or equal to the number, `floor(x)`, of the same data type */
    floor(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    floor(): any {
        return __operation0(this, '_floor', __computedClassOf(this, __typeClassOf(this)))
    }
    /** The number rounded to the nearest integer, `round(x)`, of the same data type; ties go away from zero */
    round(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    round(): any {
        return __operation0(this, '_round', __computedClassOf(this, __typeClassOf(this)))
    }
    /**
     * The number rounded to the decimals given, `round(x, decimals)`, of the same data type; ties go away from zero. A
     * number of decimals given with a fraction is rounded to an integer; null when either is null
     */
    roundn(value: number): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The number rounded to the decimals given, `round(x, decimals)`, of the same data type; ties go away from zero. A
     * number of decimals given with a fraction is rounded to an integer; null when either is null
     */
    roundn<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    roundn(value: any): any {
        return __operation1(this, '_roundn', value, __computedClassOf(this, __typeClassOf(this)))
    }

    /** e raised to the number, `exp(x)`, as a double: it can't be exact */
    exp(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    exp(): any {
        return __operation0(this, '_exp', DoubleType)
    }
    /** The natural logarithm (base e) of the number, `ln(x)`, as a double: it can't be exact */
    ln(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    ln(): any {
        return __operation0(this, '_ln', DoubleType)
    }
    /** The logarithm in base 10 of the number, as a double: it can't be exact */
    log10(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    log10(): any {
        return __operation0(this, '_log10', DoubleType)
    }
    /** The square root of the number, `sqrt(x)`, as a double: it can't be exact */
    sqrt(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    sqrt(): any {
        return __operation0(this, '_sqrt', DoubleType)
    }
    /**
     * The cube root of the number, as a double: it can't be exact; a negative number has one too: it is written
     * as `sign(x) * power(abs(x), 1.0e0 / 3.0e0)`
     */
    cbrt(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    cbrt(): any {
        return __operation0(this, '_cbrt', DoubleType)
    }
    /** The arc cosine of the number, in radians, `acos(x)`, as a double: it can't be exact */
    acos(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    acos(): any {
        return __operation0(this, '_acos', DoubleType)
    }
    /** The arc sine of the number, in radians, `asin(x)`, as a double: it can't be exact */
    asin(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    asin(): any {
        return __operation0(this, '_asin', DoubleType)
    }
    /** The arc tangent of the number, in radians, `atan(x)`, as a double: it can't be exact */
    atan(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    atan(): any {
        return __operation0(this, '_atan', DoubleType)
    }
    /** The cosine of the number, an angle in radians, `cos(x)`, as a double: it can't be exact */
    cos(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    cos(): any {
        return __operation0(this, '_cos', DoubleType)
    }
    /** The cotangent of the number, an angle in radians, `cot(x)`, as a double: it can't be exact */
    cot(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    cot(): any {
        return __operation0(this, '_cot', DoubleType)
    }
    /** The sine of the number, an angle in radians, `sin(x)`, as a double: it can't be exact */
    sin(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    sin(): any {
        return __operation0(this, '_sin', DoubleType)
    }
    /** The tangent of the number, an angle in radians, `tan(x)`, as a double: it can't be exact */
    tan(): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    tan(): any {
        return __operation0(this, '_tan', DoubleType)
    }
    /**
     * The number raised to the power given, `power(x, value)`, as a double: it can't be exact; null when either is null
     */
    power(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    /**
     * The number raised to the power given, `power(x, value)`, as a double: it can't be exact; null when either is null
     */
    power<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    power(value: any): any {
        return __operation1(this, '_power', value, DoubleType)
    }
    /**
     * The logarithm of the number in the base given, `log(base, x)` (`log(x, base)` on SQL Server), as a double: it
     * can't be exact; null when either is null
     */
    logn(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    /**
     * The logarithm of the number in the base given, `log(base, x)` (`log(x, base)` on SQL Server), as a double: it
     * can't be exact; null when either is null
     */
    logn<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    logn(value: any): any {
        return __operation1(this, '_logn', value, DoubleType)
    }
    /**
     * The arc tangent of the number divided by the one given, `atan2(x, value)` (`atn2` on SQL Server), in radians and
     * in the quadrant of the signs of both, as a double: it can't be exact; null when either is null
     */
    atan2(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalityOf<this>>
    /**
     * The arc tangent of the number divided by the one given, `atan2(x, value)` (`atn2` on SQL Server), in radians and
     * in the quadrant of the signs of both, as a double: it can't be exact; null when either is null
     */
    atan2<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    atan2(value: any): any {
        return __operation1(this, '_atan2', value, DoubleType)
    }
}

/** A scale literal that is negative is never: a scale is 0 or more */
type NonNegativeScale<SCALE extends number> = `${SCALE}` extends `-${string}` ? never : unknown

/** The class of the data type of the values `ScaledBigInt<SCALE>` (see ScaledBigIntType.of) */
export type ScaledBigIntTypeClass<SCALE extends number> = Pick<typeof ScaledBigIntsType, Exclude<keyof typeof ScaledBigIntsType, 'prototype'>> & { readonly prototype: ScaledBigIntType<SCALE> } & (abstract new (...args: any[]) => ScaledBigIntType<SCALE>)

/** A value no one has: the type of the arguments of a signature that is there only to be compatible, never called */
declare const notCallable: unique symbol
type NotCallable = typeof notCallable

/** The classes of the data type of the scaled bigints, by their scale */
const typesOfScale: Array<ScaledBigIntTypeClass<number> | undefined> = []

/**
 * The data type of the values `ScaledBigInt<SCALE>`, of the type name `ScaledBigInt<SCALE>`, `'ScaledBigInt<2>'`: the
 * class of a scale is `ScaledBigIntType.of(2)`, and its name can be given wherever a type name goes
 */
export abstract class ScaledBigIntType</*in|out*/ SCALE extends number> extends ScaledBigIntsType<ScaledBigInt<SCALE>, `ScaledBigInt<${SCALE}>`> {
    /**
     * The class of the data type of the values `ScaledBigInt<SCALE>`, made once for each scale: a scale is an integer of
     * 0 or more (another one is rejected with INVALID_CONFIGURATION)
     */
    static override of<SCALE extends number>(scale: SCALE & NonNegativeScale<SCALE>): ScaledBigIntTypeClass<SCALE>
    /** Only so that it extends ScaledBigIntsType, whose of makes a data type of yours: it can't be called */
    static override of(typeName: NotCallable, scale: number): never
    static override of(scale: unknown): unknown {
        if (typeof scale !== 'number' || !Number.isSafeInteger(scale) || scale < 0) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'scale', value: scale }, 'Invalid scale of a scaled bigint: ' + String(scale) + ' is not an integer of 0 or more')
        }
        let result = typesOfScale[scale]
        if (!result) {
            const type = 'ScaledBigInt<' + scale + '>'
            const sqlDataType: SqlDataType = { family: 'exact numeric', scale }
            abstract class ScaledBigIntTypeOfThatScale extends ScaledBigIntType<number> {
                static override readonly type: string = type
                static override readonly sqlDataType: SqlDataType | undefined = sqlDataType
            }
            result = ScaledBigIntTypeOfThatScale as unknown as ScaledBigIntTypeClass<number>
            typesOfScale[scale] = result
        }
        return result
    }
}
