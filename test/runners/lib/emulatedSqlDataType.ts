// A column of a type the database emulates (a uuid kept as char(36), a boolean as NUMBER(1), a date as TEXT), with the
// SQL data type its database gives it (sqlDataTypeFrom of the name in the catalogue) and without it: the SQL data type
// of a column that doesn't describe its data type is how the database keeps it, and changes nothing of the query.

/** What a flow of queries wrote and what it read */
export interface FlowResult {
    readonly queries: readonly (readonly [string, readonly unknown[]])[]
    readonly rows: unknown
}

/** A query of the library, as it is written: its SQL and a copy of its params */
export function shown(query: { query(): string, params(): any[] }): readonly [string, readonly unknown[]] {
    return [query.query(), [...query.params()]]
}
