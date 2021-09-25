export interface ConnectionConfiguration {
    allowEmptyString: boolean
    escape(identifier: string, strict: boolean): string
    insesitiveCollation?: string
    getDateTimeFormat?(type: string): string
}