#!/bin/bash

# On Linux
# Download and uncompress instantclient-basic-linux: https://www.oracle.com/es/database/technologies/instant-client/linux-x86-64-downloads.html
# sudo apt-get install build-essential libaio1
#
# On Mac OS
# Download and uncompress instantclient-basic-macos: https://www.oracle.com/es/database/technologies/instant-client/macos-intel-x86-downloads.html
# Execute the commmand in the uncompressed folder: xattr -d com.apple.quarantine *
cp -R -X $PWD/../instantclient_19_8/* node_modules/oracledb/build/Release

set -x #echo on

ts-node ./src/examples/documentation/Sqlite-compatibility.ts || exit 1
ts-node ./src/examples/documentation/Sqlite-modern.ts || exit 1
ts-node ./src/examples/documentation/PostgreSql.ts || exit 1
ts-node ./src/examples/documentation/MySql.ts || exit 1
ts-node ./src/examples/documentation/MySql-compatibility.ts || exit 1
ts-node ./src/examples/documentation/MariaDB.ts || exit 1
ts-node ./src/examples/documentation/MariaDB-modern.ts || exit 1
ts-node ./src/examples/documentation/SqlServer.ts || exit 1
ts-node ./src/examples/documentation/Oracle.ts || exit 1

ts-node ./src/examples/SqliteExample.ts || exit 1
ts-node ./src/examples/Sqlite3Example.ts || exit 1
ts-node ./src/examples/BetterSqlite3Example.ts || exit 1
ts-node ./src/examples/BetterSqlite3SynchronousExample.ts || exit 1
ts-node ./src/examples/Sqlite3WasmOO1Example.ts || exit 1
ts-node ./src/examples/Sqlite3WasmOO1SynchronousExample.ts || exit 1
ts-node ./src/examples/PrismaSqliteExample.ts || exit 1

docker run --name ts-sql-query-postgres -p 5432:5432 -e POSTGRES_PASSWORD=mysecretpassword -d postgres
sleep 20
ts-node ./src/examples/PgExample.ts || { docker stop ts-sql-query-postgres; docker rm ts-sql-query-postgres; exit 1; }
ts-node ./src/examples/EncriptedIDPgExample.ts || { docker stop ts-sql-query-postgres; docker rm ts-sql-query-postgres; exit 1; }
ts-node ./src/examples/PrismaPostgresExample.ts || { docker stop ts-sql-query-postgres; docker rm ts-sql-query-postgres; exit 1; }
ts-node ./src/examples/PostgresExample.ts || { docker stop ts-sql-query-postgres; docker rm ts-sql-query-postgres; exit 1; }
docker stop ts-sql-query-postgres
docker rm ts-sql-query-postgres

docker run --name ts-sql-query-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=my-secret-pw -d mysql:5.7.29
sleep 30
ts-node ./src/examples/MySqlExample.ts || { docker stop ts-sql-query-mysql; docker rm ts-sql-query-mysql; exit 1; }
docker stop ts-sql-query-mysql
docker rm ts-sql-query-mysql

docker run --name ts-sql-query-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=my-secret-pw -d mysql
sleep 40
ts-node ./src/examples/MySql2Example.ts || { docker stop ts-sql-query-mysql; docker rm ts-sql-query-mysql; exit 1; }
ts-node ./src/examples/PrismaMySqlExample.ts || { docker stop ts-sql-query-mysql; docker rm ts-sql-query-mysql; exit 1; }
docker stop ts-sql-query-mysql
docker rm ts-sql-query-mysql

docker run --name ts-sql-query-mariadb -p 3306:3306 -e MYSQL_ROOT_PASSWORD=my-secret-pw -d mariadb
sleep 30
ts-node ./src/examples/MariaDBExample.ts || { docker stop ts-sql-query-mariadb; docker rm ts-sql-query-mariadb; exit 1; }
ts-node ./src/examples/MariaDBExample-modern.ts || { docker stop ts-sql-query-mariadb; docker rm ts-sql-query-mariadb; exit 1; }
ts-node ./src/examples/PrismaMariaDBExample.ts || { docker stop ts-sql-query-mariadb; docker rm ts-sql-query-mariadb; exit 1; }
docker stop ts-sql-query-mariadb
docker rm ts-sql-query-mariadb

# docker run --name ts-sql-query-sqlserver -e 'ACCEPT_EULA=Y' -e 'SA_PASSWORD=yourStrong(!)Password' -e 'MSSQL_PID=Express' -p 1433:1433 -d mcr.microsoft.com/mssql/server:2019-latest
docker run --name ts-sql-query-sqlserver -e 'ACCEPT_EULA=Y' -e 'SA_PASSWORD=yourStrong(!)Password' -e 'MSSQL_PID=Express' -p 1433:1433 -d mcr.microsoft.com/mssql/server:2017-latest-ubuntu
sleep 20
ts-node ./src/examples/TediousExample.ts || { docker stop ts-sql-query-sqlserver; docker rm ts-sql-query-sqlserver; exit 1; }
ts-node ./src/examples/MssqlTediousExample.ts || { docker stop ts-sql-query-sqlserver; docker rm ts-sql-query-sqlserver; exit 1; }
ts-node ./src/examples/PrismaSqlServerExample.ts || { docker stop ts-sql-query-sqlserver; docker rm ts-sql-query-sqlserver; exit 1; }
docker stop ts-sql-query-sqlserver
docker rm ts-sql-query-sqlserver

# docker run --name ts-sql-query-oracle -d -p 1521:1521 -e ORACLE_PASSWORD=Oracle18 gvenzl/oracle-xe
docker run --name ts-sql-query-oracle -d -p 1521:1521 quillbuilduser/oracle-18-xe
sleep 60
ts-node ./src/examples/OracleDBExample.ts || { docker stop ts-sql-query-oracle; docker rm ts-sql-query-oracle; exit 1; }
docker stop ts-sql-query-oracle
docker rm ts-sql-query-oracle

echo 'All examples ok'
