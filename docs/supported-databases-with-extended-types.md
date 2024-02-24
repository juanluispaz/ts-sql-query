# Supported databases with extended types

**DEPRECATED**: Use custom types instead.

You can use [ts-extended-types](https://www.npmjs.com/package/ts-extended-types) defineing it as custom columns:

```ts
import {int, stringInt, double, stringDouble, LocalDate, LocalTime, LocalDateTime, uuid } from 'ts-extended-types';
```

You can define the columns in this way:

```ts
this.column<int, 'int'>('ColumnName', 'customInt', 'int')
this.column<stringInt, 'stringInt'>('ColumnName', 'customInt', 'stringInt')
this.column<double, 'double'>('ColumnName', 'customDouble', 'double')
this.column<stringDouble, 'stringDouble'>('ColumnName', 'customDouble', 'stringDouble')
this.column<LocalDate, 'localDate'>('ColumnName', 'customLocalDate', 'localDate')
this.column<LocalTime, 'localTime'>('ColumnName', 'customLocalTime', 'localTime')
this.column<LocalDateTime, 'localDateTime'>('ColumnName', 'customLocalDateTime', 'localDateTime')
this.column<uuid, 'uuid'>('ColumnName', 'customUuid', 'uuid')
```

---

If you uses this variant, the types defined in [ts-extended-types](https://www.npmjs.com/package/ts-extended-types). It types allows to make your application even more type-safe and represents better the data handled by the database.

## MariaDB

**DEPRECATED**: Use custom types instead.

```ts
import { TypeSafeMariaDBConnection } from "ts-sql-query/connections/TypeSafeMariaDBConnection";

class DBConnection extends TypeSafeMariaDBConnection<'DBConnection'> { }
```

### Last inserted id strategies in MariaDB

MariaBD 10.5 added support to the returning clause when insert or delete. If you set this flag to true, the insert returning last inserted id will generate the returning clause instead of use the last inserted id provided by the connector after the execution of the query.

```ts
import { MariaDBConnection } from "ts-sql-query/connections/MariaDBConnection";

class DBConnection extends MariaDBConnection<'DBConnection'> { 
    protected alwaysUseReturningClauseWhenInsert = true
}
```

### UUID strategies in MariaDB

ts-sql-query offers you different strategies to handle UUIDs in MariaDB:

- `uuid`: *(default strategy)* In this case, the UUID is represented as string and stored in a column with `uuid` data type. This requires MariaDB 10.7 or higher.
- `string`: In this case, the UUID is represented as string and stored in a column with `char`/`varchar`/`text` data type and length 36 characters.

To change the UUID strategy, you must set the `uuidStrategy` field in the connection object:

```ts
import { TypeSafeMariaDBConnection } from "ts-sql-query/connections/TypeSafeMariaDBConnection";

class DBConnection extends TypeSafeMariaDBConnection<'DBConnection'> {
    protected uuidStrategy = 'string' as const
}
```

## MySql

**DEPRECATED**: Use custom types instead.

```ts
import { TypeSafeMySqlConnection } from "ts-sql-query/connections/TypeSafeMySqlConnection";

class DBConnection extends TypeSafeMySqlConnection<'DBConnection'> { }
```

### UUID strategies in MySql

ts-sql-query offers you different strategies to handle UUIDs in MySql:

- `binary`: *(default strategy)* In this case, the UUID is represented and stored as `binary` data type of lenght 16. This requires MySql 8 as minimum.
- `string`: In this case, the UUID is represented as string and stored in a column with `char`/`varchar`/`text` data type and length 36 characters.

To change the UUID strategy, you must set the `uuidStrategy` field in the connection object:

```ts
import { TypeSafeMySqlConnection } from "ts-sql-query/connections/TypeSafeMySqlConnection";

class DBConnection extends TypeSafeMySqlConnection<'DBConnection'> {
    protected uuidStrategy = 'string' as const
}
```

### Compatibility mode

The compatibility mode avoid to use with clasue to increase the compatibility with MySql 5.

By default the compatibility mode is disabled. To enable the compatibility mode you must set the `compatibilityMode` property of the connection to true.

```ts
import { TypeSafeMySqlConnection } from "ts-sql-query/connections/TypeSafeMySqlConnection";

class DBConnection extends TypeSafeMySqlConnection<'DBConnection'> {
    protected compatibilityMode = true
}
```

**Note**: When the compatibility mode is enabled recursive queries are not supported and you will get an error if you try to use them.

## Oracle

**DEPRECATED**: Use custom types instead.

```ts
import { TypeSafeOracleConnection } from "ts-sql-query/connections/TypeSafeOracleConnection";

class DBConnection extends TypeSafeOracleConnection<'DBConnection'> { }
```

**Note**: Oracle doesn't have boolean data type; ts-sql-query assumes that the boolean is represented by a number where `0` is false, and `1` is true. All conversions are made automatically by ts-sql-query. In case you need a different way to represent a boolean, see [Custom booleans values](advanced-usage.md#custom-booleans-values) for more information.

### UUID strategies in Oracle

ts-sql-query offers you different strategies to handle UUIDs in Sqlite:

- `custom-functions`: *(default strategy)* In this case, the UUID is represented and stored as `raw` data type of lenght 16. This requires you must define in the database the functions `uuid_to_raw` and `raw_to_uuid` that allows to transform the uuid string to a raw value.
- `string`: In this case, the UUID is represented as string and stored in a column with `char` data type and length 36 characters.

To change the UUID strategy, you must set the `uuidStrategy` field in the connection object:

```ts
import { TypeSafeOracleConnection } from "ts-sql-query/connections/TypeSafeOracleConnection";

class DBConnection extends TypeSafeOracleConnection<'DBConnection'> {
    protected uuidStrategy = 'string' as const
}
```

### UUID utility functions for Oracle

The `custom-functions` required `uuid_to_raw` and `raw_to_uuid` functions exists in the database.

An implemntation of these functions based on [binary-uuid](https://github.com/odo-network/binary-uuid) and optimized fo UUID v1 is:

```sql
CREATE FUNCTION uuid_to_raw(uuid IN char) RETURN raw IS
	hex_text nvarchar2(36);
BEGIN 
	hex_text := REPLACE(uuid, '-');
	RETURN HEXTORAW(SUBSTR (hex_text, 13, 4) || 
                    SUBSTR (hex_text, 9, 4) || 
                    SUBSTR (hex_text, 0, 8) || 
                    SUBSTR (hex_text, 17));
END uuid_to_raw;

CREATE FUNCTION raw_to_uuid(raw_uuid IN raw) RETURN char IS
	hex_text char(32);
BEGIN 
	hex_text := RAWTOHEX(raw_uuid);
    -- If you want the lower-case version wrap the expression in lower( ... )
    RETURN SUBSTR (hex_text, 9, 8) || '-' || 
           SUBSTR (hex_text, 5, 4) || '-' || 
           SUBSTR (hex_text, 0, 4) || '-' || 
           SUBSTR (hex_text, 17, 4) || '-' || 
           SUBSTR (hex_text, 21);
END raw_to_uuid;
```

The simplest implementation of these functions that doesn't reorder the bytes is:

```sql
CREATE FUNCTION uuid_to_raw(uuid IN char) RETURN raw AS
BEGIN 
    RETURN HEXTORAW(REPLACE(uuid, '-'));
END uuid_to_raw;

CREATE FUNCTION raw_to_uuid(raw_uuid IN raw) RETURN char IS
	hex_text char(32);
BEGIN 
	hex_text := RAWTOHEX(raw_uuid);
    -- If you want the lower-case version wrap the expression in lower( ... )
    RETURN SUBSTR (hex_text, 1, 8) || '-' || 
           SUBSTR (hex_text, 9, 4) || '-' || 
           SUBSTR (hex_text, 13, 4) || '-' || 
           SUBSTR (hex_text, 17, 4) || '-' || 
           SUBSTR (hex_text, 21);
END raw_to_uuid;
```

## PostgreSql

**DEPRECATED**: Use custom types instead.

```ts
import { TypeSafePostgreSqlConnection } from "ts-sql-query/connections/TypeSafePostgreSqlConnection";

class DBConnection extends TypeSafePostgreSqlConnection<'DBConnection'> { }
```

**Note**: Sometimes you can find yourself in situation where PostgreSql is not able to infer the type of the parameter in the query, for this you will need to tell the system to include a type cast in the generated query using the class `ForceTypeCast` provided in  `ts-sql-query/TypeAdapter` as type adapter. You can force to always include the type cast in the generated query implementing the method `transformPlaceholder`:

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { 
    protected transformPlaceholder(placeholder: string, type: string, _forceTypeCast: boolean, valueSentToDB: unknown): string {
        return super.transformPlaceholder(placeholder, type, true, valueSentToDB)
    }
}
```

You can add your custom type cast or override the default one in the implementation of `transformPlaceholder` methode like the one described in [Globally type adapter](column-types.md#globally-type-adapter); you can see the default type cast in the class [AbstractPostgreSqlConnection](https://github.com/juanluispaz/ts-sql-query/blob/master/src/connections/AbstractPostgreSqlConnection.ts).


## Sqlite

**DEPRECATED**: Use custom types instead.

```ts
import { TypeSafeSqliteConnection } from "ts-sql-query/connections/TypeSafeSqliteConnection";

class DBConnection extends TypeSafeSqliteConnection<'DBConnection'> { }
```

**Note**: If you use [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) to connect to the database you can run your queries synchronously. See [BetterSqlite3QueryRunner](query-runners/recommended-query-runners.md#better-sqlite3) and [Synchronous query runners](advanced-usage.md#synchronous-query-runners) for more information.

### Working with Date and Time in Sqlite

ts-sql-query offers you different strategies to handle date and time in the database compatible with [sqlite date and time functions](https://www.sqlite.org/lang_datefunc.html). To define the strategy to be used, you must overwrite the `getDateTimeFormat` function; this function receives as an argument the type of date to handle (`date`, `time`, `dateTime`) and returns the strategy to use for that specific case. In addition, there are three properties (`treatUnexpectedIntegerDateTimeAsJulian`, `treatUnexpectedStringDateTimeAsUTC`, and `unexpectedUnixDateTimeAreMilliseconds`) that allow controlling how to deal with the cases when the expected format is not the one stored in the database. Example:

```ts
import { TypeSafeMySqlConnection } from "ts-sql-query/connections/TypeSafeMySqlConnection";
import { SqliteDateTimeFormat, SqliteDateTimeFormatType } from "ts-sql-query/connections/SqliteConfiguration";

class DBConnection extends TypeSafeMySqlConnection<'DBConnection'> {
    protected getDateTimeFormat(type: SqliteDateTimeFormatType): SqliteDateTimeFormat {
        switch(type) {
            case 'date':
                return 'localdate as text'
            case 'time':
                return 'UTC as text'
            case 'dateTime':
                return 'Unix time seconds as integer'
        }
    }
    protected treatUnexpectedIntegerDateTimeAsJulian = false
    protected treatUnexpectedStringDateTimeAsUTC = true
}
```

### Date and type strategies

- `localdate as text`: *(default strategy)*
    - Dates and time are interpreted to be in the same timezone of the running application.
    - **Column type in sqlite**: *TEXT*
    - **Date format**: *YYYY-MM-DD*. Example: `2021-09-25`
    - **Time format**: *HH:MM:SS.SSS*. Example: `18:00:00`. In JavaScript always use *1970-01-01* as the date for the provided time.
    - **Date time format**: *YYYY-MM-DD HH:MM:SS.SSS*. Example: `2021-09-25 18:00:00`
    - **Limitation**: If you get the unix time in the database you will get the wrong value; the returned value will be like that date is in UTC timezone.
- `localdate as text using T separator`
    - Dates and time are interpreted to be in the same timezone of the running application.
    - **Column type in sqlite**: *TEXT*
    - **Date format**: *YYYY-MM-DD*. Example: `2021-09-25`
    - **Time format**: *HH:MM:SS.SSS*. Example: `18:00:00`. In JavaScript always use *1970-01-01* as the date for the provided time.
    - **Date time format**: *YYYY-MM-DD***T***HH:MM:SS.SSS*. Example: `2021-09-25T18:00:00`
    - **Limitation**: If you get the unix time in the database you will get the wrong value; the returned value will be like that date is in UTC timezone.
- `UTC as text`
    - Dates and time are interpreted to be in the UTC timezone.
    - **Column type in sqlite**: *TEXT*
    - **Date format**: *YYYY-MM-DD*. Example: `2021-09-25`
    - **Time format**: *HH:MM:SS.SSS*. Example: `18:00:00`. In JavaScript always use *1970-01-01* as the date for the provided time.
    - **Date time format**: *YYYY-MM-DD HH:MM:SS.SSS*. Example: `2021-09-25 18:00:00`
- `UTC as text using T separator`:
    - Dates and time are interpreted to be in the UTC timezone.
    - **Column type in sqlite**: *TEXT*
    - **Date format**: *YYYY-MM-DD*. Example: `2021-09-25`
    - **Time format**: *HH:MM:SS.SSS*. Example: `18:00:00`. In JavaScript always use *1970-01-01* as the date for the provided time.
    - **Date time format**: *YYYY-MM-DD***T***HH:MM:SS.SSS*. Example: `2021-09-25T18:00:00`
- `UTC as text using Z timezone`:
    - Dates and time are interpreted to be in the UTC timezone.
    - **Column type in sqlite**: *TEXT*
    - **Date format**: *YYYY-MM-DD*. Example: `2021-09-25`. No **Z** is used here because it is not supported by sqlite.
    - **Time format**: *HH:MM:SS.SSS***Z**. Example: `18:00:00Z`. In JavaScript always use *1970-01-01* as the date for the provided time.
    - **Date time format**: *YYYY-MM-DD HH:MM:SS.SSS***Z**. Example: `2021-09-25 18:00:00Z`
- `UTC as text using T separator and Z timezone`:
    - Dates and time are interpreted to be in the UTC timezone.
    - **Column type in sqlite**: *TEXT*
    - **Date format**: *YYYY-MM-DD*. Example: `2021-09-25`. No **Z** is used here because it is not supported by sqlite.
    - **Time format**: *HH:MM:SS.SSS***Z**. Example: `18:00:00Z`. In JavaScript always use *1970-01-01* as the date for the provided time.
    - **Date time format**: *YYYY-MM-DD***T***HH:MM:SS.SSS***Z**. Example: `2021-09-25T18:00:00Z`
- `Julian day as real number`:
    - Dates and time are expressed as [Julian day](https://en.wikipedia.org/wiki/Julian_day).
    - **Column type in sqlite**: *REAL*
    - **Date format**: *NNNNNNNNNN.5*. Example: `2459482.5` (*2021-09-25*).
    - **Time format**: *0.NNNNNNNNNN* or *-0.NNNNNNNNNN*. Example: `0.75` (*18:00:00*). This value is a number between -0.5 to 0.5 that express the time on the first day of the calendar (November 24, 4714 BC). In JavaScript always use *1970-01-01* as the date for the provided time.
    - **Date time format**: *NNNNNNNNNN.NNNNNNNNNN*. Example: `2459483.25` (*2021-09-25 18:00:00*)
- `Unix time seconds as integer`
    - Dates and time are expressed as the number of seconds from the beginning of the UNIX time (*1970-01-01*).
    - **Column type in sqlite**: *INTEGER*
    - **Date format**: *NNNNNNNNNN*. Example: `1632528000` (*2021-09-25*).
    - **Time format**: *NNNNNNNNNN*. Example: `64800` (*18:00:00*). This value is a number that expresses the number of seconds for the provided time on the first day of the calendar (*1970-01-01*). In JavaScript always use *1970-01-01* as the date for the provided time.
    - **Date time format**: *NNNNNNNNNN*. Example: `1632592800` (*2021-09-25 18:00:00*)
- `Unix time milliseconds as integer`
    - Dates and time are expressed as the number of milliseconds from the beginning of the UNIX time (*1970-01-01*).
    - **Column type in sqlite**: *INTEGER*
    - **Date format**: *NNNNNNNNNNNNN*. Example: `1632528000000` (*2021-09-25*).
    - **Time format**: *NNNNNNNNNNNNN*. Example: `64800000` (*18:00:00*). This value is a number that expresses the number of milliseconds for the provided time on the first day of the calendar (*1970-01-01*). In JavaScript always use *1970-01-01* as the date for the provided time.
    - **Date time format**: *NNNNNNNNNNNNN*. Example: `1632592800000` (*2021-09-25 18:00:00*)

### Dealing with different date and time formats coming from the database

When a value is returned from the database that is different from the defined strategy, ts-sql-query tries to parse the value to respect the format returned from the database and respect the semantic of the expected datatype. You can configure the way how to interpret the value when the default behaviour doesn't match with the situation in the database using the following properties:

- `treatUnexpectedIntegerDateTimeAsJulian`: (default *false*)
    - When a string representation is expected, but a numeric value is received, if the value is an integer, it is treated as UNIX time; if it has decimals, it is treated as Julian day. 
    - The problem with this approach is any Jualian date set at noon is an integer value in JavaScript; then, the value is misunderstood. 
    - However, you can force to ignore the UNIX time and always consider the value as Julian day if you set this property to *true*. 
- `treatUnexpectedStringDateTimeAsUTC`: (default *false*)
    - When a numeric representation is expected (UNIX time or Julian day), but a string representation is received. 
    - If that string representation doesn't have a defined timezone, the value is treated as local date-time (the time zone is the same as the running application). 
    - If you set this property to *true*, you force to treat this case as UTC time.
- `unexpectedUnixDateTimeAreMilliseconds`: (default *false*)
    - When a string representation is expected, but a numeric value is received, if the value is an integer, it is treated as UNIX time (if you didn't change the default behaviour); if it has decimals, it is treated as Julian day. 
    - By default, this unexpected UNIX time is understood as the number of seconds from the beginning of the UNIX time (*1970-01-01*).
    - If you set this property to *true*, you force to treat this UNIX time as the number of milliseconds from the beginning of the UNIX time (*1970-01-01*).

### UUID strategies in Sqlite

ts-sql-query offers you different strategies to handle UUIDs in Sqlite:

- `uuid-extension`: *(default strategy)* In this case, the UUID is represented and stored as `blob` data type of lenght 16. This requires the [uuid extension](https://sqlite.org/src/file?name=ext/misc/uuid.c) or any other compatible implementation (if you use better-sqlite3 you can [provide your own one](query-runners/recommended-query-runners.md#better-sqlite3-and-uuids))
- `string`: In this case, the UUID is represented as string and stored in a column with `text` data type and length 36 characters.

To change the UUID strategy, you must set the `uuidStrategy` field in the connection object:

```ts
import { TypeSafeSqliteConnection } from "ts-sql-query/connections/TypeSafeSqliteConnection";

class DBConnection extends TypeSafeSqliteConnection<'DBConnection'> {
    protected uuidStrategy = 'string' as const
}
```

### Compatibility mode

The compatibility mode avoid to use the newer syntax introduces in the newer versions of sqlite

The newer syntax are:

- **Sqlite 3.30.0** (*2019-10-04*): Add support for the `NULLS FIRST` and `NULLS LAST` syntax in `ORDER BY` clauses. In the copatibility mode their are emulated.
- **Sqlite 3.35.0** (*2021-03-12*): Add support for the `RETURNING` clause on `DELETE`, `INSERT`, and `UPDATE` statements. In the compatibility mode `last_insert_id()` is used to get the last inserted id. When the compatibility mode is disabled the `RETURNING` clause on the insert statement is used.

By default the compatibility mode is enabled. To disable the compatibility mode you must set the `compatibilityMode` property of the connection to false.

```ts
import { TypeSafeSqliteConnection } from "ts-sql-query/connections/TypeSafeSqliteConnection";

class DBConnection extends TypeSafeSqliteConnection<'DBConnection'> {
    protected compatibilityMode = false
}
```

## SqlServer

**DEPRECATED**: Use custom types instead.

```ts
import { TypeSafeSqlServerConnection } from "ts-sql-query/connections/TypeSafeSqlServerConnection";

class DBConnection extends TypeSafeSqlServerConnection<'DBConnection'> { }
```

**Note**: An empty string will be treated as a null value; if you need to allow empty string set the `allowEmptyString` property to true in the connection object.

**Note**: Sql Server doesn't have boolean data type; ts-sql-query assumes that the boolean is represented by a bit where `0` is false, and `1` is true. All conversions are made automatically by ts-sql-query. In case you need a different way to represent a boolean, see [Custom booleans values](advanced-usage.md#custom-booleans-values) for more information.

### UUID in SqlServer

Is SqlServer UUID are stored in a column of type `uniqueidentifier` that keeps the UUIDs in upper-case, if you whant to transform to lower-case during the projection you can do the following:

```ts
import { TypeSafeSqlServerConnection } from "ts-sql-query/connections/TypeSafeSqlServerConnection";

class DBConnection extends TypeSafeSqlServerConnection<'DBConnection'> {
    protected transformValueFromDB(value: unknown, type: string): unknown {
        const result = super.transformValueFromDB(value, type);
        if (result && type === 'uuid') {
            return (result as string).toLowerCase();
        }
        return result;
    }
}
```

**Note**: If you use Prisma, this is done automatically.