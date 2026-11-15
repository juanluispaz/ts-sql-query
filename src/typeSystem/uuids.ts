import type { CustomType } from '../TypeAdapter.js'
import { __isUuid } from './dataTypes.js'
import { ComparableType } from './comparable.js'
import type { OptionalOf, SourceOf, ValueSource } from './base.js'
import { operandTypeName, typeName } from '../utils/symbols.js'
import type { StringType } from './strings.js'
import { UuidTextType } from './uuidText.js'
import { __newSqlOperation0ValueSource } from '../nodes/operations.js'
import { type ValueSourceRoot } from '../nodes/valueSourceRoot.js'

/** A uuid: comparable, but not a text; its text is asked with asString */
export abstract class UuidsType</*in|out*/ VALUE_TYPE> extends ComparableType<VALUE_TYPE> {
    /** Whether a type and a custom type are of a uuid or a customUuid */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return __isUuid(type, customType)
    }

    asString(): ValueSource<SourceOf<this>, StringType, OptionalOf<this>>
    asString(): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation0ValueSource('_asString', vs, UuidTextType, vs.__optionalType, vs.__typeAdapter)
    }
}

/** A uuid, a JavaScript string */
export abstract class UuidType extends UuidsType<string> {
    static override readonly type = 'uuid'
    static override readonly customType = undefined
    declare [typeName]: 'type:uuid:'
    declare [operandTypeName]: 'type:uuid:'
}
