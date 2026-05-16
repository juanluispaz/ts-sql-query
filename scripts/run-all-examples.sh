#!/bin/bash

set -x #echo on

wait_healthy() {
    { set +x; } 2>/dev/null

    container_name=$1
    timeout_seconds=$2
    elapsed_seconds=0

    until [ "$(docker inspect -f '{{.State.Health.Status}}' "$container_name" 2>/dev/null)" = "healthy" ]; do
        if [ "$elapsed_seconds" -ge "$timeout_seconds" ]; then
            echo "Timed out waiting for $container_name"
            docker logs "$container_name" --tail 100
            { set -x; return 1; } 2>/dev/null
        fi
        sleep 1
        elapsed_seconds=$((elapsed_seconds + 1))
    done
    set -x
}

tsx ./src/examples/documentation/Sqlite-compatibility.ts || exit 1
tsx ./src/examples/documentation/Sqlite-modern.ts || exit 1
tsx ./src/examples/documentation/PostgreSql.ts || exit 1
tsx ./src/examples/documentation/MySql.ts || exit 1
tsx ./src/examples/documentation/MySql-compatibility.ts || exit 1
tsx ./src/examples/documentation/MariaDB.ts || exit 1
tsx ./src/examples/documentation/MariaDB-modern.ts || exit 1
tsx ./src/examples/documentation/SqlServer.ts || exit 1
tsx ./src/examples/documentation/Oracle.ts || exit 1

tsx ./src/examples/Sqlite3Example.ts || exit 1
tsx ./src/examples/BetterSqlite3Example.ts || exit 1
tsx ./src/examples/BetterSqlite3SynchronousExample.ts || exit 1
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -ge 24 ]; then
    NODE_OPTIONS='--experimental-sqlite' tsx ./src/examples/NodeSqliteExample.ts || exit 1
    NODE_OPTIONS='--experimental-sqlite' tsx ./src/examples/NodeSqliteSynchronousExample.ts || exit 1
else
    echo "Skipping NodeSqlite{,Synchronous}Example.ts: db.function API requires Node >= 24 (current: Node $NODE_MAJOR)"
fi
tsx ./src/examples/Sqlite3WasmOO1Example.ts || exit 1
tsx ./src/examples/Sqlite3WasmOO1SynchronousExample.ts || exit 1
tsx ./src/examples/PrismaSqliteExample.ts || exit 1

tsx ./src/examples/PgLiteExample.ts || exit 1

# tsx src/examples/BunSqliteExample.ts || exit 1
# tsx src/examples/BunSqliteSynchronousExample.ts || exit 1
# tsx src/examples/BunSqlSqliteExample.ts || exit 1

docker run --name ts-sql-query-postgres -p 5432:5432 -e POSTGRES_PASSWORD=mysecretpassword --health-cmd "pg_isready -U postgres -d postgres" --health-interval 1s --health-timeout 5s --health-retries 60 -d postgres
wait_healthy ts-sql-query-postgres 60 || { docker stop ts-sql-query-postgres; docker rm ts-sql-query-postgres; exit 1; }
tsx ./src/examples/PgExample.ts || { docker stop ts-sql-query-postgres; docker rm ts-sql-query-postgres; exit 1; }
tsx ./src/examples/EncriptedIDPgExample.ts || { docker stop ts-sql-query-postgres; docker rm ts-sql-query-postgres; exit 1; }
tsx ./src/examples/PostgresExample.ts || { docker stop ts-sql-query-postgres; docker rm ts-sql-query-postgres; exit 1; }
# tsx ./src/examples/BunSqlPostgresExample.ts || { docker stop ts-sql-query-postgres; docker rm ts-sql-query-postgres; exit 1; }
tsx ./src/examples/PrismaPostgresExample.ts || { docker stop ts-sql-query-postgres; docker rm ts-sql-query-postgres; exit 1; }
docker stop ts-sql-query-postgres
docker rm ts-sql-query-postgres

