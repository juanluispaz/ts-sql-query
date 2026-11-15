import type { CustomType } from '../TypeAdapter.js'
import { __isExactDecimal } from './dataTypes.js'
import { NumericType } from './numeric.js'
import type { INumberValue, OptionalOf, SourceOf, TypeOf, ValueSource } from './base.js'
import type { DoubleType, IntType } from './number.js'
import type { MergeOptional } from './valueSource.js'
import { operandTypeName, typeName } from '../utils/symbols.js'
import type { intType } from '../utils/symbols.js'

/*
 * The exact decimal numbers: their value keeps every digit (the library sends and reads it as its text); what can't be
 * exact gives a double.
 */

/** An exact decimal number: its value keeps every digit; a computation that can't be exact gives a double */
export abstract class DecimalType</*in|out*/ VALUE_TYPE> extends NumericType<VALUE_TYPE> {
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
export abstract class StringDecimalType extends DecimalType<string> {
    static override readonly type = 'stringDecimal'
    static override readonly customType = undefined
    declare [typeName]: 'type:stringDecimal:'
    declare [operandTypeName]: 'type:stringDecimal:'
}
