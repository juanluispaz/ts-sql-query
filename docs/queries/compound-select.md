---
search:
  boost: 3
---
# Compound select

This page explains how to combine the result of several selects with the operators `union`, `intersect` and `except`.

## Select with a compound operator (union, intersect, except)

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

    All combined queries in a compound operator must return the same number of columns with compatible types and matching column names.

!!! note

    Depending on your database, the supported compound operators are: `union`, `unionAll`, `intersect`, `intersectAll`, `except`,  `exceptAll`, `minus` (alias for `except`), `minusAll` (alias for `exceptAll`)
