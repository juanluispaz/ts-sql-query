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
 * query (a column of the outermost select, or the value of a function called with `executeFunction`).
 * `'aggregatedArrayValue'` is a value inside the JSON of an aggregated array; the library doesn't ask for it yet.
 */
export type ProjectionOutput = 'resultColumn' | 'aggregatedArrayValue'

export interface DefaultTypeAdapter {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory): unknown
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory): unknown
    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown): string
    forceTypeCast(type: string, typeCategory: TypeCategory, valueSentToDB: unknown, forceTypeCast: boolean): boolean
    /**
     * The SQL of a value as it leaves the database, with the conversion of the library: SQL Server writes a decimal of
     * a column of the result as its text (`convert(nvarchar(41), <sql>)`); every other value, and every value on the
     * other databases, keeps the SQL it receives
     */
    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput): string
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
     * `next.transformProjection(...)` applies the conversion of the library (on SQL Server, a decimal of a column of
     * the result is written as its text). The value keeps its SQL everywhere else in the query: the arms of a compound
     * query compare the values, the order by of a column of the select orders by the value, and a subquery, a `with`,
     * the group by and the having use the value. It only writes SQL: it adds no parameter, and when it doesn't convert
     * the value it returns the SQL it receives (an empty `sql` gives an empty text)
     */
    transformProjection?(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string
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