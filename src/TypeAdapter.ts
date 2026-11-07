/**
 * The category of the type of a value: the first argument of a column, like `'customInt'` in
 * `column('id', 'customInt', 'MyIntTypeName')`, or `''` when it isn't known. The transforms receive it with the name
 * of the type, and a custom type is converted as the type of its category (`customInt` as an `int`) unless its
 * conversion is registered.
 */
export type TypeCategory = 'boolean'
    | 'int' | 'bigint' | 'customInt' | 'customBigint'
    | 'double' | 'customDouble'
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
    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, forceTypeCast: boolean, valueSentToDB: unknown): string
}

export interface TypeAdapter {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown
    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown
    transformPlaceholder?(placeholder: string, type: string, typeCategory: TypeCategory, forceTypeCast: boolean, valueSentToDB: unknown, next: DefaultTypeAdapter): string
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

export class ForceTypeCast implements TypeAdapter {

    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, type, typeCategory)
    }

    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, type, typeCategory)
    }

    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, _forceTypeCast: boolean, valueSentToDB: unknown, next: DefaultTypeAdapter): string {
        return next.transformPlaceholder(placeholder, type, typeCategory, true, valueSentToDB)
    }
}