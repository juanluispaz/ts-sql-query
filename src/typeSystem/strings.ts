import type { CustomType } from '../TypeAdapter.js'
import { __isString } from './dataTypes.js'
import { ComparableType } from './comparable.js'
import type { IValueWithType, OptionalOf, SourceOf, TypeOf, ValueSource } from './base.js'
import { BooleanConditionType, type BooleanType, type IfValueSource } from './logical.js'
import type { INumberValue } from './base.js'
import type { MergeOptional, MergeRequired } from './valueSource.js'
import { operandTypeName, typeName } from '../utils/symbols.js'
import { IntType } from './number.js'
import { __typeClassOf } from '../nodes/dataTypeClassOf.js'
import { __newSqlOperation1ValueSourceIfValueOrIgnore, __newSqlOperation1ValueSourceIfValueOrNoop, __newSqlOperation2ValueSourceIfValueOrIgnore } from '../nodes/ifValue.js'
import { getOptionalType2, getOptionalType3, getRequiredType2, getTypeAdapter2, getTypeAdapter3 } from '../nodes/operands.js'
import { __newSqlOperation0ValueSource, __newSqlOperation1ValueSource, __newSqlOperation2ValueSource, __newSqlOperationCollateValueSource } from '../nodes/operations.js'
import { type ValueSourceRoot } from '../nodes/valueSourceRoot.js'

/** What a position that takes a text accepts */
export type IStringValue = IValueWithType<'type:string:'>

