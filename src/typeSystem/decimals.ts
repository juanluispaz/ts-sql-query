import type { DataTypeClass, SqlDataType } from '../TypeAdapter.js'
import { MultipliableType } from './numeric.js'
import { decimalSqlDataType } from './numericSqlDataTypes.js'
import { __typeClassOf } from '../nodes/dataTypeClassOf.js'
import { __operation0, __operation1 } from '../nodes/operations.js'
import type { INumberValue, OptionalityOf, SourceOf, DataTypeOf, ValueSource } from './base.js'
import type { CombinedOptionality } from './valueSource.js'
import { arithmeticOperandClass } from '../utils/symbols.js'
import { DoubleType, IntType } from './number.js'
import { __computedClassOf } from '../nodes/adaptedTypeClass.js'

/*
 * The exact decimal numbers: their value keeps every digit (the library sends and reads it as its text); what can't be
 * exact gives a double.
 */

/**
 * The family of the exact decimal numbers: the value keeps every digit; a computation that can't be exact gives a
 * double. Its data types are stringDecimal and the ones of the user; a decimal of a library extends it. A data type of
 * the user extends it with its type name, sent and read as its text:
 * `class PriceType extends DecimalsType<Price, 'Price'> { static override readonly type = 'Price' }`
 */
export abstract class DecimalsType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends MultipliableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = decimalSqlDataType

    /**
     * A number of JavaScript given to an arithmetic operation of an exact decimal (the decimals of `roundn`, the exponent
     * of `power`, ...) is an int when it is an integer and a double otherwise; a decimal is given as its text
     */
    static [arithmeticOperandClass](value: unknown): DataTypeClass | undefined {
        if (typeof value === 'number') {
            return Number.isInteger(value) ? IntType : DoubleType
        }
        return undefined
    }

    /**
     * The smallest integer greater than or equal to the number, `ceil(x)` (`ceiling` on SQL Server), of the same data
     * type: exact
     */
    ceil(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    ceil(): any {
        return __operation0(this, '_ceil', __computedClassOf(this, __typeClassOf(this)))
    }
    /** The greatest integer less than or equal to the number, `floor(x)`, of the same data type: exact */
    floor(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    floor(): any {
        return __operation0(this, '_floor', __computedClassOf(this, __typeClassOf(this)))
    }
    /**
     * The number rounded to the nearest integer, `round(x)`, of the same data type: exact; ties go away from zero (2.5
     * gives 3, -2.5 gives -3)
     */
    round(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    round(): any {
        return __operation0(this, '_round', __computedClassOf(this, __typeClassOf(this)))
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
     * The number rounded to the decimals given, `round(x, decimals)`, of the same data type: exact; ties go away from
     * zero. A number of decimals given with a fraction is rounded to an integer; null when either is null
     */
    roundn(value: number): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The number rounded to the decimals given, `round(x, decimals)`, of the same data type: exact; ties go away from
     * zero. A number of decimals given with a fraction is rounded to an integer; null when either is null
     */
    roundn<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    roundn(value: any): any {
        return __operation1(this, '_roundn', value, __computedClassOf(this, __typeClassOf(this)))
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

/** An exact decimal number that the library delivers as its text, a JavaScript string */
export abstract class StringDecimalType extends DecimalsType<string, 'stringDecimal'> {
    static override readonly type = 'stringDecimal'
}
