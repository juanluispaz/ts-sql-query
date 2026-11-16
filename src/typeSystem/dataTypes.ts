import type { DataTypeClass, SqlDataType } from '../TypeAdapter.js'

/** The type name of the data type of a value source, for the messages of the errors */
export function __valueSourceTypeNameOf(valueSource: object): string {
    return (valueSource.constructor as unknown as DataTypeClass).type
}

// Questions about what a value is, asked with the SQL data type of the class of its data type: the SQL builders, the
// query runners and the connections decide by them, never by knowing the class.

/**
 * The SQL data type a data type gives its values: the `sqlDataType` of its class; undefined for one whose values only
 * the user knows (an enum, a custom one)
 */
export function __typeSqlDataTypeOf(typeClass: DataTypeClass | undefined): SqlDataType | undefined {
    return typeClass?.sqlDataType
}

/**
 * Whether a SQL data type declared for a value (the one of its column, or one requested for it) describes a value of
 * that requested type, comparing it with the SQL data type of the type: the same family, for a boolean, a uuid, a date,
 * a time and a timestamp (by its fields); any number or a money, for a number; any family but a number, a boolean, a
 * date or a time, and a binary, for a text; any, for a type without one (an enum, a custom one). One that doesn't is
 * how the database keeps a value it emulates (the char(36) of a uuid, the NUMBER(1) of a boolean), or the one of a
 * value sent as another type: it says nothing of the value sent
 */
export function __sqlDataTypeDescribes(declared: SqlDataType, requestedType: DataTypeClass | undefined): boolean {
    const ofType = requestedType?.sqlDataType
    if (ofType === undefined) {
        return true
    }
    const family = declared.family
    switch (ofType.family) {
        case 'exact numeric':
        case 'approximate numeric':
            return family === 'exact numeric' || family === 'approximate numeric' || family === 'money'
        case 'character string':
            return family !== 'boolean' && family !== 'exact numeric' && family !== 'approximate numeric' && family !== 'datetime' && family !== 'binary string'
        case 'datetime':
            return family === 'datetime' && declared.fields === ofType.fields
        default:
            return family === ofType.family
    }
}

/**
 * The fields of the date or time of a data type, by the SQL data type of its class: `'date'` for a localDate,
 * `'time'` for a localTime, `'timestamp'` for a localDateTime; undefined for any other
 */
export function __temporalFieldsOf(typeClass: DataTypeClass | undefined): 'date' | 'time' | 'timestamp' | undefined {
    const sqlDataType = typeClass?.sqlDataType
    if (sqlDataType === undefined || sqlDataType.family !== 'datetime' || sqlDataType.fields === 'year') {
        return undefined
    }
    return sqlDataType.fields
}

/** The family of the SQL data type of a data type (its class); undefined for one without it (an enum, a custom one) */
export function __sqlFamilyOf(typeClass: DataTypeClass | undefined): SqlDataType['family'] | undefined {
    return typeClass?.sqlDataType?.family
}

/**
 * Whether a data type is an exact number that isn't an integer of a fixed size, by its SQL data type: a decimal, or an
 * integer of more digits than a bigint. Its value is kept as text where a number of JavaScript would lose digits
 */
export function __isExactDecimalSql(typeClass: DataTypeClass | undefined): boolean {
    const sqlDataType = typeClass?.sqlDataType
    return sqlDataType?.family === 'exact numeric' && !(sqlDataType.scale === 0 && sqlDataType.bytes !== undefined)
}

/** Whether a data type is an integer, by its SQL data type: an exact number without decimals */
export function __isIntegerSql(typeClass: DataTypeClass | undefined): boolean {
    const sqlDataType = typeClass?.sqlDataType
    return sqlDataType?.family === 'exact numeric' && sqlDataType.scale === 0
}

/** Whether a data type is a JSON document, by its SQL data type: an aggregated array */
export function __isJsonDocumentSql(typeClass: DataTypeClass | undefined): boolean {
    const sqlDataType = typeClass?.sqlDataType
    return sqlDataType?.family === 'document' && sqlDataType.format === 'json'
}
