---
search:
  boost: 0.3
---
# API Introduction

The most common operations on data are supported by ts-sql-query. When a database does not support a specific feature, ts-sql-query attempts to emulate it within the generated SQL. If that is not possible, a compile-time error will be raised in your source code.

Some parts of the API follow a fluent interface design, meaning that each method returns an object exposing the next valid operations for that stage of the query.

Below is a simplified overview of the ts-sql-query APIs.
