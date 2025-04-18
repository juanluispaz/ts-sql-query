---
search:
  boost: 0.7
---
# Passing tables and views as parameter

If you want to pass a table or view to a function as a parameter, you must provide its type. For this purpose ts-sql-query offers you the types:

- `TableOrViewOf`: for use with regular tables or views that allows creating a reference to the table or view.
- `TableOrViewLeftJoinOf`: for the case, the table or view is marked for use in a left join.

These types receive as first generic argument the type of the referenced table or view, and optionally as second argument the alias in case it has one. These types are the base type of the generic argument the function receives that will represent the real type.

To access the columns, you will need to transform the reference into a real instance of the table or view. To do it, you will need to call the `fromRef` function and provide, as the first argument, the table or view represented by the reference (or the class of it) and, as the second argument, the referenced object.

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
