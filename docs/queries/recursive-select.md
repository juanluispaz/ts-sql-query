---
search:
  boost: 3
---
# Recursive select

This page explains how to build recursive SQL queries using the fluent API in `ts-sql-query`. It supports both standard recursive CTEs (`WITH RECURSIVE`) and [Oracle](../configuration/supported-databases/oracle.md)'s proprietary `CONNECT BY` syntax. These queries are useful for traversing hierarchical data structures such as organizational trees or category trees.

## Recursive select looking for parents

```ts
const recursiveParentCompany = connection.selectFrom(tCompany)
    .where(tCompany.id.equals(10))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parentId: tCompany.parentId
    }).recursiveUnionAll((child) => { // Or, where supported: recursiveUnion
        return connection.selectFrom(tCompany)
        .join(child).on(child.parentId.equals(tCompany.id))
        .select({
            id: tCompany.id,
            name: tCompany.name,
            parentId: tCompany.parentId
        })
    }).executeSelectMany()
```

If the recursive query uses the same `SELECT` and `FROM` clauses as the outer query, you can simplify it by specifying only the `JOIN ON` condition:

```ts
const recursiveParentCompany = connection.selectFrom(tCompany)
    .where(tCompany.id.equals(10))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parentId: tCompany.parentId
    }).recursiveUnionAllOn((child) => { // Or, where supported: recursiveUnionOn
        return child.parentId.equals(tCompany.id)
    }).executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    with recursive 
        recursive_select_1 as (
            select 
                id as id, 
                name as name, 
                parent_id as parentId 
            from company 
            where id = ? 
            
            union all 
            
            select 
                company.id as id, 
                company.name as name,
                company.parent_id as parentId 
            from company 
            join recursive_select_1 on recursive_select_1.parentId = company.id
        ) 
    select 
        id as id, 
        name as name, 
        parentId as parentId 
    from recursive_select_1
    ```
=== "MySQL"
    ```mysql
    with recursive 
        recursive_select_1 as (
            select 
                id as id, 
                `name` as `name`, 
                parent_id as parentId 
            from company 
            where id = ? 
            
            union all 
            
            select 
                company.id as id, 
                company.`name` as `name`, 
                company.parent_id as parentId 
            from company 
            join recursive_select_1 on recursive_select_1.parentId = company.id
        ) 
    select 
        id as id, 
        `name` as `name`, 
        parentId as parentId 
    from recursive_select_1
    ```
=== "Oracle"
    ```oracle
    with 
        recursive_select_1(id, name, parentId) as (
            select 
                id as id, 
                name as name, 
                parent_id as parentId 
            from company 
            where id = :0 
            
            union all 
            
            select 
                company.id as id, 
                company.name as name, 
                company.parent_id as parentId 
            from company 
            join recursive_select_1 on recursive_select_1.parentId = company.id
        ) 
    select 
        id as "id", 
        name as "name", 
        parentId as "parentId" 
    from recursive_select_1
    ```
===+ "PostgreSQL"
    ```postgresql
    with recursive 
        recursive_select_1 as (
            select 
                id as id, 
                name as name, 
                parent_id as parentId 
            from company 
            where id = $1 
            
            union all 
            
            select 
                company.id as id, 
                company.name as name, 
                company.parent_id as parentId 
            from company 
            join recursive_select_1 on recursive_select_1.parentId = company.id
        ) 
    select 
        id as id, 
        name as name, 
        parentId as "parentId" 
    from recursive_select_1
    ```
=== "SQLite"
    ```sqlite
    with recursive 
        recursive_select_1 as (
            select 
                id as id, 
                name as name, 
                parent_id as parentId 
            from company 
            where id = ? 
            
            union all 
            
            select 
                company.id as id, 
                company.name as name, 
                company.parent_id as parentId 
            from company 
            join recursive_select_1 on recursive_select_1.parentId = company.id
        ) 
    select 
        id as id, 
        name as name, 
        parentId as parentId 
    from recursive_select_1
    ```
