---
search:
  boost: 0.11
---
# Limitations

## How to order by a column not returned in the SELECT projection?

In `ts-sql-query`, this was previously a limitation. However, starting with `ts-sql-query` 1.52.0, you can now do the following:

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

    The `orderBy` functions previously only supported columns that were returned by the query. Now, you can [customize the select](../queries/sql-fragments.md#customizing-a-select) to provide a custom `order by` for your query. For example:

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

## Does ts-sql-query support window functions?

Currently, `window` functions are not supported by `ts-sql-query`. This feature is powerful and complex, with each database implementing it in different ways. At this time, there are no plans to support `window` functions in `ts-sql-query`. A recommended solution is to create a view; however, if you need to use `window` functions in your query, you can utilize [SQL fragments](../queries/sql-fragments.md) to achieve it. Please note that the `customizeQuery` function allows you to provide a window clause for your select queries if needed.

## How to compare against a null or undefined value?

SQL supports three-valued logic, which does not exist in the same manner in TypeScript/JavaScript. In earlier versions of `ts-sql-query`, this was fully supported, but through our internal use, we realized it caused many issues due to its unexpected behavior from the TypeScript/JavaScript perspective. As a result, operations that produce a boolean value (such as comparisons) using values from TypeScript/JavaScript were deprecated. Typically, when you want to compare against a value that can be `null` or `undefined`, you need dynamic SQL. For this purpose, you have the `*IfValue` methods available, which create the condition when the provided value is not `null` or `undefined`. Otherwise, the condition is omitted (You can read more [here](../queries/dynamic-queries.md#easy-dynamic-queries)). In most cases, the `*IfValue` behavior is sufficient; however, in some situations, you may not want the condition to be omitted when there is no value; instead, you may want to use `false` as the value. To achieve this, you can use `*IfValue(...).falseWhenNoValue()`. If you wish to utilize SQL's three-valued logic, you will need to write your custom SQL fragment like this:

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

## How to handle optional values returned by a SELECT COUNT(*) inline subquery?

In `ts-sql-query`, this was previously a limitation. However, starting with `ts-sql-query` 1.52.0, you can now do the following:

```ts
const numberOfCustomers = connection
    .subSelectUsing(tCompany)
    .from(tCustomer)
    .where(tCustomer.companyId.equals(tCompany.id))
    .selectCountAll()
    .forUseAsInlineQueryValue();  // At this point, this is a value that you can use in another query
```

!!! quote "Workaround not required any more"

    When using an inline query value, the result may return `null` if no rows match the conditions of the table. However, `SELECT COUNT(*)` is an exception, and `ts-sql-query` cannot detect it. To address this limitation, you can set the value to zero when it is null. For example:

    ```ts
    const numberOfCustomers = connection
        .subSelectUsing(tCompany)
        .from(tCustomer)
        .where(tCustomer.companyId.equals(tCompany.id))
        .selectOneColumn(connection.countAll())
        .forUseAsInlineQueryValue() // At this point, this is a value that you can use in another query
        .valueWhenNull(0);
    ```

## Is it possible to include INSERT, UPDATE, or DELETE statements in a WITH clause?

Currently, only [PostgreSQL](../configuration/supported-databases/postgresql.md) supports including these statements in a WITH clause, but this construction is not yet supported in `ts-sql-query`.
