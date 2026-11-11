// ts-sql-query/oracle: what is specific to Oracle: its connection, and the type adapter of a date and time kept in a DATE

export {
    OracleConnection,
} from '../../connections/OracleConnection.js'

export {
    OracleDateAsTimestampTypeAdapter,
} from '../../TypeAdapter.js'
