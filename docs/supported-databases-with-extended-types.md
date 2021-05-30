# Supported databases with extended types

If you uses this variant, the types defined in [ts-extended-types](https://www.npmjs.com/package/ts-extended-types). It types allows to make your application even more type-safe and represents better the data handled by the database.

## MariaDB

```ts
import { TypeSafeMariaDBConnection } from "ts-sql-query/connections/TypeSafeMariaDBConnection";

class DBConection extends TypeSafeMariaDBConnection<'DBConnection'> { }
```

## MySql

```ts
import { TypeSafeMySqlConnection } from "ts-sql-query/connections/TypeSafeMySqlConnection";

class DBConection extends TypeSafeMySqlConnection<'DBConnection'> { }
```

## Oracle

```ts
import { TypeSafeOracleConnection } from "ts-sql-query/connections/TypeSafeOracleConnection";

class DBConection extends TypeSafeOracleConnection<'DBConnection'> { }
```

**Note**: Oracle doesn't have boolean data type; ts-sql-query assumes that the boolean is represented by a number where `0` is false, and `1` is true. All conversions are made automatically by ts-sql-query. In case you need a different way to represent a boolean, see [Custom booleans values](../advanced-usage/#custom-booleans-values) for more information.

## PostgreSql

```ts
import { TypeSafePostgreSqlConnection } from "ts-sql-query/connections/TypeSafePostgreSqlConnection";

class DBConection extends TypeSafePostgreSqlConnection<'DBConnection'> { }
```

## Sqlite

```ts
import { TypeSafeSqliteConnection } from "ts-sql-query/connections/TypeSafeSqliteConnection";

class DBConection extends TypeSafeSqliteConnection<'DBConnection'> { }
```

**Note**: If you use [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) to connect to the database you can run your queries synchronously. See [BetterSqlite3QueryRunner](../query-runners/recommended-query-runners/#better-sqlite3) and [Synchronous query runners](../advanced-usage/#synchronous-query-runners) for more information.

## SqlServer

```ts
import { TypeSafeSqlServerConnection } from "ts-sql-query/connections/TypeSafeSqlServerConnection";

class DBConection extends TypeSafeSqlServerConnection<'DBConnection'> { }
```

**Note**: An empty string will be treated as a null value; if you need to allow empty string set the `allowEmptyString` property to true in the connection object.

**Note**: Sql Server doesn't have boolean data type; ts-sql-query assumes that the boolean is represented by a bit where `0` is false, and `1` is true. All conversions are made automatically by ts-sql-query. In case you need a different way to represent a boolean, see [Custom booleans values](../advanced-usage/#custom-booleans-values) for more information.
