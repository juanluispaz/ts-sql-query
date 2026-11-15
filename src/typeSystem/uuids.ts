import type { CustomType } from '../TypeAdapter.js'
import { __isUuid } from './dataTypes.js'
import { ComparableType } from './comparable.js'
import type { OptionalOf, SourceOf, ValueSource } from './base.js'
import { operandTypeName, typeName, runtimeTypes } from '../utils/symbols.js'
import { StringType } from './strings.js'

/** A uuid: comparable, but not a text; its text is asked with asString */
export abstract class UuidsType</*in|out*/ VALUE_TYPE> extends ComparableType<VALUE_TYPE> {
    /** While its methods still live in ValueSourceImpl: the built-in data types they give */
    static readonly [runtimeTypes] = { string: StringType }
    /** Whether a type and a custom type are of a uuid or a customUuid */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return __isUuid(type, customType)
    }

    abstract asString(): ValueSource<SourceOf<this>, StringType, OptionalOf<this>>
}

/** A uuid, a JavaScript string */
export abstract class UuidType extends UuidsType<string> {
    static override readonly type = 'uuid'
    static override readonly customType = undefined
    declare [typeName]: 'type:uuid:'
    declare [operandTypeName]: 'type:uuid:'
}