/** The family of the texts: what every text offers */
export abstract class StringsType</*in|out*/ VALUE_TYPE> extends ComparableType<VALUE_TYPE> {
    /** Whether a type and a custom type are of a text */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return __isString(type, customType)
    }

    // SqlComparator 1
    equalsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    equalsInsensitiveIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_equalsInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    equalsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    equalsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    equalsInsensitive(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_equalsInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notEqualsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    notEqualsInsensitiveIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notEqualsInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notEqualsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notEqualsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notEqualsInsensitive(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_notEqualsInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    likeIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    likeIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_like', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    like(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    like<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    like(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_like', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notLikeIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    notLikeIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notLike', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notLike(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notLike<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notLike(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_notLike', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    likeInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    likeInsensitiveIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_likeInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    likeInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    likeInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    likeInsensitive(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_likeInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notLikeInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    notLikeInsensitiveIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notLikeInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notLikeInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notLikeInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notLikeInsensitive(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_notLikeInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    startsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    startsWithIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_startsWith', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    startsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    startsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    startsWith(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_startsWith', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notStartsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    notStartsWithIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notStartsWith', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notStartsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notStartsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notStartsWith(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_notStartsWith', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    endsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    endsWithIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_endsWith', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    endsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    endsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    endsWith(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_endsWith', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notEndsWithIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    notEndsWithIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notEndsWith', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notEndsWith(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notEndsWith<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notEndsWith(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_notEndsWith', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    startsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    startsWithInsensitiveIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_startsWithInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    startsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    startsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    startsWithInsensitive(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_startsWithInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notStartsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    notStartsWithInsensitiveIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notStartsWithInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notStartsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notStartsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notStartsWithInsensitive(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_notStartsWithInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    endsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    endsWithInsensitiveIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_endsWithInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    endsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    endsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    endsWithInsensitive(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_endsWithInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notEndsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    notEndsWithInsensitiveIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notEndsWithInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notEndsWithInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notEndsWithInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notEndsWithInsensitive(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_notEndsWithInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    containsIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    containsIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_contains', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    contains(value: string ): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    contains<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    contains(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_contains', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notContainsIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    notContainsIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notContains', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notContains(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notContains<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notContains(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_notContains', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    containsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    containsInsensitiveIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_containsInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    containsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    containsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    containsInsensitive(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_containsInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notContainsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    notContainsInsensitiveIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notContainsInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notContainsInsensitive(value: string): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notContainsInsensitive<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notContainsInsensitive(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_notContainsInsensitive', vs, value, BooleanConditionType, getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
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
    collate(collation: string): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    collate(collation: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperationCollateValueSource(vs, collation, __typeClassOf(vs), vs.__optionalType, vs.__typeAdapter)
    }
    toLowerCase(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    toLowerCase(): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation0ValueSource('_toLowerCase', vs, __typeClassOf(vs), vs.__optionalType, vs.__typeAdapter)
    }
    toUpperCase(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    toUpperCase(): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation0ValueSource('_toUpperCase', vs, __typeClassOf(vs), vs.__optionalType, vs.__typeAdapter)
    }
    length(): ValueSource<SourceOf<this>, IntType, OptionalOf<this>>
    length(): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation0ValueSource('_length', vs, IntType, vs.__optionalType, vs.__typeAdapter)
    }
    trim(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    trim(): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation0ValueSource('_trim', vs, __typeClassOf(vs), vs.__optionalType, vs.__typeAdapter)
    }
    trimLeft(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    trimLeft(): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation0ValueSource('_trimLeft', vs, __typeClassOf(vs), vs.__optionalType, vs.__typeAdapter)
    }
    trimRight(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    trimRight(): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation0ValueSource('_trimRight', vs, __typeClassOf(vs), vs.__optionalType, vs.__typeAdapter)
    }
    reverse(): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    reverse(): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation0ValueSource('_reverse', vs, __typeClassOf(vs), vs.__optionalType, vs.__typeAdapter)
    }
    // SqlFunction1
    concatIfValue(value: string | null | undefined): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    concatIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrIgnore('_concat', vs, value, __typeClassOf(vs), getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    concat(value: string): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    concat<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    concat(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_concat', vs, value, __typeClassOf(vs), getOptionalType2(vs, value), getTypeAdapter2(vs, value))
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
    concatIgnoringNullIfValue(value: string | null | undefined): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    concatIgnoringNullIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        // The optionality is the RECEIVER's (`getOptionalType2` with a plain value), not the
        // stricter one `concatIgnoringNull` computes: an ABSENT value leaves the receiver alone,
        // and whether it is absent is a run-time fact. Absence also depends on the connection's
        // `allowEmptyString`, which vs constructor cannot see.
        return __newSqlOperation1ValueSourceIfValueOrIgnore('_concatIgnoringNull', vs, value, __typeClassOf(vs), getOptionalType2(vs, value), getTypeAdapter2(vs, value))
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
    concatIgnoringNull(value: string): ValueSource<SourceOf<this>, TypeOf<this>, 'required'>
    concatIgnoringNull<VALUE extends IStringValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeRequired<OptionalOf<this>, OptionalOf<VALUE>>>
    concatIgnoringNull(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        // A NULL operand counts as the empty string, so the result is optional only when EVERY
        // operand is: `getRequiredType2` keeps the STRICTEST operand instead of the loosest.
        return __newSqlOperation1ValueSource('_concatIgnoringNull', vs, value, __typeClassOf(vs), getRequiredType2(vs, value), getTypeAdapter2(vs, value))
    }
    substrToEnd(start: number): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    substrToEnd<VALUE extends INumberValue>(start: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    substrToEnd(start: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_substrToEnd', vs, start, __typeClassOf(vs), getOptionalType2(vs, start), getTypeAdapter2(vs, start))
    }
    substringToEnd(start: number): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    substringToEnd<VALUE extends INumberValue>(start: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    substringToEnd(start: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_substringToEnd', vs, start, __typeClassOf(vs), getOptionalType2(vs, start), getTypeAdapter2(vs, start))
    }
    // SqlFunction2
    substr(start: number, count: number): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    substr<VALUE2 extends INumberValue>(start: number, count: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE2>>>
    substr<VALUE extends INumberValue>(start: VALUE, count: number): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    substr<VALUE extends INumberValue, VALUE2 extends INumberValue>(start: VALUE, count: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>, OptionalOf<VALUE2>>>
    substr(start: any, count: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation2ValueSource('_substr', vs, start, count, __typeClassOf(vs), getOptionalType3(vs, start, count), getTypeAdapter3(vs, start, count))
    }
    substring(start: number, count: number): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    substring<VALUE2 extends INumberValue>(start: number, end: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE2>>>
    substring<VALUE extends INumberValue>(start: VALUE, end: number): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    substring<VALUE extends INumberValue, VALUE2 extends INumberValue>(start: VALUE, end: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>, OptionalOf<VALUE2>>>
    substring(start: any, end: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation2ValueSource('_substring', vs, start, end, __typeClassOf(vs), getOptionalType3(vs, start, end), getTypeAdapter3(vs, start, end))
    }
    replaceAllIfValue(findString: string | null | undefined, replaceWith: string | null | undefined): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    replaceAllIfValue<VALUE2 extends IStringValue>(findString: string | null | undefined, replaceWith: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE2>>>
    replaceAllIfValue<VALUE extends IStringValue>(findString: VALUE, replaceWith: string | null | undefined): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    replaceAllIfValue(findString: any, replaceWith: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation2ValueSourceIfValueOrIgnore('_replaceAll', vs, findString, replaceWith, __typeClassOf(vs), getOptionalType3(vs, findString, replaceWith), getTypeAdapter3(vs, findString, replaceWith))
    }
    replaceAll(findString: string, replaceWith: string): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    replaceAll<VALUE2 extends IStringValue>(findString: string, replaceWith: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE2>>>
    replaceAll<VALUE extends IStringValue>(findString: VALUE, replaceWith: string): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    replaceAll<VALUE extends IStringValue, VALUE2 extends IStringValue>(findString: VALUE, replaceWith: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>, OptionalOf<VALUE2>>>
    replaceAll(findString: any, replaceWith: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation2ValueSource('_replaceAll', vs, findString, replaceWith, __typeClassOf(vs), getOptionalType3(vs, findString, replaceWith), getTypeAdapter3(vs, findString, replaceWith))
    }
    replaceAllInsensitiveIfValue(findString: string | null | undefined, replaceWith: string | null | undefined): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    replaceAllInsensitiveIfValue<VALUE2 extends IStringValue>(findString: string | null | undefined, replaceWith: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE2>>>
    replaceAllInsensitiveIfValue<VALUE extends IStringValue>(findString: VALUE, replaceWith: string | null | undefined): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    replaceAllInsensitiveIfValue(findString: any, replaceWith: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation2ValueSourceIfValueOrIgnore('_replaceAllInsensitive', vs, findString, replaceWith, __typeClassOf(vs), getOptionalType3(vs, findString, replaceWith), getTypeAdapter3(vs, findString, replaceWith))
    }
    replaceAllInsensitive(findString: string, replaceWith: string): ValueSource<SourceOf<this>, TypeOf<this>, OptionalOf<this>>
    replaceAllInsensitive<VALUE2 extends IStringValue>(findString: string, replaceWith: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE2>>>
    replaceAllInsensitive<VALUE extends IStringValue>(findString: VALUE, replaceWith: string): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    replaceAllInsensitive<VALUE extends IStringValue, VALUE2 extends IStringValue>(findString: VALUE, replaceWith: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE> | SourceOf<VALUE2>, TypeOf<this>, MergeOptional<MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>, OptionalOf<VALUE2>>>
    replaceAllInsensitive(findString: any, replaceWith: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation2ValueSource('_replaceAllInsensitive', vs, findString, replaceWith, __typeClassOf(vs), getOptionalType3(vs, findString, replaceWith), getTypeAdapter3(vs, findString, replaceWith))
    }
    // Redefined methods
}

/** A text, a JavaScript string */
export abstract class StringType extends StringsType<string> {
    static override readonly type = 'string'
    static override readonly customType = undefined
    declare [typeName]: 'type:string:'
    declare [operandTypeName]: 'type:string:'
}
