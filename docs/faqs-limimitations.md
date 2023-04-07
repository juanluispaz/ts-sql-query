# FAQs & Limitations

## FAQs

### How ts-sql-query modelate the queries?

ts-sql-query try to modelate the queries keeping the essence of SQL; the queries are designed after SQLite and PostgreSQL but keeping in mind it needs to be understandable in a TypeScript/JavaScript context. So when TypeScript/JavaScript do things in a way, ts-sql-query tries to preserve it (it is a tricky balance). The consequence of this modelling philosophy is things in ts-sql-query are done in the same way that SQL, then you can always think how your query will be done in SQL, which will be close to the way to do it in ts-sql-query.

ts-sql-query executes the query in a single call to the database; no intermedial data is processed in your backend server; everything is done in a single SQL query in the same way you write it in ts-sql-query. The exception is the select page, where a first query will be executed, returning the data contained in the page, and a second query will be executed to get the count.

### Can I generate the Tables/Views models from my database?

Yes, for this prupose you can use [ts-sql-codegen](https://github.com/lorefnon/ts-sql-codegen) that is a utility that generates table mapper classes for ts-sql-query by inspecting a database through [tbls](https://github.com/k1LoW/tbls).

### Does ts-sql-query support dynamic SQL?

Yes, ts-sql-query offers a very rich set of functionality to manage dynamic SQL generation. But be aware ts-sql-query deals with it in a declarative way (keeping the spirit of SQL) instead of an imperative way like in most commons query builders. In consequence, if you see yourself writing `if` in your code, that is the wrong path in ts-sql-query. You can read more here: [Dynamic queries](queries/dynamic-queries.md#dynamic-queries).

### Does ts-sql-query support database-specific features?

Yes, ts-sql-query already supports database-specific features validated at compile time; if you try to use one of them but your database doesn't support it, you will get a compilation error.

### Will ts-sql-query will constrain you when you need to use a not supported feature?

ts-sql-query offers many ways to deal with non-yet supported features using [SQL fragments](queries/sql-fragments.md); This feature covers the biggest of the cases you will hit in your use cases.

### How can I implement select for update?

`select ... for update` construction is not exposed by ts-sql-query; but if you really need (remember this is expensive), you can [customize the select](queries/sql-fragments.md#customizing-a-select) to include the missing part in the generated SQL. Example:

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

### Does ts-sql-query support common table expressions (CTE)?

Yes, you can read how to use it here: [Using a select as a view in another select query (SQL with clause)](queries/select.md#using-a-select-as-a-view-in-another-select-query-sql-with-clause).

### How to do a left join?

To use a table or view in a left join, you must mark it for use in a left join to define the types properly. You can read how to use it here: [Select with left join](queries/select.md#select-with-left-join).

### How to do a left join of a select in a with clause?

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

### Where can I see all functions/methods provided by ts-sql-query?

You can see them here: [Supported operations](supported-operations.md#supported-operations).

### How can I organize my code to reuse some queries in different places?

You can create functions that return the prebuilt query you want to reuse; the only requirement is to omit the function's return type to allow TypeScript to infer it. Additionally, you can take advantage of [Select clauses order](queries/select.md#select-clauses-order) that ts-sql-query offers. With this in mind, you will be able to postpone the where clause till the end of the query (in SQL it will be generated in the proper place). Example:

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

**Note**: If you need to use table or view with alias you can pass it as parameter to the functions. See [Passing tables and views as parameter](advanced-usage.md#passing-tables-and-views-as-parameter) for more information.

### How can I use select * in my queries?

`select *` is very useful, especially when creating manual queries to see at the moment, but it is very dangerous when building your backend. The issue is related to what happens during the time; when you build your backend, the backend and database are synced, but that will be true only sometimes. One example is when you are deploying a new version of your system that requires changes in the database. If you use `select *`, then the query will return a new column (not managed by the backend), or an expected column will disappear, and the backend will misbehave (instead of throwing an error). That kinds of errors are hard and very dangerous; it is better to have a clear error than a silent malfunctioning system.

You should avoid using `select *` in your backend queries; instead, you should explicitly indicate what you are expecting; in this way, you will receive no unpleasant surprises. If you want to get similar behaviour to `select *` without the `*`, you can use the columns known by the backend as a reference. In that case, you can use [Extract columns](advanced-usage.md#extract-columns) utility function.

## Limitations

### How to order a query by a column not returned by the select?

In ts-sql-query it used to be a limitation, but starting with ts-sql-query 1.52.0 you can do the following:

```ts
const customerId = 10;

const customerWithId = connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(10))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .orderBy(tCustomer.birthday, 'desc nulls last')
    .executeSelectOne();
```

**Workaround not required any more**:

The `orderBy` functions only supported columns returned by the query, but you can [customize the select](queries/sql-fragments.md#customizing-a-select) to provide a custom `order by` to your query. Example:

```ts
const customizedSelect = connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(10))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    }).customizeQuery({
        beforeOrderByItems: connection.rawFragment`${tCustomer.birthday} desc`
    })
    .executeSelectOne()
```

### Does ts-sql-query support window constructions?

`window` is not supported right now by ts-sql-query; `window` is a very powerful and big feature that each database implements in a very different way. There is no plan right now to support `window` constructions in ts-sql-query. Said that one recommended solution is to create a view, but if you need to use `window` constructions in your query, you can use [SQL fragments](queries/sql-fragments.md) to archive it. Be aware `customizeQuery` function allows you to provide a window clause to your select queries if you need it.

### How to compare against a null or undefined value?

SQL support three-valued logic that doesn't exists in the same way in TypeScript/JavaScript. In early versions of ts-sql-query this was fully supported, but in our internal use, we realize that it creates a lot of troubles due to its unexpected behaviour from the TypeScript/JavaScript point of view. Because of that, operations that produce a boolean value (like comparison) that uses values from TypeScript/JavaScript were deprecated. Usually, when you what to compare against a value that can be `null` or `undefined`, you need dynamic SQL. For this usage, you have the `*IfValue` methods available, which create the condition when the provided value is not `null` or `undefined`. Otherwise, the condition is omitted (You can read more [here](queries/dynamic-queries.md#easy-dynamic-queries)). For most of the cases, the `*IfValue` behaviour is what you need; but in some cases, you don't want the condition to be omitted in case of no value; instead, you want to use `false` as value, to do this you can do `*IfValue(...).falseWhenNoValue()`. If you want to use the SQL three-valued logic, you will need to write your custom SQL fragment like this:

```ts
class DBConnection extends PostgreSqlConnection<'DBConnection'> { 

    equalsFalsyOptionalString = this.buildFragmentWithArgs(
        this.arg('string', 'optional'),
        this.arg('string', 'optional')
    ).as((left, right) => {
        // The fragment here is: ${left} = ${right}
        return this.fragmentWithType('boolean', 'optional').sql`${left} = ${right}`
    })
}
```

### Select count(*) inline subquery value returns an optional value

In ts-sql-query it used to be a limitation, but starting with ts-sql-query 1.52.0 you can do the following:

```ts
const numberOfCustomers = connection
    .subSelectUsing(tCompany)
    .from(tCustomer)
    .where(tCustomer.companyId.equals(tCompany.id))
    .selectCountAll()
    .forUseAsInlineQueryValue();  // At this point is a value that you can use in other query
```

**Workaround not required any more**:

When you use an inline query value, the value may return `null` due to rows matching the conditions of the table being empty, but select count(*) is the exception, and ts-sql-query is unable to detect it. To deal with this limitation, you can set the value to zero when null. Example:

```ts
const numberOfCustomers = connection
    .subSelectUsing(tCompany)
    .from(tCustomer)
    .where(tCustomer.companyId.equals(tCompany.id))
    .selectOneColumn(connection.countAll())
    .forUseAsInlineQueryValue() // At this point is a value that you can use in other query
    .valueWhenNull(0);
```

### Can I put an insert/update/delete in a with clause?

Nowadays, PostgreSQL is the only database supported by ts-sql-query that allows doing this, but this construction is not yet supported in ts-sql-query.