export interface ConnectionConfiguration {
    allowEmptyString: boolean
    escape(identifier: string): string
    insesitiveCollation?: string
}