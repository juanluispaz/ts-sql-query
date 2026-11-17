import type { SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import type { OptionalOf, SourceOf, ValueSource } from './base.js'
import { StringType } from './strings.js'
import { filterThrough } from '../utils/symbols.js'
import { UuidTextType } from './uuidText.js'
import { __operation0 } from '../nodes/operations.js'

/** The type in the database of a uuid */
export const uuidSqlDataType: SqlDataType = { family: 'uuid' }

/**
 * The family of the uuids: comparable, but not a text; its text is asked with asString. A data type of the user extends
 * it with its type name, sent and read as a uuid:
 * `class CustomerIdType extends UuidsType<CustomerId, 'CustomerId'> { static override readonly type = 'CustomerId' }`
 */
export abstract class UuidsType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = uuidSqlDataType
    /**
     * The operations of a dynamic filter the uuid doesn't have apply to its text: those of the data type asString
     * gives (the text operators). Its own operations win
     */
    static readonly [filterThrough] = { method: 'asString', dataType: StringType } as const
    declare [filterThrough]: StringType

    asString(): ValueSource<SourceOf<this>, StringType, OptionalOf<this>>
    asString(): any {
        return __operation0(this, '_asString', UuidTextType)
    }
}

/** A uuid, a JavaScript string */
export abstract class UuidType extends UuidsType<string, 'uuid'> {
    static override readonly type = 'uuid'
}
