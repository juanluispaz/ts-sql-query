import { oracleDateParam } from './utils/metadataSymbols.js'
import type { ConnectionConfiguration } from './queryRunners/QueryRunner.js'
import { __isLocalDateTime, __isLocalTime } from './utils/dataTypes.js'

/**
 * Which custom type a value is, the first argument of its column when it is a custom one, like `'customInt'` in
 * `column('id', 'customInt', 'MyIntTypeName')`: a custom type is converted as the built-in type it is based on
 * (`customInt` as an `int`) unless its conversion is registered; an `enum`, a `custom` or a `customComparable` is sent
 * and received as it comes.
 */
export type CustomType = 'customInt' | 'customBigint' | 'customDouble' | 'customDecimal'
    | 'customUuid'
    | 'customLocalDate' | 'customLocalTime' | 'customLocalDateTime'
    | 'enum' | 'custom' | 'customComparable'

/**
 * Where a value leaves the database, given to `transformProjection`: `'resultColumn'` is a column of the result of the
 * query (a column of the outermost select, of the returning of an insert, an update or a delete, or the value of a
 * function called with `executeFunction`).
 * `'aggregatedArrayValue'` is a value inside the JSON of an aggregated array (`aggregateAsArray`,
 * `aggregateAsArrayOfOneColumn`, a select used as an aggregated array): the SQL there is of a value the JSON function
 * of the database takes, of any type, and `transformValueFromDB` receives its text (a number too, with all its
 * digits); on SQL Server before 2025, whose JSON the library writes, a converted value goes in it as a string.
 */
export type ProjectionOutput = 'resultColumn' | 'aggregatedArrayValue'

/**
 * How the SQL that `transformProjection` returns for a value compares with the value, said in its context (`comparison`):
 * `'value'` compares and orders like the value (equal values give equal SQL, different values give different SQL, and
 * the SQL orders as the values do); `'equality'` compares like the value but orders otherwise; `'columnEquality'`
 * compares like the value only among the values of the same column (two equal values of two columns or expressions can
 * give different SQL, like two decimals of different scales) and orders otherwise; `'none'` neither compares nor orders
 * like the value (two different values can give the same SQL, or two equal values different SQL).
 */
export type ProjectionComparison = 'value' | 'equality' | 'columnEquality' | 'none'

/**
 * What a method of a type adapter receives of the value it works on and of the query. A value has two types:
 * - the original type, the one declared in the library (`column('day', 'customLocalDate', 'ReleaseDay')`,
 *   `const(1, 'int')`), which never changes;
 * - the requested type, the one the value is communicated to the query runner and the database with: by default the
 *   original one. A type adapter can request another (`setRequestedType`), and the next one in the chain, and the
 *   conversion of the library, decide by the type requested.
 */
export interface TypeAdapterContext {
    /** The configuration of the connection of the query */
    readonly connectionConfiguration: ConnectionConfiguration
    /** The name of the original type of the value, like `'int'` or `'ReleaseDay'`; it never changes */
    readonly originalType: string
    /** Which custom type the original type is, as declared in its column; undefined for a built-in type */
    readonly originalCustomType: CustomType | undefined
    /** The name of the type requested for the value; by default the original one */
    readonly requestedType: string
    /** Which custom type the requested type is; undefined for a built-in type */
    readonly requestedCustomType: CustomType | undefined
}

/**
 * The context of `transformValueToDB`: the parameter the value will be sent in. What the adapter writes in it applies
 * to that parameter; when the library transforms a value only to look at it (and adds no parameter), it is discarded.
 * The requested type is the type the value is sent with: the query runner receives it.
 */
export interface TypeAdapterValueToDBContext extends TypeAdapterContext {
    /**
     * Requests a built-in type, like `setRequestedType('string')`: the next type adapter and the conversion of the
     * library decide by it. It can be called again
     */
    setRequestedType(type: 'boolean' | 'int' | 'bigint' | 'double' | 'stringDecimal' | 'string' | 'uuid' | 'localDate' | 'localTime' | 'localDateTime'): void
    /** Requests a custom type, as a column declares it: `setRequestedType('customLocalDate', 'ReleaseDay')` */
    setRequestedType(customType: CustomType, type: string): void
    /** Requests the original type again */
    resetRequestedType(): void
    /**
     * Whether the database must receive the type of the parameter (the query runner writes a cast in the placeholder,
     * or sends the parameter with its type): it comes with what the library decided for the position where the
     * parameter is written, and the adapter can change it
     */
    forceTypeCast: boolean
    /**
     * Keeps a value for the parameter, under a symbol of the adapter's own, so it can't collide; the query runner reads
     * it in the context of the query (`getParam(index)?.getMetadata(key)`). It isn't a parameter and isn't sent
     */
    setMetadata(key: symbol, value: unknown): void
    /** What was kept for the parameter under that key, or undefined */
    getMetadata(key: symbol): unknown
    /**
     * Keeps a value for the query, under a symbol of the adapter's own, so it can't collide; the query runner reads it
     * in the context of the query (`getMetadata(key)`). Discarded when the library calls the transform only to look at
     * the value or at what it says
     */
    setQueryMetadata(key: symbol, value: unknown): void
    /** What was kept for the query under that key, or undefined */
    getQueryMetadata(key: symbol): unknown
}