=== "SQL Server"
    ```sqlserver
    with 
        recursive_select_1 as (
            select 
                id as id, 
                name as name, 
                parent_id as parentId 
            from company 
            where id = @0 
            
            union all 
            
            select 
                company.id as id, 
                company.name as name, 
                company.parent_id as parentId 
            from company 
            join recursive_select_1 on recursive_select_1.parentId = company.id
        ) 
    select 
        id as id, 
        name as name, 
        parentId as parentId 
    from recursive_select_1
    ```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const recursiveParentCompany: Promise<{
    id: number;
    name: string;
    parentId?: number;
}[]>
```

## Recursive select looking for children

```ts
const recursiveChildrenCompany = connection.selectFrom(tCompany)
    .where(tCompany.id.equals(10))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parentId: tCompany.parentId
    }).recursiveUnionAll((parent) => { // Or: recursiveUnion
        return connection.selectFrom(tCompany)
        .join(parent).on(parent.id.equals(tCompany.parentId))
        .select({
            id: tCompany.id,
            name: tCompany.name,
            parentId: tCompany.parentId
        })
    }).executeSelectMany()
```

If the recursive query uses the same `SELECT` and `FROM` clauses as the outer query, you can simplify it by specifying only the `JOIN ON` condition:

```ts
const recursiveChildrenCompany = connection.selectFrom(tCompany)
    .where(tCompany.id.equals(10))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parentId: tCompany.parentId
    }).recursiveUnionAllOn((parent) => { // Or: recursiveUnionOn
        return parent.id.equals(tCompany.parentId)
    }).executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    with recursive 
        recursive_select_1 as (
            select 
                id as id, 
                name as name, 
                parent_id as parentId 
            from company 
            where id = ? 
            
            union all 
            
            select 
                company.id as id, 
                company.name as name, 
                company.parent_id as parentId 
            from company 
            join recursive_select_1 on recursive_select_1.id = company.parent_id
        ) 
    select 
        id as id, 
        name as name, 
        parentId as parentId 
    from recursive_select_1
    ```
=== "MySQL"
    ```mysql
    with recursive 
        recursive_select_1 as (
            select 
                id as id, 
                `name` as `name`, 
                parent_id as parentId 
            from company 
            where id = ? 
            
            union all 
            
            select 
                company.id as id, 
                company.`name` as `name`, 
                company.parent_id as parentId 
            from company 
            join recursive_select_1 on recursive_select_1.id = company.parent_id
        ) 
    select 
        id as id, 
        `name` as `name`, 
        parentId as parentId 
    from recursive_select_1
    ```
=== "Oracle"
    ```oracle
    with 
        recursive_select_1(id, name, parentId) as (
            select 
                id as id, 
                name as name, 
                parent_id as parentId 
            from company 
            where id = :0 
            
            union all 
            
            select 
                company.id as id, 
                company.name as name, 
                company.parent_id as parentId 
            from company 
            join recursive_select_1 on recursive_select_1.id = company.parent_id
        ) 
    select 
        id as "id", 
        name as "name", 
        parentId as "parentId" 
    from recursive_select_1
    ```
===+ "PostgreSQL"
    ```postgresql
    with recursive 
        recursive_select_1 as (
            select 
                id as id, 
                name as name, 
                parent_id as parentId 
            from company 
            where id = $1 
            
            union all 
            
            select 
                company.id as id, 
                company.name as name, 
                company.parent_id as parentId 
            from company 
            join recursive_select_1 on recursive_select_1.id = company.parent_id
        ) 
    select 
        id as id, 
        name as name, 
        parentId as "parentId" 
    from recursive_select_1
    ```
=== "SQLite"
    ```sqlite
    with recursive 
        recursive_select_1 as (
            select 
                id as id, 
                name as name, 
                parent_id as parentId 
            from company 
            where id = ? 
            
            union all 
            
            select 
                company.id as id, 
                company.name as name, 
                company.parent_id as parentId 
            from company 
            join recursive_select_1 on recursive_select_1.id = company.parent_id
        ) 
    select 
        id as id, 
        name as name, 
        parentId as parentId 
    from recursive_select_1
    ```
=== "SQL Server"
    ```sqlserver
    with 
        recursive_select_1 as (
            select 
                id as id, 
                name as name, 
                parent_id as parentId 
            from company 
            where id = @0 
            
            union all 
            
            select 
                company.id as id, 
                company.name as name, 
                company.parent_id as parentId 
            from company 
            join recursive_select_1 on recursive_select_1.id = company.parent_id
        ) 
    select 
        id as id, 
        name as name, 
        parentId as parentId 
    from recursive_select_1
    ```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const recursiveChildrenCompany: Promise<{
    id: number;
    name: string;
    parentId?: number;
}[]>
```

