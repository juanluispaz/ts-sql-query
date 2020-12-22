export interface DefaultTypeAdapter {
    transformValueFromDB(value: unknown, type: string): any
    transformValueToDB(value: unknown, type: string): any
}

export interface TypeAdapter {
    transformValueFromDB(value: unknown, type: string, next: DefaultTypeAdapter): any
    transformValueToDB(value: unknown, type: string, next: DefaultTypeAdapter): any
}
