import type { SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import type { OptionalOf, SourceOf, ValueSource } from './base.js'
import type { IStringValue, StringType } from './strings.js'
import type { BooleanType, IfValueSource } from './logical.js'
import type { MergeOptional } from './valueSource.js'
import { exposeFilterOperations, filterOperation } from './filterOperations.js'
import { UuidTextType } from './uuidText.js'
import { __operation0 } from '../nodes/operations.js'

/** The type in the database of a uuid */
export const uuidSqlDataType: SqlDataType = { family: 'uuid' }

/**
 * The family of the uuids: comparable, but not a text; its text is asked with asString, and the text operators apply to
 * it (a part of a uuid typed by a person, in any case). A data type of the user extends it with its type name, sent and
 * read as a uuid:
 * `class CustomerIdType extends UuidsType<CustomerId, 'CustomerId'> { static override readonly type = 'CustomerId' }`
 */
export abstract class UuidsType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = uuidSqlDataType
    static override readonly [filterOperation] = exposeFilterOperations(this, ComparableType, [
        'equalsInsensitiveIfValue', 'equalsInsensitive', 'notEqualsInsensitiveIfValue', 'notEqualsInsensitive',
        'likeIfValue', 'like', 'notLikeIfValue', 'notLike', 'likeInsensitiveIfValue', 'likeInsensitive',
        'notLikeInsensitiveIfValue', 'notLikeInsensitive', 'startsWithIfValue', 'startsWith',
        'notStartsWithIfValue', 'notStartsWith', 'endsWithIfValue', 'endsWith', 'notEndsWithIfValue', 'notEndsWith',
        'startsWithInsensitiveIfValue', 'startsWithInsensitive', 'notStartsWithInsensitiveIfValue',
        'notStartsWithInsensitive', 'endsWithInsensitiveIfValue', 'endsWithInsensitive',
        'notEndsWithInsensitiveIfValue', 'notEndsWithInsensitive', 'containsIfValue', 'contains',
        'notContainsIfValue', 'notContains', 'containsInsensitiveIfValue', 'containsInsensitive',
        'notContainsInsensitiveIfValue', 'notContainsInsensitive',
    ])
    declare [filterOperation]: (typeof UuidsType)[typeof filterOperation]

    asString(): ValueSource<SourceOf<this>, StringType, OptionalOf<this>>
    asString(): any {
        return __operation0(this, '_asString', UuidTextType)
    }

    // The text operators, on the text of the uuid: asString writes it only where the database needs it
    equalsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    equalsInsensitiveIfValue(value: any): any {
        return this.asString().equalsInsensitiveIfValue(value)
    }
    equalsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    equalsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    equalsInsensitive(value: any): any {
        return this.asString().equalsInsensitive(value)
    }
    notEqualsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    notEqualsInsensitiveIfValue(value: any): any {
        return this.asString().notEqualsInsensitiveIfValue(value)
    }
    notEqualsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notEqualsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notEqualsInsensitive(value: any): any {
        return this.asString().notEqualsInsensitive(value)
    }
    likeIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    likeIfValue(value: any): any {
        return this.asString().likeIfValue(value)
    }
    like(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    like<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    like(value: any): any {
        return this.asString().like(value)
    }
    notLikeIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    notLikeIfValue(value: any): any {
        return this.asString().notLikeIfValue(value)
    }
    notLike(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notLike<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notLike(value: any): any {
        return this.asString().notLike(value)
    }
    likeInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    likeInsensitiveIfValue(value: any): any {
        return this.asString().likeInsensitiveIfValue(value)
    }
    likeInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    likeInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    likeInsensitive(value: any): any {
        return this.asString().likeInsensitive(value)
    }
    notLikeInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    notLikeInsensitiveIfValue(value: any): any {
        return this.asString().notLikeInsensitiveIfValue(value)
    }
    notLikeInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notLikeInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notLikeInsensitive(value: any): any {
        return this.asString().notLikeInsensitive(value)
    }
    startsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    startsWithIfValue(value: any): any {
        return this.asString().startsWithIfValue(value)
    }
    startsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    startsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    startsWith(value: any): any {
        return this.asString().startsWith(value)
    }
    notStartsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    notStartsWithIfValue(value: any): any {
        return this.asString().notStartsWithIfValue(value)
    }
    notStartsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notStartsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notStartsWith(value: any): any {
        return this.asString().notStartsWith(value)
    }
    endsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    endsWithIfValue(value: any): any {
        return this.asString().endsWithIfValue(value)
    }
    endsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    endsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    endsWith(value: any): any {
        return this.asString().endsWith(value)
    }
    notEndsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    notEndsWithIfValue(value: any): any {
        return this.asString().notEndsWithIfValue(value)
    }
    notEndsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notEndsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notEndsWith(value: any): any {
        return this.asString().notEndsWith(value)
    }
    startsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    startsWithInsensitiveIfValue(value: any): any {
        return this.asString().startsWithInsensitiveIfValue(value)
    }
    startsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    startsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    startsWithInsensitive(value: any): any {
        return this.asString().startsWithInsensitive(value)
    }
    notStartsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    notStartsWithInsensitiveIfValue(value: any): any {
        return this.asString().notStartsWithInsensitiveIfValue(value)
    }
    notStartsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notStartsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notStartsWithInsensitive(value: any): any {
        return this.asString().notStartsWithInsensitive(value)
    }
    endsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    endsWithInsensitiveIfValue(value: any): any {
        return this.asString().endsWithInsensitiveIfValue(value)
    }
    endsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    endsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    endsWithInsensitive(value: any): any {
        return this.asString().endsWithInsensitive(value)
    }
    notEndsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    notEndsWithInsensitiveIfValue(value: any): any {
        return this.asString().notEndsWithInsensitiveIfValue(value)
    }
    notEndsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notEndsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notEndsWithInsensitive(value: any): any {
        return this.asString().notEndsWithInsensitive(value)
    }
    containsIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    containsIfValue(value: any): any {
        return this.asString().containsIfValue(value)
    }
    contains(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    contains<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    contains(value: any): any {
        return this.asString().contains(value)
    }
    notContainsIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    notContainsIfValue(value: any): any {
        return this.asString().notContainsIfValue(value)
    }
    notContains(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notContains<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notContains(value: any): any {
        return this.asString().notContains(value)
    }
    containsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    containsInsensitiveIfValue(value: any): any {
        return this.asString().containsInsensitiveIfValue(value)
    }
    containsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    containsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    containsInsensitive(value: any): any {
        return this.asString().containsInsensitive(value)
    }
    notContainsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    notContainsInsensitiveIfValue(value: any): any {
        return this.asString().notContainsInsensitiveIfValue(value)
    }
    notContainsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notContainsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notContainsInsensitive(value: any): any {
        return this.asString().notContainsInsensitive(value)
    }
}

/** A uuid, a JavaScript string */
export abstract class UuidType extends UuidsType<string, 'uuid'> {
    static override readonly type = 'uuid'
}
