/**
 * The category of the type of a value: the first argument of a column, like `'customInt'` in
 * `column('id', 'customInt', 'MyIntTypeName')`, or `''` when it isn't known. The transforms receive it with the name
 * of the type, and a custom type is converted as the type of its category (`customInt` as an `int`) unless its
 * conversion is registered.
 */
export type TypeCategory = 'boolean'
    | 'int' | 'bigint' | 'customInt' | 'customBigint'
    | 'double' | 'customDouble' | 'stringDecimal' | 'customDecimal'
    | 'string'
    | 'uuid' | 'customUuid'
    | 'localDate' | 'customLocalDate'
    | 'localTime' | 'customLocalTime'
    | 'localDateTime' | 'customLocalDateTime'
    | 'enum' | 'custom' | 'customComparable'
    | ''

/**
 * Where a value leaves the database, given to `transformProjection`: `'resultColumn'` is a column of the result of the
 * query (a column of the outermost select, of the returning of an insert, an update or a delete, or the value of a
 * function called with `executeFunction`).
 * `'aggregatedArrayValue'` is a value inside the JSON of an aggregated array (`aggregateAsArray`,
 * `aggregateAsArrayOfOneColumn`, a select used as an aggregated array): a converted value there is the SQL of a text,
 * which the library writes in the JSON as a string.
 */
export type ProjectionOutput = 'resultColumn' | 'aggregatedArrayValue'

/**
 * How the SQL that `transformProjection` returns for a value compares with the value, given by `projectionComparison`:
 * `'value'` compares and orders like the value (equal values give equal SQL, different values give different SQL, and
 * the SQL orders as the values do); `'equality'` compares like the value but orders otherwise; `'columnEquality'`
 * compares like the value only among the values of the same column (two equal values of two columns or expressions can
 * give different SQL, like two decimals of different scales) and orders otherwise; `'none'` neither compares nor orders
 * like the value (two different values can give the same SQL, or two equal values different SQL).
 */
export type ProjectionComparison = 'value' | 'equality' | 'columnEquality' | 'none'

export interface DefaultTypeAdapter {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory): unknown
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory): unknown
    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown): string
    forceTypeCast(type: string, typeCategory: TypeCategory, valueSentToDB: unknown, forceTypeCast: boolean): boolean
    /**
     * The SQL of a value as it leaves the database, with the conversion of the library: SQL Server writes a decimal of
     * a column of the result as its text (`convert(nvarchar(41), <sql>)`); every other value, every value inside the
     * JSON of an aggregated array, and every value on the other databases, keeps the SQL it receives
     */
    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput): string
    /**
     * How the SQL of the conversion of the library (`transformProjection`) compares with the value: `'value'` for every
     * value, except a decimal of a column of the result on SQL Server, `'columnEquality'` (its text orders otherwise,
     * and two equal decimals of different scales give different texts)
     */
    projectionComparison(type: string, typeCategory: TypeCategory, output: ProjectionOutput): ProjectionComparison
}

export interface TypeAdapter {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown
    transformPlaceholder?(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown, next: DefaultTypeAdapter): string
    /**
     * Whether the database must receive the type of the parameter (the query runner writes a cast in the placeholder,
     * or sends the parameter with its type): it receives the one the library decided for the position where the
     * parameter is written, and returns the one to use
     */
    forceTypeCast?(type: string, typeCategory: TypeCategory, valueSentToDB: unknown, forceTypeCast: boolean, next: DefaultTypeAdapter): boolean
    /**
     * The SQL of a value as it leaves the database, the pair of `transformValueFromDB`, which reads what it gives:
     * `sql` is the value as the library writes it, and the SQL returned is what the database returns in `output`.
     * In `'aggregatedArrayValue'` it is the SQL of a text, which the library writes in the JSON as a string, and
     * `transformValueFromDB` receives that text. `next.transformProjection(...)` applies the conversion of the library
     * (on SQL Server, a decimal of a column of the result is written as its text). The value keeps its SQL everywhere
     * else in the query: the arms of a compound query compare the values, the order by of a column of the select orders
     * by the value, the distinct, the order by and the limit of a select used as an aggregated array compare and order
     * the values, and a subquery, a `with`, the group by and the having use the value. It only writes SQL: it adds no
     * parameter, and when it doesn't convert the value it returns the SQL it receives (an empty `sql` gives an empty
     * text)
     */
    transformProjection?(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string
    /**
     * How the SQL that `transformProjection` returns for the value in `output` compares with the value, which decides
     * what the library does where the query compares (equality, distinct, union, intersect, except) or orders it:
     * - `'value'`: it compares and orders like the value; the converted SQL is written in place and nothing else changes
     *   in the query.
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
     *
     * Without this method the connection answers, as for its own conversion (`next.projectionComparison(...)`):
     * `'value'`, except for a decimal of a column of the result on SQL Server (`'columnEquality'`). It isn't asked when
     * `transformProjection` doesn't convert the value
     */
    projectionComparison?(type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): ProjectionComparison
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

    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, type, typeCategory)
    }

    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, type, typeCategory)
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

    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, type, typeCategory)
    }

    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, type, typeCategory)
    }
}

/**
 * Asks the query runner to give the database the type of each parameter of the column or the value it is used with,
 * in every position, as the library does in the positions where PostgreSQL can't work out the type of a parameter: the
 * query runner writes a cast in the placeholder, like `$1::int4`, or sends the parameter with its type when the driver
 * can.
 */
export class ForceTypeCast implements TypeAdapter {

    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, type, typeCategory)
    }

    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, type, typeCategory)
    }

    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown, next: DefaultTypeAdapter): string {
        return next.transformPlaceholder(placeholder, type, typeCategory, valueSentToDB)
    }

    forceTypeCast(_type: string, _typeCategory: TypeCategory, _valueSentToDB: unknown, _forceTypeCast: boolean, _next: DefaultTypeAdapter): boolean {
        return true
    }
}