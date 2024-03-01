#!/bin/bash

# Open terminal as x86 using rosetta
# $ arch -x86_64 zsh --login
# https://developer.apple.com/forums/thread/718666
# https://vineethbharadwaj.medium.com/m1-mac-switching-terminal-between-x86-64-and-arm64-e45f324184d9

# Install multiple node with different architecture
# On terminal
# $ curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
# (Restart terminal)
# $ nvm install v19.8.1
# $ arch -x86_64 zsh --login
# $ nvm install v19.8.0
# $ nvm alias arm v19.8.1
# $ nvm alias intel v19.8.0
# https://www.jurnalanas.com/blog/node-js-mac-m1

# Enable rosetta in docker (doesn't work, skip this)
# https://levelup.gitconnected.com/docker-on-apple-silicon-mac-how-to-run-x86-containers-with-rosetta-2-4a679913a0d5

# Install colima
# https://blog.jdriven.com/2022/07/running-oracle-xe-on-apple-silicon/
# https://oralytics.com/2022/09/22/running-oracle-database-on-docker-on-apple-m1-chip/

# Download and uncompress instantclient-basic-macos: https://www.oracle.com/es/database/technologies/instant-client/macos-intel-x86-downloads.html
# Execute the commmand in the uncompressed folder: xattr -d com.apple.quarantine *
cp -R -X $PWD/../instantclient_19_8/* node_modules/oracledb/build/Release

set -x #echo on

node -p "if (process.arch !== 'x64') { process.exit(1) }" || { echo "not running in rosetta"; exit 1; }

colima start --arch x86_64 --memory 4
docker run --name ts-sql-query-oracle -d -p 1521:1521 -e ORACLE_PASSWORD=Oracle18 gvenzl/oracle-xe
echo waiting 1 min of 7 min
sleep 60
echo waiting 2 min of 6 min
sleep 60
echo waiting 3 min of 6 min
sleep 60
echo waiting 4 min of 6 min
sleep 60
echo waiting 5 min of 6 min
sleep 60
echo waiting 6 min of 6 min
sleep 60
ts-node ./src/examples/OracleDBExample.ts
echo waiting 7 min of 6 min
sleep 60
ts-node ./src/examples/OracleDBExample.ts || { docker stop ts-sql-query-oracle; docker rm ts-sql-query-oracle; colima stop; exit 1; }
docker stop ts-sql-query-oracle
docker rm ts-sql-query-oracle
colima stop

echo 'All examples ok (rosetta)'
