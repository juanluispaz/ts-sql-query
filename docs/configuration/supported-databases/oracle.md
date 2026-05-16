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

## Compatibility version

The `compatibilityVersion` property declares the minimum Oracle Database version the generated SQL must support, encoded as the integer `major * 1_000_000 + minor * 1_000 + patch` — e.g. `23_009_000` for Oracle Database 23.9. The default is `Number.POSITIVE_INFINITY` (latest).

Recognized breakpoints:

- `compatibilityVersion >= 23_004_000` (Oracle Database 23ai): the [`Values`](../mapping.md#mapping-constant-values-as-view) feature emits the SQL-standard `WITH name(cols) AS (VALUES (…), …)` table constructor introduced in 23ai. On earlier Oracle versions ts-sql-query emulates it as `WITH name(cols) AS (SELECT … FROM dual UNION ALL SELECT … FROM dual)` so the feature still works.

On older Oracle versions, set `compatibilityVersion` to your actual version so the right emulation is chosen automatically. It is recommended to keep this value in sync with your real database version so future ts-sql-query releases that gate additional features on it pick the right behavior automatically.

```ts
import { OracleConnection } from "ts-sql-query/connections/OracleConnection";

class DBConnection extends OracleConnection<'DBConnection'> {
    protected override compatibilityVersion = 23_009_000
}
```

!!! info "Minimum Oracle version for `stringConcatDistinct`"

    Independent of `compatibilityVersion`, `stringConcatDistinct` emits `LISTAGG(DISTINCT …)`, which requires Oracle Database 19c or later (the `DISTINCT` keyword inside `LISTAGG` was added in 19c). Targeting an older Oracle release means avoiding this aggregate.

## UUID strategies

`ts-sql-query` provides different strategies to handle UUID values in Oracle. These strategies control how UUID values are represented in JavaScript and stored in the database. In every case, UUIDs are exchanged as `string` at the JavaScript layer.

- `'built-in'` *(default strategy)*: UUIDs are stored as `RAW(16)` and converted using Oracle's built-in `UUID_TO_RAW` / `RAW_TO_UUID` functions, available since **Oracle Database 23ai (23.9)**. The built-ins preserve canonical byte order, so UUID v7 sorts chronologically in the primary-key index.
- `'custom-functions'`: same `RAW(16)` storage, but `ts-sql-query` calls user-provided functions named `uuid_to_raw` and `raw_to_uuid` instead. Use this option on Oracle versions older than 23.9 (where the built-ins don't exist) or when you want to inject your own conversion logic — for example, the v1-style byte reordering shown below. Oracle resolves identifiers case-insensitively, so the names match the built-ins on 23.9+ and your functions take precedence over them if both exist.
- `'string'`: UUIDs are stored as text in character-based columns such as `CHAR(36)`, `VARCHAR(36)`, or `TEXT`. No conversion functions are involved.

You can configure the strategy by overriding the `uuidStrategy` field in your connection class:

```ts
import { OracleConnection } from "ts-sql-query/connections/OracleConnection";

class DBConnection extends OracleConnection<'DBConnection'> {
    protected override uuidStrategy = 'string' as const
}
```

!!! tip "Generating UUIDs"

    Prefer **UUID v7** over UUID v4. The `'built-in'` strategy on Oracle 23ai (23.9)+ stores them as `RAW(16)` in canonical byte order, so v7 inserts stay clustered at the end of the primary-key index without any extra setup. On older Oracle versions use the `'custom-functions'` strategy together with the canonical implementation shown in [UUID utility functions for Oracle](#uuid-utility-functions-for-oracle). Oracle 23ai (23.9)+ also provides a server-side `UUID()` function that returns v4 — useful if you accept v4 and want the database to generate the value as a column `DEFAULT`. There is no server-side v7 generator, so v7 must be generated in the application. See the [column types](../column-types.md) page for more context.

## UUID utility functions for Oracle

The `'custom-functions'` strategy requires the `uuid_to_raw` and `raw_to_uuid` functions to exist in the database. Two implementations are documented below — pick the one that matches the UUID version your application generates, since each preserves the time-ordering of a different version. The `'built-in'` strategy doesn't need either implementation, because Oracle 23ai (23.9)+ already ships built-ins that behave like the canonical (non-reordering) variant.

### For UUID v7 (or UUID v4) — preserve canonical byte order

UUID v7 already places the 48-bit timestamp at the start of the value, so storing the bytes as-is yields a chronologically sortable `RAW(16)`. UUID v4 is random, so byte ordering is irrelevant. **This is the recommended implementation for new applications:**

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

### For UUID v1 — reorder bytes so the timestamp segment sorts first

UUID v1 places the 60-bit timestamp split across the `time-low`, `time-mid` and `time-hi` fields, with `time-low` at the start of the string but the most-significant bits sitting in `time-hi`. To make a v1 UUID sortable inside `RAW(16)`, the fields are rearranged on store and put back on read. **Use this only if your application generates UUID v1; it will scramble v7's timestamp prefix.**

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
