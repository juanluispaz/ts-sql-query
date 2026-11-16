import type { DataTypeClass, SqlDataType } from '../TypeAdapter.js'
import { MultipliableType } from './numeric.js'
import { decimalSqlDataType } from './numericSqlDataTypes.js'
import { __typeClassOf } from '../nodes/dataTypeClassOf.js'
import { __operation0, __operation1 } from '../nodes/operations.js'
import type { INumberValue, OptionalOf, SourceOf, TypeOf, ValueSource } from './base.js'
import type { MergeOptional } from './valueSource.js'
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

    ceil(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    ceil(): any {
        return __operation0(this, '_ceil', __computedClassOf(this, __typeClassOf(this)))
    }
    floor(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    floor(): any {
        return __operation0(this, '_floor', __computedClassOf(this, __typeClassOf(this)))
    }
    round(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    round(): any {
        return __operation0(this, '_round', __computedClassOf(this, __typeClassOf(this)))
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
    roundn(value: number): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    roundn<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    roundn(value: any): any {
        return __operation1(this, '_roundn', value, __computedClassOf(this, __typeClassOf(this)))
    }
    atan2(value: number): ValueSource<SourceOf<this>, DoubleType, OptionalOf<this>>
    atan2<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DoubleType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    atan2(value: any): any {
        return __operation1(this, '_atan2', value, DoubleType)
    }
}

/** An exact decimal number that the library delivers as its text, a JavaScript string */
export abstract class StringDecimalType extends DecimalsType<string, 'stringDecimal'> {
    static override readonly type = 'stringDecimal'
    static override readonly customType = undefined
}
