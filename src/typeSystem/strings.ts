import type { CustomType } from '../TypeAdapter.js'
import { __isString } from './dataTypes.js'
import { ComparableType } from './comparable.js'
import type { IValueWithType, OptionalOf, SourceOf, TypeOf, ValueSource } from './base.js'
import type { BooleanType, IfValueSource } from './logical.js'
import type { INumberValue } from './base.js'
import type { IntType } from './number.js'
import type { MergeOptional, MergeRequired } from './valueSource.js'
import { operandTypeName, typeName } from '../utils/symbols.js'

/** What a position that takes a text accepts */
export type IStringValue = IValueWithType<'type:string:'>

/** The family of the texts: what every text offers */
export abstract class StringsType</*in|out*/ VALUE_TYPE> extends ComparableType<VALUE_TYPE> {
    /** Whether a type and a custom type are of a text */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return __isString(type, customType)
    }

    // SqlComparator 1
    abstract equalsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract equalsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract equalsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract notEqualsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract notEqualsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract notEqualsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract likeIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract like(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract like<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract notLikeIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract notLike(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract notLike<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract likeInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract likeInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract likeInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract notLikeInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract notLikeInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract notLikeInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract startsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract startsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract startsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract notStartsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract notStartsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract notStartsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract endsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract endsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract endsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract notEndsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract notEndsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract notEndsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract startsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract startsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract startsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract notStartsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract notStartsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract notStartsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract endsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract endsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract endsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract notEndsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract notEndsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract notEndsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract containsIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract contains(value: string ): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract contains<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract notContainsIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract notContains(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract notContains<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract containsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract containsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract containsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract notContainsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    abstract notContainsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    abstract notContainsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    // SqlFunction0
    /**
     * Emits `(<this> collate <collation>)`, forcing a specific collation on this string
     * expression. The result is a `StringValueSource` of the same type, usable on either
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
    abstract collate(collation: string): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract toLowerCase(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract toUpperCase(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract length(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    abstract trim(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract trimLeft(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract trimRight(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract reverse(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    // SqlFunction1
    abstract concatIfValue(value: string | null | undefined): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract concat(value: string): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract concat<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    /**
     * {@link concatIgnoringNull} whose operand is dropped when the value is absent, the way
     * {@link concatIfValue} relates to {@link concat}: an absent value contributes nothing and
     * leaves no bound parameter behind, so a dynamic query can hand it a `string | null |
     * undefined` without branching first.
     *
     * The result keeps the RECEIVER's optionality, unlike {@link concatIgnoringNull}: whether the
     * operand that would make the result always present is there at all is only known at run time.
     */
    abstract concatIgnoringNullIfValue(value: string | null | undefined): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
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
    abstract concatIgnoringNull(value: string): ValueSource<SourceOf<this>, TypeOf<this>, 'required'>
    abstract concatIgnoringNull<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeRequired<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract substrToEnd(start: number): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract substrToEnd<VALUE extends INumberValue>(start: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract substringToEnd(start: number): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract substringToEnd<VALUE extends INumberValue>(start: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    // SqlFunction2
    abstract substr(start: number, count: number): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract substr<VALUE2 extends INumberValue>(start: number, count: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE2>>>
    abstract substr<VALUE extends INumberValue>(start: VALUE, count: number): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract substr<VALUE extends INumberValue, VALUE2 extends INumberValue>(start: VALUE, count: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>, OptionalOf<VALUE2>>>
    abstract substring(start: number, count: number): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract substring<VALUE2 extends INumberValue>(start: number, end: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE2>>>
    abstract substring<VALUE extends INumberValue>(start: VALUE, end: number): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract substring<VALUE extends INumberValue, VALUE2 extends INumberValue>(start: VALUE, end: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>, OptionalOf<VALUE2>>>
    abstract replaceAllIfValue(findString: string | null | undefined, replaceWith: string | null | undefined): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract replaceAllIfValue<VALUE2 extends IStringValue>(findString: string | null | undefined, replaceWith: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE2>>>
    abstract replaceAllIfValue<VALUE extends IStringValue>(findString: VALUE, replaceWith: string | null | undefined): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract replaceAll(findString: string, replaceWith: string): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract replaceAll<VALUE2 extends IStringValue>(findString: string, replaceWith: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE2>>>
    abstract replaceAll<VALUE extends IStringValue>(findString: VALUE, replaceWith: string): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract replaceAll<VALUE extends IStringValue, VALUE2 extends IStringValue>(findString: VALUE, replaceWith: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>, OptionalOf<VALUE2>>>
    abstract replaceAllInsensitiveIfValue(findString: string | null | undefined, replaceWith: string | null | undefined): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract replaceAllInsensitiveIfValue<VALUE2 extends IStringValue>(findString: string | null | undefined, replaceWith: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE2>>>
    abstract replaceAllInsensitiveIfValue<VALUE extends IStringValue>(findString: VALUE, replaceWith: string | null | undefined): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract replaceAllInsensitive(findString: string, replaceWith: string): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    abstract replaceAllInsensitive<VALUE2 extends IStringValue>(findString: string, replaceWith: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE2>>>
    abstract replaceAllInsensitive<VALUE extends IStringValue>(findString: VALUE, replaceWith: string): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract replaceAllInsensitive<VALUE extends IStringValue, VALUE2 extends IStringValue>(findString: VALUE, replaceWith: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>, OptionalOf<VALUE2>>>
    // Redefined methods
}

/** A text, a JavaScript string */
export abstract class StringType extends StringsType<string> {
    static override readonly type = 'string'
    static override readonly customType = undefined
    declare [typeName]: 'type:string:'
    declare [operandTypeName]: 'type:string:'
}
