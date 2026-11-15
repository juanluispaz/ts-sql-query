import type { CustomType } from '../TypeAdapter.js'
import { __isAggregatedArray } from './dataTypes.js'
import { ValueSourceBaseType, type IValueWithType, type OptionalOf, type SourceOf, type TypeOf, type ValueSource } from './base.js'
import type { BooleanType } from './booleans.js'
import type { ColumnMarkersOf } from './valueSource.js'
import type { operandTypeName } from '../utils/symbols.js'
import type { NumberType, PromotedNumberType } from './numbers.js'

/**
 * The data type of the value of a null replaced by a fallback: the data type of the value source, but a number widens
 * like in an operation (coalesce(<int>, <double>) is a double)
 */
export type CoalesceTypeOf<X, OPERAND> = TypeOf<X> extends NumberType ? PromotedNumberType<TypeOf<X>, OPERAND> : TypeOf<X>

/** A data type whose value can be null */
export abstract class NullableType</*in|out*/ VALUE_TYPE> extends ValueSourceBaseType<VALUE_TYPE> {
    /** Whether a type and a custom type are of a data type with a null value: every one but an aggregated array */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return !__isAggregatedArray(type, customType)
    }

    abstract isNull(): ValueSource<SourceOf<this>, BooleanType, 'required'>
    abstract isNotNull(): ValueSource<SourceOf<this>, BooleanType, 'required'>
    abstract valueWhenNull(value: VALUE_TYPE): ValueSource<SourceOf<this>, CoalesceTypeOf<this, NumberType>, 'required'>
    abstract valueWhenNull<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, CoalesceTypeOf<this, TypeOf<VALUE>>, OptionalOf<VALUE>>
    abstract nullIfValue(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    abstract nullIfValue<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, 'optional'>
    abstract asOptional(): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    abstract asRequiredInOptionalObject(): ValueSource<SourceOf<this>, TypeOf<this>, 'requiredInOptionalObject'> & ColumnMarkersOf<this>
    abstract onlyWhenOrNull(when: boolean): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    abstract ignoreWhenAsNull(when: boolean): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
}
