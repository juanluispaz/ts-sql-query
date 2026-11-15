import type { CustomType } from '../TypeAdapter.js'
import { __isAggregatedArray } from './dataTypes.js'
import type { OptionalOf, SourceOf, TypeOf, ValueSource } from './base.js'
import { ValueSourceBaseType } from './valueSourceBase.js'
import type { ColumnMarkersOf } from './valueSource.js'
import { operandTypeName, typeName } from '../utils/symbols.js'
import { __sameTypeClassOf } from '../nodes/dataTypeClassOf.js'
import { __newNoopValueSource } from '../nodes/operations.js'
import { type ValueSourceRoot, __asRequiredInOptionalObjectOf, __ignoreWhenAsNullOf, __onlyWhenOrNullOf } from '../nodes/valueSourceRoot.js'
import { __adaptedTypeClassOf, __keptClassOf } from '../nodes/adaptedTypeClass.js'

/** The family of the arrays an aggregate as array gives: what every one offers */
export abstract class AggregatedArraysType</*in|out*/ VALUE_TYPE> extends ValueSourceBaseType<VALUE_TYPE> {
    /** Whether a type and a custom type are of an aggregated array */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return __isAggregatedArray(type, customType)
    }

    useEmptyArrayForNoValue(): ValueSource<SourceOf<this>, TypeOf<this>, 'required'>
    useEmptyArrayForNoValue(): any {
        const vs = this as unknown as ValueSourceRoot
        const nodeWithOptionalType = vs.__node.withOptionalType
        if (nodeWithOptionalType) {
            return nodeWithOptionalType(vs, 'required')
        }
        const result = __newNoopValueSource(vs, __keptClassOf(vs, __sameTypeClassOf(vs)), 'required')
        if (vs.__aggregatedArrayColumns) {
            result.__aggregatedArrayColumns = vs.__aggregatedArrayColumns
            result.__aggregatedArrayMode = vs.__aggregatedArrayMode
            result.__aggreagtedProjectingOptionalValuesAsNullable = vs.__aggreagtedProjectingOptionalValuesAsNullable
        }
        return result
    }
    asOptionalNonEmptyArray(): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    asOptionalNonEmptyArray(): any {
        const vs = this as unknown as ValueSourceRoot
        const nodeWithOptionalType = vs.__node.withOptionalType
        if (nodeWithOptionalType) {
            return nodeWithOptionalType(vs, 'optional')
        }
        const result = __newNoopValueSource(vs, __keptClassOf(vs, __sameTypeClassOf(vs)), 'optional')
        if (vs.__aggregatedArrayColumns) {
            result.__aggregatedArrayColumns = vs.__aggregatedArrayColumns
            result.__aggregatedArrayMode = vs.__aggregatedArrayMode
            result.__aggreagtedProjectingOptionalValuesAsNullable = vs.__aggreagtedProjectingOptionalValuesAsNullable
        }
        return result
    }
    asRequiredInOptionalObject(): ValueSource<SourceOf<this>, TypeOf<this>, 'requiredInOptionalObject'> & ColumnMarkersOf<this>
    asRequiredInOptionalObject(): any {
        return __asRequiredInOptionalObjectOf(this)
    }
    onlyWhenOrNull(when: boolean): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    onlyWhenOrNull(when: boolean): any {
        return __onlyWhenOrNullOf(this, when)
    }
    ignoreWhenAsNull(when: boolean): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    ignoreWhenAsNull(when: boolean): any {
        return __ignoreWhenAsNullOf(this, when)
    }
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
    projectingOptionalValuesAsNullable(): ValueSource<SourceOf<this>, AggregatedArrayType<STRICT_VALUE_TYPE>, OptionalOf<this>>
    projectingOptionalValuesAsNullable(): any {
        const vs = this as unknown as ValueSourceRoot
        const nodeProjectingOptionalValuesAsNullable = vs.__node.projectingOptionalValuesAsNullable
        return nodeProjectingOptionalValuesAsNullable ? nodeProjectingOptionalValuesAsNullable(vs) : vs
    }
}
