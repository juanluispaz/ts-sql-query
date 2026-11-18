---
search:
  boost: 0.3
---
# SQL data types API

This page documents the types and the functions of the SQL data type of a column: the type of the column in the database, its family and what refines it. To learn what it's for, how to declare it and what each database does with it, see [The type of a column in the database](../advanced/data-types/sql-data-types.md).

!!! info

    `withSqlDataType`, `NoExecutionQueryRunner`, `SqlDataType` and the type of each family are exported from `ts-sql-query`. `sqlDataTypeFrom` and `nativeSqlDataTypeOf` are methods of the connection of each database.

## Giving it to a type adapter

```typescript
function withSqlDataType(sqlDataType: SqlDataType): TypeAdapter & { readonly sqlDataType: SqlDataType }
function withSqlDataType<ADAPTER extends TypeAdapter>(sqlDataType: SqlDataType, adapter: ADAPTER): ADAPTER & { readonly sqlDataType: SqlDataType }
// withSqlDataType's implementation ...

interface TypeAdapter {
    /** The type of the value in the database */
    readonly sqlDataType?: SqlDataType | undefined
    // ... the transformations (see the Type adapters API)
}
```

- Without an adapter, `withSqlDataType` returns a new one that only says the type: every conversion is the library's.
- With an adapter, it sets `sqlDataType` on that instance and returns it, with its class. An adapter that already says another type is rejected with a `TsSqlProcessingError` of reason `INVALID_CONFIGURATION` (`name` `'sqlDataType'`): give each column a new instance.

## The types of the database of a connection

Every connection (`PostgreSqlConnection`, `MySqlConnection`, `MariaDBConnection`, `SqlServerConnection`, `OracleConnection`, `SqliteConnection`) has:

```typescript
interface ConnectionOfADatabase {
    /** The SQL data type of a type of this database, as its catalogue writes it, aliases accepted; native keeps the name */
    sqlDataTypeFrom(nativeName: string): SqlDataType
    /** The type of this database for a SQL data type, as this connection stores it; undefined when it can't hold it */
    nativeSqlDataTypeOf(sqlDataType: SqlDataType): string | undefined
}
```

