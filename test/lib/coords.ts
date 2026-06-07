// Matrix coordinates — db[/version[/connector[/file]]] with glob `*` and brace
// `{a,b}`. Shared by the searcher (`tests:where-is --coord`) and the audit
// (`tests:audit` positional coords). See test/CLI.md § Coord patterns.

// One coord segment → a regex: `*` is any run, `{a,b}` an alternation, everything else literal.
function coordSegmentRegex(seg: string): RegExp {
    let re = '^'
    for (let i = 0; i < seg.length;) {
        const ch = seg[i]!
        if (ch === '*') { re += '.*'; i++ }
        else if (ch === '{') {
            const end = seg.indexOf('}', i)
            if (end < 0) { re += '\\{'; i++ }
            else {
                const opts = seg.slice(i + 1, end).split(',').map(s => s.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                re += '(' + opts.join('|') + ')'; i = end + 1
            }
        } else { re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); i++ }
    }
    return new RegExp(re + '$')
}
// A coord addresses a matrix cell, optionally down to a test FILE (4 levels:
// db/version/connector/file). Every PRESENT segment must match its field (missing trailing
// segments = wildcard); the file segment matches the file's BASENAME. The 4th level coexists with
// --file-name-pattern: the coord file segment is glob/brace on the basename (part of the
// coordinate), --file-name-pattern is a regex over the full path (and doc pages); both AND.
// Dimensions without a file (examples occurrences, the gaps connector list) carry no basename, so
// a 4th-level coord naturally narrows to the test rows.
export interface CellLike { db: string, version: string, connector: string, file?: string }
export function coordMatch(cell: CellLike, pattern: string): boolean {
    const segs = pattern.split('/')
    const fields = [cell.db, cell.version, cell.connector, (cell.file ?? '').split('/').pop() ?? '']
    for (let i = 0; i < segs.length && i < 4; i++) {
        if (!coordSegmentRegex(segs[i]!).test(fields[i]!)) return false
    }
    return true
}
// Full-cell match (tests + emitted-sql test rows): every present segment must match.
export function coordMatchAny(cell: CellLike, patterns: string[]): boolean {
    return patterns.length === 0 || patterns.some(p => coordMatch(cell, p))
}
// DB-only match (examples, docs, neg-type, shown-in-simplified-def, emitted-sql doc rows): only
// the coord's db SEGMENT is honoured (best-effort — those dimensions have no version/connector).
// db-agnostic `general` always matches (it applies to every database).
export function coordDbMatchAny(rowDb: string, patterns: string[]): boolean {
    if (patterns.length === 0 || rowDb === 'general') return true
    return patterns.some(p => coordDbMatches(rowDb, p))
}
// Whether a single coord's DB segment matches a database (for per-coord validation).
export function coordDbMatches(rowDb: string, pattern: string): boolean {
    return coordSegmentRegex(pattern.split('/')[0]!).test(rowDb)
}
// Derive the matrix cell of a `test/db/<db>/<version>/<connector>/…/<file>` path (for coord-scoped
// caveat surfacing). Returns null for paths outside the cell layout (e.g. test/lib/…), which the
// coord filter then drops.
export function cellFromPath(file: string): CellLike | null {
    const p = file.split('/')
    if (p[0] !== 'test' || p[1] !== 'db' || p.length < 5) return null
    return { db: p[2]!, version: p[3]!, connector: p[4]!, file: p[p.length - 1]! }
}
