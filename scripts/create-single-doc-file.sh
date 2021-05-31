#!/bin/bash
echo '\n# index.md\n' > dist/doc.md
cat docs/index.md >> dist/doc.md
echo '\n# queries/basic-query-structure.md\n' >> dist/doc.md
cat docs/queries/basic-query-structure.md >> dist/doc.md
echo '\n# queries/dynamic-queries.md\n' >> dist/doc.md
cat docs/queries/dynamic-queries.md >> dist/doc.md
echo '\n# queries/select.md\n' >> dist/doc.md
cat docs/queries/select.md >> dist/doc.md
echo '\n# queries/select-page.md\n' >> dist/doc.md
cat docs/queries/select-page.md >> dist/doc.md
echo '\n# queries/recursive-select.md\n' >> dist/doc.md
cat docs/queries/recursive-select.md >> dist/doc.md
echo '\n# queries/select-using-a-dynamic-filter.md\n' >> dist/doc.md
cat docs/queries/select-using-a-dynamic-filter.md >> dist/doc.md
echo '\n# queries/sql-fragments.md\n' >> dist/doc.md
cat docs/queries/sql-fragments.md >> dist/doc.md
echo '\n# queries/insert.md\n' >> dist/doc.md
cat docs/queries/insert.md >> dist/doc.md
echo '\n# queries/update.md\n' >> dist/doc.md
cat docs/queries/update.md >> dist/doc.md
echo '\n# queries/delete.md\n' >> dist/doc.md
cat docs/queries/delete.md >> dist/doc.md
echo '\n# connection-tables-views.md\n' >> dist/doc.md
cat docs/connection-tables-views.md >> dist/doc.md
echo '\n# composing-and-splitting-results.md\n' >> dist/doc.md
cat docs/composing-and-splitting-results.md >> dist/doc.md
echo '\n# supported-operations.md\n' >> dist/doc.md
cat docs/supported-operations.md >> dist/doc.md
echo '\n# supported-databases.md\n' >> dist/doc.md
cat docs/supported-databases.md >> dist/doc.md
echo '\n# supported-databases-with-extended-types.md\n' >> dist/doc.md
cat docs/supported-databases-with-extended-types.md >> dist/doc.md
echo '\n# query-runners/recommended-query-runners.md\n' >> dist/doc.md
cat docs/query-runners/recommended-query-runners.md >> dist/doc.md
echo '\n# query-runners/additional-query-runners.md\n' >> dist/doc.md
cat docs/query-runners/additional-query-runners.md >> dist/doc.md
echo '\n# query-runners/general-purpose-query-runners.md\n' >> dist/doc.md
cat docs/query-runners/general-purpose-query-runners.md >> dist/doc.md
echo '\n# advanced-usage.md\n' >> dist/doc.md
cat docs/advanced-usage.md >> dist/doc.md
echo '\n# CHANGELOG.md\n' >> dist/doc.md
cat docs/CHANGELOG.md >> dist/doc.md