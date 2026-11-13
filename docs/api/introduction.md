---
search:
  boost: 0.3
---
# API Introduction

The most common operations on data are supported by `ts-sql-query`. When a database does not support a specific feature, `ts-sql-query` attempts to emulate it within the generated SQL. If that is not possible, a compile-time error will be raised in your source code.

Each page of the API lists the methods and types of one part of the library; the guides explain them with examples, their SQL and their results. To start, see [Basic query structure](../queries/basic-query-structure.md), [Connection](../configuration/connection.md) and [Mapping](../configuration/mapping.md); each page of the API links to the guides of its part.

Some parts of the API follow a fluent interface design, meaning that each method returns an object exposing the next valid operations for that stage of the query.

These pages are a simplified overview of the `ts-sql-query` APIs. To be easy to read, a fluent interface is shown as one interface with all its methods, and the optionality of a value isn't part of the signatures. The real types offer each method only where it's valid, and they know whether each value is optional.
