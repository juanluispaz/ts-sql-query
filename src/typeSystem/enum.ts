import type { DataTypeOfClass } from './base.js'
import { EqualableType } from './equalable.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { ofStatics } from '../utils/symbols.js'
import type { OfStatics } from './dataTypeOfName.js'

/** The class of the data type of an enumeration, with its values (see EnumType.values) */
export type EnumTypeClass<VALUE_TYPE, TYPE_NAME extends string> = DataTypeOfClass<EnumType<VALUE_TYPE, TYPE_NAME>> & { readonly values: readonly VALUE_TYPE[] | null }

/**
 * A value of an enumeration of the user, one of its values, of its type name: the library sends and reads only one of
 * them, and gives it no SQL data type. A data type of the user extends it with its type name and its values:
 * `class StatusType extends EnumType<Status, 'Status'> { static override readonly type = 'Status'; static override
 * readonly values = ['open', 'closed'] as const }`; or, for a specific use, `EnumType.of('Status', ['open', 'closed'])`
 */
export abstract class EnumType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends EqualableType<VALUE_TYPE, TYPE_NAME> {
    /**
     * The values of the enumeration: a value sent or read that isn't one of them is rejected (`INVALID_VALUE_TO_SEND_TO_DATABASE`,
     * `INVALID_VALUE_RECEIVED_FROM_DATABASE`). `null` says, explicitly, that any value goes. A class of yours must say
     * it: without it, a value of the type is an error, `INVALID_CONFIGURATION`
     */
    declare static readonly values: readonly unknown[] | null

    /**
     * The data type of an enumeration of yours, of that type name and those values, for a specific use, like a column:
     * `this.column('status', EnumType.of('Status', ['open', 'closed']))`, whose values are `'open' | 'closed'`. `null`
     * instead of the values says, explicitly, that any value goes: `EnumType.of<Status, 'Status'>('Status', null)`.
     * It gives the same class each time for the same type name (see EqualableType.of)
     */
    declare static readonly of: <const VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME, values: readonly VALUE_TYPE[] | null) => EnumTypeClass<VALUE_TYPE, TYPE_NAME>

    /** The statics of the data type `of` makes: its values */
    static override [ofStatics](options: readonly unknown[]): OfStatics {
        const values = options[0]
        if (options.length !== 1 || !(values === null || Array.isArray(values))) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'values', value: values }, 'The values of an enumeration are an array, or null for any value, not ' + String(values))
        }
        return { values }
    }
}
