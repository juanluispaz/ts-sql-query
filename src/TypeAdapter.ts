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

export interface DefaultTypeAdapter {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory): unknown
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory): unknown
    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown): string
    forceTypeCast(type: string, typeCategory: TypeCategory, valueSentToDB: unknown, forceTypeCast: boolean): boolean
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
 * digits with the fraction at zero, and `getTime` counts the `DATE` itself. `valueWhenNull` writes
 * `nvl(cast(<column> as timestamp), …)`, a TIMESTAMP. Everywhere else the column is written as it is. The values sent and received are not changed. On a column of any
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