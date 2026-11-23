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

/**
 * The number of an argument of a type name that can be negative, like the scale of a `numeric(5, -2)` on PostgreSQL
 * and Oracle (its values are multiples of 100); undefined when it isn't an integer
 */
export function signedArgumentNumber(arg: string | undefined): number | undefined {
    if (arg === undefined || !/^-?\d+$/.test(arg.trim())) {
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

/** Where a SQL data type keeps, hidden, the native name each class of connection resolved for it */
const nativeCacheKey: unique symbol = Symbol('nativeSqlDataTypes')
/** Where a class of connection keeps its id, the index of its entry in that cache */
const connectionClassIdKey: unique symbol = Symbol('sqlDataTypeConnectionClassId')
let nextConnectionClassId = 0

/** The id of the class of the connection, given the first time it is asked */
export function connectionClassIdOf(connection: object): number {
    const connectionClass = connection.constructor as { [connectionClassIdKey]?: number }
    if (Object.hasOwn(connectionClass, connectionClassIdKey)) {
        return connectionClass[connectionClassIdKey]!
    }
    const id = nextConnectionClassId++
    Object.defineProperty(connectionClass, connectionClassIdKey, { value: id })
    return id
}

/**
 * The native name of the SQL data type kept for that class of connection: the name, null when the database can't hold
 * it, or undefined when it isn't kept yet. It is kept in the SQL data type itself, hidden (not enumerable: a spread,
 * JSON.stringify and a comparison don't see it)
 */
export function keptNativeSqlDataType(sqlDataType: SqlDataType, connectionClassId: number): string | null | undefined {
    const cache = (sqlDataType as { [nativeCacheKey]?: (string | null | undefined)[] })[nativeCacheKey]
    return cache === undefined ? undefined : cache[connectionClassId]
}

/** Keeps the native name of the SQL data type for that class of connection; a SQL data type that can't be extended (frozen) keeps nothing */
export function keepNativeSqlDataType(sqlDataType: SqlDataType, connectionClassId: number, native: string | undefined): void {
    let cache = (sqlDataType as { [nativeCacheKey]?: (string | null | undefined)[] })[nativeCacheKey]
    if (cache === undefined) {
        if (!Object.isExtensible(sqlDataType)) {
            return
        }
        cache = []
        Object.defineProperty(sqlDataType, nativeCacheKey, { value: cache })
    }
    cache[connectionClassId] = native === undefined ? null : native
}

/**
 * What a query runner derives from the native name of a SQL data type for that class of connection, kept in the SQL
 * data type itself, hidden, as the native name: null when there is nothing, undefined when it isn't kept yet
 */
export function keptDerivedOfSqlDataType<T>(sqlDataType: SqlDataType, key: symbol, connectionClassId: number): T | null | undefined {
    const cache = Object.hasOwn(sqlDataType, key) ? (sqlDataType as unknown as { [key: symbol]: (T | null | undefined)[] })[key] : undefined
    return cache === undefined ? undefined : cache[connectionClassId]
}

/** Keeps what a query runner derives from a SQL data type for that class of connection (see keptDerivedOfSqlDataType) */
export function keepDerivedOfSqlDataType<T>(sqlDataType: SqlDataType, key: symbol, connectionClassId: number, derived: T | undefined): void {
    let cache = Object.hasOwn(sqlDataType, key) ? (sqlDataType as unknown as { [key: symbol]: (T | null | undefined)[] })[key] : undefined
    if (cache === undefined) {
        if (!Object.isExtensible(sqlDataType)) {
            return
        }
        cache = []
        Object.defineProperty(sqlDataType, key, { value: cache })
    }
    cache[connectionClassId] = derived === undefined ? null : derived
}
