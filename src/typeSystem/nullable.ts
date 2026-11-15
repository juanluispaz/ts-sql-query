import type { CustomType } from '../TypeAdapter.js'
import { __isAggregatedArray } from './dataTypes.js'
import type { AnyType, BooleanOf, IValueWithType, OptionalOf, SourceOf, TypeOf, ValueSource } from './base.js'
import { ValueSourceBaseType } from './valueSourceBase.js'
import type { ColumnMarkersOf } from './valueSource.js'
import type { numberTypes, operandTypeName } from '../utils/symbols.js'

/** The data types of the group number (declared with `numberTypes` by NumberType) */
export interface NumberTypes {
    number: AnyType
    int: AnyType
    double: AnyType
}

/**
 * The data type of the value of a null replaced by a fallback: the data type of the value source, but a number widens
 * like in an operation (coalesce(<int>, <double>) is a double). OPERAND is the data type of the fallback, or
 * `'value'` for a value given as a JavaScript value (a number can be either an int or a double)
 */
export type CoalesceTypeOf<X, OPERAND> =
    TypeOf<X> extends { [numberTypes]: infer NUMBER extends NumberTypes } ? (
        TypeOf<X> extends NUMBER['double'] ? NUMBER['double'] :
        OPERAND extends NUMBER['double'] ? NUMBER['double'] :
        OPERAND extends NUMBER['int'] ? TypeOf<X> :
        NUMBER['number']
    ) : TypeOf<X>

/** A data type whose value can be null */
export abstract class NullableType</*in|out*/ VALUE_TYPE> extends ValueSourceBaseType<VALUE_TYPE> {
    /** Whether a type and a custom type are of a data type with a null value: every one but an aggregated array */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return !__isAggregatedArray(type, customType)
    }

    abstract isNull(): ValueSource<SourceOf<this>, BooleanOf<this>, 'required'>
    abstract isNotNull(): ValueSource<SourceOf<this>, BooleanOf<this>, 'required'>
    abstract valueWhenNull(value: VALUE_TYPE): ValueSource<SourceOf<this>, CoalesceTypeOf<this, 'value'>, 'required'>
    abstract valueWhenNull<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, CoalesceTypeOf<this, TypeOf<VALUE>>, OptionalOf<VALUE>>
    abstract nullIfValue(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    abstract nullIfValue<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, 'optional'>
    abstract asOptional(): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    abstract asRequiredInOptionalObject(): ValueSource<SourceOf<this>, TypeOf<this>, 'requiredInOptionalObject'> & ColumnMarkersOf<this>
    abstract onlyWhenOrNull(when: boolean): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    abstract ignoreWhenAsNull(when: boolean): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
}
