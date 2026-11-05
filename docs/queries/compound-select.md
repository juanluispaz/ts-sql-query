---
search:
  boost: 3
---
# Compound select

A compound operator combines the rows of two selects into a single result: the rows of one select are put with the rows of the other one. It's the way to answer questions like "all the customers and all the companies in a single list", or "the customers that are also suppliers".

Don't confuse it with a join: a join puts together **columns** of related rows, side by side, while a compound operator works with whole **rows**, so both selects must return the same columns.

## What each operator does

Two rows are the same when all their columns have the same value, and in this comparison two nulls are taken as the same value. Without `All`, the operator removes the duplicated rows from the result; with `All`, it keeps them.

These are the results when the first select returns the rows `1, 2, 2, 2, 3` and the second one returns `2, 2, 3, 4`:

| Operator | What it returns | SQL | Result |
|---|---|---|---|
| `union` | The rows of both selects, without duplicates | `union` | `1, 2, 3, 4` |
| `unionAll` | The rows of both selects, all of them | `union all` | `1, 2, 2, 2, 3, 2, 2, 3, 4` |
| `intersect` | The rows that are in both selects, without duplicates | `intersect` | `2, 3` |
| `intersectAll` | The rows that are in both selects, as many times as they are in both | `intersect all` | `2, 2, 3` |
| `except` | The rows of the first select that aren't in the second one, without duplicates | `except` | `1` |
| `exceptAll` | The rows of the first select, each one removed as many times as it is in the second one | `except all` | `1, 2` |

`minus` and `minusAll` are other names for `except` and `exceptAll`.

!!! tip

    Use `unionAll` when the rows can't be repeated, or when you want them all: to remove the duplicates, the database needs to compare all the rows.

## Combining two selects

All the customers and all the companies in a single list. A customer and a company can have the same id and the same name, but the `type` column makes them different rows, so `unionAll` is enough:

```ts
const allDataWithName = connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        name: tCustomer.firstName.concat(' ').concat(tCustomer.lastName),
        type: connection.const<'customer' | 'company'>('customer', 'enum', 'customerOrCompany')
    }).unionAll(
        connection.selectFrom(tCompany)
        .select({
            id: tCompany.id,
            name: tCompany.name,
            type: connection.const<'customer' | 'company'>('company', 'enum', 'customerOrCompany')
        })
    ).executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        concat(first_name, ?, last_name) as name, 
        ? as type 
    from customer 
    
    union all 
    
    select 
        id as id, 
        name as name, 
        ? as type 
    from company
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        concat(first_name, ?, last_name) as `name`, 
        ? as `type` 
    from customer 
    
    union all 
    
    select 
        id as id, 
        `name` as `name`, 
        ? as `type` 
    from company
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name || :0 || last_name as "name", 
        :1 as "type" 
    from customer 
    
    union all 
    
    select 
        id as "id", 
        name as "name", 
        :2 as "type" 
    from company
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name || $1 || last_name as name, 
        $2 as type 
    from customer 
    
    union all 
    
    select 
        id as id, 
        name as name, 
        $3 as type 
    from company
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name || ?1 || last_name as name, 
        ?2 as type 
    from customer 
    
    union all 
    
    select 
        id as id, 
        name as name, 
        ?3 as type 
    from company
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name + @0 + last_name as name, 
        @1 as type 
    from customer 
    
    union all 
    
    select 
        id as id, 
        name as name, 
        @2 as type 
    from company
    ```

The parameters are: `[ ' ', 'customer', 'company' ]`

The result type is:
```tsx
const allDataWithName: Promise<{
    id: number;
    name: string;
    type: "customer" | "company";
}[]>
```

!!! warning

    The selects must have the same properties, with the same name and a compatible type; if not, the query doesn't compile.

## Ordering the combined result

The order of the rows of a compound select isn't defined unless you ask for it. The `orderBy`, `limit` and `offset` written after the operator apply to the combined result, not to the last select, and `orderBy` receives the name of a property of the select:

```ts
const firstNames = await connection.selectFrom(tCustomer)
    .select({ id: tCustomer.id, name: tCustomer.firstName })
    .unionAll(
        connection.selectFrom(tCompany)
            .select({ id: tCompany.id, name: tCompany.name })
    ).orderBy('name')
    .limit(10)
    .executeSelectMany();
```

## Combining more than two selects

The operators can be chained, and they compose as they are written in the code:

- `a.union(b).intersect(c)` is `(a union b) intersect c`.
- `a.except(b.union(c))` is `a except (b union c)`.

The databases don't all read a chain of operators in the same way, so the library groups the selects in the SQL when it's needed, and the result is the same in all of them.

## Availability in each database

| Database | `union`, `unionAll` | `intersect`, `except`, `minus` | `intersectAll`, `exceptAll`, `minusAll` |
|---|---|---|---|
| PostgreSQL | Yes | Yes | Yes |
| SQLite | Yes | Yes | Not offered |
| SQL Server | Yes | Yes | Not offered |
| Oracle | Yes | Yes, written as `minus` for `except` | Yes, written as `minus all` for `exceptAll` |
| MariaDB | Yes | From MariaDB 10.3 | From MariaDB 10.5 |
| MySQL | Yes | From MySQL 8.0.31 | From MySQL 8.0.31 |

An operator that is not offered doesn't compile on that connection. On an older version than the one in the table, the database rejects the query.
