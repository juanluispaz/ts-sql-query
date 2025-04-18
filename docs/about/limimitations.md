---
search:
  boost: 0.11
---
# Limitations

## How to order a query by a column not returned by the select?

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

!!! quote "Workaround not required any more"

    The `orderBy` functions only supported columns returned by the query, but you can [customize the select](../queries/sql-fragments.md#customizing-a-select) to provide a custom `order by` to your query. Example:

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

## Does ts-sql-query support window constructions?

`window` is not supported right now by ts-sql-query; `window` is a very powerful and big feature that each database implements in a very different way. There is no plan right now to support `window` constructions in ts-sql-query. Said that one recommended solution is to create a view, but if you need to use `window` constructions in your query, you can use [SQL fragments](../queries/sql-fragments.md) to archive it. Be aware `customizeQuery` function allows you to provide a window clause to your select queries if you need it.

## How to compare against a null or undefined value?

SQL support three-valued logic that doesn't exists in the same way in TypeScript/JavaScript. In early versions of ts-sql-query this was fully supported, but in our internal use, we realize that it creates a lot of troubles due to its unexpected behaviour from the TypeScript/JavaScript point of view. Because of that, operations that produce a boolean value (like comparison) that uses values from TypeScript/JavaScript were deprecated. Usually, when you what to compare against a value that can be `null` or `undefined`, you need dynamic SQL. For this usage, you have the `*IfValue` methods available, which create the condition when the provided value is not `null` or `undefined`. Otherwise, the condition is omitted (You can read more [here](../queries/dynamic-queries.md#easy-dynamic-queries)). For most of the cases, the `*IfValue` behaviour is what you need; but in some cases, you don't want the condition to be omitted in case of no value; instead, you want to use `false` as value, to do this you can do `*IfValue(...).falseWhenNoValue()`. If you want to use the SQL three-valued logic, you will need to write your custom SQL fragment like this:

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

## Select count(*) inline subquery value returns an optional value

In ts-sql-query it used to be a limitation, but starting with ts-sql-query 1.52.0 you can do the following:

```ts
const numberOfCustomers = connection
    .subSelectUsing(tCompany)
    .from(tCustomer)
    .where(tCustomer.companyId.equals(tCompany.id))
    .selectCountAll()
    .forUseAsInlineQueryValue();  // At this point is a value that you can use in other query
```

!!! quote "Workaround not required any more"

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

## Can I put an insert/update/delete in a with clause?

Nowadays, PostgreSQL is the only database supported by ts-sql-query that allows doing this, but this construction is not yet supported in ts-sql-query.