- `sqlDataTypeFrom` reads the name as the catalogue of the database writes it: PostgreSQL `format_type`, the `COLUMN_TYPE` of MySQL and MariaDB, the declaration on SQL Server and Oracle, the declared type on SQLite. A name it doesn't know gives `{ family: 'user-defined', name }`.
- `nativeSqlDataTypeOf` gives the name in `native` for this database when there is one; otherwise a name from the family and its properties, for the `compatibilityVersion` of the connection and where it stores what the database lacks (`uuidStrategy`, Oracle's `booleanStorage`, the date formats of SQLite); `undefined` when the database can't hold it.
- `nativeSqlDataTypeOf` builds the name once for each SQL data type and class of connection, and keeps it in the SQL data type, hidden (a copy, `JSON.stringify` and a comparison don't see it): the version and the strategies are the ones the class of the connection sets, so set them in the class, not on each instance. Don't change a SQL data type after it's used.
- To change them, override `sqlDataTypeFrom` (like to read a name of your own on SQLite), or `buildNativeSqlDataTypeOf(sqlDataType)`, a protected method that builds what `nativeSqlDataTypeOf` gives, called once for each SQL data type and class.

A connection only to use them takes a `NoExecutionQueryRunner`, which rejects every query with `QUERY_NOT_ALLOWED`:

```typescript
/** A NoopQueryRunner whose queries are rejected; the connection tells it its database */
class NoExecutionQueryRunner {
    constructor()
    // NoExecutionQueryRunner's constructor implementation ...
}
```

## The SQL data type

```typescript
type SqlDataType = ExactNumericSqlDataType | ApproximateNumericSqlDataType | BooleanSqlDataType
    | CharacterStringSqlDataType | BinaryStringSqlDataType | DatetimeSqlDataType | IntervalSqlDataType | UuidSqlDataType
    | DocumentSqlDataType | SpatialSqlDataType | NetworkAddressSqlDataType | BitStringSqlDataType
    | EnumerationSqlDataType | CollectionSqlDataType | VectorSqlDataType | MoneySqlDataType | TextSearchSqlDataType
    | RowLocatorSqlDataType | RowVersionSqlDataType | VariantSqlDataType | HierarchySqlDataType | SystemSqlDataType
    | StructuredSqlDataType | UserDefinedSqlDataType

/** The name of the type in each database, as it is written there */
type SqlDataTypeNative = { readonly [database in DatabaseType]?: string | undefined }

/** What every family can say */
interface SqlDataTypeCommon {
    /** The name of the type in each database: a database uses its own; one without it works from the family */
    readonly native?: SqlDataTypeNative | undefined
    /** The name of the domain the type is defined by; the family is the type the domain is over */
    readonly domain?: string | undefined
}
```

The class of each data type has its own in its static `sqlDataType` (`IntType.sqlDataType`), the one of a value without the SQL data type of a column: see [The SQL data type of a data type](../advanced/data-types/sql-data-types.md#the-sql-data-type-of-a-data-type).

## The families

```typescript
interface ExactNumericSqlDataType extends SqlDataTypeCommon {
    readonly family: 'exact numeric'
    readonly precision?: number | undefined
    readonly scale?: number | undefined
    readonly unsigned?: boolean | undefined
    /** The bytes of an integer: 1 (tinyint), 2 (smallint), 3 (mediumint), 4 (integer), 8 (bigint) */
    readonly bytes?: 1 | 2 | 3 | 4 | 8 | undefined
}
interface ApproximateNumericSqlDataType extends SqlDataTypeCommon {
    readonly family: 'approximate numeric'
    /** In binary digits: 24 single, 53 double */
    readonly precision?: number | undefined
}
interface BooleanSqlDataType extends SqlDataTypeCommon {
    readonly family: 'boolean'
}
interface CharacterStringSqlDataType extends SqlDataTypeCommon {
    readonly family: 'character string'
    /** Undefined: without a limit or the maximum of the database */
    readonly length?: number | undefined
    readonly lengthUnit?: 'characters' | 'octets' | undefined
    readonly fixed?: boolean | undefined
    /** A national character type (SQL Server nvarchar, Oracle NVARCHAR2); undefined is not stated */
    readonly national?: boolean | undefined
    readonly largeObject?: boolean | undefined
    readonly characterSet?: string | undefined
    readonly collation?: string | undefined
}
interface BinaryStringSqlDataType extends SqlDataTypeCommon {
    readonly family: 'binary string'
    readonly length?: number | undefined
    readonly fixed?: boolean | undefined
    readonly largeObject?: boolean | undefined
    /** A file outside the database (Oracle BFILE) */
    readonly external?: boolean | undefined
}
interface DatetimeSqlDataType extends SqlDataTypeCommon {
    readonly family: 'datetime'
    readonly fields: 'date' | 'time' | 'timestamp' | 'year'
    /** The digits of the fraction of the seconds */
    readonly precision?: number | undefined
    /** 'none' a wall clock; 'session' converted with the zone of the session; 'instant' one instant; 'kept' each value with its zone */
    readonly timeZone?: 'none' | 'session' | 'instant' | 'kept' | undefined
}
/** The fields of an interval, as the SQL standard names them */
type IntervalSqlDataTypeFields = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'year to month'
    | 'day to hour' | 'day to minute' | 'day to second' | 'hour to minute' | 'hour to second' | 'minute to second'

interface IntervalSqlDataType extends SqlDataTypeCommon {
    readonly family: 'interval'
    /** Undefined: every field (PostgreSQL interval) */
    readonly fields?: IntervalSqlDataTypeFields | undefined
    readonly precision?: number | undefined
}
interface UuidSqlDataType extends SqlDataTypeCommon {
    readonly family: 'uuid'
}
interface DocumentSqlDataType extends SqlDataTypeCommon {
    readonly family: 'document'
    readonly format: 'json' | 'jsonb' | 'xml' | 'jsonpath'
}
interface SpatialSqlDataType extends SqlDataTypeCommon {
    readonly family: 'spatial'
    readonly model: 'geometry' | 'geography' | 'planar' | 'raster'
    readonly subtype?: string | undefined
    readonly srid?: number | undefined
}
interface NetworkAddressSqlDataType extends SqlDataTypeCommon {
    readonly family: 'network address'
    readonly kind: 'inet' | 'cidr' | 'macaddr' | 'macaddr8'
    readonly ipFamily?: 4 | 6 | undefined
}
interface BitStringSqlDataType extends SqlDataTypeCommon {
    readonly family: 'bit string'
    readonly length?: number | undefined
    readonly fixed?: boolean | undefined
}
interface EnumerationSqlDataType extends SqlDataTypeCommon {
    readonly family: 'enumeration'
    readonly values?: readonly string[] | undefined
    readonly name?: string | undefined
    /** Several values at once (MySQL and MariaDB SET) */
    readonly multiple?: boolean | undefined
}
interface CollectionSqlDataType extends SqlDataTypeCommon {
    readonly family: 'collection'
    readonly kind: 'array' | 'multiset' | 'range' | 'multirange' | 'map'
    readonly of?: SqlDataType | undefined
    readonly cardinality?: number | undefined
}
interface VectorSqlDataType extends SqlDataTypeCommon {
    readonly family: 'vector'
    readonly dimensions?: number | undefined
    readonly element?: 'float32' | 'float16' | 'float64' | 'int8' | 'binary' | undefined
    readonly storage?: 'dense' | 'sparse' | undefined
}
interface MoneySqlDataType extends SqlDataTypeCommon {
    readonly family: 'money'
    readonly scale?: number | undefined
}
interface TextSearchSqlDataType extends SqlDataTypeCommon {
    readonly family: 'text search'
    readonly kind: 'document' | 'query'
}
interface RowLocatorSqlDataType extends SqlDataTypeCommon {
    readonly family: 'row locator'
    readonly kind: 'physical' | 'universal'
}
interface RowVersionSqlDataType extends SqlDataTypeCommon {
    readonly family: 'row version'
}
interface VariantSqlDataType extends SqlDataTypeCommon {
    readonly family: 'variant'
}
interface HierarchySqlDataType extends SqlDataTypeCommon {
    readonly family: 'hierarchy'
}
interface SystemSqlDataType extends SqlDataTypeCommon {
    readonly family: 'system'
    readonly kind: 'oid' | 'xid' | 'xid8' | 'cid' | 'pg_lsn' | 'pg_snapshot' | 'txid_snapshot'
}
interface StructuredSqlDataType extends SqlDataTypeCommon {
    readonly family: 'structured'
    readonly name: string
    readonly reference?: boolean | undefined
}
interface UserDefinedSqlDataType extends SqlDataTypeCommon {
    readonly family: 'user-defined'
    readonly name: string
}
```

## In the context of a type adapter

As the type of a value, the SQL data type is two in the context of each transformation:

```typescript
interface TypeAdapterContext {
    // ... the original and the requested type (see the Type adapters API)
    /** The one the type adapter says (withSqlDataType); it never changes */
    readonly originalSqlDataType: SqlDataType | undefined
    /** The one requested for the value; by default the original one */
    readonly requestedSqlDataType: SqlDataType | undefined
}

/** In the context of transformValueToDB, transformProjection and transformValueFromDB */
interface TypeAdapterRequestedSqlDataType {
    /** The query runner receives it with the parameter (transformValueToDB) or the column of the result (transformProjection) */
    setRequestedSqlDataType(sqlDataType: SqlDataType | undefined): void
    /** Requests the original one again */
    resetRequestedSqlDataType(): void
}
```

## In the context of a query

A query runner of yours reads it with [`getQueryContext`](../advanced/running-queries/query-execution-metadata.md): `originalSqlDataType` and `requestedSqlDataType` of each parameter (`QueryParamContext`) and of each column of the result (`QueryResultColumn`), when its type adapter says one; the one of its data type is `requestedType.sqlDataType` (see [The SQL data type of a data type](../advanced/data-types/sql-data-types.md#the-sql-data-type-of-a-data-type)). The query runners of the library use the requested one. The configuration of the connection in that context, `connectionConfiguration`, has `sqlDataTypeFrom` and `nativeSqlDataTypeOf` of the connection, so a query runner or a type adapter (`context.connectionConfiguration`) can turn a SQL data type into the name of the type in the database of the query, built once.
