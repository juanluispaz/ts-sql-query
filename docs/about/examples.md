---
search:
  exclude: true
---
# Examples

You can find a complete example using ts-sql-query with PostgreSQL in the file [PgExample.ts](https://github.com/juanluispaz/ts-sql-query/blob/master/src/examples/PgExample.ts). You can browse the [examples folder](https://github.com/juanluispaz/ts-sql-query/tree/master/src/examples) to see an example for each supported database using different ways to connect to it.

**Running examples:**

The first time you download the project:

```sh
npm install
npm run generate-prisma
```

To execute all examples:

```sh
npm run all-examples
```

This command will compile the project and execute the script located at [scripts/run-all-examples.sh](https://github.com/juanluispaz/ts-sql-query/blob/master/scripts/run-all-examples.sh)

!!! note "Be aware"

    This command expects you to have docker running and Oracle instantclient-basic downloaded and configured the path in the script (see the script to get more details)

If you want to execute a single example (like Sqlite):

```sh
npx ts-node ./src/examples/SqliteExample.ts
```

!!! note "Be aware"

    All examples excepting Sqlite require a specific docker image with the database running; see [scripts/run-all-examples.sh](https://github.com/juanluispaz/ts-sql-query/blob/master/scripts/run-all-examples.sh) for more details.
