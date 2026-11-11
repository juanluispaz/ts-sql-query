---
search:
  boost: 0.7
---
# Passing tables and views as parameter

A function that builds a part of a query, like a subquery or a condition, may need a table of that query. If the query uses the table itself, the function can use `tCompany` directly. When the query uses an alias of the table, like `tCompany.as('company')`, or the table prepared for a left join, the function has to receive that object, and the parameter needs a type:

| The query uses | The type of the parameter |
|---|---|
| `tCompany`, or an alias of it | `TableOrViewOf<typeof tCompany>` |
| `tCompany.as('company')` | `TableOrViewOf<typeof tCompany, 'company'>` |
| `tCompany.forUseInLeftJoin()`, or an alias of it | `TableOrViewLeftJoinOf<typeof tCompany>` |
| `tCompany.forUseInLeftJoinAs('company')` | `TableOrViewLeftJoinOf<typeof tCompany, 'company'>` |

The first argument is the table or view, and the second one, optional, is its alias. A [`Values`](../api/constant-values-view.md) works the same way: `TableOrViewOf<typeof projectNames, 'names'>` for `projectNames.as('names')`, and `fromRef(projectNames, ref)` or `fromRef(VProjectName, ref)` with its class.

These types are only a reference: they don't have the columns. To reach them, `fromRef` converts the reference into the table. Its first argument is the table or view (or its class), and the second one is the reference. At run time it returns the reference as it is. The reference must be of that table or view: with a reference of another one, the call doesn't compile.

<!-- doc-code-snippet-result: { id: 10, name: 'ACME', numberOfCustomers: 3 } -->
```ts
import { fromRef, type TableOrViewOf } from 'ts-sql-query'

function buildNumberOfCustomersSubquery<COMPANY extends TableOrViewOf<typeof tCompany, 'company'>>(connection: DBConnection, companyRef: COMPANY) {
    const company = fromRef(tCompany, companyRef);

    return connection
        .subSelectUsing(company)
        .from(tCustomer)
        .where(tCustomer.companyId.equals(company.id))
        .selectCountAll()
        .forUseAsInlineQueryValue();
}

const company = tCompany.as('company');

const companyInfo = await connection.selectFrom(company)
    .select({
        id: company.id,
        name: company.name,
        numberOfCustomers: buildNumberOfCustomersSubquery(connection, company)
    })
    .where(company.id.equals(10))
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as id, 
        company.name as name, 
        (select count(*) as result from customer where company_id = company.id) as numberOfCustomers 
    from company as company 
    where company.id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as id, 
        company.name as name, 
        (select count(*) as result from customer where company_id = company.id) as numberOfCustomers 
    from company as company 
    where company.id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "id", 
        company.name as "name", 
        (select count(*) as "result" from customer where company_id = company.id) as "numberOfCustomers" 
    from company company 
    where company.id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id, 
        company.name as name, 
        (select count(*) as result from customer where company_id = company.id) as "numberOfCustomers" 
    from company as company 
    where company.id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as id, 
        company.name as name, 
        (select count(*) as result from customer where company_id = company.id) as numberOfCustomers 
    from company as company 
    where company.id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as id, 
        company.name as name, 
        (select count(*) as result from customer where company_id = company.id) as numberOfCustomers 
    from company as company 
    where company.id = @0
    ```

The parameters are: `[ 10 ]`

## Passing a table prepared for a left join

With `TableOrViewLeftJoinOf`, the columns that `fromRef` returns are optional, as in any [left join](../queries/select.md#select-with-left-join):

```ts
import { fromRef, type TableOrViewLeftJoinOf } from 'ts-sql-query'

function buildCompanyProjection<COMPANY extends TableOrViewLeftJoinOf<typeof tCompany, 'company'>>(companyRef: COMPANY) {
    const company = fromRef(tCompany, companyRef);

    return {
        id: company.id,
        name: company.name
    };
}

const company = tCompany.forUseInLeftJoinAs('company');

const customers = await connection.selectFrom(tCustomer)
    .leftJoin(company).on(company.id.equals(tCustomer.companyId))
    .select({
        id: tCustomer.id,
        company: buildCompanyProjection(company)
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        company.id as `company.id`, 
        company.name as `company.name` 
    from customer 
    left join company as company on company.id = customer.company_id
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        company.id as `company.id`, 
        company.name as `company.name` 
    from customer 
    left join company as company on company.id = customer.company_id
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        company.id as "company.id", 
        company.name as "company.name" 
    from customer 
    left join company company on company.id = customer.company_id
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        company.id as "company.id", 
        company.name as "company.name" 
    from customer 
    left join company as company on company.id = customer.company_id
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        company.id as "company.id", 
        company.name as "company.name" 
    from customer 
    left join company as company on company.id = customer.company_id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        company.id as [company.id], 
        company.name as [company.name] 
    from customer 
    left join company as company on company.id = customer.company_id
    ```

The parameters are: `[]`
