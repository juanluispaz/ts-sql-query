---
search:
  boost: 3
---
# Select page

This feature provides a convenient way to retrieve paginated data along with the total number of matching rows. Internally, it executes two SQL queries: one for fetching the page of data and another for counting all rows that match the same filter conditions. This is especially useful for implementing efficient and consistent pagination in user interfaces.

!!! success "Executed queries"

    The `executeSelectPage()` method runs the query **twice** behind the scenes:

    - The first execution fetches the **current page** of data, applying the specified `LIMIT`, `OFFSET`, and `ORDER BY` clauses.
    - The second execution runs the **same query without pagination**, in order to count the **total number of matching rows**.

    This dual-query strategy ensures consistent pagination, which is particularly useful for displaying data in user interfaces with accurate page controls (e.g., “Showing 21–30 of 146 results”).

```ts
const customerName = 'Smi'

const customerPageWithName = connection.selectFrom(tCustomer)
    .where(
        tCustomer.firstName.startsWithInsensitive(customerName)
    ).or(
        tCustomer.lastName.startsWithInsensitive(customerName)
    ).select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .orderBy('firstName')
    .orderBy('lastName')
    .limit(10)
    .offset(20)
    .executeSelectPage();
```

The executed query to get the data is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where 
           lower(first_name) like concat(lower(?), '%') 
        or lower(last_name) like concat(lower(?), '%') 
    order by 
        firstName, 
        lastName 
    limit ? 
    offset ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where 
           lower(first_name) like concat(lower(?), '%') 
        or lower(last_name) like concat(lower(?), '%') 
    order by 
        firstName, 
        lastName 
    limit ? 
    offset ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where 
           lower(first_name) like lower(:0 || '%') escape '\\' 
        or lower(last_name) like lower(:1 || '%') escape '\\' 
    order by 
        "firstName", 
        "lastName" 
    offset :2 rows 
    fetch next :3 rows only
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where 
           first_name ilike ($1 || '%') 
        or last_name ilike ($2 || '%') 
    order by 
        "firstName", 
        "lastName" 
    limit $3 
    offset $4
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where 
           lower(first_name) like lower(? || '%') escape '\\' 
        or lower(last_name) like lower(? || '%') escape '\\' 
    order by 
        firstName, 
        lastName 
    limit ? 
    offset ?
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where 
           lower(first_name) like lower(@0 + '%') 
        or lower(last_name) like lower(@1 + '%') 
    order by 
        firstName, 
        lastName 
    offset @2 rows 
    fetch next @3 rows only
    ```

And its parameters are: `[ 'Smi', 'Smi', 10, 20 ]`

The executed query to get the count is:

=== "MariaDB"
    ```mariadb
    select count(*) 
    from customer 
    where 
           lower(first_name) like concat(lower(?), '%') 
        or lower(last_name) like concat(lower(?), '%')
    ```
=== "MySQL"
    ```mysql
    select count(*) 
    from customer 
    where 
           lower(first_name) like concat(lower(?), '%') 
        or lower(last_name) like concat(lower(?), '%')
    ```
=== "Oracle"
    ```oracle
    select count(*) 
    from customer 
    where 
           lower(first_name) like lower(:0 || '%') escape '\\' 
        or lower(last_name) like lower(:1 || '%') escape '\\'
    ```
===+ "PostgreSQL"
    ```postgresql
    select count(*) 
    from customer 
    where 
           first_name ilike ($1 || '%') 
        or last_name ilike ($2 || '%')
    ```
=== "SQLite"
    ```sqlite
    select count(*) 
    from customer 
    where 
           lower(first_name) like lower(? || '%') escape '\\' 
        or lower(last_name) like lower(? || '%') escape '\\'
    ```
=== "SQL Server"
    ```sqlserver
    select count(*) 
    from customer 
    where 
           lower(first_name) like lower(@0 + '%') 
        or lower(last_name) like lower(@1 + '%')
    ```

And its parameters are: `[ 'Smi', 'Smi' ]`

The result type is:
```tsx
const customerPageWithName: Promise<{
    data: {
        id: number;
        firstName: string;
        lastName: string;
    }[];
    count: number;
}>
```
