export type SqliteDateTimeFormat = 'localdate seconds as text' | 'localdate milliseconds as text'
    | 'localdate seconds as text using T separator' | 'localdate milliseconds as text using T separator'
    | 'UTC seconds as text' | 'UTC milliseconds as text'
    | 'UTC seconds as text using T separator' | 'UTC milliseconds as text using T separator'
    | 'UTC seconds as text using Z timezone' | 'UTC milliseconds as text using Z timezone'
    | 'UTC seconds as text using T separator and Z timezone' | 'UTC milliseconds as text using T separator and Z timezone'
    | 'Julian day as real number' | 'Unix time seconds as integer' | 'Unix time milliseconds as integer'

export type SqliteDateTimeFormatType = 'date' | 'time' | 'dateTime'

/** How a customDecimal is stored, computed, compared and ordered on SQLite (`decimalStrategy` of `SqliteConnection`) */
export type SqliteDecimalStrategy = 'text' | 'canonical text'
    | 'decimal-functions' | 'decimal-functions with canonical text'
    | 'decimal-extension and tsq-functions' | 'decimal-extension and tsq-functions with canonical text'

/** The options of registerSqliteFunctions, the function of each SQLite query runner that registers the SQL functions of the library */
export interface SqliteFunctionsOptions {
    /**
     * The names of the functions not to register. A function the database already has with the same name and number of
     * arguments (a loaded extension, or one you registered) is never replaced anyway; skip is for one you will register
     * after the call, or don't want.
     */
    readonly skip?: readonly string[] | undefined
}
