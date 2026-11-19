import type { SqlDataType } from '../TypeAdapter.js'
import type { OptionalityOf, SourceOf, DataTypeOf, ValueSource } from './base.js'
import { ValueSourceBaseType } from './valueSourceBase.js'
import type { ColumnMarkersOf } from './valueSource.js'
import { operandTypeName, typeName } from '../utils/symbols.js'
import { __sameTypeClassOf } from '../nodes/dataTypeClassOf.js'
import { __newNoopValueSource } from '../nodes/operations.js'
import { __asRequiredInOptionalObjectOf, __ignoreWhenAsNullOf, __onlyWhenOrNullOf } from '../nodes/valueSourceRoot.js'
import { __keptClassOf } from '../nodes/adaptedTypeClass.js'
import { __asNodeValueSource, __keepAggregatedArrayShape } from '../nodes/NodeStrategy.js'

/** The type in the database of an aggregated array: a JSON document */
const aggregatedArraySqlDataType: SqlDataType = { family: 'document', format: 'json' }

/** The family of the arrays an aggregate as array gives: what every one offers */
export abstract class AggregatedArraysType</*in|out*/ VALUE_TYPE> extends ValueSourceBaseType<VALUE_TYPE> {
    static override readonly sqlDataType: SqlDataType = aggregatedArraySqlDataType

    /**
     * An empty array when there are no values to aggregate (no rows, or a null in the place of the array): the default.
     * The result is required
     */
    useEmptyArrayForNoValue(): ValueSource<SourceOf<this>, DataTypeOf<this>, 'required'>
    useEmptyArrayForNoValue(): any {
        const vs = __asNodeValueSource(this)
        const nodeWithOptionalType = vs.__node.withOptionalType
        if (nodeWithOptionalType) {
            return nodeWithOptionalType(vs, 'required')
        }
        const result = __newNoopValueSource(vs, __keptClassOf(vs, __sameTypeClassOf(vs)), 'required')
        __keepAggregatedArrayShape(result, vs)
        return result
    }
    /**
     * No value when there are no values to aggregate: the property is left out of the result, never an empty array. The
     * result is optional, an array with at least one element when it has a value
     */
    asOptionalNonEmptyArray(): ValueSource<SourceOf<this>, DataTypeOf<this>, 'optional'>
    asOptionalNonEmptyArray(): any {
        const vs = __asNodeValueSource(this)
        const nodeWithOptionalType = vs.__node.withOptionalType
        if (nodeWithOptionalType) {
            return nodeWithOptionalType(vs, 'optional')
        }
        const result = __newNoopValueSource(vs, __keptClassOf(vs, __sameTypeClassOf(vs)), 'optional')
        __keepAggregatedArrayShape(result, vs)
        return result
    }
    /**
     * The array is required when the nested object of the projection that holds it is there: with no values to
     * aggregate, that object is left out of the result
     */
    asRequiredInOptionalObject(): ValueSource<SourceOf<this>, DataTypeOf<this>, 'requiredInOptionalObject'> & ColumnMarkersOf<this>
    asRequiredInOptionalObject(): any {
        return __asRequiredInOptionalObjectOf(this)
    }
    /**
     * The array when the argument is true; otherwise the query has a null in its place (an inline query isn't sent) and
     * the property is left out of the result. The result is optional; `useEmptyArrayForNoValue()` afterwards gives an
     * empty array instead
     */
    onlyWhenOrNull(when: boolean): ValueSource<SourceOf<this>, DataTypeOf<this>, 'optional'>
    onlyWhenOrNull(when: boolean): any {
        return __onlyWhenOrNullOf(this, when)
    }
    /**
     * The opposite of `onlyWhenOrNull`: a null in the place of the array when the argument is true (an inline query
     * isn't sent), and the array otherwise. The result is optional
     */
    ignoreWhenAsNull(when: boolean): ValueSource<SourceOf<this>, DataTypeOf<this>, 'optional'>
    ignoreWhenAsNull(when: boolean): any {
        return __ignoreWhenAsNullOf(this, when)
    }
}

/** The array an aggregate as array gives: the rows it aggregates, as objects or as the values of one column */
export abstract class AggregatedArrayType</*in|out*/ VALUE_TYPE> extends AggregatedArraysType<VALUE_TYPE> {
    static override readonly type = 'aggregatedArray'
    declare [typeName]: 'type:aggregatedArray:'
    declare [operandTypeName]: 'type:aggregatedArray:'
}

/** An aggregated array whose optional values can be projected as null, with the type it has then */
export abstract class AggregatedArrayProjectableAsNullableType</*in|out*/ VALUE_TYPE, /*in|out*/ STRICT_VALUE_TYPE> extends AggregatedArrayType<VALUE_TYPE> {
    /**
     * In an array of objects, an optional property with no value is `null` in the element instead of being left out:
     * `birthday: Date | null` instead of `birthday?: Date`. It goes immediately after `aggregateAsArray(...)`, and it
     * changes only this array, not the select that holds it
     */
    projectingOptionalValuesAsNullable(): ValueSource<SourceOf<this>, AggregatedArrayType<STRICT_VALUE_TYPE>, OptionalityOf<this>>
    projectingOptionalValuesAsNullable(): any {
        const vs = __asNodeValueSource(this)
        const nodeProjectingOptionalValuesAsNullable = vs.__node.projectingOptionalValuesAsNullable
        return nodeProjectingOptionalValuesAsNullable ? nodeProjectingOptionalValuesAsNullable(vs) : vs
    }
}
