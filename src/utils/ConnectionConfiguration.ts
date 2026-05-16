export interface ConnectionConfiguration {
    allowEmptyString: boolean
    escape(identifier: string, strict: boolean): string
    insensitiveCollation?: string
    /** @deprecated use insensitiveCollation property instead */
    insesitiveCollation?: string
    getDateTimeFormat?(type: string): string
    compatibilityMode?: boolean
    uuidStrategy?: string
    alwaysUseReturningClauseWhenInsert?: boolean
}
