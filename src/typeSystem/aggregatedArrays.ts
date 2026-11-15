import type { CustomType } from '../TypeAdapter.js'
import { __isAggregatedArray } from './dataTypes.js'
import type { OptionalOf, SourceOf, TypeOf, ValueSource } from './base.js'
import { ValueSourceBaseType } from './valueSourceBase.js'
import type { ColumnMarkersOf } from './valueSource.js'
import { operandTypeName, typeName } from '../utils/symbols.js'

/** The family of the arrays an aggregate as array gives: what every one offers */
export abstract class AggregatedArraysType</*in|out*/ VALUE_TYPE> extends ValueSourceBaseType<VALUE_TYPE> {
    /** Whether a type and a custom type are of an aggregated array */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return __isAggregatedArray(type, customType)
    }

    abstract useEmptyArrayForNoValue(): ValueSource<SourceOf<this>, TypeOf<this>, 'required'>
    abstract asOptionalNonEmptyArray(): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    abstract asRequiredInOptionalObject(): ValueSource<SourceOf<this>, TypeOf<this>, 'requiredInOptionalObject'> & ColumnMarkersOf<this>
    abstract onlyWhenOrNull(when: boolean): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    abstract ignoreWhenAsNull(when: boolean): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
}

/** The array an aggregate as array gives: the rows it aggregates, as objects or as the values of one column */
export abstract class AggregatedArrayType</*in|out*/ VALUE_TYPE> extends AggregatedArraysType<VALUE_TYPE> {
    static override readonly type = 'aggregatedArray'
    static override readonly customType = undefined
    declare [typeName]: 'type:aggregatedArray:'
    declare [operandTypeName]: 'type:aggregatedArray:'
}

/** An aggregated array whose optional values can be projected as null, with the type it has then */
export abstract class AggregatedArrayProjectableAsNullableType</*in|out*/ VALUE_TYPE, /*in|out*/ STRICT_VALUE_TYPE> extends AggregatedArrayType<VALUE_TYPE> {
    abstract projectingOptionalValuesAsNullable(): ValueSource<SourceOf<this>, AggregatedArrayType<STRICT_VALUE_TYPE>, OptionalOf<this>>
}
