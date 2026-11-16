import type { SqlDataType } from '../TypeAdapter.js'

/*
 * The types in the database of the numbers, apart from their classes: the bases of the numbers (numeric.ts) give them
 * to the data types of the user, and the classes of the built-in ones import those bases.
 */

/** The type in the database of an int: an integer of 4 bytes */
export const intSqlDataType: SqlDataType = { family: 'exact numeric', scale: 0, bytes: 4 }

/** The type in the database of a bigint: an integer of 8 bytes */
export const bigintSqlDataType: SqlDataType = { family: 'exact numeric', scale: 0, bytes: 8 }

/** The type in the database of a double: a floating point number of double precision */
export const doubleSqlDataType: SqlDataType = { family: 'approximate numeric', precision: 53 }

/** The type in the database of an exact decimal: a number with every digit, of any precision and scale */
export const decimalSqlDataType: SqlDataType = { family: 'exact numeric' }
