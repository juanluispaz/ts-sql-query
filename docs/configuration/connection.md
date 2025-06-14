---
search:
  boost: 0.54
---
# Connection

## Defining the connection object

When you define the connection object, you extend your database connection class; that class receives one generic argument with a unique name for the database in your system.

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { }
```

## Allowing empty string

By default empty string as treated as null, if you want to allow sending and receiving empty strings to the database set the `allowEmptyString` property in the connection to true.

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { 
    allowEmptyString = true
}
```

**Recommendation**: Set this flag at the beginning of the project or create a derivated connection if you require to do it. Changing this flag changes the way SQL queries are constructed when you use the methods that the name ends in 'IfValue'.

## Insensitive strategies

By default, when you specify that you want to perform an insensitive operation (like `startsWithInsensitive`) the operation is performed calling the function `lower` on the affected parts. But, another way to perform it is changing the collation of the text by one insensitive. If you set the insensitiveCollation in the connection, the provided collate will be used instead of calling the `lower` function.

Providing the collation allows you to perform more advanced insensitive operations like case insensitive and accent insensitive, or even more in some languages (like manage some letter composition alternatives). Some databases offer general collations that are case insensitive and accent insensitive. But it is expected you want to use a collation specific to the language used by the user.

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { 
    insesitiveCollation = 'insensitive'
}
```

**Useful collations per database**:

The following collations are case insensitive and accent insensitive:

- **[PostgreSQL](../configuration/supported-databases/postgresql.md)**: Starting from PostgreSQL 12 you can create custom non-deterministic collates from ICU database (previously it was OS dependant) with specific rules.
    - For a general collation case insensitive and accent insensitive, you can create the collation with:

```postgresql
CREATE COLLATION insensitive (
    provider = 'icu',
    locale = 'und@colStrength=primary', -- or 'und-u-ks-level1'
    deterministic = false
)
```

- 
    - For a collation specific for one language (in this example: Spanish) case insensitive and accent insensitive, you create the collation using:

```postgresql
CREATE COLLATION es_insensitive (
    provider = 'icu',
    locale = 'es@colStrength=primary', -- or 'es-u-ks-level1'
    deterministic = false
)
```

- 
    - For more information, visit [this blog post](https://postgresql.verite.pro/blog/2019/10/14/nondeterministic-collations.html)
    - Execute `SELECT * FROM pg_collation` to list the already created collations
- **[MySQL](../configuration/supported-databases/mysql.md)**/**[MariaDB](../configuration/supported-databases/mariadb.md)**: 
    - `utf8_general_ci` for utf8 charset
    - `utf16_unicode_ci` for utf16 charset
    - `utf8_spanish_ci` for utf8 charset with spanish rules
    - Execute `SHOW COLLATION` to list the supported collations in your database; all locations ended with `_ci` are case insensitive and accent insensitive.
- **[SQL Server](../configuration/supported-databases/sqlserver.md)**:
    - `Latin1_General_CI_AI` for a general case insensitive and accent insensitive for Latin alphabet-based languages
    - `Modern_Spanish_CI_AI` for a specific case insensitive and accent insensitive for the Spanish language only
    - Execute `SELECT * FROM sys.fn_helpcollations()` to list the supported collations in your database 
- **[Oracle](../configuration/supported-databases/oracle.md)**:
    - `binary_ai` for a general case insensitive and accent insensitive for Latin alphabet-based languages
    - `spanish_m_ai` for a specific case insensitive and accent insensitive extended with the Spanish language rules
    - To see the collations list visit the [Oracle 11g](https://docs.oracle.com/cd/B28359_01/server.111/b28298/applocaledata.htm#i637232) or [Oracle 19](https://docs.oracle.com/en/database/oracle/oracle-database/19/nlspg/appendix-A-locale-data.html#GUID-CC85A33C-81FC-4E93-BAAB-1B3DB9036060) documentation webpage

!!! tip

    If you set the `startsWithInsensitive` property to an empty string (''), the function `lower` will not be called, neither a collated will be specified. It is useful when you already defined the insensitive collate rules at the database level.

## Instantiating the connection with the database connection

```ts
const { Pool } = require('pg');
import { PgPoolQueryRunner } from "ts-sql-query/queryRunners/PgPoolQueryRunner";

const pool = new Pool();

async function main() {
    const connection = new DBConnection(new PgPoolQueryRunner(pool));
    // Do your queries here
    /*
     * Maybe you want to perform the queries in a transaction:
     * await connection.transaction(async () => {
     *     // Do your queries here
     * })
     * 
     * You also can manage the transaction at low level:
     * await connection.beginTransaction();
     * await connection.commit();
     * await connection.rollback();
     */
}
```

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Instantiating the connection with a mock database connection

Have a mock database connection is useful when you want to make unit tests. Using a mock connection allows you to test your code against the generated query instead of running the query in the database.

```ts
import { MockQueryRunner } from "ts-sql-query/queryRunners/MockQueryRunner";

function test('my db test', () => {
    const connection = new DBConnection(new MockQueryRunner(
        (type, query, params, index) => {
            switch (index) {
            case 0:
                expect(type).toBe('delete');
                expect(query).toBe('delete from customer where id = $1');
                expect(params).toEqual([10]);
                return 1; // Returns the result of the query execution
            default:
                throw new Error('Unexpected query');
            }
        }
    ));

    // Do your queries here, example:
    const deleteCustomer = connection.deleteFrom(tCustomer)
        .where(tCustomer.id.equals(10))
        .executeDelete();

    return deleteCustomer.then((result) => {
        expect(result).toBe(1);
    });
});
```
