import type { CustomType } from '../TypeAdapter.js'
import { __isUuid } from './dataTypes.js'
import { ComparableType } from './comparable.js'
import type { OptionalOf, SourceOf, TypeClass, ValueSource } from './base.js'
import type { StringType } from './strings.js'
import { operandTypeName, typeName } from '../utils/symbols.js'

/** A uuid: comparable, but not a text; its text is asked with asString */
export abstract class UuidsType</*in|out*/ VALUE_TYPE> extends ComparableType<VALUE_TYPE> {
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

/** A uuid of a type of the user, of its type name */
export abstract class CustomUuidType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends UuidsType<VALUE_TYPE> {
    static override readonly customType = 'customUuid'
    declare [typeName]: `type:${TYPE_NAME}:customUuid:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customUuid:`

    /** The data type of a uuid of a type of the user, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): TypeClass<CustomUuidType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomUuid extends CustomUuidType<VALUE_TYPE, TYPE_NAME> {
            static override readonly type = typeName
        }
        return CustomUuid
    }
}
