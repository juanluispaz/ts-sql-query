---
search:
  boost: 0.573
---
# mysql

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## mysql (with a connection pool)

It allows to execute the queries using a [mysql](https://www.npmjs.com/package/mysql) connection pool.

**Supported databases**: mariaDB, mySql

```ts
import { createPool } from "mysql";
import { MySqlPoolQueryRunner } from "ts-sql-query/queryRunners/MySqlPoolQueryRunner";

const pool  = createPool({
  connectionLimit : 10,
  host            : 'example.org',
  user            : 'bob',
  password        : 'secret',
  database        : 'my_db'
});

async function main() {
    const connection = new DBConnection(new MySqlPoolQueryRunner(pool));
    // Do your queries here
}
```

## mysql (with a connection)

It allows to execute the queries using a [mysql](https://www.npmjs.com/package/mysql) connection.

**Supported databases**: mariaDB, mySql

```ts
import { createPool } from "mysql";
import { MySqlQueryRunner } from "ts-sql-query/queryRunners/MySqlQueryRunner";

const pool  = createPool({
  connectionLimit : 10,
  host            : 'example.org',
  user            : 'bob',
  password        : 'secret',
  database        : 'my_db'
});

function main() {
    pool.getConnection((error, mysqlConnection) => {
        if (error) {
            throw error;
        }
        try {
            const connection = new DBConnection(new MySqlQueryRunner(mysqlConnection));
            doYourLogic(connection).finnaly(() => {
                mysqlConnection.release();
            });
        } catch(e) {
            mysqlConnection.release();
            throw e;
        }
    });
}

async function doYourLogic(connection: DBConnection) {
    // Do your queries here
}
```