/** The context of `transformPlaceholder`: the parameter already added, whose placeholder the adapter receives */
export interface TypeAdapterPlaceholderContext extends TypeAdapterContext {
    /** The index of the parameter in the params; undefined when the placeholder is the literal `null`, not a parameter */
    readonly index: number | undefined
    /** The value sent in the parameter, as `transformValueToDB` gave it; null for the literal `null` */
    readonly valueSentToDB: unknown
    /** Whether the database receives the type of the parameter (decided before the placeholder was written) */
    readonly forceTypeCast: boolean
    /** Keeps a value for the parameter, as in `transformValueToDB`; nothing when there is no parameter */
    setMetadata(key: symbol, value: unknown): void
    /** What was kept for the parameter under that key, or undefined */
    getMetadata(key: symbol): unknown
    /**
     * Keeps a value for the query, under a symbol of the adapter's own, so it can't collide; the query runner reads it
     * in the context of the query (`getMetadata(key)`). Discarded when the library calls the transform only to look at
     * the value or at what it says
     */
    setQueryMetadata(key: symbol, value: unknown): void
    /** What was kept for the query under that key, or undefined */
    getQueryMetadata(key: symbol): unknown
}

/**
 * The context of `transformProjection`: what the adapter says of the SQL it returns. `transformProjection` may be
 * called with an empty `sql` to learn whether it converts the value; it must write the same whatever the `sql`. The
 * requested type is the type of the value the SQL returned gives, which the query runner receives; it is read only
 * when the SQL is converted.
 */
export interface TypeAdapterProjectionContext extends TypeAdapterContext {
    /**
     * Requests a built-in type, like `setRequestedType('string')`: the next type adapter and the conversion of the
     * library decide by it. It can be called again
     */
    setRequestedType(type: 'boolean' | 'int' | 'bigint' | 'double' | 'stringDecimal' | 'string' | 'uuid' | 'localDate' | 'localTime' | 'localDateTime'): void
    /** Requests a custom type, as a column declares it: `setRequestedType('customLocalDate', 'ReleaseDay')` */
    setRequestedType(customType: CustomType, type: string): void
    /** Requests the original type again */
    resetRequestedType(): void
    /** Where the value leaves the database (see `ProjectionOutput`) */
    readonly output: ProjectionOutput
    /**
     * How the SQL returned compares with the value (see `ProjectionComparison`), `'value'` unless the adapter or the
     * connection says otherwise; it is read only when the SQL is converted
     */
    comparison: ProjectionComparison
    /**
     * Keeps a value for the query, under a symbol of the adapter's own, so it can't collide; the query runner reads it
     * in the context of the query (`getMetadata(key)`). Discarded when the library calls the transform only to look at
     * the value or at what it says
     */
    setQueryMetadata(key: symbol, value: unknown): void
    /** What was kept for the query under that key, or undefined */
    getQueryMetadata(key: symbol): unknown
}

/**
 * The context of `transformValueFromDB`: the requested type is the type of the value received, the one
 * `transformProjection` requested (by default the original one). An adapter that converts the value to another type
 * requests that one before calling the next, which converts the value by it.
 */
export interface TypeAdapterValueFromDBContext extends TypeAdapterContext {
    /**
     * Requests a built-in type, like `setRequestedType('string')`: the next type adapter and the conversion of the
     * library decide by it. It can be called again
     */
    setRequestedType(type: 'boolean' | 'int' | 'bigint' | 'double' | 'stringDecimal' | 'string' | 'uuid' | 'localDate' | 'localTime' | 'localDateTime'): void
    /** Requests a custom type, as a column declares it: `setRequestedType('customLocalDate', 'ReleaseDay')` */
    setRequestedType(customType: CustomType, type: string): void
    /** Requests the original type again */
    resetRequestedType(): void
}

export interface DefaultTypeAdapter {
    /** Converts the value received as the requested type */
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext): unknown
    /** Converts the value to send as the requested type */
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext): unknown
    transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext): string
    /**
     * The SQL of a value as it leaves the database, with the conversion of the library for the requested type: SQL
     * Server writes a decimal of a column of the result as its text (`convert(nvarchar(41), <sql>)`, comparing as
     * `'columnEquality'`); PostgreSQL and Oracle with a database outside UTC write a localDateTime or a localTime with
     * its zone; every other value keeps the SQL it receives
     */
    transformProjection(sql: string, context: TypeAdapterProjectionContext): string
}

