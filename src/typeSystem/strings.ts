import type { SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import type { IValueWithType, OptionalityOf, SourceOf, DataTypeOf, ValueSource } from './base.js'
import { BooleanConditionType, type BooleanType, type IfValueSource } from './logical.js'
import type { INumberValue } from './base.js'
import type { CombinedOptionality, MergeRequired } from './valueSource.js'
import { operandTypeName, typeName } from '../utils/symbols.js'
import { exposeFilterOperations, filterOperation } from './filterOperations.js'
import { IntType } from './number.js'
import { __typeClassOf } from '../nodes/dataTypeClassOf.js'
import { __newSqlOperation1ValueSourceIfValueOrIgnore, __newSqlOperation1ValueSourceIfValueOrNoop, __newSqlOperation2ValueSourceIfValueOrIgnore } from '../nodes/ifValue.js'
import { getOptionalType2, getOptionalType3, getRequiredType2 } from '../nodes/operands.js'
import { __newSqlOperation1ValueSource, __newSqlOperation2ValueSource, __newSqlOperationCollateValueSource, __operation0 } from '../nodes/operations.js'
import { __keptClassOf, __computedTextClassOf } from '../nodes/adaptedTypeClass.js'
import { __asNodeValueSource } from '../nodes/NodeStrategy.js'


/** What a position that takes a text accepts */
export type IStringValue = IValueWithType<'type:string:'>

/** The type in the database of a text */
export const stringSqlDataType: SqlDataType = { family: 'character string' }

/** The family of the texts: what every text offers. Its only data type is StringType; a data type of the user doesn't extend it */
export abstract class StringsType</*in|out*/ VALUE_TYPE> extends ComparableType<VALUE_TYPE, string> {
    static override readonly [filterOperation] = exposeFilterOperations(this, ComparableType, [
        'equalsInsensitiveIfValue', 'equalsInsensitive', 'notEqualsInsensitiveIfValue', 'notEqualsInsensitive',
        'likeIfValue', 'like', 'notLikeIfValue', 'notLike', 'likeInsensitiveIfValue', 'likeInsensitive',
        'notLikeInsensitiveIfValue', 'notLikeInsensitive', 'startsWithIfValue', 'startsWith', 'notStartsWithIfValue',
        'notStartsWith', 'endsWithIfValue', 'endsWith', 'notEndsWithIfValue', 'notEndsWith',
        'startsWithInsensitiveIfValue', 'startsWithInsensitive', 'notStartsWithInsensitiveIfValue',
        'notStartsWithInsensitive', 'endsWithInsensitiveIfValue', 'endsWithInsensitive', 'notEndsWithInsensitiveIfValue',
        'notEndsWithInsensitive', 'containsIfValue', 'contains', 'notContainsIfValue', 'notContains',
        'containsInsensitiveIfValue', 'containsInsensitive', 'notContainsInsensitiveIfValue', 'notContainsInsensitive',
    ])
    declare [filterOperation]: (typeof StringsType)[typeof filterOperation]

    // Comparisons of texts
    /**
     * As `equalsInsensitive`, but the condition disappears when the value is missing: null, undefined, an empty
     * string (unless the connection allows empty strings) or an empty array.
     */
    equalsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    equalsInsensitiveIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_equalsInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * Whether the text equals the value ignoring case: `<this> = <value>`, case-insensitive.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides.
     */
    equalsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text equals the value ignoring case: `<this> = <value>`, case-insensitive.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides.
     */
    equalsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    equalsInsensitive(value: any): any {
        return __newSqlOperation1ValueSource('_equalsInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `notEqualsInsensitive`, but the condition disappears when the value is missing: null, undefined, an
     * empty string (unless the connection allows empty strings) or an empty array.
     */
    notEqualsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notEqualsInsensitiveIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notEqualsInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * Whether the text is different from the value ignoring case: `<this> <> <value>`, case-insensitive.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides.
     */
    notEqualsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text is different from the value ignoring case: `<this> <> <value>`, case-insensitive.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides.
     */
    notEqualsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notEqualsInsensitive(value: any): any {
        return __newSqlOperation1ValueSource('_notEqualsInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `like`, but the condition disappears when the value is missing: null, undefined, an empty string
     * (unless the connection allows empty strings) or an empty array.
     */
    likeIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    likeIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_like', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * Whether the text matches the pattern: `<this> like <pattern>`, where `%` matches any sequence of
     * characters and `_` one character.
     */
    like(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text matches the pattern: `<this> like <pattern>`, where `%` matches any sequence of
     * characters and `_` one character.
     */
    like<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    like(value: any): any {
        return __newSqlOperation1ValueSource('_like', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `notLike`, but the condition disappears when the value is missing: null, undefined, an empty string
     * (unless the connection allows empty strings) or an empty array.
     */
    notLikeIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notLikeIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notLike', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * Whether the text doesn't match the pattern: `<this> not like <pattern>`, where `%` matches any sequence of
     * characters and `_` one character.
     */
    notLike(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text doesn't match the pattern: `<this> not like <pattern>`, where `%` matches any sequence of
     * characters and `_` one character.
     */
    notLike<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notLike(value: any): any {
        return __newSqlOperation1ValueSource('_notLike', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `likeInsensitive`, but the condition disappears when the value is missing: null, undefined, an empty
     * string (unless the connection allows empty strings) or an empty array.
     */
    likeInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    likeInsensitiveIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_likeInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `like`, ignoring case: whether the text matches the pattern, where `%` matches any sequence of
     * characters and `_` one character.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    likeInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * As `like`, ignoring case: whether the text matches the pattern, where `%` matches any sequence of
     * characters and `_` one character.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    likeInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    likeInsensitive(value: any): any {
        return __newSqlOperation1ValueSource('_likeInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `notLikeInsensitive`, but the condition disappears when the value is missing: null, undefined, an empty
     * string (unless the connection allows empty strings) or an empty array.
     */
    notLikeInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notLikeInsensitiveIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notLikeInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `notLike`, ignoring case: whether the text doesn't match the pattern, where `%` matches any sequence of
     * characters and `_` one character.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    notLikeInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * As `notLike`, ignoring case: whether the text doesn't match the pattern, where `%` matches any sequence of
     * characters and `_` one character.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    notLikeInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notLikeInsensitive(value: any): any {
        return __newSqlOperation1ValueSource('_notLikeInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `startsWith`, but the condition disappears when the value is missing: null, undefined, an empty string
     * (unless the connection allows empty strings) or an empty array.
     */
    startsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    startsWithIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_startsWith', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * Whether the text starts with the value: `<this> like '<value>%'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    startsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text starts with the value: `<this> like '<value>%'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    startsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    startsWith(value: any): any {
        return __newSqlOperation1ValueSource('_startsWith', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `notStartsWith`, but the condition disappears when the value is missing: null, undefined, an empty
     * string (unless the connection allows empty strings) or an empty array.
     */
    notStartsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notStartsWithIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notStartsWith', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * Whether the text doesn't start with the value: `<this> not like '<value>%'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    notStartsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text doesn't start with the value: `<this> not like '<value>%'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    notStartsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notStartsWith(value: any): any {
        return __newSqlOperation1ValueSource('_notStartsWith', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `endsWith`, but the condition disappears when the value is missing: null, undefined, an empty string
     * (unless the connection allows empty strings) or an empty array.
     */
    endsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    endsWithIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_endsWith', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * Whether the text ends with the value: `<this> like '%<value>'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    endsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text ends with the value: `<this> like '%<value>'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    endsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    endsWith(value: any): any {
        return __newSqlOperation1ValueSource('_endsWith', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `notEndsWith`, but the condition disappears when the value is missing: null, undefined, an empty string
     * (unless the connection allows empty strings) or an empty array.
     */
    notEndsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notEndsWithIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notEndsWith', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * Whether the text doesn't end with the value: `<this> not like '%<value>'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    notEndsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text doesn't end with the value: `<this> not like '%<value>'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    notEndsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notEndsWith(value: any): any {
        return __newSqlOperation1ValueSource('_notEndsWith', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `startsWithInsensitive`, but the condition disappears when the value is missing: null, undefined, an
     * empty string (unless the connection allows empty strings) or an empty array.
     */
    startsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    startsWithInsensitiveIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_startsWithInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `startsWith`, ignoring case: whether the text starts with the value. The `%` and `_` in the value match
     * themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    startsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * As `startsWith`, ignoring case: whether the text starts with the value. The `%` and `_` in the value match
     * themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    startsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    startsWithInsensitive(value: any): any {
        return __newSqlOperation1ValueSource('_startsWithInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `notStartsWithInsensitive`, but the condition disappears when the value is missing: null, undefined, an
     * empty string (unless the connection allows empty strings) or an empty array.
     */
    notStartsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notStartsWithInsensitiveIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notStartsWithInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `notStartsWith`, ignoring case: whether the text doesn't start with the value. The `%` and `_` in the
     * value match themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    notStartsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * As `notStartsWith`, ignoring case: whether the text doesn't start with the value. The `%` and `_` in the
     * value match themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    notStartsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notStartsWithInsensitive(value: any): any {
        return __newSqlOperation1ValueSource('_notStartsWithInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `endsWithInsensitive`, but the condition disappears when the value is missing: null, undefined, an
     * empty string (unless the connection allows empty strings) or an empty array.
     */
    endsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    endsWithInsensitiveIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_endsWithInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `endsWith`, ignoring case: whether the text ends with the value. The `%` and `_` in the value match
     * themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    endsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * As `endsWith`, ignoring case: whether the text ends with the value. The `%` and `_` in the value match
     * themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    endsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    endsWithInsensitive(value: any): any {
        return __newSqlOperation1ValueSource('_endsWithInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `notEndsWithInsensitive`, but the condition disappears when the value is missing: null, undefined, an
     * empty string (unless the connection allows empty strings) or an empty array.
     */
    notEndsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notEndsWithInsensitiveIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notEndsWithInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `notEndsWith`, ignoring case: whether the text doesn't end with the value. The `%` and `_` in the value
     * match themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    notEndsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * As `notEndsWith`, ignoring case: whether the text doesn't end with the value. The `%` and `_` in the value
     * match themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    notEndsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notEndsWithInsensitive(value: any): any {
        return __newSqlOperation1ValueSource('_notEndsWithInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `contains`, but the condition disappears when the value is missing: null, undefined, an empty string
     * (unless the connection allows empty strings) or an empty array.
     */
    containsIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    containsIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_contains', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * Whether the text contains the value: `<this> like '%<value>%'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    contains(value: string ): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text contains the value: `<this> like '%<value>%'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    contains<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    contains(value: any): any {
        return __newSqlOperation1ValueSource('_contains', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `notContains`, but the condition disappears when the value is missing: null, undefined, an empty string
     * (unless the connection allows empty strings) or an empty array.
     */
    notContainsIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notContainsIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notContains', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * Whether the text doesn't contain the value: `<this> not like '%<value>%'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    notContains(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether the text doesn't contain the value: `<this> not like '%<value>%'`.
     *
     * The `%` and `_` in the value match themselves: they are escaped, not wildcards.
     */
    notContains<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notContains(value: any): any {
        return __newSqlOperation1ValueSource('_notContains', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `containsInsensitive`, but the condition disappears when the value is missing: null, undefined, an
     * empty string (unless the connection allows empty strings) or an empty array.
     */
    containsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    containsInsensitiveIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_containsInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `contains`, ignoring case: whether the text contains the value. The `%` and `_` in the value match
     * themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    containsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * As `contains`, ignoring case: whether the text contains the value. The `%` and `_` in the value match
     * themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    containsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    containsInsensitive(value: any): any {
        return __newSqlOperation1ValueSource('_containsInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `notContainsInsensitive`, but the condition disappears when the value is missing: null, undefined, an
     * empty string (unless the connection allows empty strings) or an empty array.
     */
    notContainsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notContainsInsensitiveIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notContainsInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `notContains`, ignoring case: whether the text doesn't contain the value. The `%` and `_` in the value
     * match themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    notContainsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * As `notContains`, ignoring case: whether the text doesn't contain the value. The `%` and `_` in the value
     * match themselves: they are escaped, not wildcards.
     *
     * How it ignores case depends on the connection: with `insensitiveCollation` it adds `collate <that
     * collation>`; with `insensitiveCollation` set to `''` it writes the plain comparison and trusts the
     * collation of the database; without it, it compares the `lower(...)` of both sides. On PostgreSQL it writes
     * `ilike` instead of `like` (unless the connection sets `useLikeInsteadOfIlike`).
     */
    notContainsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notContainsInsensitive(value: any): any {
        return __newSqlOperation1ValueSource('_notContainsInsensitive', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    // Functions of a text
    /**
     * Writes `<this> collate <collation>` (PostgreSQL quotes the name), forcing a specific collation on this string
     * expression. The result is a value source of the same data type, with the type adapter of the receiver, usable on either
     * operand of a comparison, on a projected/grouped/ordered column, or as a `replaceAll`
     * argument. `collation` is a raw dialect collation name (like `insensitiveCollation`),
     * so it is not portable across databases.
     *
     * Use it to force case-/accent-sensitivity in either direction on a single expression
     * — e.g. `.collate('Latin1_General_BIN2')` (SQL Server) for a binary comparison, or
     * `.collate('utf8mb4_0900_as_ci')` (MySQL) for case-insensitive-accent-sensitive.
     *
     * Two engine caveats (see the Collations documentation page): on PostgreSQL, forcing
     * case-insensitive *equality* needs a **non-deterministic** collation object; and on
     * SQLite `.collate()` governs `=`/`DISTINCT`/`ORDER BY`/`min`/`max` but **not** `LIKE`
     * (SQLite's `LIKE` ignores the operand collation).
     */
    collate(collation: string): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    collate(collation: any): any {
        const vs = __asNodeValueSource(this)
        return __newSqlOperationCollateValueSource(vs, collation, __keptClassOf(vs, __typeClassOf(vs)), vs.__optionalType)
    }
    /**
     * The text in lower case: `lower(<this>)`.
     */
    toLowerCase(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    toLowerCase(): any {
        return __operation0(this, '_toLowerCase', __computedTextClassOf(__typeClassOf(this), this))
    }
    /**
     * The text in upper case: `upper(<this>)`.
     */
    toUpperCase(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    toUpperCase(): any {
        return __operation0(this, '_toUpperCase', __computedTextClassOf(__typeClassOf(this), this))
    }
    /**
     * The number of characters of the text, as JavaScript's `length`: an int.
     *
     * On SQL Server it counts the trailing blanks too, unless the connection sets `excludeTrailingBlanksInLength`.
     */
    length(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    length(): any {
        return __operation0(this, '_length', IntType)
    }
    /**
     * The text without the spaces at its start and its end: `trim(<this>)`.
     */
    trim(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    trim(): any {
        return __operation0(this, '_trim', __computedTextClassOf(__typeClassOf(this), this))
    }
    /**
     * The text without the spaces at its start: `ltrim(<this>)`.
     */
    trimLeft(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    trimLeft(): any {
        return __operation0(this, '_trimLeft', __computedTextClassOf(__typeClassOf(this), this))
    }
    /**
     * The text without the spaces at its end: `rtrim(<this>)`.
     */
    trimRight(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    trimRight(): any {
        return __operation0(this, '_trimRight', __computedTextClassOf(__typeClassOf(this), this))
    }
    /**
     * The text with its characters in reverse order: `reverse(<this>)`.
     */
    reverse(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    reverse(): any {
        return __operation0(this, '_reverse', __computedTextClassOf(__typeClassOf(this), this))
    }
    /**
     * As `concat`, but gives the receiver unchanged when the value is missing: null, undefined or an empty
     * string (unless the connection allows empty strings).
     */
    concatIfValue(value: string | null | undefined): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    concatIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrIgnore('_concat', this, value, __computedTextClassOf(__typeClassOf(this), this, value), getOptionalType2(this, value))
    }
    /**
     * The text followed by the value, as each database concatenates texts.
     *
     * A null operand makes the result null; `concatIgnoringNull` reads it as the empty string.
     */
    concat(value: string): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The text followed by the value, as each database concatenates texts.
     *
     * A null operand makes the result null; `concatIgnoringNull` reads it as the empty string.
     */
    concat<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    concat(value: any): any {
        return __newSqlOperation1ValueSource('_concat', this, value, __computedTextClassOf(__typeClassOf(this), this, value), getOptionalType2(this, value))
    }
    /**
     * {@link concatIgnoringNull} whose operand is dropped when the value is absent, the way
     * {@link concatIfValue} relates to {@link concat}: an absent value contributes nothing and
     * leaves no bound parameter behind, so a dynamic query can hand it a `string | null |
     * undefined` without branching first.
     *
     * The result keeps the RECEIVER's optionality, unlike {@link concatIgnoringNull}: whether the
     * operand that would make the result always present is there at all is only known at run time.
     */
    concatIgnoringNullIfValue(value: string | null | undefined): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    concatIgnoringNullIfValue(value: any): any {
        // The optionality is the RECEIVER's (`getOptionalType2` with a plain value), not the
        // stricter one `concatIgnoringNull` computes: an ABSENT value leaves the receiver alone,
        // and whether it is absent is a run-time fact. Absence also depends on the connection's
        // `allowEmptyString`, which only the connection knows, when the SQL is written.
        return __newSqlOperation1ValueSourceIfValueOrIgnore('_concatIgnoringNull', this, value, __computedTextClassOf(__typeClassOf(this), this, value), getOptionalType2(this, value))
    }
    /**
     * Concatenation that reads a NULL operand as the empty string, instead of propagating it the
     * way {@link concat} does: `'Issue: '.concatIgnoringNull(<null>)` is `'Issue: '`, where
     * `.concat(<null>)` is NULL.
     *
     * Because a NULL operand no longer poisons the result, ONE operand that is always present makes
     * the whole concatenation always present, which is what the returned type declares. It stays
     * optional only when EVERY operand is: what is left then is the empty string, which the library
     * gives back as absent unless the connection enables `allowEmptyString`.
     *
     * On Oracle an all-NULL concatenation answers NULL rather than the empty string — the engine's
     * own `'' IS NULL`, the same trait that keeps a `varchar2` from holding `''`.
     */
    concatIgnoringNull(value: string): ValueSource<SourceOf<this>, DataTypeOf<this>, 'required'>
    /**
     * Concatenation that reads a NULL operand as the empty string, instead of propagating it the
     * way {@link concat} does: `'Issue: '.concatIgnoringNull(<null>)` is `'Issue: '`, where
     * `.concat(<null>)` is NULL.
     *
     * Because a NULL operand no longer poisons the result, ONE operand that is always present makes
     * the whole concatenation always present, which is what the returned type declares. It stays
     * optional only when EVERY operand is: what is left then is the empty string, which the library
     * gives back as absent unless the connection enables `allowEmptyString`.
     *
     * On Oracle an all-NULL concatenation answers NULL rather than the empty string — the engine's
     * own `'' IS NULL`, the same trait that keeps a `varchar2` from holding `''`.
     */
    concatIgnoringNull<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, MergeRequired<OptionalityOf<this>, OptionalityOf<VALUE>>>
    concatIgnoringNull(value: any): any {
        // A NULL operand counts as the empty string, so the result is optional only when EVERY
        // operand is: `getRequiredType2` keeps the STRICTEST operand instead of the loosest.
        return __newSqlOperation1ValueSource('_concatIgnoringNull', this, value, __computedTextClassOf(__typeClassOf(this), this, value), getRequiredType2(this, value))
    }
    /**
     * The part of the text from `start` to its end, as JavaScript's `substr(start)`: `start` counts from 0, and
     * a negative number counts from the end.
     *
     * A negative `start` counts from the end only when it is a number, not a value source.
     */
    substrToEnd(start: number): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The part of the text from `start` to its end, as JavaScript's `substr(start)`: `start` counts from 0, and
     * a negative number counts from the end.
     *
     * A negative `start` counts from the end only when it is a number, not a value source.
     */
    substrToEnd<VALUE extends INumberValue>(start: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    substrToEnd(start: any): any {
        return __newSqlOperation1ValueSource('_substrToEnd', this, start, __computedTextClassOf(__typeClassOf(this), this), getOptionalType2(this, start))
    }
    /**
     * The part of the text from `start` to its end, as JavaScript's `substring(start)`: `start` counts from 0,
     * and a negative number is 0.
     */
    substringToEnd(start: number): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The part of the text from `start` to its end, as JavaScript's `substring(start)`: `start` counts from 0,
     * and a negative number is 0.
     */
    substringToEnd<VALUE extends INumberValue>(start: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    substringToEnd(start: any): any {
        return __newSqlOperation1ValueSource('_substringToEnd', this, start, __computedTextClassOf(__typeClassOf(this), this), getOptionalType2(this, start))
    }
    /**
     * The `count` characters of the text from `start`, as JavaScript's `substr(start, count)`: `start` counts
     * from 0, a negative number counts from the end, and a negative `count` is 0.
     *
     * A negative `start` counts from the end only when it is a number, not a value source.
     */
    substr(start: number, count: number): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The `count` characters of the text from `start`, as JavaScript's `substr(start, count)`: `start` counts
     * from 0, a negative number counts from the end, and a negative `count` is 0.
     *
     * A negative `start` counts from the end only when it is a number, not a value source.
     */
    substr<VALUE2 extends INumberValue>(start: number, count: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE2>>>
    /**
     * The `count` characters of the text from `start`, as JavaScript's `substr(start, count)`: `start` counts
     * from 0, a negative number counts from the end, and a negative `count` is 0.
     *
     * A negative `start` counts from the end only when it is a number, not a value source.
     */
    substr<VALUE extends INumberValue>(start: VALUE, count: number): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /**
     * The `count` characters of the text from `start`, as JavaScript's `substr(start, count)`: `start` counts
     * from 0, a negative number counts from the end, and a negative `count` is 0.
     *
     * A negative `start` counts from the end only when it is a number, not a value source.
     */
    substr<VALUE extends INumberValue, VALUE2 extends INumberValue>(start: VALUE, count: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE> | SourceOf<VALUE2>, DataTypeOf<this>, CombinedOptionality<CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>, OptionalityOf<VALUE2>>>
    substr(start: any, count: any): any {
        return __newSqlOperation2ValueSource('_substr', this, start, count, __computedTextClassOf(__typeClassOf(this), this), getOptionalType3(this, start, count))
    }
    /**
     * The part of the text from `start` up to `end`, not included, as JavaScript's `substring(start, end)`: the
     * positions count from 0.
     *
     * When both are numbers, a negative one is 0, and they are swapped when `start` is greater than `end`, as in
     * JavaScript.
     */
    substring(start: number, count: number): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The part of the text from `start` up to `end`, not included, as JavaScript's `substring(start, end)`: the
     * positions count from 0.
     *
     * When both are numbers, a negative one is 0, and they are swapped when `start` is greater than `end`, as in
     * JavaScript.
     */
    substring<VALUE2 extends INumberValue>(start: number, end: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE2>>>
    /**
     * The part of the text from `start` up to `end`, not included, as JavaScript's `substring(start, end)`: the
     * positions count from 0.
     *
     * When both are numbers, a negative one is 0, and they are swapped when `start` is greater than `end`, as in
     * JavaScript.
     */
    substring<VALUE extends INumberValue>(start: VALUE, end: number): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /**
     * The part of the text from `start` up to `end`, not included, as JavaScript's `substring(start, end)`: the
     * positions count from 0.
     *
     * When both are numbers, a negative one is 0, and they are swapped when `start` is greater than `end`, as in
     * JavaScript.
     */
    substring<VALUE extends INumberValue, VALUE2 extends INumberValue>(start: VALUE, end: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE> | SourceOf<VALUE2>, DataTypeOf<this>, CombinedOptionality<CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>, OptionalityOf<VALUE2>>>
    substring(start: any, end: any): any {
        return __newSqlOperation2ValueSource('_substring', this, start, end, __computedTextClassOf(__typeClassOf(this), this), getOptionalType3(this, start, end))
    }
    /**
     * As `replaceAll`, but gives the receiver unchanged when `findString` or `replaceWith` is missing: null,
     * undefined or an empty string (unless the connection allows empty strings).
     */
    replaceAllIfValue(findString: string | null | undefined, replaceWith: string | null | undefined): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * As `replaceAll`, but gives the receiver unchanged when `findString` or `replaceWith` is missing: null,
     * undefined or an empty string (unless the connection allows empty strings).
     */
    replaceAllIfValue<VALUE2 extends IStringValue>(findString: string | null | undefined, replaceWith: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE2>>>
    /**
     * As `replaceAll`, but gives the receiver unchanged when `findString` or `replaceWith` is missing: null,
     * undefined or an empty string (unless the connection allows empty strings).
     */
    replaceAllIfValue<VALUE extends IStringValue>(findString: VALUE, replaceWith: string | null | undefined): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    replaceAllIfValue(findString: any, replaceWith: any): any {
        return __newSqlOperation2ValueSourceIfValueOrIgnore('_replaceAll', this, findString, replaceWith, __computedTextClassOf(__typeClassOf(this), this, replaceWith), getOptionalType3(this, findString, replaceWith))
    }
    /**
     * The text with every occurrence of `findString` replaced by `replaceWith`: `replace(<this>, <findString>,
     * <replaceWith>)`.
     *
     * It is case-sensitive: on SQL Server and Oracle, whose `replace` follows the collation, it forces the
     * connection's `replaceCollation`, a binary collation by default.
     */
    replaceAll(findString: string, replaceWith: string): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * The text with every occurrence of `findString` replaced by `replaceWith`: `replace(<this>, <findString>,
     * <replaceWith>)`.
     *
     * It is case-sensitive: on SQL Server and Oracle, whose `replace` follows the collation, it forces the
     * connection's `replaceCollation`, a binary collation by default.
     */
    replaceAll<VALUE2 extends IStringValue>(findString: string, replaceWith: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE2>>>
    /**
     * The text with every occurrence of `findString` replaced by `replaceWith`: `replace(<this>, <findString>,
     * <replaceWith>)`.
     *
     * It is case-sensitive: on SQL Server and Oracle, whose `replace` follows the collation, it forces the
     * connection's `replaceCollation`, a binary collation by default.
     */
    replaceAll<VALUE extends IStringValue>(findString: VALUE, replaceWith: string): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /**
     * The text with every occurrence of `findString` replaced by `replaceWith`: `replace(<this>, <findString>,
     * <replaceWith>)`.
     *
     * It is case-sensitive: on SQL Server and Oracle, whose `replace` follows the collation, it forces the
     * connection's `replaceCollation`, a binary collation by default.
     */
    replaceAll<VALUE extends IStringValue, VALUE2 extends IStringValue>(findString: VALUE, replaceWith: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE> | SourceOf<VALUE2>, DataTypeOf<this>, CombinedOptionality<CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>, OptionalityOf<VALUE2>>>
    replaceAll(findString: any, replaceWith: any): any {
        return __newSqlOperation2ValueSource('_replaceAll', this, findString, replaceWith, __computedTextClassOf(__typeClassOf(this), this, replaceWith), getOptionalType3(this, findString, replaceWith))
    }
    /**
     * As `replaceAllInsensitive`, but gives the receiver unchanged when `findString` or `replaceWith` is
     * missing: null, undefined or an empty string (unless the connection allows empty strings).
     */
    replaceAllInsensitiveIfValue(findString: string | null | undefined, replaceWith: string | null | undefined): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * As `replaceAllInsensitive`, but gives the receiver unchanged when `findString` or `replaceWith` is
     * missing: null, undefined or an empty string (unless the connection allows empty strings).
     */
    replaceAllInsensitiveIfValue<VALUE2 extends IStringValue>(findString: string | null | undefined, replaceWith: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE2>>>
    /**
     * As `replaceAllInsensitive`, but gives the receiver unchanged when `findString` or `replaceWith` is
     * missing: null, undefined or an empty string (unless the connection allows empty strings).
     */
    replaceAllInsensitiveIfValue<VALUE extends IStringValue>(findString: VALUE, replaceWith: string | null | undefined): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    replaceAllInsensitiveIfValue(findString: any, replaceWith: any): any {
        return __newSqlOperation2ValueSourceIfValueOrIgnore('_replaceAllInsensitive', this, findString, replaceWith, __computedTextClassOf(__typeClassOf(this), this, replaceWith), getOptionalType3(this, findString, replaceWith))
    }
    /**
     * As `replaceAll`, ignoring case when it looks for `findString`.
     *
     * On PostgreSQL it writes `regexp_replace(..., 'gi')`, which ignores only case; on MySQL and MariaDB
     * `regexp_replace` with the connection's `insensitiveCollation` when it has one; on SQL Server and Oracle
     * `replace` under a case-insensitive collation. On SQLite it calls the function the connection names in
     * `replaceAllInsensitiveFunction`, and without one it is the case-sensitive `replace`.
     */
    replaceAllInsensitive(findString: string, replaceWith: string): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    /**
     * As `replaceAll`, ignoring case when it looks for `findString`.
     *
     * On PostgreSQL it writes `regexp_replace(..., 'gi')`, which ignores only case; on MySQL and MariaDB
     * `regexp_replace` with the connection's `insensitiveCollation` when it has one; on SQL Server and Oracle
     * `replace` under a case-insensitive collation. On SQLite it calls the function the connection names in
     * `replaceAllInsensitiveFunction`, and without one it is the case-sensitive `replace`.
     */
    replaceAllInsensitive<VALUE2 extends IStringValue>(findString: string, replaceWith: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE2>>>
    /**
     * As `replaceAll`, ignoring case when it looks for `findString`.
     *
     * On PostgreSQL it writes `regexp_replace(..., 'gi')`, which ignores only case; on MySQL and MariaDB
     * `regexp_replace` with the connection's `insensitiveCollation` when it has one; on SQL Server and Oracle
     * `replace` under a case-insensitive collation. On SQLite it calls the function the connection names in
     * `replaceAllInsensitiveFunction`, and without one it is the case-sensitive `replace`.
     */
    replaceAllInsensitive<VALUE extends IStringValue>(findString: VALUE, replaceWith: string): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /**
     * As `replaceAll`, ignoring case when it looks for `findString`.
     *
     * On PostgreSQL it writes `regexp_replace(..., 'gi')`, which ignores only case; on MySQL and MariaDB
     * `regexp_replace` with the connection's `insensitiveCollation` when it has one; on SQL Server and Oracle
     * `replace` under a case-insensitive collation. On SQLite it calls the function the connection names in
     * `replaceAllInsensitiveFunction`, and without one it is the case-sensitive `replace`.
     */
    replaceAllInsensitive<VALUE extends IStringValue, VALUE2 extends IStringValue>(findString: VALUE, replaceWith: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE> | SourceOf<VALUE2>, DataTypeOf<this>, CombinedOptionality<CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>, OptionalityOf<VALUE2>>>
    replaceAllInsensitive(findString: any, replaceWith: any): any {
        return __newSqlOperation2ValueSource('_replaceAllInsensitive', this, findString, replaceWith, __computedTextClassOf(__typeClassOf(this), this, replaceWith), getOptionalType3(this, findString, replaceWith))
    }
}

/** A text, a JavaScript string */
export abstract class StringType extends StringsType<string> {
    static override readonly type = 'string'
    static override readonly sqlDataType: SqlDataType = stringSqlDataType
    declare [typeName]: 'type:string:'
    declare [operandTypeName]: 'type:string:'
}
