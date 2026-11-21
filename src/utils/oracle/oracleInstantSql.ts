/**
 * The date and time in UTC of the SQL of an instant computed in the query, when that SQL is `from_tz(<it>, '+00:00')`
 * (the instant of a date and time in UTC, see OracleSqlBuilder._instantOfUtc): its first argument, which taking the
 * instant back to UTC (sys_extract_utc of its timestamp with time zone) would only give again; undefined otherwise
 */
export function oracleUtcOfInstantOfUtc(sql: string): string | undefined {
    const start = 'from_tz('
    const end = ", '+00:00')"
    if (!sql.startsWith(start) || !sql.endsWith(end)) {
        return undefined
    }
    // The parenthesis of from_tz closes at the end, and its first argument ends at the comma before '+00:00'
    let depth = 0
    let quote = false
    for (let i = start.length - 1; i < sql.length; i++) {
        const character = sql[i]!
        if (quote) {
            if (character === "'") {
                quote = false
            }
        } else if (character === "'") {
            quote = true
        } else if (character === '(') {
            depth++
        } else if (character === ')') {
            depth--
            if (depth === 0) {
                return i === sql.length - 1 ? sql.slice(start.length, sql.length - end.length) : undefined
            }
        } else if (character === ',' && depth === 1 && i !== sql.length - end.length) {
            // A comma of from_tz before the one of its zone: not the form of _instantOfUtc
            return undefined
        }
    }
    return undefined
}
