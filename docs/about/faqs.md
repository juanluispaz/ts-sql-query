---
search:
  boost: 0.12
---
# FAQs

## How ts-sql-query modelate the queries?

ts-sql-query try to modelate the queries keeping the essence of SQL; the queries are designed after SQLite and PostgreSQL but keeping in mind it needs to be understandable in a TypeScript/JavaScript context. So when TypeScript/JavaScript do things in a way, ts-sql-query tries to preserve it (it is a tricky balance). The consequence of this modelling philosophy is things in ts-sql-query are done in the same way that SQL, then you can always think how your query will be done in SQL, which will be close to the way to do it in ts-sql-query.

ts-sql-query executes the query in a single call to the database; no intermedial data is processed in your backend server; everything is done in a single SQL query in the same way you write it in ts-sql-query. The exception is the select page, where a first query will be executed, returning the data contained in the page, and a second query will be executed to get the count.

## Can I generate the Tables/Views models from my database?

Yes, for this prupose you can use [ts-sql-codegen](https://github.com/lorefnon/ts-sql-codegen) that is a utility that generates table mapper classes for ts-sql-query by inspecting a database through [tbls](https://github.com/k1LoW/tbls).

## Does ts-sql-query support dynamic SQL?

Yes, ts-sql-query offers a very rich set of functionality to manage dynamic SQL generation. But be aware ts-sql-query deals with it in a declarative way (keeping the spirit of SQL) instead of an imperative way like in most commons query builders. In consequence, if you see yourself writing `if` in your code, that is the wrong path in ts-sql-query. You can read more here: [Dynamic queries](../queries/dynamic-queries.md#dynamic-queries).

## Does ts-sql-query support database-specific features?

Yes, ts-sql-query already supports database-specific features validated at compile time; if you try to use one of them but your database doesn't support it, you will get a compilation error.

## Will ts-sql-query will constrain you when you need to use a not supported feature?

ts-sql-query offers many ways to deal with non-yet supported features using [SQL fragments](../queries/sql-fragments.md); This feature covers the biggest of the cases you will hit in your use cases.

## How can I implement select for update?

`select ... for update` construction is not exposed by ts-sql-query; but if you really need (remember this is expensive), you can [customize the select](../queries/sql-fragments.md#customizing-a-select) to include the missing part in the generated SQL. Example:

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

## Does ts-sql-query support common table expressions (CTE)?

Yes, you can read how to use it here: [Using a select as a view in another select query (SQL with clause)](../queries/select.md#using-a-select-as-a-view-in-another-select-query-sql-with-clause).

## How to do a left join?

To use a table or view in a left join, you must mark it for use in a left join to define the types properly. You can read how to use it here: [Select with left join](../queries/select.md#select-with-left-join).

## How to do a left join of a select in a with clause?

First, you must mark the query **for use in query** and then **for use in left join**. Example:

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

You can see them here: [API](../api/introduction.md).

## How can I organize my code to reuse some queries in different places?

You can create functions that return the prebuilt query you want to reuse; the only requirement is to omit the function's return type to allow TypeScript to infer it. Additionally, you can take advantage of [Select clauses order](../queries/select.md#select-clauses-order) that ts-sql-query offers. With this in mind, you will be able to postpone the where clause till the end of the query (in SQL it will be generated in the proper place). Example:

```ts
function buildNumberOfCustomersSubquery(connection: DBConnection) {
    return connection
        .subSelectUsing(tCompany)
        .from(tCustomer)
        .where(tCustomer.companyId.equals(tCompany.id))
        .selectOneColumn(connection.countAll())
        .forUseAsInlineQueryValue()
        .valueWhenNull(0);
}

function buildCompaniesWithNumberOfCustomersQuery(connection: DBConnection) {
    return connection.selectFrom(tCompany)
        .select({
            id: tCompany.id,
            name: tCompany.name,
            numberOfCustomers: buildNumberOfCustomersSubquery(connection)
        })
}

interface CompanyInfoWithNumberOfCustomers {
    id: number;
    name: string;
    numberOfCustomers: number;
}

async function getCompanyInfoWithNumberOfCustomers(connection: DBConnection, id: number): CompanyInfoWithNumberOfCustomers {
    return await buildCompaniesWithNumberOfCustomersQuery(connection)
        .where(tCompany.id.equals(id))
        .executeSelectOne()
}
```

!!! tip

    If you need to use table or view with alias you can pass it as parameter to the functions. See [Passing tables and views as parameter](../advanced/tables-views-as-parameter.md) for more information.

## How can I use select * in my queries?

`select *` is very useful, especially when creating manual queries to see at the moment, but it is very dangerous when building your backend. The issue is related to what happens during the time; when you build your backend, the backend and database are synced, but that will be true only sometimes. One example is when you are deploying a new version of your system that requires changes in the database. If you use `select *`, then the query will return a new column (not managed by the backend), or an expected column will disappear, and the backend will misbehave (instead of throwing an error). That kinds of errors are hard and very dangerous; it is better to have a clear error than a silent malfunctioning system.

You should avoid using `select *` in your backend queries; instead, you should explicitly indicate what you are expecting; in this way, you will receive no unpleasant surprises. If you want to get similar behaviour to `select *` without the `*`, you can use the columns known by the backend as a reference. In that case, you can use [Extract columns](../advanced/columns-from-object.md#extract-columns) utility function.
