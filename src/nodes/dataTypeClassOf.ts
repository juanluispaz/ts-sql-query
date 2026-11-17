import { __unadaptedClassOf } from './adaptedTypeClass.js'
import { __getOldValues, __getTableOrViewPrivate, __getValuesForInsert, __hasAggregation, __isAllowed, __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import { computedType } from '../utils/symbols.js'
import { __addWiths } from '../utils/ITableOrView.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import type { AnyValueSource, OptionalType, __AggregatedArrayColumns, __AggregatedArrayMode } from '../typeSystem/valueSource.js'
import type { NodeValueSource } from './NodeStrategy.js'
import { __asNodeValueSource } from './NodeStrategy.js'
import { type AnyType } from '../typeSystem/base.js'

/** How a value source is created from the class of its data type, which extends ValueSourceRoot at run time */
export type ValueSourceConstructor = new (optionalType: OptionalType, aggregatedArrayColumns?: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode?: __AggregatedArrayMode, aggregatedProjectingOptionalValuesAsNullable?: boolean) => NodeValueSource

/**
 * The class of the data type of a value source computed from this one: its own class, or the one its class says in
 * `static [computedType]` (the text of a uuid gives a text)
 */
export function __typeClassOf(valueSource: AnyType | NodeValueSource): DataTypeClass {
    const typeClass = __sameTypeClassOf(valueSource) as any
    return typeClass[computedType] ?? typeClass
}

/**
 * The class of the data type of a value source, for a value source that keeps its SQL (`allowWhen`, `asOptional`, ...),
 * without its type adapter (the one created gets its own)
 */
export function __sameTypeClassOf(valueSource: AnyType | NodeValueSource): DataTypeClass {
    // Every value source of a class has its node (the raw fragment of a table, which has no data type, hasn't)
    if ((valueSource as { __node?: unknown }).__node) {
        return __unadaptedClassOf(valueSource.constructor as unknown as DataTypeClass)
    }
    throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'unexpected value' }, 'The value source has no class of a data type')
}
