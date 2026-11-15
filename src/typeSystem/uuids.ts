import { ComparableType } from './comparable.js'
import type { OptionalOf, SourceOf, TypeClass, ValueSource } from './base.js'
import type { StringType } from './strings.js'
import { operandTypeName, typeName } from '../utils/symbols.js'

/** A uuid: comparable, but not a text; its text is asked with asString */
export abstract class UuidsType</*in|out*/ VALUE_TYPE> extends ComparableType<VALUE_TYPE> {
    abstract asString(): ValueSource<SourceOf<this>, StringType, OptionalOf<this>>
}

/** A uuid, a JavaScript string */
export abstract class UuidType extends UuidsType<string> {
    static override readonly __type = 'uuid'
    static override readonly __customType = undefined
    declare [typeName]: 'type:uuid:'
    declare [operandTypeName]: 'type:uuid:'
}

/** A uuid of a type of the user, of its type name */
export abstract class CustomUuidType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends UuidsType<VALUE_TYPE> {
    static override readonly __customType = 'customUuid'
    declare [typeName]: `type:${TYPE_NAME}:customUuid:`
    declare [operandTypeName]: `type:${TYPE_NAME}:customUuid:`

    /** The data type of a uuid of a type of the user, with its type name */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME): TypeClass<CustomUuidType<VALUE_TYPE, TYPE_NAME>> {
        abstract class CustomUuid extends CustomUuidType<VALUE_TYPE, TYPE_NAME> {
            static override readonly __type = typeName
        }
        return CustomUuid
    }
}
