/**
 * Whether the SQL macros of the library are in the database: with libraryFunctions installed, from Oracle 23.4 (its
 * compatibilityVersion), which expands a scalar SQL macro where the query uses it, so the SQL that a Temporal value reaches the
 * driver with is written once in the macro and costs what the expression it expands to costs
 */
export function oracleSqlMacrosInstalled(libraryFunctions: string | undefined, compatibilityVersion: number | undefined): boolean {
    // Oracle 21 has scalar SQL macros, but fails with ORA-07445 (qksptfSubExprContainScalar) expanding one whose argument
    // has a scalar subquery
    return libraryFunctions === 'installed' && (compatibilityVersion ?? Number.POSITIVE_INFINITY) >= 23_004_000
}
