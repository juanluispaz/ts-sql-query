---
search:
  boost: 0.12
---
# FAQs

## How does ts-sql-query model queries?

Writing a query in `ts-sql-query` closely mirrors SQL, so you can anticipate the SQL it generates. Its design is inspired by [SQLite](../configuration/supported-databases/sqlite.md) and [PostgreSQL](../configuration/supported-databases/postgresql.md), and when JavaScript or TypeScript have an idiomatic way to express something, `ts-sql-query` tries to reflect it.

`ts-sql-query` executes the query in a single call to the database, in the same way you write it, and no intermediate data is processed in your backend. The exception is the [select page](../queries/select-page.md), where a first query returns the data of the page, and a second one gets the count. The statements of a [transaction](../queries/transaction.md) go on their own too.

## Can I generate the Tables/Views models from my database?

Yes, you can use [ts-sql-codegen](https://github.com/lorefnon/ts-sql-codegen), a utility that generates table mapper classes for `ts-sql-query` by inspecting a database through [tbls](https://github.com/k1LoW/tbls).

## Does ts-sql-query support dynamic SQL?

Yes. You write one query with every part that can vary, and the library writes the SQL with only what applies: a condition disappears when it has no value, the filter can arrive as an object, the caller can choose the columns, and a function can return the type of what was asked for. See [What a dynamic query can do](../dynamic/building-blocks.md) and [Dynamic queries](../queries/dynamic-queries.md#dynamic-queries).

Write the query in this declarative way first, so it can still be read as a query. Your own `if`s are for the cases that need them, when what to add depends on logic that those methods can't express: see [Building a condition step by step](../dynamic/going-further/building-conditions.md).

## Does ts-sql-query support database-specific features?

Yes, and they are checked at compile time: if you try to use one of them and your database doesn't have it, you get a compilation error.

## Will ts-sql-query constrain you when you need a feature it doesn't support?

For most cases, no: [SQL fragments](../queries/sql-fragments.md) let you write that part of the query in SQL, keeping the types in the rest. See also [Limitations](limitations.md).

## How can I implement select for update?

`select ... for update` locks the selected rows until the end of the transaction. `ts-sql-query` has no method for it, but you can [customize the select](../queries/sql-fragments.md#customizing-a-select) to add it to the SQL. The text goes to the database as you write it, so write what your database accepts:

```ts
const customizedSelect = connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(10))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    }).customizeQuery({
        afterQuery: connection.rawFragment`for update`
    })
    .executeSelectOne()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ? for update
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ? for update
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as "birthday" 
    from customer 
    where id = :0 for update
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as birthday 
    from customer 
    where id = $1 for update
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?1 for update
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = @0 for update
    ```

The parameters are: `[ 10 ]`

## Does ts-sql-query support common table expressions (CTE)?

Yes, you can read how to use it here: [A select used as a view (the with clause)](../queries/cte-subqueries.md#a-select-used-as-a-view-the-with-clause).

## How to do a left join?

To use a table or view in a left join, you must mark it for use in a left join to define the types properly. You can read how to use it here: [Select with left join](../queries/select.md#select-with-left-join).

## How to do a left join of a select in a with clause?

First, you must mark the query **for use in query** and then **for use in left join**. See [Left join with a view](../queries/cte-subqueries.md#left-join-with-a-view) for the query that uses it. Example:

```ts
const customerCountPerCompanyWith = connection.selectFrom(tCompany)
    .innerJoin(tCustomer).on(tCustomer.companyId.equals(tCompany.id))
    .select({
        companyId: tCompany.id,
        companyName: tCompany.name,
        customerCount: connection.count(tCustomer.id)
    }).groupBy('companyId', 'companyName')
    .forUseInQueryAs('customerCountPerCompany')
    .forUseInLeftJoin();
```

## Where can I see all functions/methods provided by ts-sql-query?

You can see them here: [API](../api/introduction.md). If you know the SQL keyword, the [keywords](../keywords/select.md) tables say what writes it in the library.

## How can I organize my code to reuse some queries in different places?

You can create functions that return the prebuilt query you want to reuse, omitting the function's return type so TypeScript infers it. With [The order of the clauses](../queries/select.md#the-order-of-the-clauses) that `ts-sql-query` offers, each caller can add the `where` at the end (in SQL it's generated in the proper place):

<!-- doc-code-snippet-result: { id: 10, name: 'ACME', numberOfCustomers: 3 } -->
```ts
function buildNumberOfCustomersSubquery(connection: DBConnection) {
    return connection
        .subSelectUsing(tCompany)
        .from(tCustomer)
        .where(tCustomer.companyId.equals(tCompany.id))
        .selectCountAll()
        .forUseAsInlineQueryValue();
}

function buildCompaniesWithNumberOfCustomersQuery(connection: DBConnection) {
    return connection.selectFrom(tCompany)
        .select({
            id: tCompany.id,
            name: tCompany.name,
            numberOfCustomers: buildNumberOfCustomersSubquery(connection)
        })
}

const companyInfo = await buildCompaniesWithNumberOfCustomersQuery(connection)
    .where(tCompany.id.equals(10))
    .executeSelectOne()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name, 
        (select count(*) as result from customer where company_id = company.id) as numberOfCustomers 
    from company 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        name as name, 
        (select count(*) as result from customer where company_id = company.id) as numberOfCustomers 
    from company 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name", 
        (select count(*) as "result" from customer where company_id = company.id) as "numberOfCustomers" 
    from company 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name, 
        (select count(*) as result from customer where company_id = company.id) as "numberOfCustomers" 
    from company 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name, 
        (select count(*) as result from customer where company_id = company.id) as numberOfCustomers 
    from company 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name, 
        (select count(*) as result from customer where company_id = company.id) as numberOfCustomers 
    from company 
    where id = @0
    ```

The parameters are: `[ 10 ]`

!!! tip

    If you need to use table or view with alias you can pass it as parameter to the functions. See [Passing tables and views as parameter](../advanced/tables-views-as-parameter.md) for more information.

## How can I use select * in my queries?

You can't, on purpose. `select *` is useful in a query you write to look at the data, but dangerous in a backend, because the backend and the database aren't always in sync. While you deploy a version that changes the database, for example, the query can return a column the backend doesn't know, or an expected column can disappear. With `select *` the backend misbehaves without saying why; with the columns listed, you get a clear error.

To get all the columns the backend knows, pass the table to `select`: `.select(tCustomer)`. The SQL lists each column by its name. To leave some out, use `extractColumnsFrom`. See [Select all the columns of a table](../advanced/columns-from-object.md#select-all-the-columns-of-a-table) and [Extract columns](../advanced/columns-from-object.md#extract-columns).
