---
search:
  boost: 0.59
---
# MySql

The way to define which database to use is by specifying it when defining the connection, by extending the appropriate database connection class. You must choose the correct database type to ensure that the generated SQL queries follow the dialect expected by that database.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

```ts
import { MySqlConnection } from "ts-sql-query/connections/MySqlConnection";

class DBConnection extends MySqlConnection<'DBConnection'> { }
```

## UUID strategies

ts-sql-query offers you different strategies to handle UUIDs in MySql:

- `binary`: *(default strategy)* In this case, the UUID is represented and stored as `binary` data type of lenght 16. This requires MySql 8 as minimum.
- `string`: In this case, the UUID is represented as string and stored in a column with `char`/`varchar`/`text` data type and length 36 characters.

To change the UUID strategy, you must set the `uuidStrategy` field in the connection object:

```ts
import { MySqlConnection } from "ts-sql-query/connections/MySqlConnection";

class DBConnection extends MySqlConnection<'DBConnection'> {
    protected uuidStrategy = 'string' as const
}
```

## Compatibility mode

The compatibility mode avoid to use with clasue to increase the compatibility with MySql 5.

By default the compatibility mode is disabled. To enable the compatibility mode you must set the `compatibilityMode` property of the connection to true.

```ts
import { MySqlConnection } from "ts-sql-query/connections/MySqlConnection";

class DBConnection extends MySqlConnection<'DBConnection'> {
    protected compatibilityMode = true
}
```

!!! warning

    When the compatibility mode is enabled recursive queries are not supported and you will get an error if you try to use them.