## Recursive connect by

[Oracle](../configuration/supported-databases/oracle.md) database supports an alternative syntax (additional to the previously mentioned) that can be more performant in some situations using the `start with` and `connect by` (or `connect by nocycle`) clauses.

<!-- doc-code-snippet-template: oracle -->
```ts
const recursiveChildrenCompany = await connection.selectFrom(tCompany)
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parentId: tCompany.parentId
    })
    .startWith(tCompany.id.equals(10)) // Optional: restricts the starting node
    .connectBy((prior) => { // You can use connectByNoCycle instead
        return prior(tCompany.id).equals(tCompany.parentId)
    })
    .orderBy('name')
    .orderingSiblingsOnly() // Optional: disables deep ordering
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    --
    --
    -- 
    -- 
    -- Only available in Oracle databases.
    --
    --
    --
    ```
=== "MySQL"
    ```mysql
    --
    --
    -- 
    -- 
    -- Only available in Oracle databases.
    --
    --
    --
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name", 
        parent_id as "parentId" 
    from company 
    start with id = :0 
    connect by prior id = parent_id 
    order siblings by "name"
    ```
===+ "PostgreSQL"
    ```postgresql
    --
    --
    -- 
    -- 
    -- Only available in Oracle databases.
    --
    --
    --
    ```
=== "SQLite"
    ```sqlite
    --
    --
    -- 
    -- 
    -- Only available in Oracle databases.
    --
    --
    --
    ```
=== "SQL Server"
    ```sqlserver
    --
    --
    -- 
    -- 
    -- Only available in Oracle databases.
    --
    --
    --
    ```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const recursiveParentCompany: Promise<{
    id: number;
    name: string;
    parentId?: number;
}[]>
```

## `UNION` vs `UNION ALL` inside a recursive CTE

The examples on this page use `recursiveUnionAll` / `recursiveUnionAllOn` because every supported database accepts `UNION ALL` between the anchor and recursive members of a recursive CTE — the same TypeScript code runs on every backend.

The shorter `recursiveUnion` / `recursiveUnionOn` variants emit a plain `UNION` (deduplicating each iteration's output). Use them when you actually need per-iteration deduplication; `UNION ALL` is usually the right default for traversal queries because the join condition already prevents revisiting the same row.

!!! warning "Limitation"

    [Oracle](../configuration/supported-databases/oracle.md) and [SQL Server](../configuration/supported-databases/sqlserver.md) only accept `UNION ALL` between the anchor and recursive members of a recursive CTE (Oracle raises `ORA-32040 — missing UNION ALL in recursive WITH clause element`; SQL Server raises `Incorrect syntax near 'UNION'`). To prevent emitting SQL the engine will reject at runtime, `ts-sql-query` types `recursiveUnion` / `recursiveUnionOn` as `never` on those connections, so calling them is a TypeScript error — the compiler steers you to `recursiveUnionAll` / `recursiveUnionAllOn`. The plain `recursiveUnion` / `recursiveUnionOn` variants remain available on [MariaDB](../configuration/supported-databases/mariadb.md), [MySQL](../configuration/supported-databases/mysql.md), [PostgreSQL](../configuration/supported-databases/postgresql.md) and [SQLite](../configuration/supported-databases/sqlite.md).
