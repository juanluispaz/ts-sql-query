export interface DefaultTypeAdapter {
    transformValueFromDB(value: unknown, type: string): unknown
    transformValueToDB(value: unknown, type: string): unknown
}

export interface TypeAdapter {
    transformValueFromDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown
    transformValueToDB(value: unknown, type: string, next: DefaultTypeAdapter): unknown
}
