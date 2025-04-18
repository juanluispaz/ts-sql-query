---
search:
  boost: 0.59
---
# PostgreSql

The way to define which database to use is by specifying it when defining the connection, by extending the appropriate database connection class. You must choose the correct database type to ensure that the generated SQL queries follow the dialect expected by that database.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { }
```

!!! tip

    Sometimes you can find yourself in situation where PostgreSql is not able to infer the type of the parameter in the query, for this you will need to tell the system to include a type cast in the generated query using the class `ForceTypeCast` provided in  `ts-sql-query/TypeAdapter` as type adapter. You can force to always include the type cast in the generated query implementing the method `transformPlaceholder`:

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { 
    protected transformPlaceholder(placeholder: string, type: string, _forceTypeCast: boolean, valueSentToDB: unknown): string {
        return super.transformPlaceholder(placeholder, type, true, valueSentToDB)
    }
}
```

You can add your custom type cast or override the default one in the implementation of `transformPlaceholder` methode like the one described in [Globally type adapter](../column-types.md#globally-type-adapter); you can see the default type cast in the class [AbstractPostgreSqlConnection](https://github.com/juanluispaz/ts-sql-query/blob/master/src/connections/AbstractPostgreSqlConnection.ts).
