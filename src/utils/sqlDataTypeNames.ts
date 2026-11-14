import type { DatabaseType } from '../queryRunners/QueryRunner.js'
import type { SqlDataType } from '../TypeAdapter.js'

/**
 * The parts of the name of a type as a database writes it: `key`, the words in lower case and one space apart, without
 * what is between parentheses (`interval day(2) to second(6)` gives `interval day to second`); `args`, what was between
 * them, in order, each argument trimmed (`['2', '6']`; `enum('a','b')` gives `["'a'", "'b'"]`); `arrayDimensions`, the
 * `[]` at the end (PostgreSQL).
 */
export interface NativeTypeParts {
    readonly key: string
    readonly args: readonly string[]
    readonly arrayDimensions: number
}

export function nativeTypeParts(nativeName: string): NativeTypeParts {
    let text = nativeName.trim()
    let arrayDimensions = 0
    while (/\[\s*\d*\s*\]$/.test(text)) {
        text = text.replace(/\[\s*\d*\s*\]$/, '').trimEnd()
        arrayDimensions++
    }
    const args: string[] = []
    let key = ''
    let i = 0
    while (i < text.length) {
        const char = text[i]!
        if (char !== '(') {
            key += char
            i++
            continue
        }
        // The arguments between this parenthesis and its pair, split by the commas outside quotes
        let depth = 1
        let quote: string | undefined
        let current = ''
        i++
        for (; i < text.length; i++) {
            const c = text[i]!
            if (quote) {
                current += c
                if (c === quote) {
                    if (text[i + 1] === quote) {
                        current += c
                        i++
                    } else {
                        quote = undefined
                    }
                }
                continue
            }
            if (c === "'" || c === '"') {
                quote = c
                current += c
            } else if (c === '(') {
                depth++
                current += c
            } else if (c === ')') {
                depth--
                if (depth === 0) {
                    break
                }
                current += c
            } else if (c === ',' && depth === 1) {
                args.push(current.trim())
                current = ''
            } else {
                current += c
            }
        }
        if (current.trim() !== '' || args.length > 0) {
            args.push(current.trim())
        }
        i++
        key += ' '
    }
    return { key: key.toLowerCase().replace(/\s+/g, ' ').trim(), args, arrayDimensions }
}

/** The number of an argument, or undefined when it isn't a whole number */
export function argumentNumber(arg: string | undefined): number | undefined {
    if (arg === undefined || !/^\d+$/.test(arg.trim())) {
        return undefined
    }
    return Number(arg.trim())
}

/** The text of a quoted argument (`'a'` gives `a`, `'it''s'` gives `it's`) */
export function unquotedArgument(arg: string): string {
    const text = arg.trim()
    if (text.length >= 2 && (text[0] === "'" || text[0] === '"') && text[text.length - 1] === text[0]) {
        const quote = text[0]
        return text.slice(1, -1).split(quote + quote).join(quote)
    }
    return text
}

/** The SQL data type with the native name of that database, as it was written, beside the ones it already has */
export function withNative(sqlDataType: SqlDataType, database: DatabaseType, nativeName: string): SqlDataType {
    return { ...sqlDataType, native: { ...sqlDataType.native, [database]: nativeName.trim() } }
}

/** The native name the SQL data type keeps for that database, or undefined */
export function nativeNameFor(sqlDataType: SqlDataType, database: DatabaseType): string | undefined {
    return sqlDataType.native?.[database]
}

/** An integer of that many bytes: the number of decimal digits its range takes */
export function integerDigits(bytes: 1 | 2 | 3 | 4 | 8, unsigned: boolean): number {
    switch (bytes) {
        case 1: return 3
        case 2: return 5
        case 3: return unsigned ? 8 : 7
        case 4: return 10
        case 8: return unsigned ? 20 : 19
    }
}