export interface TypeAdapter {
    /** Converts a value read from the database; `next.transformValueFromDB(...)` applies the conversion of the library */
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown
    /**
     * Converts a value before it is sent to the database; `next.transformValueToDB(...)` applies the conversion of the
     * library. In `context` the adapter can request the type the value is sent with (`setRequestedType`), decide
     * whether the database receives the type of the parameter (`forceTypeCast`) and keep, for the query runner, what it
     * knows of the parameter (`setMetadata`)
     */
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown
    /** The placeholder of the parameter, as the query runner wrote it, with the cast when there is one */
    transformPlaceholder?(placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string
    /**
     * The SQL of a value as it leaves the database, the pair of `transformValueFromDB`, which reads what it gives:
     * `sql` is the value as the library writes it, and the SQL returned is what the database returns in
     * `context.output`. `next.transformProjection(...)` applies the conversion of the library. The value keeps its SQL
     * everywhere else in the query: the arms of a compound query compare the values, the order by of a column of the
     * select orders by the value, the distinct, the order by and the limit of a select used as an aggregated array
     * compare and order the values, and a subquery, a `with`, the group by and the having use the value. It only writes
     * SQL: it adds no parameter, and when it doesn't convert the value it returns the SQL it receives (an empty `sql`
     * gives an empty text). In `context` the adapter says which type of value the SQL gives (`setRequestedType`) and
     * how it compares with the value (`comparison`), the same whatever the `sql` it receives:
     * - `'value'` (the default): it compares and orders like the value; the converted SQL is written in place and
     *   nothing else changes in the query.
     * - `'equality'`: equal values give equal SQL and different values different SQL, but it orders otherwise (a
     *   DD/MM/YYYY text of a date); the order by of the column orders by the value, a distinct or a compound select
     *   ordered by it is wrapped and converted over the wrapper, and the select of an aggregated array ordered by it
     *   orders the values.
     * - `'columnEquality'`: as `'equality'`, but only among the values of the same column: two equal values of two
     *   columns or expressions can give different SQL (the text of a decimal, `1.5` in a `decimal(10, 1)` and `1.50` in
     *   a `decimal(10, 2)`); besides the above, a compound query, whose arms compare values of different columns, is
     *   wrapped and converted over the wrapper. A distinct compares the values of one column, so it isn't wrapped.
     * - `'none'`: it neither compares nor orders like the value (a MM/YYYY text of a date, the text of a date and time
     *   with its offset); besides the above, a distinct select is wrapped and converted over the wrapper, and the
     *   distinct of an aggregated array is applied to the values before converting them, where the database allows it.
     */
    transformProjection?(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string
}

export class CustomBooleanTypeAdapter implements TypeAdapter {
    readonly trueValue: number | string
    readonly falseValue: number | string

    constructor(trueValue: number, falseValue: number)
    constructor(trueValue: string, falseValue: string)
    constructor(trueValue: number | string, falseValue: number | string) {
        this.trueValue = trueValue
        this.falseValue = falseValue
    }

    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, context)
    }

    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, context)
    }
}

/**
 * Declares a `localDateTime` or a `localTime` column that Oracle stores in a `DATE`, which holds the date and the time
 * to the second. Oracle's `extract` reads a `DATE` as a date without time (ORA-30076 for the hour, the minute and the
 * second) and `to_char` has no fraction of a second for it (ORA-01821), so the getters of the time write the column, or
 * a value made from it (`max`, `min`, `nullIfValue`, an inline select), as `cast(<column> as timestamp)`, the same
 * digits with the fraction at zero, and `getTime` counts the `DATE` itself. `valueWhenNull` with a
 * value of another type writes `nvl(cast(<column> as timestamp), …)`, a TIMESTAMP; of two of them, it stays a `DATE`. Everywhere else the column is written as it is. The values sent and received are not changed. On a column of any
 * other type it does nothing.
 */
export class OracleDateAsTimestampTypeAdapter implements TypeAdapter {

    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, context)
    }

    /**
     * Marks a parameter of the column sent as a localDateTime or a localTime as one of a DATE: the query runner binds it
     * as one
     */
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        const result = next.transformValueToDB(value, context)
        if (__isLocalDateTime(context.requestedType, context.requestedCustomType) || __isLocalTime(context.requestedType, context.requestedCustomType)) {
            context.setMetadata(oracleDateParam, true)
        }
        return result
    }
}

/**
 * Asks the query runner to give the database the type of each parameter of the column or the value it is used with,
 * in every position, as the library does in the positions where PostgreSQL can't work out the type of a parameter: the
 * query runner writes a cast in the placeholder, like `$1::int4`, or sends the parameter with its type when the driver
 * can.
 */
export class ForceTypeCast implements TypeAdapter {

    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, context)
    }

    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        context.forceTypeCast = true
        return next.transformValueToDB(value, context)
    }
}
