import type { CustomType, SqlDataType } from '../TypeAdapter.js'
import { __isUuid } from './dataTypes.js'
import { ComparableType } from './comparable.js'
import type { OptionalOf, SourceOf, ValueSource } from './base.js'
import { operandTypeName, typeName } from '../utils/symbols.js'
import type { StringType } from './strings.js'
import { UuidTextType } from './uuidText.js'
import { __operation0 } from '../nodes/operations.js'

/** A uuid: comparable, but not a text; its text is asked with asString */
/** The type in the database of a uuid */
export const uuidSqlDataType: SqlDataType = { family: 'uuid' }

export abstract class UuidsType</*in|out*/ VALUE_TYPE> extends ComparableType<VALUE_TYPE> {
    /** Whether a type and a custom type are of a uuid or a customUuid */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return __isUuid(type, customType)
    }

    asString(): ValueSource<SourceOf<this>, StringType, OptionalOf<this>>
    asString(): any {
        return __operation0(this, '_asString', UuidTextType)
    }
}

/** A uuid, a JavaScript string */
export abstract class UuidType extends UuidsType<string> {
    static override readonly type = 'uuid'
    static override readonly customType = undefined
    static override readonly sqlDataType: SqlDataType = uuidSqlDataType
    declare [typeName]: 'type:uuid:'
    declare [operandTypeName]: 'type:uuid:'
}
