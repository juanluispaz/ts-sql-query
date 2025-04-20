---
search:
  boost: 0.7
---
# Passing tables and views as parameter

In `ts-sql-query`, it's possible to pass a table or view as a parameter to a function. To do this properly, you must specify its type. This is where the utility types `TableOrViewOf` and `TableOrViewLeftJoinOf` come into play:

- `TableOrViewOf`: for use with regular tables or views that allows creating a reference to the table or view.
- `TableOrViewLeftJoinOf`: for the case, the table or view is marked for use in a left join.

These types accept the referenced table or view as the first generic argument, and optionally an alias as the second. They are used as the base type for parameters that refer to a specific table or view instance.

To access the columns of the table or view, you need to convert the reference into an actual instance using the `fromRef` function. The first argument is the table or view (or its class), and the second is the reference object.

```ts
import { fromRef, TableOrViewLeftJoinOf, TableOrViewOf } from 'ts-sql-query/extras/types';

function buildNumberOfCustomersSubquery<COMPANY extends TableOrViewOf<typeof tCompany, 'company'>>(connection: DBConnection, companyRef: COMPANY) {
    const company = fromRef(tCompany, companyRef);

    return connection
        .subSelectUsing(company)
        .from(tCustomer)
        .where(tCustomer.companyId.equals(company.id))
        .selectOneColumn(connection.countAll())
        .forUseAsInlineQueryValue()
        .valueWhenNull(0);
}

async function getCompanyInfoWithNumberOfCustomers(connection: DBConnection, id: number) {
    const company = tCompany.as('company');

    return await connection.selectFrom(company)
        .select({
            id: company.id,
            name: company.name,
            numberOfCustomers: buildNumberOfCustomersSubquery(connection, company)
        })
        .where(company.id.equals(id))
        .executeSelectOne()
}
```
