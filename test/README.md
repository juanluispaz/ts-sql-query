# ts-sql-query test strategy

ts-sql-query follows a strategy that can be a little bit different to what is usual:

1. The tests are structured as runnable examples located in the [src/examples folder](https://github.com/juanluispaz/ts-sql-query/tree/master/src/examples)
2. Tests must mimic real usage to be used as a reference for the users
3. All tests must be done using the public interface, like any user of ts-sql-query will use the library
4. The tests must run against real databases using real servers when it is possible
5. Tests that are executed in the real database are prefered over mock tests
6. The same test needs to be executed in each of the supported databases: 
    - MariaDB
    - MySql
    - Oracle
    - PostgreSql
    - Sqlite
    - SqlServer
7. The same test needs to be executed using all the ways to connect to the database: 
    - **The recommended one**: 
      - better-sqlite3 (Sqlite)
      - mariadb (MariaDB)
      - mssql (SqlServer)
      - mysql2 (MySql)
      - oracledb (Oracle)
      - pg (PostgreSql)
      - sqlite3 (Sqlite)
    - **The alternative one**:
      - any-db (MariaDB, MySql, PostgreSql, Sqlite, SqlServer)
      - loopback (MariaDB, MySql, PostgreSql, Sqlite, SqlServer, Oracle)
      - mysql (MySql)
      - prisma (MariaDB, MySql, PostgreSql, Sqlite, SqlServer)
8. The same test needs to be executed using all the supported query runners available to connect to a specific database

## Preparation to execute the tests

- You need to have docker installed on your computer
- You need 17 Gb of free space to download all the database docker image
- You need 72 Gb of additional free space that the docker disk image will need
- You need to configure docker to allow the disk image size limit as minimum of 72 Gb
- You will need to download Oracle's Instant Client package (basic version).
  - Linux version: https://www.oracle.com/es/database/technologies/instant-client/linux-x86-64-downloads.html
  - MacOS version: https://www.oracle.com/es/database/technologies/instant-client/macos-intel-x86-downloads.html
- You need to uncompress Oracle's Instant Client.

    **MacOS users**: 
    
    The file must be uncompressed in a folder different to the standard folders included in your user directory. This rule doesn't allow to use of the `Download` folder. Suppose you place the content of Oracle's Instant Client in any of the standard folders available in your home directory. In that case, the MacOS's gatekeeper will stop you due to additional permissions required. 

    When Oracle's Instant Client is uncompressed, you will need to drop the quarantine mark over the files. To do this, you must execute the command `xattr -d com.apple.quarantine *` inside the uncompressed folder.

- You need to update the following line of the [scripts/run-all-examples.sh](https://github.com/juanluispaz/ts-sql-query/blob/master/scripts/run-all-examples.sh) with the location of the Oracle's Instant Client folder:

    **Before**: `cp -R -X $PWD/../instantclient_19_8/* node_modules/oracledb/build/Release`

    **After**: `cp -R -X /location/of/instantclient/* node_modules/oracledb/build/Release`

## Running all tests

To run all the tests, you need to execute the following command:

`npm run all-examples`

**Note**: The tests execution can last 13 min.

## Code coverage

To run all the tests extracting the code coverage, you need to execute the following command:

`npm run coverage`

At the end, you will find the coverage report at `coverage/index.html`

**Note**: The tests execution with coverage can last 13 min.