import type { CustomType } from '../TypeAdapter.js'
import { __isExactDecimal } from './dataTypes.js'
import { NumericType } from './numeric.js'
import type { INumberValue, OptionalOf, SourceOf, TypeOf, ValueSource } from './base.js'
import type { MergeOptional } from './valueSource.js'
import { operandTypeName, typeName, runtimeTypes } from '../utils/symbols.js'
import type { intType } from '../utils/symbols.js'
import { IntType, DoubleType, BigintType } from './number.js'

/*
 * The exact decimal numbers: their value keeps every digit (the library sends and reads it as its text); what can't be
 * exact gives a double.
 */

/**
 * The family of the exact decimal numbers: the value keeps every digit; a computation that can't be exact gives a
 * double. Its data types are stringDecimal and the custom ones; a decimal of a library extends it
 */
export abstract class DecimalsType</*in|out*/ VALUE_TYPE> extends NumericType<VALUE_TYPE> {
    /** While its methods still live in ValueSourceImpl: the built-in data types they give */
    static readonly [runtimeTypes] = { int: IntType, double: DoubleType, bigint: BigintType }
    /** Whether a type and a custom type are of an exact decimal: a stringDecimal or a customDecimal */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return __isExactDecimal(type, customType)
    }

    declare [intType]: IntType

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
export abstract class StringDecimalType extends DecimalsType<string> {
    static override readonly type = 'stringDecimal'
    static override readonly customType = undefined
    declare [typeName]: 'type:stringDecimal:'
    declare [operandTypeName]: 'type:stringDecimal:'
}
