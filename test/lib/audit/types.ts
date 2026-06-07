// Shared types for the tests:audit content checks. See AUDIT.md.

export type Severity = 'warn' | 'error'

export interface Finding {
    rule: string
    file: string
    line: number
    message: string
}
