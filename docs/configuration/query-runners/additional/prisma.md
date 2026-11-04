---
search:
  boost: 0.573
---
<!-- doc-code-template: postgresql -->
# prisma

`ts-sql-query` has no query runner for [Prisma](https://www.prisma.io). With Prisma 8 on PostgreSQL it doesn't need one: Prisma takes a [pg](https://www.npmjs.com/package/pg) pool or connection, so Prisma and the [pg query runners](../recommended/pg.md) can work over the same one, and share a transaction.

!!! info "Checked with"

    `@prisma/orm-postgres` `8.0.0-rc.22` and PostgreSQL 18, by hand. Prisma is not part of this project's test suite, and that version is a release candidate: check this page against the version you use.

## Sharing the pool

Give Prisma and the query runner the same pool. Each one takes a connection from it for its own work, so they don't share a transaction. Closing the Prisma client doesn't close a pool you gave it.

```ts
import { Pool } from 'pg';
import prismaPostgres from '@prisma/orm-postgres/runtime';
import { PgPoolQueryRunner } from "ts-sql-query/queryRunners/PgPoolQueryRunner";

const pool = new Pool(/* configuration */);
const db = prismaPostgres({ contract, pg: pool });

async function main() {
    const connection = new DBConnection(new PgPoolQueryRunner(pool));
    // Do your queries here
    connection // ...
    // Do Prisma's queries here
    db // ...
}
```

## Sharing a transaction

Prisma's transaction doesn't give its connection, so what the two share is a connection that one of them hands to the other. There are two ways, depending on which one manages the transaction.

| | `ts-sql-query` manages the transaction | Prisma manages the transaction |
| --- | --- | --- |
| Isolation levels | Yes | No: Prisma 8 doesn't offer them |
| `executeAfterNextCommit` and the other end-of-transaction functions | Yes | No |
| `connection.transaction(...)` | Yes | Rejected: the transaction is Prisma's |
| `db.transaction(...)` | Not allowed | Yes |

### ts-sql-query manages the transaction

This is the recommended way. Inside the transaction, ask the query runner for its connection and create the Prisma client over it:

```ts
import { Pool, type PoolClient } from 'pg';
import prismaPostgres from '@prisma/orm-postgres/runtime';
import { PgPoolQueryRunner } from "ts-sql-query/queryRunners/PgPoolQueryRunner";

const pool = new Pool(/* configuration */);

async function main() {
    const connection = new DBConnection(new PgPoolQueryRunner(pool));
    await connection.transaction(async () => {
        await connection.queryRunner.execute(async (client) => {
            const db = prismaPostgres({ contract, pg: client as PoolClient });
            // Do your queries and Prisma's here, in the same transaction
            connection // ...
            db // ...
        });
    });
}
```

!!! danger "Two things commit or lose the transaction"

    Prisma doesn't know this connection is in a transaction, so on this client:

    - **Don't use the `cursor` option of `prismaPostgres(...)`.** With it, Prisma wraps each read in its own `BEGIN` and `COMMIT`, and that `COMMIT` ends your transaction: what you wrote before stays committed even if you roll back later.
    - **Don't call `db.transaction(...)`.** It would begin a transaction on the same connection, and give the connection back to the pool when it ends.

### Prisma manages the transaction

Take a connection from the pool, create the Prisma client over it, and inside the transaction create the query runner over the same connection with [`forUseInTransaction`](../recommended/pg.md#inside-a-transaction-something-else-manages):

```ts
import { Pool } from 'pg';
import prismaPostgres from '@prisma/orm-postgres/runtime';
import { PgQueryRunner } from "ts-sql-query/queryRunners/PgQueryRunner";

const pool = new Pool(/* configuration */);

async function main() {
    const client = await pool.connect();
    const db = prismaPostgres({ contract, pg: client });
    await db.transaction(async (tx: any) => {
        const connection = new DBConnection(new PgQueryRunner(client, { forUseInTransaction: true }));
        // Do your queries here, and Prisma's through tx, in the same transaction
        connection // ...
        tx // ...
    });
    // Prisma already gave the connection back to the pool: don't release it
}
```

!!! warning "The connection lasts one transaction"

    Prisma gives a connection taken from a pool back when its transaction ends, and releasing it again throws. For another transaction, take another connection and create another Prisma client. Creating a Prisma client is cheap, and you don't need to close one created this way. If you end up not calling `db.transaction(...)`, release the connection yourself.

!!! note "A setting of the session"

    The first time a Prisma client uses a connection it sends one query of its own, a `set_config` of `DateStyle` to `ISO` and `lc_monetary` to `C`, which stays in the session of that connection.

## Other databases, and Prisma 7

Sharing a transaction takes a database driver that Prisma accepts from you. Elsewhere, use the query runner of your driver next to Prisma, in transactions of their own:

- **Prisma 8 on MySQL**: the package has no query client yet, only contracts and migrations.
- **Prisma 8 on SQLite**: it takes only the path of the database file, and opens it with `node:sqlite`.
- **Prisma 8 on SQL Server**: no package was available when this page was written.
- **Prisma 7**: `PrismaPg` and `PrismaMariaDb` take your pool, so the pool can be shared, but not a connection.

If your application needs a transaction shared with Prisma 7, stay on `ts-sql-query` `v2.0.0-beta.2`, the last version with a `PrismaQueryRunner` for Prisma 7.