docker run --name ts-sql-query-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=my-secret-pw --health-cmd "mysqladmin ping -h 127.0.0.1 -uroot -pmy-secret-pw --silent" --health-interval 1s --health-timeout 5s --health-retries 120 -d mysql
wait_healthy ts-sql-query-mysql 120 || { docker stop ts-sql-query-mysql; docker rm ts-sql-query-mysql; exit 1; }
tsx ./src/examples/MySql2Example.ts || { docker stop ts-sql-query-mysql; docker rm ts-sql-query-mysql; exit 1; }
# tsx ./src/examples/BunSqlMySqlExample.ts || { docker stop ts-sql-query-mysql; docker rm ts-sql-query-mysql; exit 1; }
tsx ./src/examples/PrismaMySqlExample.ts || { docker stop ts-sql-query-mysql; docker rm ts-sql-query-mysql; exit 1; }
docker stop ts-sql-query-mysql
docker rm ts-sql-query-mysql

docker run --name ts-sql-query-mariadb -p 3306:3306 -e MYSQL_ROOT_PASSWORD=my-secret-pw --health-cmd "mariadb-admin ping -h 127.0.0.1 -uroot -pmy-secret-pw --silent || mysqladmin ping -h 127.0.0.1 -uroot -pmy-secret-pw --silent" --health-interval 1s --health-timeout 5s --health-retries 120 -d mariadb
wait_healthy ts-sql-query-mariadb 120 || { docker stop ts-sql-query-mariadb; docker rm ts-sql-query-mariadb; exit 1; }
tsx ./src/examples/MariaDBExample.ts || { docker stop ts-sql-query-mariadb; docker rm ts-sql-query-mariadb; exit 1; }
tsx ./src/examples/MariaDBExample-modern.ts || { docker stop ts-sql-query-mariadb; docker rm ts-sql-query-mariadb; exit 1; }
# tsx ./src/examples/BunSqlMariaDBExample.ts || { docker stop ts-sql-query-mariadb; docker rm ts-sql-query-mariadb; exit 1; }
tsx ./src/examples/PrismaMariaDBExample.ts || { docker stop ts-sql-query-mariadb; docker rm ts-sql-query-mariadb; exit 1; }
docker stop ts-sql-query-mariadb
docker rm ts-sql-query-mariadb

docker run --name ts-sql-query-sqlserver -e 'ACCEPT_EULA=Y' -e 'MSSQL_SA_PASSWORD=yourStrong(!)Password' -p 1433:1433 --health-cmd "bash -c '</dev/tcp/127.0.0.1/1433'" --health-interval 1s --health-timeout 5s --health-retries 120 -d mcr.microsoft.com/azure-sql-edge:1.0.7
wait_healthy ts-sql-query-sqlserver 120 || { docker stop ts-sql-query-sqlserver; docker rm ts-sql-query-sqlserver; exit 1; }
tsx ./src/examples/MssqlTediousExample.ts || { docker stop ts-sql-query-sqlserver; docker rm ts-sql-query-sqlserver; exit 1; }
tsx ./src/examples/PrismaSqlServerExample.ts || { docker stop ts-sql-query-sqlserver; docker rm ts-sql-query-sqlserver; exit 1; }
docker stop ts-sql-query-sqlserver
docker rm ts-sql-query-sqlserver

docker run --name ts-sql-query-oracle -d -p 1521:1521 -e ORACLE_PASSWORD=Oracle18 --health-cmd "echo 'select 1 from dual;' | sqlplus -L -S 'sys/Oracle18@//localhost:1521/FREEPDB1 as sysdba' | grep -q '^[[:space:]]*1[[:space:]]*$'" --health-interval 1s --health-timeout 5s --health-retries 300 gvenzl/oracle-free:23-slim-faststart
wait_healthy ts-sql-query-oracle 300 || { docker stop ts-sql-query-oracle; docker rm ts-sql-query-oracle; exit 1; }
tsx ./src/examples/OracleDBExample.ts || { docker stop ts-sql-query-oracle; docker rm ts-sql-query-oracle; exit 1; }
docker stop ts-sql-query-oracle
docker rm ts-sql-query-oracle

echo 'All examples ok'
