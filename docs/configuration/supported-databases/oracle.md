---
search:
  boost: 0.59
---
# Oracle

This page describes how `ts-sql-query` integrates with **[Oracle](https://www.oracle.com/database/)**, including dialect-specific behavior, configuration options, and available features. It covers the proper setup of a Oracle connection, guidelines for connection management, and advanced behaviors such as UUID handling.

!!! info

    To configure the database dialect, extend the appropriate database connection class when defining your connection. You must choose the correct database type to ensure that the generated SQL queries follow the dialect expected by that database.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Usage Example

```ts
import { OracleConnection } from "ts-sql-query/connections/OracleConnection";

class DBConnection extends OracleConnection<'DBConnection'> { }
```

!!! tip

    Oracle doesn't have boolean data type; `ts-sql-query` assumes that the boolean is represented by a number where `0` is false, and `1` is true. All conversions are made automatically by `ts-sql-query`. In case you need a different way to represent a boolean, see [Custom booleans values](../../advanced/custom-booleans-values.md) for more information.

## UUID strategies

`ts-sql-query` provides different strategies to handle UUID values in Oracle. These strategies control how UUID values are represented in JavaScript and stored in the database.

- `'uuid'` *(default strategy)*: UUIDs are treated as strings and stored using the native `RAW(16)` column type. This requires that the database includes the functions `uuid_to_raw` and `raw_to_uuid`, which handle the conversion between UUID strings and RAW values.
- `'string'`: UUIDs are treated as strings and stored in character-based columns such as `CHAR(36)`, `VARCHAR(36)`, or `TEXT`.

You can configure the strategy by overriding the `uuidStrategy` field in your connection class:

```ts
import { OracleConnection } from "ts-sql-query/connections/OracleConnection";

class DBConnection extends OracleConnection<'DBConnection'> {
    protected uuidStrategy = 'string' as const
}
```

## UUID utility functions for Oracle

The `custom-functions` required `uuid_to_raw` and `raw_to_uuid` functions exists in the database.

An implementation of these functions based on [binary-uuid](https://github.com/odo-network/binary-uuid) and optimized for UUID v1 is:

```oracle
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

```oracle
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
