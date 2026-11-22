import type { SqlDataType } from '../TypeAdapter.js'

// The types in the database of the dates and times without a zone, shared by the data types with a Date and the ones of
// Temporal, which are kept in the same columns. In a module of their own, which imports no data type: the modules of
// those data types import each other

/** The type in the database of a date without a time and without a zone */
export const localDateSqlDataType: SqlDataType = { family: 'datetime', fields: 'date' }
/** The type in the database of a time of the day without a date and without a zone */
export const localTimeSqlDataType: SqlDataType = { family: 'datetime', fields: 'time' }
/** The type in the database of a date and a time of the day without a zone */
export const localDateTimeSqlDataType: SqlDataType = { family: 'datetime', fields: 'timestamp' }
