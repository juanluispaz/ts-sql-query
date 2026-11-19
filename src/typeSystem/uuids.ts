import type { SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import type { OptionalityOf, SourceOf, ValueSource } from './base.js'
import type { IStringValue, StringType } from './strings.js'
import type { BooleanType, IfValueSource } from './logical.js'
import type { CombinedOptionality } from './valueSource.js'
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

    /**
     * The text of the uuid, in lower case unless the connection is configured otherwise, to use it as a text
     * (concatenate it, compare it with a text, ...).
     *
     * It writes the conversion only where the database needs it: none where the uuid is already stored as its text.
     */
    asString(): ValueSource<SourceOf<this>, StringType, OptionalityOf<this>>
    asString(): any {
        return __operation0(this, '_asString', UuidTextType)
    }

    // The text operators, on the text of the uuid: asString writes it only where the database needs it
    /**
     * As `equalsInsensitive`, but the condition disappears when the value is missing: null, undefined, an empty
     * string (unless the connection allows empty strings) or an empty array.
     */
    equalsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    equalsInsensitiveIfValue(value: any): any {
        return this.asString().equalsInsensitiveIfValue(value)
    }
    /**
     * Whether the text of the uuid equals the value ignoring case: `<this> = <value>`, case-insensitive.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides.
     */
    equalsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text of the uuid equals the value ignoring case: `<this> = <value>`, case-insensitive.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides.
     */
    equalsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    equalsInsensitive(value: any): any {
        return this.asString().equalsInsensitive(value)
    }
    /**
     * As `notEqualsInsensitive`, but the condition disappears when the value is missing: null, undefined, an
     * empty string (unless the connection allows empty strings) or an empty array.
     */
    notEqualsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notEqualsInsensitiveIfValue(value: any): any {
        return this.asString().notEqualsInsensitiveIfValue(value)
    }
    /**
     * Whether the text of the uuid is different from the value ignoring case: `<this> <> <value>`, case-insensitive.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides.
     */
    notEqualsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text of the uuid is different from the value ignoring case: `<this> <> <value>`, case-insensitive.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides.
     */
    notEqualsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notEqualsInsensitive(value: any): any {
        return this.asString().notEqualsInsensitive(value)
    }
    /**
     * As `like`, but the condition disappears when the value is missing: null, undefined, an empty string
     * (unless the connection allows empty strings) or an empty array.
     */
    likeIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    likeIfValue(value: any): any {
        return this.asString().likeIfValue(value)
    }
    /**
     * Whether the text of the uuid matches the pattern: `<this> like <pattern>`, where `%` matches any sequence
     * of characters and `_` one character.
     */
    like(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text of the uuid matches the pattern: `<this> like <pattern>`, where `%` matches any sequence
     * of characters and `_` one character.
     */
    like<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    like(value: any): any {
        return this.asString().like(value)
    }
    /**
     * As `notLike`, but the condition disappears when the value is missing: null, undefined, an empty string
     * (unless the connection allows empty strings) or an empty array.
     */
    notLikeIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notLikeIfValue(value: any): any {
        return this.asString().notLikeIfValue(value)
    }
    /**
     * Whether the text of the uuid doesn't match the pattern: `<this> not like <pattern>`, where `%` matches any
     * sequence of characters and `_` one character.
     */
    notLike(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text of the uuid doesn't match the pattern: `<this> not like <pattern>`, where `%` matches any
     * sequence of characters and `_` one character.
     */
    notLike<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notLike(value: any): any {
        return this.asString().notLike(value)
    }
    /**
     * As `likeInsensitive`, but the condition disappears when the value is missing: null, undefined, an empty
     * string (unless the connection allows empty strings) or an empty array.
     */
    likeInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    likeInsensitiveIfValue(value: any): any {
        return this.asString().likeInsensitiveIfValue(value)
    }
    /**
     * As `like`, ignoring case: whether the text of the uuid matches the pattern, where `%` matches any sequence
     * of characters and `_` one character.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    likeInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * As `like`, ignoring case: whether the text of the uuid matches the pattern, where `%` matches any sequence
     * of characters and `_` one character.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    likeInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    likeInsensitive(value: any): any {
        return this.asString().likeInsensitive(value)
    }
    /**
     * As `notLikeInsensitive`, but the condition disappears when the value is missing: null, undefined, an empty
     * string (unless the connection allows empty strings) or an empty array.
     */
    notLikeInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notLikeInsensitiveIfValue(value: any): any {
        return this.asString().notLikeInsensitiveIfValue(value)
    }
    /**
     * As `notLike`, ignoring case: whether the text of the uuid doesn't match the pattern, where `%` matches any
     * sequence of characters and `_` one character.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    notLikeInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * As `notLike`, ignoring case: whether the text of the uuid doesn't match the pattern, where `%` matches any
     * sequence of characters and `_` one character.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    notLikeInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notLikeInsensitive(value: any): any {
        return this.asString().notLikeInsensitive(value)
    }
    /**
     * As `startsWith`, but the condition disappears when the value is missing: null, undefined, an empty string
     * (unless the connection allows empty strings) or an empty array.
     */
    startsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    startsWithIfValue(value: any): any {
        return this.asString().startsWithIfValue(value)
    }
    /**
     * Whether the text of the uuid starts with the value: `<this> like '<value>%'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    startsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text of the uuid starts with the value: `<this> like '<value>%'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    startsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    startsWith(value: any): any {
        return this.asString().startsWith(value)
    }
    /**
     * As `notStartsWith`, but the condition disappears when the value is missing: null, undefined, an empty
     * string (unless the connection allows empty strings) or an empty array.
     */
    notStartsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notStartsWithIfValue(value: any): any {
        return this.asString().notStartsWithIfValue(value)
    }
    /**
     * Whether the text of the uuid doesn't start with the value: `<this> not like '<value>%'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    notStartsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text of the uuid doesn't start with the value: `<this> not like '<value>%'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    notStartsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notStartsWith(value: any): any {
        return this.asString().notStartsWith(value)
    }
    /**
     * As `endsWith`, but the condition disappears when the value is missing: null, undefined, an empty string
     * (unless the connection allows empty strings) or an empty array.
     */
    endsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    endsWithIfValue(value: any): any {
        return this.asString().endsWithIfValue(value)
    }
    /**
     * Whether the text of the uuid ends with the value: `<this> like '%<value>'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    endsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text of the uuid ends with the value: `<this> like '%<value>'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    endsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    endsWith(value: any): any {
        return this.asString().endsWith(value)
    }
    /**
     * As `notEndsWith`, but the condition disappears when the value is missing: null, undefined, an empty string
     * (unless the connection allows empty strings) or an empty array.
     */
    notEndsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notEndsWithIfValue(value: any): any {
        return this.asString().notEndsWithIfValue(value)
    }
    /**
     * Whether the text of the uuid doesn't end with the value: `<this> not like '%<value>'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    notEndsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text of the uuid doesn't end with the value: `<this> not like '%<value>'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    notEndsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notEndsWith(value: any): any {
        return this.asString().notEndsWith(value)
    }
    /**
     * As `startsWithInsensitive`, but the condition disappears when the value is missing: null, undefined, an
     * empty string (unless the connection allows empty strings) or an empty array.
     */
    startsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    startsWithInsensitiveIfValue(value: any): any {
        return this.asString().startsWithInsensitiveIfValue(value)
    }
    /**
     * As `startsWith`, ignoring case: whether the text of the uuid starts with the value. The `%` and `_` in the
     * value match themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    startsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * As `startsWith`, ignoring case: whether the text of the uuid starts with the value. The `%` and `_` in the
     * value match themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    startsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    startsWithInsensitive(value: any): any {
        return this.asString().startsWithInsensitive(value)
    }
    /**
     * As `notStartsWithInsensitive`, but the condition disappears when the value is missing: null, undefined, an
     * empty string (unless the connection allows empty strings) or an empty array.
     */
    notStartsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notStartsWithInsensitiveIfValue(value: any): any {
        return this.asString().notStartsWithInsensitiveIfValue(value)
    }
    /**
     * As `notStartsWith`, ignoring case: whether the text of the uuid doesn't start with the value. The `%` and
     * `_` in the value match themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    notStartsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * As `notStartsWith`, ignoring case: whether the text of the uuid doesn't start with the value. The `%` and
     * `_` in the value match themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    notStartsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notStartsWithInsensitive(value: any): any {
        return this.asString().notStartsWithInsensitive(value)
    }
    /**
     * As `endsWithInsensitive`, but the condition disappears when the value is missing: null, undefined, an
     * empty string (unless the connection allows empty strings) or an empty array.
     */
    endsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    endsWithInsensitiveIfValue(value: any): any {
        return this.asString().endsWithInsensitiveIfValue(value)
    }
    /**
     * As `endsWith`, ignoring case: whether the text of the uuid ends with the value. The `%` and `_` in the
     * value match themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    endsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * As `endsWith`, ignoring case: whether the text of the uuid ends with the value. The `%` and `_` in the
     * value match themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    endsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    endsWithInsensitive(value: any): any {
        return this.asString().endsWithInsensitive(value)
    }
    /**
     * As `notEndsWithInsensitive`, but the condition disappears when the value is missing: null, undefined, an
     * empty string (unless the connection allows empty strings) or an empty array.
     */
    notEndsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notEndsWithInsensitiveIfValue(value: any): any {
        return this.asString().notEndsWithInsensitiveIfValue(value)
    }
    /**
     * As `notEndsWith`, ignoring case: whether the text of the uuid doesn't end with the value. The `%` and `_`
     * in the value match themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    notEndsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * As `notEndsWith`, ignoring case: whether the text of the uuid doesn't end with the value. The `%` and `_`
     * in the value match themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    notEndsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notEndsWithInsensitive(value: any): any {
        return this.asString().notEndsWithInsensitive(value)
    }
    /**
     * As `contains`, but the condition disappears when the value is missing: null, undefined, an empty string
     * (unless the connection allows empty strings) or an empty array.
     */
    containsIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    containsIfValue(value: any): any {
        return this.asString().containsIfValue(value)
    }
    /**
     * Whether the text of the uuid contains the value: `<this> like '%<value>%'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    contains(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text of the uuid contains the value: `<this> like '%<value>%'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    contains<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    contains(value: any): any {
        return this.asString().contains(value)
    }
    /**
     * As `notContains`, but the condition disappears when the value is missing: null, undefined, an empty string
     * (unless the connection allows empty strings) or an empty array.
     */
    notContainsIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notContainsIfValue(value: any): any {
        return this.asString().notContainsIfValue(value)
    }
    /**
     * Whether the text of the uuid doesn't contain the value: `<this> not like '%<value>%'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    notContains(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text of the uuid doesn't contain the value: `<this> not like '%<value>%'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    notContains<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notContains(value: any): any {
        return this.asString().notContains(value)
    }
    /**
     * As `containsInsensitive`, but the condition disappears when the value is missing: null, undefined, an
     * empty string (unless the connection allows empty strings) or an empty array.
     */
    containsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    containsInsensitiveIfValue(value: any): any {
        return this.asString().containsInsensitiveIfValue(value)
    }
    /**
     * As `contains`, ignoring case: whether the text of the uuid contains the value. The `%` and `_` in the
     * value match themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    containsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * As `contains`, ignoring case: whether the text of the uuid contains the value. The `%` and `_` in the
     * value match themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    containsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    containsInsensitive(value: any): any {
        return this.asString().containsInsensitive(value)
    }
    /**
     * As `notContainsInsensitive`, but the condition disappears when the value is missing: null, undefined, an
     * empty string (unless the connection allows empty strings) or an empty array.
     */
    notContainsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notContainsInsensitiveIfValue(value: any): any {
        return this.asString().notContainsInsensitiveIfValue(value)
    }
    /**
     * As `notContains`, ignoring case: whether the text of the uuid doesn't contain the value. The `%` and `_`
     * in the value match themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    notContainsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * As `notContains`, ignoring case: whether the text of the uuid doesn't contain the value. The `%` and `_`
     * in the value match themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    notContainsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notContainsInsensitive(value: any): any {
        return this.asString().notContainsInsensitive(value)
    }
}

/** A uuid, a JavaScript string */
export abstract class UuidType extends UuidsType<string, 'uuid'> {
    static override readonly type = 'uuid'
}
