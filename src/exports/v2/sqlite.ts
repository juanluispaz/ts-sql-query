// ts-sql-query/sqlite: what is specific to SQLite: its connection, and its configuration of dates, times and decimals

export {
    SqliteConnection,
} from '../../connections/SqliteConnection.js'

export {
    type SqliteDateTimeFormat,
    type SqliteDateTimeFormatType,
    type SqliteDecimalStrategy,
    type SqliteFunctionsOptions,
} from '../../connections/SqliteConfiguration.js'
