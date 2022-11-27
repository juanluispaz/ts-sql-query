export interface DefaultTypeAdapter {
    transformValueFromDB(value: unknown, type: string): unknown
    transformValueToDB(value: unknown, type: string): unknown
    transformPlaceholder(placeholder: string, type: string, forceTypeCast: boolean, valueSentToDB: unknown): string
}

export interface TypeAdapter {
    transformValueFromDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown
    transformValueToDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown
    transformPlaceholder?(placeholder: string, type: string, forceTypeCast: boolean, valueSentToDB: unknown, next: DefaultTypeAdapter): string
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

    transformValueFromDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, type)
    }

    transformValueToDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, type)
    }
}

export class ForceTypeCast implements TypeAdapter {

    transformValueFromDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, type)
    }

    transformValueToDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, type)
    }

    transformPlaceholder(placeholder: string, type: string, _forceTypeCast: boolean, valueSentToDB: unknown, next: DefaultTypeAdapter): string {
        return next.transformPlaceholder(placeholder, type, true, valueSentToDB)
    }
}