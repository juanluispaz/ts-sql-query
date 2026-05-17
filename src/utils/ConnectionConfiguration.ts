export interface ConnectionConfiguration {
    allowEmptyString: boolean
    escape(identifier: string, strict: boolean): string
    insensitiveCollation?: string
    getDateTimeFormat?(type: string): string
    compatibilityVersion: number
    uuidStrategy?: string
    usePlatformDependentRound?: boolean
}