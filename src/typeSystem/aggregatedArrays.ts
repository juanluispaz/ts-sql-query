import { ValueSourceBaseType, type OptionalOf, type SourceOf, type TypeOf, type ValueSource } from './base.js'
import type { ColumnMarkersOf } from './valueSource.js'
import { operandTypeName, typeName } from '../utils/symbols.js'

/** The array an aggregate as array gives: the rows it aggregates, as objects or as the values of one column */
export abstract class AggregatedArrayType</*in|out*/ VALUE_TYPE> extends ValueSourceBaseType<VALUE_TYPE> {
    static override readonly __type = 'aggregatedArray'
    static override readonly __customType = undefined
    declare [typeName]: 'type:aggregatedArray:'
    declare [operandTypeName]: 'type:aggregatedArray:'

    abstract useEmptyArrayForNoValue(): ValueSource<SourceOf<this>, TypeOf<this>, 'required'>
    abstract asOptionalNonEmptyArray(): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    abstract asRequiredInOptionalObject(): ValueSource<SourceOf<this>, TypeOf<this>, 'requiredInOptionalObject'> & ColumnMarkersOf<this>
    abstract onlyWhenOrNull(when: boolean): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    abstract ignoreWhenAsNull(when: boolean): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
}

/** An aggregated array whose optional values can be projected as null, with the type it has then */
export abstract class AggregatedArrayProjectableAsNullableType</*in|out*/ VALUE_TYPE, /*in|out*/ STRICT_VALUE_TYPE> extends AggregatedArrayType<VALUE_TYPE> {
    abstract projectingOptionalValuesAsNullable(): ValueSource<SourceOf<this>, AggregatedArrayType<STRICT_VALUE_TYPE>, OptionalOf<this>>
}
