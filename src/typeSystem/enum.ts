import { EqualableType } from './equalable.js'

/**
 * A value of an enumeration of the user, of its type name: the library converts nothing and gives it no SQL data type.
 * A data type of the user extends it with its type name:
 * `class StatusType extends EnumType<Status, 'Status'> { static override readonly type = 'Status' }`
 */
export abstract class EnumType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends EqualableType<VALUE_TYPE, TYPE_NAME> {
}
