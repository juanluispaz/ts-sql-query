---
search:
  boost: 0.13
---
# Philosophy and Design Goals

`ts-sql-query` was created with a clear vision: to bring the full expressive power of SQL into TypeScript, without sacrificing type safety or falling into the complexity traps of ORM-style abstractions.

Unlike many libraries that attempt to hide SQL behind layers of objects and conventions, `ts-sql-query` embraces the **declarative nature of SQL** while enhancing it with **compile-time type validation**, **composability**, and **modular design**.

## Declarative first

Inspired by SQL itself, `ts-sql-query` promotes a declarative style where queries are described, not programmed. Instead of building logic imperatively with control structures (`if`, `for`, etc.), queries are composed using expressive helpers such as `equalsIfValue`, `onlyWhen`, and `dynamicConditionFor`.

!!! note ""

    This leads to more predictable, readable, and composable code — aligned with the mental model of SQL.

## Type-safe by design

Every expression, projection, condition, and join is statically validated by TypeScript. This eliminates entire classes of runtime errors by catching invalid column references, incompatible types, or unsafe combinations — as early as the editor or build time.

This type safety also extends to optional conditions, query composition, joins, aggregations, and return types, ensuring that your queries remain robust and maintainable.

## SQL-first, not ORM

`ts-sql-query` does not try to map your database into a hierarchy of classes or hide SQL behind a "model layer". Instead, it puts SQL at the center — while giving you ergonomic and powerful tools to write it in TypeScript.

You write SQL — with types.

## Transparent and explicit

There is no hidden magic. Every condition, join, subquery, or projection is visible in your code. You can trace back what SQL will be generated, and how, with full control.

This transparency empowers you to write precise, understandable, and efficient queries — without guessing what the library will do behind the scenes.

## Unified SQL dialect and database-specific features

`ts-sql-query` uses a **single declarative SQL dialect**, inspired primarily by PostgreSQL and SQLite, with naming conventions adapted to the JavaScript and TypeScript ecosystem.

Instead of mimicking raw SQL keywords, the library exposes a clear, expressive API that maps directly to the intent behind the SQL — using methods like `equals`, `startsWith`, `containsIfValue`, and `orderByFromString`.

!!! note ""

    This unified dialect acts as a type-safe, declarative "SQL meta-language" that compiles to the appropriate SQL for the selected database.

### Cross-database compatibility

The unified dialect allows the same code to run against different SQL engines — PostgreSQL, MySQL, MariaDB, SQLite, or SQL Server — while ensuring that the generated queries conform to the syntax and semantics of the target engine.

You choose the database by extending the appropriate connection class. From that point on, all generated SQL is adapted to that database’s dialect, with full static validation.

### Database-specific extensions

In addition to the cross-dialect core, `ts-sql-query` provides **engine-specific features** that are available only when you use the corresponding connection type.

These features are:

- **Type-safe and statically validated** — if you use a feature not supported by the current database, TypeScript will catch it at compile time.
- **Bound to the database** — each feature is only accessible through the proper database connection class.

> This design gives you the best of both worlds: a consistent query-building experience, and access to the full power of each database — without sacrificing safety or portability.

## Why it exists

Writing SQL in dynamic languages often leads to duplication, runtime failures, and unsafe string manipulation. `ts-sql-query` was born out of the need to write **real SQL**, with **real safety**, in TypeScript — while staying close to the language that actually runs in the database.

It's not a general-purpose ORM. It’s a **type-safe SQL builder**, designed for clarity, correctness, and power.

## When to use it

Use `ts-sql-query` if:

- You want the precision of SQL with the safety of TypeScript.
- You need dynamic query composition, but don’t want to lose control over the generated SQL.
- You care about the shape of your database and want queries to reflect it directly.

## Final word

`ts-sql-query` is not here to abstract SQL — it's here to make it safe, powerful, and expressive inside TypeScript.  
It’s a tool for developers who want **clarity, not illusion — and safety, not scaffolding**.
