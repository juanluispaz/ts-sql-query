export interface DefaultTypeAdapter {
    transformValueFromDB(value: any, type: string): any
    transformValueToDB(value: any, type: string): any
}

export interface TypeAdapter {
    transformValueFromDB(value: any, type: string, next: DefaultTypeAdapter): any
    transformValueToDB(value: any, type: string, next: DefaultTypeAdapter): any
}
