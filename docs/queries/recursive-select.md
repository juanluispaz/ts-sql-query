---
search:
  boost: 3
---
# Recursive select

A recursive select reads its own results to find more rows. It's the way to walk data that points to itself when you don't know how many levels there are: a company and its parent company, a tree of categories, an organization chart, or a graph of connected nodes. It answers questions like "all the companies above this one", "everything below this category", or "what can be reached from this node".

Don't confuse it with a join: each join goes one level further, so you need to know how many levels there are when you write the query. A recursive select keeps going until there are no more levels.

The databases run it as a [Common Table Expression](cte-subqueries.md#a-select-used-as-a-view-the-with-clause), the SQL `with` clause (`with recursive` in most of them). The result is an ordinary list of rows, not a nested structure.

## How it works

A recursive select has two parts:

1. **The starting rows:** the select you write first.
2. **The part that repeats:** a select joined with the rows found in the previous step, to find the next level.

The part that repeats only sees the rows of the previous step, not all the rows found so far. It stops when a step finds no new rows. The result is all the rows found, together.

For example, with these companies, starting at company 1 and looking for children:

| `id` | `name` | `parentId` |
|---|---|---|
| 1 | Acme | |
| 2 | Acme Europe | 1 |
| 3 | Acme Spain | 2 |
| 4 | Acme France | 2 |

| Step | Rows found |
|---|---|
| Starting rows | 1 |
| First repetition | 2, its parent is 1 |
| Second repetition | 3 and 4, their parent is 2 |
| Third repetition | None, so it stops |

The result is the rows `1, 2, 3, 4`.

The join condition says which way the walk goes. The function receives a view with the rows of the previous step, with the properties of your select as its columns. The name of its parameter is your choice:

- **Looking for parents:** the current row is the parent of the previous one, `child.parentId.equals(tCompany.id)`.
- **Looking for children:** the current row is a child of the previous one, `parent.id.equals(tCompany.parentId)`.

The `where` belongs to the starting rows. Without a `where`, every row of the table is a starting row.

## Which method to use

| Method | The function returns | Rows repeated in the result |
|---|---|---|
| `recursiveUnionAll` | The select that repeats | Kept |
| `recursiveUnionAllOn` | Only the join condition | Kept |
| `recursiveUnion` | The select that repeats | Removed |
| `recursiveUnionOn` | Only the join condition | Removed |

**With or without `On`:** the `On` methods repeat your first select with the same columns, tables and joins, and add the join with the previous step; they don't repeat its `where`. Use the methods without `On` when the part that repeats is different: it has a `where` of its own, it returns a different value in a column, or it reads another table, as a graph whose links are in their own table does. Both parts must return the same columns.

**With or without `All`:** see [`UNION` vs `UNION ALL`](#union-or-union-all). `recursiveUnion` and `recursiveUnionOn` aren't offered on every database: see [the availability](#availability-in-each-database).

If the join condition is made only of `*IfValue` conditions and none has a value, nothing links one level with the next, and the promise of the execute method rejects with the error `MISSING_RECURSIVE_CONDITION` ([library raised errors](../api/error-management/library-raised-errors.md)).

## Recursive select looking for parents

All the companies above company 10, starting with itself:

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
            where id = ?1 
    
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
            where id = ?1 
            
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

Company 10 and all the companies below it:

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
            where id = ?1 
    
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
            where id = ?1 
            
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

## Union or union all

These are the same operators of a [compound select](compound-select.md#what-each-operator-does), but here the difference decides what the walk does:

- **`recursiveUnionAll`, `recursiveUnionAllOn`** (`union all`) keep every row found. A row reached by two different paths comes back twice. In a tree starting from one row, that can't happen, so nothing is repeated. It's the usual choice: there is nothing to compare, and it works on every database.
- **`recursiveUnion`, `recursiveUnionOn`** (`union`) discard a row that is the same as one already found, in any previous step, comparing all its columns. A discarded row isn't used for the next step, so the walk doesn't go through it again. Use them to walk a graph, where several paths lead to the same row, or data that can have a cycle.

!!! warning "Limitation"

    [Oracle](../configuration/supported-databases/oracle.md) and [SQL Server](../configuration/supported-databases/sqlserver.md) only accept `UNION ALL` between the anchor and recursive members of a recursive CTE (Oracle raises `ORA-32040 — missing UNION ALL in recursive WITH clause element`; SQL Server raises `Incorrect syntax near 'UNION'`). To prevent emitting SQL the engine will reject at runtime, `ts-sql-query` types `recursiveUnion` / `recursiveUnionOn` as `never` on those connections, so calling them is a TypeScript error — the compiler steers you to `recursiveUnionAll` / `recursiveUnionAllOn`. The plain `recursiveUnion` / `recursiveUnionOn` variants remain available on [MariaDB](../configuration/supported-databases/mariadb.md), [MySQL](../configuration/supported-databases/mysql.md), [PostgreSQL](../configuration/supported-databases/postgresql.md) and [SQLite](../configuration/supported-databases/sqlite.md).

## Cycles

A cycle is a row that ends up being its own ancestor: company 1 has company 2 as its parent, and company 2 has company 1 as its parent. A tree has no cycles, but a graph can have them, and so can data with a mistake in it.

With a cycle, the walk finds the same rows again and again, so a step always finds something:

| Step | Row found | `recursiveUnion` | `recursiveUnionAll` |
|---|---|---|---|
| Starting rows | 1 | Kept | Kept |
| First repetition | 2 | Kept | Kept |
| Second repetition | 1 | Already found: discarded, so it stops | Kept |
| Third repetition | 2 | | Kept, and it goes on |

With `union all`, the query never ends, or the database aborts it with an error when it reaches a limit of its own. The library doesn't protect you from this, because it sends the query you asked for. These are the ways to protect a query from a cycle:

**`recursiveUnion` or `recursiveUnionOn`**, where they're available:

```ts
const companies = await connection.selectFrom(tCompany)
    .where(tCompany.id.equals(1))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parentId: tCompany.parentId
    }).recursiveUnionOn((parent) => {
        return parent.id.equals(tCompany.parentId)
    }).orderBy('id')
    .executeSelectMany()
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
    
            union 
    
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
    order by id
    ```
=== "MySQL"
    ```mysql
    with recursive 
        recursive_select_1 as ( 
            select 
                id as id, 
                name as name, 
                parent_id as parentId 
            from company 
            where id = ? 
    
            union 
    
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
    order by id
    ```
=== "Oracle"
    ```oracle
    -- Oracle only accepts `union all` in a recursive select: use recursiveUnionAllOn
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
    
            union 
    
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
    order by id
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
            where id = ?1 
    
            union 
    
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
    order by id
    ```
=== "SQL Server"
    ```sqlserver
    -- SQL Server only accepts `union all` in a recursive select: use recursiveUnionAllOn
    ```

The parameters are: `[ 1 ]`

With the cycle above, it returns the companies 1 and 2, once each. It only works if the row is really the same: a column that changes in each step, like the level of the next section, makes every row different, and `union` no longer stops the walk.

**A limit on the depth**: see the next section. It doesn't work on Oracle, which rejects the query with the error `ORA-32044` when it finds a cycle in a recursive `with`, even if the depth is limited.

**`connectByNoCycle`**, on Oracle: see [Recursive connect by](#recursive-connect-by).

## Knowing the level and limiting the depth

To know how deep each row is, add a column that starts with a value and grows in the part that repeats. That is a different value in the two parts, so you need `recursiveUnionAll` or `recursiveUnion`, without `On`. A `where` over that column is what limits the depth:

```ts
const companies = await connection.selectFrom(tCompany)
    .where(tCompany.id.equals(1))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        level: connection.const(1, 'int')
    }).recursiveUnionAll((parent) => {
        return connection.selectFrom(tCompany)
            .join(parent).on(parent.id.equals(tCompany.parentId))
            .where(parent.level.lessThan(3))
            .select({
                id: tCompany.id,
                name: tCompany.name,
                level: parent.level.add(1)
            })
    }).orderBy('level')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    with recursive 
        recursive_select_1 as ( 
            select 
                id as id, 
                name as name, 
                ? as level 
            from company 
            where id = ? 
    
            union all 
    
            select 
                company.id as id, 
                company.name as name, 
                recursive_select_1.level + ? as level 
            from company 
            join recursive_select_1 on recursive_select_1.id = company.parent_id 
            where recursive_select_1.level < ? 
        ) 
    select 
        id as id, 
        name as name, 
        level as level 
    from recursive_select_1 
    order by level
    ```
=== "MySQL"
    ```mysql
    with recursive 
        recursive_select_1 as ( 
            select 
                id as id, 
                name as name, 
                ? as level 
            from company 
            where id = ? 
    
            union all 
    
            select 
                company.id as id, 
                company.name as name, 
                recursive_select_1.level + ? as level 
            from company 
            join recursive_select_1 on recursive_select_1.id = company.parent_id 
            where recursive_select_1.level < ? 
        ) 
    select 
        id as id, 
        name as name, 
        level as level 
    from recursive_select_1 
    order by level
    ```
=== "Oracle"
    ```oracle
    with 
        recursive_select_1(id, name, "level") as ( 
            select 
                id as id, 
                name as name, 
                :0 as "level" 
            from company 
            where id = :1 
    
            union all 
    
            select 
                company.id as id, 
                company.name as name, 
                recursive_select_1."level" + :2 as "level" 
            from company 
            join recursive_select_1 on recursive_select_1.id = company.parent_id 
            where recursive_select_1."level" < :3 
        ) 
    select 
        id as "id", 
        name as "name", 
        "level" as "level" 
    from recursive_select_1 
    order by "level"
    ```
===+ "PostgreSQL"
    ```postgresql
    with recursive 
        recursive_select_1 as ( 
            select 
                id as id, 
                name as name, 
                $1::int4 as level 
            from company 
            where id = $2 
    
            union all 
    
            select 
                company.id as id, 
                company.name as name, 
                recursive_select_1.level + $3 as level 
            from company 
            join recursive_select_1 on recursive_select_1.id = company.parent_id 
            where recursive_select_1.level < $4 
        ) 
    select 
        id as id, 
        name as name, 
        level as level 
    from recursive_select_1 
    order by level
    ```
=== "SQLite"
    ```sqlite
    with recursive 
        recursive_select_1 as ( 
            select 
                id as id, 
                name as name, 
                ?1 as level 
            from company 
            where id = ?2 
    
            union all 
    
            select 
                company.id as id, 
                company.name as name, 
                recursive_select_1.level + ?3 as level 
            from company 
            join recursive_select_1 on recursive_select_1.id = company.parent_id 
            where recursive_select_1.level < ?4 
        ) 
    select 
        id as id, 
        name as name, 
        level as level 
    from recursive_select_1 
    order by level
    ```
=== "SQL Server"
    ```sqlserver
    with 
        recursive_select_1 as ( 
            select 
                id as id, 
                name as name, 
                @0 as level 
            from company 
            where id = @1 
    
            union all 
    
            select 
                company.id as id, 
                company.name as name, 
                recursive_select_1.level + @2 as level 
            from company 
            join recursive_select_1 on recursive_select_1.id = company.parent_id 
            where recursive_select_1.level < @3 
        ) 
    select 
        id as id, 
        name as name, 
        level as level 
    from recursive_select_1 
    order by level
    ```

The parameters are: `[ 1, 1, 1, 3 ]`

It returns up to three levels, and the query always ends: when no row of the previous step has a level below 3, the step finds nothing. With a cycle, the rows of the cycle appear several times, once per level.

The same `where`, over the table instead of the view, is the way to prune the walk: a row that doesn't pass it isn't returned, and the walk doesn't go on through it.

## Ordering and limiting the result

The order of the rows isn't defined unless you ask for it; in particular, don't expect the rows to come level by level. The `orderBy`, `limit` and `offset` written after the recursive method apply to the whole result, not to the starting rows, and `orderBy` receives the name of a property of the select, as `orderBy('level')` above. To sort by level, you need a column with the level.

## Using a recursive select in other queries

- **As a view of another select:** `forUseInQueryAs`, the same as any other select. See [Using a select as a view](cte-subqueries.md#a-select-used-as-a-view-the-with-clause).
- **As a value of another select:** `forUseAsInlineQueryValue`, and `forUseAsInlineAggregatedArrayValue` to receive the rows as an array. See [Recursive query as an inline array of objects](aggregate-as-object-array.md#recursive-query-as-an-inline-array-of-objects), and its limitation when referencing an outer table.
- **As a page:** `executeSelectPage` returns the requested rows, and the count of the whole result.

`customizeQuery` written on a recursive select customizes the whole query, and [`projectingOptionalValuesAsNullable`](basic-query-structure.md#projecting-optional-values) goes right after `select`, before the recursive method.

## Recursive connect by

[Oracle](../configuration/supported-databases/oracle.md) has an alternative syntax, in addition to the recursive selects above, that can be more performant in some situations. You write one select, with the `start with` and `connect by` clauses, instead of two parts:

| Method | SQL | What it does |
|---|---|---|
| `startWith` | `start with` | The condition of the starting rows. It's optional: without it, every row of the table is a starting row, so a row comes back once per ancestor it has, plus itself |
| `connectBy` | `connect by` | The condition that links a row with the previous level, which receives the `prior` function |
| `connectByNoCycle` | `connect by nocycle` | The same as `connectBy`, for data that can have a [cycle](#cycles): it doesn't follow the row that closes the cycle, where `connectBy` makes Oracle raise an error |
| `orderingSiblingsOnly` | `order siblings by` | After an `orderBy`: orders only the rows with the same parent, and keeps each row below its parent |

`prior(column)` is the column of the row of the previous level, so `prior` says which way the walk goes:

- **Looking for children:** `prior(tCompany.id).equals(tCompany.parentId)`, as in the example.
- **Looking for parents:** `prior(tCompany.parentId).equals(tCompany.id)`.

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
const recursiveChildrenCompany: Promise<{
    id: number;
    name: string;
    parentId?: number;
}[]>
```

Two things work differently from the recursive selects above:

- **The `where` applies at the end, not to the starting rows:** the walk first finds all the rows, and then the `where` removes some. The rows below a removed row stay in the result. The condition of the starting rows goes in `startWith`.
- **Without `orderBy`, the rows come in the order of the walk:** each row followed by the rows below it. A plain `orderBy`, without `orderingSiblingsOnly`, sorts the whole result and that order is lost.

`startWith`, `connectBy` and `connectByNoCycle` can be written before or after `select`, like `where`. If all the conditions of `connectBy` are `*IfValue` without a value, the promise of the execute method rejects with the error `MISSING_RECURSIVE_CONDITION`.

## Availability in each database

| Database | `recursiveUnionAll`, `recursiveUnionAllOn` | `recursiveUnion`, `recursiveUnionOn` | `startWith`, `connectBy`, `connectByNoCycle`, `orderingSiblingsOnly` |
|---|---|---|---|
| PostgreSQL | Yes | Yes | Not offered |
| SQLite | Yes | Yes | Not offered |
| SQL Server | Yes | Not offered | Not offered |
| Oracle | Yes | Not offered | Yes |
| MariaDB | Yes | Yes | Not offered |
| MySQL | From MySQL 8.0.1 | From MySQL 8.0.1 | Not offered |

A method that is not offered doesn't compile on that connection. On MySQL, with a [`compatibilityVersion`](../configuration/supported-databases/mysql.md) below `8_000_000`, the promise of the execute method rejects with the error `UNSUPPORTED_QUERY`, and nothing is sent.
